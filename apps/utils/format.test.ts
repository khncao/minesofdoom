import { formatNumber } from "./format";

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
});
