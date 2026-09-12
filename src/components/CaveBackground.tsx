import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Animated, Image, StyleSheet, View } from "react-native";
import {
  CAVE_METERS_PER_ROW,
  CAVE_PX_PER_METER,
  CAVE_TILE_PX,
  CAVE_WALL_TILE_H,
  caveRowStartForDepth,
  caveRowUri,
  caveWallUri,
  caveWallWidthPx,
  mixHex,
} from "src/utils/graphics/caveTiles";
import { stripSizeForWidth } from "src/utils/graphics/pixelArt";

/** Fallback window height (px) before the first onLayout lands. */
const INITIAL_HEIGHT = 13 * CAVE_TILE_PX;
/** Slide duration per descent step (px are small — keep it snappy). */
const SLIDE_MS = 300;
// Parallax rates relative to the mid rows (1×) (todo 2026-07-14 #3):
// the far wash lags behind the mid rows; the foreground walls move
// faster than the rock behind them — that speed differential is what
// reads as depth.
const FAR_PARALLAX = 0.5;
const WALL_PARALLAX = 1.25;

/**
 * Full-screen cave background (rework for "cover the whole screen, parallax
 * layers + foreground walls", todo 2026-07-14 #3). Four stacked layers, all
 * driven by the same continuous-descent math as the original single strip:
 *   1. base wash — a flat cave tint so the WHOLE screen reads as cave,
 *      not just the mining area;
 *   2. far rows  — the baked tile rows scrolling at FAR_PARALLAX (low
 *                  opacity, behind everything else);
 *   3. mid rows  — the original rows at 1× (the depth-metered descent);
 *   4. walls     — baked jagged rock columns on the screen edges at
 *                  WALL_PARALLAX speed, period CAVE_WALL_TILE_H (the
 *                  vertical repeat makes the wrap seamless).
 * Every layer keeps the original re-index hand-off: when its descent
 * crosses one period, the content re-indexes and the animated value is
 * advanced by the same period in the same commit, so each descent is
 * continuous (a new run starts at the old run's end value).
 *
 * emojiArt mode keeps the old low-end fallback (flat rows, no PNG baking)
 * plus flat wall columns.
 *
 * pointerEvents: "none" — the screen root forwards touches, and the
 * content column above handles its own.
 */
interface CaveBackgroundProps {
  depth: bigint;
  tint?: string;
  emojiArt?: boolean;
}

/**
 * One descent layer: given the layer's descent in px, return its animated
 * translateY. The layer's content is re-indexed every `periodPx` of
 * descent (rows: the row set; walls: nothing — the strip repeats); the
 * value's in-period phase is what scrolls. Mirrors the original
 * single-strip implementation for each layer's own domain.
 */
function useDescentLayer(
  valueRef: React.MutableRefObject<Animated.Value>,
  runRef: React.MutableRefObject<Animated.CompositeAnimation | null>,
  domainPx: number,
  periodPx: number,
): Animated.Value {
  const prevRef = useRef(0);
  useLayoutEffect(() => {
    const value = valueRef.current;
    const rowStart = Math.floor(domainPx / periodPx);
    const target = rowStart * periodPx - domainPx; // ∈ (-period, 0]
    const delta = domainPx - prevRef.current;
    prevRef.current = domainPx;
    if (delta > 0) {
      if (delta >= periodPx) value.setValue(target + delta);
      runRef.current?.stop();
      const run = Animated.timing(value, {
        toValue: target,
        duration: SLIDE_MS,
        useNativeDriver: true,
      });
      runRef.current = run;
      run.start();
    } else {
      // Reset / prestige / initial render: snap, no slide.
      runRef.current?.stop();
      value.setValue(target);
    }
  }, [domainPx, periodPx, valueRef, runRef]);
  return valueRef.current;
}

