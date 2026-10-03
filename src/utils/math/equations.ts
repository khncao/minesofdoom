import { fromCents, formatMoney } from "./money";

export type MultiplySymbol = "asterisk" | "letter";

/**
 * The toggleable equation TYPES in the settings panel. "missing" is a
 * display shape (a ○ ? = b) rather than an operator — the "?" is the
 * unknown operand and the answer is the missing number — but it lives in
 * the same settings record / toggle row as the rest.
 */
export const OPERATOR_KEYS = [
  "multiply",
  "add",
  "subtract",
  "division",
  "percent",
  "square",
  "missing",
] as const;
export type OperatorKey = (typeof OPERATOR_KEYS)[number];

/**
 * The DRILL equation types (todo: "More types of simple mental arithmetics
 * for all ages"): the inverse-operand, two-sided and next-in-sequence
 * shapes. Kept in their own list rather than appended to OPERATOR_KEYS
 * because that list is also the first-run setup step's row list (see
 * OnboardingOverlay) — ten 44px rows overflow the non-scrolling
 * onboarding card on a small phone, so the drills get a second group in
 * Settings instead of three more rows in the tour.
 *
 * All three are off by default, soft-mode only, and share the `missing`
 * drill family: the answer is always a whole number >= 1.
 */
export const DRILL_KEYS = ["missingDivisor", "balance", "sequence"] as const;
export type DrillKey = (typeof DRILL_KEYS)[number];

/**
 * The REAL-WORLD money/time types (todo: "More types of simple mental
 * arithmetics for all ages"): tipping, change from a note, elapsed time.
 * Their own group because — unlike the DRILL_KEYS shapes, which are
 * pure arithmetic — these three answer "how much do I owe / get back /
 * how long did that take", which is what a player is actually practising
 * outside the game.
 *
 * Same house rules as the drills: off by default, soft-mode only, and the
 * answer is always a whole number >= 1. Two of them (tip, change) step
 * outside [minNumber, maxNumber) because MONEY does not fit a 0–12
 * operand dial — see generateTipEquation.
 */
export const REAL_WORLD_KEYS = [
  "tip",
  "change",
  "time",
  "moneyAdd",
  "unitPrice",
  "splitBill",
] as const;
export type RealWorldKey = (typeof REAL_WORLD_KEYS)[number];

/** Every toggleable equation type (core operators + drills + real world). */
export type EquationTypeKey = OperatorKey | DrillKey | RealWorldKey;

export type EquationSettings = {
  minNumber: number;
  maxNumber: number;
  /**
   * Hard mode (tier-5 "Motherlode" endgame, plan §4.2): every equation is
   * 3 terms (a ○ b ○ c, evaluated strictly left-to-right) and every correct
   * answer pays HARD_MODE_PAYOUT (see game.ts). Off by default; the setting
   * is persisted under the existing equationSettingsKey, so no save bump.
   */
  hardMode: boolean;
  /**
   * How the multiplication and division operators render in the equation
   * display (todo: "Configurable equation display" + "alt display for
   * other operations"): "asterisk" = "7 * 2" / "7 / 2", "letter" =
   * "7 x 2" / "7 ÷ 2". The internal ops are always Ops.mult / Ops.div —
   * this is display only. (Legacy field name: it used to cover
   * multiplication alone; the persisted key is unchanged, so old saves
   * keep their choice.)
   */
  multiplySymbol: MultiplySymbol;
  /** multiply: "a * b" */
  multiply: boolean;
  /** add: "a + b" */
  add: boolean;
  /** subtract: "a - b" (a >= b, answer never negative) */
  subtract: boolean;
  /** division: "a / b" (always exact) */
  division: boolean;
  /** percent: "p% of N" with p in {10, 25, 50} (soft mode only) */
  percent: boolean;
  /** square: "a²" (soft mode only) */
  square: boolean;
  /** missing: "a + ? = b" / "a * ? = b" — find the ? (soft mode only) */
  missing: boolean;
  /** missingDivisor: "a / ? = b" — the divisor IS the answer (soft mode only) */
  missingDivisor: boolean;
  /** balance: "a + ? = b + c" — make both sides match (soft mode only) */
  balance: boolean;
  /** sequence: "1, 4, 9, 16, ?" — the next term (soft mode only) */
  sequence: boolean;
  /** tip: "45 + 20% tip" — what you hand over (soft mode only) */
  tip: boolean;
  /** change: "20 - 13" — change from a note (soft mode only) */
  change: boolean;
  /** time: "9:40 → 10:25" — minutes elapsed (soft mode only) */
  time: boolean;
  /** moneyAdd: "12.40 + 7.60" / "20.00 - 7.60" (soft mode only) */
  moneyAdd: boolean;
  /** unitPrice: "3.20 × 7" — the total for N (soft mode only) */
  unitPrice: boolean;
  /** splitBill: "94.50 ÷ 3" — the per-person share (soft mode only) */
  splitBill: boolean;
};

