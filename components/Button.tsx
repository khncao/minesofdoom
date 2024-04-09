import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export interface ButtonProps {
  disabled?: boolean;
  onPress?: () => void;
  title?: string;
}

export default function Button({ disabled, onPress, title }: ButtonProps) {
  return (
    <Pressable disabled={disabled} onPress={onPress}>
      <View
        style={{
          ...styles.container,
          backgroundColor: disabled ? "#504e4e" : "#503121",
          justifyContent: "center",
          elevation: 5,
        }}
      >
        {title && (
          <Text
            style={{
              ...styles.text,
              ...(disabled ? styles.disabled_text : styles.text_enabled),
            }}
          >
            {title}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 5 },
  text: {
    margin: 10,
    alignSelf: "center",
    userSelect: "none",
  },
  text_enabled: {
    color: "white",
  },
  disabled_text: {
    color: "#303030",
  },
});
