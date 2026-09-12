import {
  DEFAULT_FREE_PATH_PERSONA,
  FREE_PATH_TARGET,
  simulateFreePath,
  summarizePacing,
} from "../freePath";
import type { FreePathPurchase, FreePathPurchaseKind } from "../freePath";
import { GOAL_TIERS } from "../goals";

const ALL_PURCHASE_KINDS: readonly FreePathPurchaseKind[] = [
  "miner",
  "minerPower",
  "clickPower",
  "gemMint",
  "fastMiner",
  "gemChance",
  "clickBoost",
  "comboResist",
  "legendaryMiner",
];

const purchasesInDays = (rs: FreePathPurchase[], from: number, to: number) =>
  rs.filter((p) => p.day >= from && p.day <= to);

describe("free-path benchmark (plan §5, guardrail 1: F2P is viable)", () => {
  it("a pure free player banks first prestige within ~7 days of normal idle + play", () => {
    const report = simulateFreePath();
    expect(report.reached).toBe(true);
    expect(report.days).toBeLessThanOrEqual(FREE_PATH_TARGET.maxDays);
    // First prestige is lifetime-gated, so crossing implies the threshold.
    expect(report.lifetimeMinerals).toBeGreaterThanOrEqual(
      FREE_PATH_TARGET.firstPrestigeLifetime,
    );
  });

  it("is deterministic for a fixed seed (same persona, same run)", () => {
    const a = simulateFreePath();
    const b = simulateFreePath();
    expect(a.days).toBe(b.days);
    expect(a.lifetimeMinerals).toBe(b.lifetimeMinerals);
    expect(a.perDay).toEqual(b.perDay);
  });

  it("earned breakdown sums to the lifetime total (no minerals lost or minted from thin air)", () => {
    const report = simulateFreePath();
    const total = Object.values(report.earned).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(report.lifetimeMinerals, 6);
  });

  it("lifetime is monotonic across days (stats never decrease)", () => {
    const report = simulateFreePath();
    for (let i = 1; i < report.perDay.length; i++) {
      expect(report.perDay[i].lifetime).toBeGreaterThanOrEqual(
        report.perDay[i - 1].lifetime,
      );
    }
  });

  it("a lighter persona (45m active/day) still crosses the target within 14 days", () => {
    const report = simulateFreePath({
      ...DEFAULT_FREE_PATH_PERSONA,
      activeSecondsPerDay: 45 * 60,
    });
    expect(report.reached).toBe(true);
    expect(report.days).toBeLessThanOrEqual(14);
  });

  it("a nearly-idle persona (30m active/day, mostly offline) still arrives within the 30d horizon", () => {
    // The free path must remain viable for a player who mostly idles: once
    // the roster is bought (during the short sessions), offline earnings
    // carry the run (guards against a balance that only works with active
    // play). Uses the simulator's full 30-day default horizon.
    const report = simulateFreePath({
      ...DEFAULT_FREE_PATH_PERSONA,
      activeSecondsPerDay: 30 * 60,
    });
    expect(report.reached).toBe(true);
    expect(report.days).toBeLessThanOrEqual(30);
  });

  it("offline earnings are actually paid (regression guard on the close window)", () => {
    // The sim must model the close window the way the engine's load path
    // does: saveTime > 0 and now = saveTime + away-time (epoch ms). With a
    // zeroed/invalid window computeOfflineMinerals silently returns 0 and
    // the "offline carry" claim above is unmeasured. Guard it.
    const report = simulateFreePath();
    expect(report.earned.offline).toBeGreaterThan(0);
  });

  it("pins time-to-t5: the binding 1B-lifetime t5 target lands by day 100 (measured ~82, pass 72)", () => {
    // The free-path benchmark previously pinned only first prestige; this
    // pins the tail — how long the free player takes to reach the t5
    // goal's binding target (1B lifetime minerals; the other t5 metrics —
    // depth 1500m, combo 500 — are already far behind that at crossing,
    // see docs/gap-ranking.md F25.2). The sim runs the whole run at
    // ×1 prestige, so this is the no-prestige floor; a prestige'd player
    // is faster. Measured 2026-09-25 (post offline-sim-fix): D81 994.8M
    // → crosses between D81 and D82; 18 days of slack to 100.
    const report = simulateFreePath(
      { ...DEFAULT_FREE_PATH_PERSONA, stopAtFirstPrestige: false },
      120,
    );
    const target = GOAL_TIERS.flatMap((t) => t.goals).find(
      (g) => g.id === "t5-lifetime",
    )!.target;
    const day = report.perDay.find((d) => d.lifetime >= target)?.day;
    expect(day).toBeDefined();
    expect(day).toBeLessThanOrEqual(100);
  });
});

