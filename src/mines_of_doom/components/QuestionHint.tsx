import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { T as Text } from "../textScale";
import type { TranslationKey } from "src/utils/i18n/i18n";
import {
  Equation,
  Ops,
  isHardMode,
  isMissingDivisor,
} from "src/utils/math/equations";
import { useT } from "src/hooks/useI18n";

/**
 * How long the hint bubble stays up before it dismisses itself. Long
 * enough to read and act on one tip, short enough that it never sits over
 * the game while the player is tapping the cave.
 */
export const HINT_VISIBLE_MS = 6000;

/**
 * The technique shown for each equation shape.
 *
 * IMPORTANT: these are METHODS, never the current question's numbers.
 * Interpolating the operands here would hand the player the arithmetic
 * (and for several shapes the answer outright), turning a hint into a
 * solve button. If you add a shape, describe the approach — don't compute.
 *
 * The Settings ▸ tips section teaches the same techniques at leisure; this
 * is the same content one tap away from the question that needs it, which
 * is where a player actually wants it.
 */
export function getHintKey(equation: Equation): TranslationKey {
  // Hard mode is exclusive with every special shape (it only ever uses the
  // classic four ops), so it can short-circuit the whole switch.
  if (isHardMode(equation)) return "hint.hardMode";
  if (equation.sequence) return "hint.sequence";
  if (equation.balance) return "hint.balance";
  if (isMissingDivisor(equation)) return "hint.missingDivisor";
  if (equation.missing) return "hint.missing";
  switch (equation.op) {
    case Ops.tip:
      return "hint.tip";
    case Ops.discount:
      return "hint.discount";
    case Ops.change:
      return "hint.change";
    case Ops.time:
      return "hint.time";
    case Ops.splitBill:
      return "hint.splitBill";
    case Ops.unitPrice:
      return "hint.unitPrice";
    case Ops.pct:
      return "hint.percent";
    case Ops.sq:
      return "hint.square";
    case Ops.sub:
      return "hint.subtract";
    case Ops.div:
      return "hint.division";
    case Ops.add:
      return "hint.add";
    default:
      return "hint.multiply";
  }
}

/**
 * A "?" button under the equation that pops a temporary bubble with the
 * technique for the CURRENT question.
 *
 * "Temporary" is the point: it is not a toggle you leave open. The bubble
 * dismisses itself after HINT_VISIBLE_MS, and a new equation retires it
 * outright — the hint belongs to the question it was opened for, so
 * carrying it across a roll would be actively misleading.
 *
 * The text is also exposed as the button's `accessibilityHint`, so the
 * content is available to a screen reader without ever opening it.
 */
const QuestionHint = memo(function QuestionHint({
  equation,
}: {
  equation: Equation;
}) {
  const t = useT();
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  // A new question dismisses the old bubble. Keyed on the equation object,
  // which useEquations replaces wholesale on every roll.
  useEffect(() => {
    setVisible(false);
    clearTimer();
  }, [equation, clearTimer]);

  // Self-dismiss. Depends on `visible` so re-opening restarts the clock.
  useEffect(() => {
    if (!visible) return;
    timer.current = setTimeout(() => setVisible(false), HINT_VISIBLE_MS);
    return clearTimer;
  }, [visible, clearTimer]);

  // Unmount safety: a pending timer must not setState on a dead component.
  useEffect(() => clearTimer, [clearTimer]);

  const hint = t(getHintKey(equation));

  return (
    <View style={styles.wrap}>
      <Pressable
        testID="hint-button"
        accessibilityRole="button"
        accessibilityLabel={t("hint.open")}
        accessibilityHint={hint}
        onPress={() => setVisible((wasVisible) => !wasVisible)}
        // 24px glyph + 10px padding each way = a 44px tap target.
        hitSlop={10}
        style={({ pressed }) => [
          styles.button,
          visible ? styles.buttonActive : null,
          pressed ? styles.buttonPressed : null,
        ]}
      >
        <Text style={styles.buttonGlyph}>?</Text>
      </Pressable>
      {visible && (
        <View testID="hint-bubble" style={styles.bubble}>
          <Text style={styles.bubbleText}>{hint}</Text>
        </View>
      )}
    </View>
  );
});

export default QuestionHint;

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    gap: 4,
  },
  button: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 170, 68, 0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonActive: {
    backgroundColor: "rgba(255, 170, 68, 0.9)",
    borderColor: "#ffaa44",
  },
  buttonPressed: {
    opacity: 0.65,
  },
  buttonGlyph: {
    color: "#ffaa44",
    fontSize: 13,
    fontWeight: "bold",
    userSelect: "none",
  },
  // Sits UNDER the button and pushes the panel taller rather than
  // overlaying it — the panel is near the top of the screen, and the cave
  // canvas sits behind everything, so growing downward never covers
  // anything the player is tapping.
  bubble: {
    maxWidth: 280,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 170, 68, 0.45)",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  bubbleText: {
    color: "#fff",
    fontSize: 11,
    textAlign: "center",
    lineHeight: 15,
  },
});