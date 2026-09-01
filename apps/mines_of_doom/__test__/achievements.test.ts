import { createEmptySaveData, SaveData } from "../game";
import {
  ACHIEVEMENTS,
  getAchievement,
  getAchievementBonus,
  getAchievementProgress,
  getCompletedAchievementIds,
  isAchievementComplete,
} from "../achievements";

const baseSave = () => createEmptySaveData();

const saveWith = (fields: Partial<SaveData>): SaveData => ({
  ...baseSave(),
  ...fields,
});

describe("achievements catalog", () => {
  test("ids are unique", () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("entries are well-formed", () => {
    for (const a of ACHIEVEMENTS) {
      expect(a.target).toBeGreaterThan(0);
      expect(a.bonusMinerals).toBeGreaterThan(0);
      // Metric must be a field on the save (GoalMetric union guarantees
      // this at compile time; assert runtime consistency too).
      expect(baseSave()[a.metric]).toBe(0);
    }
  });
});

describe("achievement derivation", () => {
  test("fresh save completes nothing", () => {
    expect(getCompletedAchievementIds(baseSave())).toEqual([]);
  });

  test("isAchievementComplete is target >= comparison", () => {
    const a = getAchievement("answers-100")!;
    expect(isAchievementComplete(saveWith({ lifetimeCorrect: 99 }), a)).toBe(
      false,
    );
    expect(isAchievementComplete(saveWith({ lifetimeCorrect: 100 }), a)).toBe(
      true,
    );
  });

  test("getAchievementProgress clamps at 1", () => {
    const a = getAchievement("answers-100")!;
    expect(
      getAchievementProgress(saveWith({ lifetimeCorrect: 50 }), a).fraction,
    ).toBe(0.5);
    expect(
      getAchievementProgress(saveWith({ lifetimeCorrect: 999 }), a).fraction,
    ).toBe(1);
  });

  test("achievements are independent: no tier-style sequencing", () => {
    // A save that ONLY minted gems completes every gem achievement even
    // though no early-game achievement's neighbor metrics were touched —
    // and deep/lifetime achievements don't gate shallow ones either.
    const save = saveWith({ totalGemsMinted: 100 });
    const done = getCompletedAchievementIds(save);
    expect(done).toEqual(
      expect.arrayContaining(["gem-1", "gem-10", "gem-50", "gem-100"]),
    );
    expect(done).not.toContain("miner-1");
  });

  test("stats survive spending: completion derives from lifetime stats", () => {
    // Mining 1M lifetime then spending everything down to 0 keeps the badge.
    const save = saveWith({
      lifetimeMinerals: 1_000_000_000,
      lifetimeCorrect: 1000,
      minersOwnedEver: 25,
      maxCombo: 250,
      totalGemsMinted: 100,
      maxDepth: 500,
      minerals: 0,
    });
    expect(getCompletedAchievementIds(save)).toHaveLength(ACHIEVEMENTS.length);
  });
});

describe("getAchievementBonus", () => {
  test("sums bonuses and ignores unknown ids", () => {
    const all = ACHIEVEMENTS.reduce((s, a) => s + a.bonusMinerals, 0);
    expect(getAchievementBonus(ACHIEVEMENTS.map((a) => a.id))).toBe(all);
    expect(getAchievementBonus(["miner-1", "nope"])).toBe(
      getAchievement("miner-1")!.bonusMinerals,
    );
    expect(getAchievementBonus([])).toBe(0);
  });
});
