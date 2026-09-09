import { useEffect, useState } from "react";
import { Platform } from "react-native";

/**
 * The reduce-effects decision: the player's manual "reduce effects"
 * settings toggle (settings.reduceEffects, the pass-3 accessibility item)
 * OR'd with the OS-level "reduce motion" preference.
 *
 * Only the web platform exposes the OS preference to JS via
 * `matchMedia("(prefers-reduced-motion: reduce)")`; React Native has no
 * API for the equivalent iOS (`UIAccessibility.isReduceMotionEnabled`) /
 * Android (`WindowInsets.isMotionReduced`) settings, so on native the
 * manual toggle is the only signal. Either signal being on turns the
 * decorative effects (debris particles, combo flash, gem-pocket pulse,
 * miner bobbing, save-pill pulse) off; both off leaves everything on.
 */
export function useAccessibilityReduceMotion(manualReduce = false): boolean {
   const [osReduceMotion, setOsReduceMotion] = useState(false);

   useEffect(() => {
      if (Platform.OS !== "web" || typeof window === "undefined") {
         return;
      }
      if (typeof window.matchMedia !== "function") {
         return;
      }
      const media = window.matchMedia("(prefers-reduced-motion: reduce)");
      setOsReduceMotion(media.matches);
      const listener = (event: MediaQueryListEvent) =>
         setOsReduceMotion(event.matches);
      media.addEventListener("change", listener);
      return () => media.removeEventListener("change", listener);
   }, []);

   return manualReduce || osReduceMotion;
}

export default useAccessibilityReduceMotion;
