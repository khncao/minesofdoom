import {
  D1_RETENTION_MS,
  D7_RETENTION_MS,
  emptyAnalyticsState,
  recordAdView,
  recordAppOpen,
  recordIapPurchase,
  recordPrestige,
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
});
