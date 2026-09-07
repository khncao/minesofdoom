/**
 * Haptics (todo: "Haptics + sound volume controls" — the haptics half):
 * pure pattern rules in haptics.ts and the settings/throttle gate in
 * useHaptics. The patterns mirror the juice-wave scaling (juice.ts), so
 * the hand feels what the eyes see.
 */
import { renderHook, act } from "@testing-library/react-native";
import { Vibration } from "react-native";
import {
  getHapticPattern,
  getTapHapticDuration,
} from "../haptics";
import { useHaptics } from "../hooks/useHaptics";
import { MAX_JUICE_WAVES } from "../juice";

const vibrate = Vibration.vibrate as jest.Mock;

describe("haptics (pure)", () => {
  test("tap tick scales with the juice waves of the gain", () => {
    // One wave per decimal digit (juice.ts), 10ms base + 4ms per extra wave.
    expect(getTapHapticDuration(1n)).toBe(10);
    expect(getTapHapticDuration(9n)).toBe(10);
    expect(getTapHapticDuration(100n)).toBe(18);
    expect(getTapHapticDuration(1234n)).toBe(22);
  });

  test("tap tick caps at the max juice waves and never drops below the base", () => {
    expect(getTapHapticDuration(10n ** 49n)).toBe(26);
    expect(getTapHapticDuration(0n)).toBe(10);
    expect(getTapHapticDuration(-5n)).toBe(10);
  });

  test("tap pattern is a single-shot ms duration, scaled and clamped", () => {
    expect(getHapticPattern("tap", 1)).toBe(10);
    expect(getHapticPattern("tap", 3)).toBe(18);
    expect(getHapticPattern("tap", MAX_JUICE_WAVES)).toBe(26);
    // Out-of-range intensities clamp instead of producing absurd values.
    expect(getHapticPattern("tap", 0)).toBe(10);
    expect(getHapticPattern("tap", 99)).toBe(26);
    expect(getHapticPattern("tap", Number.NaN)).toBe(10);
  });

  test("success and error are multi-beat patterns leading with an iOS delay", () => {
    const success = getHapticPattern("success");
    const error = getHapticPattern("error");
    expect(Array.isArray(success)).toBe(true);
    expect(Array.isArray(error)).toBe(true);
    // iOS vibration patterns must start with a delay element (0 here);
    // Android ignores it.
    expect((success as number[])[0]).toBe(0);
    expect((error as number[])[0]).toBe(0);
    // Distinct beats: the error thud is longer than any success beat.
    expect(Math.max(...(error as number[]))).toBeGreaterThan(
      Math.max(...(success as number[])),
    );
  });
});

describe("useHaptics", () => {
  let now: number;
  let nowSpy: jest.SpyInstance;

  beforeEach(() => {
    vibrate.mockReset();
    now = 1_000_000;
    nowSpy = jest
      .spyOn(Date, "now")
      .mockImplementation(() => now);
  });

  afterEach(() => {
    nowSpy.mockRestore();
  });

  it("fires the pattern for the kind and intensity when enabled", () => {
    const { result } = renderHook(() => useHaptics(true));
    act(() => result.current.haptic("error"));
    expect(vibrate).toHaveBeenCalledWith(getHapticPattern("error"));
    now += 51; // clear the throttle window
    act(() => result.current.haptic("tap", 3));
    expect(vibrate).toHaveBeenLastCalledWith(getHapticPattern("tap", 3));
  });

  it("never vibrates while disabled, and re-enabling takes effect", () => {
    const { result, rerender } = renderHook(
      (p: { enabled: boolean }) => useHaptics(p.enabled),
      { initialProps: { enabled: false } },
    );
    act(() => result.current.haptic("error"));
    expect(vibrate).not.toHaveBeenCalled();
    now += 1000;
    rerender({ enabled: true });
    act(() => result.current.haptic("error"));
    expect(vibrate).toHaveBeenCalledWith(getHapticPattern("error"));
  });

  it("throttles bursts: one vibration per HAPTIC_THROTTLE_MS window", () => {
    const { result } = renderHook(() => useHaptics(true));
    act(() => result.current.haptic("success")); // t=0 — fires
    now += 10;
    act(() => result.current.haptic("error")); // t=10 — within window, dropped
    now += 39;
    act(() => result.current.haptic("tap")); // t=49 — still within, dropped
    now += 51;
    act(() => result.current.haptic("tap")); // t=100 — after the window, fires
    expect(vibrate).toHaveBeenCalledTimes(2);
  });

  it("keeps a stable callback identity", () => {
    const { result } = renderHook(() => useHaptics(true));
    const first = result.current.haptic;
    act(() => result.current.haptic("tap"));
    expect(result.current.haptic).toBe(first);
  });
});
