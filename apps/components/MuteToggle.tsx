import React, { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

export interface MuteToggleProps {
  init: boolean;
  onToggleChange: (newValue: boolean) => void;
}

export default function MuteToggle({ ...props }: MuteToggleProps) {
  const [toggle, setToggle] = useState(props.init);
  return (
    <Pressable
      onPress={() => {
        setToggle(!toggle);
        props.onToggleChange(!toggle);
      }}
    >
      {toggle ? (
        <Text style={styles.iconText}>🔇</Text>
      ) : (
        <Text style={styles.iconText}>🔊</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  iconText: {
    fontSize: 30,
  },
});