function CaveBackground({
  depth,
  tint = "#a0856a",
  emojiArt = false,
}: CaveBackgroundProps) {
  const midValue = useRef(new Animated.Value(0));
  const midRun = useRef<Animated.CompositeAnimation | null>(null);
  const farValue = useRef(new Animated.Value(0));
  const farRun = useRef<Animated.CompositeAnimation | null>(null);
  const wallValue = useRef(new Animated.Value(0));
  const wallRun = useRef<Animated.CompositeAnimation | null>(null);
  const [height, setHeight] = useState(0);
  const [width, setWidth] = useState(0);

  const depthPx = Number(depth);
  const midDomain = CAVE_PX_PER_METER * depthPx;
  const farDomain = FAR_PARALLAX * CAVE_PX_PER_METER * depthPx;
  const wallDomain = WALL_PARALLAX * CAVE_PX_PER_METER * depthPx;

  const midScroll = useDescentLayer(midValue, midRun, midDomain, CAVE_TILE_PX);
  const farScroll = useDescentLayer(farValue, farRun, farDomain, CAVE_TILE_PX);
  const wallScroll = useDescentLayer(
    wallValue,
    wallRun,
    wallDomain,
    CAVE_WALL_TILE_H,
  );

  // No unmount-time stop needed: every run is stopped by the start of the
  // next run (useDescentLayer), and a native-driver slide in flight at
  // unmount auto-completes within SLIDE_MS on an unread value — harmless.

  const midRowStart = caveRowStartForDepth(depth);
  const farRowStart = caveRowStartForDepth(
    BigInt(Math.floor(FAR_PARALLAX * depthPx)),
  );
  const rowCount = Math.ceil((height || INITIAL_HEIGHT) / CAVE_TILE_PX) + 1;
  const wallStrips =
    Math.ceil((height || INITIAL_HEIGHT) / CAVE_WALL_TILE_H) + 3;
  const stripWidth =
    width > 0 ? stripSizeForWidth(width, CAVE_TILE_PX) : undefined;
  const wallWidth = caveWallWidthPx(width);

  const midRowsUri = useMemo(
    () =>
      emojiArt
        ? []
        : Array.from({ length: rowCount }, (_, i) =>
            caveRowUri({
              depth: midRowStart * CAVE_METERS_PER_ROW + i,
              tint,
              widthPx: stripWidth,
            }),
          ),
    [emojiArt, midRowStart, rowCount, tint, stripWidth],
  );
  const farRowsUri = useMemo(
    () =>
      emojiArt
        ? []
        : Array.from({ length: rowCount }, (_, i) =>
            caveRowUri({
              depth: farRowStart * CAVE_METERS_PER_ROW + i,
              tint,
              widthPx: stripWidth,
            }),
          ),
    [emojiArt, farRowStart, rowCount, tint, stripWidth],
  );
  const wallLeftUri = useMemo(
    () =>
      emojiArt
        ? undefined
        : caveWallUri({ tint, side: "left", widthPx: width }),
    [emojiArt, tint, width],
  );
  const wallRightUri = useMemo(
    () =>
      emojiArt
        ? undefined
        : caveWallUri({ tint, side: "right", widthPx: width }),
    [emojiArt, tint, width],
  );

  // Identity interpolation keeps RN Web's transform animation happy
  // (the original single-strip version needed the same).
  const midY = midScroll.interpolate({
    inputRange: [-1e6, 1e6],
    outputRange: [-1e6, 1e6],
  });
  const farY = farScroll.interpolate({
    inputRange: [-1e6, 1e6],
    outputRange: [-1e6, 1e6],
  });
  const wallY = wallScroll.interpolate({
    inputRange: [-1e6, 1e6],
    outputRange: [-1e6, 1e6],
  });

  const wallColumn = (
    uri: string | undefined,
    animated: boolean,
    side: "left" | "right",
  ) => {
    // One period above the top so the wrap window (-period, 0] always
    // leaves the screen covered (see the wallScroll math above).
    const base = {
      position: "absolute" as const,
      top: -CAVE_WALL_TILE_H,
      width: wallWidth,
      ...(side === "left" ? { left: 0 } : { right: 0 }),
    };
    if (!animated || !uri) {
      return (
        <View
          style={[
            base,
            {
              backgroundColor: mixHex(tint, "#000000", 0.35),
              // Flat columns are invariant to the scroll, so no animation.
              height: "200%",
            },
          ]}
        />
      );
    }
    return (
      <Animated.View
        style={[
          base,
          { transform: [{ translateY: wallY }] },
          styles.wallColumn,
        ]}
      >
        {Array.from({ length: wallStrips }, (_, i) => (
          <Image
            key={i}
            source={{ uri }}
            style={{ width: wallWidth, height: CAVE_WALL_TILE_H }}
            resizeMode="stretch"
          />
        ))}
      </Animated.View>
    );
  };

  return (
    <View
      style={styles.container}
      onLayout={(e) => {
        const m = e.nativeEvent.layout;
        setHeight((h) => (m.height === h ? h : m.height));
        setWidth((w) => (m.width === w ? w : m.width));
      }}
      pointerEvents="none"
      accessibilityElementsHidden
      aria-hidden
    >
      {/* 1. Base wash — the whole screen reads as cave. */}
      <View
        style={[
          styles.fill,
          { backgroundColor: mixHex(tint, "#000000", 0.55), opacity: 0.35 },
        ]}
      />
      {/* 2. Far rows (slow parallax). */}
      {emojiArt ? (
        <View style={[styles.fill, { backgroundColor: tint, opacity: 0.12 }]} />
      ) : (
        <Animated.View
          style={[
            styles.fill,
            { transform: [{ translateY: farY }], opacity: 0.2 },
          ]}
        >
          {farRowsUri.map((uri, i) => (
            <Image
              key={i}
              source={{ uri }}
              style={[styles.row, { height: CAVE_TILE_PX }]}
              resizeMode="stretch"
            />
          ))}
        </Animated.View>
      )}
      {/* 3. Mid rows — the depth-metered descent (the original strip). */}
      {emojiArt ? (
        <Animated.View
          style={[
            styles.fill,
            {
              backgroundColor: tint,
              opacity: 0.35,
              transform: [{ translateY: midY }],
            },
          ]}
        >
          {Array.from({ length: rowCount }, (_, i) => (
            <View key={i} style={[styles.row, { height: CAVE_TILE_PX }]} />
          ))}
        </Animated.View>
      ) : (
        <Animated.View
          style={[
            styles.fill,
            { transform: [{ translateY: midY }], opacity: 0.35 },
          ]}
        >
          {midRowsUri.map((uri, i) => (
            <Image
              key={i}
              source={{ uri }}
              style={[styles.row, { height: CAVE_TILE_PX }]}
              resizeMode="stretch"
            />
          ))}
        </Animated.View>
      )}
      {/* 4. Foreground walls (fast parallax, jagged inner edge). */}
      {wallColumn(wallLeftUri, !emojiArt, "left")}
      {wallColumn(wallRightUri, !emojiArt, "right")}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    overflow: "hidden",
  },
  fill: {
    ...StyleSheet.absoluteFill,
  },
  row: {
    width: "100%",
  },
  wallColumn: {
    overflow: "hidden",
  },
});

export default React.memo(CaveBackground);
