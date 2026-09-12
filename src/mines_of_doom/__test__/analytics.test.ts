import {
  COSMETIC_PURCHASE_LOG_MAX,
  D1_RETENTION_MS,
  IAP_PURCHASE_LOG_MAX,
  SUMMARY_RECENT_MAX,
  D7_RETENTION_MS,
  emptyAnalyticsState,
  parseAnalytics,
  recordAdOutcome,
  recordAdView,
  recordAppOpen,
  recordFirstAnswer,
  recordOnboardingEnd,
  recordOnboardingStep,
  recordCosmeticPurchase,
  recordFeatureFirstUse,
  recordIapPurchase,
  recordPrestige,
  recordTierMilestone,
  summarizeAnalytics,
} from "../analytics";
import { getLocalDayKey } from "../dailyBonus";

/** Local noon on a calendar day — same convention as the daily-bonus
 *  tests: noon±24h stays on the expected day in the DST regimes we test. */
const day = (d: number) => new Date(2026, 5, d, 12, 0, 0).getTime();

describe("emptyAnalyticsState", () => {
  it("establishes a first-open record with one active day", () => {
    const s = emptyAnalyticsState(day(1));
    expect(s.firstOpenDay).toBe(getLocalDayKey(day(1)));
    expect(s.activeDays).toBe(1);
    expect(s.d1Retention).toBe(false);
    expect(s.firstAdViewDay).toBe("");
    expect(s.prestiges).toBe(0);
  });
});

describe("recordAppOpen", () => {
  it("establishes the record when there is none", () => {
    const s = recordAppOpen(null, day(1));
    expect(s.firstOpenMs).toBe(day(1));
    expect(s.activeDays).toBe(1);
  });

  it("is idempotent within a local day (double-invocation can't inflate)", () => {
    const once = recordAppOpen(null, day(1));
    const twice = recordAppOpen(once, day(1) + 3600 * 1000);
    expect(twice.activeDays).toBe(1);
    expect(twice.lastOpenMs).toBe(day(1) + 3600 * 1000);
    expect(twice.d1Retention).toBe(false);
  });

  it("flags D1 on a return the next local day inside the window", () => {
    const opened = recordAppOpen(null, day(1));
    const returned = recordAppOpen(opened, day(2));
    expect(returned.activeDays).toBe(2);
    expect(returned.d1Retention).toBe(true);
    expect(returned.d7Retention).toBe(true);
  });

  it("misses D1 (but not D7) when the return is past the D1 window", () => {
    const t = day(1) + 2.2 * 24 * 60 * 60 * 1000; // > D1_RETENTION_MS, < D7
    expect(t - day(1)).toBeGreaterThan(D1_RETENTION_MS);
    expect(t - day(1)).toBeLessThan(D7_RETENTION_MS);
    const opened = recordAppOpen(null, day(1));
    const returned = recordAppOpen(opened, t);
    expect(returned.d1Retention).toBe(false);
    expect(returned.d7Retention).toBe(true);
  });

  it("flags neither D1 nor D7 for a return past both windows", () => {
    const t = day(1) + 9 * 24 * 60 * 60 * 1000;
    const opened = recordAppOpen(null, day(1));
    const returned = recordAppOpen(opened, t);
    expect(returned.d1Retention).toBe(false);
    expect(returned.d7Retention).toBe(false);
    expect(returned.activeDays).toBe(2);
  });

  it("once true, never back off", () => {
    const s = recordAppOpen(recordAppOpen(null, day(1)), day(2));
    const late = day(20);
    expect(recordAppOpen(s, late).d1Retention).toBe(true);
    expect(s.d7Retention).toBe(true);
  });
});

describe("recordAdView", () => {
  it("stamps the first ad view once, with the kind of the first tap", () => {
    const s = recordAdView(null, day(3), "gemRolls");
    expect(s.firstAdViewDay).toBe(getLocalDayKey(day(3)));
    expect(s.firstAdKind).toBe("gemRolls");
    // A later tap of a different kind never overwrites the first.
    const again = recordAdView(s, day(5), "comboSave");
    expect(again.firstAdViewDay).toBe(getLocalDayKey(day(3)));
    expect(again.firstAdKind).toBe("gemRolls");
  });
});

