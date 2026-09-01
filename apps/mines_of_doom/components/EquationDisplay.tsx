import { memo } from "react";
import { Text } from "react-native";
import { Equation, Ops } from "apps/utils/math/equations";
import { emojis } from "apps/utils/graphics/emojis";
import { formatNumber } from "apps/utils/format";
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
  // Answer-type bonus (invisible multiplier for the equation's operator),
  // folded into the pending gain so the player sees the full number.
  const opMultiplier =
    equation.op === Ops.div ? 10 : equation.op === Ops.sub ? 2 : 1;
  const pendingGain = clickPower * comboMultiplier * opMultiplier;

  return (
    <>
      <Text style={styles.text}>
        {equation.a} {equation.op} {equation.b}?
      </Text>
      <Text style={styles.pendingGainText}>
        correct: +{formatNumber(pendingGain)} {emojis.mineral}
        {opMultiplier > 1 && ` (×${opMultiplier} ${equation.op})`}
      </Text>
    </>
  );
});

export default EquationDisplay;
