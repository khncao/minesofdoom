import { createEmptySaveData, SaveData } from "../game";
import { getRecords, RecordEntry } from "../records";
import { GOAL_TIERS } from "../goals";
import { ACHIEVEMENTS } from "../achievements";

const saveWith = (fields: Partial<SaveData>): SaveData => ({
  ...createEmptySaveData(),
  ...fields,
});

const byId = (records: RecordEntry[], id: string) =>
  records.find((r) => r.id === id);

describe("local records (plan §4.3 personal bests)", () => {
  test("a fresh save has every record at zero", () => {
    const records = getRecords(createEmptySaveData());
    for (const r of records) {
      // "0 m" is the unit-suffixed depth row; everything else is a bare
      // zero or a 0/N chain fraction.
      expect(r.value).toMatch(/^0 m$|^0$|^0\/\d+$/);
    }
    // The chain rows show 0/total, not a bare zero.
    expect(byId(records, "tiers")?.value).toBe(`0/${GOAL_TIERS.length}`);
    expect(byId(records, "achievements")?.value).toBe(
      `0/${ACHIEVEMENTS.length}`,
    );
  });

  test("rows carry the lifetime stats verbatim", () => {
    const records = getRecords(
      saveWith({
        maxDepth: 1234,
        maxCombo: 45,
        lifetimeMinerals: 5_000_000,
        lifetimeCorrect: 1200,
        minersOwnedEver: 77,
        totalGemsMinted: 9,
        totalGemsSpent: 4,
        totalPrestiges: 2,
      }),
    );
    // formatNumber shows values below 10,000 in full (no suffix).
    expect(byId(records, "depth")?.value).toBe("1234 m");
    expect(byId(records, "combo")?.value).toBe("45");
    expect(byId(records, "minerals")?.value).toBe("5M");
    expect(byId(records, "answers")?.value).toBe("1200");
    expect(byId(records, "miners")?.value).toBe("77");
    expect(byId(records, "gems-minted")?.value).toBe("9");
    expect(byId(records, "gems-spent")?.value).toBe("4");
    expect(byId(records, "prestige")?.value).toBe("2");
  });

  test("tier/achievement rows derive completion from the stats, like the goals view", () => {
    // Meets every goal of t1 (depth 10, 50 answers, 1 miner) — the same
    // thresholds the goals panel uses, so both views can never disagree.
    const save = saveWith({ maxDepth: 10, lifetimeCorrect: 50, minersOwnedEver: 1 });
    const records = getRecords(save);
    expect(byId(records, "tiers")?.value).toBe(`1/${GOAL_TIERS.length}`);
    // First achievement is the 10-answers badge: 50 answers clears it (and
    // any cheaper early ones), so the count is > 0 but < the full list.
    const achievementCount = parseInt(
      byId(records, "achievements")?.value ?? "0/0",
      10,
    );
    expect(achievementCount).toBeGreaterThan(0);
    expect(achievementCount).toBeLessThan(ACHIEVEMENTS.length);
  });

  test("row order is stable and ids unique (UI is a dumb list renderer)", () => {
    const a = getRecords(saveWith({ maxDepth: 99 }));
    const b = getRecords(saveWith({ maxDepth: 1 }));
    expect(a.map((r) => r.id)).toEqual(b.map((r) => r.id));
    const ids = a.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of a) {
      expect(typeof r.label).toBe("string");
      expect(r.label.length).toBeGreaterThan(0);
      expect(typeof r.icon).toBe("string");
    }
  });

  test("pure: same save yields identical records and the input is untouched", () => {
    const save = saveWith({
      maxDepth: 500,
      lifetimeMinerals: 123456,
      totalPrestiges: 3,
    });
    const before = JSON.stringify(save);
    expect(getRecords(save)).toEqual(getRecords(save));
    expect(JSON.stringify(save)).toBe(before);
  });
});
