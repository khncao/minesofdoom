/**
 * Tests for the juice-scaling math (juice.ts): waves and floating-text size
 * scale one step per decimal digit of the mined amount, and cap.
 */
import {
  MAX_JUICE_WAVES,
  MIN_TEXT_SIZE,
  MAX_TEXT_SIZE,
  getJuiceWaves,
  getJuiceTextSize,
} from "../juice";

describe("getJuiceWaves — one wave per digit, capped", () => {
  it("a non-positive gain still earns one wave (a mine always feels like a mine)", () => {
    expect(getJuiceWaves(0n)).toBe(1);
    expect(getJuiceWaves(-5n)).toBe(1);
  });

  it("each decimal digit of the gain adds a wave", () => {
    expect(getJuiceWaves(1n)).toBe(1);
    expect(getJuiceWaves(9n)).toBe(1);
    expect(getJuiceWaves(10n)).toBe(2);
    expect(getJuiceWaves(99n)).toBe(2);
    expect(getJuiceWaves(100n)).toBe(3);
    expect(getJuiceWaves(1_000n)).toBe(4);
    expect(getJuiceWaves(12_345n)).toBe(5);
  });

  it("caps at MAX_JUICE_WAVES no matter how big the gain grows", () => {
    expect(MAX_JUICE_WAVES).toBeGreaterThan(1);
    expect(getJuiceWaves(10n ** 30n)).toBe(MAX_JUICE_WAVES);
    // Prestige-scale gains keep the cap too.
    expect(getJuiceWaves(10n ** 100n)).toBe(MAX_JUICE_WAVES);
  });
});

describe("getJuiceTextSize — one step per wave, capped", () => {
  it("small gains float at the minimum size", () => {
    expect(getJuiceTextSize(1n)).toBe(MIN_TEXT_SIZE);
    expect(getJuiceTextSize(9n)).toBe(MIN_TEXT_SIZE);
    expect(getJuiceTextSize(0n)).toBe(MIN_TEXT_SIZE);
  });

  it("grows monotonically with the gain and caps at MAX_TEXT_SIZE", () => {
    let prev = getJuiceTextSize(0n);
    for (const gain of [1n, 10n, 100n, 1000n, 10000n, 10n ** 30n]) {
      const size = getJuiceTextSize(gain);
      expect(size).toBeGreaterThanOrEqual(prev);
      expect(size).toBeLessThanOrEqual(MAX_TEXT_SIZE);
      prev = size;
    }
    expect(getJuiceTextSize(10n ** 30n)).toBe(MAX_TEXT_SIZE);
  });
});
