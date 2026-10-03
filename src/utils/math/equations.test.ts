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
  discount: false,
  splitBill: false,
  unitPrice: false,
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
  discount: true,
  splitBill: true,
  unitPrice: true,
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
    expect(defaultEquationSettings.discount).toBe(false);
    expect(defaultEquationSettings.splitBill).toBe(false);
    expect(defaultEquationSettings.unitPrice).toBe(false);
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
    // 16 toggles over 16000 rolls: every kind should land near a full slot.
    for (const key of [Ops.mult, Ops.add, Ops.sub, Ops.div, Ops.pct, Ops.sq, Ops.seq, "missing", "missingDivisor", "balance", Ops.tip, Ops.discount, Ops.change, Ops.time, Ops.splitBill, Ops.unitPrice]) {
      expect(counts[key]).toBeGreaterThan(700);
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

describe("whole operands, decimal answers", () => {
  /** Every shape that can put cents in the ANSWER. */
  const DECIMAL_DRILLS: EquationSettings[] = [
    { ...ONLY, tip: true },
    { ...ONLY, discount: true },
    { ...ONLY, splitBill: true },
    { ...ONLY, unitPrice: true },
  ];

  test("no equation EVER shows a decimal operand — only the answer", () => {
    // The house rule: every number the game displays is a whole number, so
    // the money drills read like every other equation and the cents show up
    // only where they belong (in what the player types).
    const everything: EquationSettings = { ...ALL_ON, ...ALL_TYPES_ON };
    for (let i = 0; i < 20000; i++) {
      const eq = getRandomEquation(everything);
      for (const v of [eq.a, eq.b, eq.c ?? eq.a]) {
        expect(Number.isInteger(v)).toBe(true);
      }
    }
  });

  test("a decimal answer is always a whole number of cents", () => {
    // isMoney is the invariant the reward path depends on: toCents is
    // lossless, so the typed answer and the stored answer meet exactly.
    for (const prefs of DECIMAL_DRILLS) {
      for (let i = 0; i < 3000; i++) {
        const eq = getRandomEquation(prefs);
        expect(isMoney(eq.answer)).toBe(true);
        expect(eq.answer).toBeGreaterThanOrEqual(1);
      }
    }
  });

  test("these drills really do produce decimal answers (they earn their keep)", () => {
    let withCents = 0;
    for (const prefs of DECIMAL_DRILLS) {
      for (let i = 0; i < 3000; i++) {
        if (!Number.isInteger(getRandomEquation(prefs).answer)) withCents++;
      }
    }
    expect(withCents).toBeGreaterThan(500);
  });
});

describe("real-world: tip (whole bill + whole rate = a total in cents)", () => {
  const ONLY_TIP: EquationSettings = { ...ONLY, tip: true };

  test("the answer is the bill grossed up by the rate, exact to the cent", () => {
    for (let i = 0; i < 5000; i++) {
      const eq = getRandomEquation(ONLY_TIP);
      expect(eq.op).toBe(Ops.tip);
      expect([15, 20, 25]).toContain(eq.b);
      expect(Number.isInteger(eq.a)).toBe(true);
      expect(Number.isInteger(eq.b)).toBe(true);
      expect(toCents(eq.answer)).toBe(toCents((eq.a * (100 + eq.b)) / 100));
      expect(eq.answer).toBeGreaterThanOrEqual(1);
    }
  });

  test("15% is finally reachable — it needs cents to come out", () => {
    // This is the rate the old moneyStep() filter had to exclude, because
    // 15% of a whole bill is only ever whole for bills that are multiples
    // of 20. With a decimal answer the bill no longer has to cooperate.
    let saw15 = false;
    let sawCents = false;
    for (let i = 0; i < 5000; i++) {
      const eq = getRandomEquation(ONLY_TIP);
      if (eq.b === 15) {
        saw15 = true;
        if (!Number.isInteger(eq.answer)) sawCents = true;
      }
    }
    expect(saw15).toBe(true);
    expect(sawCents).toBe(true);
  });

  test("the player-set range still scales the bills", () => {
    // moneyWindow maps the range onto dollars: minNumber is the floor and
    // 5 × maxNumber the ceiling (a 0–12 dial has no $45 in it).
    for (let i = 0; i < 1000; i++) {
      const eq = getRandomEquation({ ...ONLY_TIP, minNumber: 20, maxNumber: 40 });
      expect(eq.a).toBeGreaterThanOrEqual(20);
      expect(eq.a).toBeLessThanOrEqual(200); // 5 × 40
    }
  });

  test("never emitted in hard mode", () => {
    for (let i = 0; i < 1000; i++) {
      expect(getRandomEquation({ ...ONLY_TIP, hardMode: true }).op).not.toBe(Ops.tip);
    }
  });
});

describe("real-world: discount (the mirror of tip)", () => {
  const ONLY_DISCOUNT: EquationSettings = { ...ONLY, discount: true };

  test("the answer is the price net of the rate, exact to the cent", () => {
    for (let i = 0; i < 5000; i++) {
      const eq = getRandomEquation(ONLY_DISCOUNT);
      expect(eq.op).toBe(Ops.discount);
      expect([15, 20, 25]).toContain(eq.b);
      expect(Number.isInteger(eq.a)).toBe(true);
      expect(toCents(eq.answer)).toBe(toCents((eq.a * (100 - eq.b)) / 100));
      expect(eq.answer).toBeGreaterThanOrEqual(1);
    }
  });

  test("a discount is always worth less than the sticker price", () => {
    for (let i = 0; i < 3000; i++) {
      const eq = getRandomEquation(ONLY_DISCOUNT);
      expect(eq.answer).toBeLessThan(eq.a);
    }
  });

  test("never emitted in hard mode", () => {
    for (let i = 0; i < 1000; i++) {
      expect(
        getRandomEquation({ ...ONLY_DISCOUNT, hardMode: true }).op,
      ).not.toBe(Ops.discount);
    }
  });
});

describe("real-world: split the bill (whole bill, whole headcount)", () => {
  const ONLY_SPLIT: EquationSettings = { ...ONLY, splitBill: true };

  test("the division is EXACT — a bill that needs rounding is never drawn", () => {
    for (let i = 0; i < 5000; i++) {
      const eq = getRandomEquation(ONLY_SPLIT);
      expect(eq.op).toBe(Ops.splitBill);
      expect(Number.isInteger(eq.a)).toBe(true);
      expect(Number.isInteger(eq.b)).toBe(true);
      expect(eq.b).toBeGreaterThanOrEqual(2);
      // In CENTS the division must come out whole — that is the guarantee
      // that makes 95 / 3 unrepresentable and 90 / 4 = 22.50 fine.
      expect(toCents(eq.a) % eq.b).toBe(0);
      expect(toCents(eq.answer)).toBe(toCents(eq.a) / eq.b);
      expect(eq.answer).toBeGreaterThanOrEqual(1);
    }
  });

  test("the share lands on cents when the headcount divides the dollars oddly", () => {
    // 8 is the interesting case: 90 / 8 = 11.25, which needs cents and is
    // still exact. That combination is the whole reason the drill exists.
    let sawCents = false;
    for (let i = 0; i < 8000; i++) {
      const eq = getRandomEquation({ ...ONLY_SPLIT, maxNumber: 12 });
      if (eq.b === 8 && !Number.isInteger(eq.answer)) sawCents = true;
    }
    expect(sawCents).toBe(true);
  });

  test("the headcount stays a sensible number of people", () => {
    for (let i = 0; i < 3000; i++) {
      const eq = getRandomEquation(ONLY_SPLIT);
      expect(eq.b).toBeLessThanOrEqual(8);
    }
  });

  test("never emitted in hard mode", () => {
    for (let i = 0; i < 1000; i++) {
      expect(
        getRandomEquation({ ...ONLY_SPLIT, hardMode: true }).op,
      ).not.toBe(Ops.splitBill);
    }
  });
});
describe("real-world: unit price (both directions under one toggle)", () => {
  const ONLY_UNIT: EquationSettings = { ...ONLY, unitPrice: true };

  test("the multiply direction is price × count, both operands whole", () => {
    for (let i = 0; i < 3000; i++) {
      const eq = getRandomEquation(ONLY_UNIT);
      if (eq.unitEach !== false) continue;
      expect(eq.op).toBe(Ops.unitPrice);
      expect(Number.isInteger(eq.a)).toBe(true);
      expect(Number.isInteger(eq.b)).toBe(true);
      expect(eq.b).toBeGreaterThanOrEqual(3);
      expect(eq.answer).toBe(eq.a * eq.b);
      expect(Number.isInteger(eq.answer)).toBe(true);
    }
  });

  test("the divide direction is EXACT — a total that needs rounding is never drawn", () => {
    for (let i = 0; i < 5000; i++) {
      const eq = getRandomEquation(ONLY_UNIT);
      if (eq.unitEach !== true) continue;
      expect(eq.op).toBe(Ops.unitPrice);
      expect(Number.isInteger(eq.a)).toBe(true);
      // In CENTS the division must come out whole: 30 / 12 = 2.50 is
      // legal, 29 / 12 never is.
      expect(toCents(eq.a) % eq.b).toBe(0);
      expect(toCents(eq.answer)).toBe(toCents(eq.a) / eq.b);
      expect(eq.answer).toBeGreaterThanOrEqual(2);
      expect(eq.answer).toBeLessThan(eq.a);
    }
  });

  test("both directions actually roll — this is not just a multiply drill", () => {
    const dirs = new Set<boolean>();
    let eachWithCents = 0;
    for (let i = 0; i < 5000; i++) {
      const eq = getRandomEquation(ONLY_UNIT);
      dirs.add(eq.unitEach === true);
      if (eq.unitEach && !Number.isInteger(eq.answer)) eachWithCents++;
    }
    expect(dirs.size).toBe(2);
    // The cents only ever come from the divide direction — that is what
    // the toggle exists for.
    expect(eachWithCents).toBeGreaterThan(500);
  });

  test("the item count is a shop quantity, not a dinner table", () => {
    // The distinction from splitBill: many items (up to 20), not 2-8
    // people. Counts that high are what make a unit price land on cents
    // in ordinary shopping.
    let sawBig = false;
    for (let i = 0; i < 5000; i++) {
      const eq = getRandomEquation(ONLY_UNIT);
      expect(eq.b).toBeLessThanOrEqual(20);
      if (eq.b > 8) sawBig = true;
    }
    expect(sawBig).toBe(true);
  });

  test("never emitted in hard mode", () => {
    for (let i = 0; i < 1000; i++) {
      expect(getRandomEquation({ ...ONLY_UNIT, hardMode: true }).op).not.toBe(
        Ops.unitPrice,
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

  test("the money shapes render WHOLE operands, never a decimal", () => {
    expect(
      formatEquation({ op: Ops.tip, a: 45, b: 15, answer: 51.75 }, "asterisk"),
    ).toBe("45 + 15% tip");
    expect(
      formatEquation({ op: Ops.discount, a: 45, b: 15, answer: 38.25 }, "asterisk"),
    ).toBe("45 - 15% off");
    // The bill is a whole dollar; only the share can end in cents.
    expect(
      formatEquation({ op: Ops.splitBill, a: 90, b: 4, answer: 22.5 }, "asterisk"),
    ).toBe("90 / 4");
    expect(
      formatEquation({ op: Ops.splitBill, a: 90, b: 4, answer: 22.5 }, "letter"),
    ).toBe("90 ÷ 4");
  });

  test("unit price reads as a shopping question, not a bare multiply", () => {
    // Without the "each" the multiply direction would be character-for-
    // character a plain multiplication drill — the exact thing this toggle
    // used to collapse into.
    expect(
      formatEquation({ op: Ops.unitPrice, a: 4, b: 12, answer: 48, unitEach: false }, "asterisk"),
    ).toBe("4 each * 12");
    expect(
      formatEquation({ op: Ops.unitPrice, a: 4, b: 12, answer: 48, unitEach: false }, "letter"),
    ).toBe("4 each x 12");
    expect(
      formatEquation({ op: Ops.unitPrice, a: 30, b: 12, answer: 2.5, unitEach: true }, "asterisk"),
    ).toBe("30 / 12");
    expect(
      formatEquation({ op: Ops.unitPrice, a: 30, b: 12, answer: 2.5, unitEach: true }, "letter"),
    ).toBe("30 ÷ 12");
  });

  test("the money shapes get their own payout-hint glyphs", () => {
    expect(getOpDisplay(Ops.tip, "asterisk")).toBe("%");
    expect(getOpDisplay(Ops.discount, "asterisk")).toBe("%");
    expect(getOpDisplay(Ops.splitBill, "asterisk")).toBe("÷");
    expect(getOpDisplay(Ops.unitPrice, "asterisk")).toBe("×");
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
