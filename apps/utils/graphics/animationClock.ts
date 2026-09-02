/**
 * Shared animation clock (plan §4.5 "shared animation clock for miners").
 *
 * One module-level `Animated.Value` loops 0→1 once per second on the native
 * driver, started lazily on first use. Every miner's idle bob interpolates
 * this single value with its own deterministic phase offset, so the whole
 * roster sways from ONE frame driver instead of N independent animations —
 * and the phase offsets keep the row from moving in lockstep (which reads
 * as robotic at 50+ miners).
 *
 * On web the JS driver runs the same loop; the cost is one value update per
 * frame regardless of how many miners subscribe.
 */

import { Animated, Easing } from "react-native";
import { hashSeed } from "./pixelArt";

let clock: Animated.Value | null = null;
let clockAnim: Animated.CompositeAnimation | null = null;

/** The shared 0→1 loop (1s period, native driver). Starts it on first call. */
export function getSharedClock(): Animated.Value {
  if (clock == null) {
    const value = new Animated.Value(0);
    clock = value;
    clockAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(value, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        // Snap back to 0 so each loop iteration starts from the origin
        // (a plain loop would re-timing from 1 to 1 and never move again).
        Animated.timing(value, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    clockAnim.start();
  }
  return clock;
}

/**
 * Stops the loop and forgets the singleton. Production code never calls this
 * (the clock is meant to run for the app's lifetime) — tests use it so the
 * frame driver doesn't outlive the jest environment.
 */
export function stopSharedClock(): void {
  clockAnim?.stop();
  clockAnim = null;
  clock = null;
}

/**
 * Deterministic phase in [0, 1) derived from a miner seed. Same (seed, salt)
 * always gives the same phase, so a miner's bob offset is stable across
 * renders and mounts without storing per-component animation state.
 */
export function clockPhase(seed: number, salt: number): number {
  return (hashSeed(seed, salt) >>> 0) / 0x100000000;
}
