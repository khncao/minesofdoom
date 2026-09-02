import { memo } from "react";
import { Text, View } from "react-native";
import { Equation, Ops } from "src/utils/math/equations";
import { emojis } from "src/utils/graphics/emojis";
import { formatNumber } from "src/utils/format";
import {
  getAnswerPayoutMultiplier,
  STREAK_MODE_THRESHOLD,
  TIMED_MODE_WINDOW_MS,
} from "../game";
import { styles } from "../styles";

const EquationDisplay = memo(function EquationDisplay({
  equation,
  clickPower,
  comboMultiplier,
  timeLeftMs,
  streak,
}: {
  equation: Equation;
  clickPower: number;
  comboMultiplier: number;
  /** Timed mode (plan §4.2): ms left on the current equation's window.
   *  null/undefined = timed mode off, hide the bar. */
  timeLeftMs?: number | null;
  /** Streak mode (plan §4.2): consecutive correct answers, or
   *  null/undefined = streak mode off (nothing streak-related shown). */
  streak?: number | null;
}) {
  // Same multiplier the engine pays (getAnswerPayoutMultiplier): operator
  // bonus (÷ ×10, − ×2) × the hard-mode premium for 3-term equations
  // × the timed-mode premium while inside the window × the streak premium
  // while the streak is ignited.
  const opMultiplier =
    equation.op === Ops.div ? 10 : equation.op === Ops.sub ? 2 : 1;
  const hardMode = equation.op2 !== undefined;
  const timedActive = timeLeftMs !== null && timeLeftMs !== undefined;
  const streakActive = streak !== null && streak !== undefined;
  const streakIgnited =
    streakActive && streak! >= STREAK_MODE_THRESHOLD;
  const payoutMultiplier = getAnswerPayoutMultiplier(
    equation,
    timedActive,
    streakIgnited,
  );
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
      <Text style={styles.text} testID="equation-display">
        {equation.a} {equation.op} {equation.b}
        {equation.op2 !== undefined && equation.c !== undefined
          ? ` ${equation.op2} ${equation.c}`
          : null}?
      </Text>
      {streakActive && (
        // Ignited: the premium is live; not yet: progress toward ignition.
        <Text style={styles.pendingGainText}>
          🔥 streak {streakIgnited ? "×2" : `${streak!}/${STREAK_MODE_THRESHOLD}`}
        </Text>
      )}
      <Text testID="pending-gain" style={styles.pendingGainText}>
        correct: +{formatNumber(pendingGain)} {emojis.mineral}
        {payoutMultiplier > 1 &&
          ` (×${payoutMultiplier}${opMultiplier > 1 ? ` ${equation.op}` : ""}${hardMode ? " hard" : ""}${timedActive ? " timed" : ""}${streakIgnited ? " streak" : ""})`}
      </Text>
    </>
  );
});

export default EquationDisplay;
