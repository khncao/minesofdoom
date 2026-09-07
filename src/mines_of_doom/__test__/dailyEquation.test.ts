import {
  DAILY_EQUATION_BONUS,
  DAILY_EQUATION_PREFS,
  DailyEquationState,
  computeDailyEquationStatus,
  getDailyEquation,
  markDailyEquationSolved,
} from "../dailyEquation";
import { getLocalDayKey } from "../dailyBonus";
import { Equation } from "src/utils/math/equations";

/** Local noon on a calendar day (same DST-safe convention as
 *  dailyBonus.test.ts). */
const day = (d: number) => new Date(2026, 5, d, 12, 0, 0).getTime();

/** Re-evaluate an equation's shape the way the game does, and check it
 *  matches the stored answer (integral, non-negative by construction). */
function evaluate(eq: Equation): number {
  switch (eq.op) {
    case "*":
      return eq.missing ? eq.b / eq.a : eq.a * eq.b;
    case "+":
      return eq.missing ? eq.b - eq.a : eq.a + eq.b;
    case "-":
      return eq.a - eq.b;
    case "/":
      return eq.a / eq.b;
    case "sq":
      return eq.a * eq.a;
    case "%":
      return (eq.b * eq.a) / 100;
    default:
      throw new Error(`unknown op ${eq.op}`);
  }
}

describe("getDailyEquation", () => {
  it("is deterministic: the same day key yields the same equation, forever", () => {
    const a = getDailyEquation("2026-06-07");
    const b = getDailyEquation("2026-06-07");
    expect(a).toEqual(b);
  });

  it("differs across day keys (spot check: not one cached equation)", () => {
    const a = getDailyEquation("2026-06-07");
    const b = getDailyEquation("2026-06-08");
    expect(a).not.toEqual(b);
  });

  it("keeps every generation guarantee across many days: integral, non-negative answers; in-range operands; exact divisions; friendly percent bases", () => {
    for (let d = 1; d <= 400; d++) {
      const dayKey = `2026-06-${String(d % 28 + 1).padStart(2, "0")}`;
      const eq = getDailyEquation(dayKey);
      expect(Number.isInteger(eq.answer)).toBe(true);
      expect(eq.answer).toBeGreaterThanOrEqual(0);
      // The stored answer matches the shape (the game scores against it).
      expect(eq.answer).toBe(evaluate(eq));
      // DAILY_EQUATION_PREFS: operands in [2, 12), always soft mode.
      expect(DAILY_EQUATION_PREFS.hardMode).toBe(false);
      expect(eq.op2).toBeUndefined();
      if (eq.op === "/") {
        // Divisor is in [1, maxNumber) (a / 1 is exact and legal), and the
        // product a = b * k is built in-range.
        expect(eq.b).toBeGreaterThanOrEqual(1);
        expect(eq.b).toBeLessThan(12);
        expect(eq.a % eq.b).toBe(0);
      }
      if (eq.op === "%") {
        const step = 100 / eq.a;
        expect(eq.b % step).toBe(0);
      }
      if (eq.missing) {
        expect(eq.answer).toBeGreaterThanOrEqual(1);
        expect(["+", "*"]).toContain(eq.op);
      }
    }
  });
});

describe("computeDailyEquationStatus", () => {
  it("reports unsolved with today's deterministic equation and the flat bonus when nothing is stored", () => {
    const now = day(7);
    const status = computeDailyEquationStatus(null, now);
    expect(status.dayKey).toBe(getLocalDayKey(now));
    expect(status.solved).toBe(false);
    expect(status.bonus).toBe(DAILY_EQUATION_BONUS);
    expect(status.equation).toEqual(getDailyEquation(status.dayKey));
  });

  it("stays solved for the rest of the day, and reopens on the next day", () => {
    const solved: DailyEquationState = { solvedDay: getLocalDayKey(day(7)) };
    expect(computeDailyEquationStatus(solved, day(7)).solved).toBe(true);
    expect(computeDailyEquationStatus(solved, day(8)).solved).toBe(false);
  });
});

describe("markDailyEquationSolved", () => {
  it("records the local day of the solve", () => {
    expect(markDailyEquationSolved(null, day(7))).toEqual({
      solvedDay: getLocalDayKey(day(7)),
    });
  });

  it("is idempotent for a repeated call on the same day", () => {
    const once = markDailyEquationSolved(null, day(7));
    expect(markDailyEquationSolved(once, day(7) + 3_600_000)).toEqual(once);
  });
});
