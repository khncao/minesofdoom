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
