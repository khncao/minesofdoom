import {
  CAVE_THEMES,
  DEFAULT_CAVE_THEME,
  DEFAULT_OUTFIT,
  DEFAULT_PICKAXE,
  DEFAULT_SKIN,
  OUTFITS,
  PICKAXES,
  SKINS,
} from "../cosmetics";
import { DEFAULT_FREE_PATH_PERSONA, simulateFreePath } from "../freePath";

/**
 * Sum of every PAID cosmetic — outfits + pickaxes + cave themes + skins.
 *
 * EVERY line counts, which is the whole point: a line left out of this sum
 * is money the guardrail silently stops watching (the skin line shipped
 * after this sum was written, and adding it here is what moved the horizon
 * below). Cash store prices are NOT part of this test — they follow the
 * depth tiers in cosmetics.CASH_PRICE_USD and are checked by the iaps
 * tests.
 */
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
    ) +
    SKINS.filter((k) => k.id !== DEFAULT_SKIN).reduce(
      (a, k) => a + k.costGems,
      0,
    )
  );
}

/** The free-player horizon the full collection has to fit inside. */
const FULL_COLLECTION_HORIZON_DAYS = 75;

describe("cosmetic pricing vs. the free gem economy (guardrail 1: F2P viable)", () => {
  it("a full free collection is earnable within a 75-day free-player horizon", () => {
    // The persona plays past prestige (no early stop) so the horizon
    // reflects a dedicated free player's total gem faucet, not just the
    // first run. Income must cover the whole collection on top of everything
    // the persona already sinks into miners/upgrades.
    //
    // 75 days (was 45, was 30): the escalating mineral→gem price (todo
    // "gems should be rarer…") self-limits the mint button after ~40
    // lifetime buys, so drops carry the faucet (deterministic persona:
    // 1806 gems at day 45, 2633 at day 60, 3468 at day 75).
    //
    // The horizon moved because the catalog grew, and that is the decision
    // this test exists to force: the skin line (+770) and the four tools
    // that came with the pickaxe shape axis (+320) took the collection from
    // 1675 to 2765 — past what a 45-day player earns. Cosmetic prices are
    // pure sinks, so the trade-off is "a longer completion horizon" vs
    // "cheaper cosmetics"; the horizon was moved because the prices track
    // the rest of the line. Guardrail 1 is intact either way: cosmetics
    // never gate progress, only the wallet. A future change that pushes the
    // crossover past 75 days fails this test on purpose.
    const report = simulateFreePath(
      { ...DEFAULT_FREE_PATH_PERSONA, stopAtFirstPrestige: false },
      FULL_COLLECTION_HORIZON_DAYS,
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
