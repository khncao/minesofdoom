import {
  DAILY_BASE_BONUS,
  DAILY_STREAK_CAP,
  DAILY_MILESTONE_BONUS,
  STREAK_GRACE_WINDOW_DAYS,
  STREAK_FREEZE_CAP,
  STREAK_REPAIR_COOLDOWN_DAYS,
  STREAK_REPAIR_MIN_DAYS,
  DailyBonusState,
  applyDailyClaim,
  computeDailyClaim,
  getDailyBonus,
  getLocalDayKey,
  isTwoDaysAgoLocal,
  isYesterdayLocal,
} from "../dailyBonus";

/** Claim-state builder for the protection tests: day d, streak s, plus
 *  arbitrary protection fields (freezes, repair snapshot, cooldowns). */
const stateAt = (
  d: number,
  streak: number,
  extra: Partial<Omit<DailyBonusState, "lastClaimDay" | "streak">> = {},
): DailyBonusState => ({
  lastClaimDay: getLocalDayKey(day(d)),
  streak,
  ...extra,
});

/** Local noon on a calendar day — noon±24h stays on the expected calendar
 *  day in every DST regime we test against (June: no transitions in the
 *  US/EU; southern-hemisphere transitions are in spring/autumn). */
const day = (d: number) => new Date(2026, 5, d, 12, 0, 0).getTime();

