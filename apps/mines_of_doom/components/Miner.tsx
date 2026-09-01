import React, { MutableRefObject, useContext, useEffect, useRef } from "react";
import { Animated, Text } from "react-native";
import { pickaxeImg } from "assets/index";
import { Context } from "../Context";

export interface MinerProps {
  animateRef?: MutableRefObject<() => void>;
  scale?: number;
  reactOnTick?: boolean;
  isPlayer?: boolean;
}

// Minimum time between pickaxe swings so fast tapping doesn't queue up
// unbounded animations (which triggers "Excessive number of pending callbacks").
const MIN_PICKAXE_INTERVAL = 100;

function Miner({ scale = 1, ...props }: MinerProps) {
  const appContext = useContext(Context);
  const pickaxeAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const lastPickaxeRef = useRef(0);
  const activeAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  const pickaxeAnimate = () => {
    // Throttle so rapid tapping can't stack unbounded pickaxe animations.
    const now = Date.now();
    if (now - lastPickaxeRef.current < MIN_PICKAXE_INTERVAL) {
      return;
    }
    lastPickaxeRef.current = now;
    // Cancel the in-flight swing so fast taps don't run multiple springs on
    // the same values concurrently (they fight each other and stack frame
    // callbacks).
    activeAnimRef.current?.stop();
    pickaxeAnim.setValue(0);
    bounceAnim.setValue(0);
    activeAnimRef.current = Animated.parallel([
      Animated.spring(pickaxeAnim, {
        toValue: 100,
        velocity: 2000,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: -6,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.timing(bounceAnim, {
          toValue: 0,
          duration: 120,
          useNativeDriver: true,
        }),
      ]),
    ]);
    activeAnimRef.current.start();
  };

  useEffect(() => () => {
    activeAnimRef.current?.stop();
  }, []);

  const spin = pickaxeAnim.interpolate({
    inputRange: [0, 90],
    outputRange: ["0deg", "90deg"],
  });

  if (props.animateRef != null) {
    props.animateRef.current = pickaxeAnimate;
  }
  useEffect(() => {
    if (!props.reactOnTick || appContext == null) {
      return;
    }
    appContext.onTick.push(pickaxeAnimate);
    return () => {
      const i = appContext.onTick.indexOf(pickaxeAnimate);
      if (i !== -1) appContext.onTick.splice(i, 1);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const minerSize = props.isPlayer ? 28 : 18;

  return (
    <Animated.View
      style={{
        alignItems: "center",
        transform: [{ translateY: bounceAnim }, { scale }],
      }}
    >
      <Text
        style={{
          fontSize: minerSize,
          lineHeight: minerSize + 4,
          userSelect: "none",
        }}
      >
        {props.isPlayer ? "👷‍♂️" : "👷"}
      </Text>
      <Animated.Image
        style={{
          alignSelf: "center",
          transform: [{ rotate: spin }],
        }}
        source={pickaxeImg}
      />
    </Animated.View>
  );
}

export default React.memo(Miner);
