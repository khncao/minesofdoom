import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Animated, Image, StyleSheet, View } from "react-native";
import {
  CAVE_METERS_PER_ROW,
  CAVE_PX_PER_METER,
  CAVE_TILE_PX,
  caveRowStartForDepth,
  caveRowUri,
  caveTranslateForDepth,
} from "src/utils/graphics/caveTiles";
import { stripSizeForWidth } from "src/utils/graphics/pixelArt";

/** Fallback window height (px) before the first onLayout. */
const INITIAL_HEIGHT = 13 * CAVE_TILE_PX;
/** Slide duration per descent step (px are small — keep it snappy). */
const SLIDE_MS = 300;

/**
 * Cave background (plan §4.5, reworked for "digging deeper"): a vertical
 * run of pre-rendered tile rows (`caveTiles.ts`) stretched to full width,
 * covering the whole canvas (the row count follows the measured height).
 * The strip descends PROPORTIONAL to absolute depth — every meter mined
 * pushes the rock down CAVE_PX_PER_METER px, so the cave keeps sliding
 * while the player mines, faster as they earn faster. The rows re-index
 * one row per CAVE_METERS_PER_ROW meters (exactly one full row of slide),
 * and the animated value is advanced by the same row in the same commit,
 * so the descent is continuous instead of the old one-tile-per-tier nudge.
 * Depth is lifetime-mining based (it only ever climbs), which is what
 * makes "content only moves up" safe.
 */
interface CaveBackgroundProps {
  depth: bigint;
  /** Tint for the current depth tier (theme-aware, see `cosmetics.ts`). */
  tint?: string;
  /** Low-end fallback (plan §4.5): flat tinted rows, no PNG strips. */
  emojiArt?: boolean;
}

function CaveBackground({
  depth,
  tint = "#a0856a",
  emojiArt = false,
}: CaveBackgroundProps) {
  const scrollAnim = useRef(new Animated.Value(0)).current;
  const scrollAnimRunRef = useRef<Animated.CompositeAnimation | null>(null);
  const prevDescendPx = useRef(0);
  const [height, setHeight] = useState(0);
  const [width, setWidth] = useState(0);

  const rowStart = caveRowStartForDepth(depth);
  const descendPx = CAVE_PX_PER_METER * Number(depth);
  const target = caveTranslateForDepth(depth, rowStart);

  // Rows needed to cover the window + one row of slide headroom. The count
  // (not the URIs) only changes when the container resizes or a full row
  // of descent lands, so fast mining re-renders only when content changes.
  const rowCount = Math.ceil((height || INITIAL_HEIGHT) / CAVE_TILE_PX) + 1;

  // Adaptive-width strips: bake each row at the container width (rounded up
  // to a tile multiple) so the Image stretch is ~zero on wide screens
  // instead of smearing 336px across 1280+. Undefined until first layout.
  const stripWidth =
    width > 0 ? stripSizeForWidth(width, CAVE_TILE_PX) : undefined;

  // Skipped entirely in emoji mode — no PNG baking either, not just no
  // render. Rows are addressed by ABSOLUTE cave depth (rowStart + i), so
  // a row re-index lands exactly when the slide completes one row.
  const rows = useMemo(
    () =>
      emojiArt
        ? []
        : Array.from({ length: rowCount }, (_, i) =>
            caveRowUri({
              depth: rowStart * CAVE_METERS_PER_ROW + i,
              tint,
              widthPx: stripWidth,
            }),
          ),
    [rowStart, rowCount, tint, emojiArt, stripWidth],
  );

  useLayoutEffect(() => {
    const delta = descendPx - prevDescendPx.current;
    prevDescendPx.current = descendPx;
    if (delta > 0) {
      // Crossed a full row of descent: the rows re-indexed by N rows in
      // the same commit — advance the animated value by exactly the rows
      // it previously showed so the swap is content-continuous, then
      // slide the sub-row fraction. (setValue before paint via
      // useLayoutEffect, so even a big jump never shows a pop.)
      if (delta >= CAVE_TILE_PX) {
        scrollAnim.setValue(target + delta);
      }
      scrollAnimRunRef.current?.stop();
      scrollAnimRunRef.current = Animated.timing(scrollAnim, {
        toValue: target,
        duration: SLIDE_MS,
        useNativeDriver: true,
      });
      scrollAnimRunRef.current.start();
    } else {
      // Depth can only fall on a save switch to a shallower state — snap
      // (no upward "digging up" animation).
      scrollAnimRunRef.current?.stop();
      scrollAnim.setValue(target);
    }
  }, [depth, descendPx, target, rowStart, scrollAnim]);

  useEffect(
    () => () => {
      scrollAnimRunRef.current?.stop();
    },
    [],
  );

  const translateY = scrollAnim.interpolate({
    inputRange: [-1e6, 1e6],
    outputRange: [-1e6, 1e6],
  });

  return (
    <View
      style={styles.container}
      pointerEvents="none"
      onLayout={(e) => {
        const { width: w, height: h } = e.nativeEvent.layout;
        if (h > 0 && h !== height) setHeight(h);
        if (w > 0 && w !== width) setWidth(w);
      }}
    >
      <Animated.View style={{ transform: [{ translateY }] }}>
        {emojiArt
          ? // Flat tinted rows (alternating lightness) — same descent
            // animation, zero image decode (plan §4.5 low-end fallback).
            // Parity keyed on the ABSOLUTE row index (rowStart + i) so a
            // re-index never flashes the alternating pattern.
            Array.from({ length: rowCount }, (_, i) => (
              <View
                key={i}
                style={[
                  styles.row,
                  {
                    backgroundColor: tint,
                    opacity: (rowStart + i) % 2 === 0 ? 0.9 : 0.45,
                  },
                ]}
              />
            ))
          : rows.map((uri, i) => (
              <Image
                key={i}
                source={{ uri }}
                style={styles.row}
                resizeMode="stretch"
              />
            ))}
      </Animated.View>
    </View>
  );
}

export default React.memo(CaveBackground);

const styles = StyleSheet.create({
  container: {
    // RN 0.86 removed StyleSheet.absoluteFillObject; keep the literal
    // instead (absoluteFill is an opaque array, not spreadable).
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: "hidden",
    opacity: 0.35,
  },
  row: {
    width: "100%",
    height: CAVE_TILE_PX,
  },
});
