import React, { useRef } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

export interface IntegerInputProps {
  defaultValue?: number;
  label?: string;
  onChangeValue: (newVal: number) => void;
}

export default function IntegerInput(props: IntegerInputProps) {
  const inputRef = useRef<TextInput | null>(null);
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        // marginTop: 4,
        gap: 4,
        // backgroundColor: "#2f2f2f",
        justifyContent: "center",
      }}
    >
      {props.label != null && (
        <Text style={{ ...styles.text, margin: 4 }}>{props.label}</Text>
      )}
      <TextInput
        ref={inputRef}
        style={{
          ...styles.text,
          borderWidth: 1,
          borderColor: "white",
          textAlign: "center",
          width: 50,
          margin: 2,
        }}
        keyboardType="numeric"
        defaultValue={props.defaultValue?.toString()}
        clearTextOnFocus={true}
        inputMode="numeric"
        onChangeText={(newValue) => {
          const intVal = Number.parseInt(newValue);
          if (!Number.isInteger(intVal)) {
            inputRef.current?.clear();
            return;
          }
          props.onChangeValue(intVal);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  text: {
    color: "white",
  },
});
