import { forwardRef, memo, useImperativeHandle, useRef, useState } from "react";
import { Animated, StyleSheet } from "react-native";
import { T as Text } from "src/mines_of_doom/textScale";
export interface BlockBreakRef {
  trigger: () => void;
}

/**
 * Minecraft-style rock break: a small block spawns at the impact point and
 * passes through staged cracking (three crack overlays appear in sequence,
 * like the MC "cracking" sprite stages), pulses while the pickaxe connects,
 * then shatters — the face pops away and a handful of shards fly outward in
 * a per-hit random direction fan. Self-capping (like DebrisParticles) so
 * tap-spam can't stack unbounded animations.
 */
const DURATION = 480; // ~78% cracking, ~22% shatter
const MAX_BLOCKS = 5;
const MIN_TRIGGER_INTERVAL = 80;

/** Crack-glyph variants — the break pattern differs from hit to hit. */
const CRACK_GLYPHS = ["✳", "✕", "❋"] as const;

interface Shard {
  dx: number;
  dy: number;
  size: number;
}

interface Block {
  id: number;
  x: number;
  y: number;
  variant: number;
  shards: Shard[];
  anim: Animated.Value;
}

function makeBlock(id: number): Block {
  return {
    id,
    x: Math.round((Math.random() - 0.5) * 120),
    y: Math.round((Math.random() - 0.5) * 80 - 10),
    variant: Math.floor(Math.random() * CRACK_GLYPHS.length),
    // Shatter fan: shards fly outward from the block center. The base angle
    // is randomized per hit so the shatter pattern varies.
    shards: Array.from({ length: 6 }, (_, i) => {
      const angle = (i / 6) * Math.PI * 2 + (Math.random() - 0.5) * 0.9;
      const dist = 16 + Math.random() * 20;
      return {
        dx: Math.round(Math.cos(angle) * dist),
        dy: Math.round(Math.sin(angle) * dist),
        size: 3 + Math.round(Math.random() * 4),
      };
    }),
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
          // Impact pulse while the pickaxe connects, then a final pop.
          const pop = v.interpolate({
            inputRange: [0, 0.15, 0.3, 0.45, 0.7, 0.8, 1],
            outputRange: [1, 0.9, 1.06, 0.92, 1, 1.15, 0.5],
          });
          // The block face is fully intact until the shatter, then vanishes.
          const faceOpacity = v.interpolate({
            inputRange: [0, 0.78, 0.9, 1],
            outputRange: [1, 1, 0, 0],
          });
          // Staged cracking: three overlays step in as the block weakens
          // (the MC cracking-sprite pattern), each a little more branched.
          const stage1 = v.interpolate({
            inputRange: [0.05, 0.18],
            outputRange: [0, 1],
          });
          const stage2 = v.interpolate({
            inputRange: [0.38, 0.5],
            outputRange: [0, 1],
          });
          const stage3 = v.interpolate({
            inputRange: [0.6, 0.7],
            outputRange: [0, 1],
          });
          // Shatter progress: 0 → 1 over the final 22% of the timeline.
          const shatter = v.interpolate({
            inputRange: [0.78, 1],
            outputRange: [0, 1],
          });
          return (
            <Animated.View
              key={b.id}
              pointerEvents="none"
              style={{
                position: "absolute",
                left: b.x,
                top: b.y,
                opacity: 1,
                transform: [{ scale: pop }],
              }}
            >
              <Animated.View style={[styles.block, { opacity: faceOpacity }]}>
                <Text style={styles.blockEmoji}>🪨</Text>
                <Animated.Text
                  style={[
                    styles.crack,
                    { opacity: stage1, transform: [{ scale: 0.7 }] },
                  ]}
                >
                  {CRACK_GLYPHS[b.variant]}
                </Animated.Text>
                <Animated.Text
                  style={[
                    styles.crack,
                    {
                      opacity: stage2,
                      transform: [
                        { scale: 1.05 },
                        { rotate: `${(b.id % 3) * 25 - 25}deg` },
                      ],
                    },
                  ]}
                >
                  {CRACK_GLYPHS[(b.variant + 1) % CRACK_GLYPHS.length]}
                </Animated.Text>
                <Animated.Text
                  style={[
                    styles.crack,
                    { opacity: stage3, transform: [{ scale: 1.35 }] },
                  ]}
                >
                  {CRACK_GLYPHS[(b.variant + 2) % CRACK_GLYPHS.length]}
                </Animated.Text>
              </Animated.View>
              {b.shards.map((s, i) => (
                <Animated.View
                  key={i}
                  style={{
                    position: "absolute",
                    left: 17 - s.size / 2,
                    top: 17 - s.size / 2,
                    width: s.size,
                    height: s.size,
                    backgroundColor: i % 2 === 0 ? "#6b5a4a" : "#4a3c2f",
                    opacity: shatter.interpolate({
                      inputRange: [0, 0.1, 1],
                      outputRange: [0, 1, 0],
                    }),
                    transform: [
                      {
                        translateX: shatter.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, s.dx],
                        }),
                      },
                      {
                        translateY: shatter.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, s.dy],
                        }),
                      },
                    ],
                  }}
                />
              ))}
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
