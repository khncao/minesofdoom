import { Animated } from "react-native";
import { useCallback, useRef } from "react";

export function useShakeInput() {
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const seqRef = useRef<Animated.CompositeAnimation | null>(null);

  const shake = useCallback(() => {
    // Cancel the in-flight shake instead of stacking another sequence.
    seqRef.current?.stop();
    shakeAnim.setValue(0);
    seqRef.current = Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 80, useNativeDriver: true }),
    ]);
    seqRef.current.start();
  }, [shakeAnim]);

  return { shakeAnim, shake };
}
