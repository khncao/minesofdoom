import { Audio } from "expo-av";
import { useCallback, useEffect, useRef } from "react";
import { pickaxeSound, stoneSound, pickaxeSoundFiles } from "assets/index";

export type SoundKey = "pickaxe" | "stone";

// Sounds are created once and reused. Creating a new Audio.Sound on every
// click (and storing it in state) forced an extra re-render per click, which
// combined with the game-state updates pushed renders past the tick budget.
//
// "pickaxe" plays the equipped pickaxe's unique swing sound (plan §5.2
// "unique sounds" — pickaxeSoundFiles, keyed by pickaxe id); unknown ids
// fall back to the generic pickaxe sound so a corrupted save can't silence
// the mining feedback.
export function useSounds(muted: boolean, pickaxeId?: string) {
  const pickaxeRef = useRef<Audio.Sound | null>(null);
  const stoneRef = useRef<Audio.Sound | null>(null);
  const pickaxeSoundsRef = useRef<Partial<Record<string, Audio.Sound>>>({});
  // Ref (not a hook dep) so `play` keeps a stable identity across
  // pickaxe switches — it is memoized into useMineTaps etc.
  const pickaxeIdRef = useRef(pickaxeId);
  pickaxeIdRef.current = pickaxeId;

  // Throttle per sound: replaying the same sound is a cancel+restart, so
  // just cap the rate to avoid hammering the audio layer while spamming.
  const lastPlayRef = useRef<Partial<Record<SoundKey, number>>>({});

  const play = useCallback(
    (key: SoundKey, minInterval = 0) => {
      if (muted) {
        return;
      }
      let sound: Audio.Sound | null;
      if (key === "pickaxe") {
        const id = pickaxeIdRef.current;
        sound =
          (id != null && pickaxeSoundsRef.current[id] != null
            ? pickaxeSoundsRef.current[id]
            : pickaxeRef.current) ?? null;
      } else {
        sound = stoneRef.current;
      }
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
      const ids = Object.keys(pickaxeSoundFiles);
      const [genericPickaxe, stone, ...pickaxes] = await Promise.all([
        Audio.Sound.createAsync(pickaxeSound),
        Audio.Sound.createAsync(stoneSound),
        ...ids.map((id) => Audio.Sound.createAsync(pickaxeSoundFiles[id])),
      ]);
      if (cancelled) {
        [genericPickaxe, stone, ...pickaxes].forEach((s) =>
          s.sound.unloadAsync(),
        );
        return;
      }
      pickaxeRef.current = genericPickaxe.sound;
      stoneRef.current = stone.sound;
      ids.forEach((id, i) => {
        pickaxeSoundsRef.current[id] = pickaxes[i].sound;
      });
    })();
    return () => {
      cancelled = true;
      pickaxeRef.current?.unloadAsync();
      stoneRef.current?.unloadAsync();
      Object.values(pickaxeSoundsRef.current).forEach((s) =>
        s?.unloadAsync(),
      );
      pickaxeRef.current = null;
      stoneRef.current = null;
      pickaxeSoundsRef.current = {};
    };
  }, []);

  return { play };
}