describe("recordAdOutcome", () => {
  it("stamps the first attempt's outcome once", () => {
    let s = emptyAnalyticsState(day(1));
    s = recordAdOutcome(s, day(3), "closed");
    expect(s.firstAdOutcome).toBe("closed");
    // A later rewarded attempt never rewrites the first-attempt outcome.
    s = recordAdOutcome(s, day(4), "rewarded");
    expect(s.firstAdOutcome).toBe("closed");
  });

  it("stamps the view day and kind together, outcome follows", () => {
    let s = recordAdView(null, day(2), "offlineDouble");
    s = recordAdOutcome(s, day(2), "rewarded");
    expect(s).toMatchObject({
      firstAdViewDay: getLocalDayKey(day(2)),
      firstAdKind: "offlineDouble",
      firstAdOutcome: "rewarded",
    });
  });
});

describe("recordIapPurchase", () => {
  it("counts every purchase but only stamps the first day once", () => {
    let s = recordIapPurchase(null, day(2));
    s = recordIapPurchase(s, day(4));
    expect(s.iapPurchases).toBe(2);
    expect(s.firstIapPurchaseDay).toBe(getLocalDayKey(day(2)));
    // No product id supplied: the counter moves, the log stays empty.
    expect(s.iapPurchaseLog).toEqual([]);
  });

  it("records a row per product id (newest last) when one is given", () => {
    let s = recordIapPurchase(null, day(2), "packSkin");
    s = recordIapPurchase(s, day(4), "packGold");
    s = recordIapPurchase(s, day(6), "packSkin");
    expect(s.iapPurchases).toBe(3);
    expect(s.iapPurchaseLog).toEqual([
      { product: "packSkin", day: getLocalDayKey(day(2)) },
      { product: "packGold", day: getLocalDayKey(day(4)) },
      { product: "packSkin", day: getLocalDayKey(day(6)) },
    ]);
  });

  it("keeps the IAP log bounded (newest last) past the cap", () => {
    let s = emptyAnalyticsState(day(1));
    const ids = ["packSkin", "packGold", "packDamsel"] as const;
    for (let i = 0; i < IAP_PURCHASE_LOG_MAX + 4; i++) {
      s = recordIapPurchase(s, day(2), ids[i % ids.length]);
    }
    expect(s.iapPurchases).toBe(IAP_PURCHASE_LOG_MAX + 4);
    expect(s.iapPurchaseLog).toHaveLength(IAP_PURCHASE_LOG_MAX);
    // Last recorded row (i = IAP_PURCHASE_LOG_MAX + 3 ≡ 1 (mod 3)).
    expect(s.iapPurchaseLog.at(-1)?.product).toBe("packGold");
  });
});

describe("recordPrestige", () => {
  it("stamps the first prestige once (free-path progress)", () => {
    const s = recordPrestige(null, day(7));
    expect(s.firstPrestigeDay).toBe(getLocalDayKey(day(7)));
    expect(recordPrestige(s, day(9)).firstPrestigeDay).toBe(
      getLocalDayKey(day(7)),
    );
  });

  it("counts every prestige, not just the first", () => {
    let s = recordPrestige(null, day(7));
    s = recordPrestige(s, day(9));
    s = recordPrestige(s, day(20));
    expect(s.prestiges).toBe(3);
    expect(s.firstPrestigeDay).toBe(getLocalDayKey(day(7)));
  });
});

describe("recordTierMilestone", () => {
  it("stamps a completed tier once and ignores repeats", () => {
    const s = recordTierMilestone(null, "t1", day(7));
    expect(s.firstTierDay).toEqual({ t1: getLocalDayKey(day(7)) });
    // Same tier again (a different day) keeps the first stamp.
    expect(recordTierMilestone(s, "t1", day(9)).firstTierDay).toEqual({
      t1: getLocalDayKey(day(7)),
    });
  });

  it("stamps tiers independently (t2 doesn't touch t1)", () => {
    let s = recordTierMilestone(null, "t2", day(3));
    s = recordTierMilestone(s, "t5", day(11));
    expect(s.firstTierDay).toEqual({
      t2: getLocalDayKey(day(3)),
      t5: getLocalDayKey(day(11)),
    });
  });

  it("ignores malformed tier ids (never crashes the record)", () => {
    const s = recordTierMilestone(null, "notATier", day(7));
    expect(s.firstTierDay).toEqual({});
    expect(recordTierMilestone(null, "", day(7)).firstTierDay).toEqual({});
  });
});

