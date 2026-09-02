import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Image, StyleSheet, View } from "react-native";
import { caveRowUri } from "src/utils/graphics/caveTiles";

const TILE_HEIGHT = 24;
const ROWS = 12;

/**
 * Cave background (plan §4.5): each row is a pre-rendered tile strip
 * (`caveTiles.ts`) stretched to full width. Strips are memoized PNG data URIs
 * keyed by (tint, depth band, row cycle position), so a depth change only
 * swaps cached `<Image>` sources — no per-frame React or PNG work.
 *
 * Scroll: the strip is ROWS+1 tiles tall in a ROWS-tile window. While the
 * player mines WITHIN a depth tier it slides down gradually (`progress`,
 * 0..1) and at each tier threshold the rows re-index exactly one tile, so
 * the descent is continuous instead of a jump every tier.
 */
interface CaveBackgroundProps {
  depth: number;
  /** Tint for the current depth tier (theme-aware, see `cosmetics.ts`). */
  tint?: string;
  /**
   * Progress toward the next depth tier, 0..1 (game.ts
   * `getDepthTierProgress`). Drives the gradual slide inside a tier.
   */
  progress?: number;
  /** Low-end fallback (plan §4.5): flat tinted rows, no PNG strips. */
  emojiArt?: boolean;
}

function CaveBackground({
  depth,
  tint = "#a0856a",
  progress = 0,
  emojiArt = false,
}: CaveBackgroundProps) {
  const scrollAnim = useRef(new Animated.Value(0)).current;
  const scrollAnimRunRef = useRef<Animated.CompositeAnimation | null>(null);
  const scrollOffset = useRef(0);
  const prevDepth = useRef(depth);

  useEffect(() => {
    if (depth !== prevDepth.current) {
      // Crossed a tier threshold: the rows re-indexed exactly one tile, so
      // the base offset continues one tile further — seamless hand-off.
      // (A big depth spike, e.g. offline earnings or a prestige reset,
      // just lands further into the strip; the clamp below keeps the
      // window covered.)
      prevDepth.current = depth;
      scrollOffset.current += TILE_HEIGHT;
    }
    // Clamp the base so the strip (ROWS+1 tiles) always covers the window
    // even after repeated tier crossings / resets.
    const base = Math.min(scrollOffset.current, 2 * TILE_HEIGHT);
    // Cancel the in-flight scroll so depth changes during fast mining
    // don't stack competing animations on the same value.
    scrollAnimRunRef.current?.stop();
    scrollAnimRunRef.current = Animated.timing(scrollAnim, {
      toValue: base + progress * TILE_HEIGHT,
      duration: 400,
      useNativeDriver: true,
    });
    scrollAnimRunRef.current.start();
  }, [depth, progress, scrollAnim]);

  useEffect(
    () => () => {
      scrollAnimRunRef.current?.stop();
    },
    [],
  );

  // Skipped entirely in emoji mode — no PNG baking either, not just no render.
  const rows = useMemo(
    () =>
      emojiArt
        ? []
        : Array.from({ length: ROWS + 1 }, (_, i) =>
            caveRowUri({ depth: depth + i, tint }),
          ),
    [depth, tint, emojiArt],
  );

  const translateY = scrollAnim.interpolate({
    inputRange: [-1e6, 1e6],
    outputRange: [-1e6, 1e6],
  });

  return (
    <View style={styles.container} pointerEvents="none">
      <Animated.View style={{ transform: [{ translateY }] }}>
        {emojiArt
          ? // Flat tinted rows (alternating lightness) — same scroll animation,
            // zero image decode (plan §4.5 low-end fallback).
            Array.from({ length: ROWS + 1 }, (_, i) => (
              <View
                key={i}
                style={[styles.row, { backgroundColor: tint, opacity: i % 2 === 0 ? 0.9 : 0.45 }]}
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
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
    opacity: 0.35,
  },
  row: {
    width: "100%",
    height: TILE_HEIGHT,
  },
});
