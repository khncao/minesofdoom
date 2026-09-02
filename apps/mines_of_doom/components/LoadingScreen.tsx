import { memo, useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

/**
 * Shown until the stored save has been read, migrated and applied
 * (useGameEngine `isLoaded`). Without it, a cold start flashed the empty
 * state (0 minerals, depth 0, first equation) for a frame or two while
 * AsyncStorage resolved — plan §4.4 "proper loading state". The pulse is a
 * native-driver opacity loop, so it costs no React re-renders per frame.
 */
const LoadingScreen = memo(function LoadingScreen({
  reduceMotion,
}: {
  reduceMotion: boolean;
}) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduceMotion) {
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, pulse]);

  return (
    <View style={styles.wrap}>
      <Animated.Text style={[styles.icon, { opacity: pulse }]}>⛏️</Animated.Text>
      <Text style={styles.label}>loading the mine…</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2f1f1f",
  },
  icon: {
    fontSize: 44,
    marginBottom: 12,
  },
  label: {
    color: "#fff",
    fontSize: 14,
    userSelect: "none",
  },
});

export default LoadingScreen;
