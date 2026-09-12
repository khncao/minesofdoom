/**
 * Tests for the UI text scale (Tier 1 #2 of docs/gap-ranking.md).
 *
 * The module (textScale.tsx) persists ONE of four discrete steps
 * (TEXT_SCALE_STEPS), sanitizes anything stored, and the `T` wrapper
 * applies the step by walking each Text's style at render time. These
 * tests pin the step band, the sanitization (a hand-edited AsyncStorage
 * blob must be harmless), and the style-walk math. No component tests —
 * repo convention is pure logic only.
 */

import type { StyleProp, TextStyle } from "react-native";
import {
  TEXT_SCALE_STEPS,
  applyTextScale,
  nextTextScale,
  sanitizeTextScale,
} from "../textScale";

describe("TEXT_SCALE_STEPS", () => {
  it("is a contiguous, ordered band around 1 (default in the middle)", () => {
    expect(TEXT_SCALE_STEPS).toEqual([0.85, 1, 1.15, 1.3]);
    expect(TEXT_SCALE_STEPS).toContain(1);
  });
});

describe("sanitizeTextScale", () => {
  it("coerces a stored value to the nearest step", () => {
    expect(sanitizeTextScale(0.85)).toBe(0.85);
    expect(sanitizeTextScale(1.3)).toBe(1.3);
    expect(sanitizeTextScale(0.9)).toBe(0.85);
    expect(sanitizeTextScale(1.1)).toBe(1.15);
    expect(sanitizeTextScale(1)).toBe(1);
  });

  it("rejects anything that is not a finite number → default step 1", () => {
    expect(sanitizeTextScale(undefined)).toBe(1);
    expect(sanitizeTextScale(null)).toBe(1);
    expect(sanitizeTextScale("1.1")).toBe(1);
    expect(sanitizeTextScale(NaN)).toBe(1);
    expect(sanitizeTextScale(Infinity)).toBe(1);
    expect(sanitizeTextScale(-100)).toBe(0.85); // nearest valid step wins
    expect(sanitizeTextScale(100)).toBe(1.3); // garbage far above → top step
  });
});

describe("nextTextScale", () => {
  it("moves one step and clamps at both ends", () => {
    expect(nextTextScale(1, -1)).toBe(0.85);
    expect(nextTextScale(1, 1)).toBe(1.15);
    expect(nextTextScale(0.85, -1)).toBe(0.85); // clamped low
    expect(nextTextScale(1.3, 1)).toBe(1.3); // clamped high
  });

  it("sanitizes a garbage current value before moving", () => {
    expect(nextTextScale("nope", 1)).toBe(1.15); // 1 (default) + 1
    expect(nextTextScale(100, -1)).toBe(1.15); // 100 → 1.3, then −1
  });
});

describe("applyTextScale", () => {
  it("is identity (same reference) when the scale is 1", () => {
    const style = { fontSize: 14, color: "#fff" };
    expect(applyTextScale(style, 1)).toBe(style);
  });

  it("scales and rounds a fontSize, leaving the other keys untouched", () => {
    const out = applyTextScale(
      { fontSize: 14, fontWeight: "bold", lineHeight: 18 },
      1.3,
    ) as { fontSize: number; fontWeight: string; lineHeight: number };
    expect(out.fontSize).toBe(Math.round(14 * 1.3)); // 18
    expect(out.fontWeight).toBe("bold");
    expect(out.lineHeight).toBe(18); // ratios preserved: no clipping
  });

  it("floors scaled sizes at 8px so small labels never vanish", () => {
    const out = applyTextScale({ fontSize: 4 }, 0.85) as { fontSize: number };
    expect(out.fontSize).toBe(8);
  });

  it("returns the same reference when the style has no numeric fontSize", () => {
    const style = { fontWeight: "bold" as const };
    expect(applyTextScale(style, 1.3)).toBe(style);
    const zero = { fontSize: 0 };
    // 0 is numeric — it still gets scaled (Math.max(8, ...) applies).
    expect((applyTextScale(zero, 1.3) as { fontSize: number }).fontSize).toBe(
      8,
    );
  });

  it("walks arrays, preserving order and dropping nothing", () => {
    const input = [undefined, { fontSize: 14 }, null];
    const out = applyTextScale(input, 1.15) as Array<
      Record<string, unknown> | null | undefined
    >;
    expect(out).toHaveLength(3);
    expect(out[0]).toBeUndefined();
    expect(out[1]).toEqual({ fontSize: Math.round(14 * 1.15) });
    expect(out[2]).toBeNull();
  });

  it("returns the same array reference when nothing carried a fontSize", () => {
    const input: Array<StyleProp<TextStyle>> = [{ opacity: 1 }, undefined];
    expect(applyTextScale(input, 1.3)).toBe(input);
  });

  it("handles nested arrays (StyleSheet.create entries in arrays)", () => {
    const out = applyTextScale([[{ fontSize: 10 }]], 1.3) as Array<
      Array<{ fontSize: number }>
    >;
    expect(out).toEqual([[{ fontSize: Math.round(10 * 1.3) }]]);
  });

  it("passes non-numeric fontSize entries through untouched", () => {
    // Animated.Value stands in for its numeric string form; anything
    // that isn't a finite number must survive the walk unchanged.
    const animatedLike = { fontSize: { __animated: true } } as unknown as StyleProp<
      TextStyle
    >;
    expect(applyTextScale(animatedLike, 1.3)).toBe(animatedLike);
  });
});
