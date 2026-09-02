import {
  EquationSettings,
  Ops,
  approxeq,
  defaultEquationSettings,
  getRandomEquation,
} from "./equations";

const ALL_ON: EquationSettings = {
  minNumber: 0,
  maxNumber: 12,
  multiply: true,
  add: true,
  subtract: true,
  division: true,
  hardMode: false,
  timedMode: false,
  streakMode: false,
};

const ALL_ON_HARD: EquationSettings = { ...ALL_ON, hardMode: true };

/** Recompute a (possibly 3-term) equation left-to-right. */
const evalEquation = (eq: { a: number; op: string; b: number; op2?: string; c?: number }): number => {
  const first =
    eq.op === Ops.mult
      ? eq.a * eq.b
      : eq.op === Ops.add
        ? eq.a + eq.b
        : eq.op === Ops.sub
          ? eq.a - eq.b
          : eq.a / eq.b;
  if (eq.op2 === undefined || eq.c === undefined) return first;
  return eq.op2 === Ops.mult
    ? first * eq.c
    : eq.op2 === Ops.add
      ? first + eq.c
      : eq.op2 === Ops.sub
        ? first - eq.c
        : first / eq.c;
};

describe("getRandomEquation", () => {
  test("only uses enabled operators", () => {
    const prefs: EquationSettings = { ...ALL_ON, multiply: false };
    for (let i = 0; i < 500; i++) {
      const eq = getRandomEquation(prefs);
      expect(eq.op).not.toBe(Ops.mult);
      expect([Ops.add, Ops.sub, Ops.div]).toContain(eq.op);
    }
  });

  test("answer is always consistent with operands and op", () => {
    for (let i = 0; i < 1000; i++) {
      const eq = getRandomEquation(ALL_ON);
      const expected =
        eq.op === Ops.mult
          ? eq.a * eq.b
          : eq.op === Ops.add
            ? eq.a + eq.b
            : eq.op === Ops.sub
              ? eq.a - eq.b
              : eq.a / eq.b;
      expect(eq.answer).toBeCloseTo(expected);
    }
  });

  test("addition/multiplication operands respect [minNumber, maxNumber)", () => {
    const prefs: EquationSettings = { ...ALL_ON, minNumber: 3 };
    for (let i = 0; i < 500; i++) {
      const eq = getRandomEquation(prefs);
      if (eq.op !== Ops.div) {
        expect(eq.a).toBeGreaterThanOrEqual(3);
        expect(eq.a).toBeLessThan(12);
        expect(eq.b).toBeGreaterThanOrEqual(3);
        expect(eq.b).toBeLessThan(12);
      }
    }
  });

  test("subtraction answers are never negative (a >= b)", () => {
    const prefs: EquationSettings = {
      ...defaultEquationSettings,
      multiply: false,
      subtract: true,
    };
    for (let i = 0; i < 500; i++) {
      const eq = getRandomEquation(prefs);
      expect(eq.a).toBeGreaterThanOrEqual(eq.b);
      expect(eq.answer).toBeGreaterThanOrEqual(0);
    }
  });

  test("division is always exact (integer answer)", () => {
    const prefs: EquationSettings = {
      ...defaultEquationSettings,
      multiply: false,
      division: true,
    };
    for (let i = 0; i < 500; i++) {
      const eq = getRandomEquation(prefs);
      expect(eq.b).toBeGreaterThanOrEqual(1);
      expect(eq.a % eq.b).toBe(0);
      expect(Number.isInteger(eq.answer)).toBe(true);
      expect(eq.answer).toBeGreaterThanOrEqual(0);
    }
  });

  test("falls back to a valid equation when all operators are off", () => {
    const eq = getRandomEquation({
      ...defaultEquationSettings,
      multiply: false,
      add: false,
      subtract: false,
      division: false,
    });
    expect(eq.op).toBe(Ops.mult);
    expect(eq.op).toBeDefined();
    expect(eq.answer).toBe(eq.a * eq.b);
  });

  test("approxeq", () => {
    expect(approxeq(2.5, 2.5)).toBe(true);
    expect(approxeq(2.5, 2.505)).toBe(true);
    expect(approxeq(2.5, 2.6)).toBe(false);
  });
});

