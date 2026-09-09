import { memo } from "react";
import { Text } from "react-native";
import {
  Equation,
  MultiplySymbol,
  formatEquation,
  getOpDisplay,
} from "src/utils/math/equations";
import { useT } from "src/hooks/useI18n";
import { formatNumber } from "src/utils/format";
import {
  getAnswerPayoutMultiplier,
  getEquationOpBonus,
  getPendingAnswerGain,
} from "../game";
import { styles } from "../styles";

const EquationDisplay = memo(function EquationDisplay({
  equation,
  clickPower,
  comboMultiplier,
  multiplySymbol,
}: {
  equation: Equation;
  clickPower: bigint;
  comboMultiplier: number;
  /** "asterisk" → "7 * 2" / "7 / 2", "letter" → "7 x 2" / "7 ÷ 2"
   *  (settings, iteration 11). */
  multiplySymbol: MultiplySymbol;
}) {
  const t = useT();
  // Same multiplier the engine pays (getAnswerPayoutMultiplier): operator
  // bonus (÷ ×10, ² ×4, % ×3, missing ×3, − ×2) × the hard-mode premium
  // for 3-term equations.
  const opMultiplier = getEquationOpBonus(equation);
  const hardMode = equation.op2 !== undefined;
  const payoutMultiplier = getAnswerPayoutMultiplier(equation);
  // The EXACT pending gain, answer value included (pass-15 audit finding
  // (1)): the readout used to show only the answer-independent base
  // (click power × combo × premium), understating the payout by a factor
  // of the answer; getPendingAnswerGain mirrors the engine's integer core
  // so it agrees with the floating "+N" on solve.
  const pendingGain = getPendingAnswerGain(
    equation,
    clickPower,
    comboMultiplier,
  );

  return (
    <>
      <Text style={styles.text} testID="equation-display">
        {formatEquation(equation, multiplySymbol)}?
      </Text>
      <Text testID="pending-gain" style={styles.pendingGainText}>
        {t("equation.pending", { gain: formatNumber(pendingGain) })}
        {payoutMultiplier > 1 &&
          t("equation.detail", {
            mult: payoutMultiplier,
            suffix: `${opMultiplier > 1 ? ` ${equation.missing ? "?" : getOpDisplay(equation.op, multiplySymbol)}` : ""}${hardMode ? ` ${t("equation.tagHard")}` : ""}`,
          })}
      </Text>
    </>
  );
});

export default EquationDisplay;
