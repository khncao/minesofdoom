import {
  CLICK_BOOST_MAX_LEVELS,
  COMBO_RESIST_MAX_LEVELS,
  COMBO_TIER_SIZE,
  DEPTH_TIERS,
  GEM_CHANCE_MAX_LEVELS,
  computeOfflineMinerals,
  computeOfflineTopUpMinerals,
  createEmptySaveData,
  gemChancePerLevel,
  getClickUpgradeCost,
  getDepth,
  getDepthTier,
  getDepthTierProgress,
  FINAL_TIER_PROGRESS_SPAN,
  getFastMinerCost,
  getClickBoostCost,
  getClickBoostMultiplier,
  getComboMultiplier,
  getComboResistCost,
  getComboTierProgress,
  getComboRetention,
  getResistantComboReset,
  getFastMinerOutput,
  getGemChance,
  getGemChanceCost,
  getLegendaryMinerCost,
  getLegendaryMinerOutput,
  comboResistRetentionPerLevel,
  getMineralsPerSec,
  getMinerPowerUpgradeCost,
  getMinerUpgradeCost,
  getPrestigeLevel,
  getPrestigeMultiplier,
  lifetimeDelta,
  maxOfflineTicks,
  PRESTIGE_LEVELS,
  migrateSaveData,
  msPerTick,
  offlineTopUpTicks,
  saveVersion,
  ALL_PURCHASE_IDS,
  ALWAYS_VISIBLE_PURCHASES,
  defaultSettingsData,
  getVisiblePurchases,
} from "../game";
import type { PurchaseId } from "../game";
import { DEFAULT_CAVE_THEME, DEFAULT_CAVE_TINTS } from "../cosmetics";
import { Equation, Ops } from "src/utils/math/equations";
import {
  HARD_MODE_PAYOUT,
  STREAK_MODE_PAYOUT,
  STREAK_MODE_THRESHOLD,
  TIMED_MODE_PAYOUT,
  TIMED_MODE_WINDOW_MS,
  getAnswerPayoutMultiplier,
  getEquationOpBonus,
  getOpPayoutMultiplier,
  getStreakPayoutMultiplier,
} from "../game";

describe("cost curves", () => {
  test("click upgrade cost", () => {
    expect(getClickUpgradeCost(1)).toBe(1);
    expect(getClickUpgradeCost(2)).toBe(16);
    expect(getClickUpgradeCost(5)).toBe(625);
    // Strictly increasing
    let prev = 0;
    for (let lvl = 1; lvl <= 50; lvl++) {
      const c = getClickUpgradeCost(lvl);
      expect(c).toBeGreaterThan(prev);
      prev = c;
    }
  });

  test("miner cost", () => {
    expect(getMinerUpgradeCost(0)).toBe(1);
    expect(getMinerUpgradeCost(1)).toBe(2);
    expect(getMinerUpgradeCost(10)).toBe(10001);
  });

  test("fast miner cost: cheaper curve than normal miners, strictly increasing", () => {
    expect(getFastMinerCost(0)).toBe(1);
    expect(getFastMinerCost(1)).toBe(2);
    expect(getFastMinerCost(2)).toBe(11);
    expect(getFastMinerCost(10)).toBe(1831);
    // Cheaper than a normal miner at every count (the whole point of the
    // second type: better gem efficiency, weaker per-miner output).
    let prev = 0;
    for (let n = 0; n < 100; n++) {
      const c = getFastMinerCost(n);
      expect(c).toBeGreaterThan(prev);
      expect(c).toBeLessThanOrEqual(getMinerUpgradeCost(n));
      prev = c;
    }
  });

  test("legendary miner cost: 2*(n+1)^4, strictly increasing, above every other type", () => {
    expect(getLegendaryMinerCost(0)).toBe(2);
    expect(getLegendaryMinerCost(1)).toBe(32);
    expect(getLegendaryMinerCost(2)).toBe(162);
    expect(getLegendaryMinerCost(10)).toBe(29282);
    let prev = 0;
    for (let n = 0; n < 100; n++) {
      const c = getLegendaryMinerCost(n);
      expect(c).toBeGreaterThan(prev);
      // The endgame sink: pricier than a normal miner and than a fast miner
      // at every count (same quartic family, steepest curve).
      expect(c).toBeGreaterThanOrEqual(getMinerUpgradeCost(n));
      expect(c).toBeGreaterThanOrEqual(getFastMinerCost(n));
      expect(c).toBe(Math.max(1, Math.ceil(2 * (n + 1) ** 4)));
      prev = c;
    }
  });

  test("gem chance cost: 10*(level+1)^2, strictly increasing", () => {
    expect(getGemChanceCost(0)).toBe(10);
    expect(getGemChanceCost(1)).toBe(40);
    expect(getGemChanceCost(2)).toBe(90);
    let prev = 0;
    for (let lvl = 0; lvl <= 20; lvl++) {
      const c = getGemChanceCost(lvl);
      expect(c).toBeGreaterThan(prev);
      prev = c;
    }
  });

  test("miner power upgrade cost", () => {
    expect(getMinerPowerUpgradeCost(1)).toBe(1000);
    expect(getMinerPowerUpgradeCost(10)).toBe(100000);
    // Strictly increasing
    let prev = 0;
    for (let p = 1; p <= 50; p++) {
      const c = getMinerPowerUpgradeCost(p);
      expect(c).toBeGreaterThan(prev);
      prev = c;
    }
  });
});

describe("getDepthTier", () => {
  test("boundaries", () => {
    expect(getDepthTier(0).id).toBe(0);
    expect(getDepthTier(9).id).toBe(0);
    expect(getDepthTier(10).id).toBe(1);
    expect(getDepthTier(49).id).toBe(1);
    expect(getDepthTier(50).id).toBe(2);
    expect(getDepthTier(150).id).toBe(3);
    expect(getDepthTier(500).id).toBe(4);
    expect(getDepthTier(10000).id).toBe(4); // no tier above the last
  });

  test("click bonus is non-decreasing with depth", () => {
    let prev = 0;
    for (let d = 0; d <= 1000; d += 7) {
      const bonus = getDepthTier(d).clickBonus;
      expect(bonus).toBeGreaterThanOrEqual(prev);
      prev = bonus;
    }
  });
});

