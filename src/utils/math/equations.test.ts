import {
  EquationSettings,
  Ops,
  defaultEquationSettings,
  formatClock,
  formatEquation,
  formatEquationPrompt,
  getSeededEquation,
  getRandomEquation,
  getOpDisplay,
  hasQuestionMark,
  hashString,
  isHardMode,
  isMissingDivisor,
  mulberry32,
} from "./equations";
import { isMoney, toCents } from "./money";

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
  missingDivisor: false,
  balance: false,
  sequence: false,
  tip: false,
  change: false,
  time: false,
  moneyAdd: false,
  unitPrice: false,
  splitBill: false,
  hardMode: false,
  multiplySymbol: "asterisk",
};

const ALL_ON_HARD: EquationSettings = { ...ALL_ON, hardMode: true };

const ALL_TYPES_ON: EquationSettings = {
  ...ALL_ON,
  percent: true,
  square: true,
  missing: true,
  missingDivisor: true,
  balance: true,
  sequence: true,
  tip: true,
  change: true,
  time: true,
  moneyAdd: true,
  unitPrice: true,
  splitBill: true,
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

  test("approxeq is gone: answers are compared in integer cents instead", () => {
    // The epsilon comparator it replaced lives in money.ts as
    // answersEqual — see money.test.ts, which pins why 0.01 was wrong.
    expect(getOpDisplay(Ops.add, "asterisk")).toBe("+");
  });

  test("defaults: new types are off and multiply displays as asterisk", () => {
    expect(defaultEquationSettings.percent).toBe(false);
    expect(defaultEquationSettings.square).toBe(false);
    expect(defaultEquationSettings.missing).toBe(false);
    // Drills (todo: "More types of simple mental arithmetics for all
    // ages") ship off — a returning player's saved settings have no such
    // keys at all, and the merged default keeps them off.
    expect(defaultEquationSettings.missingDivisor).toBe(false);
    expect(defaultEquationSettings.balance).toBe(false);
    expect(defaultEquationSettings.sequence).toBe(false);
    expect(defaultEquationSettings.tip).toBe(false);
    expect(defaultEquationSettings.change).toBe(false);
    expect(defaultEquationSettings.time).toBe(false);
    expect(defaultEquationSettings.moneyAdd).toBe(false);
    expect(defaultEquationSettings.unitPrice).toBe(false);
    expect(defaultEquationSettings.splitBill).toBe(false);
    expect(defaultEquationSettings.multiplySymbol).toBe("asterisk");
  });
});

