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
   * Timed mode (plan §4.2): each equation must be answered within
   * TIMED_MODE_WINDOW_MS (game.ts) for the correct answer to pay
   * TIMED_MODE_PAYOUT on top of everything else; when the window runs out
   * the equation counts as a miss (the hook fires the same onIncorrect
   * path as a wrong answer, so combo resistance applies) and a new one is
   * rolled. Off by default; persisted like hardMode (no save bump).
   * Stacks with hard mode (a 3-term equation answered inside the window
   * pays ×HARD_MODE_PAYOUT ×TIMED_MODE_PAYOUT × operator bonus).
   */
  timedMode: boolean;
  /**
   * Streak mode (plan §4.2): STREAK_MODE_THRESHOLD consecutive correct
   * answers ignite a streak that pays STREAK_MODE_PAYOUT (see game.ts) on
   * every correct answer until a wrong answer (or a timed-mode timeout)
   * breaks the run — mine taps do NOT break it (unlike the combo). Off by
   * default; persisted like hardMode (no save bump).
   */
  streakMode: boolean;
  /**
   * How multiplication renders in the equation display (todo:
   * "Configurable equation display"): "asterisk" = "7 * 2", "letter" =
   * "7 x 2". The internal op is always Ops.mult — this is display only.
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
  hardMode: false,
  timedMode: false,
  streakMode: false,
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
   */
  missing?: boolean;
};

export const approxeq = (v1: number, v2: number, epsilon = 0.01) =>
  Math.abs(v1 - v2) <= epsilon;

