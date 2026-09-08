import {
  DAILY_BASE_BONUS,
  DAILY_STREAK_CAP,
  STREAK_GRACE_WINDOW_DAYS,
  DailyBonusState,
  applyDailyClaim,
  computeDailyClaim,
  getDailyBonus,
  getLocalDayKey,
  isTwoDaysAgoLocal,
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

describe("day keys", () => {
  it("detects exactly two local days back (one missed day)", () => {
    expect(isTwoDaysAgoLocal(getLocalDayKey(day(10)), day(12))).toBe(true);
    expect(isTwoDaysAgoLocal(getLocalDayKey(day(11)), day(12))).toBe(false);
    expect(isTwoDaysAgoLocal(getLocalDayKey(day(9)), day(12))).toBe(false);
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

  it("resets the streak after a multi-day absence (no single gap to bridge)", () => {
    const state: DailyBonusState = {
      lastClaimDay: getLocalDayKey(day(10)),
      streak: 5,
    };
    expect(computeDailyClaim(state, day(13))).toEqual({
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

describe("streak grace (pass 17, offline:streak-grace)", () => {
  const claimed = (d: number, streak: number, lastGraceDay?: string): DailyBonusState =>
    ({
      lastClaimDay: getLocalDayKey(day(d)),
      streak,
      ...(lastGraceDay != null ? { lastGraceDay } : {}),
    } as DailyBonusState);

  it("bridges a single missed day: the streak continues, not the bonus", () => {
    // Missed day 11, claims on day 12: streak 5 → 6, bonus at 6, not 1.
    expect(computeDailyClaim(claimed(10, 5), day(12))).toEqual({
      claimable: true,
      nextStreak: 6,
      bonus: DAILY_BASE_BONUS * 6,
    });
  });

  it("still resets after two or more missed days even with grace available", () => {
    expect(computeDailyClaim(claimed(10, 5), day(13))).toEqual({
      claimable: true,
      nextStreak: 1,
      bonus: DAILY_BASE_BONUS,
    });
  });

  it("consumes the grace: a second gap within the window resets", () => {
    expect(computeDailyClaim(claimed(10, 5, getLocalDayKey(day(10))), day(12))).toEqual({
      claimable: true,
      nextStreak: 1,
      bonus: DAILY_BASE_BONUS,
    });
  });

  it("allows one grace per rolling 30-day window", () => {
    // Grace used 31 local days before day 12 → available again.
    const d30Before = day(12) - (STREAK_GRACE_WINDOW_DAYS + 1) * 86400000;
    expect(
      computeDailyClaim(claimed(10, 5, getLocalDayKey(d30Before)), day(12)),
    ).toEqual({ claimable: true, nextStreak: 6, bonus: DAILY_BASE_BONUS * 6 });
    // Grace used 29 local days before day 12 → still inside the window.
    const d29Before = day(12) - (STREAK_GRACE_WINDOW_DAYS - 1) * 86400000;
    expect(
      computeDailyClaim(claimed(10, 5, getLocalDayKey(d29Before)), day(12)),
    ).toEqual({ claimable: true, nextStreak: 1, bonus: DAILY_BASE_BONUS });
  });

  it("records lastGraceDay only on a bridged claim", () => {
    expect(applyDailyClaim(claimed(10, 5), day(12))).toEqual({
      lastClaimDay: getLocalDayKey(day(12)),
      streak: 6,
      lastGraceDay: getLocalDayKey(day(12)),
    });
    // Consecutive claims carry lastGraceDay through untouched.
    expect(applyDailyClaim(claimed(10, 5, getLocalDayKey(day(1))), day(11))).toEqual({
      lastClaimDay: getLocalDayKey(day(11)),
      streak: 6,
      lastGraceDay: getLocalDayKey(day(1)),
    });
    // A failed bridge (grace already used) leaves lastGraceDay untouched too.
    expect(
      applyDailyClaim(claimed(10, 5, getLocalDayKey(day(1))), day(12)),
    ).toEqual({
      lastClaimDay: getLocalDayKey(day(12)),
      streak: 1,
      lastGraceDay: getLocalDayKey(day(1)),
    });
  });

  it("works for old state without a lastGraceDay field (no migration needed)", () => {
    const legacy: DailyBonusState = { lastClaimDay: getLocalDayKey(day(10)), streak: 3 };
    expect(computeDailyClaim(legacy, day(12)).nextStreak).toBe(4);
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
    // The defensive fallback state has no grace field either.
    expect((applyDailyClaim(null, day(10)) as DailyBonusState).lastGraceDay).toBeUndefined();
  });

  it("is a no-op when already claimed today (can't double-pay)", () => {
    const state: DailyBonusState = {
      lastClaimDay: getLocalDayKey(day(10)),
      streak: 4,
    };
    expect(applyDailyClaim(state, day(10) + 60000)).toBe(state);
  });
});
