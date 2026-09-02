import { useEffect, useState } from "react";
import { Platform } from "react-native";

/**
 * Respect the OS-level "reduce motion" preference for decorative effects
 * (debris particles, combo flash).
 *
 * Only the web platform exposes the preference to JS via
 * `matchMedia("(prefers-reduced-motion: reduce)")`; React Native has no
 * API for the equivalent iOS (`UIAccessibility.isReduceMotionEnabled`) /
 * Android (`WindowInsets.isMotionReduced`) settings yet, so native
 * defaults to false.
 */
export function useAccessibilityReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") {
      return;
    }
    if (typeof window.matchMedia !== "function") {
      return;
    }
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(media.matches);
    const listener = (event: MediaQueryListEvent) =>
      setReduceMotion(event.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  return reduceMotion;
}

export default useAccessibilityReduceMotion;
