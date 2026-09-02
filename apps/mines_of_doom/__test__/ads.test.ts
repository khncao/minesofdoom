import {
  AD_GEM_ROLLS_PER_DAY,
  AD_GEM_ROLLS_PER_USE,
  AD_MAX_REWARDS_PER_DAY,
  AdKind,
  AdRewardsState,
  applyAdReward,
  computeAdEligibility,
  getAdRewardState,
} from "../ads";
import { getLocalDayKey } from "../dailyBonus";

/** Local noon on a calendar day — same convention as the daily-bonus
 *  tests: noon±24h stays on the expected day in the DST regimes we test. */
const day = (d: number) => new Date(2026, 5, d, 12, 0, 0).getTime();

const state = (dayKey: string, rollsUsed: number, rewardsToday: number): AdRewardsState => ({
  dayKey,
  rollsUsed,
  rewardsToday,
});

describe("getAdRewardState", () => {
  it("reads a null state as fresh counters", () => {
    expect(getAdRewardState(null, day(10))).toEqual({
      rollsUsed: 0,
      rewardsToday: 0,
    });
  });

  it("keeps counters on the same local day", () => {
    expect(getAdRewardState(state(getLocalDayKey(day(10)), 2, 4), day(10))).toEqual(
      { rollsUsed: 2, rewardsToday: 4 },
    );
  });

  it("resets counters at the local midnight", () => {
    expect(getAdRewardState(state(getLocalDayKey(day(10)), 2, 4), day(11))).toEqual(
      { rollsUsed: 0, rewardsToday: 0 },
    );
  });

  it("treats negative/junk counters as zero (corrupt stored state)", () => {
    expect(
      getAdRewardState(state(getLocalDayKey(day(10)), -1, -5), day(10)),
    ).toEqual({ rollsUsed: 0, rewardsToday: 0 });
  });
});

describe("computeAdEligibility", () => {
  it("grants AD_GEM_ROLLS_PER_USE gems for a fresh gem roll", () => {
    expect(computeAdEligibility(null, "gemRolls", day(10))).toEqual({
      eligible: true,
      gems: AD_GEM_ROLLS_PER_USE,
    });
  });

  it("lets offlineDouble through when the cap is free", () => {
    expect(computeAdEligibility(null, "offlineDouble", day(10))).toEqual({
      eligible: true,
      gems: 0,
    });
  });

  it("stops gem rolls at the per-day allowance", () => {
    const atCap = state(getLocalDayKey(day(10)), AD_GEM_ROLLS_PER_DAY, 0);
    expect(computeAdEligibility(atCap, "gemRolls", day(10)).eligible).toBe(false);
  });

  it("applies the total daily fraud cap to offlineDouble too", () => {
    const atCap = state(getLocalDayKey(day(10)), 0, AD_MAX_REWARDS_PER_DAY);
    expect(computeAdEligibility(atCap, "offlineDouble", day(10)).eligible).toBe(false);
    expect(computeAdEligibility(atCap, "gemRolls", day(10)).eligible).toBe(false);
  });

  it("lets offlineDouble past the gem-roll allowance (different meter)", () => {
    const rollsExhausted = state(
      getLocalDayKey(day(10)),
      AD_GEM_ROLLS_PER_DAY,
      AD_GEM_ROLLS_PER_DAY,
    );
    expect(
      computeAdEligibility(rollsExhausted, "offlineDouble", day(10)),
    ).toEqual({ eligible: true, gems: 0 });
  });

  it("lets offlineTopUp through and caps it like the other kinds", () => {
    expect(computeAdEligibility(null, "offlineTopUp", day(10))).toEqual({
      eligible: true,
      gems: 0,
    });
    const atCap = state(getLocalDayKey(day(10)), 0, AD_MAX_REWARDS_PER_DAY);
    expect(
      computeAdEligibility(atCap, "offlineTopUp", day(10)).eligible,
    ).toBe(false);
  });
});

describe("applyAdReward", () => {
  it("starts a fresh state on today's day key", () => {
    expect(applyAdReward(null, "gemRolls", day(10))).toEqual(
      state(getLocalDayKey(day(10)), 1, 1),
    );
  });

  it("counts each reward once and only the right kind toward rollsUsed", () => {
    let s: AdRewardsState | null = null;
    const kinds: AdKind[] = [
      "gemRolls",
      "offlineDouble",
      "offlineTopUp",
      "gemRolls",
    ];
    for (const kind of kinds) {
      s = applyAdReward(s, kind, day(10));
    }
    expect(s).toEqual(state(getLocalDayKey(day(10)), 2, 4));
  });

  it("rolls over from an earlier day instead of accumulating", () => {
    const yesterday = state(getLocalDayKey(day(10)), AD_GEM_ROLLS_PER_DAY, AD_MAX_REWARDS_PER_DAY);
    expect(applyAdReward(yesterday, "offlineDouble", day(11))).toEqual(
      state(getLocalDayKey(day(11)), 0, 1),
    );
  });
});