describe("fast miner output", () => {
  test("weaker than a normal miner at every power level", () => {
    expect(getFastMinerOutput(1)).toBe(1); // floor(1/2)=0, clamped to 1
    expect(getFastMinerOutput(2)).toBe(1);
    expect(getFastMinerOutput(3)).toBe(1);
    expect(getFastMinerOutput(4)).toBe(2);
    expect(getFastMinerOutput(10)).toBe(5);
    // At power >= 2 strictly weaker; never above a normal miner.
    let prevPower = 1;
    for (let p = 2; p <= 100; p++) {
      expect(getFastMinerOutput(p)).toBeLessThan(p);
      expect(getFastMinerOutput(p)).toBeGreaterThanOrEqual(
        getFastMinerOutput(prevPower),
      );
      prevPower = p;
    }
  });
});

describe("legendary miner output", () => {
  test("exactly double a normal miner at every power level", () => {
    expect(getLegendaryMinerOutput(1)).toBe(2);
    expect(getLegendaryMinerOutput(2)).toBe(4);
    expect(getLegendaryMinerOutput(10)).toBe(20);
    for (let p = 1; p <= 100; p++) {
      expect(getLegendaryMinerOutput(p)).toBe(2 * p);
      // Always strictly stronger than a fast miner (the premium type).
      expect(getLegendaryMinerOutput(p)).toBeGreaterThan(
        getFastMinerOutput(p),
      );
    }
  });
});

describe("getMineralsPerSec", () => {
  test("normal miners only", () => {
    expect(getMineralsPerSec(2, 3, 0)).toBe(6);
    expect(getMineralsPerSec(0, 99, 0)).toBe(0);
  });

  test("fast miners only", () => {
    // 2 fast miners at power 3: output max(1, floor(3/2)) = 1 each
    expect(getMineralsPerSec(0, 3, 2)).toBe(2);
  });

  test("both types combine additively", () => {
    // 1 normal @ power 2 + 1 fast @ output 1 = 3
    expect(getMineralsPerSec(1, 2, 1)).toBe(3);
    // 2 normal @ power 4 + 3 fast @ output 2 = 8 + 6
    expect(getMineralsPerSec(2, 4, 3)).toBe(14);
  });

  test("legendary miners add their double output (third type)", () => {
    // 2 legendary @ power 3: output 6 each = 12
    expect(getMineralsPerSec(0, 3, 0, 2)).toBe(12);
    // 1 normal @ power 2 + 1 fast @ output 1 + 2 legendary @ output 4 = 2+1+8
    expect(getMineralsPerSec(1, 2, 1, 2)).toBe(11);
    // Defaulted argument keeps old call sites source-compatible.
    expect(getMineralsPerSec(1, 2, 1)).toBe(3);
  });
});

describe("gem chance upgrade", () => {
  test("base chance at level 0, +1% per level, capped at 20", () => {
    expect(getGemChance(0)).toBeCloseTo(0.05);
    expect(getGemChance(1)).toBeCloseTo(0.05 + gemChancePerLevel);
    expect(getGemChance(5)).toBeCloseTo(0.05 + 5 * gemChancePerLevel);
    expect(getGemChance(GEM_CHANCE_MAX_LEVELS)).toBeCloseTo(0.25);
    // Over-cap levels don't stack past the cap.
    expect(getGemChance(GEM_CHANCE_MAX_LEVELS + 5)).toBe(
      getGemChance(GEM_CHANCE_MAX_LEVELS),
    );
  });
});

describe("click boost upgrade (tier-3 gem line)", () => {
  test("multiplier doubles per level, clamped at the cap", () => {
    expect(getClickBoostMultiplier(0)).toBe(1);
    expect(getClickBoostMultiplier(1)).toBe(2);
    expect(getClickBoostMultiplier(2)).toBe(4);
    expect(getClickBoostMultiplier(CLICK_BOOST_MAX_LEVELS)).toBe(
      2 ** CLICK_BOOST_MAX_LEVELS,
    );
    // Over-cap levels don't stack past the cap.
    expect(getClickBoostMultiplier(CLICK_BOOST_MAX_LEVELS + 5)).toBe(
      getClickBoostMultiplier(CLICK_BOOST_MAX_LEVELS),
    );
    // Negative/junk levels behave like level 0.
    expect(getClickBoostMultiplier(-3)).toBe(1);
  });

  test("cost is 25*(level+1)^2, strictly increasing to the cap", () => {
    expect(getClickBoostCost(0)).toBe(25);
    expect(getClickBoostCost(1)).toBe(100);
    expect(getClickBoostCost(2)).toBe(225);
    let prev = 0;
    for (let lvl = 0; lvl < CLICK_BOOST_MAX_LEVELS; lvl++) {
      const c = getClickBoostCost(lvl);
      expect(c).toBeGreaterThan(prev);
      prev = c;
    }
  });
});

describe("combo multiplier tiers", () => {
  test("multiplier is 1 + floor(combo / tier size)", () => {
    expect(getComboMultiplier(0)).toBe(1);
    expect(getComboMultiplier(COMBO_TIER_SIZE - 1)).toBe(1);
    expect(getComboMultiplier(COMBO_TIER_SIZE)).toBe(2);
    expect(getComboMultiplier(2 * COMBO_TIER_SIZE + 3)).toBe(3);
  });

  test("tier progress: fraction in [0, 1), untilNext and next tier correct",
    () => {
      // Mid-tier: 7 of 10 in, 3 to go, next is x2.
      expect(getComboTierProgress(7)).toEqual({
        fraction: 0.7,
        untilNext: 3,
        nextMultiplier: 2,
      });
      // Tier boundary: 10 is the start of the x2 tier, full tier to go.
      expect(getComboTierProgress(10)).toEqual({
        fraction: 0,
        untilNext: COMBO_TIER_SIZE,
        nextMultiplier: 3,
      });
      // Zero combo: empty bar, first tier is x2.
      expect(getComboTierProgress(0)).toEqual({
        fraction: 0,
        untilNext: COMBO_TIER_SIZE,
        nextMultiplier: 2,
      });
      // One away from a step-up.
      expect(getComboTierProgress(19)).toEqual({
        fraction: 0.9,
        untilNext: 1,
        nextMultiplier: 3,
      });
    });
});