describe("recordCosmeticPurchase", () => {
  it("stamps the first purchase day once and counts every one", () => {
    let s = recordCosmeticPurchase(
      null,
      { line: "outfit", id: "night", path: "gems", gems: 0 },
      day(2),
    );
    s = recordCosmeticPurchase(
      s,
      { line: "theme", id: "magma", path: "iap", gems: 5 },
      day(4),
    );
    expect(s.cosmeticPurchases).toBe(2);
    expect(s.firstCosmeticPurchaseDay).toBe(getLocalDayKey(day(2)));
    expect(s.cosmeticPurchaseLog).toEqual([
      {
        line: "outfit",
        id: "night",
        path: "gems",
        gems: 0,
        day: getLocalDayKey(day(2)),
      },
      {
        line: "theme",
        id: "magma",
        path: "iap",
        gems: 5,
        day: getLocalDayKey(day(4)),
      },
    ]);
  });

  it("keeps the log bounded (newest last) past the cap", () => {
    let s = emptyAnalyticsState(day(1));
    for (let i = 0; i < COSMETIC_PURCHASE_LOG_MAX + 7; i++) {
      s = recordCosmeticPurchase(
        s,
        { line: "pickaxe", id: `p${i}`, path: "gems", gems: i },
        day(2),
      );
    }
    expect(s.cosmeticPurchaseLog).toHaveLength(COSMETIC_PURCHASE_LOG_MAX);
    expect(s.cosmeticPurchases).toBe(COSMETIC_PURCHASE_LOG_MAX + 7);
    // oldest entries dropped, newest kept
    expect(s.cosmeticPurchaseLog[0].id).toBe("p7");
    expect(s.cosmeticPurchaseLog.at(-1)?.id).toBe(
      `p${COSMETIC_PURCHASE_LOG_MAX + 6}`,
    );
  });
});