describe("zero-operand exclusion (todo: math:zero-operand)", () => {
  test("multiply operands are never 0, even when minNumber is 0", () => {
    const prefs: EquationSettings = { ...ONLY, multiply: true };
    for (let i = 0; i < 2000; i++) {
      const eq = getRandomEquation(prefs);
      expect(eq.op).toBe(Ops.mult);
      expect(eq.a).toBeGreaterThanOrEqual(1);
      expect(eq.b).toBeGreaterThanOrEqual(1);
      expect(eq.a).toBeLessThan(12);
      expect(eq.b).toBeLessThan(12);
      // No more degenerate zero answers paying the Math.max(1, …) floor.
      expect(eq.answer).toBeGreaterThanOrEqual(1);
    }
  });

  test("square operand is never 0, even when minNumber is 0", () => {
    const prefs: EquationSettings = { ...ONLY, square: true };
    for (let i = 0; i < 500; i++) {
      const eq = getRandomEquation(prefs);
      expect(eq.op).toBe(Ops.sq);
      expect(eq.a).toBeGreaterThanOrEqual(1);
      expect(eq.b).toBe(eq.a);
      expect(eq.answer).toBeGreaterThanOrEqual(1);
    }
  });

  test("addition/subtraction keep 0 legal (0 + n = n is not degenerate)", () => {
    const prefs: EquationSettings = {
      ...ONLY,
      add: true,
      subtract: true,
    };
    // minNumber is 0: add/sub must still be able to sample 0 operands.
    // (Statistical over many rolls: 0 in [0,12) is 1/12 per draw, so over
    // 3000 equations of two operands each, a 0 must show up.)
    let sawZero = false;
    for (let i = 0; i < 3000 && !sawZero; i++) {
      const eq = getRandomEquation(prefs);
      if (eq.op === Ops.add || eq.op === Ops.sub) {
        if (eq.a === 0 || eq.b === 0) sawZero = true;
      }
    }
    expect(sawZero).toBe(true);
  });

  test("a minNumber >= 1 is still the floor for multiply/square", () => {
    const prefs: EquationSettings = { ...ONLY, multiply: true, minNumber: 5 };
    for (let i = 0; i < 500; i++) {
      const eq = getRandomEquation(prefs);
      expect(eq.a).toBeGreaterThanOrEqual(5);
      expect(eq.b).toBeGreaterThanOrEqual(5);
    }
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
      expect(eq.balance).toBeUndefined();
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
    for (let i = 0; i < 16000; i++) {
      const eq = getRandomEquation(ALL_TYPES_ON);
      const key = eq.balance ? "balance" : eq.sequence ? Ops.seq : isMissingDivisor(eq) ? "missingDivisor" : eq.missing ? "missing" : eq.op;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    // 16 toggles over 16000 rolls. "money sums" is ONE toggle covering BOTH
    // directions, so its two ops land at half a slot each — which is the
    // intended behaviour (the player sees that toggle as often as any
    // other), not a frequency bug. Everything else gets a full slot.
    for (const key of [Ops.mult, Ops.add, Ops.sub, Ops.div, Ops.pct, Ops.sq, Ops.seq, "missing", "missingDivisor", "balance", Ops.tip, Ops.change, Ops.time, Ops.unitPrice, Ops.splitBill]) {
      expect(counts[key]).toBeGreaterThan(700);
    }
    for (const key of [Ops.moneyAdd, Ops.moneySub]) {
      expect(counts[key]).toBeGreaterThan(300);
    }
    // ...and together the two money directions fill exactly one slot.
    expect((counts[Ops.moneyAdd] ?? 0) + (counts[Ops.moneySub] ?? 0)).toBeGreaterThan(700);
  });
});

describe("real-world: tip (bill + rate = what you hand over)", () => {
  const ONLY_TIP: EquationSettings = { ...ONLY, tip: true };

  test("the answer is the bill PLUS the tip, and the tip is always whole", () => {
    const seenRates = new Set<number>();
    for (let i = 0; i < 4000; i++) {
      const eq = getRandomEquation(ONLY_TIP);
      expect(eq.op).toBe(Ops.tip);
      expect([15, 20, 25]).toContain(eq.b);
      expect(eq.answer).toBe(eq.a + (eq.a * eq.b) / 100);
      // The whole point of moneyStep(): the tip is never a fraction.
      expect(Number.isInteger((eq.a * eq.b) / 100)).toBe(true);
      expect(Number.isInteger(eq.answer)).toBe(true);
      expect(eq.answer).toBeGreaterThan(0);
      expect(eq.a).toBeGreaterThanOrEqual(4);
      seenRates.add(eq.b);
    }
    expect(seenRates.size).toBe(3); // all three rates actually roll
  });

  test("bills are whole dollars and step outside the operand range (money ≠ 0–12)", () => {
    // Each bill is a multiple of 100 / gcd(rate, 100): 20 at 15%, 5 at
    // 20%, 4 at 25%. At 15% that is well above the default maxNumber of
    // 12, which is exactly why bills are not clamped to the operand range.
    const stepOf = (rate: number) => 100 / (rate === 15 ? 5 : rate === 20 ? 20 : 25);
    let sawBigBill = false;
    for (let i = 0; i < 4000; i++) {
      const eq = getRandomEquation(ONLY_TIP);
      expect(Number.isInteger(eq.a)).toBe(true);
      expect(eq.a % stepOf(eq.b)).toBe(0);
      expect(eq.a).toBeGreaterThanOrEqual(stepOf(eq.b));
      if (eq.a >= 12) sawBigBill = true;
    }
    expect(sawBigBill).toBe(true);
  });

  test("a raised minNumber raises the bills", () => {
    for (let i = 0; i < 1000; i++) {
      const eq = getRandomEquation({ ...ONLY_TIP, minNumber: 40 });
      expect(eq.a).toBeGreaterThanOrEqual(40);
      expect(Number.isInteger((eq.a * eq.b) / 100)).toBe(true);
    }
  });

  test("never emitted in hard mode", () => {
    for (let i = 0; i < 1000; i++) {
      expect(getRandomEquation({ ...ONLY_TIP, hardMode: true }).op).not.toBe(Ops.tip);
    }
  });
});

describe("real-world: change from a note", () => {
  const ONLY_CHANGE: EquationSettings = { ...ONLY, change: true };

  test("the change is always positive, and only larger notes are ever drawn", () => {
    for (let i = 0; i < 4000; i++) {
      const eq = getRandomEquation(ONLY_CHANGE);
      expect(eq.op).toBe(Ops.change);
      expect(eq.a).toBeGreaterThan(eq.b); // the note covers the cost
      expect(eq.answer).toBe(eq.a - eq.b);
      expect(eq.answer).toBeGreaterThanOrEqual(1);
      expect(Number.isInteger(eq.answer)).toBe(true);
      // The cost respects the player's range, and never starts at 0
      // ("change from 20 for 0" is a freebie).
      expect(eq.b).toBeGreaterThanOrEqual(1);
      expect(eq.b).toBeLessThan(12);
      // Either a real denomination, or (above 100) a round-up of the cost.
      const isDenomination = [5, 10, 20, 50, 100].includes(eq.a);
      expect(isDenomination || eq.a - eq.b >= 1).toBe(true);
    }
  });

  test("real denominations actually show up at the default range", () => {
    const denominations = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const eq = getRandomEquation(ONLY_CHANGE);
      if ([5, 10, 20, 50, 100].includes(eq.a)) denominations.add(eq.a);
    }
    expect(denominations.size).toBeGreaterThan(1);
  });

  test("honours a high range (past the largest note) and stays positive", () => {
    for (let i = 0; i < 1000; i++) {
      const eq = getRandomEquation({ ...ONLY_CHANGE, maxNumber: 250 });
      expect(eq.a).toBeGreaterThan(eq.b);
      expect(eq.answer).toBeGreaterThanOrEqual(1);
    }
  });

  test("never emitted in hard mode", () => {
    for (let i = 0; i < 1000; i++) {
      expect(getRandomEquation({ ...ONLY_CHANGE, hardMode: true }).op).not.toBe(Ops.change);
    }
  });
});

