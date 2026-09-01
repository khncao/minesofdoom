import { Audio } from "expo-av";
import { useCallback, useEffect, useRef } from "react";
import { pickaxeSound, stoneSound } from "assets/index";

export type SoundKey = "pickaxe" | "stone";

// Sounds are created once and reused. Creating a new Audio.Sound on every
// click (and storing it in state) forced an extra re-render per click, which
// combined with the game-state updates pushed renders past the tick budget.
export function useSounds(muted: boolean) {
  const pickaxeRef = useRef<Audio.Sound | null>(null);
  const stoneRef = useRef<Audio.Sound | null>(null);

  // Throttle per sound: replaying the same sound is a cancel+restart, so
  // just cap the rate to avoid hammering the audio layer while spamming.
  const lastPlayRef = useRef<Partial<Record<SoundKey, number>>>({});

  const play = useCallback(
    (key: SoundKey, minInterval = 0) => {
      if (muted) {
        return;
      }
      const sound = key === "pickaxe" ? pickaxeRef.current : stoneRef.current;
      if (sound == null) {
        return;
      }
      const now = Date.now();
      if (now - (lastPlayRef.current[key] ?? 0) < minInterval) {
        return;
      }
      lastPlayRef.current[key] = now;
      sound.playAsync();
    },
    [muted],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [pickaxe, stone] = await Promise.all([
        Audio.Sound.createAsync(pickaxeSound),
        Audio.Sound.createAsync(stoneSound),
      ]);
      if (cancelled) {
        pickaxe.sound.unloadAsync();
        stone.sound.unloadAsync();
        return;
      }
      pickaxeRef.current = pickaxe.sound;
      stoneRef.current = stone.sound;
    })();
    return () => {
      cancelled = true;
      pickaxeRef.current?.unloadAsync();
      stoneRef.current?.unloadAsync();
      pickaxeRef.current = null;
      stoneRef.current = null;
    };
  }, []);

  return { play };
}