describe("parseAnalytics", () => {
  it("returns null for absent, corrupt, or non-object raw values", () => {
    expect(parseAnalytics(null)).toBeNull();
    expect(parseAnalytics("{not json")).toBeNull();
    expect(parseAnalytics("42")).toBeNull();
    expect(parseAnalytics(JSON.stringify([1, 2]))).toBeNull();
  });

  it("round-trips a full record (incl. both per-purchase logs)", () => {
    let s = emptyAnalyticsState(day(1));
    s = recordAppOpen(s, day(2));
    s = recordAdView(s, day(2), "gemRolls");
    s = recordAdOutcome(s, day(2), "rewarded");
    s = recordIapPurchase(s, day(3), "packGold");
    s = recordPrestige(s, day(4));
    s = recordCosmeticPurchase(
      s,
      { line: "outfit", id: "night", path: "gems", gems: 0 },
      day(5),
    );
    const parsed = parseAnalytics(JSON.stringify(s));
    expect(parsed).toEqual(s);
    expect(parsed!.iapPurchaseLog).toEqual([
      { product: "packGold", day: getLocalDayKey(day(3)) },
    ]);
  });

  it("drops malformed tier-milestone stamps (a hand-edited record must not crash the panel)", () => {
    const parsed = parseAnalytics(
      JSON.stringify({
        firstOpenMs: day(1),
        firstTierDay: {
          t1: getLocalDayKey(day(2)),
          "bad-key": getLocalDayKey(day(3)),
          t2: "", // empty day = never stamped, dropped
          t3: 42, // not a string day
        },
      }),
    );
    expect(parsed).not.toBeNull();
    expect(parsed!.firstTierDay).toEqual({ t1: getLocalDayKey(day(2)) });
    // Missing field migrates to an empty map (pre-pass-74 records).
    const legacy = { ...emptyAnalyticsState(day(1)) };
    delete (legacy as Record<string, unknown>).firstTierDay;
    expect(parseAnalytics(JSON.stringify(legacy))!.firstTierDay).toEqual({});
  });

  it("drops invalid first-ad stamps (a hand-edited record must not crash the panel)", () => {
    const bad = parseAnalytics(
      JSON.stringify({
        firstOpenMs: day(1),
        firstAdKind: "notAKind",
        firstAdOutcome: "meh",
      }),
    );
    expect(bad).not.toBeNull();
    expect(bad!.firstAdKind).toBe("");
    expect(bad!.firstAdOutcome).toBe("");
    const good = parseAnalytics(
      JSON.stringify({
        firstOpenMs: day(1),
        firstAdKind: "gemRolls",
        firstAdOutcome: "error",
      }),
    );
    expect(good!.firstAdKind).toBe("gemRolls");
    expect(good!.firstAdOutcome).toBe("error");
    // Pre-F26.4 records (fields absent) default to "" — the summary
    // line renders bare, exactly as before.
    expect(good!.firstAdViewDay).toBe("");
  });

  it("migrates a legacy record: cosmetic + IAP log fields default in", () => {
    const legacy = { ...emptyAnalyticsState(day(1)) };
    delete (legacy as Record<string, unknown>).firstCosmeticPurchaseDay;
    delete (legacy as Record<string, unknown>).cosmeticPurchases;
    delete (legacy as Record<string, unknown>).cosmeticPurchaseLog;
    delete (legacy as Record<string, unknown>).iapPurchaseLog;
    const parsed = parseAnalytics(JSON.stringify(legacy));
    expect(parsed).not.toBeNull();
    expect(parsed!.firstCosmeticPurchaseDay).toBe("");
    expect(parsed!.cosmeticPurchases).toBe(0);
    expect(parsed!.cosmeticPurchaseLog).toEqual([]);
    expect(parsed!.iapPurchaseLog).toEqual([]);
  });

  it("drops malformed IAP log rows and re-caps a hand-edited oversized log", () => {
    const good = { product: "packGold", day: "2026-05-02" };
    const parsed = parseAnalytics(
      JSON.stringify({
        firstOpenMs: day(1),
        iapPurchaseLog: [good, null, 42, { product: "", day: "x" }, { day: "x" }],
      }),
    );
    expect(parsed).not.toBeNull();
    expect(parsed!.iapPurchaseLog).toEqual([good]);
    const oversized = {
      firstOpenMs: day(1),
      iapPurchaseLog: Array.from(
        { length: IAP_PURCHASE_LOG_MAX + 5 },
        (_, i) => ({ ...good, day: `d${i}` }),
      ),
    };
    const reCapped = parseAnalytics(JSON.stringify(oversized));
    expect(reCapped!.iapPurchaseLog).toHaveLength(IAP_PURCHASE_LOG_MAX);
    expect(reCapped!.iapPurchaseLog.at(-1)?.day).toBe("d104");
  });

  it("drops malformed log entries and re-caps a hand-edited oversized log", () => {
    const bad = {
      line: "quantum",
      id: "night",
      path: "gems",
      gems: 0,
      day: "2026-05-02",
    };
    const good = {
      line: "outfit",
      id: "night",
      path: "gems",
      gems: 0,
      day: "2026-05-02",
    };
    const parsed = parseAnalytics(
      JSON.stringify({
        firstOpenMs: day(1),
        cosmeticPurchaseLog: [
          bad,
          good,
          null,
          42,
          { ...good, gems: "five" },
          { ...good, id: 7 },
        ],
      }),
    );
    expect(parsed).not.toBeNull();
    expect(parsed!.cosmeticPurchaseLog).toEqual([good]);
    const oversized = {
      firstOpenMs: day(1),
      cosmeticPurchaseLog: Array.from(
        { length: COSMETIC_PURCHASE_LOG_MAX + 5 },
        (_, i) => ({ ...good, id: `p${i}` }),
      ),
    };
    const reCapped = parseAnalytics(JSON.stringify(oversized));
    expect(reCapped!.cosmeticPurchaseLog).toHaveLength(
      COSMETIC_PURCHASE_LOG_MAX,
    );
  });

  it("migrates a legacy record: missing counter defaults, stamped first day implies 1", () => {
    const legacy = {
      ...emptyAnalyticsState(day(1)),
      firstPrestigeDay: getLocalDayKey(day(7)),
    };
    delete (legacy as { prestiges?: number }).prestiges;
    const parsed = parseAnalytics(JSON.stringify(legacy));
    expect(parsed).not.toBeNull();
    expect(parsed!.prestiges).toBe(1);
    expect(parsed!.firstPrestigeDay).toBe(getLocalDayKey(day(7)));
    // and a legacy record that never prestiged stays at 0
    const legacyFresh = { ...emptyAnalyticsState(day(1)) };
    delete (legacyFresh as { prestiges?: number }).prestiges;
    expect(parseAnalytics(JSON.stringify(legacyFresh))!.prestiges).toBe(0);
  });

  it("coerces garbage field types to safe defaults", () => {
    const parsed = parseAnalytics(
      JSON.stringify({
        firstOpenMs: "nope",
        activeDays: -3,
        iapPurchases: 1.5,
        d1Retention: "yes",
      }),
    );
    expect(parsed).not.toBeNull();
    expect(parsed!.activeDays).toBe(0);
    expect(parsed!.iapPurchases).toBe(1);
    expect(parsed!.d1Retention).toBe(false);
    expect(parsed!.firstOpenDay).not.toBe("");
  });
});

