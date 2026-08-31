import React, { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Animated, StyleSheet, Text } from "react-native";

export interface DebrisParticlesRef {
  trigger: () => void;
}

const PARTICLES = ["🪨", "🪨", "💫", "·", "·", "·"];
const COUNT = 5;

function makeParticle(id: number) {
  const angle = (Math.random() * Math.PI * 2);
  const dist = 40 + Math.random() * 40;
  return {
    id,
    emoji: PARTICLES[Math.floor(Math.random() * PARTICLES.length)],
    tx: Math.cos(angle) * dist,
    ty: Math.sin(angle) * dist - 20,
  };
}

const DebrisParticles = forwardRef<DebrisParticlesRef>((_, ref) => {
  const [particles, setParticles] = useState<
    { id: number; emoji: string; tx: number; ty: number; anim: Animated.Value }[]
  >([]);
  const idRef = useRef(0);

  useImperativeHandle(ref, () => ({
    trigger() {
      const newParticles = Array.from({ length: COUNT }, () => {
        const p = makeParticle(idRef.current++);
        const anim = new Animated.Value(0);
        Animated.timing(anim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }).start(() => {
          setParticles((prev) => prev.filter((x) => x.anim !== anim));
        });
        return { ...p, anim };
      });
      setParticles((prev) => [...prev, ...newParticles]);
    },
  }));

  return (
    <>
      {particles.map((p) => (
        <Animated.Text
          key={p.id}
          style={[
            styles.particle,
            {
              opacity: p.anim.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
              transform: [
                { translateX: p.anim.interpolate({ inputRange: [0, 1], outputRange: [0, p.tx] }) },
                { translateY: p.anim.interpolate({ inputRange: [0, 1], outputRange: [0, p.ty] }) },
                { scale: p.anim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.5, 1.2, 0.4] }) },
              ],
            },
          ]}
        >
          {p.emoji}
        </Animated.Text>
      ))}
    </>
  );
});

export default DebrisParticles;

const styles = StyleSheet.create({
  particle: {
    position: "absolute",
    fontSize: 16,
    pointerEvents: "none",
  },
});
