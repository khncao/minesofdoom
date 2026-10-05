import { fromCents } from "./money";

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
  "discount",
  "change",
  "time",
  "splitBill",
  "unitPrice",
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
  /** tip: "45 + 15% tip" — the total you hand over (soft mode only) */
  tip: boolean;
  /** discount: "45 - 15% off" — what you actually pay (soft mode only) */
  discount: boolean;
  /** change: "20 - 13" — change from a note (soft mode only) */
  change: boolean;
  /** time: "9:40 → 10:25" — minutes elapsed (soft mode only) */
  time: boolean;
  /** splitBill: "90 ÷ 4" — the per-person share (soft mode only) */
  splitBill: boolean;
  /** unitPrice: "4 each × 12" / "30 ÷ 12" (soft mode only) */
  unitPrice: boolean;
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
  discount: false,
  change: false,
  time: false,
  splitBill: false,
  unitPrice: false,
  hardMode: false,
  multiplySymbol: "asterisk",
};

/**
 * Player-facing limits for the operand dial ("Max constant value in
 * equations"). 12 — the default — is the classic 0–12 dial; 99 is the
 * ceiling and it is the natural edge of the two-digit band: every
 * constant stays ≤ 98, so the hardest equation is 98 × 98 = 9,604 —
 * two-digit × two-digit, the classic limit of mental multiplication
 * (beyond it you leave mental math entirely). Answers stay ≤ 4 digits
 * (four keypad taps) and the real-world bills (up to 5× the dial) stay
 * under 500. Below 3 the range [min, max) holds too few values to form
 * anything but 0/1 arithmetic, so that is the floor. (todo: "set a
 * reasonable max constant limit in settings")
 */
export const EQUATION_NUMBER_LIMITS = { min: 3, max: 99 } as const;

/** Clamp one stored/typed operand limit back into the dial range. */
export function clampEquationNumber(value: number): number {
  if (!Number.isFinite(value)) return defaultEquationSettings.maxNumber;
  return Math.min(
    EQUATION_NUMBER_LIMITS.max,
    Math.max(EQUATION_NUMBER_LIMITS.min, Math.trunc(value)),
  );
}

/**
 * Normalize the two numeric fields of a settings record. This is the
 * load-time guard: the dial used to be an unbounded text box, so old
 * saves can hold anything (99 was typeable) and a hand-edited store can
 * hold more. Also keeps minNumber inside the clamped range.
 */
export function clampEquationNumbers(
  settings: Pick<EquationSettings, "minNumber" | "maxNumber">,
): Pick<EquationSettings, "minNumber" | "maxNumber"> {
  const maxNumber = clampEquationNumber(settings.maxNumber);
  const raw = Number.isFinite(settings.minNumber)
    ? Math.trunc(settings.minNumber)
    : 0;
  const minNumber = Math.min(Math.max(0, raw), maxNumber - 1);
  return { minNumber, maxNumber };
}

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
  /** tip: the equation shows "45 + 15% tip"; a = bill, b = rate %. */
  tip: "tip",
  /** discount: "45 - 15% off"; a = price, b = rate %. */
  discount: "-%",
  /** change: "20 - 13"; a = the note paid, b = the cost. */
  change: "chg",
  /** time: "9:40 → 10:25"; a = start (minutes past midnight),
   *  b = the elapsed minutes (which are also the answer). */
  time: "time",
  /**
   * The DECIMAL-ANSWER money types. Every operand the game displays is a
   * whole number — these two exist only so the ANSWER can carry cents,
   * which is what finally makes 15% and an inexact split usable.
   */
  /** "45 - 15% off" — a = the price, b = the rate. */
  splitBill: "÷",
  /**
   * Unit price, both directions under ONE op (the direction lives in
   * `Equation.unitEach`): false → a = price, b = count ("4 each × 12");
   * true → a = total, b = count ("30 ÷ 12").
   */
  unitPrice: "unit",
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
  /**
   * Unit-price equations ("4 each × 12" / "30 ÷ 12"): true for the
   * divide direction, where `a` is the TOTAL and the answer is the price
   * per item. Soft-mode only; both directions share Ops.unitPrice.
   */
  unitEach?: boolean;
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
 * The realistic tipping rates, and the same list serves the discount drill
 * (you pay MORE vs LESS by the same rate).
 *
 * 15% is here and always was, but it only became USABLE once answers were
 * allowed to carry cents: 15% of 45 is 6.75, which no whole-bill rate can
 * produce. The earlier moneyStep() filter existed purely to hide that.
 */
const TIP_RATES = [15, 20, 25] as const;