describe("interval-to-next-purchase metric (economy:interval-metric, pass 19)", () => {
  it("records every shopping-policy buy in order, with a stable kind vocab", () => {
    const report = simulateFreePath();
    expect(report.purchases.length).toBeGreaterThan(0);
    for (let i = 0; i < report.purchases.length; i++) {
      const p = report.purchases[i];
      expect(ALL_PURCHASE_KINDS).toContain(p.kind);
      // Absolute timeline: (day - 1) * 86_400 + session second.
      expect(p.at).toBe((p.day - 1) * 86_400 + (p.at % 86_400));
      expect(p.at % 86_400).toBeGreaterThanOrEqual(1);
      expect(p.at % 86_400).toBeLessThanOrEqual(
        DEFAULT_FREE_PATH_PERSONA.activeSecondsPerDay,
      );
      if (i > 0) {
        // non-strict: a shopping pass can buy several lines in one second
        expect(p.at).toBeGreaterThanOrEqual(report.purchases[i - 1].at);
      }
    }
  });

  it("summarizePacing: degenerate inputs and min ≤ median ≤ max", () => {
    expect(summarizePacing([])).toEqual({
      count: 0,
      minSec: 0,
      medianSec: 0,
      maxSec: 0,
    });
    const one: FreePathPurchase[] = [{ at: 100, day: 1, kind: "miner" }];
    expect(summarizePacing(one).count).toBe(0);
    // gaps: 30, then 2*86_400 + 500 (a night-crossing wait).
    const s = summarizePacing([
      { at: 0, day: 1, kind: "miner" },
      { at: 30, day: 1, kind: "miner" },
      { at: 30 + 2 * 86_400 + 500, day: 3, kind: "gemMint" },
    ]);
    expect(s.count).toBe(2);
    expect(s.minSec).toBe(30);
    expect(s.maxSec).toBe(2 * 86_400 + 500);
    // Even count: the mean of the two middles.
    expect(s.medianSec).toBe((30 + (2 * 86_400 + 500)) / 2);
  });

  it("the pass-8 invariant, committed: cheap buys stay cheap, the max wait stretches as lines cap (60-day run)", () => {
    // The D18→D60 pacing wall is income saturation (all gem lines capped),
    // not the cost curve — measurable now that the sim records the buys.
    const report = simulateFreePath(
      { ...DEFAULT_FREE_PATH_PERSONA, stopAtFirstPrestige: false },
      60,
    );
    const early = summarizePacing(purchasesInDays(report.purchases, 1, 10));
    const late = summarizePacing(purchasesInDays(report.purchases, 21, 60));
    // Both halves are still alive (purchases happen in each).
    expect(early.count).toBeGreaterThan(0);
    expect(late.count).toBeGreaterThan(0);
    // In-window *medians* are dominated by same-second shopping bursts (they
    // stay ~1s), so the committed invariant is on the MAX: as the cheap lines
    // (pickaxes, click power, miners) cap out, the longest waits stretch by
    // orders of magnitude (measured: ~80ks on D1-5 → ~177ks by D1-20 →
    // ~513ks by D60, hoarding for the next capped line), while the cheap
    // lines keep the min bounded in every window.
    expect(late.maxSec).toBeGreaterThan(early.maxSec);
    expect(late.minSec).toBeLessThan(3600);
  });

  it("dev readout: print the interval-to-next-purchase table (60-day run)", () => {
    // The pass-19 "dev-only script", jest-flavored: run with
    // `pnpm test freePath` and read the table — per-day count/min/median
    // gaps between the persona's buys, in simulated seconds (nights
    // included).
    const report = simulateFreePath(
      { ...DEFAULT_FREE_PATH_PERSONA, stopAtFirstPrestige: false },
      60,
    );
    console.log("interval-to-next-purchase (simulated seconds, nights in):");
    for (let d = 1; d <= 60; d++) {
      const s = summarizePacing(purchasesInDays(report.purchases, d, d));
      if (s.count === 0) continue;
      console.log(
        `  D${String(d).padStart(2)}  n=${s.count}  min=${s.minSec}s  median=${s.medianSec}s  max=${s.maxSec}s`,
      );
    }
    expect(report.purchases.length).toBeGreaterThan(0);
  });
});