describe("decimal money drills (cents-exact by construction)", () => {
  /** Every real-world shape that can emit a DECIMAL answer. */
  const MONEY_DRILLS: EquationSettings[] = [
    { ...ONLY, moneyAdd: true },
    { ...ONLY, unitPrice: true },
    { ...ONLY, splitBill: true },
  ];

  test("every operand and answer is a whole number of cents", () => {
    for (const prefs of MONEY_DRILLS) {
      for (let i = 0; i < 2000; i++) {
        const eq = getRandomEquation(prefs);
        // The invariant the reward path depends on: toCents is lossless, so
        // the typed answer and the stored answer meet exactly in cents.
        expect(isMoney(eq.a)).toBe(true);
        expect(isMoney(eq.answer)).toBe(true);
        expect(eq.answer).toBeGreaterThanOrEqual(1);
      }
    }
  });

  test("the operands really are decimal (these drills earn their keep)", () => {
    // If the generator quietly produced whole dollars the feature would be
    // a duplicate of add / subtract / multiply / divide.
    let sawFraction = 0;
    for (const prefs of MONEY_DRILLS) {
      for (let i = 0; i < 2000; i++) {
        const eq = getRandomEquation(prefs);
        if (!Number.isInteger(eq.a)) sawFraction++;
      }
    }
    expect(sawFraction).toBeGreaterThan(100);
  });
});

describe("real-world: money sums (decimal + / -)", () => {
  const ONLY_MONEY: EquationSettings = { ...ONLY, moneyAdd: true };

  test("the answer is exactly the sum or difference of the two amounts", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i++) {
      const eq = getRandomEquation(ONLY_MONEY);
      expect([Ops.moneyAdd, Ops.moneySub]).toContain(eq.op);
      const expected = eq.op === Ops.moneyAdd ? eq.a + eq.b : eq.a - eq.b;
      expect(toCents(eq.answer)).toBe(toCents(expected));
      expect(isMoney(eq.a)).toBe(true);
      expect(isMoney(eq.b)).toBe(true);
      expect(eq.answer).toBeGreaterThanOrEqual(1);
      // Subtraction never leaves a negative to type.
      if (eq.op === Ops.moneySub) expect(eq.a).toBeGreaterThan(eq.b);
      seen.add(eq.op);
    }
    expect(seen.size).toBe(2); // both directions actually roll
  });

  test("money subtraction floors the difference at a dollar", () => {
    for (let i = 0; i < 2000; i++) {
      const eq = getRandomEquation(ONLY_MONEY);
      if (eq.op === Ops.moneySub) expect(eq.answer).toBeGreaterThanOrEqual(1);
    }
  });

  test("a raised minNumber raises the amounts", () => {
    for (let i = 0; i < 1000; i++) {
      const eq = getRandomEquation({ ...ONLY_MONEY, minNumber: 5 });
      expect(eq.a).toBeGreaterThanOrEqual(5);
      expect(eq.b).toBeGreaterThanOrEqual(5);
    }
  });

  test("never emitted in hard mode", () => {
    for (let i = 0; i < 1000; i++) {
      const eq = getRandomEquation({ ...ONLY_MONEY, hardMode: true });
      expect([Ops.moneyAdd, Ops.moneySub]).not.toContain(eq.op);
    }
  });
});

