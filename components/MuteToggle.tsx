import React, { useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

export interface MuteToggleProps {
  init: boolean;
  onToggleChange: (newValue: boolean) => void;
  size?: number;
  color?: string;
}

export default function MuteToggle({
  size = 30,
  color = "white",
  ...props
}: MuteToggleProps) {
  const [toggle, setToggle] = useState(props.init);
  return (
    <Pressable
      onPress={() => {
        setToggle(!toggle);
        props.onToggleChange(!toggle);
      }}
    >
      {toggle ? (
        <MaterialIcons size={size} color={color} name="volume-mute" />
      ) : (
        <MaterialIcons size={size} color={color} name="volume-up" />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({});
