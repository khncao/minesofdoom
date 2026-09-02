import {
  EquationSettings,
  Ops,
  approxeq,
  defaultEquationSettings,
  formatEquation,
  getRandomEquation,
  getOpDisplay,
} from "./equations";

const ALL_ON: EquationSettings = {
  minNumber: 0,
  maxNumber: 12,
  multiply: true,
  add: true,
  subtract: true,
  division: true,
  percent: false,
  square: false,
  missing: false,
  hardMode: false,
  timedMode: false,
  streakMode: false,
  multiplySymbol: "asterisk",
};

const ALL_ON_HARD: EquationSettings = { ...ALL_ON, hardMode: true };

const ALL_TYPES_ON: EquationSettings = {
  ...ALL_ON,
  percent: true,
  square: true,
  missing: true,
};

// Classic ops off — isolates one new type at a time.
const ONLY: EquationSettings = {
  ...ALL_ON,
  multiply: false,
  add: false,
  subtract: false,
  division: false,
};

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

  test("defaults: new types are off and multiply displays as asterisk", () => {
    expect(defaultEquationSettings.percent).toBe(false);
    expect(defaultEquationSettings.square).toBe(false);
    expect(defaultEquationSettings.missing).toBe(false);
    expect(defaultEquationSettings.multiplySymbol).toBe("asterisk");
  });
});

describe("soft-mode-only equation types (iteration 11, all ages)", () => {
  test("percent: friendly %, exact integer answer, in-range base", () => {
    const prefs: EquationSettings = { ...ONLY, percent: true };
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const eq = getRandomEquation(prefs);
      expect(eq.op).toBe(Ops.pct);
      expect([10, 25, 50]).toContain(eq.a); // a = the percent
      const step = 100 / eq.a;
      expect(eq.b % step).toBe(0); // exact base
      expect(eq.b).toBeGreaterThanOrEqual(0);
      expect(eq.b).toBeLessThan(12);
      expect(Number.isInteger(eq.answer)).toBe(true);
      expect(eq.answer).toBe((eq.b * eq.a) / 100);
      expect(eq.answer).toBeGreaterThanOrEqual(1);
      seen.add(eq.a);
    }
    expect(seen.size).toBeGreaterThan(1); // all three percents actually roll
  });

  test("percent falls back to multiply when no base fits maxNumber", () => {
    const prefs: EquationSettings = {
      ...ONLY,
      percent: true,
      maxNumber: 2, // no 10/25/50% base fits [0,2)
    };
    for (let i = 0; i < 200; i++) {
      const eq = getRandomEquation(prefs);
      expect(eq.op).toBe(Ops.mult);
      expect(eq.answer).toBe(eq.a * eq.b);
    }
  });

  test("square: a in range, answer = a²", () => {
    const prefs: EquationSettings = { ...ONLY, square: true };
    for (let i = 0; i < 500; i++) {
      const eq = getRandomEquation(prefs);
      expect(eq.op).toBe(Ops.sq);
      expect(eq.a).toBeGreaterThanOrEqual(0);
      expect(eq.a).toBeLessThan(12);
      expect(eq.b).toBe(eq.a);
      expect(eq.answer).toBe(eq.a * eq.a);
    }
  });

  test("missing-number: whole answer >= 1, consistent with the shown values", () => {
    const prefs: EquationSettings = { ...ONLY, missing: true };
    for (let i = 0; i < 2000; i++) {
      const eq = getRandomEquation(prefs);
      expect(eq.missing).toBe(true);
      expect([Ops.add, Ops.mult]).toContain(eq.op);
      expect(Number.isInteger(eq.answer)).toBe(true);
      expect(eq.answer).toBeGreaterThanOrEqual(1);
      if (eq.op === Ops.add) {
        expect(eq.a).toBeGreaterThanOrEqual(0);
        expect(eq.a).toBeLessThan(12);
        expect(eq.b).toBe(eq.a + eq.answer);
      } else {
        expect(eq.a).toBeGreaterThanOrEqual(2);
        expect(eq.a).toBeLessThan(12);
        expect(eq.answer).toBeLessThan(12);
        expect(eq.b).toBe(eq.a * eq.answer);
      }
    }
  });

  test("new types appear with equal-ish frequency when enabled", () => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < 6000; i++) {
      const eq = getRandomEquation(ALL_TYPES_ON);
      const key = eq.missing ? "missing" : eq.op;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    // 7 kinds over 6000 rolls: every kind should show up hundreds of times.
    for (const key of [Ops.mult, Ops.add, Ops.sub, Ops.div, Ops.pct, Ops.sq, "missing"]) {
      expect(counts[key]).toBeGreaterThan(300);
    }
  });
});

describe("getOpDisplay / formatEquation (iteration 11)", () => {
  test("multiply symbol is configurable, other ops are fixed", () => {
    expect(getOpDisplay(Ops.mult, "asterisk")).toBe("*");
    expect(getOpDisplay(Ops.mult, "letter")).toBe("x");
    expect(getOpDisplay(Ops.add, "asterisk")).toBe("+");
    expect(getOpDisplay(Ops.sub, "letter")).toBe("-");
    expect(getOpDisplay(Ops.div, "asterisk")).toBe("/");
    expect(getOpDisplay(Ops.pct, "asterisk")).toBe("%");
    expect(getOpDisplay(Ops.sq, "asterisk")).toBe("²");
  });

  test("formats every shape", () => {
    expect(
      formatEquation({ op: Ops.mult, a: 7, b: 2, answer: 14 }, "asterisk"),
    ).toBe("7 * 2");
    expect(
      formatEquation({ op: Ops.mult, a: 7, b: 2, answer: 14 }, "letter"),
    ).toBe("7 x 2");
    expect(
      formatEquation(
        { op: Ops.mult, a: 7, b: 2, answer: 42, op2: Ops.mult, c: 3 },
        "asterisk",
      ),
    ).toBe("7 * 2 * 3");
    expect(formatEquation({ op: Ops.pct, a: 25, b: 40, answer: 10 }, "asterisk")).toBe("25% of 40");
    expect(formatEquation({ op: Ops.sq, a: 7, b: 7, answer: 49 }, "letter")).toBe("7²");
    expect(
      formatEquation({ op: Ops.add, a: 7, b: 12, answer: 5, missing: true }, "letter"),
    ).toBe("7 + ? = 12");
    expect(
      formatEquation({ op: Ops.mult, a: 3, b: 24, answer: 8, missing: true }, "asterisk"),
    ).toBe("3 * ? = 24");
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