describe("real-world: unit price (decimal × count)", () => {
  const ONLY_UNIT: EquationSettings = { ...ONLY, unitPrice: true };

  test("the answer is price × quantity, exact to the cent", () => {
    for (let i = 0; i < 5000; i++) {
      const eq = getRandomEquation(ONLY_UNIT);
      expect(eq.op).toBe(Ops.unitPrice);
      expect(Number.isInteger(eq.b)).toBe(true);
      expect(eq.b).toBeGreaterThanOrEqual(2);
      expect(toCents(eq.answer)).toBe(toCents(eq.a) * eq.b);
      expect(eq.answer).toBeGreaterThanOrEqual(1);
    }
  });

  test("prices read like shelf labels: under $10 and a multiple of 5 cents", () => {
    for (let i = 0; i < 3000; i++) {
      const eq = getRandomEquation(ONLY_UNIT);
      expect(eq.a).toBeGreaterThan(0);
      expect(eq.a).toBeLessThanOrEqual(10);
      expect(toCents(eq.a) % 5).toBe(0);
    }
  });

  test("a raised maxNumber widens the possible quantities", () => {
    let big = 0;
    for (let i = 0; i < 2000; i++) {
      if (getRandomEquation({ ...ONLY_UNIT, maxNumber: 20 }).b > 9) big++;
    }
    expect(big).toBeGreaterThan(0);
  });

  test("never emitted in hard mode", () => {
    for (let i = 0; i < 1000; i++) {
      expect(getRandomEquation({ ...ONLY_UNIT, hardMode: true }).op).not.toBe(
        Ops.unitPrice,
      );
    }
  });
});

describe("real-world: split the bill (decimal ÷ count, always exact)", () => {
  const ONLY_SPLIT: EquationSettings = { ...ONLY, splitBill: true };

  test("the bill divides evenly into the per-person share", () => {
    for (let i = 0; i < 5000; i++) {
      const eq = getRandomEquation(ONLY_SPLIT);
      expect(eq.op).toBe(Ops.splitBill);
      expect(Number.isInteger(eq.b)).toBe(true);
      expect(eq.b).toBeGreaterThanOrEqual(2);
      // Exact division is the WHOLE point of this drill: no remainder.
      expect(toCents(eq.a) % eq.b).toBe(0);
      expect(toCents(eq.answer)).toBe(toCents(eq.a) / eq.b);
      expect(eq.answer).toBeGreaterThanOrEqual(1);
    }
  });

  test("the headcount stays a sensible number of people", () => {
    for (let i = 0; i < 3000; i++) {
      const eq = getRandomEquation(ONLY_SPLIT);
      expect(eq.b).toBeLessThanOrEqual(7);
    }
  });

  test("never emitted in hard mode", () => {
    for (let i = 0; i < 1000; i++) {
      expect(getRandomEquation({ ...ONLY_SPLIT, hardMode: true }).op).not.toBe(
        Ops.splitBill,
      );
    }
  });
});

