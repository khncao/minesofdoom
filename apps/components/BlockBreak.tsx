import { forwardRef, memo, useImperativeHandle, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

export interface BlockBreakRef {
  trigger: () => void;
}

/**
 * Minecraft-style rock break: a small block spawns at the impact point,
 * shows a radial crack that grows (the "cracking" stages), pulses while the
 * pickaxe connects, then pops away. Self-capping (like DebrisParticles) so
 * tap-spam can't stack unbounded animations.
 */
const DURATION = 450; // ~70% cracking, ~30% shatter
const MAX_BLOCKS = 5;
const MIN_TRIGGER_INTERVAL = 80;

interface Block {
  id: number;
  x: number;
  y: number;
  anim: Animated.Value;
}

function makeBlock(id: number): Block {
  return {
    id,
    x: Math.round((Math.random() - 0.5) * 120),
    y: Math.round((Math.random() - 0.5) * 80 - 10),
    anim: new Animated.Value(0),
  };
}

const BlockBreak = memo(
  forwardRef<BlockBreakRef>(function BlockBreak(_, ref) {
    const [blocks, setBlocks] = useState<Block[]>([]);
    const idRef = useRef(0);
    const lastTriggerRef = useRef(0);

    useImperativeHandle(ref, () => ({
      trigger() {
        const now = Date.now();
        if (now - lastTriggerRef.current < MIN_TRIGGER_INTERVAL) {
          return;
        }
        lastTriggerRef.current = now;

        const block = makeBlock(idRef.current++);
        Animated.timing(block.anim, {
          toValue: 1,
          duration: DURATION,
          useNativeDriver: true,
        }).start();

        setBlocks((prev) => {
          const next = [...prev, block];
          return next.length > MAX_BLOCKS
            ? next.slice(next.length - MAX_BLOCKS)
            : next;
        });
        const id = block.id;
        setTimeout(() => {
          setBlocks((prev) => prev.filter((b) => b.id !== id));
        }, DURATION);
      },
    }));

    return (
      <>
        {blocks.map((b) => {
          const v = b.anim;
          // Impact pulse while the pickaxe connects, then a pop + fade.
          const pop = v.interpolate({
            inputRange: [0, 0.15, 0.3, 0.45, 0.7, 0.82, 1],
            outputRange: [1, 0.9, 1.06, 0.92, 1, 1.18, 0.4],
          });
          const opacity = v.interpolate({
            inputRange: [0, 0.7, 0.95, 1],
            outputRange: [1, 1, 0, 0],
          });
          // Radial crack: appears quickly, grows until the block breaks.
          const crackOpacity = v.interpolate({
            inputRange: [0, 0.1, 0.7],
            outputRange: [0, 0.9, 1],
          });
          const crackScale = v.interpolate({
            inputRange: [0, 0.7],
            outputRange: [0.2, 1.7],
          });
          return (
            <Animated.View
              key={b.id}
              pointerEvents="none"
              style={{
                position: "absolute",
                left: b.x,
                top: b.y,
                opacity,
                transform: [{ scale: pop }],
              }}
            >
              <View style={styles.block}>
                <Text style={styles.blockEmoji}>🪨</Text>
                <Animated.Text
                  style={[
                    styles.crack,
                    {
                      opacity: crackOpacity,
                      transform: [{ scale: crackScale }],
                    },
                  ]}
                >
                  ✳
                </Animated.Text>
              </View>
            </Animated.View>
          );
        })}
      </>
    );
  }),
);

export default BlockBreak;

const styles = StyleSheet.create({
  block: {
    width: 34,
    height: 34,
    backgroundColor: "#6b5a4a",
    borderWidth: 2,
    borderColor: "#4a3c2f",
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  blockEmoji: {
    fontSize: 18,
  },
  crack: {
    position: "absolute",
    fontSize: 34,
    lineHeight: 34,
    color: "rgba(28, 22, 16, 0.85)",
  },
});