/** Uniform integer in [min, max) — matches the legacy getRandomInt(max) range. */
export function getRandomIntInRange(min: number, max: number): number {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return lo + Math.floor(Math.random() * (hi - lo));
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
): Equation | null {
  let a = getRandomIntInRange(minNumber, maxNumber);
  let b = getRandomIntInRange(minNumber, maxNumber);

  switch (op) {
    case Ops.sub: {
      // Enforce a >= b so the answer is non-negative.
      if (a < b) [a, b] = [b, a];
      break;
    }
    case Ops.div: {
      // Exact division: pick b (the divisor), then a as a multiple of b
      // within range so the answer is always an integer.
      b = getRandomIntInRange(1, maxNumber); // divisor in [1, maxNumber-1]
      const minK = Math.max(1, Math.ceil(minNumber / b));
      const maxK = Math.floor((maxNumber - 1) / b);
      const k = minK <= maxK ? getRandomIntInRange(minK, maxK + 1) : 1;
      a = b * k;
      break;
    }
    case Ops.sq: {
      // "a²": unary in spirit — b mirrors a so the shape stays a/b.
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
      const p = feasible[Math.floor(Math.random() * feasible.length)];
      const step = 100 / p;
      const minK = Math.max(1, Math.ceil(minNumber / step));
      const maxK = Math.floor((maxNumber - 1) / step);
      const k = getRandomIntInRange(minK, maxK + 1);
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
): Equation {
  const baseOp =
    Math.random() < 0.5 ? Ops.add : Ops.mult;
  if (baseOp === Ops.add) {
    const a = getRandomIntInRange(minNumber, maxNumber);
    // answer = b - a: keep it in [1, maxNumber - minNumber] so the
    // answer is at least as bounded as any other operand.
    const answer = getRandomIntInRange(1, Math.max(1, maxNumber - minNumber));
    const b = a + answer;
    return { op: baseOp, a, b, answer, missing: true };
  }
  // Multiplication: a >= 2 (a = 1 would make the ? trivially equal to b),
  // answer k in [1, maxNumber), shown total b = a * k.
  const lo = Math.max(2, minNumber);
  const a =
    lo < maxNumber
      ? getRandomIntInRange(lo, maxNumber)
      : Math.min(Math.max(1, minNumber), Math.max(1, maxNumber - 1));
  const answer = getRandomIntInRange(1, maxNumber);
  const b = a * answer;
  return { op: baseOp, a, b, answer, missing: true };
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
 *   whole answer >= 1.
 * - If no operators are enabled, falls back to multiplication rather than
 *   returning an equation with an undefined op/answer.
 * - Percent / square / missing are SOFT-MODE-ONLY: in hard mode the pools
 *   (first op and second step) are exactly the classic four operators, so
 *   a 3-term equation can never contain an uncomposable shape.
 * - Hard mode (prefs.hardMode): a second step a op b op2 c is appended,
 *   evaluated strictly left-to-right. The same guarantees hold at the
 *   second step: the running result (and hence the answer) stays integral
 *   and non-negative, division is exact at BOTH steps, and c stays within
 *   [minNumber, maxNumber) except the sub-clamp (c <= running result, so
 *   the answer can't go negative) and the division divisor range.
 */
export function getRandomEquation(prefs: EquationSettings): Equation {
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
  type Choice = { kind: "op"; op: string } | { kind: "missing" };
  const choices: Choice[] = [
    ...regularOps.map((op): Choice => ({ kind: "op", op })),
    ...extraOps.map((op): Choice => ({ kind: "op", op })),
    ...(prefs.missing && !prefs.hardMode ? ([{ kind: "missing" }] as const) : []),
  ];
  // All operators disabled: fall back to multiplication so the game stays
  // playable (op/answer would otherwise be undefined).
  if (choices.length === 0) choices.push({ kind: "op", op: Ops.mult });

  // Percent is occasionally infeasible at a small maxNumber (no base fits);
  // re-pick a bounded number of times, then fall back to plain multiply
  // (which can't fail, so the last return is never actually hit).
  const generate = (): Equation => {
    for (let i = 0; i < choices.length + 1; i++) {
      const choice = choices[Math.floor(Math.random() * choices.length)];
      const eq =
        choice.kind === "missing"
          ? generateMissingEquation(minNumber, maxNumber)
          : generateTermsEquation(choice.op, minNumber, maxNumber);
      if (eq !== null) return eq;
    }
    return {
      op: Ops.mult,
      a: minNumber,
      b: minNumber,
      answer: minNumber * minNumber,
    };
  };
  const equation = generate();

  // Hard mode (tier-5, plan §4.2): append a second step whose result is the
  // actual answer, evaluated left-to-right. Soft mode returns the plain
  // 2-term shape — no op2/c — so it's bit-identical to the old behavior.
  if (prefs.hardMode) {
    const op2Pool = regularOps.length > 0 ? regularOps : [Ops.mult];
    const pickOp = () => op2Pool[Math.floor(Math.random() * op2Pool.length)];
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
        c = Math.min(getRandomIntInRange(minNumber, maxNumber), running);
        break;
      case Ops.div: {
        if (running === 0) {
          // 0 / c = 0 is exact for any c; a plain in-range divisor works.
          c = getRandomIntInRange(1, maxNumber);
        } else {
          // Exact division at the second step too: pick a divisor of the
          // running result (d=1 always divides, so the list is never
          // empty and c=1 is the implicit fallback).
          const divisors: number[] = [];
          for (let d = 1; d < maxNumber; d++) {
            if (running % d === 0) divisors.push(d);
          }
          c = divisors[Math.floor(Math.random() * divisors.length)];
        }
        break;
      }
      default:
        // + and * keep the in-range operand rule.
        c = getRandomIntInRange(minNumber, maxNumber);
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
      return "/";
    case Ops.pct:
      return "%";
    case Ops.sq:
      return "²";
    default:
      return op;
  }
}

/**
 * The human-facing text of an equation (todo: "Configurable equation
 * display" + the soft-mode-only shapes):
 *   mult/add/sub/div  "7 * 2"  (×2 → "7 x 2" per multiplySymbol)
 *   percent          "25% of 40"
 *   square           "7²"
 *   missing          "7 + ? = 12"
 * A hard-mode second step is appended: " 2 * 3".
 */
export function formatEquation(
  equation: Equation,
  multiplySymbol: MultiplySymbol,
): string {
  const sym = getOpDisplay(equation.op, multiplySymbol);
  let text: string;
  if (equation.missing) {
    text = `${equation.a} ${sym} ? = ${equation.b}`;
  } else if (equation.op === Ops.sq) {
    text = `${equation.a}²`;
  } else if (equation.op === Ops.pct) {
    text = `${equation.a}% of ${equation.b}`;
  } else {
    text = `${equation.a} ${sym} ${equation.b}`;
  }
  if (equation.op2 !== undefined && equation.c !== undefined) {
    text += ` ${getOpDisplay(equation.op2, multiplySymbol)} ${equation.c}`;
  }
  return text;
}
