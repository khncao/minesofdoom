import { memo } from "react";
import { View } from "react-native";
import { T as Text } from "../textScale";
import {
  Equation,
  MultiplySymbol,
  formatEquation,
  getOpDisplay,
} from "src/utils/math/equations";
import { useT } from "src/hooks/useI18n";
import { getEquationOpBonus, getAnswerPayoutMultiplier } from "../game";
import { styles } from "../styles";

const EquationDisplay = memo(function EquationDisplay({
  equation,
  multiplySymbol,
}: {
  equation: Equation;
  /** "asterisk" → "7 * 2" / "7 / 2", "letter" → "7 x 2" / "7 ÷ 2"
   *  (settings, iteration 11). */
  multiplySymbol: MultiplySymbol;
}) {
  const t = useT();
  // Only the ANSWER-INDEPENDENT multiplier hint is shown here. The exact
  // pending mineral amount used to be shown too, but the payout is
  // proportional to the answer (value × premium × click power × combo), so
  // the readout let a player divide the answer straight back out of it
  // (todo: "remove the predicted reward mineral amount").
  const opMultiplier = getEquationOpBonus(equation);
  const hardMode = equation.op2 !== undefined;
  const payoutMultiplier = getAnswerPayoutMultiplier(equation);

  return (
    // Translucent panel (todo: "improve visibility of ui … where
    // buttons/text are"): the equation readout sits over the cave art
    // and must stay readable on every cave theme.
    <View
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.35)",
        borderRadius: 10,
        paddingHorizontal: 16,
        paddingVertical: 6,
        alignItems: "center",
        marginHorizontal: 8,
        gap: 2,
      }}
    >
      <Text style={styles.text} testID="equation-display">
        {formatEquation(equation, multiplySymbol)}?
      </Text>
      {/* The line always renders (a space when there is no premium) so the
       * stack below it does not shift between equations. */}
      <Text testID="equation-hint" style={styles.pendingGainText}>
        {payoutMultiplier > 1
          ? t("equation.hint", {
              mult: payoutMultiplier,
              suffix: `${opMultiplier > 1 ? ` ${equation.missing ? "?" : getOpDisplay(equation.op, multiplySymbol)}` : ""}${hardMode ? ` ${t("equation.tagHard")}` : ""}`,
            })
          : " "}
      </Text>
    </View>
  );
});

export default EquationDisplay;