describe("summarizeAnalytics", () => {
  it("renders the fixed field block in a stable order, then the recent rows", () => {
    let s = emptyAnalyticsState(day(1));
    s = recordAppOpen(s, day(3));
    s = recordAdView(s, day(2), "comboSave");
    s = recordAdOutcome(s, day(2), "error");
    s = recordPrestige(s, day(9));
    s = recordIapPurchase(s, day(4), "packGold");
    s = recordCosmeticPurchase(
      s,
      { line: "outfit", id: "night", path: "gems", gems: 0 },
      day(5),
    );
    const lines = summarizeAnalytics(s).split("\n");
    // 12 fixed fields + iap-by-product (header + 1) + recent cosmetics
    // (header + 1) + recent iap (header + 1) + the FTUE "app opens" line
    // (two opens observed in this state).
    expect(lines).toHaveLength(19);
    expect(lines[0]).toContain(s.firstOpenDay);
    expect(lines[2]).toContain(`active days     ${s.activeDays}`);
    expect(lines[3]).toContain("d1 retention");
    expect(lines[6]).toContain("iap purchases   1");
    expect(lines[8]).toContain("cosmetic purchases   1");
    expect(lines[9]).toContain(
      `first cosmetic       ${getLocalDayKey(day(5))}`,
    );
    expect(lines[10]).toContain("prestiges       1");
    // The variable blocks come after the fixed block: iap-by-product
    // (header + 1), recent cosmetics (header + 1), recent iap (header + 1).
    expect(lines[12]).toBe("iap by product   (1 logged)");
    expect(lines[13]).toContain("packGold");
    expect(lines[14]).toBe("recent cosmetics   (last 1 of 1)");
    expect(lines[16]).toBe("recent iap   (last 1 of 1)");
    expect(lines[17]).toBe(`  ${getLocalDayKey(day(4))}  packGold`);
    // The FTUE funnel lines trail the purchase blocks; "app opens" only
    // appears from 2 (a 1-open session has no 1→2 conversion to show).
    expect(lines[18]).toContain("app opens      2");
  });

  it("decorates the first-ad-view line with the first kind and outcome", () => {
    let s = emptyAnalyticsState(day(1));
    s = recordAdView(s, day(2), "offlineTopUp");
    s = recordAdOutcome(s, day(2), "closed");
    const text = summarizeAnalytics(s);
    expect(text).toContain(
      `first ad view   ${getLocalDayKey(day(2))} (offlineTopUp, closed)`,
    );
  });

  it("says 'never' for un-fired one-shot fields and omits the variable blocks when empty", () => {
    const fresh = emptyAnalyticsState(day(1));
    const lines = summarizeAnalytics(fresh).split("\n");
    // A fresh record has no purchase rows and no FTUE funnel data
    // (single open, no answer, no tour), so no variable blocks at all.
    expect(lines).toHaveLength(12);
    const text = lines.join("\n");
    expect(text).toContain("first ad view   never");
    expect(text).toContain("iap purchases   0");
    expect(text).toContain("cosmetic purchases   0");
    expect(text).toContain("first cosmetic       never");
    expect(text).toContain("first prestige  never");
    expect(text).toContain("d1 retention    no");
  });

  it("shows per-product IAP counts aggregated from the log", () => {
    let s = emptyAnalyticsState(day(1));
    s = recordIapPurchase(s, day(2), "packSkin");
    s = recordIapPurchase(s, day(3), "packGold");
    s = recordIapPurchase(s, day(4), "packSkin");
    const text = summarizeAnalytics(s);
    expect(text).toContain("iap by product   (3 logged)");
    // padEnd'd columns — match the value, not the exact spacing.
    expect(text).toMatch(/packGold\s+1\n/);
    expect(text).toMatch(/packSkin\s+2\n/);
  });

  it("lists tier-milestone stamps in natural tier order when any were hit", () => {
    let s = emptyAnalyticsState(day(1));
    s = recordTierMilestone(s, "t2", day(3));
    s = recordTierMilestone(s, "t1", day(4));
    const text = summarizeAnalytics(s);
    const block = summarizeRecentBlock(text, "tier first days");
    expect(block).toHaveLength(2);
    // Natural order (t1 before t2) regardless of stamp order.
    expect(block[0]).toContain(`t1  ${getLocalDayKey(day(4))}`);
    expect(block[1]).toContain(`t2  ${getLocalDayKey(day(3))}`);
  });

  it("caps the recent-row blocks at SUMMARY_RECENT_MAX (newest kept)", () => {
    let s = emptyAnalyticsState(day(1));
    for (let i = 0; i < SUMMARY_RECENT_MAX + 5; i++) {
      s = recordIapPurchase(s, day(2), "packGold");
      s = recordCosmeticPurchase(
        s,
        { line: "outfit", id: `c${i}`, path: "gems", gems: i },
        day(2),
      );
    }
    const text = summarizeAnalytics(s);
    const cosmeticBlock = summarizeRecentBlock(text, "recent cosmetics");
    const iapBlock = summarizeRecentBlock(text, "recent iap");
    expect(cosmeticBlock).toHaveLength(SUMMARY_RECENT_MAX);
    expect(iapBlock).toHaveLength(SUMMARY_RECENT_MAX);
    // Newest rows survive: the last recorded ids, not the first.
    expect(cosmeticBlock.at(-1)).toContain(
      `outfit:c${SUMMARY_RECENT_MAX + 4}`,
    );
    expect(iapBlock.at(-1)).toContain("packGold");
  });
});