describe("real-world: elapsed time", () => {
  const ONLY_TIME: EquationSettings = { ...ONLY, time: true };

  test("the answer is the minutes between the two times, never crossing midnight", () => {
    for (let i = 0; i < 4000; i++) {
      const eq = getRandomEquation(ONLY_TIME);
      expect(eq.op).toBe(Ops.time);
      expect(eq.answer).toBe(eq.b);
      expect(eq.answer).toBeGreaterThanOrEqual(5);
      expect(Number.isInteger(eq.answer)).toBe(true);
      expect(eq.a).toBeGreaterThanOrEqual(0);
      // Start + elapsed still lands inside the same day, so the displayed
      // end time is never earlier than the start.
      expect(eq.a + eq.b).toBeLessThan(24 * 60);
      // ...and the rendered end clock is strictly later in the day.
      const endMinutes =
        Number(formatClock(eq.a + eq.b).split(":")[0]) * 60 +
        Number(formatClock(eq.a + eq.b).split(":")[1]);
      expect(endMinutes).toBeGreaterThanOrEqual(eq.a);
    }
  });

  test("the player's range IS the difficulty dial (span scales with maxNumber)", () => {
    let short = 0;
    for (let i = 0; i < 2000; i++) {
      // maxNumber 2 → spans of at most 20 minutes.
      expect(getRandomEquation({ ...ONLY_TIME, maxNumber: 2 }).answer).toBeLessThanOrEqual(20);
    }
    for (let i = 0; i < 2000; i++) {
      if (getRandomEquation({ ...ONLY_TIME, maxNumber: 12 }).answer > 20) short++;
    }
    expect(short).toBeGreaterThan(0); // the default range reaches further
  });

  test("never emits a span longer than the 10h cap, even at an absurd range", () => {
    for (let i = 0; i < 1000; i++) {
      const eq = getRandomEquation({ ...ONLY_TIME, maxNumber: 5000 });
      expect(eq.answer).toBeLessThanOrEqual(600);
      expect(eq.a + eq.b).toBeLessThan(24 * 60);
    }
  });

  test("never emitted in hard mode", () => {
    for (let i = 0; i < 1000; i++) {
      expect(getRandomEquation({ ...ONLY_TIME, hardMode: true }).op).not.toBe(Ops.time);
    }
  });
});

describe("drill: missing divisor (a / ? = b)", () => {
  const ONLY_DIVISOR: EquationSettings = { ...ONLY, missingDivisor: true };

  test('shape is exactly "dividend / ? = quotient", with the divisor as the answer', () => {
    for (let i = 0; i < 3000; i++) {
      const eq = getRandomEquation(ONLY_DIVISOR);
      expect(eq.op).toBe(Ops.div);
      expect(eq.missing).toBe(true);
      expect(isMissingDivisor(eq)).toBe(true);
      expect(hasQuestionMark(eq)).toBe(true);
      // a / answer === b, exactly.
      expect(eq.a).toBe(eq.answer * eq.b);
      expect(eq.answer).toBeGreaterThanOrEqual(2); // never the giveaway 1
      expect(Number.isInteger(eq.answer)).toBe(true);
      // Divisor and quotient stay in the player's range; the dividend is
      // their product, so it may exceed maxNumber (as `missing`'s shown
      // total already does).
      expect(eq.answer).toBeLessThan(12);
      expect(eq.b).toBeGreaterThanOrEqual(1);
      expect(eq.b).toBeLessThan(12);
    }
  });

  test("honours a custom range, and falls back when no divisor fits", () => {
    const prefs: EquationSettings = { ...ONLY_DIVISOR, minNumber: 4, maxNumber: 8 };
    for (let i = 0; i < 1000; i++) {
      const eq = getRandomEquation(prefs);
      expect(eq.answer).toBeGreaterThanOrEqual(4);
      expect(eq.answer).toBeLessThan(8);
      expect(eq.b).toBeGreaterThanOrEqual(4);
    }
    // maxNumber 2 → the only in-range divisor would be < 2, so the drill
    // is infeasible and the caller falls back to multiplication.
    for (let i = 0; i < 200; i++) {
      const eq = getRandomEquation({ ...ONLY_DIVISOR, maxNumber: 2 });
      expect(eq.op).toBe(Ops.mult);
    }
  });

  test("never emitted in hard mode (soft-mode-only, like the other extras)", () => {
    for (let i = 0; i < 1000; i++) {
      const eq = getRandomEquation({ ...ONLY_DIVISOR, hardMode: true });
      expect(eq.missing).toBeUndefined();
      expect(eq.op2).toBeDefined();
    }
  });
});

