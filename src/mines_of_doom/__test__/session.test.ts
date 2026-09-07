import {
  createSessionBaseline,
  getSessionStats,
} from "../session";
import { createEmptySaveData } from "../game";

describe("session stats", () => {
  test("fresh save: baseline is all zeros, session starts at zero", () => {
    const save = createEmptySaveData();
    const baseline = createSessionBaseline(save);
    expect(baseline).toEqual({
      lifetimeMinerals: 0n,
      lifetimeCorrect: 0,
      playSeconds: 0,
    });
    expect(getSessionStats(save, baseline)).toEqual({
      mineralsMined: 0n,
      correct: 0,
      seconds: 0,
    });
  });

  test("gains since the baseline count, nothing else does", () => {
    const save = createEmptySaveData();
    save.lifetimeMinerals = 1_000_000n;
    save.lifetimeCorrect = 400;
    save.playSeconds = 50_000;
    const baseline = createSessionBaseline(save);

    const now = {
      ...save,
      lifetimeMinerals: 1_250_000n,
      lifetimeCorrect: 417,
      playSeconds: 50_123,
    };
    expect(getSessionStats(now, baseline)).toEqual({
      mineralsMined: 250_000n,
      correct: 17,
      seconds: 123,
    });
  });

  test("a mid-session reset clamps every session stat at zero (no negatives)", () => {
    const save = createEmptySaveData();
    save.lifetimeMinerals = 1_000_000n;
    save.lifetimeCorrect = 400;
    save.playSeconds = 50_000;
    const baseline = createSessionBaseline(save);

    // Wiped save replaces the state: lifetime stats below the baseline.
    const reset = createEmptySaveData();
    expect(getSessionStats(reset, baseline)).toEqual({
      mineralsMined: 0n,
      correct: 0,
      seconds: 0,
    });
  });

  test("an imported save below the baseline clamps at zero, above it counts the delta", () => {
    const save = createEmptySaveData();
    save.lifetimeMinerals = 100n;
    save.lifetimeCorrect = 10;
    save.playSeconds = 600;
    const baseline = createSessionBaseline(save);

    const below = { ...save, lifetimeMinerals: 50n };
    expect(getSessionStats(below, baseline).mineralsMined).toBe(0n);

    const above = { ...save, lifetimeMinerals: 150n };
    expect(getSessionStats(above, baseline).mineralsMined).toBe(50n);
  });
});