describe("combo resistance (tier-3 gem line)", () => {
  test("retention is +10% per level, capped at 50%", () => {
    expect(getComboRetention(0)).toBe(0);
    expect(getComboRetention(1)).toBeCloseTo(comboResistRetentionPerLevel);
    expect(getComboRetention(3)).toBeCloseTo(3 * comboResistRetentionPerLevel);
    expect(getComboRetention(COMBO_RESIST_MAX_LEVELS)).toBeCloseTo(0.5);
    // Over-cap levels keep no more than the cap.
    expect(getComboRetention(COMBO_RESIST_MAX_LEVELS + 9)).toBe(
      getComboRetention(COMBO_RESIST_MAX_LEVELS),
    );
  });

  test("reset keeps the floored retained fraction, always in [0, combo]", () => {
    // Level 0 behaves exactly like the old zeroing reset.
    expect(getResistantComboReset(77, 0)).toBe(0);
    // 10% of 13 = 1.3 -> 1.
    expect(getResistantComboReset(13, 1)).toBe(1);
    // Below 10 combo, even 10% floors to 0.
    expect(getResistantComboReset(9, 1)).toBe(0);
    // Half the combo at the cap (floored).
    expect(getResistantComboReset(41, COMBO_RESIST_MAX_LEVELS)).toBe(20);
    for (let combo = 0; combo <= 1000; combo += 37) {
      for (let lvl = 0; lvl <= COMBO_RESIST_MAX_LEVELS + 2; lvl++) {
        const kept = getResistantComboReset(combo, lvl);
        expect(kept).toBeGreaterThanOrEqual(0);
        expect(kept).toBeLessThanOrEqual(combo);
      }
    }
  });

  test("more resistance never keeps less of the combo", () => {
    for (let combo = 0; combo <= 500; combo += 11) {
      let prevKept = 0;
      for (let lvl = 0; lvl <= COMBO_RESIST_MAX_LEVELS; lvl++) {
        const kept = getResistantComboReset(combo, lvl);
        expect(kept).toBeGreaterThanOrEqual(prevKept);
        prevKept = kept;
      }
    }
  });

  test("cost is 20*(level+1)^2, strictly increasing to the cap", () => {
    expect(getComboResistCost(0)).toBe(20);
    expect(getComboResistCost(1)).toBe(80);
    let prev = 0;
    for (let lvl = 0; lvl < COMBO_RESIST_MAX_LEVELS; lvl++) {
      const c = getComboResistCost(lvl);
      expect(c).toBeGreaterThan(prev);
      prev = c;
    }
  });
});

describe("prestige (New Shaft)", () => {
  test("getPrestigeLevel: banked level from lifetime thresholds", () => {
    expect(getPrestigeLevel(0)).toBe(0);
    expect(getPrestigeLevel(4_999_999)).toBe(0); // just under the first rung
    expect(getPrestigeLevel(5_000_000)).toBe(1);
    expect(getPrestigeLevel(49_999_999)).toBe(1);
    expect(getPrestigeLevel(50_000_000)).toBe(2);
    expect(getPrestigeLevel(1_000_000_000)).toBe(4);
    expect(getPrestigeLevel(5_000_000_000)).toBe(5);
    // Past the top rung it stays clamped to the highest level.
    expect(getPrestigeLevel(Number.MAX_SAFE_INTEGER)).toBe(
      PRESTIGE_LEVELS.length - 1,
    );
  });

  test("getPrestigeLevel: lifetime only ever raises (never lowers)", () => {
    // Monotonic — spending minerals can't un-bank a level.
    let prev = 0;
    for (let life = 0; life <= 10_000_000_000; life += 1_234_567) {
      const lvl = getPrestigeLevel(life);
      expect(lvl).toBeGreaterThanOrEqual(prev);
      prev = lvl;
    }
  });

  test("getPrestigeMultiplier: values match the table and clamp", () => {
    expect(getPrestigeMultiplier(0)).toBe(1);
    expect(getPrestigeMultiplier(1)).toBe(1.5);
    expect(getPrestigeMultiplier(2)).toBe(2);
    expect(getPrestigeMultiplier(5)).toBe(5);
    // Below-0 and over-table indices clamp to the ends, never crash.
    expect(getPrestigeMultiplier(-3)).toBe(getPrestigeMultiplier(0));
    expect(getPrestigeMultiplier(999)).toBe(getPrestigeMultiplier(5));
  });

  test("multipliers are non-decreasing and >= 1 across the whole table", () => {
    let prev = 1;
    for (const p of PRESTIGE_LEVELS) {
      expect(p.multiplier).toBeGreaterThanOrEqual(prev);
      expect(p.multiplier).toBeGreaterThanOrEqual(1);
      prev = p.multiplier;
    }
  });
});

describe("lifetimeDelta", () => {
  const save = () => createEmptySaveData();

  test("tracks gains and re-derives maxDepth", () => {
    const d = lifetimeDelta(save(), { minerals: 5500 });
    expect(d.lifetimeMinerals).toBe(5500n);
    expect(d.maxDepth).toBe(11n);
  });

  test("maxCombo only ever increases", () => {
    const s = { ...save(), maxCombo: 42 };
    expect(lifetimeDelta(s, { combo: 10 }).maxCombo).toBe(42);
    expect(lifetimeDelta(s, { combo: 43 }).maxCombo).toBe(43);
  });

  test("no deltas is a no-op", () => {
    const s = { ...save(), maxCombo: 7, maxDepth: 3n };
    const d = lifetimeDelta(s, {});
    expect(d.lifetimeMinerals).toBe(0n);
    expect(d.maxCombo).toBe(7);
    expect(d.maxDepth).toBe(3n);
    expect(d.minersOwnedEver).toBe(0);
    expect(d.totalGemsMinted).toBe(0);
  });

  test("maxDepth derives from lifetime mining, not the mineral balance", () => {
    // The player has mined 10,000 (depth 20) and spent all but 0 — the old
    // balance-based rule would have dropped the depth to 0 on the spend.
    const spent = { ...save(), minerals: 0n, lifetimeMinerals: 10_000n };
    expect(lifetimeDelta(spent, {}).maxDepth).toBe(20n);
    // A further gain extends it from the lifetime total.
    expect(lifetimeDelta(spent, { minerals: 500 }).maxDepth).toBe(21n);
  });
});

