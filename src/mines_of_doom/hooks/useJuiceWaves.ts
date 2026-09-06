import { useCallback, useEffect, useRef } from "react";
import { JUICE_WAVE_INTERVAL_MS } from "../juice";

type TimerId = ReturnType<typeof setTimeout>;

/**
 * Schedules runs of juice waves (see juice.ts): wave 0 runs immediately,
 * wave i at i * JUICE_WAVE_INTERVAL_MS, so each wave clears the internal
 * throttles of Miner / DebrisParticles. All pending wave timers are
 * cancelled on unmount so a torn-down screen never runs onWave against dead
 * refs. The caller's onWave side effects are the caller's to rate-limit —
 * this hook only owns the schedule.
 */
export function useJuiceWaves() {
  const timersRef = useRef<Set<TimerId>>(new Set());

  const cancel = useCallback(() => {
    for (const id of timersRef.current) {
      clearTimeout(id);
    }
    timersRef.current.clear();
  }, []);

  useEffect(() => cancel, [cancel]);

  const run = useCallback((waves: number, onWave: (index: number) => void) => {
    onWave(0);
    for (let i = 1; i < waves; i += 1) {
      const id = setTimeout(() => {
        timersRef.current.delete(id);
        onWave(i);
      }, JUICE_WAVE_INTERVAL_MS * i);
      timersRef.current.add(id);
    }
  }, []);

  return { run, cancel };
}
