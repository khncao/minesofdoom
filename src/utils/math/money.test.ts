import {
  CENTS,
  answersEqual,
  formatMoney,
  fromCents,
  isMoney,
  roundMoney,
  toCents,
} from "./money";

describe("cents conversion", () => {
  test("toCents / fromCents round-trip at two decimal places", () => {
    expect(toCents(22.4)).toBe(2240);
    expect(toCents(0.05)).toBe(5);
    expect(toCents(100)).toBe(10000);
    expect(fromCents(2240)).toBe(22.4);
    expect(fromCents(5)).toBe(0.05);
    expect(fromCents(toCents(19.99))).toBe(19.99);
  });

  test("toCents absorbs binary float error — the reason it rounds", () => {
    // The textbook case: 0.1 + 0.2 !== 0.3 in IEEE-754.
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents(1.1 * 3)).toBe(330);
    expect(toCents(4.35)).toBe(435); // 4.35 × 100 is 434.99999999999994
  });

  test("roundMoney snaps drift back onto a cent", () => {
    expect(roundMoney(0.30000000000000004)).toBe(0.3);
    expect(roundMoney(22.4)).toBe(22.4);
    expect(roundMoney(2.674)).toBe(2.67);
  });

  test("isMoney accepts whole cents and rejects fractions of a cent", () => {
    expect(isMoney(22.4)).toBe(true);
    expect(isMoney(0)).toBe(true);
    expect(isMoney(19.99)).toBe(true);
    expect(isMoney(22.401)).toBe(false);
    expect(isMoney(0.001)).toBe(false);
    expect(isMoney(Number.NaN)).toBe(false);
    expect(isMoney(Number.POSITIVE_INFINITY)).toBe(false);
  });
});

describe("answersEqual", () => {
  test("the same money in different notation is the same answer", () => {
    // This is the whole point: the player types "5.6", the generator says
    // 5.6, and neither is a float near-miss.
    expect(answersEqual(5.6, 5.6)).toBe(true);
    expect(answersEqual(22.4, 22.4)).toBe(true);
    expect(answersEqual(0.05, 0.05)).toBe(true);
  });

  test("a real mistake is still a mistake", () => {
    // The old epsilon approxeq (0.01) accepted ALL of these, because the
    // gap is smaller than its slop allowance — which is exactly why it was
    // the wrong comparator for money.
    expect(answersEqual(5.61, 5.6)).toBe(false);
    expect(answersEqual(5.59, 5.6)).toBe(false);
    expect(answersEqual(22.41, 22.4)).toBe(false);
    expect(answersEqual(2.5, 2.6)).toBe(false);
  });

  test("a wrong answer by a whole cent is rejected, not rounded in", () => {
    expect(answersEqual(22.39, 22.4)).toBe(false);
    expect(answersEqual(22.41, 22.4)).toBe(false);
  });

  test("integer answers are unaffected by the cents comparison", () => {
    // Every pre-decimal equation still scores exactly as before.
    expect(answersEqual(7, 7)).toBe(true);
    expect(answersEqual(0, 0)).toBe(true);
    expect(answersEqual(6, 7)).toBe(false);
    expect(answersEqual(42, 42)).toBe(true);
  });
});

describe("formatMoney", () => {
  test("always shows two decimal places", () => {
    expect(formatMoney(22.4)).toBe("22.40");
    expect(formatMoney(20)).toBe("20.00");
    expect(formatMoney(0.05)).toBe("0.05");
    expect(formatMoney(7.6)).toBe("7.60");
    expect(formatMoney(1234.5)).toBe("1234.50");
  });

  test("rounds a stray sub-cent value rather than showing three places", () => {
    expect(formatMoney(2.674)).toBe("2.67");
    expect(formatMoney(2.675)).toBe("2.68"); // Math.round is half-up
  });

  test("CENTS is 100 (the precision the whole game agrees on)", () => {
    expect(CENTS).toBe(100);
  });
});