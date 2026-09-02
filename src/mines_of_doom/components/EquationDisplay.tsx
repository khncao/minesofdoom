import { memo } from "react";
import { Text, View } from "react-native";
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
  multiplySymbol,
}: {
  equation: Equation;
  clickPower: bigint;
  comboMultiplier: number;
  /** "asterisk" → "7 * 2", "letter" → "7 x 2" (settings, iteration 11). */
  multiplySymbol: MultiplySymbol;
  /** Timed mode (plan §4.2): ms left on the current equation's window.
   *  null/undefined = timed mode off, hide the bar. */
  timeLeftMs?: number | null;
  /** Streak mode (plan §4.2): consecutive correct answers, or
   *  null/undefined = streak mode off (nothing streak-related shown). */
  streak?: number | null;
}) {
  const t = useT();
  // Same multiplier the engine pays (getAnswerPayoutMultiplier): operator
  // bonus (÷ ×10, ² ×4, % ×3, missing ×3, − ×2) × the hard-mode premium for
  // 3-term equations × the timed-mode premium while inside the window × the
  // streak premium while the streak is ignited.
  const opMultiplier = getEquationOpBonus(equation);
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
  const pendingGain = clickPower * BigInt(comboMultiplier) * BigInt(payoutMultiplier);
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
          accessibilityLabel={t("equation.a11yTimed", {
            seconds: Math.ceil((timeLeftMs ?? 0) / 1000),
          })}
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
        {formatEquation(equation, multiplySymbol)}?
      </Text>
      {streakActive && (
        // Ignited: the premium is live; not yet: progress toward ignition.
        <Text style={styles.pendingGainText}>
          {streakIgnited
            ? t("equation.streakIgnited")
            : t("equation.streakProgress", {
                n: streak!,
                threshold: STREAK_MODE_THRESHOLD,
              })}
        </Text>
      )}
      <Text testID="pending-gain" style={styles.pendingGainText}>
        {t("equation.pending", { gain: formatNumber(pendingGain) })}
        {payoutMultiplier > 1 &&
          t("equation.detail", {
            mult: payoutMultiplier,
            suffix: `${opMultiplier > 1 ? ` ${equation.missing ? "?" : getOpDisplay(equation.op, multiplySymbol)}` : ""}${hardMode ? ` ${t("equation.tagHard")}` : ""}${timedActive ? ` ${t("equation.tagTimed")}` : ""}${streakIgnited ? ` ${t("equation.tagStreak")}` : ""}`,
          })}
      </Text>
    </>
  );
});

export default EquationDisplay;
