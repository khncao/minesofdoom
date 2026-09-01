import { Animated } from "react-native";
import { useCallback, useRef, useState } from "react";

export function useCombo() {
  const [combo, setCombo] = useState(0);
  const comboMultiplier = 1 + Math.floor(combo / 10);

  const flashAnim = useRef(new Animated.Value(1)).current;
  const springRef = useRef<Animated.CompositeAnimation | null>(null);

  const flash = useCallback(() => {
    springRef.current?.stop();
    flashAnim.setValue(1.6);
    springRef.current = Animated.spring(flashAnim, {
      toValue: 1,
      useNativeDriver: true,
    });
    springRef.current.start();
  }, [flashAnim]);

  const increment = useCallback(() => {
    flash();
    setCombo((c) => c + 1);
  }, [flash]);

  const reset = useCallback(() => setCombo(0), []);

  return { combo, comboMultiplier, flashAnim, increment, reset };
}
