import {
  computeOfflineMinerals,
  getClickUpgradeCost,
  getDepth,
  getMinerUpgradeCost,
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
});
