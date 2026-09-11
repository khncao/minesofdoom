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
  localDayKeyDaysAgo,
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

/**
 * DST transition boundaries (F62.1 — calendar-day arithmetic, not
 * epoch-minus-24 h). The old `isYesterdayLocal`/`isTwoDaysAgoLocal`
 * compared `getLocalDayKey(now − 24 h)` against the stored key: on a local
 * day whose midnight→midnight span is 23 h (spring forward) or 25 h (fall
 * back), that lands on the WRONG calendar day for opens near local
 * midnight, so consecutive claims read as gaps (grace consumed / streak
 * reset) and one-day gaps read as consecutive (a free streak day) or as
 * two-day gaps (a hard reset where grace should bridge).
 *
 * The net finds REAL transition days by scanning local midnights in the
 * running timezone (a ≠24 h midnight span = a transition). In a
 * no-transition zone (e.g. UTC CI) the transition describes skip
 * themselves — the misclassification can't be expressed without DST, and
 * Node's runtime TZ can't be switched after start.
 */
const MIDNIGHT = (y: number, mo: number, d: number) =>
  new Date(y, mo, d, 0, 0, 0).getTime();

function findTransitionDays(): { short: number | undefined; long: number | undefined } {
  let short: number | undefined;
  let long: number | undefined;
  // 2024-01-01 forward ~4 years — covers every DST regime's transitions.
  let prev = MIDNIGHT(2024, 0, 1);
  for (let i = 0; i < 1460; i++) {
    const d = new Date(prev);
    const cur = MIDNIGHT(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    const span = cur - prev;
    if (span < 24 * 3_600_000) short ??= prev; // `prev` opens a 23 h day
    if (span > 24 * 3_600_000) long ??= prev; // `prev` opens a 25 h day
    if (short !== undefined && long !== undefined) break;
    prev = cur;
  }
  return { short, long };
}

const transitions = findTransitionDays();

describe("localDayKeyDaysAgo (F62.1 — calendar-day subtraction)", () => {
  it("subtracts calendar days across month and year boundaries", () => {
    // Jan 1 → Dec 31 of the previous year (plain dates, no DST involved).
    const jan1 = MIDNIGHT(2026, 0, 1);
    expect(localDayKeyDaysAgo(jan1 + 3_600_000, 1)).toBe("2025-12-31");
    expect(localDayKeyDaysAgo(jan1 + 3_600_000, 2)).toBe("2025-12-30");
    // Mar 1 2024 → Feb 29 (leap year).
    const mar1 = MIDNIGHT(2024, 2, 1);
    expect(localDayKeyDaysAgo(mar1 + 3_600_000, 1)).toBe("2024-02-29");
  });
});

const describeShort = transitions.short === undefined ? describe.skip : describe;
describeShort("23 h local day (spring-forward shape) — F62.1", () => {
  const s = transitions.short as number; // midnight opening the 23 h day D
  const d = new Date(s);
  const nextMidnight = MIDNIGHT(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  const openNextEarly = nextMidnight + 30 * 60_000; // D+1 00:30
  const keyD = getLocalDayKey(s);
  const keyDMinus1 = getLocalDayKey(
    MIDNIGHT(d.getFullYear(), d.getMonth(), d.getDate() - 1),
  );

  it("a consecutive-day claim opened in the first hour of the next day is still consecutive", () => {
    expect(isYesterdayLocal(keyD, openNextEarly)).toBe(true);
    expect(isTwoDaysAgoLocal(keyD, openNextEarly)).toBe(false);
    const state: DailyBonusState = { lastClaimDay: keyD, streak: 5 };
    const claim = computeDailyClaim(state, openNextEarly);
    // The OLD epoch-24 h math classified this as a one-day gap and burned
    // the grace (or reset the streak); it must be a clean consecutive claim.
    expect(claim.claimable).toBe(true);
    expect(claim.nextStreak).toBe(6);
    expect(claim.bridge).toBeUndefined();
  });

  it("a one-day gap opened early the day after is still a gap (grace, not free)", () => {
    expect(isYesterdayLocal(keyDMinus1, openNextEarly)).toBe(false);
    expect(isTwoDaysAgoLocal(keyDMinus1, openNextEarly)).toBe(true);
    const state: DailyBonusState = { lastClaimDay: keyDMinus1, streak: 5 };
    const claim = computeDailyClaim(state, openNextEarly);
    // The OLD math read this as CONSECUTIVE (a free streak day without
    // consuming a safety net); it must bridge through the grace.
    expect(claim.claimable).toBe(true);
    expect(claim.nextStreak).toBe(6);
    expect(claim.bridge).toBe("grace");
  });
});

const describeLong = transitions.long === undefined ? describe.skip : describe;
describeLong("25 h local day (fall-back shape) — F62.1", () => {
  const l = transitions.long as number; // midnight opening the 25 h day D
  const d = new Date(l);
  const openLate = l + 23.5 * 3_600_000; // D 23:30
  const keyDMinus1 = getLocalDayKey(
    MIDNIGHT(d.getFullYear(), d.getMonth(), d.getDate() - 1),
  );
  const keyDMinus2 = getLocalDayKey(
    MIDNIGHT(d.getFullYear(), d.getMonth(), d.getDate() - 2),
  );

  it("a consecutive-day claim opened in the last hour of a 25 h day is still consecutive", () => {
    expect(isYesterdayLocal(keyDMinus1, openLate)).toBe(true);
    expect(isTwoDaysAgoLocal(keyDMinus1, openLate)).toBe(false);
    const state: DailyBonusState = { lastClaimDay: keyDMinus1, streak: 5 };
    const claim = computeDailyClaim(state, openLate);
    // The OLD epoch-24 h math classified this as a TWO-day gap (hard reset
    // or grace burn); it must be a clean consecutive claim.
    expect(claim.claimable).toBe(true);
    expect(claim.nextStreak).toBe(6);
    expect(claim.bridge).toBeUndefined();
  });

  it("a one-day gap opened late on a 25 h day is still a gap (grace, not reset)", () => {
    expect(isYesterdayLocal(keyDMinus2, openLate)).toBe(false);
    expect(isTwoDaysAgoLocal(keyDMinus2, openLate)).toBe(true);
    const state: DailyBonusState = { lastClaimDay: keyDMinus2, streak: 5 };
    const claim = computeDailyClaim(state, openLate);
    // The OLD math saw neither yesterday nor two-days-ago → a hard reset;
    // it must bridge through the grace.
    expect(claim.claimable).toBe(true);
    expect(claim.nextStreak).toBe(6);
    expect(claim.bridge).toBe("grace");
  });
});