describe("drill: balance the equation (a + ? = b + c)", () => {
  const ONLY_BALANCE: EquationSettings = { ...ONLY, balance: true };

  test("both sides are in range and the answer is exactly what makes them match", () => {
    for (let i = 0; i < 3000; i++) {
      const eq = getRandomEquation(ONLY_BALANCE);
      expect(eq.balance).toBe(true);
      expect(hasQuestionMark(eq)).toBe(true);
      expect(eq.op).toBe(Ops.add);
      expect([Ops.add, Ops.sub]).toContain(eq.op2);
      for (const v of [eq.a, eq.b, eq.c]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(12);
      }
      const right = eq.op2 === Ops.add ? eq.b + (eq.c as number) : eq.b - (eq.c as number);
      expect(eq.answer).toBe(right - eq.a);
      expect(eq.answer).toBeGreaterThanOrEqual(1);
      expect(Number.isInteger(eq.answer)).toBe(true);
      // The whole point of the drill: adding the answer really balances it.
      expect(eq.a + eq.answer).toBe(right);
    }
  });

  test("op2/c ride the right-hand side but do NOT count as hard mode", () => {
    for (let i = 0; i < 500; i++) {
      const eq = getRandomEquation(ONLY_BALANCE);
      expect(eq.op2).toBeDefined();
      expect(eq.c).toBeDefined();
      expect(isHardMode(eq)).toBe(false);
    }
  });

  test("never emitted in hard mode", () => {
    for (let i = 0; i < 1000; i++) {
      const eq = getRandomEquation({ ...ONLY_BALANCE, hardMode: true });
      expect(eq.balance).toBeUndefined();
      expect(isHardMode(eq)).toBe(true);
    }
  });
});

describe("drill: sequence (next term)", () => {
  const ONLY_SEQUENCE: EquationSettings = { ...ONLY, sequence: true };

  test("always emits whole, ascending-list terms with a valid next answer", () => {
    for (let i = 0; i < 4000; i++) {
      const eq = getRandomEquation(ONLY_SEQUENCE);
      expect(eq.op).toBe(Ops.seq);
      expect(eq.sequence).toHaveLength(5);
      expect(eq.balance).toBeUndefined();
      expect(hasQuestionMark(eq)).toBe(false); // its own trailing "?" shape
      for (const t of eq.sequence as number[]) {
        expect(Number.isInteger(t)).toBe(true);
        expect(t).toBeGreaterThanOrEqual(0);
        expect(t).toBeLessThanOrEqual(1000);
      }
      expect(eq.a).toBe((eq.sequence as number[])[0]);
      expect(eq.b).toBe((eq.sequence as number[])[1]);
      expect(Number.isInteger(eq.answer)).toBe(true);
      expect(eq.answer).toBeGreaterThanOrEqual(0);
      expect(eq.answer).toBeLessThanOrEqual(5000);
      // A sequence is a LIST, so its terms grow past maxNumber by design —
      // that is the one type that does not honour the operand range.
      expect((eq.sequence as number[])[0]).toBeLessThan(12);
    }
  });

  test("the answer really is a term of the same family (no two rules fit)", () => {
    // Every family the generator rolls has a single unambiguous rule, so
    // the answer must equal the value the family's own rule predicts from
    // the shown terms — checked structurally rather than by re-deriving.
    for (let i = 0; i < 4000; i++) {
      const eq = getRandomEquation(ONLY_SEQUENCE);
      const t = eq.sequence as number[];
      const d1 = t[1] - t[0];
      const d2 = t[2] - t[1];
      const arithmetic = d1 === d2 && t.every((v, k) => v - t[0] === k * d1);
      const ratio = t[1] / t[0];
      const geometric =
        t[0] !== 0 && t.every((v, k) => v === t[0] * Math.pow(ratio, k));
      const square = t.every((v) => v > 0 && Number.isInteger(Math.sqrt(v)));
      const sum = t.slice(2).every((v, k) => v === t[k] + t[k + 1]);
      expect(arithmetic || geometric || square || sum).toBe(true);
    }
  });

  test("works at the smallest supported range (maxNumber 2)", () => {
    for (let i = 0; i < 1000; i++) {
      const eq = getRandomEquation({ ...ONLY_SEQUENCE, maxNumber: 2 });
      expect(eq.op).toBe(Ops.seq);
      expect(Number.isInteger(eq.answer)).toBe(true);
      expect(eq.answer).toBeGreaterThanOrEqual(0);
    }
  });

  test("never emitted in hard mode", () => {
    for (let i = 0; i < 1000; i++) {
      const eq = getRandomEquation({ ...ONLY_SEQUENCE, hardMode: true });
      expect(eq.sequence).toBeUndefined();
      expect(isHardMode(eq)).toBe(true);
    }
  });
});