export const defaultEquationSettings: EquationSettings = {
  minNumber: 0,
  maxNumber: 12,
  multiply: true,
  add: false,
  subtract: false,
  division: false,
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

export const Ops = {
  mult: "*",
  add: "+",
  sub: "-",
  div: "/",
  /** percent: the equation shows "a% of b"; a = percent, b = base. */
  pct: "%",
  /** square: the equation shows "a²"; b mirrors a (unused otherwise). */
  sq: "sq",
  /**
   * sequence: the equation shows "1, 4, 9, 16, ?" — the terms live in
   * `Equation.sequence`, so a/b just mirror the first two (kept so every
   * consumer that reads operands sees a sane number).
   */
  seq: "seq",
  /** tip: the equation shows "45 + 20% tip"; a = bill, b = rate %. */
  tip: "tip",
  /** change: "20 - 13"; a = the note paid, b = the cost. */
  change: "chg",
  /** time: "9:40 → 10:25"; a = start (minutes past midnight),
   *  b = the elapsed minutes (which are also the answer). */
  time: "time",
  /**
   * The DECIMAL money types. Their op symbols ARE the glyphs they display
   * (formatMoney supplies the two decimal places), which is why they are
   * distinct from Ops.add/Ops.sub/Ops.mult: those render raw integers.
   */
  /** "12.40 + 7.60" — a = the first amount, b = the second (dollars). */
  moneyAdd: "+$",
  /** "20.00 - 7.60" */
  moneySub: "-$",
  /** "3.20 × 7" — a = unit price, b = quantity. */
  unitPrice: "×",
  /** "94.50 ÷ 3" — a = the total, b = the number of people. */
  splitBill: "÷",
};

export type Equation = {
  op: string;
  a: number;
  b: number;
  answer: number;
  /**
   * Hard mode only: the second step (a op b op2 c). Undefined in soft mode,
   * so soft-mode equations keep exactly today's 2-term shape and every
   * existing consumer stays source-compatible.
   */
  op2?: string;
  /** Hard mode only: the third operand (pair with op2). */
  c?: number;
  /**
   * Missing-number equations ("a ○ ? = b"): the unknown is the missing
   * OPERAND, `a` and `b` are the shown values, and `answer` is the number
   * that goes in the "?". Only ever emitted in soft mode (see
   * getRandomEquation) — a "?" can't compose into a 3-term equation.
   *
   * Combined with `op === Ops.div` this is the missing-DIVISOR shape
   * ("a ÷ ? = b"): the "?" is the divisor and `answer` is it (see
   * isMissingDivisor).
   */
  missing?: boolean;
  /**
   * Balance equations ("a + ? = b + c"): the unknown is the middle of a
   * two-sided equation, so the answer is (right side) − (left side). The
   * right-hand operator/operand ride in `op2`/`c` — the same slots hard
   * mode uses, which is why hard mode must be read through isHardMode()
   * and never as a bare `op2 !== undefined`. Only ever emitted in soft
   * mode.
   */
  balance?: boolean;
  /** Sequence equations ("1, 4, 9, 16, ?"): the shown terms, ascending
   *  step order. `answer` is the next term; a/b mirror terms[0]/terms[1]. */
  sequence?: number[];
};

/** "a ○ ? = b" — the shapes whose displayed text contains a literal "?". */
export function hasQuestionMark(eq: Equation): boolean {
  return eq.missing === true || eq.balance === true;
}

/**
 * The missing-DIVISOR drill ("24 ÷ ? = 6"): a missing-number equation
 * whose underlying op is division, so the "?" undoes the division
 * instead of an addition/multiplication.
 */
export function isMissingDivisor(eq: Equation): boolean {
  return eq.missing === true && eq.op === Ops.div;
}

/**
 * Hard-mode 3-term equations, keyed off the shape rather than a bare
 * `op2 !== undefined` — balance equations share the op2/c slots for the
 * right-hand side and must NOT pay the hard-mode premium.
 */
export function isHardMode(eq: Equation): boolean {
  return eq.op2 !== undefined && eq.balance !== true;
}

/** Uniform integer in [min, max) — matches the legacy getRandomInt(max) range.
 *  `rng` is injectable (defaults to Math.random) so the same guarantees can
 *  be driven by a seeded PRNG — that's what makes the deterministic
 *  "equation of the day" possible (see getSeededEquation). */
export function getRandomIntInRange(
  min: number,
  max: number,
  rng: () => number = Math.random,
): number {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return lo + Math.floor(rng() * (hi - lo));
}

// Kept for backwards compatibility with any existing callers.
export function getRandomInt(max: number) {
  return getRandomIntInRange(0, max);
}

// Friendly percentages (todo: "More types of simple mental arithmetics for
// all ages"): always integer answers, and 10/25/50% are the ones everyone
// is expected to do by sight.
const PERCENT_CHOICES = [10, 25, 50] as const;

/**
 * Generate a plain (soft-mode) 2-term equation for one op. Returns null
 * ONLY for percent when no base value fits [minNumber, maxNumber) at the
 * chosen maxNumber — callers re-pick an op in that case (and ultimately
 * fall back to multiplication, so the game is always playable).
 */
function generateTermsEquation(
  op: string,
  minNumber: number,
  maxNumber: number,
  rng: () => number = Math.random,
): Equation | null {
  // Multiplicative operands floor at 1 even when minNumber is 0 (todo:
  // "math:zero-operand"): with the default range [0, 12) about 16 % of
  // the × pool ("0 · n" / "n · 0") and 1/12 of the ² pool ("0²") were
  // zero-answer equations — trivially solvable and trivially rewarded
  // (the payout floors at Math.max(1, …)). Raising only the 0 to 1
  // keeps the player-set range the ceiling; the floor just skips 0.
  const lo = (op: string) =>
    op === Ops.mult || op === Ops.sq ? Math.max(1, minNumber) : minNumber;

  let a = getRandomIntInRange(lo(op), maxNumber, rng);
  let b = getRandomIntInRange(lo(op), maxNumber, rng);

  switch (op) {
    case Ops.sub: {
      // Enforce a >= b so the answer is non-negative.
      if (a < b) [a, b] = [b, a];
      break;
    }
    case Ops.div: {
      // Exact division: pick b (the divisor), then a as a multiple of b
      // within range so the answer is always an integer.
      b = getRandomIntInRange(1, maxNumber, rng); // divisor in [1, maxNumber-1]
      const minK = Math.max(1, Math.ceil(minNumber / b));
      const maxK = Math.floor((maxNumber - 1) / b);
      const k =
        minK <= maxK ? getRandomIntInRange(minK, maxK + 1, rng) : 1;
      a = b * k;
      break;
    }
    case Ops.sq: {
      // "a²": unary in spirit — b mirrors a so the shape stays a/b
      // (a was already floored at 1 above, so 0² never appears).
      b = a;
      break;
    }
    case Ops.pct: {
      // "p% of N": pick a friendly percent p, then a base N that is a
      // multiple of (100/p) so the answer is always a whole number.
      const feasible = PERCENT_CHOICES.filter((p) => {
        const step = 100 / p;
        const minK = Math.max(1, Math.ceil(minNumber / step));
        const maxK = Math.floor((maxNumber - 1) / step);
        return minK <= maxK;
      });
      if (feasible.length === 0) return null;
      const p = feasible[Math.floor(rng() * feasible.length)];
      const step = 100 / p;
      const minK = Math.max(1, Math.ceil(minNumber / step));
      const maxK = Math.floor((maxNumber - 1) / step);
      const k = getRandomIntInRange(minK, maxK + 1, rng);
      a = p;
      b = step * k;
      break;
    }
  }

  let answer: number;
  switch (op) {
    case Ops.mult:
      answer = a * b;
      break;
    case Ops.add:
      answer = a + b;
      break;
    case Ops.sub:
      answer = a - b;
      break;
    case Ops.div:
      answer = a / b;
      break;
    case Ops.sq:
      answer = a * a;
      break;
    case Ops.pct:
      // a = percent, b = base. b is a multiple of 100/a by construction.
      answer = (b * a) / 100;
      break;
    default:
      answer = a * b;
  }

  return { op, a, b, answer };
}

/**
 * Generate a missing-number equation: "a + ? = b" or "a * ? = b" (addition
 * and multiplication only — the "?" always comes out whole and >= 1).
 * `a` is the shown operand, `b` the shown total, `answer` the "?".
 */
function generateMissingEquation(
  minNumber: number,
  maxNumber: number,
  rng: () => number = Math.random,
): Equation {
  const baseOp = rng() < 0.5 ? Ops.add : Ops.mult;
  if (baseOp === Ops.add) {
    const a = getRandomIntInRange(minNumber, maxNumber, rng);
    // answer = b - a: keep it in [1, maxNumber - minNumber] so the
    // answer is at least as bounded as any other operand.
    const answer = getRandomIntInRange(
      1,
      Math.max(1, maxNumber - minNumber),
      rng,
    );
    const b = a + answer;
    return { op: baseOp, a, b, answer, missing: true };
  }
  // Multiplication: a >= 2 (a = 1 would make the ? trivially equal to b),
  // answer k in [1, maxNumber), shown total b = a * k.
  const lo = Math.max(2, minNumber);
  const a =
    lo < maxNumber
      ? getRandomIntInRange(lo, maxNumber, rng)
      : Math.min(Math.max(1, minNumber), Math.max(1, maxNumber - 1));
  const answer = getRandomIntInRange(1, maxNumber, rng);
  const b = a * answer;
  return { op: baseOp, a, b, answer, missing: true };
}

/**
 * The "?" is the DIVISOR: "a ÷ ? = b". `a` is the dividend (their
 * product), `b` the shown quotient and `answer` the missing divisor.
 *
 * Both the divisor and the quotient are drawn in [minNumber, maxNumber),
 * so the dividend can exceed the player's range (exactly as the
 * multiplication form's shown total does). The divisor floors at 2: a
 * dividend equal to its quotient ("24 ÷ ? = 24") would make the "?" a
 * giveaway and pay out like a freebie.
 *
 * Returns null when no divisor fits the range (maxNumber < 2), letting
 * the caller's re-pick loop fall back.
 */
function generateMissingDivisorEquation(
  minNumber: number,
  maxNumber: number,
  rng: () => number = Math.random,
): Equation | null {
  const minDivisor = Math.max(2, minNumber);
  if (minDivisor >= maxNumber) return null;
  const divisor = getRandomIntInRange(minDivisor, maxNumber, rng);
  const quotient = getRandomIntInRange(Math.max(1, minNumber), maxNumber, rng);
  return {
    op: Ops.div,
    a: divisor * quotient,
    b: quotient,
    answer: divisor,
    missing: true,
  };
}

/**
 * Balance the equation: "a + ? = b + c" (the right-hand operator is
 * + or −, so both sides stay two-term and the answer is a single
 * subtraction away — integral by construction, never a negative number
 * to type).
 *
 * Built RIGHT-SIDE FIRST: the side is drawn, and `a` is then chosen from
 * the window that is guaranteed smaller than it, so `answer >= 1` by
 * construction. (Rolling `a` first and rejecting when the sides don't
 * line up — the obvious way round — fails roughly a third of the time at
 * the default range, and every one of those rejections used to fall all
 * the way through to the generator's multiplication fallback.)
 *
 * Times are deliberately excluded from the sides: they would make the
 * missing term a quotient as often as not, collapsing the drill's range.
 */
function generateBalanceEquation(
  minNumber: number,
  maxNumber: number,
  rng: () => number = Math.random,
): Equation | null {
  // The right side must be strictly above minNumber so there is always a
  // legal `a` below it. For the `+` form that is automatic once minNumber
  // >= 1 (b + c >= 2·minNumber); for minNumber 0 and for the `−` form it
  // takes a couple of draws.
  let b = minNumber;
  let c = minNumber;
  let rightOp = Ops.add;
  let right = minNumber;
  for (let i = 0; i < 24 && right <= minNumber; i++) {
    rightOp = rng() < 0.6 ? Ops.add : Ops.sub;
    b = getRandomIntInRange(minNumber, maxNumber, rng);
    c = getRandomIntInRange(minNumber, maxNumber, rng);
    right = rightOp === Ops.add ? b + c : b - c;
  }
  if (right <= minNumber) return null;
  // a ∈ [minNumber, min(maxNumber - 1, right - 1)]: in range AND strictly
  // under the side it has to reach. getRandomIntInRange returns lo when
  // lo >= hi, which is what makes the degenerate range safe.
  const a = getRandomIntInRange(
    minNumber,
    Math.min(maxNumber - 1, right - 1),
    rng,
  );
  return { op: Ops.add, a, b, op2: rightOp, c, answer: right - a, balance: true };
}

/** How many terms a sequence shows before the "?". */
const SEQUENCE_TERMS = 5;

/** The sequence families the drill can roll (all next-term integral). */
const SEQUENCE_KINDS = ["arith", "geom", "square", "sum"] as const;

/**
 * Next-in-sequence: "3, 6, 9, 12, ?" with the next term as the answer.
 *
 * Four families, all with an unambiguous next term:
 *  - arith   a, a+d, a+2d, …        (+/- d, the classic count-up)
 *  - geom    a, a·r, a·r², …        (×2/×3)
 *  - square  1², 2², 3², …          (the square-numbers pattern)
 *  - sum     a, b, a+b, a+2b, …     (Fibonacci-style, each term the sum
 *                                    of the previous two)
 *
 * The one type that does NOT honour the operand-range guarantee: a
 * sequence is a list, not operands, so the terms grow past maxNumber by
 * construction. What IS honoured is that the START value and the step
 * come from [minNumber, maxNumber), so the configured range still sets
 * the difficulty, and every term is a whole non-negative number small
 * enough to read (the geometric start is capped so a 5-term ×2 ladder
 * cannot run away).
 */
function generateSequenceEquation(
  minNumber: number,
  maxNumber: number,
  rng: () => number = Math.random,
): Equation {
  const kind = SEQUENCE_KINDS[Math.floor(rng() * SEQUENCE_KINDS.length)];
  const lo = Math.max(0, minNumber);
  // Each branch builds its own terms AND its own next term, so the answer
  // can never drift out of sync with the sequence it is drawn from.
  let terms: number[];
  let answer: number;

  switch (kind) {
    case "geom": {
      const ratio = Math.max(2, Math.min(3, maxNumber));
      // Cap the start so start * ratio^TERMS stays readable (a ×2 ladder
      // from 12 would otherwise end on 384).
      const maxStart = Math.max(
        1,
        Math.floor(1000 / Math.pow(ratio, SEQUENCE_TERMS)),
      );
      const start = getRandomIntInRange(
        Math.max(1, Math.min(lo, maxStart)),
        Math.max(2, Math.min(maxNumber, maxStart + 1)),
        rng,
      );
      terms = Array.from(
        { length: SEQUENCE_TERMS },
        (_, i) => start * Math.pow(ratio, i),
      );
      answer = start * Math.pow(ratio, SEQUENCE_TERMS);
      break;
    }
    case "square": {
      // n², (n+1)², … rooted at the configured range so a low maxNumber
      // still gives a short, easy ladder.
      const top = Math.max(SEQUENCE_TERMS, Math.min(maxNumber, lo + 12));
      const first = Math.max(1, Math.min(lo, top - SEQUENCE_TERMS));
      terms = Array.from(
        { length: SEQUENCE_TERMS },
        (_, i) => (first + i) ** 2,
      );
      answer = (first + SEQUENCE_TERMS) ** 2;
      break;
    }
    case "sum": {
      // Each term is the sum of the previous two (the Fibonacci shape),
      // so the next term is always last + secondToLast.
      const x = getRandomIntInRange(Math.max(1, lo), Math.max(2, maxNumber), rng);
      const y = getRandomIntInRange(Math.max(1, lo), Math.max(2, maxNumber), rng);
      terms = [x, y, x + y, x + 2 * y, 2 * x + 3 * y];
      answer = terms[SEQUENCE_TERMS - 1] + terms[SEQUENCE_TERMS - 2];
      break;
    }
    case "arith":
    default: {
      const start = getRandomIntInRange(lo, Math.max(lo + 1, maxNumber), rng);
      // Count-ups are the useful half of an arithmetic sequence, but
      // count-downs are kept for starts that stay positive (skip counting
      // down is a real skill: "20, 18, 16, 14, ?"). The step is capped so
      // the LAST term is still >= 0 — an unbounded step would run the tail
      // of the ladder negative.
      const goingDown = start >= SEQUENCE_TERMS && rng() < 0.25;
      const maxStep = goingDown
        ? Math.max(1, Math.floor(start / SEQUENCE_TERMS))
        : Math.max(1, maxNumber - lo);
      const step = 1 + Math.floor(rng() * maxStep);
      const delta = goingDown ? -step : step;
      terms = Array.from(
        { length: SEQUENCE_TERMS },
        (_, i) => start + i * delta,
      );
      answer = start + SEQUENCE_TERMS * delta;
      break;
    }
  }

  return { op: Ops.seq, a: terms[0], b: terms[1], answer, sequence: terms };
}

/**
 * The realistic tipping rates. 15/20/25% are the ones people are expected
 * to do by sight, and — unlike PERCENT_CHOICES — 100 / 15 is not a whole
 * number, so the bill is filtered through moneyStep() instead.
 */
const TIP_RATES = [15, 20, 25] as const;

/** Denominations people actually hand over / get back in. */
const CHANGE_NOTES = [5, 10, 20, 50, 100] as const;

/** Euclidean GCD — the smallest whole-dollar bill step for a given rate. */
function greatestCommonDivisor(x: number, y: number): number {
  while (y !== 0) [x, y] = [y, x % y];
  return x;
}

/**
 * The step between two bills that both produce a WHOLE-number tip at
 * `rate` percent: bill × rate must be divisible by 100, and the smallest
 * such bill is 100 / gcd(rate, 100) — 20 for 15%, 5 for 20%, 4 for 25%.
 * This is what keeps the money drills off the keypad's decimal problem.
 */
function moneyStep(rate: number): number {
  return 100 / greatestCommonDivisor(rate, 100);
}

/**
 * A whole-dollar bill of `step` between `first` and `last` (both
 * themselves multiples of step). At least four bills are always on offer,
 * so this can never come up empty for the tip drill.
 */
function pickBill(
  first: number,
  step: number,
  last: number,
  rng: () => number,
): number {
  const span = (last - first) / step;
  return first + Math.floor(rng() * (span + 1)) * step;
}

/**
 * Tipping: "45 + 20% tip" — the everyday question is what you actually
 * HAND OVER, so `answer` is the bill plus the tip, not the tip. That makes
 * it a multiply-then-add in your head rather than the `percent` type
 * again, and it is the number that matters at the table.
 *
 * Bills deliberately step outside [minNumber, maxNumber): money does not
 * fit a 0–12 operand dial, and at 15% the first whole-dollar bill is 20.
 * The range still acts as a floor/ceiling (a raised minNumber starts the
 * bills higher, a raised maxNumber adds more), and every bill is a
 * multiple of moneyStep(rate) so the tip is always whole.
 */
function generateTipEquation(
  minNumber: number,
  maxNumber: number,
  rng: () => number = Math.random,
): Equation {
  const rate = TIP_RATES[Math.floor(rng() * TIP_RATES.length)];
  const step = moneyStep(rate);
  const first = Math.ceil(Math.max(step, minNumber, 1) / step) * step;
  // Four bills minimum (so the drill always has choices), and every bill
  // the player's maxNumber admits on top of that.
  const last = Math.max(
    first + 3 * step,
    Math.floor((maxNumber - 1) / step) * step,
  );
  const bill = pickBill(first, step, last, rng);
  return { op: Ops.tip, a: bill, b: rate, answer: bill + (bill * rate) / 100 };
}

/**
 * Change from a note: "20 - 13" → 7. Paid with a round note, the change
 * comes back — the most common piece of everyday mental subtraction, and
 * the one where people reach for a calculator rather than their head.
 *
 * `a` is the note handed over and `b` the cost, so the answer is always
 * positive by construction (only notes larger than the cost are ever
 * drawn). Above the largest denomination the note becomes "whatever the
 * next round-up is", which keeps the drill working at any maxNumber.
 */
function generateChangeEquation(
  minNumber: number,
  maxNumber: number,
  rng: () => number = Math.random,
): Equation {
  const cost = getRandomIntInRange(
    Math.max(1, minNumber),
    Math.max(2, maxNumber),
    rng,
  );
  const bigger = CHANGE_NOTES.filter((n) => n > cost);
  const note =
    bigger.length > 0
      ? bigger[Math.floor(rng() * bigger.length)]
      : cost + getRandomIntInRange(1, Math.max(1, maxNumber), rng);
  return { op: Ops.change, a: note, b: cost, answer: note - cost };
}

/**
 * Elapsed time: "9:40 → 10:25" → 45 minutes. Counting up to the next hour
 * is exactly the thing people do badly in their heads, and unlike the
 * clock itself it has a single whole-number answer.
 *
 * The span is drawn from [5, 10 × maxNumber] minutes — so the player's
 * range IS the difficulty dial (maxNumber 2 gives a couple of minutes,
 * 12 gives up to two hours) — and the start is chosen so the whole span
 * fits inside one day, because "23:55 → 00:10" would have two answers.
 */
function generateTimeEquation(
  minNumber: number,
  maxNumber: number,
  rng: () => number = Math.random,
): Equation {
  // Capped at 10h so the "no midnight wrap" window stays comfortably wide.
  const maxMinutes = Math.min(600, Math.max(10, maxNumber * 10));
  const elapsed = 5 + Math.floor(rng() * (maxMinutes - 4));
  // Start is capped one minute short of midnight-to-midnight, so the span
  // can never END at exactly 24:00 — formatClock wraps that to "0:00",
  // which reads as an earlier time than it started.
  const start = Math.floor(rng() * (24 * 60 - elapsed));
  return { op: Ops.time, a: start, b: elapsed, answer: elapsed };
}

/**
 * The cent window the DECIMAL money drills draw from.
 *
 * Money is the one place the operand range genuinely does not apply — a
 * "0–12" dial has no $0.60 in it — so the player's minNumber/maxNumber
 * scale the window rather than bounding it directly: the floor is
 * minNumber dollars, the ceiling is 5 × maxNumber dollars (so the default
 * range reaches a plausible $60). The +200-cent floor guarantees the
 * subtraction branch always has a legal pair.
 */
function moneyWindow(minNumber: number, maxNumber: number): [number, number] {
  const low = 100 * Math.max(1, minNumber);
  const high = Math.max(low + 200, 100 * 5 * maxNumber);
  return [low, high];
}

/** A whole number of cents in [lo, hi]. */
function pickCents(lo: number, hi: number, rng: () => number): number {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

/**
 * Adding up or taking away money: "12.40 + 7.60" / "20.00 - 7.60".
 *
 * Every amount is a whole number of cents picked from moneyWindow, so the
 * sum and difference are exact by construction — there is no rounding step
 * to get wrong. The operands (not just the answer) are decimals: a player
 * who can only carry whole dollars cannot do this at all, which is the
 * whole skill ("you owe me 40 and I have a 50 and two coins").
 *
 * Subtraction floors the difference at a dollar, so the drill is never the
 * near-zero case and never an answer below the payout floor.
 */
function generateMoneyAddEquation(
  minNumber: number,
  maxNumber: number,
  rng: () => number = Math.random,
): Equation {
  const [low, high] = moneyWindow(minNumber, maxNumber);
  const isSub = rng() < 0.5;
  // + needs no ordering; − needs a >= b + 100 so the difference is >= $1.
  const a = pickCents(isSub ? low + 100 : low, high, rng);
  const b = pickCents(low, isSub ? a - 100 : high, rng);
  const totalCents = isSub ? a - b : a + b;
  return {
    op: isSub ? Ops.moneySub : Ops.moneyAdd,
    a: fromCents(a),
    b: fromCents(b),
    answer: fromCents(totalCents),
  };
}

/**
 * Unit price: "3.20 × 7" — what N of something at a shelf price costs.
 * The single most common decimal sum in ordinary life, and the one people
 * reach for a phone calculator for.
 *
 * `a` is the unit price (always a multiple of 5 cents and under $10, so
 * it reads like a real price tag) and `b` the quantity; the product in
 * cents is exact, so the total always lands on a real cent.
 */
function generateUnitPriceEquation(
  minNumber: number,
  maxNumber: number,
  rng: () => number = Math.random,
): Equation {
  const [low, high] = moneyWindow(minNumber, maxNumber);
  const quantity = 2 + Math.floor(rng() * Math.max(1, maxNumber - 1));
  const lowest = 5 * Math.ceil(Math.min(low, 1000) / 5);
  const highest = 5 * Math.floor(Math.min(high, 1000) / 5);
  const unitCents =
    lowest + 5 * Math.floor(rng() * ((highest - lowest) / 5 + 1));
  return {
    op: Ops.unitPrice,
    a: fromCents(unitCents),
    b: quantity,
    answer: fromCents(unitCents * quantity),
  };
}

/**
 * Splitting a bill: "94.50 ÷ 3" — the per-person share.
 *
 * Built per-PERSON first and multiplied up, so the division is exact by
 * construction. Deliberately NOT "divide any bill by any number": a bill
 * that does not come out even ($95.00 ÷ 3 = $31.67) is a rounding lesson
 * about remainders, not a mental-math one, and there is no way to type the
 * rounded answer without guessing which way it rounds.
 */
function generateSplitBillEquation(
  minNumber: number,
  maxNumber: number,
  rng: () => number = Math.random,
): Equation {
  const [low, high] = moneyWindow(minNumber, maxNumber);
  const people = 2 + Math.floor(rng() * Math.max(1, Math.min(maxNumber - 1, 5)));
  const shareCents = pickCents(low, Math.max(low, Math.min(high, Math.floor(20000 / people))), rng);
  return {
    op: Ops.splitBill,
    a: fromCents(shareCents * people),
    b: people,
    answer: fromCents(shareCents),
  };
}

/** "9:40" from a minutes-past-midnight count. */
export function formatClock(minutesOfDay: number): string {
  const h = Math.floor(minutesOfDay / 60) % 24;
  const m = Math.round(minutesOfDay % 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}

/**
 * Generate a random equation honoring the enabled operators.
 *
 * Guarantees:
 * - Operands stay within [minNumber, maxNumber) (percent bases and square
 *   operands included; missing-number answers too).
 * - Subtraction answers are never negative (a >= b), so the answer is
 *   always typeable on a numeric keypad.
 * - Division is always exact (a is a multiple of b), so answers are
 *   integers; percent bases are multiples of 100/p, so percent answers
 *   are integers as well.
 * - Missing-number equations ("a + ? = b" / "a * ? = b") always yield a
 *   whole answer >= 1; so do the missing-DIVISOR ("a / ? = b") and
 *   balance ("a + ? = b + c") drills and the next-term sequence drill.
 * - If no operators are enabled, falls back to multiplication rather than
 *   returning an equation with an undefined op/answer.
 * - Percent / square / missing / missingDivisor / balance / sequence are
 *   SOFT-MODE-ONLY: in hard mode the pools (first op and second step) are
 *   exactly the classic four operators, so a 3-term equation can never
 *   contain an uncomposable shape.
 * - Hard mode (prefs.hardMode): a second step a op b op2 c is appended,
 *   evaluated strictly left-to-right. The same guarantees hold at the
 *   second step: the running result (and hence the answer) stays integral
 *   and non-negative, division is exact at BOTH steps, and c stays within
 *   [minNumber, maxNumber) except the sub-clamp (c <= running result, so
 *   the answer can't go negative) and the division divisor range.
 */
export function getRandomEquation(
  prefs: EquationSettings,
  rng: () => number = Math.random,
): Equation {
  const minNumber = Math.max(0, Math.floor(prefs.minNumber ?? 0));
  const maxNumber = Math.max(2, Math.floor(prefs.maxNumber ?? 12));

  // The classic four — the ONLY ops allowed in hard mode (either step).
  const regularOps = [
    ...(prefs.multiply ? [Ops.mult] : []),
    ...(prefs.add ? [Ops.add] : []),
    ...(prefs.subtract ? [Ops.sub] : []),
    ...(prefs.division ? [Ops.div] : []),
  ];
  // Soft-mode extras (todo: "More types of simple mental arithmetics for
  // all ages"). Each enabled type gets an equal slice of the pool.
  const extraOps = prefs.hardMode
    ? []
    : [
        ...(prefs.percent ? [Ops.pct] : []),
        ...(prefs.square ? [Ops.sq] : []),
      ];
  type Choice =
    | { kind: "op"; op: string }
    | { kind: "missing" }
    | { kind: "divisor" }
    | { kind: "balance" }
    | { kind: "sequence" }
    | { kind: "tip" }
    | { kind: "change" }
    | { kind: "time" }
    | { kind: "moneyAdd" }
    | { kind: "unitPrice" }
    | { kind: "splitBill" };
  const softExtras: Choice[] = prefs.hardMode
    ? []
    : [
        ...(prefs.missing ? ([{ kind: "missing" }] as const) : []),
        ...(prefs.missingDivisor ? ([{ kind: "divisor" }] as const) : []),
        ...(prefs.balance ? ([{ kind: "balance" }] as const) : []),
        ...(prefs.sequence ? ([{ kind: "sequence" }] as const) : []),
        ...(prefs.tip ? ([{ kind: "tip" }] as const) : []),
        ...(prefs.change ? ([{ kind: "change" }] as const) : []),
        ...(prefs.time ? ([{ kind: "time" }] as const) : []),
        ...(prefs.moneyAdd ? ([{ kind: "moneyAdd" }] as const) : []),
        ...(prefs.unitPrice ? ([{ kind: "unitPrice" }] as const) : []),
        ...(prefs.splitBill ? ([{ kind: "splitBill" }] as const) : []),
      ];
  const choices: Choice[] = [
    ...regularOps.map((op): Choice => ({ kind: "op", op })),
    ...extraOps.map((op): Choice => ({ kind: "op", op })),
    ...softExtras,
  ];
  // All operators disabled: fall back to multiplication so the game stays
  // playable (op/answer would otherwise be undefined).
  if (choices.length === 0) choices.push({ kind: "op", op: Ops.mult });

  // Percent, the missing-divisor and the balance drill are occasionally
  // infeasible at a small maxNumber (no base / divisor fits, or the right
  // side can't beat the left); re-pick a bounded number of times, then
  // fall back to plain multiply (which can't fail, so the last return is
  // never actually hit). The sequence drill always succeeds.
  const generate = (): Equation => {
    for (let i = 0; i < choices.length + 1; i++) {
      const choice = choices[Math.floor(rng() * choices.length)];
      let eq: Equation | null;
      switch (choice.kind) {
        case "missing":
          eq = generateMissingEquation(minNumber, maxNumber, rng);
          break;
        case "divisor":
          eq = generateMissingDivisorEquation(minNumber, maxNumber, rng);
          break;
        case "balance":
          eq = generateBalanceEquation(minNumber, maxNumber, rng);
          break;
        case "sequence":
          eq = generateSequenceEquation(minNumber, maxNumber, rng);
          break;
        case "tip":
          eq = generateTipEquation(minNumber, maxNumber, rng);
          break;
        case "change":
          eq = generateChangeEquation(minNumber, maxNumber, rng);
          break;
        case "time":
          eq = generateTimeEquation(minNumber, maxNumber, rng);
          break;
        case "moneyAdd":
          eq = generateMoneyAddEquation(minNumber, maxNumber, rng);
          break;
        case "unitPrice":
          eq = generateUnitPriceEquation(minNumber, maxNumber, rng);
          break;
        case "splitBill":
          eq = generateSplitBillEquation(minNumber, maxNumber, rng);
          break;
        default:
          eq = generateTermsEquation(choice.op, minNumber, maxNumber, rng);
      }
      if (eq !== null) return eq;
    }
    // Last resort, reached only when EVERY enabled shape reported itself
    // infeasible: plain multiplication, with the operand pair floored at 1
    // exactly as generateTermsEquation does. Using minNumber here would
    // hand out "0 * 0 = 0" at a minNumber of 0 — a freebie answer the
    // payout floor would still pay for.
    const fallback = Math.max(1, minNumber);
    return { op: Ops.mult, a: fallback, b: fallback, answer: fallback * fallback };
  };
  const equation = generate();

  // Hard mode (tier-5, plan §4.2): append a second step whose result is the
  // actual answer, evaluated left-to-right. Soft mode returns the plain
  // 2-term shape — no op2/c — so it's bit-identical to the old behavior.
  if (prefs.hardMode) {
    const op2Pool = regularOps.length > 0 ? regularOps : [Ops.mult];
    const pickOp = () => op2Pool[Math.floor(rng() * op2Pool.length)];
    const op2 = pickOp();
    // In hard mode the first step is always one of the classic four ops,
    // so equation.answer IS the left-to-right running result.
    let running = equation.answer;
    let c: number;
    switch (op2) {
      case Ops.sub:
        // Clamp c to the running result so the final answer stays
        // non-negative (the running result already is, by the guarantees
        // above). Same spirit as the a >= b swap in 2-term subtraction.
        c = Math.min(getRandomIntInRange(minNumber, maxNumber, rng), running);
        break;
      case Ops.div: {
        if (running === 0) {
          // 0 / c = 0 is exact for any c; a plain in-range divisor works.
          c = getRandomIntInRange(1, maxNumber, rng);
        } else {
          // Exact division at the second step too: pick a divisor of the
          // running result (d=1 always divides, so the list is never
          // empty and c=1 is the implicit fallback).
          const divisors: number[] = [];
          for (let d = 1; d < maxNumber; d++) {
            if (running % d === 0) divisors.push(d);
          }
          c = divisors[Math.floor(rng() * divisors.length)];
        }
        break;
      }
      default:
        // + and * keep the in-range operand rule.
        c = getRandomIntInRange(minNumber, maxNumber, rng);
    }

    switch (op2) {
      case Ops.mult:
        running = running * c;
        break;
      case Ops.add:
        running = running + c;
        break;
      case Ops.sub:
        running = running - c;
        break;
      case Ops.div:
      default:
        running = running / c;
    }

    equation.op2 = op2;
    equation.c = c;
    equation.answer = running;
  }

  return equation;
}

/**
 * FNV-1a 32-bit string hash — cheap, dependency-free, and stable across
 * platforms (Math.imul is exact 32-bit multiplication by spec), so a day
 * key seeds the SAME number on web, Android and iOS.
 */
export function hashString(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * mulberry32 — a tiny, fast, deterministic 32-bit PRNG. Good-enough quality
 * for picking equation terms (NOT for security — the CSPRNG helper in the
 * account modules exists precisely because Math.random/mulberry32 are not
 * crypto-grade).
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic equation for a string seed: the same seed (e.g. a local
 * day key "2026-09-07") yields the SAME equation on every device and
 * platform, forever — the "equation of the day" primitive. `prefs` fixes
 * the shapes/range (callers pass fixed prefs, never player settings, so
 * the day's equation is identical for all players); the generation itself
 * reuses getRandomEquation, so all of its answer guarantees (integral,
 * non-negative, exact divisions) hold unchanged.
 */
export function getSeededEquation(
  seed: string,
  prefs: EquationSettings,
): Equation {
  const rng = mulberry32(hashString(seed));
  return getRandomEquation(prefs, rng);
}

/** The visible glyph for an op under the player's multiply-symbol choice. */
export function getOpDisplay(
  op: string,
  multiplySymbol: MultiplySymbol,
): string {
  switch (op) {
    case Ops.mult:
      return multiplySymbol === "letter" ? "x" : "*";
    case Ops.add:
      return "+";
    case Ops.sub:
      return "-";
    case Ops.div:
      // The multiply-symbol choice doubles as a symbol STYLE (todo: "alt
      // display for other operations"): "letter" is the wordly glyph (÷),
      // "asterisk" the terse one (/).
      return multiplySymbol === "letter" ? "÷" : "/";
    case Ops.pct:
      return "%";
    case Ops.sq:
      return "²";
    case Ops.seq:
      // Sequences have no operator glyph; the ellipsis marks the drill in
      // the payout hint ("×4 …").
      return "…";
    case Ops.tip:
      return "%";
    case Ops.change:
      return "$";
    case Ops.time:
      return "◷";
    case Ops.moneyAdd:
      return "+";
    case Ops.moneySub:
      return "-";
    default:
      return op;
  }
}

/**
 * The human-facing text of an equation (todo: "Configurable equation
 * display" + the soft-mode-only shapes):
 *   mult/add/sub/div  "7 * 2"  (×2 → "7 x 2", ÷2 → "7 ÷ 2" per multiplySymbol)
 *   percent          "25% of 40"
 *   square           "7²"
 *   missing          "7 + ? = 12"     (or "24 / ? = 6" for the divisor form)
 *   balance          "6 + ? = 4 + 9"
 *   sequence         "1, 4, 9, 16, "  (comma-terminated — the caller adds "?")
 *   tip              "45 + 20% tip"   (the answer is the total you hand over)
 *   change           "20 - 13"
 *   time             "9:40 → 10:25"   (the answer is the minutes between)
 *   money add/sub    "12.40 + 7.60" / "20.00 - 7.60"
 *   unit price       "3.20 × 7"
 *   split the bill   "94.50 ÷ 3"
 * A hard-mode second step is appended: " 2 * 3".
 */
export function formatEquation(
  equation: Equation,
  multiplySymbol: MultiplySymbol,
): string {
  const sym = getOpDisplay(equation.op, multiplySymbol);
  let text: string;
  if (equation.sequence) {
    // The trailing "? " belongs to the caller's answer prompt, so this
    // shape is comma-terminated on purpose: "1, 4, 9, 16, ?".
    return `${equation.sequence.join(", ")}, `;
  }
  if (equation.op === Ops.time) {
    // "9:40 → 10:25" — a = start, b = elapsed, so the end is their sum.
    return `${formatClock(equation.a)} → ${formatClock(equation.a + equation.b)}`;
  }
  if (
    equation.op === Ops.moneyAdd ||
    equation.op === Ops.moneySub ||
    equation.op === Ops.unitPrice ||
    equation.op === Ops.splitBill
  ) {
    // The decimal money shapes. `a` is always an amount and gets its two
    // decimal places so a bill reads "12.40", never "12.4"; `b` is only an
    // amount for the add/sub pair — for unit price it is the quantity and
    // for a split it is the headcount, so those stay bare integers.
    const isAmountPair =
      equation.op === Ops.moneyAdd || equation.op === Ops.moneySub;
    const rhs = isAmountPair ? formatMoney(equation.b) : String(equation.b);
    return `${formatMoney(equation.a)} ${getOpDisplay(equation.op, multiplySymbol)} ${rhs}`;
  }
  if (equation.op === Ops.tip) {
    // "45 + 20% tip" — a = the bill, b = the rate.
    return `${equation.a} + ${equation.b}% tip`;
  }
  if (equation.op === Ops.change) {
    // "20 - 13" — a = the note handed over, b = the cost.
    return `${equation.a} - ${equation.b}`;
  }
  if (equation.balance) {
    // "6 + ? = 4 + 9" — the "?" sits BETWEEN the two sides, so the
    // hard-mode suffix below must not be appended to it.
    const rightOp = equation.op2 ?? Ops.add;
    return `${equation.a} + ? = ${equation.b} ${getOpDisplay(rightOp, multiplySymbol)} ${equation.c}`;
  }
  if (equation.missing) {
    text = `${equation.a} ${sym} ? = ${equation.b}`;
  } else if (equation.op === Ops.sq) {
    text = `${equation.a}²`;
  } else if (equation.op === Ops.pct) {
    text = `${equation.a}% of ${equation.b}`;
  } else {
    text = `${equation.a} ${sym} ${equation.b}`;
  }
  if (isHardMode(equation) && equation.c !== undefined) {
    text += ` ${getOpDisplay(equation.op2 as string, multiplySymbol)} ${equation.c}`;
  }
  return text;
}

/**
 * The equation AS DISPLAYED: formatEquation plus the trailing "?" answer
 * prompt. Split out from formatEquation (which stays prompt-free, so its
 * unit tests and any future "read it back" caller see just the equation)
 * because the sequence shape needs a comma before its prompt.
 */
export function formatEquationPrompt(
  equation: Equation,
  multiplySymbol: MultiplySymbol,
): string {
  return `${formatEquation(equation, multiplySymbol)}?`;
}
