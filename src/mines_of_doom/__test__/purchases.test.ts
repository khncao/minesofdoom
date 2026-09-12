/**
 * Audit of the purchase / spend transaction layer (gap audit pass 63):
 * invariants of the cost curves, the per-line unlock gates of buy-all,
 * and the exactness of computeBuyAll totals against per-level costs.
 */
import {
  GEM_CHANCE_MAX_LEVELS,
  CLICK_BOOST_MAX_LEVELS,
  COMBO_RESIST_MAX_LEVELS,
  computeBuyAll,
  getClickUpgradeCost,
  getComboResistCost,
  getFastMinerCost,
  getGemChanceCost,
  getLegendaryMinerCost,
  getMinerPowerUpgradeCost,
  getMinerUpgradeCost,
  getClickBoostCost,
  type PurchaseAffordability,
} from "src/mines_of_doom/game";

const ALL_IDS = new Set<
  | "power"
  | "minerPower"
  | "miner"
  | "fastMiner"
  | "legendaryMiner"
  | "gemChance"
  | "clickBoost"
  | "comboResist"
>([
  "power",
  "minerPower",
  "miner",
  "fastMiner",
  "legendaryMiner",
  "gemChance",
  "clickBoost",
  "comboResist",
]);

function state(
  over: Partial<PurchaseAffordability> = {},
): PurchaseAffordability {
  return {
    minerals: 1n,
    gems: 0,
    clickPower: 0,
    minerPower: 0,
    miners: 0,
    fastMiners: 0,
    legendaryMiners: 0,
    gemChanceLevels: 0,
    clickBoostLevels: 0,
    comboResistLevels: 0,
    prestigeLevel: 0,
    lifetimeMinerals: 0n,
    minerPowerUnlocked: true,
    fastMinerUnlocked: true,
    legendaryMinerUnlocked: true,
    prestigeUnlocked: true,
    gemsBoughtWithMinerals: 0,
    ...over,
  };
}