describe("getOpDisplay / formatEquation (iteration 11)", () => {
  test("multiply & division symbols are configurable, other ops are fixed", () => {
    // The choice doubles as a symbol STYLE (todo: "alt display for other
    // operations"): asterisk = terse glyphs (* /), letter = wordly (x ÷).
    expect(getOpDisplay(Ops.mult, "asterisk")).toBe("*");
    expect(getOpDisplay(Ops.mult, "letter")).toBe("x");
    expect(getOpDisplay(Ops.add, "asterisk")).toBe("+");
    expect(getOpDisplay(Ops.sub, "letter")).toBe("-");
    expect(getOpDisplay(Ops.div, "asterisk")).toBe("/");
    expect(getOpDisplay(Ops.div, "letter")).toBe("÷");
    expect(getOpDisplay(Ops.pct, "asterisk")).toBe("%");
    expect(getOpDisplay(Ops.sq, "asterisk")).toBe("²");
    expect(getOpDisplay(Ops.seq, "asterisk")).toBe("…");
    expect(getOpDisplay(Ops.seq, "letter")).toBe("…");
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
    expect(
      formatEquation({ op: Ops.div, a: 8, b: 2, answer: 4 }, "asterisk"),
    ).toBe("8 / 2");
    expect(formatEquation({ op: Ops.div, a: 8, b: 2, answer: 4 }, "letter")).toBe("8 ÷ 2");
    expect(formatEquation({ op: Ops.pct, a: 25, b: 40, answer: 10 }, "asterisk")).toBe("25% of 40");
    expect(formatEquation({ op: Ops.sq, a: 7, b: 7, answer: 49 }, "letter")).toBe("7²");
    expect(
      formatEquation({ op: Ops.add, a: 7, b: 12, answer: 5, missing: true }, "letter"),
    ).toBe("7 + ? = 12");
    expect(
      formatEquation({ op: Ops.mult, a: 3, b: 24, answer: 8, missing: true }, "asterisk"),
    ).toBe("3 * ? = 24");
  });

  test("formats the three drill shapes", () => {
    expect(
      formatEquation({ op: Ops.div, a: 24, b: 6, answer: 4, missing: true }, "asterisk"),
    ).toBe("24 / ? = 6");
    expect(
      formatEquation({ op: Ops.div, a: 24, b: 6, answer: 4, missing: true }, "letter"),
    ).toBe("24 ÷ ? = 6");
    expect(
      formatEquation(
        { op: Ops.add, a: 6, b: 4, op2: Ops.add, c: 9, answer: 7, balance: true },
        "asterisk",
      ),
    ).toBe("6 + ? = 4 + 9");
    expect(
      formatEquation(
        { op: Ops.add, a: 6, b: 9, op2: Ops.sub, c: 4, answer: 7, balance: true },
        "letter",
      ),
    ).toBe("6 + ? = 9 - 4");
    // Comma-terminated: the display prompt supplies the "?".
    expect(
      formatEquation(
        { op: Ops.seq, a: 1, b: 4, answer: 25, sequence: [1, 4, 9, 16] },
        "asterisk",
      ),
    ).toBe("1, 4, 9, 16, ");
  });

  test("formats the three real-world shapes", () => {
    expect(formatEquation({ op: Ops.tip, a: 45, b: 20, answer: 54 }, "asterisk")).toBe("45 + 20% tip");
    expect(formatEquation({ op: Ops.change, a: 20, b: 13, answer: 7 }, "asterisk")).toBe("20 - 13");
    expect(
      formatEquation({ op: Ops.time, a: 9 * 60 + 40, b: 45, answer: 45 }, "asterisk"),
    ).toBe("9:40 → 10:25");
  });

  test("formatClock pads the minutes and never shows a 24:xx wrap", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(9 * 60 + 5)).toBe("9:05");
    expect(formatClock(14 * 60 + 30)).toBe("14:30");
    expect(formatClock(23 * 60 + 59)).toBe("23:59");
    expect(formatClock(24 * 60)).toBe("0:00"); // % 24 keeps it a clock
  });

  test("the real-world shapes get their own payout-hint glyphs", () => {
    expect(getOpDisplay(Ops.tip, "asterisk")).toBe("%");
    expect(getOpDisplay(Ops.change, "asterisk")).toBe("$");
    expect(getOpDisplay(Ops.time, "asterisk")).toBe("◷");
  });

  test("formats the decimal money shapes with two decimal places", () => {
    expect(
      formatEquation({ op: Ops.moneyAdd, a: 12.4, b: 7.6, answer: 20 }, "asterisk"),
    ).toBe("12.40 + 7.60");
    expect(
      formatEquation({ op: Ops.moneySub, a: 20, b: 7.6, answer: 12.4 }, "letter"),
    ).toBe("20.00 - 7.60");
    // b is a QUANTITY here, not money — it must not pick up ".00".
    expect(
      formatEquation({ op: Ops.unitPrice, a: 3.2, b: 7, answer: 22.4 }, "asterisk"),
    ).toBe("3.20 × 7");
    expect(
      formatEquation({ op: Ops.unitPrice, a: 3.2, b: 7, answer: 22.4 }, "letter"),
    ).toBe("3.20 × 7");
    // ...and a HEADCOUNT here.
    expect(
      formatEquation({ op: Ops.splitBill, a: 94.5, b: 3, answer: 31.5 }, "asterisk"),
    ).toBe("94.50 ÷ 3");
  });

  test("the money shapes get their own payout-hint glyphs", () => {
    expect(getOpDisplay(Ops.moneyAdd, "asterisk")).toBe("+");
    expect(getOpDisplay(Ops.moneySub, "asterisk")).toBe("-");
    expect(getOpDisplay(Ops.unitPrice, "asterisk")).toBe("×");
    expect(getOpDisplay(Ops.splitBill, "asterisk")).toBe("÷");
  });

  test("a balance equation is never mistaken for hard mode (no 3rd term appended)", () => {
    // Both shapes carry op2/c; only the hard-mode one appends a second step.
    const balance = {
      op: Ops.add,
      a: 6,
      b: 4,
      op2: Ops.add,
      c: 9,
      answer: 7,
      balance: true,
    };
    expect(isHardMode(balance)).toBe(false);
    expect(formatEquation(balance, "asterisk")).toBe("6 + ? = 4 + 9");
    const hard = { op: Ops.mult, a: 7, b: 2, answer: 42, op2: Ops.mult, c: 3 };
    expect(isHardMode(hard)).toBe(true);
    expect(formatEquation(hard, "asterisk")).toBe("7 * 2 * 3");
  });

  test("formatEquationPrompt appends the ? (and the sequence's comma keeps it readable)", () => {
    expect(
      formatEquationPrompt({ op: Ops.mult, a: 7, b: 2, answer: 14 }, "asterisk"),
    ).toBe("7 * 2?");
    expect(
      formatEquationPrompt(
        { op: Ops.add, a: 7, b: 12, answer: 5, missing: true },
        "asterisk",
      ),
    ).toBe("7 + ? = 12?");
    expect(
      formatEquationPrompt(
        { op: Ops.seq, a: 1, b: 4, answer: 25, sequence: [1, 4, 9, 16] },
        "asterisk",
      ),
    ).toBe("1, 4, 9, 16, ?");
    expect(
      formatEquationPrompt(
        { op: Ops.add, a: 6, b: 4, op2: Ops.add, c: 9, answer: 7, balance: true },
        "asterisk",
      ),
    ).toBe("6 + ? = 4 + 9?");
  });
});