describe("getDepth", () => {
  test("depth = floor(minerals / 500)", () => {
    expect(getDepth(0)).toBe(0n);
    expect(getDepth(499)).toBe(0n);
    expect(getDepth(500)).toBe(1n);
    expect(getDepth(1234)).toBe(2n);
    expect(getDepth(100000)).toBe(200n);
  });
});

describe("computeOfflineMinerals", () => {
  const now = 1_000_000_000;

  test("no miners of any type / zero saveTime / no elapsed time => 0", () => {
    expect(computeOfflineMinerals(0, 5, 0, now - 100_000, now)).toBe(0n);
    expect(computeOfflineMinerals(2, 3, 0, 0, now)).toBe(0n);
    expect(computeOfflineMinerals(2, 3, 0, now, now)).toBe(0n);
    expect(computeOfflineMinerals(2, 3, 0, now + 1000, now)).toBe(0n);
  });

  test("miners x minerPower x elapsed ticks", () => {
    // 10 ticks elapsed: 2 miners * 3 power * 10 = 60
    expect(computeOfflineMinerals(2, 3, 0, now - 10 * msPerTick, now)).toBe(60n);
  });

  test("fast miners contribute their (weaker) output", () => {
    // 10 ticks: 2 normal @ power 3 (6/s) + 3 fast @ output 1 (3/s) = 90
    expect(computeOfflineMinerals(2, 3, 3, now - 10 * msPerTick, now)).toBe(90n);
  });

  test("legendary miners contribute their (double) output", () => {
    // 10 ticks: 1 normal @ power 3 (3/s) + 2 legendary @ output 6 (12/s) = 150
    expect(computeOfflineMinerals(1, 3, 0, now - 10 * msPerTick, now, 1, 2)).toBe(
      150n,
    );
    // Prestige multiplier and legendary miners compose.
    expect(computeOfflineMinerals(1, 3, 0, now - 10 * msPerTick, now, 2, 2)).toBe(
      300n,
    );
  });

  test("caps at maxOfflineTicks (8h)", () => {
    const nineHours = 9 * 3600 * 1000;
    expect(computeOfflineMinerals(2, 3, 3, now - nineHours, now, 1, 4)).toBe(
      BigInt(getMineralsPerSec(2, 3, 3, 4)) * BigInt(maxOfflineTicks),
    );
  });

  test("prestige multiplier scales the offline payout", () => {
    // 10 ticks: 2 miners * 3 power * 10 = 60, x2 banked = 120.
    expect(computeOfflineMinerals(2, 3, 0, now - 10 * msPerTick, now, 2)).toBe(
      120n,
    );
    // Default multiplier (no argument) is 1 — same as before.
    expect(computeOfflineMinerals(2, 3, 0, now - 10 * msPerTick, now)).toBe(60n);
  });
});

describe("computeOfflineTopUpMinerals", () => {
  const now = 1_000_000_000;
  const hour = 3600 * 1000;

  test("zero saveTime / no elapsed time => 0 (nothing to top up)", () => {
    expect(computeOfflineTopUpMinerals(2, 3, 0, 0, now)).toBe(0n);
    expect(computeOfflineTopUpMinerals(2, 3, 0, now, now)).toBe(0n);
    expect(computeOfflineTopUpMinerals(2, 3, 0, now + 1000, now)).toBe(0n);
  });

  test("0 while the away time never hit the 8h cap", () => {
    // 7h59m away — the cap never engaged, so nothing was withheld.
    expect(
      computeOfflineTopUpMinerals(2, 3, 0, now - (maxOfflineTicks - 60) * msPerTick, now),
    ).toBe(0n);
  });

  test("pays the withheld hours once the away time exceeds the cap", () => {
    // 9h away: 1h beyond the cap.
    expect(computeOfflineTopUpMinerals(2, 3, 0, now - 9 * hour, now)).toBe(
      BigInt(getMineralsPerSec(2, 3, 0)) * 3600n,
    );
  });

  test("the top-up itself caps at offlineTopUpTicks (+2h)", () => {
    // 15h away: only 2h beyond the cap are granted.
    expect(computeOfflineTopUpMinerals(2, 3, 0, now - 15 * hour, now)).toBe(
      BigInt(getMineralsPerSec(2, 3, 0)) * BigInt(offlineTopUpTicks),
    );
  });

  test("fast/legendary miners and the prestige multiplier compose", () => {
    // 10h away, 2h beyond the cap, x2 banked.
    expect(
      computeOfflineTopUpMinerals(2, 3, 3, now - 10 * hour, now, 2, 4),
    ).toBe(BigInt(getMineralsPerSec(2, 3, 3, 4)) * BigInt(offlineTopUpTicks) * 2n);
  });
});