describe("cost curves (transaction invariants)", () => {
  const curves: Record<string, (level: number) => number> = {
    click: getClickUpgradeCost,
    miner: getMinerUpgradeCost,
    fast: getFastMinerCost,
    legendary: getLegendaryMinerCost,
    minerPower: getMinerPowerUpgradeCost,
    gemChance: getGemChanceCost,
    clickBoost: getClickBoostCost,
    comboResist: getComboResistCost,
  };
  it("are strictly increasing at 1000 levels + random probes up to 1e6", () => {
    for (const f of Object.values(curves)) {
      let prev = -Infinity;
      for (let i = 0; i < 1000; i++) {
        const v = f(i);
        expect(v).toBeGreaterThan(prev);
        prev = v;
      }
      for (let i = 0; i < 200; i++) {
        const j = Math.floor(Math.random() * 1e6);
        expect(f(j + 1)).toBeGreaterThan(f(j));
      }
    }
  });
  it("costs are finite and non-negative", () => {
    for (const f of Object.values(curves)) {
      for (const lvl of [0, 1, 10, 100, 1000, 1e6]) {
        const v = f(lvl);
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("game-start cost states (audit: free first upgrades are by design)", () => {
  // createGameData starts at clickPower 1 and minerPower 0, so the
  // level-0 costs getClickUpgradeCost(0) = 0 and getMinerPowerUpgradeCost(0) = 0
  // are never charged from a fresh save — the first miner-power upgrade is
  // the onboarding freebie.
  it("click upgrade costs from the real starting level are positive", () => {
    for (const lvl of [1, 2, 3, 10, 100, 1000]) {
      expect(getClickUpgradeCost(lvl)).toBeGreaterThan(0);
    }
  });
  it("miner-power costs are zero only at the free level 0", () => {
    expect(getMinerPowerUpgradeCost(0)).toBe(0);
    expect(getMinerPowerUpgradeCost(1)).toBeGreaterThan(0);
  });
  it("miner/gem-line costs from count 0 are positive (never a free buy)", () => {
    for (const f of [
      getMinerUpgradeCost,
      getFastMinerCost,
      getLegendaryMinerCost,
      getGemChanceCost,
      getClickBoostCost,
      getComboResistCost,
    ]) {
      expect(f(0)).toBeGreaterThan(0);
    }
  });
});

describe("computeBuyAll exactness", () => {
  it("totalCost equals the exact per-level cost sum and never overruns the budget", () => {
    for (let trial = 0; trial < 400; trial++) {
      const gems = Math.floor(Math.random() * 1e7);
      const minerals = BigInt(Math.floor(Math.random() * 1e9));
      const s = state({ gems, minerals });
      for (const cur of ["minerals", "gems"] as const) {
        const p = computeBuyAll(cur, s, ALL_IDS);
        let sum = 0;
        sum += Array.from({ length: p.clickPower }, (_, i) =>
          getClickUpgradeCost(s.clickPower + i),
        ).reduce((a, b) => a + b, 0);
        sum += Array.from({ length: p.minerPower }, (_, i) =>
          getMinerPowerUpgradeCost(s.minerPower + i),
        ).reduce((a, b) => a + b, 0);
        if (cur === "gems") {
          sum += Array.from({ length: p.miners }, (_, i) =>
            getMinerUpgradeCost(s.miners + i),
          ).reduce((a, b) => a + b, 0);
          sum += Array.from({ length: p.fastMiners }, (_, i) =>
            getFastMinerCost(s.fastMiners + i),
          ).reduce((a, b) => a + b, 0);
          sum += Array.from({ length: p.legendaryMiners }, (_, i) =>
            getLegendaryMinerCost(s.legendaryMiners + i),
          ).reduce((a, b) => a + b, 0);
          sum += Array.from({ length: p.gemChance }, (_, i) =>
            getGemChanceCost(s.gemChanceLevels + i),
          ).reduce((a, b) => a + b, 0);
          sum += Array.from({ length: p.clickBoost }, (_, i) =>
            getClickBoostCost(s.clickBoostLevels + i),
          ).reduce((a, b) => a + b, 0);
          sum += Array.from({ length: p.comboResist }, (_, i) =>
            getComboResistCost(s.comboResistLevels + i),
          ).reduce((a, b) => a + b, 0);
        }
        expect(p.totalCost).toBe(sum);
        const budget = BigInt(cur === "minerals" ? minerals : gems);
        expect(BigInt(sum)).toBeLessThanOrEqual(budget);
      }
    }
  });

  it("respects line caps even with unlimited budget", () => {
    const p = computeBuyAll("gems", state({ gems: 1e12 }), ALL_IDS);
    expect(p.gemChance).toBeLessThanOrEqual(GEM_CHANCE_MAX_LEVELS);
    expect(p.clickBoost).toBeLessThanOrEqual(CLICK_BOOST_MAX_LEVELS);
    expect(p.comboResist).toBeLessThanOrEqual(COMBO_RESIST_MAX_LEVELS);
  });

  it("never buys a line whose goal-tier unlock is closed (showAllPurchases visible set)", () => {
    const s = state({
      gems: 1e12,
      minerals: 10n ** 12n,
      minerPowerUnlocked: false,
      fastMinerUnlocked: false,
      legendaryMinerUnlocked: false,
      prestigeUnlocked: false,
    });
    const pMin = computeBuyAll("minerals", s, ALL_IDS);
    expect(pMin.minerPower).toBe(0);
    const pGem = computeBuyAll("gems", s, ALL_IDS);
    expect(pGem.fastMiners).toBe(0);
    expect(pGem.legendaryMiners).toBe(0);
    expect(pGem.gemChance).toBe(0);
    expect(pGem.clickBoost).toBe(0);
    expect(pGem.comboResist).toBe(0);
  });

  it("excludes the buy-a-gem conversion from the minerals group", () => {
    const p = computeBuyAll(
      "minerals",
      state({ minerals: 10n ** 12n }),
      ALL_IDS,
    );
    // only clickPower + minerPower lines exist in the minerals group
    expect(p.totalLevels).toBe(p.clickPower + p.minerPower);
  });
});