/** The indented rows of one variable block in the summary text. */
function summarizeRecentBlock(text: string, header: string): string[] {
  const lines = text.split("\n");
  const start = lines.findIndex((l) => l.startsWith(header));
  if (start === -1) return [];
  const rows: string[] = [];
  for (const l of lines.slice(start + 1)) {
    if (l.startsWith("  ")) rows.push(l);
    else break;
  }
  return rows;
}

describe("recordFeatureFirstUse (F27.4 first-use stamps)", () => {
  const t0 = Date.UTC(2026, 5, 10, 12, 0, 0);

  it("stamps the first use and never moves it on re-fire", () => {
    const a = recordFeatureFirstUse(
      emptyAnalyticsState(t0),
      "daily-equation",
      t0 + 1000,
    );
    expect(a.firstUse["daily-equation"]).toBe(t0 + 1000);
    // Idempotent: a later re-fire (strict mode, repeated opens) is a no-op.
    const b = recordFeatureFirstUse(a, "daily-equation", t0 + 999_999);
    expect(b.firstUse["daily-equation"]).toBe(t0 + 1000);
  });

  it("stamps features independently and establishes the record from null",
    () => {
      const a = recordFeatureFirstUse(null, "cloud-link", t0);
      expect(a.firstOpenMs).toBe(t0); // like every other record*: null → fresh
      expect(a.firstUse).toEqual({ "cloud-link": t0 });
      const b = recordFeatureFirstUse(a, "leaderboard-open", t0 + 5);
      expect(b.firstUse).toEqual({
        "cloud-link": t0,
        "leaderboard-open": t0 + 5,
      });
    });

  it("parseAnalytics migrates a legacy record (no firstUse) to an empty map",
    () => {
      const a = recordFeatureFirstUse(null, "weekly-claim", t0);
      const legacy = JSON.parse(JSON.stringify(a)) as Record<string, unknown>;
      delete legacy.firstUse;
      const parsed = parseAnalytics(JSON.stringify(legacy));
      expect(parsed).not.toBeNull();
      expect(parsed!.firstUse).toEqual({});
    });

  it("parseAnalytics drops hand-edited keys outside the closed vocab",
    () => {
      const a = recordFeatureFirstUse(null, "weekly-claim", t0);
      const junk = JSON.stringify({
        ...a,
        firstUse: { "weekly-claim": t0, bogus: 1, "goals-tab": "soon" },
      });
      const parsed = parseAnalytics(junk);
      expect(parsed!.firstUse).toEqual({ "weekly-claim": t0 });
    });

  it("the summary lists stamped features with local day keys, in vocab order",
    () => {
      const a = recordFeatureFirstUse(null, "save-code-export", t0);
      const b = recordFeatureFirstUse(a, "goals-tab", t0 + 2 * 3_600_000);
      const s = summarizeAnalytics(b);
      expect(s).toContain("first use  (2)");
      expect(s).toContain("save-code-export");
      expect(s).toContain("goals-tab");
      // Vocab order: save-code-export is later in FIRST_USE_FEATURES than
      // goals-tab, so goals-tab's line comes first in the block.
      const firstUseBlock = s
        .split("\n")
        .filter((l) => l.startsWith("  ") && l.includes("-"));
      expect(firstUseBlock[0]).toContain("goals-tab");
      // Omitted when nothing fired.
      expect(summarizeAnalytics(emptyAnalyticsState(t0))).not.toContain(
        "first use",
      );
    });
});