describe("migrateSaveData", () => {
  test("legacy save without saveVersion is migrated to current", () => {
    const migrated = migrateSaveData({ minerals: 5, saveTime: 1 });
    expect(migrated.saveVersion).toBe(saveVersion);
    expect(migrated.minerals).toBe(5);
  });

  test("already-current save passes through unchanged", () => {
    const save = { minerals: 42, saveVersion };
    const migrated = migrateSaveData(save);
    expect(migrated).toEqual(save);
  });

  test("invalid saveVersion falls back to 0 and migrates", () => {
    const migrated = migrateSaveData({ saveVersion: "banana" });
    expect(migrated.saveVersion).toBe(saveVersion);
  });

  test("v1 save gains lifetime stats folded in from existing progress", () => {
    const v1 = {
      minerals: 2500,
      gems: 3,
      miners: 4,
      clickPower: 2,
      minerPower: 1,
      saveVersion: 1,
    };
    const migrated = migrateSaveData(v1);
    expect(migrated.saveVersion).toBe(saveVersion);
    // Everything already mined counts toward lifetime minerals, current
    // roster toward miners-owned-ever, current gems toward gems minted.
    expect(migrated.lifetimeMinerals).toBe(2500);
    expect(migrated.maxDepth).toBe(5n); // floor(2500 / 500)
    expect(migrated.minersOwnedEver).toBe(4);
    expect(migrated.totalGemsMinted).toBe(3);
    expect(migrated.lifetimeCorrect).toBe(0);
    expect(migrated.maxCombo).toBe(0);
    expect(migrated.totalPrestiges).toBe(0);
    expect(migrated.completedTiers).toEqual([]);
    // Untouched fields survive
    expect(migrated.minerals).toBe(2500);
    expect(migrated.clickPower).toBe(2);
  });

  test("v1 save with junk completedTiers only keeps strings", () => {
    const migrated = migrateSaveData({
      saveVersion: 1,
      completedTiers: ["t1", 5, null],
    });
    expect(migrated.completedTiers).toEqual(["t1"]);
  });

  test("v2 save gains cosmetics fields (seeded look + free defaults)", () => {
    const v2 = {
      minerals: 100,
      startTime: 1000,
      saveTime: 2000,
      saveVersion: 2,
    };
    const migrated = migrateSaveData(v2);
    expect(migrated.saveVersion).toBe(saveVersion);
    // Seed is deterministic from the save's timestamps (old save, old look).
    expect(migrated.playerSeed).toBe(3000 % 2147483647);
    expect(migrated.ownedCosmetics).toContain("classic");
    expect(migrated.ownedCosmetics).toContain("steel");
    expect(migrated.selectedOutfit).toBe("classic");
    expect(migrated.selectedPickaxe).toBe("steel");
  });

  test("v2 save with owned cosmetics keeps them; selection = first owned in catalog order", () => {
    const migrated = migrateSaveData({
      saveVersion: 2,
      ownedCosmetics: ["goldrush", "gold", "junk-id"],
    });
    expect(migrated.ownedCosmetics).toEqual(
      expect.arrayContaining(["goldrush", "gold", "classic", "steel"]),
    );
    // "classic" comes before "goldrush" in the catalog; "steel" before "gold".
    expect(migrated.selectedOutfit).toBe("classic");
    expect(migrated.selectedPickaxe).toBe("steel");
  });

  test("empty save (all migrations) ends at current version with cosmetics", () => {
    const migrated = migrateSaveData({});
    expect(migrated.saveVersion).toBe(saveVersion);
    expect(typeof migrated.playerSeed).toBe("number");
    expect(migrated.ownedCosmetics).toEqual(
      expect.arrayContaining(["classic", "steel"]),
    );
  });

  test("v3 save gains completedAchievements defaulting to none", () => {
    const migrated = migrateSaveData({ minerals: 1, saveVersion: 3 });
    expect(migrated.saveVersion).toBe(saveVersion);
    expect(migrated.completedAchievements).toEqual([]);
  });

  test("v3 save keeps valid completedAchievements strings, drops junk", () => {
    const migrated = migrateSaveData({
      saveVersion: 3,
      completedAchievements: ["miner-1", 5, null],
    });
    expect(migrated.completedAchievements).toEqual(["miner-1"]);
  });

  test("v4 save gains fastMiners=0 and gemChanceLevels=0", () => {
    const migrated = migrateSaveData({ minerals: 1, saveVersion: 4 });
    expect(migrated.saveVersion).toBe(saveVersion);
    expect(migrated.fastMiners).toBe(0);
    expect(migrated.gemChanceLevels).toBe(0);
  });

  test("v4 save keeps valid fastMiner/gemChance values", () => {
    const migrated = migrateSaveData({
      saveVersion: 4,
      fastMiners: 7,
      gemChanceLevels: 3,
    });
    expect(migrated.fastMiners).toBe(7);
    expect(migrated.gemChanceLevels).toBe(3);
  });

  test("v4 save clamps junk/over-cap values", () => {
    const migrated = migrateSaveData({
      saveVersion: 4,
      fastMiners: "banana",
      gemChanceLevels: 999,
    });
    expect(migrated.fastMiners).toBe(0);
    expect(migrated.gemChanceLevels).toBe(GEM_CHANCE_MAX_LEVELS);
  });

  test("v5 save gains prestigeLevel=0 (hasn't banked a multiplier)", () => {
    const migrated = migrateSaveData({ minerals: 1, saveVersion: 5 });
    expect(migrated.saveVersion).toBe(saveVersion);
    expect(migrated.prestigeLevel).toBe(0);
  });

  test("v5 save keeps a valid banked prestigeLevel", () => {
    const migrated = migrateSaveData({ saveVersion: 5, prestigeLevel: 3 });
    expect(migrated.prestigeLevel).toBe(3);
  });

  test("v5 save clamps junk/over-table prestigeLevel", () => {
    const junk = migrateSaveData({ saveVersion: 5, prestigeLevel: "banana" });
    expect(junk.prestigeLevel).toBe(0);
    const over = migrateSaveData({ saveVersion: 5, prestigeLevel: 999 });
    expect(over.prestigeLevel).toBe(PRESTIGE_LEVELS.length - 1);
    const negative = migrateSaveData({ saveVersion: 5, prestigeLevel: -4 });
    expect(negative.prestigeLevel).toBe(0);
  });

  test("v6 save gains clickBoostLevels=0 and comboResistLevels=0", () => {
    const migrated = migrateSaveData({ minerals: 1, saveVersion: 6 });
    expect(migrated.saveVersion).toBe(saveVersion);
    expect(migrated.clickBoostLevels).toBe(0);
    expect(migrated.comboResistLevels).toBe(0);
  });

  test("v6 save keeps valid tier-3 gem upgrade levels", () => {
    const migrated = migrateSaveData({
      saveVersion: 6,
      clickBoostLevels: 2,
      comboResistLevels: 4,
    });
    expect(migrated.clickBoostLevels).toBe(2);
    expect(migrated.comboResistLevels).toBe(4);
  });

  test("v6 save clamps junk/over-cap tier-3 levels", () => {
    const junk = migrateSaveData({
      saveVersion: 6,
      clickBoostLevels: "banana",
      comboResistLevels: -7,
    });
    expect(junk.clickBoostLevels).toBe(0);
    expect(junk.comboResistLevels).toBe(0);
    const over = migrateSaveData({
      saveVersion: 6,
      clickBoostLevels: 999,
      comboResistLevels: 999,
    });
    expect(over.clickBoostLevels).toBe(CLICK_BOOST_MAX_LEVELS);
    expect(over.comboResistLevels).toBe(COMBO_RESIST_MAX_LEVELS);
  });

  test("v7 save gains the free default cave theme", () => {
    const migrated = migrateSaveData({ minerals: 1, saveVersion: 7 });
    expect(migrated.saveVersion).toBe(saveVersion);
    expect(migrated.ownedCaveThemes).toEqual([DEFAULT_CAVE_THEME]);
    expect(migrated.selectedCaveTheme).toBe(DEFAULT_CAVE_THEME);
  });

  test("v7 save keeps valid owned cave themes and a valid selection", () => {
    const migrated = migrateSaveData({
      saveVersion: 7,
      ownedCaveThemes: ["natural", "amethyst"],
      selectedCaveTheme: "amethyst",
    });
    expect(migrated.ownedCaveThemes).toContain("natural");
    expect(migrated.ownedCaveThemes).toContain("amethyst");
    expect(migrated.selectedCaveTheme).toBe("amethyst");
  });

  test("v8 save gains legendaryMiners=0", () => {
    const migrated = migrateSaveData({ minerals: 1, saveVersion: 8 });
    expect(migrated.saveVersion).toBe(saveVersion);
    expect(migrated.legendaryMiners).toBe(0);
  });

  test("v8 save keeps a valid legendaryMiners count", () => {
    const migrated = migrateSaveData({ saveVersion: 8, legendaryMiners: 7 });
    expect(migrated.legendaryMiners).toBe(7);
  });

  test("v8 save clamps junk/negative legendaryMiners", () => {
    const junk = migrateSaveData({
      saveVersion: 8,
      legendaryMiners: "banana",
    });
    expect(junk.legendaryMiners).toBe(0);
    const negative = migrateSaveData({
      saveVersion: 8,
      legendaryMiners: -4,
    });
    expect(negative.legendaryMiners).toBe(0);
    const floored = migrateSaveData({
      saveVersion: 8,
      legendaryMiners: 3.9,
    });
    expect(floored.legendaryMiners).toBe(3);
  });

  test("v7 save drops junk owned cave theme ids and falls back selection", () => {
    const migrated = migrateSaveData({
      saveVersion: 7,
      ownedCaveThemes: ["banana", 42, "amethyst"],
      selectedCaveTheme: "void-9000",
    });
    expect(migrated.ownedCaveThemes).toEqual(["natural", "amethyst"]);
    expect(migrated.selectedCaveTheme).toBe(DEFAULT_CAVE_THEME);
  });
});

