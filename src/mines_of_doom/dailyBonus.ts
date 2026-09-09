/**
 * Daily bonus / login streak (plan §4.2, §5.3 retention): a small mineral
 * grant for coming back each local day, multiplied by the login streak so
 * there's a reason to keep the daily habit.
 *
 * Kept separate from the save object on purpose (like the equation
 * settings): a lost streak must never take the player's progress down with
 * it, and sharing a save code shouldn't leak the sender's streak.
 *
 * Balance: DAILY_BASE_BONUS × streak through day 6, then a flat
 * DAILY_MILESTONE_BONUS from day 7 on — the day-7 milestone (features.md
 * §7 "Day-7 reward spike") is worth MORE than days 1–6 combined (210k <
 * 250k), the retention research's "cost to skip" anchor that a flat/linear
 * ladder lacks. 10k/day is a gentle onboarding boost early (≈ 5s of
 * early-game active play) and the milestone stays non-determining late,
 * where passive income dwarfs it — the retention hook is the streak, not
 * the minerals.
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
 *
 * Streak protection (features.md §7 "Streak protection", pass 4): the
 * grace is one of three safety nets now. When a one-day gap arrives and
 * the grace is spent, a streak FREEZE bridges it instead — a stock of up
 * to STREAK_FREEZE_CAP, earned passively (one per STREAK_FREEZE_EVERY_DAYS
 * streak day, i.e. on day 7, 14, 21… claims), consumed silently and
 * surfaced retroactively in the claim toast (no popup drama). If both are
 * spent the streak resets as before, but a reset that lost
 * STREAK_REPAIR_MIN_DAYS+ records a snapshot and the NEXT local day's claim
 * (the 24h window) can REPAIR the streak back to lost+1, at most once per
 * rolling STREAK_REPAIR_COOLDOWN_DAYS. All three counters are real,
 * bounded, and free (guardrails 1 and 3): freezes are earned, not bought;
 * the repair window is one local day, never extended.
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
  /** Streak-freeze stock (0..STREAK_FREEZE_CAP). Absent/0 until the first
   *  freeze is earned — old persisted state has no field. */
  freezes?: number;
  /** The streak a reset claim LOST (>= STREAK_REPAIR_MIN_DAYS), so the next
   *  local day's claim can repair to lost+1. Absent = nothing pending. */
  repairStreak?: number;
  /** Local day key the reset claim landed on — the repair window anchor
   *  (repair only on the very next local day). Absent = nothing pending. */
  repairDay?: string;
  /** Local day key the repair was last applied on (rolling cooldown).
   *  Absent until first use. */
  lastRepairDay?: string;
};

/** Why a claim continued or restored the streak instead of the plain
 *  ladder: which safety net engaged (surfaced retroactively in the claim
 *  toast). Absent on a clean consecutive claim. */
export type DailyClaimBridge = "grace" | "freeze" | "repair";

/** What a claim would do right now (see computeDailyClaim). */
export type DailyClaimInfo = {
  claimable: boolean;
  nextStreak: number;
  bonus: number;
  /** The safety net this claim engages (grace > freeze > repair), or
   *  absent for a clean consecutive day / first claim / hard reset. */
  bridge?: DailyClaimBridge;
  /** A streak freeze is earned on this claim (milestone day, stock below
   *  the cap) — surfaced through the freeze counter, not a popup. */
  earnedFreeze?: boolean;
};

/** Mineral grant on a 1-day streak. */
export const DAILY_BASE_BONUS = 10_000;
/** Streak day at which the day-7 milestone kicks in (days 1–6 pay the
 *  linear ladder). */
export const DAILY_STREAK_CAP = 7;
/** The day-7 milestone grant, paid on streaks 7 and up. Pinned by test to
 *  be worth more than days 1–6 combined (10k+20k+…+60k = 210k < 250k) —
 *  losing a streak now costs 250k/day, not a 70k rung. */
export const DAILY_MILESTONE_BONUS = 250_000;
/** Rolling window (local days) in which the streak grace may be used once. */
export const STREAK_GRACE_WINDOW_DAYS = 30;
/** Streak-freeze stock cap — like the rewarded-ad caps, a small real
 *  counter, not a currency. */
export const STREAK_FREEZE_CAP = 3;
/** A freeze is earned passively on every claim that establishes a
 *  streak day at this multiple (day 7, 14, 21…): keeping the habit IS
 *  the earning, so it's free by construction (guardrail 1). */
export const STREAK_FREEZE_EVERY_DAYS = 7;
/** A reset only records a repair snapshot when it lost at least this many
 *  streak days — repairing a day-1/2 "streak" is not worth the state. */
export const STREAK_REPAIR_MIN_DAYS = 3;
/** Rolling window (local days) in which a streak repair may be used once. */
export const STREAK_REPAIR_COOLDOWN_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Mineral grant for claiming on a streak of `streak`: the linear ladder
 *  up to day 6, then the flat day-7 milestone for 7+ (it never grows past
 *  the milestone). */
