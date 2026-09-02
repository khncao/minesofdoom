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
 */

/** Persisted daily-bonus state (AsyncStorage key "dailyBonus"). */
export type DailyBonusState = {
  /** Local `yyyy-MM-dd` day key the bonus was last claimed on. */
  lastClaimDay: string;
  /** Consecutive-day streak the player had when they last claimed. */
  streak: number;
};

/** Mineral grant on a 1-day streak. */
export const DAILY_BASE_BONUS = 10_000;
/** Streak days at which the bonus stops growing (70k is the max grant). */
export const DAILY_STREAK_CAP = 7;

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
  const nextStreak = isYesterdayLocal(state.lastClaimDay, now)
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
  return {
    lastClaimDay: getLocalDayKey(now),
    streak: claim.nextStreak,
  };
}