describe("cave themes save fields", () => {
  test("new saves own the free default theme and select it", () => {
    const save = createEmptySaveData();
    expect(save.ownedCaveThemes).toEqual([DEFAULT_CAVE_THEME]);
    expect(save.selectedCaveTheme).toBe(DEFAULT_CAVE_THEME);
  });

  test("the natural theme's palette mirrors DEPTH_TIERS (original look)", () => {
    expect(DEFAULT_CAVE_TINTS).toEqual(DEPTH_TIERS.map((t) => t.tint));
  });
});

describe("createEmptySaveData cosmetics", () => {
  test("new saves own the free defaults and have a valid seed", () => {
    const save = createEmptySaveData();
    expect(save.playerSeed).toBeGreaterThan(0);
    expect(save.ownedCosmetics).toEqual(["classic", "steel"]);
    expect(save.selectedOutfit).toBe("classic");
    expect(save.selectedPickaxe).toBe("steel");
  });
});

describe("createEmptySaveData tier-2 fields", () => {
  test("new saves start with no fast miners and base gem chance", () => {
    const save = createEmptySaveData();
    expect(save.fastMiners).toBe(0);
    expect(save.gemChanceLevels).toBe(0);
  });
});

describe("createEmptySaveData tier-3 fields", () => {
  test("new saves start with no click boost and no combo resistance", () => {
    const save = createEmptySaveData();
    expect(save.clickBoostLevels).toBe(0);
    expect(save.comboResistLevels).toBe(0);
  });
});

describe("createEmptySaveData tier-5 fields", () => {
  test("new saves start with no legendary miners", () => {
    const save = createEmptySaveData();
    expect(save.legendaryMiners).toBe(0);
    expect(save.saveVersion).toBe(saveVersion);
  });
});

// Helper building an equation the same way getRandomEquation does: a 3-term
// hard-mode shape has op2/c set, a soft-mode shape has them undefined.
const mkEq = (op: string, op2?: string): Equation => ({
  op,
  a: 2,
  b: 3,
  c: op2 !== undefined ? 4 : undefined,
  op2,
  answer: 24,
});

describe("operator bonuses (iteration 11: new equation types)", () => {
  test("per-op premiums keep their ordering (÷ ×10 > ² ×4 > % ×3 > − ×2 > +/* ×1)", () => {
    expect(getOpPayoutMultiplier(Ops.div)).toBe(10);
    expect(getOpPayoutMultiplier(Ops.sq)).toBe(4);
    expect(getOpPayoutMultiplier(Ops.pct)).toBe(3);
    expect(getOpPayoutMultiplier(Ops.sub)).toBe(2);
    expect(getOpPayoutMultiplier(Ops.add)).toBe(1);
    expect(getOpPayoutMultiplier(Ops.mult)).toBe(1);
  });

  test("missing-number equations pay a flat ×3 regardless of the base op", () => {
    const mkMissing = (op: string): Equation => ({
      ...mkEq(op),
      missing: true,
    });
    expect(getEquationOpBonus(mkMissing(Ops.add))).toBe(3);
    expect(getEquationOpBonus(mkMissing(Ops.mult))).toBe(3);
    expect(getAnswerPayoutMultiplier(mkMissing(Ops.add))).toBe(3);
    // ...and stack with the other premiums like any other bonus.
    expect(getAnswerPayoutMultiplier(mkMissing(Ops.add), true, true)).toBe(
      3 * TIMED_MODE_PAYOUT * STREAK_MODE_PAYOUT,
    );
  });
});

describe("getAnswerPayoutMultiplier (hard mode, tier-5)", () => {
  test("soft mode keeps the operator bonuses only", () => {
    expect(getAnswerPayoutMultiplier(mkEq(Ops.mult))).toBe(1);
    expect(getAnswerPayoutMultiplier(mkEq(Ops.add))).toBe(1);
    expect(getAnswerPayoutMultiplier(mkEq(Ops.sub))).toBe(2);
    expect(getAnswerPayoutMultiplier(mkEq(Ops.div))).toBe(10);
  });

  test("hard mode multiplies every operator bonus by HARD_MODE_PAYOUT (×2)", () => {
    expect(HARD_MODE_PAYOUT).toBe(2);
    expect(getAnswerPayoutMultiplier(mkEq(Ops.mult, Ops.mult))).toBe(
      1 * HARD_MODE_PAYOUT,
    );
    expect(getAnswerPayoutMultiplier(mkEq(Ops.add, Ops.div))).toBe(
      1 * HARD_MODE_PAYOUT,
    );
    expect(getAnswerPayoutMultiplier(mkEq(Ops.sub, Ops.add))).toBe(
      2 * HARD_MODE_PAYOUT,
    );
    expect(getAnswerPayoutMultiplier(mkEq(Ops.div, Ops.mult))).toBe(
      10 * HARD_MODE_PAYOUT,
    );
  });
});

