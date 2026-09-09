import { AppState } from "react-native";
import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  pickaxeSound,
  stoneSound,
  pickaxeSoundFiles,
  ambientLoop,
} from "assets/index";
import { clampSoundVolume, musicLevel } from "../game";

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
export function useSounds(
  muted: boolean,
  pickaxeId: string | undefined,
  /** SFX volume in percent (0–100, settings.soundVolume). */
  volume: number,
  /** Cave-ambience music toggle (settings.music, on by default). */
  music: boolean,
  /** Music volume in percent (0–100, settings.musicVolume, default 50). */
  musicVolume: number,
) {
  const pickaxeRef = useRef<AudioPlayer | null>(null);
  const stoneRef = useRef<AudioPlayer | null>(null);
  const musicRef = useRef<AudioPlayer | null>(null);
  const pickaxeSoundsRef = useRef<Partial<Record<string, AudioPlayer>>>({});
  // Ref (not a hook dep) so `play` keeps a stable identity across
  // pickaxe switches — it is memoized into useMineTaps etc.
  const pickaxeIdRef = useRef(pickaxeId);
  pickaxeIdRef.current = pickaxeId;

  // Throttle per sound: replaying the same sound is a pause+seek+play, so
  // just cap the rate to avoid hammering the audio layer while spamming.
  const lastPlayRef = useRef<Partial<Record<SoundKey, number>>>({});

  // Volume (0–100 percent, clamped) applied to every player it exists on.
  // Set on the live players when the setting changes — the players are
  // created once and never re-created for a volume change.
  const volumeRef = useRef(clampSoundVolume(volume));
  volumeRef.current = clampSoundVolume(volume);

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
    // The looping cave-ambience bed (todo: "Music / ambient loop"): the
    // 20 s WAV is exactly periodic (scripts/generate-ambient-loop.mjs),
    // so the player's loop flag alone is what makes it seamless. Created
    // paused — the music effect below decides whether it plays.
    const musicPlayer = createAudioPlayer(ambientLoop);
    musicPlayer.loop = true;
    musicPlayer.pause();
    musicRef.current = musicPlayer;
    return () => {
      players.forEach((p) => p.pause());
      musicPlayer.pause();
      pickaxeRef.current = null;
      stoneRef.current = null;
      pickaxeSoundsRef.current = {};
      musicRef.current = null;
    };
  }, []);

  // A looping bed must not keep playing behind the app: track foreground
  // state and pause the bed when backgrounded. (SFX players don't need
  // this — their clips are ~0.2 s and end on their own.)
  const [appActive, setAppActive] = useState(() => {
    try {
      return AppState.currentState === "active";
    } catch {
      return true;
    }
  });
  useEffect(() => {
    const sub = AppState.addEventListener("change", (status) => {
      setAppActive(status === "active");
    });
    return () => sub.remove();
  }, []);

  // Runs after the creation effect (declaration order), so on mount it
  // decides on the freshly created player. The menu mute toggle still
  // wins: muted OR music-off OR backgrounded pauses the bed, otherwise
  // it plays.
  useEffect(() => {
    const p = musicRef.current;
    if (p == null) {
      return;
    }
    if (!appActive || muted || !music) {
      p.pause();
    } else {
      void p.play();
    }
  }, [appActive, muted, music]);

  // Runs after the creation effect (declaration order), so on mount it
  // lands on the freshly created players; on later settings changes it
  // updates them in place. expo-audio's volume is 0.0–1.0.
  useEffect(() => {
    const level = volumeRef.current / 100;
    const players: Array<AudioPlayer | null> = [
      pickaxeRef.current,
      stoneRef.current,
      ...Object.values(pickaxeSoundsRef.current).map((p) => p ?? null),
    ];
    players.forEach((p) => {
      if (p != null) {
        p.volume = level;
      }
    });
    // The music bed rides its own INDEPENDENT musicVolume setting (the
    // pass-3 accessibility fix — it no longer scales with the SFX level,
    // so the music can be heard with quiet SFX and vice versa); the menu
    // mute toggle still pauses it outright.
    if (musicRef.current != null) {
      musicRef.current.volume = musicLevel(musicVolume);
    }
  }, [volume, musicVolume]);

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