describe("getDailyBonus", () => {
  it("is the base grant on day 1 and scales with the streak", () => {
    expect(getDailyBonus(1)).toBe(DAILY_BASE_BONUS);
    expect(getDailyBonus(3)).toBe(DAILY_BASE_BONUS * 3);
  });

  it("pays the day-7 milestone at and beyond DAILY_STREAK_CAP", () => {
    // The linear ladder stops at day 6…
    expect(getDailyBonus(DAILY_STREAK_CAP - 1)).toBe(
      DAILY_BASE_BONUS * (DAILY_STREAK_CAP - 1),
    );
    // …and days 7+ all pay the flat milestone.
    expect(getDailyBonus(DAILY_STREAK_CAP)).toBe(DAILY_MILESTONE_BONUS);
    expect(getDailyBonus(DAILY_STREAK_CAP + 10)).toBe(DAILY_MILESTONE_BONUS);
  });

  it("day-7 milestone is worth more than days 1–6 combined (§7 spike invariant)", () => {
    const firstSix = [1, 2, 3, 4, 5, 6].reduce((s, d) => s + getDailyBonus(d), 0);
    expect(firstSix).toBe(DAILY_BASE_BONUS * 21);
    expect(DAILY_MILESTONE_BONUS).toBeGreaterThan(firstSix);
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

  it("keeps paying the milestone past the streak cap", () => {
    const state: DailyBonusState = {
      lastClaimDay: getLocalDayKey(day(10)),
      streak: DAILY_STREAK_CAP,
    };
    const info = computeDailyClaim(state, day(11));
    expect(info.nextStreak).toBe(DAILY_STREAK_CAP + 1);
    expect(info.bonus).toBe(DAILY_MILESTONE_BONUS);
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
    // The bridge is surfaced (retroactively in the claim toast), not hidden.
    expect(computeDailyClaim(claimed(10, 5), day(12))).toEqual({
      claimable: true,
      nextStreak: 6,
      bonus: DAILY_BASE_BONUS * 6,
      bridge: "grace",
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
    ).toEqual({
      claimable: true,
      nextStreak: 6,
      bonus: DAILY_BASE_BONUS * 6,
      bridge: "grace",
    });
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
    // The reset also snapshots the lost streak for a possible repair
    // (pass 19), so applyDailyClaim now records that too.
    expect(
      applyDailyClaim(claimed(10, 5, getLocalDayKey(day(1))), day(12)),
    ).toEqual({
      lastClaimDay: getLocalDayKey(day(12)),
      streak: 1,
      lastGraceDay: getLocalDayKey(day(1)),
      repairStreak: 5,
      repairDay: getLocalDayKey(day(12)),
    });
  });

  it("works for old state without a lastGraceDay field (no migration needed)", () => {
    const legacy: DailyBonusState = { lastClaimDay: getLocalDayKey(day(10)), streak: 3 };
    expect(computeDailyClaim(legacy, day(12)).nextStreak).toBe(4);
  });
});

describe("streak freezes (pass 19, offline:streak-freeze)", () => {
  it("earns a freeze passively on the day-7 milestone claim", () => {
    expect(computeDailyClaim(stateAt(6, 6), day(7))).toEqual({
      claimable: true,
      nextStreak: 7,
      bonus: DAILY_MILESTONE_BONUS,
      earnedFreeze: true,
    });
    expect(applyDailyClaim(stateAt(6, 6), day(7))).toEqual({
      lastClaimDay: getLocalDayKey(day(7)),
      streak: 7,
      freezes: 1,
    });
  });

  it("keeps earning every 7 streak days until the cap, then stops", () => {
    expect(computeDailyClaim(stateAt(13, 13, { freezes: STREAK_FREEZE_CAP }), day(14))).toEqual({
      claimable: true,
      nextStreak: 14,
      bonus: DAILY_MILESTONE_BONUS,
    });
    expect(applyDailyClaim(stateAt(13, 13, { freezes: STREAK_FREEZE_CAP }), day(14))).toEqual({
      lastClaimDay: getLocalDayKey(day(14)),
      streak: 14,
      freezes: STREAK_FREEZE_CAP,
    });
  });

  it("non-milestone streak days earn nothing", () => {
    // Day 8 streak: not a multiple of 7, stock untouched.
    expect(
      computeDailyClaim(stateAt(7, 7, { freezes: 1 }), day(8)),
    ).toEqual({
      claimable: true,
      nextStreak: 8,
      bonus: DAILY_MILESTONE_BONUS,
    });
    expect(
      applyDailyClaim(stateAt(7, 7, { freezes: 1 }), day(8)),
    ).toEqual({
      lastClaimDay: getLocalDayKey(day(8)),
      streak: 8,
      freezes: 1,
    });
  });

  it("bridges a one-day gap once the grace is spent (grace has priority)", () => {
    // Grace already used: the freeze stock takes over.
    expect(
      computeDailyClaim(
        stateAt(10, 5, { lastGraceDay: getLocalDayKey(day(10)), freezes: 2 }),
        day(12),
      ),
    ).toEqual({
      claimable: true,
      nextStreak: 6,
      bonus: DAILY_BASE_BONUS * 6,
      bridge: "freeze",
    });
    // Grace still available: it bridges, the stock is untouched.
    expect(computeDailyClaim(stateAt(10, 5, { freezes: 2 }), day(12))).toEqual({
      claimable: true,
      nextStreak: 6,
      bonus: DAILY_BASE_BONUS * 6,
      bridge: "grace",
    });
    expect(applyDailyClaim(stateAt(10, 5, { freezes: 2 }), day(12))).toEqual({
      lastClaimDay: getLocalDayKey(day(12)),
      streak: 6,
      freezes: 2,
      lastGraceDay: getLocalDayKey(day(12)),
    });
  });

  it("consumes one freeze per bridged claim, down to none (field omitted at 0)", () => {
    expect(
      applyDailyClaim(
        stateAt(10, 5, { lastGraceDay: getLocalDayKey(day(10)), freezes: 1 }),
        day(12),
      ),
    ).toEqual({
      lastClaimDay: getLocalDayKey(day(12)),
      streak: 6,
      lastGraceDay: getLocalDayKey(day(10)),
    });
  });

  it("covers one missed day only — a two-day gap still resets", () => {
    expect(computeDailyClaim(stateAt(10, 5, { freezes: STREAK_FREEZE_CAP }), day(13))).toEqual({
      claimable: true,
      nextStreak: 1,
      bonus: DAILY_BASE_BONUS,
    });
  });
});

describe("streak repair (pass 19, offline:streak-repair)", () => {
  it("a reset that lost STREAK_REPAIR_MIN_DAYS+ snapshots the lost streak", () => {
    expect(
      applyDailyClaim(
        stateAt(10, 5, { lastGraceDay: getLocalDayKey(day(10)) }),
        day(12),
      ),
    ).toEqual({
      lastClaimDay: getLocalDayKey(day(12)),
      streak: 1,
      lastGraceDay: getLocalDayKey(day(10)),
      repairStreak: 5,
      repairDay: getLocalDayKey(day(12)),
    });
  });

  it("does not snapshot a too-small streak (below the repair minimum)", () => {
    expect(
      applyDailyClaim(
        stateAt(10, STREAK_REPAIR_MIN_DAYS - 1, {
          lastGraceDay: getLocalDayKey(day(10)),
        }),
        day(12),
      ),
    ).toEqual({
      lastClaimDay: getLocalDayKey(day(12)),
      streak: 1,
      lastGraceDay: getLocalDayKey(day(10)),
    });
  });

  it("repairs on the next local day: streak restored to lost+1 at the restored bonus", () => {
    const reset = applyDailyClaim(
      stateAt(10, 5, { lastGraceDay: getLocalDayKey(day(10)) }),
      day(12),
    );
    expect(computeDailyClaim(reset, day(13))).toEqual({
      claimable: true,
      nextStreak: 6,
      bonus: DAILY_BASE_BONUS * 6,
      bridge: "repair",
    });
    expect(applyDailyClaim(reset, day(13))).toEqual({
      lastClaimDay: getLocalDayKey(day(13)),
      streak: 6,
      lastGraceDay: getLocalDayKey(day(10)),
      lastRepairDay: getLocalDayKey(day(13)),
    });
  });

  it("the window is one local day: a later claim is a plain reset", () => {
    const reset = applyDailyClaim(
      stateAt(10, 5, { lastGraceDay: getLocalDayKey(day(10)) }),
      day(12),
    );
    expect(computeDailyClaim(reset, day(14))).toEqual({
      claimable: true,
      nextStreak: 1,
      bonus: DAILY_BASE_BONUS,
    });
    // The expired snapshot is dropped (the new reset is day 1, below the
    // repair minimum, so no fresh snapshot either).
    expect(applyDailyClaim(reset, day(14))).toEqual({
      lastClaimDay: getLocalDayKey(day(14)),
      streak: 1,
      lastGraceDay: getLocalDayKey(day(10)),
    });
  });

  it("allows one repair per rolling 30-day window", () => {
    // Inside the cooldown: the next-day claim is a plain consecutive day 2.
    const afterReset = applyDailyClaim(
      stateAt(30, 17, {
        lastGraceDay: getLocalDayKey(day(30)),
        lastRepairDay: getLocalDayKey(day(13)),
      }),
      day(32),
    );
    expect(afterReset.streak).toBe(1);
    expect(computeDailyClaim(afterReset, day(33)).nextStreak).toBe(2);
    // 31 days after the last repair: available again.
    const oldRepair = day(33) - (STREAK_REPAIR_COOLDOWN_DAYS + 1) * 86400000;
    const reset3 = applyDailyClaim(
      stateAt(30, 17, {
        lastGraceDay: getLocalDayKey(day(30)),
        lastRepairDay: getLocalDayKey(oldRepair),
      }),
      day(32),
    );
    expect(computeDailyClaim(reset3, day(33))).toEqual({
      claimable: true,
      nextStreak: 18,
      bonus: DAILY_MILESTONE_BONUS,
      bridge: "repair",
    });
  });

  it("works for old state without any protection fields (no migration needed)", () => {
    const legacy: DailyBonusState = { lastClaimDay: getLocalDayKey(day(10)), streak: 5 };
    // Grace available → bridged, no freezes/repair fields in the result.
    expect(computeDailyClaim(legacy, day(12)).bridge).toBe("grace");
    expect(applyDailyClaim(legacy, day(12))).toEqual({
      lastClaimDay: getLocalDayKey(day(12)),
      streak: 6,
      lastGraceDay: getLocalDayKey(day(12)),
    });
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