describe("getAnswerPayoutMultiplier (timed mode)", () => {
  test("defaults are sane: a 10-second window paying ×2", () => {
    expect(TIMED_MODE_WINDOW_MS).toBe(10_000);
    expect(TIMED_MODE_PAYOUT).toBe(2);
  });

  test("timed bonus is off by default (soft behavior unchanged)", () => {
    expect(getAnswerPayoutMultiplier(mkEq(Ops.mult), false)).toBe(1);
    expect(getAnswerPayoutMultiplier(mkEq(Ops.div))).toBe(10);
  });

  test("timed bonus multiplies the operator bonus", () => {
    expect(getAnswerPayoutMultiplier(mkEq(Ops.mult), true)).toBe(
      1 * TIMED_MODE_PAYOUT,
    );
    expect(getAnswerPayoutMultiplier(mkEq(Ops.sub), true)).toBe(
      2 * TIMED_MODE_PAYOUT,
    );
    expect(getAnswerPayoutMultiplier(mkEq(Ops.div), true)).toBe(
      10 * TIMED_MODE_PAYOUT,
    );
  });

  test("timed bonus stacks on the hard-mode premium", () => {
    expect(getAnswerPayoutMultiplier(mkEq(Ops.mult, Ops.mult), true)).toBe(
      1 * HARD_MODE_PAYOUT * TIMED_MODE_PAYOUT,
    );
    expect(getAnswerPayoutMultiplier(mkEq(Ops.div, Ops.mult), true)).toBe(
      10 * HARD_MODE_PAYOUT * TIMED_MODE_PAYOUT,
    );
  });
});

describe("getAnswerPayoutMultiplier (streak mode)", () => {
  test("defaults are sane: 5 in a row ignites, paying ×2", () => {
    expect(STREAK_MODE_THRESHOLD).toBe(5);
    expect(STREAK_MODE_PAYOUT).toBe(2);
    expect(getStreakPayoutMultiplier(0)).toBe(1);
    expect(getStreakPayoutMultiplier(STREAK_MODE_THRESHOLD - 1)).toBe(1);
    expect(getStreakPayoutMultiplier(STREAK_MODE_THRESHOLD)).toBe(
      STREAK_MODE_PAYOUT,
    );
    expect(getStreakPayoutMultiplier(STREAK_MODE_THRESHOLD + 3)).toBe(
      STREAK_MODE_PAYOUT,
    );
  });

  test("streak bonus is off by default (soft behavior unchanged)", () => {
    expect(getAnswerPayoutMultiplier(mkEq(Ops.mult), false, false)).toBe(1);
    expect(getAnswerPayoutMultiplier(mkEq(Ops.div), false, false)).toBe(10);
  });

  test("streak bonus multiplies the operator bonus", () => {
    expect(getAnswerPayoutMultiplier(mkEq(Ops.mult), false, true)).toBe(
      1 * STREAK_MODE_PAYOUT,
    );
    expect(getAnswerPayoutMultiplier(mkEq(Ops.sub), false, true)).toBe(
      2 * STREAK_MODE_PAYOUT,
    );
    expect(getAnswerPayoutMultiplier(mkEq(Ops.div), false, true)).toBe(
      10 * STREAK_MODE_PAYOUT,
    );
  });

  test("streak bonus stacks on the timed and hard-mode premiums", () => {
    expect(
      getAnswerPayoutMultiplier(mkEq(Ops.mult), true, true),
    ).toBe(
      1 * TIMED_MODE_PAYOUT * STREAK_MODE_PAYOUT,
    );
    expect(
      getAnswerPayoutMultiplier(mkEq(Ops.div, Ops.mult), true, true),
    ).toBe(
      10 * HARD_MODE_PAYOUT * TIMED_MODE_PAYOUT * STREAK_MODE_PAYOUT,
    );
  });
});

// ---------------------------------------------------------------------------
// Purchase-button visibility (plan "Adjust": hide the wall of buttons)
// ---------------------------------------------------------------------------

const NO_PURCHASE_UNLOCKS = {
  minerPowerUnlocked: false,
  fastMinerUnlocked: false,
  legendaryMinerUnlocked: false,
  prestigeUnlocked: false,
};

type Lifetime = { lifetimeMinerals: bigint; totalGemsMinted: number };