describe("FTUE funnel (app opens / time to core / onboarding)", () => {
  const t0 = day(1);
  const T = 60_000; // one minute

  it("recordAppOpen folds the open count, and a legacy record migrates to 1",
    () => {
      // Fresh record is established at the first open — count 1.
      const fresh = recordAppOpen(null, t0);
      expect(fresh.appOpens).toBe(1);
      // Each later load increments (second load is the ≥2 that makes
      // session 1→2 conversion visible).
      expect(recordAppOpen(fresh, t0 + T).appOpens).toBe(2);
      // A pre-`appOpens` record parses as 1 (its existence IS the first
      // open) and then folds normally.
      const legacyState = parseAnalytics(
        JSON.stringify({
          firstOpenMs: t0,
          lastOpenMs: t0,
          firstOpenDay: getLocalDayKey(t0),
          lastOpenDay: getLocalDayKey(t0),
          activeDays: 1,
        }),
      );
      expect(legacyState?.appOpens).toBe(1);
      expect(recordAppOpen(legacyState, t0 + T)?.appOpens).toBe(2);
    });

  it("recordFirstAnswer stamps once (time to core)", () => {
    const a = recordFirstAnswer(null, t0 + T);
    expect(a.firstAnswerMs).toBe(t0 + T);
    // Later answers never move the stamp.
    expect(recordFirstAnswer(a, t0 + 5 * T).firstAnswerMs).toBe(t0 + T);
  });

  it("recordOnboardingStep stamps first sightings per index, drops bad indices",
    () => {
      let s = recordOnboardingStep(null, 0, t0);
      s = recordOnboardingStep(s, 1, t0 + T);
      s = recordOnboardingStep(s, 3, t0 + 2 * T);
      expect(Object.keys(s.onboardingStepMs).sort()).toEqual(["0", "1", "3"]);
      // First sighting wins (a replayed tour never re-stamps).
      const replay = recordOnboardingStep(s, 1, t0 + 10 * T);
      expect(replay.onboardingStepMs[1]).toBe(t0 + T);
      // Out-of-range / non-integer indices are ignored.
      expect(recordOnboardingStep(s, -1, t0 + T)).toBe(s);
      expect(recordOnboardingStep(s, 4, t0 + T)).toBe(s);
      expect(recordOnboardingStep(s, 1.5, t0 + T)).toBe(s);
    });

  it("recordOnboardingEnd: the first dismissal wins both fields",
    () => {
      const s = recordOnboardingEnd(null, t0 + T, false);
      expect(s.onboardingEndMs).toBe(t0 + T);
      expect(s.onboardingCompleted).toBe(false);
      // A later replayed tour that IS completed can't overwrite the
      // first-dismissal outcome (first-run truth is what the funnel wants).
      const later = recordOnboardingEnd(s, t0 + 10 * T, true);
      expect(later.onboardingEndMs).toBe(t0 + T);
      expect(later.onboardingCompleted).toBe(false);
    });

  it("parseAnalytics migrates legacy records and drops junk step stamps",
    () => {
      const base = {
        firstOpenMs: t0,
        lastOpenMs: t0,
        firstOpenDay: getLocalDayKey(t0),
        lastOpenDay: getLocalDayKey(t0),
        activeDays: 1,
      };
      const legacy = parseAnalytics(JSON.stringify(base));
      expect(legacy?.appOpens).toBe(1);
      expect(legacy?.firstAnswerMs).toBe(0);
      expect(legacy?.onboardingStepMs).toEqual({});
      expect(legacy?.onboardingEndMs).toBe(0);
      expect(legacy?.onboardingCompleted).toBe(false);

      const junk = parseAnalytics(
        JSON.stringify({
          ...base,
          appOpens: 7,
          firstAnswerMs: t0 + 3 * T,
          onboardingStepMs: {
            0: t0,
            "2": t0 + T,
            9: t0 + T, // out of range
            x: t0 + T, // non-numeric key
            3: "soon", // non-number value
          },
          onboardingEndMs: t0 + 4 * T,
          onboardingCompleted: true,
        }),
      );
      expect(junk?.appOpens).toBe(7);
      expect(junk?.firstAnswerMs).toBe(t0 + 3 * T);
      expect(junk?.onboardingStepMs).toEqual({ 0: t0, 2: t0 + T });
      expect(junk?.onboardingEndMs).toBe(t0 + 4 * T);
      expect(junk?.onboardingCompleted).toBe(true);
    });

  it("the summary renders the funnel blocks, omitted until they have data",
    () => {
      // Fresh record: none of the funnel blocks render yet.
      const fresh = summarizeAnalytics(recordAppOpen(null, t0));
      expect(fresh).not.toContain("first answer");
      expect(fresh).not.toContain("onboarding");
      expect(fresh).not.toContain("app opens");

      let s = recordAppOpen(recordAppOpen(null, t0), t0 + 2 * T);
      s = recordFirstAnswer(s, t0 + 45 * 1000);
      s = recordOnboardingStep(s, 0, t0);
      s = recordOnboardingStep(s, 1, t0 + T);
      s = recordOnboardingEnd(s, t0 + 3 * T, false);
      const sum = summarizeAnalytics(s);
      // Time to core = firstAnswerMs - firstOpenMs, in whole seconds.
      expect(sum).toContain(`first answer   ${getLocalDayKey(t0 + 45 * 1000)} (+45s)`);
      // Per-step drop-off: steps 0,1 seen; end stamped as skipped.
      expect(sum).toContain("onboarding     steps 0,1; end ");
      expect(sum).toContain("(skipped)");
      // Two opens → the app-opens line appears.
      expect(sum).toContain("app opens      2");
    });
});
