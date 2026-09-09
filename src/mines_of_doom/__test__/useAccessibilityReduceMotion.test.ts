/**
 * Hook-level tests for useAccessibilityReduceMotion — the pass-3
 * "reduce effects" decision: the manual settings toggle (settings.
 * reduceEffects) OR'd with the web-only OS reduce-motion preference.
 * The native half is a constant (RN has no reduce-motion API yet), so
 * these pin that the toggle alone drives the result everywhere, that on
 * web the OS signal still works on its own, and that a live OS
 * preference change is picked up.
 */
import { act, renderHook } from "@testing-library/react-native";
import { Platform } from "react-native";
import { useAccessibilityReduceMotion } from "../hooks/useAccessibilityReduceMotion";

type MediaListener = (event: { matches: boolean }) => void;

function mockMedia(matches: boolean) {
  const listeners = new Set<MediaListener>();
  return {
    matches,
    addEventListener(_type: string, listener: MediaListener) {
      listeners.add(listener);
    },
    removeEventListener(_type: string, listener: MediaListener) {
      listeners.delete(listener);
    },
    fireChange(newMatches: boolean) {
      for (const listener of listeners) listener({ matches: newMatches });
    },
  };
}

let media: ReturnType<typeof mockMedia> | null = null;

/** Temporarily pretend the app is running on a given Platform.OS (same
 *  defineProperty pattern as share.test.ts). */
function withPlatformOS(os: string, fn: () => void) {
  const original = Object.getOwnPropertyDescriptor(Platform, "OS");
  Object.defineProperty(Platform, "OS", { value: os, configurable: true });
  try {
    fn();
  } finally {
    Object.defineProperty(Platform, "OS", original!);
  }
}

function setWebWindow(osPreference: boolean) {
  media = mockMedia(osPreference);
  (globalThis as Record<string, unknown>).window = {
    matchMedia: () => media,
  };
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>).window;
  media = null;
});

describe("useAccessibilityReduceMotion", () => {
  it("the manual toggle alone reduces effects on a non-web platform", () => {
    withPlatformOS("ios", () => {
      const { result } = renderHook(() => useAccessibilityReduceMotion(true));
      expect(result.current).toBe(true);
    });
  });

  it("stays false without the toggle and without the OS signal", () => {
    withPlatformOS("android", () => {
      const { result } = renderHook(() => useAccessibilityReduceMotion());
      expect(result.current).toBe(false);
    });
  });

  it("on web, the OS preference reduces effects on its own", () => {
    withPlatformOS("web", () => {
      setWebWindow(true);
      const { result } = renderHook(() => useAccessibilityReduceMotion());
      expect(result.current).toBe(true);
    });
  });

  it("on web, the manual toggle wins even when the OS preference is off", () => {
    withPlatformOS("web", () => {
      setWebWindow(false);
      const { result } = renderHook(() => useAccessibilityReduceMotion(true));
      expect(result.current).toBe(true);
    });
  });

  it("on web, a live OS preference change is picked up and reversed", () => {
    withPlatformOS("web", () => {
      setWebWindow(false);
      const { result } = renderHook(() => useAccessibilityReduceMotion());
      expect(result.current).toBe(false);
      act(() => media?.fireChange(true));
      expect(result.current).toBe(true);
      act(() => media?.fireChange(false));
      expect(result.current).toBe(false);
    });
  });
});
