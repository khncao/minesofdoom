import {
  ComponentType,
  Dispatch,
  ReactNode,
  SetStateAction,
  memo,
  useRef,
} from "react";
import { Animated, KeyboardAvoidingView, Platform, StyleSheet, TextInput, View, type ViewStyle } from "react-native";
import { T as Text } from "../textScale";
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
// SAFETY: both RN components satisfy AvoidingViewProps structurally (the
// prop subset here — behavior only exists natively; web ignores it) but
// their declared prop types don't overlap, so each branch needs a bridge
// cast through unknown. The union is used only with `behavior` passed on
// native and nothing passed on web (see the JSX below), which both accept.
const AvoidingView: ComponentType<AvoidingViewProps> =
  Platform.OS === "web"
    ? (View as unknown as ComponentType<AvoidingViewProps>)
    : (KeyboardAvoidingView as unknown as ComponentType<AvoidingViewProps>);

// Answers are small whole numbers, or a money amount with up to two
// decimal places ("22.40"); 12 characters is far beyond either, so this
// just stops the display box from overflowing. Exported: the on-screen
// keypad (MinesOfDoom's purchase-section tab) applies the same cap when
// appending keys.
export const MAX_ANSWER_LENGTH = 12;

/**
 * Keep only the characters a numeric answer can contain, with at most one
 * decimal point. The OS-keyboard path runs every change through this, so a
 * paste, an autofill or a stray keypress can't put "1a.2.3" into the box
 * — Number.parseFloat would silently read 1 and the player would be marked
 * wrong for text they never typed. Leading zeros are preserved ("0.50" is
 * how money is written).
 */
export function sanitizeAnswerText(text: string): string {
  const cleaned = text.replace(/[^0-9.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot === -1) return cleaned.slice(0, MAX_ANSWER_LENGTH);
  // Everything from the second dot on is junk.
  const head = cleaned.slice(0, firstDot + 1);
  const tail = cleaned.slice(firstDot + 1).replace(/\./g, "");
  return `${head}${tail}`.slice(0, MAX_ANSWER_LENGTH);
}

/**
 * Append one keypad press to the answer text.
 *
 * The "." key exists for the money drills, so it needs the two rules a
 * numeric field actually has: only one separator, and a leading "0" so a
 * bare "." is never left in the box (Number.parseFloat(".") is NaN, which
 * would read as a wrong answer). Returns the text UNCHANGED when the press
 * cannot apply — the caller compares and shakes, so the input rules stay
 * here and testable rather than inside the gesture handler.
 */
export function appendAnswerKey(current: string, key: string): string {
  if (current.length >= MAX_ANSWER_LENGTH) return current;
  if (key === ".") {
    if (current.includes(".")) return current;
    return current === "" ? "0." : `${current}.`;
  }
  return sanitizeAnswerText(`${current}${key}`);
}

// memo: the parent re-renders every tick and on every tap flush; without
// this the (focused) TextInput re-rendered with it. Safe now that onSubmit
// (useEquations.handleSubmit) is a stable callback.
const AnswerInput = memo(function AnswerInput({
  value,
  setTextInput,
  onSubmit,
  shakeAnim,
  useKeypad,
  focusable,
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
  /**
   * While the onboarding overlay is up, the input must not grab focus:
   * `autoFocus` would raise the OS keyboard BEHIND the overlay, and the
   * keyboard is a separate window that swallows every touch in its area —
   * the setup step's Start button sits inside the keyboard zone, so its
   * taps silently died (e2e v8, 2026-09-05). After dismissal the input
   * remounts focused and the keypad-off flow is unchanged.
   */
  focusable: boolean;
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
            <View
              testID="answer-display"
              style={[localStyles.displayBox, styles.textInputBox]}
            >
              <Text style={localStyles.displayText}>
                {value.length === 0 ? "…" : value}
              </Text>
            </View>
          ) : (
            <TextInput
              ref={textInputRef}
              value={value}
              onChangeText={(text) => setTextInput(sanitizeAnswerText(text))}
              // "decimal", not "numeric": iOS shows a digits-only pad for
              // "numeric", with no way to type the cents a money answer
              // needs. Android's inputType is derived from this the same way.
              inputMode="decimal"
              focusable={focusable}
              autoFocus={focusable}
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