describe("getRandomEquation hard mode (tier-5, 3-term ×2)", () => {
  test("soft mode is unchanged: no second term is ever emitted", () => {
    expect(defaultEquationSettings.hardMode).toBe(false);
    // Timed + streak modes are purely scoring rules (window/payout/streak
    // counters), not generator changes: off by default, never alter shape.
    expect(defaultEquationSettings.timedMode).toBe(false);
    expect(defaultEquationSettings.streakMode).toBe(false);
    for (let i = 0; i < 500; i++) {
      const eq = getRandomEquation(ALL_ON);
      expect(eq.op2).toBeUndefined();
      expect(eq.c).toBeUndefined();
      expect(eq.answer).toBe(evalEquation(eq));
    }
  });

  test("hard mode always emits a second step and the answer is the left-to-right result", () => {
    for (let i = 0; i < 2000; i++) {
      const eq = getRandomEquation(ALL_ON_HARD);
      expect(eq.op2).toBeDefined();
      expect(typeof eq.c).toBe("number");
      expect([Ops.mult, Ops.add, Ops.sub, Ops.div]).toContain(eq.op2);
      expect(eq.answer).toBe(evalEquation(eq));
      expect(Number.isInteger(eq.answer)).toBe(true);
      expect(eq.answer).toBeGreaterThanOrEqual(0);
    }
  });

  test("hard mode first step keeps the 2-term guarantees (range, exact division)", () => {
    for (let i = 0; i < 1000; i++) {
      const eq = getRandomEquation(ALL_ON_HARD);
      if (eq.op === Ops.div) {
        expect(eq.b).toBeGreaterThanOrEqual(1);
        expect(eq.a % eq.b).toBe(0);
      } else {
        expect(eq.a).toBeGreaterThanOrEqual(0);
        expect(eq.a).toBeLessThan(12);
        expect(eq.b).toBeGreaterThanOrEqual(0);
        expect(eq.b).toBeLessThan(12);
      }
      if (eq.op === Ops.sub) {
        expect(eq.a).toBeGreaterThanOrEqual(eq.b);
      }
    }
  });

  test("hard mode second step: c in range for +/*, sub stays non-negative, division exact at both steps", () => {
    for (let i = 0; i < 2000; i++) {
      const eq = getRandomEquation(ALL_ON_HARD);
      const op2 = eq.op2 as string;
      const c = eq.c as number;
      const first = evalEquation({ a: eq.a, op: eq.op, b: eq.b });
      if (op2 === Ops.mult || op2 === Ops.add) {
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThan(12);
      }
      if (op2 === Ops.sub) {
        // c is clamped to the running result: answer = first - c >= 0.
        expect(c).toBeLessThanOrEqual(first);
        expect(eq.answer).toBeGreaterThanOrEqual(0);
      }
      if (op2 === Ops.div) {
        expect(c).toBeGreaterThanOrEqual(1);
        if (first !== 0) {
          // Exact at the second step: c divides the running result.
          expect(first % c).toBe(0);
        }
        expect(Number.isInteger(eq.answer)).toBe(true);
      }
    }
  });

  test("hard mode honors minNumber for the added operands (±/*)", () => {
    const prefs: EquationSettings = { ...ALL_ON_HARD, minNumber: 3 };
    for (let i = 0; i < 500; i++) {
      const eq = getRandomEquation(prefs);
      const op2 = eq.op2 as string;
      if (op2 === Ops.mult || op2 === Ops.add) {
        expect(eq.c as number).toBeGreaterThanOrEqual(3);
      }
    }
  });

  test("hard mode with all operators off still yields a valid 3-term equation", () => {
    const prefs: EquationSettings = {
      ...defaultEquationSettings,
      multiply: false,
      add: false,
      subtract: false,
      division: false,
      hardMode: true,
    };
    for (let i = 0; i < 100; i++) {
      const eq = getRandomEquation(prefs);
      expect(eq.op).toBe(Ops.mult);
      expect(eq.op2).toBe(Ops.mult);
      expect(eq.answer).toBe((eq.a as number) * (eq.b as number) * (eq.c as number));
    }
  });
});
