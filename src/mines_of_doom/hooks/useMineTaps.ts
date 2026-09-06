import {
  MutableRefObject,
  RefObject,
  useCallback,
  useRef,
} from "react";
import type { DebrisParticlesRef } from "src/components/DebrisParticles";
import type { BlockBreakRef } from "src/components/BlockBreak";
import type { SoundKey } from "./useSounds";
import { getJuiceWaves } from "../juice";
import { useJuiceWaves } from "./useJuiceWaves";

const TAP_FLUSH_INTERVAL = 50;

export function useMineTaps({
  clickPower,
  play,
  playerPickaxeAnimRef,
  debrisRef,
  blockBreakRef,
  addTapGain,
  onResetCombo,
  onGain,
  reduceMotion = false,
}: {
  clickPower: bigint;
  play: (key: SoundKey, minInterval?: number) => void;
  playerPickaxeAnimRef: MutableRefObject<() => void>;
  debrisRef: RefObject<DebrisParticlesRef | null>;
  blockBreakRef: RefObject<BlockBreakRef | null>;
  addTapGain: (gain: bigint) => void;
  onResetCombo: () => void;
  /** Optional per-tap feedback hook (e.g. floating "+N" text). */
  onGain?: (gain: bigint) => void;
  /** OS reduce-motion preference: decorative waves collapse to one. */
  reduceMotion?: boolean;
}) {
  // Rapid mine taps: accumulate gains in a ref and flush to state at a
  // fixed 20Hz rate, so fast tapping causes a handful of cheap re-renders
  // per second instead of one per tap (50ms display latency is imperceptible
  // for an idle-game counter).
  const pendingTapGainRef = useRef(0n);
  const tapFlushScheduledRef = useRef(false);
  const lastTapFlushRef = useRef(0);
  const clickPowerRef = useRef(clickPower);
  clickPowerRef.current = clickPower;
  const reduceMotionRef = useRef(reduceMotion);
  reduceMotionRef.current = reduceMotion;
  const { run: runJuiceWaves } = useJuiceWaves();

  const scheduleTapFlush = useCallback(() => {
    if (tapFlushScheduledRef.current) {
      return;
    }
    const flush = () => {
      const now = Date.now();
      if (now - lastTapFlushRef.current < TAP_FLUSH_INTERVAL) {
        // Too soon; keep waiting one more frame.
        requestAnimationFrame(flush);
        return;
      }
      tapFlushScheduledRef.current = false;
      lastTapFlushRef.current = now;
      const gain = pendingTapGainRef.current;
      pendingTapGainRef.current = 0n;
      addTapGain(gain);
    };
    tapFlushScheduledRef.current = true;
    requestAnimationFrame(flush);
  }, [addTapGain]);

  const mineTap = useCallback(() => {
    const gain = clickPowerRef.current;
    pendingTapGainRef.current += gain;
    scheduleTapFlush();
    play("pickaxe", 60);
    // The block breaks once per tap; the swing + debris repeat as many
    // waves as the mined amount earns (juice.ts) — capped, and collapsed
    // to a single wave under the OS reduce-motion preference, which
    // suppresses the decorative repeats but keeps the action's own hit.
    blockBreakRef.current?.trigger();
    runJuiceWaves(
      reduceMotionRef.current ? 1 : getJuiceWaves(gain),
      () => {
        playerPickaxeAnimRef.current();
        debrisRef.current?.trigger();
      },
    );
    onResetCombo();
    onGain?.(gain);
  }, [
    scheduleTapFlush,
    play,
    onResetCombo,
    playerPickaxeAnimRef,
    debrisRef,
    blockBreakRef,
    onGain,
    runJuiceWaves,
  ]);

  return { mineTap };
}