/** Denominations people actually hand over / get back in. */
const CHANGE_NOTES = [5, 10, 20, 50, 100] as const;

/**
 * The dollar window the money drills draw amounts from.
 *
 * Money is the one place the operand range genuinely does not apply — a
 * "0–12" dial has no $45 in it — so the player's minNumber/maxNumber
 * scale the window rather than bounding it directly: the floor is
 * minNumber dollars, the ceiling is 5 × maxNumber dollars (so the default
 * range reaches a plausible $60). Every amount is a WHOLE dollar: the
 * game's numbers stay integral everywhere, and only the ANSWER may carry
 * cents.
 */
function moneyWindow(minNumber: number, maxNumber: number): [number, number] {
  const low = Math.max(1, minNumber);
  const high = Math.max(low + 3, 5 * maxNumber);
  return [low, high];
}

/** A whole number in [lo, hi]. */
function pickWhole(lo: number, hi: number, rng: () => number): number {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

/** Euclidean GCD — used to make a division come out exact. */
function greatestCommonDivisor(x: number, y: number): number {
  while (y !== 0) [x, y] = [y, x % y];
  return x;
}

/**
 * Tipping: "45 + 15% tip" — the everyday question is what you actually
 * HAND OVER, so `answer` is the bill plus the tip, not the tip. That makes
 * it a multiply-then-add in your head rather than the `percent` type
 * again, and it is the number that matters at the table.
 *
 * Both operands are whole (a whole-dollar bill, a whole-percent rate), so
 * the drill reads exactly like every other equation — the cents show up
 * only where they belong, in the answer the player types: 45 at 15% is
 * 51.75. Computed in cents so that is exact rather than a float rounding.
 */
function generateTipEquation(
  minNumber: number,
  maxNumber: number,
  rng: () => number = Math.random,
): Equation {
  const [low, high] = moneyWindow(minNumber, maxNumber);
  const rate = TIP_RATES[Math.floor(rng() * TIP_RATES.length)];
  const bill = pickWhole(low, high, rng);
  const totalCents = bill * (100 + rate);
  return { op: Ops.tip, a: bill, b: rate, answer: fromCents(totalCents) };
}

/**
 * Taking money OFF a price: "45 - 15% off" → 38.25. Sales, vouchers, tax
 * and refunds all reduce to this, and it is a different mental move from
 * tipping: ×1.15 adds a share, ×0.75 takes a fifth off.
 *
 * Whole price, whole rate, so the only decimal is in the answer. The
 * price floors at 2 because the deepest discount is 25% and $1 less a
 * quarter is $0.75 — under the payout floor, and a drill whose whole
 * answer is "seventy-five cents" teaches nothing.
 */
function generateDiscountEquation(
  minNumber: number,
  maxNumber: number,
  rng: () => number = Math.random,
): Equation {
  const [low, high] = moneyWindow(minNumber, maxNumber);
  const rate = TIP_RATES[Math.floor(rng() * TIP_RATES.length)];
  const price = pickWhole(Math.max(low, 2), high, rng);
  const finalCents = price * (100 - rate);
  return { op: Ops.discount, a: price, b: rate, answer: fromCents(finalCents) };
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
 * Splitting a bill: "90 ÷ 4" → 22.50. Both operands whole (a whole-dollar
 * bill, a whole headcount); the per-person share may land on cents.
 *
 * Built per-PERSON first and multiplied up, so the division is EXACT by
 * construction. Deliberately not "divide any bill by any number": a bill
 * that does not come out even (95 ÷ 3 = 31.67) is a remainders lesson, not
 * a mental-math one, and there is no way to type the rounded answer without
 * guessing which way it rounds. Exactness comes from the total being a
 * multiple of people — for a share to end in cents the total only has to
 * be a multiple of people / gcd(people, 100), which is why 90 ÷ 8 is 11.25
 * but 95 ÷ 3 is never drawn.
 */
function generateSplitBillEquation(
  minNumber: number,
  maxNumber: number,
  rng: () => number = Math.random,
): Equation {
  const [low, high] = moneyWindow(minNumber, maxNumber);
  // Headcount 2..8: eight is what makes the drill worth having, because
  // it is the smallest everyday split where the share lands on cents
  // (90 / 8 = 11.25) while still dividing exactly.
  const people = 2 + Math.floor(rng() * Math.max(1, Math.min(maxNumber - 1, 7)));
  // Whole-dollar totals only, on the multiples that divide exactly, and
  // never below 2 × people so the share is a couple of dollars or more
  // ("3 ÷ 3 = 1.00" is arithmetic, not a split).
  const step = people / greatestCommonDivisor(people, 100);
  const first = Math.max(people * 2, Math.ceil(low / step) * step);
  const last = Math.max(first + 3 * step, Math.floor(high / step) * step);
  const bill = first + Math.floor(rng() * ((last - first) / step + 1)) * step;
  return {
    op: Ops.splitBill,
    a: bill,
    b: people,
    answer: fromCents((bill / people) * 100),
  };
}

/**
 * Unit price, both directions — the two questions a shopper actually asks,
 * and they pull in opposite ways, so one toggle covering both is the honest
 * shape:
 *
 *   multiply  "4 each × 12"  → 48      (what do N cost at a price?)
 *   divide    "30 ÷ 12"      → 2.50    (a pack costs 30 — what each?)
 *
 * The multiply direction answers in whole dollars; the divide direction is
 * where the cents come from, because a pack of 12 for $30 is $2.50 each.
 * Without the divide direction this would just be multiplication with a
 * story attached, which is why it earns its own toggle.
 *
 * The divide direction is built share-first and multiplied up, so it is
 * EXACT by construction — the same rule as splitBill: a pack that needs
 * rounding ($29 ÷ 12 = $2.4166…) is a remainders lesson, not a unit-price
 * one. Counts are 3..20 (far more items than the 2..8 of a dinner split,
 * which is what makes the two drills feel different) and the total never
 * drops below 2 × count, so the unit price is a couple of dollars or more.
 */
function generateUnitPriceEquation(
  minNumber: number,
  maxNumber: number,
  rng: () => number = Math.random,
): Equation {
  const [low, high] = moneyWindow(minNumber, maxNumber);
  const maxCount = Math.max(4, Math.min(20, maxNumber + 8));
  const count = 3 + Math.floor(rng() * (maxCount - 2));

  if (rng() < 0.5) {
    // Multiply: price × count. Both operands whole, so the total is whole.
    const price = pickWhole(low, Math.min(high, Math.floor(9999 / count)), rng);
    return {
      op: Ops.unitPrice,
      a: price,
      b: count,
      answer: price * count,
      unitEach: false,
    };
  }
  // Divide: total ÷ count, exact. A share of x dollars needs the total to
  // be a multiple of count / gcd(count, 100) — so 30 ÷ 12 = 2.50 is legal
  // (12/gcd(12,100) = 3) while 29 ÷ 12 never is.
  const step = count / greatestCommonDivisor(count, 100);
  const first = Math.max(count * 2, Math.ceil(low / step) * step);
  const last = Math.max(first + 2 * step, Math.floor(high / step) * step);
  const total = first + Math.floor(rng() * ((last - first) / step + 1)) * step;
  return {
    op: Ops.unitPrice,
    a: total,
    b: count,
    answer: fromCents((total / count) * 100),
    unitEach: true,
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
    | { kind: "discount" }
    | { kind: "change" }
    | { kind: "time" }
    | { kind: "splitBill" }
    | { kind: "unitPrice" };
  const softExtras: Choice[] = prefs.hardMode
    ? []
    : [
        ...(prefs.missing ? ([{ kind: "missing" }] as const) : []),
        ...(prefs.missingDivisor ? ([{ kind: "divisor" }] as const) : []),
        ...(prefs.balance ? ([{ kind: "balance" }] as const) : []),
        ...(prefs.sequence ? ([{ kind: "sequence" }] as const) : []),
        ...(prefs.tip ? ([{ kind: "tip" }] as const) : []),
        ...(prefs.discount ? ([{ kind: "discount" }] as const) : []),
        ...(prefs.change ? ([{ kind: "change" }] as const) : []),
        ...(prefs.time ? ([{ kind: "time" }] as const) : []),
        ...(prefs.splitBill ? ([{ kind: "splitBill" }] as const) : []),
        ...(prefs.unitPrice ? ([{ kind: "unitPrice" }] as const) : []),
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
        case "discount":
          eq = generateDiscountEquation(minNumber, maxNumber, rng);
          break;
        case "change":
          eq = generateChangeEquation(minNumber, maxNumber, rng);
          break;
        case "time":
          eq = generateTimeEquation(minNumber, maxNumber, rng);
          break;
        case "splitBill":
          eq = generateSplitBillEquation(minNumber, maxNumber, rng);
          break;
        case "unitPrice":
          eq = generateUnitPriceEquation(minNumber, maxNumber, rng);
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
    case Ops.discount:
      return "%";
    case Ops.change:
      return "$";
    case Ops.unitPrice:
      return "×";
    case Ops.time:
      return "◷";
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
 *   tip              "45 + 15% tip"   (the answer is the total you hand over)
 *   discount         "45 - 15% off"   (the answer is what you actually pay)
 *   change           "20 - 13"
 *   time             "9:40 → 10:25"   (the answer is the minutes between)
 *   split the bill   "90 / 4"         (the answer is the per-person share)
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
  if (equation.op === Ops.splitBill) {
    // "90 / 4" — a whole-dollar bill and a whole headcount.
    return `${equation.a} ${getOpDisplay(Ops.div, multiplySymbol)} ${equation.b}`;
  }
  if (equation.op === Ops.unitPrice) {
    // "4 each × 12" or "30 ÷ 12". The multiply direction needs the "each"
    // to read as a shopping question rather than plain multiplication —
    // without it the display would be character-for-character a multiply
    // drill, which is exactly what this toggle used to collapse into.
    return equation.unitEach
      ? `${equation.a} ${getOpDisplay(Ops.div, multiplySymbol)} ${equation.b}`
      : `${equation.a} each ${getOpDisplay(Ops.mult, multiplySymbol)} ${equation.b}`;
  }
  if (equation.op === Ops.tip) {
    // "45 + 15% tip" — a whole-dollar bill and a whole-percent rate.
    return `${equation.a} + ${equation.b}% tip`;
  }
  if (equation.op === Ops.discount) {
    // "45 - 15% off" — the same rate taken off instead of added.
    return `${equation.a} - ${equation.b}% off`;
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
/**
 * The question as shown to the player.
 *
 * Ends in `= ?` rather than a bare `?` (2026-10-04): the prompt now reads
 * as a complete sentence — "7 - 6 = ?" — instead of a dangling "7 - 6?".
 * The shape is unchanged for the other forms; only the trailing blank is
 * filled in, so a "missing operand" question reads "7 + ? = 12 = ?"... which
 * is why the missing/balance shapes are left WITHOUT the extra "=": they
 * already carry their own "=" and a second one would be nonsense. Those are
 * detected by `hasQuestionMark`.
 */
export function formatEquationPrompt(
  equation: Equation,
  multiplySymbol: MultiplySymbol,
): string {
  const body = formatEquation(equation, multiplySymbol);
  // Two shapes must NOT get the extra "=":
  //  - anything that already contains one (missing operand, missing
  //    divisor, balance drill) — a second "=" would be nonsense;
  //  - the sequence drill, whose body ends in a comma ("1, 4, 9, 16, "), so
  //    "= ?" would read "1, 4, 9, 16,  = ?" — it is a "what comes next"
  //    question, not an equation.
  // Everything else becomes a complete sentence: "7 - 6 = ?".
  if (hasQuestionMark(equation) || equation.op === Ops.seq) {
    return `${body}?`;
  }
  return `${body} = ?`;
}

/**
 * The question split AROUND the blank the player fills, so the answer field
 * can be rendered IN the equation instead of after it.
 *
 * `formatEquationPrompt` returns one flat string, which forces the "?" to
 * be a character at the end of a line. That is wrong for the two shapes
 * whose blank is in the MIDDLE: the missing-operand and balance drills ask
 * for the number between the operands, so their prompt reads
 * "7 + ? = 12?" — a "?" the player must NOT type into (the answer goes in
 * the other one) and a second, redundant "?" glued to the right-hand side.
 * Anchoring the field to the blank the player actually fills puts the box
 * where the question is: "7 + [__] = 12", with nothing left over.
 *
 * So: for a shape that already carries a "?" (missing operand, missing
 * divisor, balance), the split is at THAT "?"; for everything else the
 * blank is the trailing answer prompt and the split is after the "=" (or
 * after the sequence's trailing comma, which is why the sequence needs no
 * separator — see formatEquation).
 *
 * Both halves keep their original spacing, so a caller can render
 * `before`, the field and `after` as adjacent inline runs.
 */
export function equationAnswerSlot(
  equation: Equation,
  multiplySymbol: MultiplySymbol,
): { before: string; after: string } {
  const body = formatEquation(equation, multiplySymbol);
  if (hasQuestionMark(equation)) {
    const i = body.indexOf("?");
    // `hasQuestionMark` and `formatEquation` are driven off the same two
    // flags, so the "?" is always there; the guard only keeps a malformed
    // equation from slicing at -1 and inverting the halves.
    if (i >= 0) {
      return { before: body.slice(0, i), after: body.slice(i + 1) };
    }
  }
  // The sequence body already ends in ", " (see formatEquation); every
  // other shape gets the "=" that makes the line a sentence.
  return equation.op === Ops.seq
    ? { before: body, after: "" }
    : { before: `${body} = `, after: "" };
}
