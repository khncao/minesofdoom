import { createEmptySaveData, SaveData } from "../game";
import {
  WEEKLY_BONUS,
  WEEKLY_GOALS,
  WeeklyChallengeState,
  WeeklyMetric,
  applyWeeklyClaim,
  computeWeeklyChallenge,
  getLocalWeekKey,
  getMetricValue,
  snapshotBaselines,
  startWeek,
} from "../weeklyChallenge";

/** 2026-06-15 (Monday) noon local — inside one DST-safe stretch (June),
 *  mirroring the dailyBonus test's time choice. */
const MON = new Date(2026, 5, 15, 12, 0, 0).getTime();
const TUE = MON + 24 * 3600 * 1000;
/** The week's last second: Sunday 2026-06-21 23:59:59 local. */
const LAST_SECOND = new Date(2026, 5, 21, 23, 59, 59).getTime();
/** The following Monday, mid-week time. */
const NEXT_MON = new Date(2026, 5, 22, 12, 0, 0).getTime();

const baseSave = () => createEmptySaveData();

const saveWith = (fields: Partial<SaveData>): SaveData => ({
  ...baseSave(),
  ...fields,
});

/** A save at the start of the week: the baselines' origin. */
const weekStartSave = () =>
  saveWith({
    lifetimeMinerals: 1_000_000n,
    lifetimeCorrect: 500,
    minersOwnedEver: 4,
  });

/** The state that week started with. */
const weekState = (overrides?: Partial<WeeklyChallengeState>): WeeklyChallengeState => ({
  weekKey: getLocalWeekKey(MON),
  baselines: {
    lifetimeMinerals: 1_000_000,
    lifetimeCorrect: 500,
    minersOwnedEver: 4,
  },
  claimed: false,
  ...overrides,
});

/** The save that would complete every weekly goal this week. */
const allDoneSave = () =>
  saveWith({
    lifetimeMinerals: 1_000_000n + 500_000n,
    lifetimeCorrect: 500 + 75,
    minersOwnedEver: 4 + 2,
  });

describe("getLocalWeekKey", () => {
  test("is the local Monday's yyyy-MM-dd", () => {
    // 2026-06-15 is a Monday.
    expect(getLocalWeekKey(MON)).toBe("2026-06-15");
  });

  test("is stable across the whole week", () => {
    const keys = [MON, TUE, MON + 3 * 86400000, LAST_SECOND].map(
      getLocalWeekKey,
    );
    expect(new Set(keys).size).toBe(1);
  });

  test("rolls over at the Monday midnight boundary", () => {
    expect(getLocalWeekKey(LAST_SECOND)).toBe("2026-06-15");
    expect(getLocalWeekKey(new Date(2026, 5, 22, 0, 0, 1).getTime())).toBe(
      "2026-06-22",
    );
    expect(getLocalWeekKey(NEXT_MON)).toBe("2026-06-22");
  });

  test("handles Sunday (the getDay()==0 edge)", () => {
    // Sunday 2026-06-21 still belongs to the week opened Monday 06-15;
    // Sunday 2026-06-28 opens the new one.
    expect(getLocalWeekKey(new Date(2026, 5, 21, 12).getTime())).toBe(
      "2026-06-15",
    );
    expect(getLocalWeekKey(new Date(2026, 5, 28, 12).getTime())).toBe(
      "2026-06-22",
    );
  });
});

describe("baselines", () => {
  test("snapshot the save's metric values exactly", () => {
    expect(snapshotBaselines(weekStartSave())).toEqual({
      lifetimeMinerals: 1_000_000,
      lifetimeCorrect: 500,
      minersOwnedEver: 4,
    });
  });

  test("getMetricValue coerces the bigint metrics to Number", () => {
    const save = saveWith({ lifetimeMinerals: 123n });
    expect(getMetricValue(save, "lifetimeMinerals")).toBe(123);
    expect(getMetricValue(save, "lifetimeCorrect")).toBe(0);
  });

  test("startWeek pairs the week key with the snapshot", () => {
    expect(startWeek(TUE, weekStartSave())).toEqual({
      weekKey: getLocalWeekKey(TUE),
      baselines: snapshotBaselines(weekStartSave()),
      claimed: false,
    });
  });
});

