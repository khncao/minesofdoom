import {
  MutableRefObject,
  RefObject,
  useCallback,
  useRef,
} from "react";
import type { DebrisParticlesRef } from "apps/components/DebrisParticles";
import type { SoundKey } from "./useSounds";

const TAP_FLUSH_INTERVAL = 50;

export function useMineTaps({
  clickPower,
  play,
  playerPickaxeAnimRef,
  debrisRef,
  addTapGain,
  onResetCombo,
  onGain,
}: {
  clickPower: number;
  play: (key: SoundKey, minInterval?: number) => void;
  playerPickaxeAnimRef: MutableRefObject<() => void>;
  debrisRef: RefObject<DebrisParticlesRef>;
  addTapGain: (gain: number) => void;
  onResetCombo: () => void;
  /** Optional per-tap feedback hook (e.g. floating "+N" text). */
  onGain?: (gain: number) => void;
}) {
  // Rapid mine taps: accumulate gains in a ref and flush to state at a
  // fixed 20Hz rate, so fast tapping causes a handful of cheap re-renders
  // per second instead of one per tap (50ms display latency is imperceptible
  // for an idle-game counter).
  const pendingTapGainRef = useRef(0);
  const tapFlushScheduledRef = useRef(false);
  const lastTapFlushRef = useRef(0);
  const clickPowerRef = useRef(clickPower);
  clickPowerRef.current = clickPower;

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
      pendingTapGainRef.current = 0;
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
    playerPickaxeAnimRef.current();
    debrisRef.current?.trigger();
    onResetCombo();
    onGain?.(gain);
  }, [scheduleTapFlush, play, onResetCombo, playerPickaxeAnimRef, debrisRef, onGain]);

  return { mineTap };
}
