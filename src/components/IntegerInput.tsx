import React, { useRef, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { T as Text } from "src/mines_of_doom/textScale";
export interface IntegerInputProps {
  defaultValue?: number;
  label?: string;
  /** Both set → the input runs bounded: typed values are clamped into
   *  [min, max] before they reach onChangeValue, so the effective value
   *  can never leave the dial (see EQUATION_NUMBER_LIMITS). While typing
   *  the field shows the raw digits ("1" while reaching for 12); on blur
   *  it snaps to the value that took effect (typing 999 with max 50
   *  settles on "50", not a stale "999"). Either bound omitted → legacy
   *  uncontrolled behavior (SaveTab). */
  min?: number;
  max?: number;
  onChangeValue: (newVal: number) => void;
}

export default function IntegerInput(props: IntegerInputProps) {
  const inputRef = useRef<TextInput | null>(null);
  const bounded = props.min != null && props.max != null;
  const [boundedText, setBoundedText] = useState(
    String(props.defaultValue ?? ""),
  );
  // Last clamped value emitted — the blur fallback when the field is left
  // empty (clearing it changes nothing, so the display reverts to what
  // the parent actually holds).
  const lastValueRef = useRef<number>(props.defaultValue ?? 0);

  const clamp = (n: number) =>
    Math.min(props.max as number, Math.max(props.min as number, n));

  const emit = (raw: string) => {
    const intVal = Number.parseInt(raw);
    if (!Number.isInteger(intVal)) {
      if (bounded) {
        setBoundedText("");
      } else {
        inputRef.current?.clear();
      }
      return;
    }
    const clamped = bounded ? clamp(intVal) : intVal;
    if (bounded) {
      lastValueRef.current = clamped;
      // Keep the RAW digits while typing (so "1" → "12" works even when
      // the min is 3); the state carries the clamped value.
      setBoundedText(String(intVal));
    }
    props.onChangeValue(clamped);
  };

  const onBlur = () => {
    if (!bounded) return;
    const v = Number.parseInt(boundedText);
    setBoundedText(String(Number.isInteger(v) ? clamp(v) : lastValueRef.current));
  };

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
      {bounded ? (
        <TextInput
          style={styles.box}
          keyboardType="numeric"
          value={boundedText}
          inputMode="numeric"
          onChangeText={emit}
          onBlur={onBlur}
        />
      ) : (
        <TextInput
          ref={inputRef}
          style={styles.box}
          keyboardType="numeric"
          defaultValue={props.defaultValue?.toString()}
          clearTextOnFocus={true}
          inputMode="numeric"
          onChangeText={emit}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  text: {
    color: "white",
  },
  box: {
    color: "white",
    borderWidth: 1,
    borderColor: "white",
    textAlign: "center",
    width: 50,
    margin: 2,
  },
});
