import {
  DEFAULT_FREE_PATH_PERSONA,
  FREE_PATH_TARGET,
  simulateFreePath,
} from "../freePath";

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
});
