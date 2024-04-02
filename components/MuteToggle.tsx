import React, { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

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
        <Text style={{ fontSize: 30 }}>🔇</Text>
      ) : (
        <Text style={{ fontSize: 30 }}>🔊</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({});
