/**
 * Haptic feedback patterns (todo: "Haptics + sound volume controls" — the
 * haptics half). Pure and framework-free: this module maps game events to
 * vibration patterns; the hook (hooks/useHaptics.ts) does the actual
 * Vibration call.
 *
 * Design:
 *  - "tap" is the per-mine tick, scaled with the same juice-wave count the
 *    debris/swing waves use (juice.ts), so a late-game tap feels heavier in
 *    the hand exactly when the floating "+N" gets bigger.
 *  - "success" (correct answer celebrations, achievements, purchases) is a
 *    short two-step tap; "error" (wrong answer) is a low double thud.
 *  - Patterns are arrays starting with 0 — the iOS vibration API requires
 *    a leading delay element; Android ignores it. A plain number is only
 *    used for the single-shot "tap" tick, which both platforms accept.
 */
import { getJuiceWaves, MAX_JUICE_WAVES } from "./juice";

export type HapticKind = "tap" | "success" | "error";

/** Extra milliseconds of tap duration per extra juice wave. */
const TAP_BASE_MS = 10;
const TAP_STEP_MS = 4;
const TAP_MAX_MS = 30;

/**
 * The "tap" tick duration for a mined amount (ms): the base tick plus one
 * step per extra juice wave the gain earns, capped. Non-positive gains get
 * the base tick — a mine should always feel like a mine (juice.ts rule).
 */
export function getTapHapticDuration(gain: bigint): number {
  return TAP_BASE_MS + (getJuiceWaves(gain) - 1) * TAP_STEP_MS;
}

/**
 * Pattern (delay/duration ms) for a haptic kind. The optional intensity
 * (1..MAX_JUICE_WAVES, clamped) only affects "tap"; "success"/"error" have
 * fixed patterns.
 */
export function getHapticPattern(
  kind: HapticKind,
  intensity: number = 1,
): number | number[] {
  if (kind === "tap") {
    // Non-finite intensities clamp to the base tick instead of producing
    // NaN patterns (Math.max with NaN poisons the whole expression).
    const waves = Number.isFinite(intensity)
      ? Math.min(MAX_JUICE_WAVES, Math.max(1, Math.floor(intensity)))
      : 1;
    return Math.min(TAP_MAX_MS, TAP_BASE_MS + (waves - 1) * TAP_STEP_MS);
  }
  if (kind === "success") {
    // Two crisp taps with a short rest between.
    return [0, 15, 60, 15, 40];
  }
  // "error": one longer thud, a rest, one short — the classic "wrong" beat.
  return [0, 40, 60, 80];
}