describe("getVisiblePurchases", () => {
  test("only the core buttons are visible on a fresh save", () => {
    const visible = getVisiblePurchases(
      { lifetimeMinerals: 0n, totalGemsMinted: 0 },
      NO_PURCHASE_UNLOCKS,
    );
    expect([...visible].sort()).toEqual(
      [...ALWAYS_VISIBLE_PURCHASES].sort(),
    );
  });

  test("every catalog id is a known purchase id", () => {
    expect(ALL_PURCHASE_IDS).toHaveLength(10);
    expect(
      ALWAYS_VISIBLE_PURCHASES.every((id) => ALL_PURCHASE_IDS.includes(id)),
    ).toBe(true);
  });

  test("settings default keeps the auto-hiding behavior", () => {
    expect(defaultSettingsData.showAllPurchases).toBe(false);
  });

  test("settings default keeps pixel-sprite art (emoji fallback is opt-in)", () => {
    expect(defaultSettingsData.emojiArt).toBe(false);
  });

  test("mineral-cost buttons reveal once lifetime minerals reach the base cost", () => {
    const minerPowerBase = getMinerPowerUpgradeCost(1);
    const below: Lifetime = {
      lifetimeMinerals: BigInt(minerPowerBase) - 1n,
      totalGemsMinted: 0,
    };
    expect(getVisiblePurchases(below, NO_PURCHASE_UNLOCKS).has("minerPower")).toBe(
      false,
    );
    expect(
      getVisiblePurchases(
        { lifetimeMinerals: BigInt(minerPowerBase), totalGemsMinted: 0 },
        NO_PURCHASE_UNLOCKS,
      ).has("minerPower"),
    ).toBe(true);

    const firstPrestigeRung = PRESTIGE_LEVELS[1].at;
    expect(
      getVisiblePurchases(
        { lifetimeMinerals: BigInt(firstPrestigeRung) - 1n, totalGemsMinted: 0 },
        NO_PURCHASE_UNLOCKS,
      ).has("prestige"),
    ).toBe(false);
    expect(
      getVisiblePurchases(
        { lifetimeMinerals: BigInt(firstPrestigeRung), totalGemsMinted: 0 },
        NO_PURCHASE_UNLOCKS,
      ).has("prestige"),
    ).toBe(true);
  });

  test("gem-cost buttons reveal once lifetime-minted gems reach the base cost", () => {
    const baseCosts: Array<[PurchaseId, number]> = [
      ["fastMiner", getFastMinerCost(0)],
      ["legendaryMiner", getLegendaryMinerCost(0)],
      ["gemChance", getGemChanceCost(0)],
      ["clickBoost", getClickBoostCost(0)],
      ["comboResist", getComboResistCost(0)],
    ];
    for (const [id, base] of baseCosts) {
      expect(
        getVisiblePurchases(
          { lifetimeMinerals: 0n, totalGemsMinted: base - 1 },
          NO_PURCHASE_UNLOCKS,
        ).has(id),
      ).toBe(false);
      expect(
        getVisiblePurchases(
          { lifetimeMinerals: 0n, totalGemsMinted: base },
          NO_PURCHASE_UNLOCKS,
        ).has(id),
      ).toBe(true);
    }
  });

  test("goal-tier unlocks reveal the matching button regardless of lifetime", () => {
    const zero: Lifetime = { lifetimeMinerals: 0n, totalGemsMinted: 0 };
    expect(
      getVisiblePurchases(zero, {
        ...NO_PURCHASE_UNLOCKS,
        minerPowerUnlocked: true,
      }).has("minerPower"),
    ).toBe(true);
    const fastVisible = getVisiblePurchases(zero, {
      ...NO_PURCHASE_UNLOCKS,
      fastMinerUnlocked: true,
    });
    expect(fastVisible.has("fastMiner")).toBe(true);
    expect(fastVisible.has("gemChance")).toBe(true);
    expect(
      getVisiblePurchases(zero, {
        ...NO_PURCHASE_UNLOCKS,
        legendaryMinerUnlocked: true,
      }).has("legendaryMiner"),
    ).toBe(true);
    const prestigeVisible = getVisiblePurchases(zero, {
      ...NO_PURCHASE_UNLOCKS,
      prestigeUnlocked: true,
    });
    expect(prestigeVisible.has("prestige")).toBe(true);
    expect(prestigeVisible.has("clickBoost")).toBe(true);
    expect(prestigeVisible.has("comboResist")).toBe(true);
  });

  test("visibility is monotonic: it only ever turns on", () => {
    const early: Lifetime = { lifetimeMinerals: 10n, totalGemsMinted: 2 };
    const earlyVisible = new Set(
      getVisiblePurchases(early, NO_PURCHASE_UNLOCKS),
    );
    const lateVisible = getVisiblePurchases(
      { lifetimeMinerals: 1_000_000_000n, totalGemsMinted: 1e6 },
      {
        minerPowerUnlocked: true,
        fastMinerUnlocked: true,
        legendaryMinerUnlocked: true,
        prestigeUnlocked: true,
      },
    );
    for (const id of earlyVisible) {
      expect(lateVisible.has(id)).toBe(true);
    }
    expect(lateVisible.size).toBe(ALL_PURCHASE_IDS.length);
  });

  test("ignores the current (spendable) balances entirely", () => {
    // getVisiblePurchases only reads lifetime stats by contract — a player
    // who spent everything must not lose buttons they've already unlocked.
    const visible = getVisiblePurchases(
      { lifetimeMinerals: 1_000_000_000n, totalGemsMinted: 1e6 },
      NO_PURCHASE_UNLOCKS,
    );
    expect(visible.size).toBe(ALL_PURCHASE_IDS.length);
  });
});

describe("getDepthTierProgress (cave continuous scroll)", () => {
  const m = (depth: number) => depth * 500; // mineralsPerDepth = 500

  it("is 0 exactly at each tier threshold", () => {
    for (const t of DEPTH_TIERS) {
      expect(getDepthTierProgress(m(t.at))).toBe(0);
    }
  });

  it("is linear within a tier", () => {
    // Tier 0 spans depth 0..10: depth 5 is halfway.
    expect(getDepthTierProgress(m(5))).toBeCloseTo(0.5, 6);
    // Tier 2 spans depth 50..150: depth 75 is a quarter in.
    expect(getDepthTierProgress(m(75))).toBeCloseTo(0.25, 6);
  });

  it("approaches 1 just below the next threshold and caps at 1", () => {
    // Depth 49 is the last integer depth of tier 1 (span 10..50).
    const justBelow = getDepthTierProgress(m(50) - 1);
    expect(justBelow).toBeCloseTo(0.975, 6);
    expect(getDepthTierProgress(1e15)).toBe(1);
  });

  it("stays bounded, and the visual offset (tiers crossed + progress) is monotonic", () => {
    // Progress itself resets to 0 at each tier threshold (the rows re-index
    // one tile at the same moment), so the monotonically descending
    // quantity is tiers-entered + progress — exactly what the cave renders.
    let prev = 0;
    for (let minerals = 0; minerals <= 400_000; minerals += 250) {
      const p = getDepthTierProgress(minerals);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
      const tierId = getDepthTier(getDepth(minerals)).id;
      const offset = tierId + p;
      expect(offset).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = offset;
    }
  });

  it("final tier advances across the virtual span and caps", () => {
    const start = m(500); // depth 500, Crystal Kingdom
    expect(getDepthTierProgress(start)).toBe(0);
    const mid = start + ((FINAL_TIER_PROGRESS_SPAN / 2) * 500);
    expect(getDepthTierProgress(mid)).toBeCloseTo(0.5, 6);
    const end = start + FINAL_TIER_PROGRESS_SPAN * 500;
    expect(getDepthTierProgress(end)).toBe(1);
    expect(getDepthTierProgress(end + 10_000)).toBe(1);
  });
});
