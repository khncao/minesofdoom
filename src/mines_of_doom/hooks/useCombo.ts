import { Animated } from "react-native";
import { useCallback, useRef, useState } from "react";
import { getComboMultiplier } from "../game";

export function useCombo(reduceMotion = false) {
  const [combo, setCombo] = useState(0);
  const comboMultiplier = getComboMultiplier(combo);

  const flashAnim = useRef(new Animated.Value(1)).current;
  const springRef = useRef<Animated.CompositeAnimation | null>(null);

  const flash = useCallback(() => {
    // Respect the OS reduce-motion preference: keep the indicator static.
    if (reduceMotion) {
      return;
    }
    springRef.current?.stop();
    flashAnim.setValue(1.6);
    springRef.current = Animated.spring(flashAnim, {
      toValue: 1,
      useNativeDriver: true,
    });
    springRef.current.start();
  }, [flashAnim, reduceMotion]);

  const increment = useCallback(() => {
    flash();
    setCombo((c) => c + 1);
  }, [flash]);

  // Combo loss with optional resistance (tier-3 upgrade): keep `ratio`
  // (a fraction in [0, 1]) of the combo instead of zeroing it.
  const reset = useCallback((ratio: number = 0) => {
    setCombo((c) => Math.max(0, Math.floor(c * ratio)));
  }, []);

  // Rewarded-ad combo save: restore a previously lost combo. Never pushes
  // the combo BELOW where the player already is (they may have rebuilt a
  // chunk of it since the loss) — the restore is max(current, value).
  const restore = useCallback((value: number) => {
    setCombo((c) => Math.max(c, Math.max(0, Math.floor(value))));
  }, []);

  return { combo, comboMultiplier, flashAnim, increment, reset, restore };
}
