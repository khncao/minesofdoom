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

/** What the answer field shows while it is empty. A plain caret ellipsis,
 *  NOT a hint control: the technique modal has its own "?" button beside the
 *  equation (todo: "use a separate button from answer field to show hints"),
 *  and a "?" here as well would put two "?"s on one line meaning two
 *  different things. */
const EMPTY_PLACEHOLDER = "…";

/**
 * The field's width is CONTENT-SIZED (todo: "smaller initial answer
 * field size"): it starts at one caret and grows with the digits, because
 * it is inlined into the equation now and a fixed 150px box there is the
 * widest thing in the HUD.
 *
 * The three numbers are a budget, not a font measurement: the empty box is
 * the placeholder glyph plus the box's own padding, each digit gets a
 * slot wide enough for a numeral at the field's 16px text, and the cap
 * is MAX_ANSWER_LENGTH digits so a pasted answer can't stretch the plate
 * off a 360px screen. Because it is derived from the value rather than a
 * font metric it stays right under the app's own text scale too — the
 * wrapper <T/> scales the glyphs, and the box grows with them.
 */
const FIELD_EMPTY_WIDTH = 30;
const FIELD_CHAR_WIDTH = 11;
const FIELD_MAX_WIDTH = FIELD_EMPTY_WIDTH + MAX_ANSWER_LENGTH * FIELD_CHAR_WIDTH;

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
  // The field is sized to its CONTENT (todo: "smaller initial answer
  // field size"): it is inlined into the equation now, so a box wide
  // enough for the longest answer would be the widest thing in the HUD
  // and would push the prompt around as digits arrive. A caret-sized box
  // that grows with the digits is both smaller and steadier — and it
  // makes the question visibly fill itself in.
  //
  // MEASURED, not guessed from a font metric: a monospace assumption
  // would be wrong on every platform that is not the one it was taken
  // on (and wrong again under the app's own text scale), while the
  // digits are already known here. The result is a plain number the
  // layout can trust, capped by MAX_ANSWER_LENGTH so a pasted answer
  // cannot stretch the plate off-screen.
  const fieldWidth = Math.min(
    FIELD_MAX_WIDTH,
    FIELD_EMPTY_WIDTH + value.length * FIELD_CHAR_WIDTH,
  );

  // `behavior` is a native-only KAV prop; the web View must not receive it.
  // The AvoidingView/Animated.View wrappers are all still here because the
  // field is a FOCUSED TEXT INPUT: keyboard avoidance moves this subtree,
  // and the shake is a transform on the field itself (a wrong answer shakes
  // the box, not the equation). Neither has anything to do with the row it
  // now sits in.
  return (
    <AvoidingView behavior={Platform.OS === "web" ? undefined : "padding"}>
      <Animated.View
        style={{
          transform: [{ translateX: shakeAnim }],
        }}
      >
        {/* The field itself: the box in the equation, sized on every
            render from the value (see fieldWidth). */}
        <View style={[localStyles.fieldWrap, { width: fieldWidth }]}>
          {useKeypad ? (
            // Read-only display: the value is driven by the keypad below.
            <View
              testID="answer-display"
              style={[localStyles.displayBox, styles.textInputBox]}
            >
              <Text style={localStyles.displayText}>
                {value.length === 0 ? EMPTY_PLACEHOLDER : value}
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
                placeholderTextColor="#7d7466"
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
                  // The field is INLINED into the equation now, so it has
                  // to be one text line tall: textInputBox carries the 6px
                  // of vertical padding a standalone answer box needed, and
                  // inside the plate that is a second line of air.
                  paddingVertical: 1,
                }}
              />
          )}
        </View>
      </Animated.View>
    </AvoidingView>
  );
});

const localStyles = StyleSheet.create({
  // The field's own box. Its width is NOT here: the component sets it
  // from the value on every render, since the field is content-sized.
  fieldWrap: {
    position: "relative",
    alignSelf: "center",
  },

  // The keypad-mode read-only box. No minWidth: the wrapper owns the width
  // and the two modes must be pixel-identical, so this only has to fill it
  // and centre the digits. The vertical padding is 1 (not the 4 the
  // standalone box used) so this is one text line tall too — matching the
  // TextInput's paddingVertical: 1 above.
  displayBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  displayText: {
    color: "#fff",
    fontSize: 16,
    userSelect: "none",
  },
  // 44px tap target (plan §2.2): 18px glyph + 12px vertical padding.
});

export default AnswerInput;
