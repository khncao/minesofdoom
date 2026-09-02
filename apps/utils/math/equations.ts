export type EquationSettings = {
  minNumber: number;
  maxNumber: number;
  multiply: boolean;
  add: boolean;
  subtract: boolean;
  division: boolean;
  /**
   * Hard mode (tier-5 "Motherlode" endgame, plan §4.2): every equation is
   * 3 terms (a ○ b ○ c, evaluated strictly left-to-right) and every correct
   * answer pays HARD_MODE_PAYOUT (see game.ts). Off by default; the setting
   * is persisted under the existing equationSettingsKey, so no save bump.
   */
  hardMode: boolean;
};

export const defaultEquationSettings = {
  minNumber: 0,
  maxNumber: 12,
  multiply: true,
  add: false,
  subtract: false,
  division: false,
  hardMode: false,
};

export const Ops = {
  mult: "*",
  add: "+",
  sub: "-",
  div: "/",
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

/**
 * Generate a random equation honoring the enabled operators.
 *
 * Guarantees:
 * - Operands stay within [minNumber, maxNumber).
 * - Subtraction answers are never negative (a >= b), so the answer is
 *   always typeable on a numeric keypad.
 * - Division is always exact (a is a multiple of b), so answers are integers.
 * - If no operators are enabled, falls back to multiplication rather than
 *   returning an equation with an undefined op/answer.
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

  const ops: Array<string> = [
    ...(prefs.multiply ? [Ops.mult] : []),
    ...(prefs.add ? [Ops.add] : []),
    ...(prefs.subtract ? [Ops.sub] : []),
    ...(prefs.division ? [Ops.div] : []),
  ];
  // All operators disabled: fall back to multiplication so the game stays
  // playable (op/answer would otherwise be undefined).
  const pickOp = () =>
    ops.length > 0 ? ops[Math.floor(Math.random() * ops.length)] : Ops.mult;
  const op = pickOp();

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
    default:
      answer = a / b;
  }

  const equation: Equation = { op, a, b, answer };

  // Hard mode (tier-5, plan §4.2): append a second step whose result is the
  // actual answer, evaluated left-to-right. Soft mode returns the plain
  // 2-term shape — no op2/c — so it's bit-identical to the old behavior.
  if (prefs.hardMode) {
    const op2 = pickOp();
    let c: number;
    switch (op2) {
      case Ops.sub:
        // Clamp c to the running result so the final answer stays
        // non-negative (the running result already is, by the guarantees
        // above). Same spirit as the a >= b swap in 2-term subtraction.
        c = Math.min(getRandomIntInRange(minNumber, maxNumber), answer);
        break;
      case Ops.div: {
        if (answer === 0) {
          // 0 / c = 0 is exact for any c; a plain in-range divisor works.
          c = getRandomIntInRange(1, maxNumber);
        } else {
          // Exact division at the second step too: pick a divisor of the
          // running result (d=1 always divides, so the list is never
          // empty and c=1 is the implicit fallback).
          const divisors: number[] = [];
          for (let d = 1; d < maxNumber; d++) {
            if (answer % d === 0) divisors.push(d);
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
        answer = answer * c;
        break;
      case Ops.add:
        answer = answer + c;
        break;
      case Ops.sub:
        answer = answer - c;
        break;
      case Ops.div:
      default:
        answer = answer / c;
    }

    equation.op2 = op2;
    equation.c = c;
    equation.answer = answer;
  }

  return equation;
}
