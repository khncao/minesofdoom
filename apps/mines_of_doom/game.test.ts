import {
  computeOfflineMinerals,
  createEmptySaveData,
  getClickUpgradeCost,
  getDepth,
  getDepthTier,
  getMinerPowerUpgradeCost,
  getMinerUpgradeCost,
  lifetimeDelta,
  maxOfflineTicks,
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

  test("zero miners / zero saveTime / no elapsed time => 0", () => {
    expect(computeOfflineMinerals(0, 5, now - 100_000, now)).toBe(0);
    expect(computeOfflineMinerals(2, 3, 0, now)).toBe(0);
    expect(computeOfflineMinerals(2, 3, now, now)).toBe(0);
    expect(computeOfflineMinerals(2, 3, now + 1000, now)).toBe(0);
  });

  test("miners x minerPower x elapsed ticks", () => {
    // 10 ticks elapsed: 2 miners * 3 power * 10 = 60
    expect(computeOfflineMinerals(2, 3, now - 10 * msPerTick, now)).toBe(60);
  });

  test("caps at maxOfflineTicks (8h)", () => {
    const nineHours = 9 * 3600 * 1000;
    expect(computeOfflineMinerals(2, 3, now - nineHours, now)).toBe(
      2 * 3 * maxOfflineTicks,
    );
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
