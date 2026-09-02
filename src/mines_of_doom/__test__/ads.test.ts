import {
  AD_COMBO_SAVES_PER_DAY,
  AD_GEM_ROLLS_PER_DAY,
  AD_GEM_ROLLS_PER_USE,
  AD_MAX_REWARDS_PER_DAY,
  AdKind,
  AdRewardsState,
  applyAdReward,
  computeAdEligibility,
  devSimAdProvider,
  getAdRewardState,
  noopAdProvider,
  selectAdProvider,
} from "../ads";
import { getLocalDayKey } from "../dailyBonus";

/** Local noon on a calendar day — same convention as the daily-bonus
 *  tests: noon±24h stays on the expected day in the DST regimes we test. */
const day = (d: number) => new Date(2026, 5, d, 12, 0, 0).getTime();

const state = (
  dayKey: string,
  rollsUsed: number,
  rewardsToday: number,
  savesUsed = 0,
): AdRewardsState => ({
  dayKey,
  rollsUsed,
  rewardsToday,
  savesUsed,
});

describe("getAdRewardState", () => {
  it("reads a null state as fresh counters", () => {
    expect(getAdRewardState(null, day(10))).toEqual({
      rollsUsed: 0,
      rewardsToday: 0,
      savesUsed: 0,
    });
  });

  it("keeps counters on the same local day", () => {
    expect(
      getAdRewardState(state(getLocalDayKey(day(10)), 2, 4, 1), day(10)),
    ).toEqual({ rollsUsed: 2, rewardsToday: 4, savesUsed: 1 });
  });

  it("resets counters at the local midnight", () => {
    expect(
      getAdRewardState(state(getLocalDayKey(day(10)), 2, 4, 1), day(11)),
    ).toEqual({ rollsUsed: 0, rewardsToday: 0, savesUsed: 0 });
  });

  it("treats negative/junk counters as zero (corrupt stored state)", () => {
    expect(
      getAdRewardState(state(getLocalDayKey(day(10)), -1, -5, -3), day(10)),
    ).toEqual({ rollsUsed: 0, rewardsToday: 0, savesUsed: 0 });
  });

  it("reads pre-comboSave saved state (no savesUsed field) as 0", () => {
    const legacy: AdRewardsState = {
      dayKey: getLocalDayKey(day(10)),
      rollsUsed: 1,
      rewardsToday: 2,
    };
    expect(getAdRewardState(legacy, day(10))).toEqual({
      rollsUsed: 1,
      rewardsToday: 2,
      savesUsed: 0,
    });
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

  it("lets comboSave through and stops it at the per-day allowance", () => {
    expect(computeAdEligibility(null, "comboSave", day(10))).toEqual({
      eligible: true,
      gems: 0,
    });
    const atCap = state(
      getLocalDayKey(day(10)),
      0,
      0,
      AD_COMBO_SAVES_PER_DAY,
    );
    expect(computeAdEligibility(atCap, "comboSave", day(10)).eligible).toBe(
      false,
    );
  });

  it("applies the total daily fraud cap to comboSave too", () => {
    const atCap = state(getLocalDayKey(day(10)), 0, AD_MAX_REWARDS_PER_DAY);
    expect(
      computeAdEligibility(atCap, "comboSave", day(10)).eligible,
    ).toBe(false);
  });

  it("lets comboSave past the gem-roll allowance (different meter)", () => {
    const rollsExhausted = state(
      getLocalDayKey(day(10)),
      AD_GEM_ROLLS_PER_DAY,
      AD_GEM_ROLLS_PER_DAY,
    );
    expect(
      computeAdEligibility(rollsExhausted, "comboSave", day(10)),
    ).toEqual({ eligible: true, gems: 0 });
  });
});

describe("applyAdReward", () => {
  it("starts a fresh state on today's day key", () => {
    expect(applyAdReward(null, "gemRolls", day(10))).toEqual(
      state(getLocalDayKey(day(10)), 1, 1),
    );
  });

  it("counts each reward once and only the right kind toward its meter", () => {
    let s: AdRewardsState | null = null;
    const kinds: AdKind[] = [
      "gemRolls",
      "offlineDouble",
      "offlineTopUp",
      "comboSave",
      "gemRolls",
    ];
    for (const kind of kinds) {
      s = applyAdReward(s, kind, day(10));
    }
    expect(s).toEqual(state(getLocalDayKey(day(10)), 2, 5, 1));
  });

  it("rolls over from an earlier day instead of accumulating", () => {
    const yesterday = state(
      getLocalDayKey(day(10)),
      AD_GEM_ROLLS_PER_DAY,
      AD_MAX_REWARDS_PER_DAY,
      AD_COMBO_SAVES_PER_DAY,
    );
    expect(applyAdReward(yesterday, "offlineDouble", day(11))).toEqual(
      state(getLocalDayKey(day(11)), 0, 1),
    );
  });
});

describe("provider selection (the one-line swap point)", () => {
  it("production (dev: false) selects the no-op provider", () => {
    // Pins guardrail 5: no ad SDK is bundled today, so production selects
    // the no-op whose entry points stay hidden. When the real provider
    // lands, this test asserts the swap is deliberate.
    expect(selectAdProvider(false)).toBe(noopAdProvider);
  });

  it("dev builds select the labeled simulation", () => {
    expect(selectAdProvider(true)).toBe(devSimAdProvider);
  });
});
