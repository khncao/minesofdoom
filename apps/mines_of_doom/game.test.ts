import {
  GEM_CHANCE_MAX_LEVELS,
  computeOfflineMinerals,
  createEmptySaveData,
  gemChancePerLevel,
  getClickUpgradeCost,
  getDepth,
  getDepthTier,
  getFastMinerCost,
  getFastMinerOutput,
  getGemChance,
  getGemChanceCost,
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
  saveVersion,
} from "./game";

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
    expect(d.lifetimeMinerals).toBe(5500);
    expect(d.maxDepth).toBe(11);
  });

  test("maxCombo only ever increases", () => {
    const s = { ...save(), maxCombo: 42 };
    expect(lifetimeDelta(s, { combo: 10 }).maxCombo).toBe(42);
    expect(lifetimeDelta(s, { combo: 43 }).maxCombo).toBe(43);
  });

  test("no deltas is a no-op", () => {
    const s = { ...save(), maxCombo: 7, maxDepth: 3 };
    const d = lifetimeDelta(s, {});
    expect(d.lifetimeMinerals).toBe(0);
    expect(d.maxCombo).toBe(7);
    expect(d.maxDepth).toBe(3);
    expect(d.minersOwnedEver).toBe(0);
    expect(d.totalGemsMinted).toBe(0);
  });
});

describe("getDepth", () => {
  test("depth = floor(minerals / 500)", () => {
    expect(getDepth(0)).toBe(0);
    expect(getDepth(499)).toBe(0);
    expect(getDepth(500)).toBe(1);
    expect(getDepth(1234)).toBe(2);
    expect(getDepth(100000)).toBe(200);
  });
});

describe("computeOfflineMinerals", () => {
  const now = 1_000_000_000;

  test("no miners of any type / zero saveTime / no elapsed time => 0", () => {
    expect(computeOfflineMinerals(0, 5, 0, now - 100_000, now)).toBe(0);
    expect(computeOfflineMinerals(2, 3, 0, 0, now)).toBe(0);
    expect(computeOfflineMinerals(2, 3, 0, now, now)).toBe(0);
    expect(computeOfflineMinerals(2, 3, 0, now + 1000, now)).toBe(0);
  });

  test("miners x minerPower x elapsed ticks", () => {
    // 10 ticks elapsed: 2 miners * 3 power * 10 = 60
    expect(computeOfflineMinerals(2, 3, 0, now - 10 * msPerTick, now)).toBe(60);
  });

  test("fast miners contribute their (weaker) output", () => {
    // 10 ticks: 2 normal @ power 3 (6/s) + 3 fast @ output 1 (3/s) = 90
    expect(computeOfflineMinerals(2, 3, 3, now - 10 * msPerTick, now)).toBe(90);
  });

  test("caps at maxOfflineTicks (8h)", () => {
    const nineHours = 9 * 3600 * 1000;
    expect(
      computeOfflineMinerals(2, 3, 3, now - nineHours, now),
    ).toBe(getMineralsPerSec(2, 3, 3) * maxOfflineTicks);
  });

  test("prestige multiplier scales the offline payout", () => {
    // 10 ticks: 2 miners * 3 power * 10 = 60, x2 banked = 120.
    expect(
      computeOfflineMinerals(2, 3, 0, now - 10 * msPerTick, now, 2),
    ).toBe(120);
    // Default multiplier (no argument) is 1 — same as before.
    expect(
      computeOfflineMinerals(2, 3, 0, now - 10 * msPerTick, now),
    ).toBe(60);
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
    expect(migrated.maxDepth).toBe(5); // floor(2500 / 500)
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
    const migrated = migrateSaveData({ saveVersion: 1, completedTiers: ["t1", 5, null] });
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
    expect(migrated.ownedCosmetics).toEqual(expect.arrayContaining(["classic", "steel"]));
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
