import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Image, StyleSheet, View } from "react-native";
import { caveRowUri } from "apps/utils/graphics/caveTiles";

const TILE_HEIGHT = 24;
const ROWS = 12;

/**
 * Cave background (plan §4.5): each row is a pre-rendered tile strip
 * (`caveTiles.ts`) stretched to full width. Strips are memoized PNG data URIs
 * keyed by (tint, depth band, row cycle position), so a depth change only
 * swaps cached `<Image>` sources — no per-frame React or PNG work.
 */
interface CaveBackgroundProps {
  depth: number;
  /** Tint for the current depth tier (theme-aware, see `cosmetics.ts`). */
  tint?: string;
}

function CaveBackground({ depth, tint = "#a0856a" }: CaveBackgroundProps) {
  const scrollAnim = useRef(new Animated.Value(0)).current;
  const scrollAnimRunRef = useRef<Animated.CompositeAnimation | null>(null);
  const scrollOffset = useRef(0);
  const prevDepth = useRef(depth);

  useEffect(() => {
    if (depth !== prevDepth.current) {
      prevDepth.current = depth;
      scrollOffset.current += TILE_HEIGHT;
      // Cancel the in-flight scroll so depth changes during fast mining
      // don't stack competing animations on the same value.
      scrollAnimRunRef.current?.stop();
      scrollAnimRunRef.current = Animated.timing(scrollAnim, {
        toValue: scrollOffset.current,
        duration: 400,
        useNativeDriver: true,
      });
      scrollAnimRunRef.current.start();
    }
  }, [depth, scrollAnim]);

  useEffect(
    () => () => {
      scrollAnimRunRef.current?.stop();
    },
    [],
  );

  const rows = useMemo(
    () =>
      Array.from({ length: ROWS + 1 }, (_, i) =>
        caveRowUri({ depth: depth + i, tint }),
      ),
    [depth, tint],
  );

  const translateY = scrollAnim.interpolate({
    inputRange: [-1e6, 1e6],
    outputRange: [-1e6, 1e6],
  });

  return (
    <View style={styles.container} pointerEvents="none">
      <Animated.View style={{ transform: [{ translateY }] }}>
        {rows.map((uri, i) => (
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
