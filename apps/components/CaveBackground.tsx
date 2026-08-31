import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

const TILE_HEIGHT = 24;
const COLS = 20;

// Row templates by depth tier
function buildRow(depth: number, rowIdx: number): string {
  const seed = depth * 1000 + rowIdx;
  const pseudo = (n: number) => Math.abs(Math.sin(seed * 9301 + n * 49297 + 233995)) % 1;
  const chars = Array.from({ length: COLS }, (_, c) => {
    const v = pseudo(c);
    if (depth < 10) {
      return v < 0.06 ? "🪨" : v < 0.1 ? "·" : " ";
    } else if (depth < 30) {
      return v < 0.08 ? "💎" : v < 0.15 ? "🪨" : v < 0.2 ? "·" : " ";
    } else {
      return v < 0.05 ? "✨" : v < 0.12 ? "💎" : v < 0.2 ? "🪨" : v < 0.25 ? "·" : " ";
    }
  });
  return chars.join("");
}

const ROWS = 12;

interface CaveBackgroundProps {
  depth: number;
}

export default function CaveBackground({ depth }: CaveBackgroundProps) {
  const scrollAnim = useRef(new Animated.Value(0)).current;
  const prevDepth = useRef(depth);

  useEffect(() => {
    if (depth !== prevDepth.current) {
      prevDepth.current = depth;
      Animated.timing(scrollAnim, {
        toValue: scrollAnim.__getValue() + TILE_HEIGHT,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }
  }, [depth, scrollAnim]);

  const rows = Array.from({ length: ROWS + 1 }, (_, i) => {
    const rowDepth = depth + i;
    return buildRow(rowDepth, i);
  });

  const translateY = scrollAnim.interpolate({
    inputRange: [-1e6, 1e6],
    outputRange: [-1e6, 1e6],
  });

  return (
    <View style={styles.container} pointerEvents="none">
      <Animated.View style={{ transform: [{ translateY }] }}>
        {rows.map((row, i) => (
          <Text key={i} style={styles.row}>
            {row}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
    opacity: 0.35,
  },
  row: {
    height: TILE_HEIGHT,
    fontSize: 14,
    fontFamily: "monospace",
    color: "#a0856a",
    letterSpacing: 2,
  },
});