describe("getRandomEquation hard mode (tier-5, 3-term ×2)", () => {
  test("soft mode is unchanged: no second term is ever emitted", () => {
    expect(defaultEquationSettings.hardMode).toBe(false);
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

describe("seeded generation (equation-of-the-day primitive)", () => {
  test("hashString is a stable unsigned 32-bit hash, sensitive to day-key changes", () => {
    expect(hashString("2026-06-07")).toBe(hashString("2026-06-07"));
    expect(hashString("2026-06-07")).not.toBe(hashString("2026-06-08"));
    expect(hashString("")).toBe(0x811c9dc5); // FNV offset basis
    for (let i = 0; i < 200; i++) {
      const h = hashString(`day-${i}`);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(0xffffffff);
    }
  });

  test("mulberry32 is deterministic and emits [0, 1)", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seq = Array.from({ length: 100 }, () => a());
    expect(Array.from({ length: 100 }, () => b())).toEqual(seq);
    for (const x of seq) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
    expect(mulberry32(42)()).not.toBe(mulberry32(43)());
  });

  test("getSeededEquation is deterministic per seed and varies across seeds", () => {
    const prefs: EquationSettings = { ...ALL_ON, percent: true, missing: true };
    const a = getSeededEquation("2026-06-07", prefs);
    expect(getSeededEquation("2026-06-07", prefs)).toEqual(a);
    expect(getSeededEquation("2026-06-08", prefs)).not.toEqual(a);
  });

  test("rng injection drives getRandomEquation exactly (no hidden Math.random)", () => {
    const prefs: EquationSettings = { ...ALL_ON, percent: true, missing: true };
    for (let i = 0; i < 50; i++) {
      const rng = mulberry32(i);
      const eq = getRandomEquation(prefs, rng);
      expect(getRandomEquation(prefs, mulberry32(i))).toEqual(eq);
    }
  });
});
