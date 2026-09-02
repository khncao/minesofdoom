import React, { forwardRef, memo, useImperativeHandle, useRef, useState } from "react";
import { Animated, StyleSheet } from "react-native";
import {
  DEBRIS_VARIANTS,
  debrisSpriteUri,
} from "apps/utils/graphics/pixelArt";

export interface DebrisParticlesRef {
  trigger: () => void;
}

// Pixel-shard sprites (plan §4.5) replacing the old emoji burst — each
// variant is a cached PNG data URI shared by every particle that draws it.
const DEBRIS_URIS: string[] = Array.from(
  { length: DEBRIS_VARIANTS },
  (_, i) => debrisSpriteUri(i),
);
const COUNT = 3;
// Cap total live particles so rapid tapping can't stack unbounded
// animations (which triggers "Excessive number of pending callbacks").
// On web the animations are JS-driven, so keep this small: each live
// particle costs a frame callback + a DOM style write every frame.
const MAX_PARTICLES = 12;
const MIN_TRIGGER_INTERVAL = 80;
const PARTICLE_DURATION = 600;

function makeParticle(id: number) {
  const angle = (Math.random() * Math.PI * 2);
  const dist = 40 + Math.random() * 40;
  return {
    id,
    uri: DEBRIS_URIS[Math.floor(Math.random() * DEBRIS_URIS.length)],
    tx: Math.cos(angle) * dist,
    ty: Math.sin(angle) * dist - 20,
  };
}

// memo: parent re-renders on every tap flush; the only meaningful input is
  // the (stable) ref, so skip re-rendering unless our own state changes.
const DebrisParticles = memo(
  forwardRef<DebrisParticlesRef, { reduceMotion?: boolean }>(
    function DebrisParticles(
      { reduceMotion = false }: { reduceMotion?: boolean } = {},
      ref,
    ) {
  const [particles, setParticles] = useState<
    { id: number; uri: string; tx: number; ty: number; anim: Animated.Value }[]
  >([]);
  const idRef = useRef(0);
  const lastTriggerRef = useRef(0);
  const reduceMotionRef = useRef(reduceMotion);
  reduceMotionRef.current = reduceMotion;

  useImperativeHandle(ref, () => ({
    trigger() {
      // Respect the OS reduce-motion preference: no particle burst.
      if (reduceMotionRef.current) {
        return;
      }
      const now = Date.now();
      if (now - lastTriggerRef.current < MIN_TRIGGER_INTERVAL) {
        return;
      }
      lastTriggerRef.current = now;
      const newParticles = Array.from({ length: COUNT }, () => {
        const p = makeParticle(idRef.current++);
        const anim = new Animated.Value(0);
        Animated.timing(anim, {
          toValue: 1,
          duration: PARTICLE_DURATION,
          useNativeDriver: true,
        }).start();
        return { ...p, anim };
      });
      setParticles((prev) => {
        const next = [...prev, ...newParticles];
        // Drop the oldest particles if we exceed the cap.
        return next.length > MAX_PARTICLES
          ? next.slice(next.length - MAX_PARTICLES)
          : next;
      });
      // Remove the whole batch in one state update instead of one per
      // particle, so a trigger causes a single re-render rather than COUNT.
      const batchIds = new Set(newParticles.map((p) => p.id));
      setTimeout(() => {
        setParticles((prev) => prev.filter((p) => !batchIds.has(p.id)));
      }, PARTICLE_DURATION);
    },
  }));

  return (
    <>
      {particles.map((p) => (
        <Animated.Image
          key={p.id}
          source={{ uri: p.uri }}
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
        />
      ))}
    </>
  );
    },
  ),
);

export default DebrisParticles;

const styles = StyleSheet.create({
  particle: {
    position: "absolute",
    width: 12,
    height: 12,
    pointerEvents: "none",
  },
});
