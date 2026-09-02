import { memo } from "react";
import { Text } from "react-native";
import { Equation, Ops } from "apps/utils/math/equations";
import { emojis } from "apps/utils/graphics/emojis";
import { formatNumber } from "apps/utils/format";
import { getAnswerPayoutMultiplier } from "../game";
import { styles } from "../styles";

const EquationDisplay = memo(function EquationDisplay({
  equation,
  clickPower,
  comboMultiplier,
}: {
  equation: Equation;
  clickPower: number;
  comboMultiplier: number;
}) {
  // Same multiplier the engine pays (getAnswerPayoutMultiplier): operator
  // bonus (÷ ×10, − ×2) × the hard-mode premium for 3-term equations.
  const opMultiplier =
    equation.op === Ops.div ? 10 : equation.op === Ops.sub ? 2 : 1;
  const hardMode = equation.op2 !== undefined;
  const payoutMultiplier = getAnswerPayoutMultiplier(equation);
  const pendingGain = clickPower * comboMultiplier * payoutMultiplier;

  return (
    <>
      <Text style={styles.text}>
        {equation.a} {equation.op} {equation.b}
        {equation.op2 !== undefined && equation.c !== undefined
          ? ` ${equation.op2} ${equation.c}`
          : null}?
      </Text>
      <Text style={styles.pendingGainText}>
        correct: +{formatNumber(pendingGain)} {emojis.mineral}
        {payoutMultiplier > 1 &&
          ` (×${payoutMultiplier}${opMultiplier > 1 ? ` ${equation.op}` : ""}${hardMode ? " hard" : ""})`}
      </Text>
    </>
  );
});

export default EquationDisplay;
