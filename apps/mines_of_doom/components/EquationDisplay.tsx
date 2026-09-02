import { memo } from "react";
import { Text, View } from "react-native";
import { Equation, Ops } from "apps/utils/math/equations";
import { emojis } from "apps/utils/graphics/emojis";
import { formatNumber } from "apps/utils/format";
import {
  getAnswerPayoutMultiplier,
  TIMED_MODE_WINDOW_MS,
} from "../game";
import { styles } from "../styles";

const EquationDisplay = memo(function EquationDisplay({
  equation,
  clickPower,
  comboMultiplier,
  timeLeftMs,
}: {
  equation: Equation;
  clickPower: number;
  comboMultiplier: number;
  /** Timed mode (plan §4.2): ms left on the current equation's window.
   *  null/undefined = timed mode off, hide the bar. */
  timeLeftMs?: number | null;
}) {
  // Same multiplier the engine pays (getAnswerPayoutMultiplier): operator
  // bonus (÷ ×10, − ×2) × the hard-mode premium for 3-term equations
  // × the timed-mode premium while inside the window.
  const opMultiplier =
    equation.op === Ops.div ? 10 : equation.op === Ops.sub ? 2 : 1;
  const hardMode = equation.op2 !== undefined;
  const timedActive = timeLeftMs !== null && timeLeftMs !== undefined;
  const payoutMultiplier = getAnswerPayoutMultiplier(equation, timedActive);
  const pendingGain = clickPower * comboMultiplier * payoutMultiplier;
  const windowFraction =
    timedActive ? Math.max(0, Math.min(1, (timeLeftMs ?? 0) / TIMED_MODE_WINDOW_MS)) : 0;
  // Green while comfortable, red in the final third — at a glance.
  const barColor = windowFraction > 0.33 ? "#4f8f4f" : "#c44";

  return (
    <>
      {timedActive && (
        // Slim shrinking bar: width fraction of the remaining window, 10Hz
        // updates from useEquations keep it smooth without per-frame renders.
        <View
          style={{
            alignSelf: "stretch",
            height: 6,
            backgroundColor: "#1a1a1a",
            borderRadius: 3,
            overflow: "hidden",
          }}
          accessibilityLabel={`Timed mode: ${Math.ceil(
            (timeLeftMs ?? 0) / 1000,
          )} seconds left`}
        >
          <View
            style={{
              width: `${windowFraction * 100}%`,
              height: "100%",
              backgroundColor: barColor,
            }}
          />
        </View>
      )}
      <Text style={styles.text}>
        {equation.a} {equation.op} {equation.b}
        {equation.op2 !== undefined && equation.c !== undefined
          ? ` ${equation.op2} ${equation.c}`
          : null}?
      </Text>
      <Text style={styles.pendingGainText}>
        correct: +{formatNumber(pendingGain)} {emojis.mineral}
        {payoutMultiplier > 1 &&
          ` (×${payoutMultiplier}${opMultiplier > 1 ? ` ${equation.op}` : ""}${hardMode ? " hard" : ""}${timedActive ? " timed" : ""})`}
      </Text>
    </>
  );
});

export default EquationDisplay;
