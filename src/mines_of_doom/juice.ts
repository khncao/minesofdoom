/**
 * Mining juice scaling (todo "scale juice based on mine amount"): the bigger
 * the amount mined, the more the feedback repeats — repeated pickaxe swings,
 * repeated debris bursts, and a larger floating "+N" text.
 *
 * The magnitude is log-scaled (one extra wave per decimal digit of the gain,
 * capped) so an early single-digit tap keeps one crisp swing, mid-game hits
 * land as a short flurry, and late-game taps / high-combo equation answers
 * hit the cap instead of stacking unbounded animations.
 *
 * Pure (no React/RN) — consumed by useMineTaps (canvas holds), the
 * MinesOfDoom answer reward (equation submits) and the FloatingTextLayer
 * size. The wave scheduling itself lives in hooks/useJuiceWaves.
 */

/** Maximum repeated swing/debris waves per mine. */
export const MAX_JUICE_WAVES = 5;

/**
 * Stagger between waves (ms). Must clear the internal throttles of the
 * effect targets — Miner's MIN_PICKAXE_INTERVAL (100ms) and
 * DebrisParticles' MIN_TRIGGER_INTERVAL (80ms) — or a wave is silently
 * dropped.
 */
export const JUICE_WAVE_INTERVAL_MS = 130;

/** Floating "+N" size (px) at each juice level, from 1 wave to the cap. */
export const MIN_TEXT_SIZE = 18;
export const MAX_TEXT_SIZE = 26;
const TEXT_SIZE_STEP = 2;

/**
 * How many juice waves a mined amount earns: one wave per decimal digit of
 * the gain, clamped to [1, MAX_JUICE_WAVES]. A non-positive gain still earns
 * one wave — a mine should always feel like a mine.
 */
export function getJuiceWaves(gain: bigint): number {
  if (gain <= 0n) {
    return 1;
  }
  // Decimal digit count == floor(log10(gain)) + 1 (bigint has no Math.log).
  return Math.min(gain.toString().length, MAX_JUICE_WAVES);
}

/**
 * Floating "+N" font size (px) for a mined amount: one step bigger per extra
 * wave, capped at MAX_TEXT_SIZE.
 */
export function getJuiceTextSize(gain: bigint): number {
  return Math.min(
    MAX_TEXT_SIZE,
    MIN_TEXT_SIZE + (getJuiceWaves(gain) - 1) * TEXT_SIZE_STEP,
  );
}
