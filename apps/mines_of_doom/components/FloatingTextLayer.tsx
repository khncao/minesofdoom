import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Animated, Easing, Text, View } from "react-native";

export type FloatingTextRef = {
  spawn: (text: string, color?: string) => void;
};

type Item = {
  id: number;
  text: string;
  color: string;
  x: number; // horizontal jitter, in % of container width
};

let nextId = 0;

// Hard cap so a tap-spam burst can't build up an unbounded list of
// animations (oldest ones simply keep running out; new ones are dropped).
const MAX_ITEMS = 16;

const FloatingText = ({
  item,
  onDone,
}: {
  item: Item;
  onDone: (id: number) => void;
}) => {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.parallel([
      Animated.timing(translateY, {
        toValue: -48,
        duration: 900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 700,
        delay: 200,
        useNativeDriver: true,
      }),
    ]);
    anim.start(({ finished }) => {
      if (finished) {
        onDone(item.id);
      }
    });
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: "30%",
        left: `${50 + item.x}%`,
        opacity,
        transform: [{ translateY }],
      }}
    >
      <Text
        style={{
          color: item.color,
          fontSize: 18,
          fontWeight: "bold",
          textShadowColor: "black",
          textShadowRadius: 3,
          textShadowOffset: { width: 1, height: 1 },
        }}
      >
        {item.text}
      </Text>
    </Animated.View>
  );
};

/**
 * Imperative overlay of floating "+N" texts. Kept out of React state on the
 * parent (spawns go through a ref) so the game screen itself doesn't
 * re-render on every tap/answer.
 */
const FloatingTextLayer = forwardRef<FloatingTextRef>(function FloatingTextLayer(
  _props,
  ref,
) {
  const [items, setItems] = useState<Item[]>([]);

  const spawn = useCallback((text: string, color = "#fff") => {
    setItems((prev) =>
      prev.length >= MAX_ITEMS
        ? prev
        : [
            ...prev,
            { id: nextId++, text, color, x: (Math.random() - 0.5) * 30 },
          ],
    );
  }, []);

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  useImperativeHandle(ref, () => ({ spawn }), [spawn]);

  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
    >
      {items.map((i) => (
        <FloatingText key={i.id} item={i} onDone={remove} />
      ))}
    </View>
  );
});

export default FloatingTextLayer;
