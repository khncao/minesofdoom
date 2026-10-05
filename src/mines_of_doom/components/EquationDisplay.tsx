import { memo, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { T as Text } from "../textScale";
import {
  Equation,
  MultiplySymbol,
  equationAnswerSlot,
  isHardMode,
} from "src/utils/math/equations";
import { useT } from "src/hooks/useI18n";
import { styles } from "../styles";

/**
 * The question, with the answer field rendered IN the blank it fills
 * (`answerSlot`, the AnswerInput the caller mounts here).
 *
 * The field used to sit BELOW the question in the HUD column, which meant
 * reading a line and then typing into a box a whole line lower — and a
 * standalone box has to be wide enough for the longest answer, so it was
 * the widest thing in the HUD and the plate was pushed off its own line.
 * Dropped into the blank it is the smallest thing in the HUD (a narrow
 * caret-sized box that grows with the digits) and the pair reads as the
 * one sentence it is: `7 * 2 = [__]`.
 *
 * That only works because the split follows the SHAPE: for a
 * missing-operand or balance drill the blank is the "?" between the
 * operands, so the field lands there ("7 + [__] = 12") and the redundant
 * trailing "?" those prompts used to end with simply stops being drawn.
 * See `equationAnswerSlot` (utils/math/equations.ts).
 *
 * No `accessible` on the row: the field inside it has to stay reachable to
 * a screen reader, and the runs read in order anyway ("7 plus", textbox,
 * "equals 12").
 */
const EquationDisplay = memo(function EquationDisplay({
  equation,
  multiplySymbol,
  answerSlot,
  hintSlot,
}: {
  equation: Equation;
  /** "asterisk" → "7 * 2" / "7 / 2", "letter" → "7 x 2" / "7 ÷ 2"
   *  (settings, iteration 11). */
  multiplySymbol: MultiplySymbol;
  /** The answer field, rendered where the "?" was. */
  answerSlot?: ReactNode;
  /** The "?" hint button. Rendered LAST, after everything the answer slot
   *  can grow into — so opening a hint or typing a long answer never moves
   *  the button the player is aiming at. */
  hintSlot?: ReactNode;
}) {
  const t = useT();
  // isHardMode(), not `op2 !== undefined`: the balance drill carries a
  // right-hand op2/c and is NOT hard mode (it must not show the tag).
  const hardMode = isHardMode(equation);
  const { before, after } = equationAnswerSlot(equation, multiplySymbol);

  return (
    // Translucent panel (todo: "improve visibility of ui … where
    // buttons/text are"): the equation readout sits over the cave art
    // and must stay readable on every cave theme.
    //
    // The plate was 35% black, which is fine in portrait (the equation sits
    // on the calm upper cave) but the number was hard to pick out in
    // landscape, where the readout sits lower and over busier rock and
    // debris. 62% plus a hairline border keeps the art readable through it
    // while the equation itself is now clearly legible on every theme.
    //
    // It carries NO horizontal margin and only 10x5 of padding: the answer
    // field is inlined into the row below, so the plate shrink-wraps to a
    // one-line question, and the old 14x10 (tuned back when the equation sat
    // on its own full-width row) was most of the box's size.
    <View
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.62)",
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.16)",
        paddingHorizontal: 10,
        paddingVertical: 5,
        alignItems: "center",
        // A soft lift so the plate separates from high-contrast cave art
        // instead of sitting flat against it.
        shadowColor: "#000",
        shadowOpacity: 0.45,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 4,
      }}
    >
      <View style={rowStyles.row}>
        <Text
          style={[styles.text, { fontWeight: "700", letterSpacing: 0.5 }]}
          testID="equation-display"
        >
          {before}
        </Text>
        {answerSlot}
        {/* Only the middle-blank shapes have a right-hand side left
            ("… = 12"); for the trailing-blank shapes `after` is "" and
            this renders nothing at all. */}
        {after !== "" && (
          <Text
            style={[styles.text, { fontWeight: "700", letterSpacing: 0.5 }]}
          >
            {after}
          </Text>
        )}
        {/* The hard-mode tag. It used to be its OWN line, always rendered
            (a " " otherwise) so nothing below the plate shifted when a
            hard-mode equation rolled in — but the field moved inline, so
            that line became the plate's biggest single cost: a reserved
            blank text line under almost every question, in a box that now
            shrink-wraps to one line of text. As a trailing chip in the row
            it keeps the same no-shift property (the row's height is set by
            the equation either way) and costs a few px only when it is
            actually there. The multiplier readout that used to sit on that
            line is GONE (2026-10-04) — the equation is the thing being
            worked on, and a second number under it competed with the answer
            box; the tag stays because it is a difficulty marker and the
            only signal that the equation pays a premium. */}
        <Text testID="equation-hint" style={styles.pendingGainText}>
          {hardMode ? ` ${t("equation.tagHard")}` : ""}
        </Text>
        {hintSlot}
      </View>
    </View>
  );
});

export default EquationDisplay;

/** Local so the panel's inline style stays the one place that describes
 *  the plate itself. */
const rowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    // flexShrink so a long prompt ("7 + __ = 12", or a money division) wraps
    // INSIDE the plate instead of pushing the field out of it at 360px.
    flexShrink: 1,
  },
});
