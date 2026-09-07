import { formatDuration, formatNumber } from "./format";

describe("formatNumber", () => {
  test("small numbers shown in full", () => {
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(999)).toBe("999");
    expect(formatNumber(9999)).toBe("9999");
  });

  test("compact suffixes", () => {
    expect(formatNumber(12345)).toBe("12.3k");
    expect(formatNumber(100000)).toBe("100k");
    expect(formatNumber(1234567)).toBe("1.23M");
    expect(formatNumber(3400000000)).toBe("3.4B");
  });

  test("non-finite input doesn't throw", () => {
    expect(formatNumber(NaN)).toBe("NaN");
    expect(formatNumber(Infinity)).toBe("Infinity");
  });

  test("formatDuration shows the two most significant units", () => {
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(42)).toBe("42s");
    expect(formatDuration(59)).toBe("59s");
    expect(formatDuration(60)).toBe("1m 0s");
    expect(formatDuration(754)).toBe("12m 34s");
    expect(formatDuration(3599)).toBe("59m 59s");
    expect(formatDuration(3600)).toBe("1h 0m");
    expect(formatDuration(16200)).toBe("4h 30m");
    expect(formatDuration(86400)).toBe("1d 0h");
    expect(formatDuration(3 * 86400 + 4 * 3600 + 12 * 60)).toBe("3d 4h");
    // Seconds-only input never invents a higher unit.
    expect(formatDuration(3661)).toBe("1h 1m");
  });

  test("formatDuration clamps junk input to 0s", () => {
    expect(formatDuration(-5)).toBe("0s");
    expect(formatDuration(NaN)).toBe("0s");
    expect(formatDuration(Infinity)).toBe("0s");
    // Fractional seconds truncate.
    expect(formatDuration(42.9)).toBe("42s");
  });

  test("bigint inputs format identically to their number equivalents", () => {
    expect(formatNumber(0n)).toBe("0");
    expect(formatNumber(9999n)).toBe("9999");
    expect(formatNumber(10000n)).toBe("10k");
    expect(formatNumber(12345n)).toBe("12.3k");
    expect(formatNumber(100000n)).toBe("100k");
    expect(formatNumber(5_000_000n)).toBe("5M");
    expect(formatNumber(1234567n)).toBe("1.23M");
    expect(formatNumber(3_400_000_000n)).toBe("3.4B");
    // Trailing-zero trimming matches the number path (1.20 -> "1.2").
    expect(formatNumber(1_200_000_000n)).toBe("1.2B");
    // Beyond precision of `number`, still exact, and tier caps at Qi.
    expect(formatNumber(1_234_567_890_123_456_789n)).toBe("1.23Qi");
  });
});
