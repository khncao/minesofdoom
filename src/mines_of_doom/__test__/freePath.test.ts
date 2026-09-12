import {
  DEFAULT_FREE_PATH_PERSONA,
  FREE_PATH_TARGET,
  simulateFreePath,
} from "../freePath";
import { GOAL_TIERS } from "../goals";

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
