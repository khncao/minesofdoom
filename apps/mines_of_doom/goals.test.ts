import { createEmptySaveData, SaveData } from "./game";
import {
  GOAL_TIERS,
  getCompletedTierIds,
  getGoalProgress,
  getTierBonus,
  isGoalComplete,
} from "./goals";

const baseSave = () => createEmptySaveData();

const saveWith = (fields: Partial<SaveData>): SaveData => ({
  ...baseSave(),
  ...fields,
});

describe("goal tier derivation", () => {
  test("fresh save completes no tiers", () => {
    expect(getCompletedTierIds(baseSave())).toEqual([]);
  });

  test("tier 1 completes when all its goals are met", () => {
    const save = saveWith({ maxDepth: 10, lifetimeCorrect: 50, minersOwnedEver: 1 });
    expect(getCompletedTierIds(save)).toEqual(["t1"]);
    // Not all of tier 1's goals met yet => no completion
    expect(getCompletedTierIds(saveWith({ maxDepth: 10, lifetimeCorrect: 50 }))).toEqual([]);
  });

  test("tiers are sequential: later stats can't skip earlier tiers", () => {
    // Depth 1500m and 500-combo clear tier 5's metrics, but without the
    // early-game goals (50 answers, a miner) nothing completes.
    const save = saveWith({ maxDepth: 1500, maxCombo: 500, lifetimeMinerals: 1e9 });
    expect(getCompletedTierIds(save)).toEqual([]);
  });

  test("all five tiers complete with maxed stats", () => {
    const save = saveWith({
      maxDepth: 1500,
      lifetimeCorrect: 1000,
      lifetimeMinerals: 1e9,
      minersOwnedEver: 10,
      maxCombo: 500,
      totalGemsSpent: 10,
      minerPower: 11,
      totalGemsMinted: 100,
      totalPrestiges: 3,
    });
    expect(getCompletedTierIds(save)).toEqual(
      GOAL_TIERS.map((t) => t.id),
    );
  });

  test("stats survive spending: maxDepth never decreases with minerals", () => {
    // maxDepth is a lifetime stat — mining to 1500m then buying things
    // back down to 0 minerals keeps the goal complete.
    const save = saveWith({
      maxDepth: 1500,
      lifetimeCorrect: 1000,
      lifetimeMinerals: 1e9,
      minersOwnedEver: 10,
      maxCombo: 500,
      totalGemsSpent: 10,
      minerPower: 11,
      totalGemsMinted: 100,
      totalPrestiges: 3,
      minerals: 0,
    });
    expect(getCompletedTierIds(save)).toHaveLength(5);
  });
});

describe("goal progress helpers", () => {
  test("isGoalComplete is target >= comparison", () => {
    const goal = GOAL_TIERS[0].goals[1]; // lifetimeCorrect >= 50
    expect(isGoalComplete(saveWith({ lifetimeCorrect: 49 }), goal)).toBe(false);
    expect(isGoalComplete(saveWith({ lifetimeCorrect: 50 }), goal)).toBe(true);
    expect(isGoalComplete(saveWith({ lifetimeCorrect: 500 }), goal)).toBe(true);
  });

  test("getGoalProgress clamps fraction at 1", () => {
    const goal = GOAL_TIERS[0].goals[1];
    expect(getGoalProgress(saveWith({ lifetimeCorrect: 25 }), goal).fraction).toBe(0.5);
    expect(getGoalProgress(saveWith({ lifetimeCorrect: 999 }), goal).fraction).toBe(1);
  });

  test("getTierBonus sums bonuses and ignores unknown ids", () => {
    const all = GOAL_TIERS.reduce((s, t) => s + t.bonusMinerals, 0);
    expect(getTierBonus(GOAL_TIERS.map((t) => t.id))).toBe(all);
    expect(getTierBonus(["t1", "nope"])).toBe(
      GOAL_TIERS.find((t) => t.id === "t1")!.bonusMinerals,
    );
    expect(getTierBonus([])).toBe(0);
  });
});
