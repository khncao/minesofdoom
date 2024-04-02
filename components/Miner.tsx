import React, { MutableRefObject, useContext, useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { AppContext } from "../AppContext";
import { pickaxeImg } from "../public/assets";

export interface MinerProps {
  animateRef?: MutableRefObject<() => void>;
  scale?: number;
  reactOnTick?: boolean;
}

export default function Miner({ scale = 1, ...props }: MinerProps) {
  const appContext = useContext(AppContext);
  const pickaxeAnim = useRef(new Animated.Value(0)).current;

  const pickaxeAnimate = () => {
    pickaxeAnim.setValue(0);
    Animated.spring(pickaxeAnim, {
      toValue: 100,
      velocity: 2000,
      // bounciness: 1000,
      useNativeDriver: true,
    }).start();
  };

  const spin = pickaxeAnim.interpolate({
    inputRange: [0, 90],
    outputRange: ["0deg", "90deg"],
  });

  if (props.animateRef != null) {
    props.animateRef.current = pickaxeAnimate;
  }
  useEffect(() => {
    let idx: number | null = null;
    if (props.reactOnTick) {
      idx = appContext.onTick.push(pickaxeAnimate) - 1;
    }
    return () => {
      if (idx != null) {
        appContext.onTick.splice(idx, 1);
      }
    };
  }, []);

  return (
    <View>
      <Animated.Image
        style={{
          alignSelf: "center",
          justifyContent: "flex-end",
          transform: [{ rotate: spin }, { scale: scale }],
        }}
        source={pickaxeImg}
      />
    </View>
  );
}

const styles = StyleSheet.create({});
