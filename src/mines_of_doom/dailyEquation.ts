/**
 * Equation of the Day (docs/features.md §7 gap item, "daily rotating
 * challenge equations"): every local day has ONE fixed equation,
 * deterministic from the day key — the same equation for every player,
 * every device, forever (seeded FNV-1a + mulberry32 over the local day
 * key, see getSeededEquation in utils/math/equations.ts). Solving it pays
 * a one-time mineral bonus; wrong answers in its mode are penalty-free
 * (it's a bonus challenge, never a combo trap).
 *
 * Kept separate from the save on purpose (like the daily bonus in
 * dailyBonus.ts): completion is a small retention marker, and sharing a
 * save code shouldn't leak it. Balance: DAILY_EQUATION_BONUS is a flat,
 * non-determining grant (≈ half the capped daily bonus) — the hook is
 * the fresh equation, not the minerals, so it stays F2P-neutral and
 * non-determining by construction.
 */
import {
  Equation,
  EquationSettings,
  getSeededEquation,
} from "src/utils/math/equations";
import { getLocalDayKey } from "./dailyBonus";

/** Persisted equation-of-the-day state (AsyncStorage key "dailyEquation"). */
export type DailyEquationState = {
  /** Local `yyyy-MM-dd` day key the equation was last solved on. */
  solvedDay: string;
};

/** Flat mineral bonus for solving today's equation. */
export const DAILY_EQUATION_BONUS = 25_000;

/**
 * The fixed prefs that shape every day's equation: the classic four ops
 * plus percent and missing-number, operands in [2, 12), ALWAYS soft mode
 * (a 3-term equation has too many answers in play to read at a glance).
 * Deliberately independent of the player's own equation settings — the
 * day's equation must be identical for everyone, and must stay solvable
 * even with an all-disabled settings record.
 */
export const DAILY_EQUATION_PREFS: EquationSettings = {
  minNumber: 2,
  maxNumber: 12,
  multiply: true,
  add: true,
  subtract: true,
  division: true,
  percent: true,
  square: false,
  missing: true,
  hardMode: false,
  multiplySymbol: "asterisk",
};

/** The one equation for a local day key — deterministic, same everywhere. */
export function getDailyEquation(dayKey: string): Equation {
  return getSeededEquation(`minesofdoom:daily-equation:${dayKey}`, DAILY_EQUATION_PREFS);
}

/**
 * What the equation-of-the-day looks like right now: today's equation,
 * whether it's already been solved, and the bonus a solve would pay.
 * Pure — no storage, no Date.now() beyond the caller-supplied timestamp.
 */
export function computeDailyEquationStatus(
  state: DailyEquationState | null,
  now: number,
): {
  dayKey: string;
  equation: Equation;
  solved: boolean;
  bonus: number;
} {
  const dayKey = getLocalDayKey(now);
  return {
    dayKey,
    equation: getDailyEquation(dayKey),
    solved: state?.solvedDay === dayKey,
    bonus: DAILY_EQUATION_BONUS,
  };
}

/** The persisted state after a solve (assumes unsolved; idempotent). */
export function markDailyEquationSolved(
  state: DailyEquationState | null,
  now: number,
): DailyEquationState {
  return { solvedDay: getLocalDayKey(now) };
}
