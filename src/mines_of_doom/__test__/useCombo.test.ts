/**
 * Hook-level tests for the combo counter (useCombo): increment / reset with
 * resistance / restore-from-rewarded-ad, plus the reduce-motion gate on the
 * flash animation. The multiplier steps themselves live in game.test.ts —
 * these tests pin the state transitions the engine hooks into.
 */
import { renderHook, act } from "@testing-library/react-native";
import { Animated } from "react-native";
import { useCombo } from "../hooks/useCombo";
import { getComboMultiplier } from "../game";

/**
 * Animated springs drive the native animated module, which doesn't exist in
 * jest — stub just the factory (the rest of react-native stays real, so the
 * RTL renderer is unaffected).
 */
const realSpring = Animated.spring;
let springMock: jest.Mock;
beforeEach(() => {
  springMock = jest.fn(() => ({ start: jest.fn(), stop: jest.fn() }));
  (Animated as unknown as { spring: unknown }).spring = springMock;
});
afterEach(() => {
  (Animated as unknown as { spring: unknown }).spring = realSpring;
});

describe("useCombo", () => {
  it("starts at zero with a multiplier of 1", () => {
    const { result } = renderHook(() => useCombo());
    expect(result.current.combo).toBe(0);
    expect(result.current.comboMultiplier).toBe(1);
  });

  it("increment raises the combo and the multiplier follows getComboMultiplier", () => {
    const { result } = renderHook(() => useCombo());
    for (let i = 0; i < 12; i++) act(() => result.current.increment());
    expect(result.current.combo).toBe(12);
    expect(result.current.comboMultiplier).toBe(getComboMultiplier(12));
    expect(result.current.comboMultiplier).toBe(2);
  });

  it("reset() zeroes the combo", () => {
    const { result } = renderHook(() => useCombo());
    for (let i = 0; i < 7; i++) act(() => result.current.increment());
    act(() => result.current.reset());
    expect(result.current.combo).toBe(0);
    expect(result.current.comboMultiplier).toBe(1);
  });

  it("reset(ratio) keeps the resistanced (floored) fraction", () => {
    const { result } = renderHook(() => useCombo());
    for (let i = 0; i < 7; i++) act(() => result.current.increment());
    act(() => result.current.reset(0.5));
    expect(result.current.combo).toBe(Math.floor(7 * 0.5));
    // A ratio of 1 keeps everything (max resistance).
    act(() => result.current.reset(1));
    expect(result.current.combo).toBe(3);
  });

  it("restore never pushes the combo below the current value", () => {
    const { result } = renderHook(() => useCombo());
    for (let i = 0; i < 5; i++) act(() => result.current.increment());
    act(() => result.current.restore(3));
    expect(result.current.combo).toBe(5);
    act(() => result.current.restore(8.9));
    expect(result.current.combo).toBe(8);
  });

  it("restore clamps non-positive saved values to the current zero", () => {
    const { result } = renderHook(() => useCombo());
    act(() => result.current.restore(0));
    expect(result.current.combo).toBe(0);
    act(() => result.current.restore(-4));
    expect(result.current.combo).toBe(0);
  });

  it("increment fires the flash spring (default motion)", () => {
    const { result } = renderHook(() => useCombo(false));
    act(() => result.current.increment());
    expect(springMock).toHaveBeenCalledTimes(1);
    expect(springMock).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ toValue: 1, useNativeDriver: true }),
    );
  });

  it("reduceMotion: the flash stays static (no spring) but the counter still moves", () => {
    const { result } = renderHook(() => useCombo(true));
    act(() => result.current.increment());
    expect(springMock).not.toHaveBeenCalled();
    expect(result.current.combo).toBe(1);
  });
});
