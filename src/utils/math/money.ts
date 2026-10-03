/**
 * Currency primitives (todo: "decimal money answers").
 *
 * Everything monetary in the game — tips, change, unit prices, splitting a
 * bill — is carried as DECIMAL DOLLARS in the Equation (`a`, `b`,
 * `answer`), because that is what the player types, and every calculation
 * that produces one is done in integer CENTS and divided by 100 once at
 * the end.
 *
 * Why not just compare floats (the old `approxeq` epsilon approach): two
 * decimal places are not representable in binary, so `0.1 + 0.2 !== 0.3`,
 * and an epsilon has to be loose enough to absorb that slop — which makes
 * it also accept answers the player got wrong. Comparing in integer cents
 * is exact, and it means "5.6", "5.60" and "05.600" are all the same
 * answer while "5.61" is not.
 */

/** Cents per dollar. Every money value in the game is a multiple of this. */
export const CENTS = 100;

/**
 * The value in integer cents. Rounding here is deliberate and load-bearing:
 * it absorbs the binary-representation error of a decimal built by
 * arithmetic (`0.1 + 0.2` → 0.30000000000000004 → 30 cents), so the
 * comparison is exact at the precision the game actually means.
 */
export function toCents(value: number): number {
  return Math.round(value * CENTS);
}

/** Cents → the decimal dollars the player sees and types. */
export function fromCents(cents: number): number {
  return cents / CENTS;
}

/** Snap a value to the nearest cent (guards against float drift). */
export function roundMoney(value: number): number {
  return toCents(value) / CENTS;
}

/**
 * Whether a value IS a whole number of cents — the money invariant the
 * generators promise.
 *
 * The tolerance is binary float error, not a real sub-cent amount: 19.99
 * is stored as 1998.9999999999998, so an exact comparison would reject
 * every price the game produces. A genuine sub-cent value (22.401 → 2240.1)
 * is nowhere near an integer, so the same test still catches it.
 */
export function isMoney(value: number): boolean {
  if (!Number.isFinite(value)) return false;
  const scaled = value * CENTS;
  return Math.abs(scaled - Math.round(scaled)) < 1e-6;
}

/**
 * Compare a typed answer against the expected one at currency precision.
 *
 * Replaces the old epsilon `approxeq(v1, v2, 0.01)`, which was wrong in
 * both directions: too tight to be reliable on decimals and too loose to
 * catch a genuine mistake. Integer cents is both exact and strict.
 */
export function answersEqual(input: number, answer: number): boolean {
  return toCents(input) === toCents(answer);
}

/**
 * A money value as it is displayed: always two decimal places, so a bill
 * reads "12.40" and never "12.4".
 */
export function formatMoney(value: number): string {
  return (toCents(value) / CENTS).toFixed(2);
}