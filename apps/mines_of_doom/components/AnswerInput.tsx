import { Dispatch, SetStateAction, memo, useRef } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { styles } from "../styles";
import NumericKeypad from "apps/components/NumericKeypad";

// Answers are small integers; 12 digits is far beyond any equation, so
// this just stops the display box from overflowing.
const MAX_ANSWER_LENGTH = 12;

// memo: the parent re-renders every tick and on every tap flush; without
// this the (focused) TextInput re-rendered with it. Safe now that onSubmit
// (useEquations.handleSubmit) and onToggleKeypad are stable callbacks.
const AnswerInput = memo(function AnswerInput({
  value,
  setTextInput,
  onSubmit,
  shakeAnim,
  useKeypad,
  onToggleKeypad,
}: {
  value: string;
  setTextInput: Dispatch<SetStateAction<string>>;
  onSubmit: () => void;
  shakeAnim: Animated.Value;
  /**
   * On-screen keypad mode (plan §2.1): when on, no TextInput is mounted
   * at all, so the game never depends on the OS keyboard (this is also
   * the web-parity path — there, `inputMode="numeric"` is ignored).
   */
  useKeypad: boolean;
  onToggleKeypad: () => void;
}) {
  const textInputRef = useRef<null | TextInput>(null);

  const handleDigit = (digit: string) =>
    setTextInput((old) =>
      old.length >= MAX_ANSWER_LENGTH ? old : old + digit,
    );
  const handleBackspace = () => setTextInput((old) => old.slice(0, -1));
  const handleClear = () => setTextInput("");

  return (
    <KeyboardAvoidingView behavior="padding">
      <Animated.View
        style={{
          transform: [{ translateX: shakeAnim }],
        }}
      >
        <View style={localStyles.inputRow}>
          {useKeypad ? (
            // Read-only display: the value is driven by the keypad below.
            <View style={[localStyles.displayBox, styles.textInputBox]}>
              <Text style={localStyles.displayText}>
                {value.length === 0 ? "…" : value}
              </Text>
            </View>
          ) : (
            <TextInput
              ref={textInputRef}
              value={value}
              onChangeText={(text) => setTextInput(text)}
              inputMode="numeric"
              autoFocus={true}
              clearButtonMode="always"
              onSubmitEditing={() => {
                onSubmit();
                textInputRef.current?.clear();
              }}
              selectTextOnFocus={true}
              blurOnSubmit={false}
              clearTextOnFocus={true}
              style={{
                ...styles.text,
                ...styles.textInputBox,
              }}
            />
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Toggle on-screen keypad"
            accessibilityHint="Switch between the on-screen keypad and the device keyboard"
            style={({ pressed }) => [
              localStyles.toggle,
              pressed ? localStyles.togglePressed : null,
            ]}
            onPress={onToggleKeypad}
          >
            {/* The icon shows the destination: 🔢 = switch to the
                on-screen keypad, ⌨️ = switch back to the device keyboard. */}
            <Text style={localStyles.toggleText}>
              {useKeypad ? "⌨️" : "🔢"}
            </Text>
          </Pressable>
        </View>
        {useKeypad && (
          <NumericKeypad
            onDigit={handleDigit}
            onBackspace={handleBackspace}
            onClear={handleClear}
            onSubmit={onSubmit}
          />
        )}
      </Animated.View>
    </KeyboardAvoidingView>
  );
});

const localStyles = StyleSheet.create({
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  displayBox: {
    minWidth: 150,
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  displayText: {
    color: "#fff",
    fontSize: 16,
    userSelect: "none",
  },
  // 44px tap target (plan §2.2): 18px glyph + 12px vertical padding.
  toggle: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#555",
    backgroundColor: "#3a3a3a",
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  togglePressed: {
    opacity: 0.65,
  },
  toggleText: {
    fontSize: 18,
    userSelect: "none",
  },
});

export default AnswerInput;
