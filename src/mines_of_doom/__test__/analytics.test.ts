import {
  COSMETIC_PURCHASE_LOG_MAX,
  D1_RETENTION_MS,
  IAP_PURCHASE_LOG_MAX,
  SUMMARY_RECENT_MAX,
  D7_RETENTION_MS,
  emptyAnalyticsState,
  parseAnalytics,
  recordAdView,
  recordAppOpen,
  recordCosmeticPurchase,
  recordIapPurchase,
  recordPrestige,
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
  it("stamps the first ad view once", () => {
    const s = recordAdView(null, day(3));
    expect(s.firstAdViewDay).toBe(getLocalDayKey(day(3)));
    const again = recordAdView(s, day(5));
    expect(again.firstAdViewDay).toBe(getLocalDayKey(day(3)));
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
    s = recordAdView(s, day(2));
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
    s = recordAdView(s, day(2));
    s = recordPrestige(s, day(9));
    s = recordIapPurchase(s, day(4), "packGold");
    s = recordCosmeticPurchase(
      s,
      { line: "outfit", id: "night", path: "gems", gems: 0 },
      day(5),
    );
    const lines = summarizeAnalytics(s).split("\n");
    // 12 fixed fields + iap-by-product (header + 1) + recent cosmetics
    // (header + 1) + recent iap (header + 1).
    expect(lines).toHaveLength(18);
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
    expect(lines.at(-1)).toBe(`  ${getLocalDayKey(day(4))}  packGold`);
  });

  it("says 'never' for un-fired one-shot fields and omits the variable blocks when empty", () => {
    const fresh = emptyAnalyticsState(day(1));
    const lines = summarizeAnalytics(fresh).split("\n");
    // A fresh record has no purchase rows, so no variable blocks.
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
