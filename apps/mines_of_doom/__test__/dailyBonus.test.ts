import {
  DAILY_BASE_BONUS,
  DAILY_STREAK_CAP,
  DailyBonusState,
  applyDailyClaim,
  computeDailyClaim,
  getDailyBonus,
  getLocalDayKey,
  isYesterdayLocal,
} from "../dailyBonus";

/** Local noon on a calendar day — noon±24h stays on the expected calendar
 *  day in every DST regime we test against (June: no transitions in the
 *  US/EU; southern-hemisphere transitions are in spring/autumn). */
const day = (d: number) => new Date(2026, 5, d, 12, 0, 0).getTime();

describe("getDailyBonus", () => {
  it("is the base grant on day 1 and scales with the streak", () => {
    expect(getDailyBonus(1)).toBe(DAILY_BASE_BONUS);
    expect(getDailyBonus(3)).toBe(DAILY_BASE_BONUS * 3);
  });

  it("caps at DAILY_STREAK_CAP", () => {
    expect(getDailyBonus(DAILY_STREAK_CAP)).toBe(
      DAILY_BASE_BONUS * DAILY_STREAK_CAP,
    );
    expect(getDailyBonus(DAILY_STREAK_CAP + 10)).toBe(
      DAILY_BASE_BONUS * DAILY_STREAK_CAP,
    );
  });

  it("treats non-positive streaks as day 1", () => {
    expect(getDailyBonus(0)).toBe(DAILY_BASE_BONUS);
    expect(getDailyBonus(-5)).toBe(DAILY_BASE_BONUS);
  });
});

describe("day keys", () => {
  it("formats as local yyyy-MM-dd", () => {
    expect(getLocalDayKey(day(10))).toBe("2026-06-10");
  });

  it("detects the previous local day", () => {
    expect(isYesterdayLocal(getLocalDayKey(day(10)), day(11))).toBe(true);
    expect(isYesterdayLocal(getLocalDayKey(day(9)), day(11))).toBe(false);
    expect(isYesterdayLocal(getLocalDayKey(day(11)), day(11))).toBe(false);
  });
});

describe("computeDailyClaim", () => {
  it("is claimable on a fresh install (no state)", () => {
    const info = computeDailyClaim(null, day(10));
    expect(info).toEqual({
      claimable: true,
      nextStreak: 1,
      bonus: DAILY_BASE_BONUS,
    });
  });

  it("is not claimable twice on the same day", () => {
    const state: DailyBonusState = {
      lastClaimDay: getLocalDayKey(day(10)),
      streak: 3,
    };
    const info = computeDailyClaim(state, day(10));
    expect(info.claimable).toBe(false);
    expect(info.bonus).toBe(0);
  });

  it("extends the streak on the next day", () => {
    const state: DailyBonusState = {
      lastClaimDay: getLocalDayKey(day(10)),
      streak: 2,
    };
    expect(computeDailyClaim(state, day(11))).toEqual({
      claimable: true,
      nextStreak: 3,
      bonus: DAILY_BASE_BONUS * 3,
    });
  });

  it("resets the streak after a missed day", () => {
    const state: DailyBonusState = {
      lastClaimDay: getLocalDayKey(day(10)),
      streak: 5,
    };
    expect(computeDailyClaim(state, day(12))).toEqual({
      claimable: true,
      nextStreak: 1,
      bonus: DAILY_BASE_BONUS,
    });
  });

  it("caps the bonus at the streak cap", () => {
    const state: DailyBonusState = {
      lastClaimDay: getLocalDayKey(day(10)),
      streak: DAILY_STREAK_CAP,
    };
    const info = computeDailyClaim(state, day(11));
    expect(info.nextStreak).toBe(DAILY_STREAK_CAP + 1);
    expect(info.bonus).toBe(DAILY_BASE_BONUS * DAILY_STREAK_CAP);
  });
});

describe("applyDailyClaim", () => {
  it("records today and the new streak", () => {
    const state: DailyBonusState = {
      lastClaimDay: getLocalDayKey(day(10)),
      streak: 2,
    };
    expect(applyDailyClaim(state, day(11))).toEqual({
      lastClaimDay: getLocalDayKey(day(11)),
      streak: 3,
    });
  });

  it("starts streak 1 from no state", () => {
    expect(applyDailyClaim(null, day(10))).toEqual({
      lastClaimDay: getLocalDayKey(day(10)),
      streak: 1,
    });
  });

  it("is a no-op when already claimed today (can't double-pay)", () => {
    const state: DailyBonusState = {
      lastClaimDay: getLocalDayKey(day(10)),
      streak: 4,
    };
    expect(applyDailyClaim(state, day(10) + 60000)).toBe(state);
  });
});
