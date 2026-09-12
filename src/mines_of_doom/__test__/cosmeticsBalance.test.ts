import {
  CAVE_THEMES,
  DEFAULT_CAVE_THEME,
  DEFAULT_OUTFIT,
  DEFAULT_PICKAXE,
  OUTFITS,
  PICKAXES,
} from "../cosmetics";
import { DEFAULT_FREE_PATH_PERSONA, simulateFreePath } from "../freePath";

/** Sum of every paid cosmetic (outfits + pickaxes + cave themes). */
function fullCollectionCost(): number {
  return (
    OUTFITS.filter((o) => o.id !== DEFAULT_OUTFIT).reduce(
      (a, o) => a + o.costGems,
      0,
    ) +
    PICKAXES.filter((p) => p.id !== DEFAULT_PICKAXE).reduce(
      (a, p) => a + p.costGems,
      0,
    ) +
    CAVE_THEMES.filter((t) => t.id !== DEFAULT_CAVE_THEME).reduce(
      (a, t) => a + t.costGems,
      0,
    )
  );
}

describe("cosmetic pricing vs. the free gem economy (guardrail 1: F2P viable)", () => {
  it("a full free collection is earnable within a 45-day free-player horizon", () => {
    // The persona plays past prestige (no early stop) so the horizon
    // reflects a dedicated free player's total gem faucet, not just the
    // first run. Income must cover the whole collection on top of everything
    // the persona already sinks into miners/upgrades.
    //
    // 45 days (was 30): the escalating mineral→gem price (todo "gems
    // should be rarer…") self-limits the mint button after ~40 lifetime
    // buys, so drops carry the faucet now and the full collection
    // crosses the cost between day 42 and day 45 (deterministic persona:
    // 1634 at day 42, 1782 at day 45 vs the 1675 collection cost). This
    // keeps guardrail 1 — free players reach the same end-state, only
    // slower — while the intended scarcity is in effect. A future change
    // that pushes the crossover past 45 days fails this test on purpose.
    const report = simulateFreePath(
      { ...DEFAULT_FREE_PATH_PERSONA, stopAtFirstPrestige: false },
      45,
    );
    const totalGemsEarned = report.gemGains.drops + report.gemGains.mints;
    expect(totalGemsEarned).toBeGreaterThan(0);
    expect(fullCollectionCost()).toBeLessThanOrEqual(totalGemsEarned);
  });

  it("cosmetics are a late-game sink, not an early-game one", () => {
    // The full collection must cost clearly MORE than a first-prestige run
    // earns in gems, so the rebalance (plan: "increase gem cost of
    // cosmetics") can't be reverted to prices that compete with the miner
    // purchase line in the first days of the game.
    const firstRun = simulateFreePath();
    expect(firstRun.reached).toBe(true);
    const firstRunGems = firstRun.gemGains.drops + firstRun.gemGains.mints;
    expect(fullCollectionCost()).toBeGreaterThan(4 * firstRunGems);
  });
});
