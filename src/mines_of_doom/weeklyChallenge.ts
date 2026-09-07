/**
 * Weekly contract (todo: "weekly challenges", features.md §7 candidate): a
 * recurring "contract" on a longer cadence than the daily bonus, reusing the
 * goal-tier derived-metric machinery (goals.ts). Guardrails: a REAL weekly
 * window only (no fake scarcity — the button simply shows the goals and the
 * honest week boundary), and the reward is earnable free (a mineral grant).
 *
 * How progress works: the weekly goals are DELTAS on the save's monotonic
 * lifetime metrics (the same GoalMetric family the goal tiers use). When a
 * fresh week begins, the current metric values are snapshotted as
 * baselines; progress = current − baseline, so only this week's gains count
 * and the math stays derived (no mutable per-goal flags). Completion and
 * claimability are pure functions of (save, state, now) — the same
 * cheat-resistant derived-state pattern as goals.ts.
 *
 * Like the daily bonus, the state lives OUTSIDE the save object (its own
 * localStorage key): a lost or corrupted contract state must never take the
 * player's progress down with it, and importing a save code shouldn't reset
 * someone else's baselines — deltas simply clamp at zero against a lower
 * imported save.
 */
import { SaveData } from "./game";
import { getLocalDayKey } from "./dailyBonus";

/** The monotonic lifetime metrics the weekly contract measures deltas of.
 *  All of them only ever increase (or reset only via prestige, which also
 *  re-derives the baselines safely because a new week re-snapshots). */
export type WeeklyMetric =
  | "lifetimeMinerals"
  | "lifetimeCorrect"
  | "minersOwnedEver";

export type WeeklyGoal = {
  id: string;
  metric: WeeklyMetric;
  /** Delta target on the metric within the week. */
  target: number;
  label: string;
};

export type WeeklyChallengeState = {
  /** Local `yyyy-MM-dd` of the Monday opening the current week. */
  weekKey: string;
  /** Metric values snapshotted when this week began (the delta origins). */
  baselines: Record<WeeklyMetric, number>;
  /** Whether this week's bonus was already claimed (one claim per week). */
  claimed: boolean;
};

/** One-time mineral grant when all of the week's goals are met. Deliberately
 *  non-determining: below a week of passive income once miners run, above
 *  pure tap income early — same balance logic as the daily bonus. */
export const WEEKLY_BONUS = 150_000;

/**
 * The weekly contract (fixed set — rotating sets are future work). Targets
 * are tuned for the free-path benchmark persona (freePath.ts): a casual
 * player with a 2h evening session answers far more than 75 equations a
 * week, crosses 500k minerals within a few days of having miners, and owns
 * 2 miners as their natural spend sink — but an idle-only or new player
 * will NOT complete it, which is the point of a contract.
 */
export const WEEKLY_GOALS: WeeklyGoal[] = [
  {
    id: "wk-answers",
    metric: "lifetimeCorrect",
    target: 75,
    label: "Answer 75 equations correctly",
  },
  {
    id: "wk-minerals",
    metric: "lifetimeMinerals",
    target: 500_000,
    label: "Mine 500k minerals",
  },
  {
    id: "wk-miners",
    metric: "minersOwnedEver",
    target: 2,
    label: "Own 2 more miners",
  },
];

/** Exact metric value as a number (bigint metrics included — the game
 *  already treats these magnitudes as Number-safe everywhere it displays
 *  or fractions them, see goals.ts). */
export function getMetricValue(
  save: SaveData,
  metric: WeeklyMetric,
): number {
  return Number(save[metric]);
}

/** Local `yyyy-MM-dd` of the Monday opening the week that contains `now`.
 *  Computed from calendar fields (not −7d arithmetic), so it is DST-safe:
 *  the Monday itself is a midnight boundary in the player's own zone. */
export function getLocalWeekKey(now: number): string {
  const d = new Date(now);
  const daysFromMonday = (d.getDay() + 6) % 7; // getDay: Sun=0..Sat=6
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - daysFromMonday);
  return getLocalDayKey(monday.getTime());
}

/** The baselines a week beginning `now` starts from. */
export function snapshotBaselines(save: SaveData): Record<WeeklyMetric, number> {
  return {
    lifetimeMinerals: getMetricValue(save, "lifetimeMinerals"),
    lifetimeCorrect: getMetricValue(save, "lifetimeCorrect"),
    minersOwnedEver: getMetricValue(save, "minersOwnedEver"),
  };
}

/** The state for a week beginning `now`. */
export function startWeek(now: number, save: SaveData): WeeklyChallengeState {
  return {
    weekKey: getLocalWeekKey(now),
    baselines: snapshotBaselines(save),
    claimed: false,
  };
}

export type WeeklyGoalProgress = {
  goal: WeeklyGoal;
  /** This week's delta on the goal's metric (clamped at 0). */
  current: number;
  target: number;
  done: boolean;
};

export type WeeklyChallengeInfo = {
  /** True when `state` is null or belongs to an earlier week (the hook
   *  persists the fresh snapshot; callers can treat progress as 0-based). */
  rolled: boolean;
  weekKey: string;
  progress: WeeklyGoalProgress[];
  doneCount: number;
  allDone: boolean;
  /** allDone AND not yet claimed this week. */
  claimable: boolean;
  bonus: number;
};

/**
 * What the weekly contract looks like right now, without mutating anything:
 * per-goal deltas against the week's baselines, the done count, and whether
 * the one-per-week claim is available.
 */
export function computeWeeklyChallenge(
  save: SaveData,
  state: WeeklyChallengeState | null,
  now: number,
): WeeklyChallengeInfo {
  const weekKey = getLocalWeekKey(now);
  const rolled =
    state == null || state.weekKey !== weekKey;
  const baselines = rolled
    ? snapshotBaselines(save)
    : state.baselines;
  const progress: WeeklyGoalProgress[] = WEEKLY_GOALS.map((goal) => {
    const current = Math.max(
      0,
      getMetricValue(save, goal.metric) - baselines[goal.metric],
    );
    return { goal, current, target: goal.target, done: current >= goal.target };
  });
  const doneCount = progress.filter((p) => p.done).length;
  const allDone = doneCount === WEEKLY_GOALS.length;
  return {
    rolled,
    weekKey,
    progress,
    doneCount,
    allDone,
    claimable: allDone && !rolled && (state?.claimed ?? false) === false,
    bonus: WEEKLY_BONUS,
  };
}

/**
 * The persisted state after a claim. Defensive, like applyDailyClaim: when
 * the contract isn't actually done it returns the existing state untouched
 * (never double-pays, never fabricates a state from a null claim).
 */
export function applyWeeklyClaim(
  save: SaveData,
  state: WeeklyChallengeState | null,
  now: number,
): WeeklyChallengeState {
  const info = computeWeeklyChallenge(save, state, now);
  if (!info.allDone || state == null || state.weekKey !== info.weekKey) {
    return state ?? startWeek(now, save);
  }
  return { ...state, claimed: true };
}
