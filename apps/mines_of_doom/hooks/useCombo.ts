import { Animated } from "react-native";
import { useCallback, useRef, useState } from "react";

export function useCombo(reduceMotion = false) {
  const [combo, setCombo] = useState(0);
  const comboMultiplier = 1 + Math.floor(combo / 10);

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

  return { combo, comboMultiplier, flashAnim, increment, reset };
}
