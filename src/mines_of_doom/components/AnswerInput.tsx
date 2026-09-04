import {
  ComponentType,
  Dispatch,
  ReactNode,
  SetStateAction,
  memo,
  useRef,
} from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from "react-native";
import { styles } from "../styles";

/**
 * The OS-keyboard path (plan §2.1, web-parity item): on native the answer
 * box sits in a KeyboardAvoidingView so the OS keyboard never covers it.
 * On web the keyboard does not shift the page layout, so there is nothing
 * to avoid — a plain View is the honest no-op (RNW's KeyboardAvoidingView
 * is a no-op too, but not depending on it keeps the intent explicit and
 * the web bundle free of that module).
 */
type AvoidingViewProps = {
  children?: ReactNode;
  style?: ViewStyle;
  behavior?: "height" | "padding";
};
const AvoidingView: ComponentType<AvoidingViewProps> =
  Platform.OS === "web"
    ? (View as unknown as ComponentType<AvoidingViewProps>)
    : (KeyboardAvoidingView as unknown as ComponentType<AvoidingViewProps>);

// Answers are small integers; 12 digits is far beyond any equation, so
// this just stops the display box from overflowing. Exported: the
// on-screen keypad (MinesOfDoom's purchase-section tab) applies the same
// cap when appending digits.
export const MAX_ANSWER_LENGTH = 12;

// memo: the parent re-renders every tick and on every tap flush; without
// this the (focused) TextInput re-rendered with it. Safe now that onSubmit
// (useEquations.handleSubmit) is a stable callback.
const AnswerInput = memo(function AnswerInput({
  value,
  setTextInput,
  onSubmit,
  shakeAnim,
  useKeypad,
}: {
  value: string;
  setTextInput: Dispatch<SetStateAction<string>>;
  onSubmit: () => void;
  shakeAnim: Animated.Value;
  /**
   * On-screen keypad mode (todo: "Reimplement custom numeric keypad"): when
   * on, no TextInput is mounted at all, so the game never depends on the OS
   * keyboard (this is also the web-parity path — there,
   * `inputMode="numeric"` is ignored). The value is then driven by the
   * NumericKeypad in MinesOfDoom's purchase-section tab view, and this
   * component renders a read-only display box instead of an input.
   * Off (default) the native keypad path is unchanged.
   */
  useKeypad: boolean;
}) {
  const textInputRef = useRef<null | TextInput>(null);

  // `behavior` is a native-only KAV prop; the web View must not receive it.
  return (
    <AvoidingView behavior={Platform.OS === "web" ? undefined : "padding"}>
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
        </View>
      </Animated.View>
    </AvoidingView>
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
});

export default AnswerInput;
