/**
 * Daily bonus / login streak (plan §4.2, §5.3 retention): a small mineral
 * grant for coming back each local day, multiplied by the login streak so
 * there's a reason to keep the daily habit.
 *
 * Kept separate from the save object on purpose (like the equation
 * settings): a lost streak must never take the player's progress down with
 * it, and sharing a save code shouldn't leak the sender's streak.
 *
 * Balance: DAILY_BASE_BONUS × min(streak, DAILY_STREAK_CAP). 10k/day is a
 * gentle onboarding boost early (≈ 5s of early-game active play) and stays
 * non-determining late, where passive income dwarfs it — the retention
 * hook is the streak, not the minerals.
 *
 * Streak grace (features.md pass 17, finding 5): a single missed local day
 * no longer hard-resets the streak — the next claim within 2 days bridges
 * the gap and the streak continues, consuming one grace day. The grace is
 * automatic and free (no item, no action, no popup), at most one per
 * rolling STREAK_GRACE_WINDOW_DAYS, and only bridges a one-day gap (two
 * missed days, or a used-up window, still reset to 1). The habit
 * literature names the one-missed-day hard reset as the #1 streak
 * burnout trigger and the grace day as the standard fix — the counter
 * is real and the window is bounded, so there is no shield economy and
 * nothing to game (guardrails 1 and 3).
 */

/** Persisted daily-bonus state (AsyncStorage key "dailyBonus"). */
export type DailyBonusState = {
  /** Local `yyyy-MM-dd` day key the bonus was last claimed on. */
  lastClaimDay: string;
  /** Consecutive-day streak the player had when they last claimed. */
  streak: number;
  /** Local day key the streak grace was last consumed on (a grace-bridged
   *  claim). Absent until first use — old persisted state has no field. */
  lastGraceDay?: string;
};

/** Mineral grant on a 1-day streak. */
export const DAILY_BASE_BONUS = 10_000;
/** Streak days at which the bonus stops growing (70k is the max grant). */
export const DAILY_STREAK_CAP = 7;
/** Rolling window (local days) in which the streak grace may be used once. */
export const STREAK_GRACE_WINDOW_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Mineral grant for claiming on a streak of `streak` (capped at 7). */
export function getDailyBonus(streak: number): number {
  return DAILY_BASE_BONUS * Math.min(Math.max(1, Math.floor(streak)), DAILY_STREAK_CAP);
}

/** Local `yyyy-MM-dd` key for a timestamp. Local day: a "daily" login game
 *  should follow the player's own day boundary, not UTC's. */
export function getLocalDayKey(now: number): string {
  const d = new Date(now);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Was `lastDayKey` the local day right before the one `now` falls in?
 *  (now − 24h is DST-tolerant enough for day-boundary logic.) */
export function isYesterdayLocal(lastDayKey: string, now: number): boolean {
  return getLocalDayKey(now - 24 * 60 * 60 * 1000) === lastDayKey;
}

/** Was `lastDayKey` exactly two local days before the one `now` falls in?
 *  (i.e. one full local day was missed since the last claim). */
export function isTwoDaysAgoLocal(lastDayKey: string, now: number): boolean {
  return getLocalDayKey(now - 2 * DAY_MS) === lastDayKey;
}

/** Is the once-per-window streak grace currently available (not consumed
 *  within the rolling STREAK_GRACE_WINDOW_DAYS)? */
function graceAvailable(state: DailyBonusState, now: number): boolean {
  return (
    state.lastGraceDay == null ||
    state.lastGraceDay <=
      getLocalDayKey(now - STREAK_GRACE_WINDOW_DAYS * DAY_MS)
  );
}

/**
 * What a claim would do right now, without mutating anything:
 * `claimable` = there's a fresh day (or never claimed), `nextStreak` the
 * streak the claim would establish, `bonus` the minerals it would grant.
 */
export function computeDailyClaim(
  state: DailyBonusState | null,
  now: number,
): { claimable: boolean; nextStreak: number; bonus: number } {
  if (state == null) {
    return { claimable: true, nextStreak: 1, bonus: getDailyBonus(1) };
  }
  const today = getLocalDayKey(now);
  if (state.lastClaimDay === today) {
    return { claimable: false, nextStreak: state.streak, bonus: 0 };
  }
  // Consecutive day, or a one-day gap the grace bridges (streak continues;
  // the skipped day neither counts nor breaks the run). Anything further
  // apart — or a used-up grace window — resets to day 1 as before.
  const nextStreak =
    isYesterdayLocal(state.lastClaimDay, now) ||
    (isTwoDaysAgoLocal(state.lastClaimDay, now) && graceAvailable(state, now))
      ? state.streak + 1
      : 1;
  return { claimable: true, nextStreak, bonus: getDailyBonus(nextStreak) };
}

/** The persisted state after a claim (assumes claimable was checked). */
export function applyDailyClaim(
  state: DailyBonusState | null,
  now: number,
): DailyBonusState {
  const claim = computeDailyClaim(state, now);
  if (!claim.claimable) {
    // Defensive: return the existing state untouched rather than double-pay.
    return state ?? {
      lastClaimDay: getLocalDayKey(now),
      streak: 0,
    };
  }
  // The grace was consumed exactly when the streak continued across a gap
  // that was NOT the plain consecutive case (state.streak > 0 keeps the
  // defensive streak-0 fallback from being misread as a bridged claim).
  const graceUsed =
    state != null &&
    state.streak > 0 &&
    claim.nextStreak === state.streak + 1 &&
    !isYesterdayLocal(state.lastClaimDay, now);
  return {
    lastClaimDay: getLocalDayKey(now),
    streak: claim.nextStreak,
    ...(graceUsed
      ? { lastGraceDay: getLocalDayKey(now) }
      : { lastGraceDay: state?.lastGraceDay }),
  };
}
