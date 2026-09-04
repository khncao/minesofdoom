import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import { useCallback, useEffect, useRef } from "react";
import { pickaxeSound, stoneSound, pickaxeSoundFiles } from "assets/index";

export type SoundKey = "pickaxe" | "stone";

// Sounds are created once and reused. Creating a new player on every
// click (and storing it in state) forced an extra re-render per click,
// which combined with the game-state updates pushed renders past the
// tick budget.
//
// "pickaxe" plays the equipped pickaxe's unique swing sound (plan §5.2
// "unique sounds" — pickaxeSoundFiles, keyed by pickaxe id); unknown ids
// fall back to the generic pickaxe sound so a corrupted save can't silence
// the mining feedback.
//
// expo-audio (SDK 53+) replaced expo-av — expo-av's prebuilt AARs were
// never rebuilt for RN 0.86's JSI API change (Runtime → IRuntime) and
// crash at dlopen on the new architecture.
export function useSounds(muted: boolean, pickaxeId?: string) {
  const pickaxeRef = useRef<AudioPlayer | null>(null);
  const stoneRef = useRef<AudioPlayer | null>(null);
  const pickaxeSoundsRef = useRef<Partial<Record<string, AudioPlayer>>>({});
  // Ref (not a hook dep) so `play` keeps a stable identity across
  // pickaxe switches — it is memoized into useMineTaps etc.
  const pickaxeIdRef = useRef(pickaxeId);
  pickaxeIdRef.current = pickaxeId;

  // Throttle per sound: replaying the same sound is a pause+seek+play, so
  // just cap the rate to avoid hammering the audio layer while spamming.
  const lastPlayRef = useRef<Partial<Record<SoundKey, number>>>({});

  const play = useCallback(
    (key: SoundKey, minInterval = 0) => {
      if (muted) {
        return;
      }
      let player: AudioPlayer | null;
      if (key === "pickaxe") {
        const id = pickaxeIdRef.current;
        player =
          (id != null && pickaxeSoundsRef.current[id] != null
            ? pickaxeSoundsRef.current[id]
            : pickaxeRef.current) ?? null;
      } else {
        player = stoneRef.current;
      }
      if (player == null) {
        return;
      }
      const now = Date.now();
      if (now - (lastPlayRef.current[key] ?? 0) < minInterval) {
        return;
      }
      lastPlayRef.current[key] = now;
      replay(player);
    },
    [muted],
  );

  useEffect(() => {
    const ids = Object.keys(pickaxeSoundFiles);
    const players = [
      createAudioPlayer(pickaxeSound),
      createAudioPlayer(stoneSound),
      ...ids.map((id) => createAudioPlayer(pickaxeSoundFiles[id])),
    ];
    pickaxeRef.current = players[0];
    stoneRef.current = players[1];
    ids.forEach((id, i) => {
      pickaxeSoundsRef.current[id] = players[1 + i];
    });
    return () => {
      players.forEach((p) => p.pause());
      pickaxeRef.current = null;
      stoneRef.current = null;
      pickaxeSoundsRef.current = {};
    };
  }, []);

  return { play };
}

// expo-av's playAsync() restarted a finished sound from zero, but a
// mid-play call was a no-op; expo-audio's play() never rewinds. Re-create
// that "cancel + restart" behavior explicitly: pause, seek to 0, play.
function replay(player: AudioPlayer) {
  if (player.playing) {
    player.pause();
    void player.seekTo(0).then(() => player.play());
    return;
  }
  if (player.currentTime > 0) {
    // Finished but the position hasn't reset yet — rewind first.
    void player.seekTo(0).then(() => player.play());
    return;
  }
  player.play();
}