describe("computeWeeklyChallenge", () => {
  test("a fresh install rolls and starts from zero progress", () => {
    const info = computeWeeklyChallenge(weekStartSave(), null, TUE);
    expect(info.rolled).toBe(true);
    expect(info.doneCount).toBe(0);
    expect(info.claimable).toBe(false);
    expect(info.bonus).toBe(WEEKLY_BONUS);
  });

  test("an old week's state rolls into a fresh one", () => {
    const stale = weekState({ weekKey: "2026-06-08" });
    const info = computeWeeklyChallenge(weekStartSave(), stale, TUE);
    expect(info.rolled).toBe(true);
    expect(info.claimable).toBe(false);
  });

  test("progress counts only this week's deltas", () => {
    const save = saveWith({
      lifetimeMinerals: 1_100_000n,
      lifetimeCorrect: 530,
      minersOwnedEver: 5,
    });
    const info = computeWeeklyChallenge(save, weekState(), TUE);
    expect(info.rolled).toBe(false);
    const byId = Object.fromEntries(
      info.progress.map((p) => [p.goal.id, p]),
    );
    expect(byId["wk-minerals"].current).toBe(100_000);
    expect(byId["wk-minerals"].done).toBe(false);
    expect(byId["wk-answers"].current).toBe(30);
    expect(byId["wk-miners"].current).toBe(1);
    expect(info.doneCount).toBe(0);
  });

  test("a goal is done at exactly its target", () => {
    const save = saveWith({
      lifetimeMinerals: 1_500_000n, // exactly +500k
      lifetimeCorrect: 575,
      minersOwnedEver: 6,
    });
    const info = computeWeeklyChallenge(save, weekState(), TUE);
    expect(info.allDone).toBe(true);
    expect(info.doneCount).toBe(WEEKLY_GOALS.length);
    expect(info.claimable).toBe(true);
  });

  test("the claim is blocked once the week is claimed, not before", () => {
    expect(
      computeWeeklyChallenge(allDoneSave(), weekState({ claimed: true }), TUE)
        .claimable,
    ).toBe(false);
    // Only two of three goals met: allDone and claimable are both false.
    const partial = saveWith({
      lifetimeMinerals: 1_500_000n,
      lifetimeCorrect: 575,
      minersOwnedEver: 4, // no new miners
    });
    const info = computeWeeklyChallenge(partial, weekState(), TUE);
    expect(info.allDone).toBe(false);
    expect(info.claimable).toBe(false);
    expect(info.doneCount).toBe(2);
  });

  test("a lower imported save clamps deltas at zero, not negative", () => {
    const wiped = saveWith({
      lifetimeMinerals: 0n,
      lifetimeCorrect: 0,
      minersOwnedEver: 0,
    });
    const info = computeWeeklyChallenge(wiped, weekState(), TUE);
    expect(info.progress.every((p) => p.current === 0)).toBe(true);
    expect(info.claimable).toBe(false);
  });

  test("the claim survives a relaunch mid-week and resets on the new week", () => {
    // Same week key as the state (Sunday, the week's last second):
    // still claim-eligible.
    expect(
      computeWeeklyChallenge(allDoneSave(), weekState(), LAST_SECOND)
        .claimable,
    ).toBe(true);
    // A state from the CURRENT week (computed at NEXT_MON) with the same
    // baselines the player had: progress recomputes from the new week's
    // snapshot — the old `claimed: true` never carries over because the
    // state's weekKey no longer matches.
    const oldClaimed = weekState({ weekKey: getLocalWeekKey(MON), claimed: true });
    expect(
      computeWeeklyChallenge(allDoneSave(), oldClaimed, NEXT_MON).rolled,
    ).toBe(true);
  });
});

describe("applyWeeklyClaim", () => {
  test("records the claim when the contract is done", () => {
    const next = applyWeeklyClaim(allDoneSave(), weekState(), TUE);
    expect(next).toEqual(weekState({ claimed: true }));
  });

  test("is a no-op (returns the state untouched) when not done", () => {
    const state = weekState();
    expect(applyWeeklyClaim(weekStartSave(), state, TUE)).toBe(state);
  });

  test("is a no-op from null state (never fabricates a grant)", () => {
    const save = allDoneSave();
    // null state means the week just rolled: the computed progress is
    // zero-based, so the claim is refused.
    const next = applyWeeklyClaim(save, null, TUE);
    expect(next).toEqual(startWeek(TUE, save));
    expect(next.claimed).toBe(false);
  });
});

describe("goal set shape", () => {
  test("goals are unique, positive, and use monotonic metrics only", () => {
    expect(new Set(WEEKLY_GOALS.map((g) => g.id)).size).toBe(
      WEEKLY_GOALS.length,
    );
    for (const goal of WEEKLY_GOALS) {
      expect(goal.target).toBeGreaterThan(0);
      expect(
        ["lifetimeMinerals", "lifetimeCorrect", "minersOwnedEver"],
      ).toContain(goal.metric as WeeklyMetric);
    }
  });

  test("the bonus is a positive, Number-safe integer", () => {
    expect(Number.isSafeInteger(WEEKLY_BONUS)).toBe(true);
    expect(WEEKLY_BONUS).toBeGreaterThan(0);
  });
});
