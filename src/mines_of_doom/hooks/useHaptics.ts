import { Vibration } from "react-native";
import { useCallback, useRef } from "react";
import { getHapticPattern, type HapticKind } from "../haptics";

/**
 * Minimum gap between any two haptics (ms). The game fires several events
 * close together (an achievement can land on the same frame as the answer
 * that earned it); one vibration per burst is enough, the rest just smear
 * the feel.
 */
const HAPTIC_THROTTLE_MS = 50;

/**
 * Player haptic feedback (settings toggle `haptics`, on by default).
 * `haptic` keeps a stable identity across renders (the settings value goes
 * through a ref) so it can be memoized into useMineTaps and friends the
 * same way `play` from useSounds is. On platforms without haptics (most
 * desktop browsers) the Vibration call is a no-op — there is nothing to
 * gate, the hardware simply doesn't respond.
 */
export function useHaptics(enabled: boolean) {
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const lastRef = useRef(0);

  const haptic = useCallback((kind: HapticKind, intensity: number = 1) => {
    if (!enabledRef.current) {
      return;
    }
    const now = Date.now();
    if (now - lastRef.current < HAPTIC_THROTTLE_MS) {
      return;
    }
    lastRef.current = now;
    Vibration.vibrate(getHapticPattern(kind, intensity));
  }, []);

  return { haptic };
}