export function getDailyBonus(streak: number): number {
  const days = Math.max(1, Math.floor(streak));
  return days >= DAILY_STREAK_CAP
    ? DAILY_MILESTONE_BONUS
    : DAILY_BASE_BONUS * days;
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
 *  (i.e. one full local day was missed since the last claim.) */
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

/** Is the once-per-window streak repair currently available (not applied
 *  within the rolling STREAK_REPAIR_COOLDOWN_DAYS)? */
function repairAvailable(state: DailyBonusState, now: number): boolean {
  return (
    state.lastRepairDay == null ||
    state.lastRepairDay <=
      getLocalDayKey(now - STREAK_REPAIR_COOLDOWN_DAYS * DAY_MS)
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
): DailyClaimInfo {
  if (state == null) {
    return { claimable: true, nextStreak: 1, bonus: getDailyBonus(1) };
  }
  const today = getLocalDayKey(now);
  if (state.lastClaimDay === today) {
    return { claimable: false, nextStreak: state.streak, bonus: 0 };
  }
  const freezes = state.freezes ?? 0;
  // The repair backstop checks first: the previous claim was a reset that
  // recorded the lost streak, and this claim is the very next local day
  // (the 24h window). repairDay === lastClaimDay by construction (both
  // move only on claims), so "yesterday" here is a consecutive claim.
  const repairReady =
    state.repairStreak != null &&
    state.repairDay != null &&
    isYesterdayLocal(state.repairDay, now) &&
    repairAvailable(state, now);
  const consecutive = isYesterdayLocal(state.lastClaimDay, now);
  const oneDayGap = isTwoDaysAgoLocal(state.lastClaimDay, now);
  let nextStreak: number;
  let bridge: DailyClaimBridge | undefined;
  if (repairReady) {
    nextStreak = (state.repairStreak as number) + 1;
    bridge = "repair";
  } else if (consecutive) {
    nextStreak = state.streak + 1;
  } else if (oneDayGap && graceAvailable(state, now)) {
    // Grace first (the automatic one), then the earned freeze stock.
    nextStreak = state.streak + 1;
    bridge = "grace";
  } else if (oneDayGap && freezes > 0) {
    nextStreak = state.streak + 1;
    bridge = "freeze";
  } else {
    // Two missed days, or every safety net spent: reset to day 1. A reset
    // that loses enough also snapshots for a possible repair (applyDaily-
    // Claim records it).
    nextStreak = 1;
  }
  const bonus = getDailyBonus(nextStreak);
  // A freeze is earned on milestone streak days, as long as the stock (after
  // consuming one for this same bridged claim, if it does) is below the cap.
  const freezesAfterClaim = freezes - (bridge === "freeze" ? 1 : 0);
  const earnedFreeze =
    nextStreak % STREAK_FREEZE_EVERY_DAYS === 0 &&
    freezesAfterClaim < STREAK_FREEZE_CAP;
  return {
    claimable: true,
    nextStreak,
    bonus,
    ...(bridge !== undefined ? { bridge } : {}),
    ...(earnedFreeze ? { earnedFreeze: true } : {}),
  };
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
  const today = getLocalDayKey(now);
  let freezes = state?.freezes ?? 0;
  if (claim.bridge === "freeze") freezes -= 1;
  if (claim.earnedFreeze) freezes += 1;
  let repairStreak = state?.repairStreak;
  let repairDay = state?.repairDay;
  let lastRepairDay = state?.lastRepairDay;
  // A repair snapshot is only valid for the very next local day after the
  // reset claim — anything older has expired (the 24h window passed).
  if (repairDay != null && !isYesterdayLocal(repairDay, now)) {
    repairStreak = undefined;
    repairDay = undefined;
  }
  if (claim.bridge === "repair") {
    // The streak was restored: the snapshot is spent, the cooldown starts.
    repairStreak = undefined;
    repairDay = undefined;
    lastRepairDay = today;
  }
  // A hard reset that lost a meaningful streak snapshots it for the next
  // day's repair attempt (nextStreak === 1 here means no bridge engaged).
  if (
    state != null &&
    state.streak >= STREAK_REPAIR_MIN_DAYS &&
    claim.nextStreak === 1
  ) {
    repairStreak = state.streak;
    repairDay = today;
  }
  return {
    lastClaimDay: today,
    streak: claim.nextStreak,
    ...(claim.bridge === "grace"
      ? { lastGraceDay: today }
      : { lastGraceDay: state?.lastGraceDay }),
    ...(freezes > 0 ? { freezes } : {}),
    ...(repairStreak != null ? { repairStreak } : {}),
    ...(repairDay != null ? { repairDay } : {}),
    ...(lastRepairDay != null ? { lastRepairDay } : {}),
  };
}
