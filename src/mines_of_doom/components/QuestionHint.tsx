import { memo, useCallback, useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { T as Text } from "../textScale";
import Button from "src/components/Button";
import type { TranslationKey } from "src/utils/i18n/i18n";
import {
  Equation,
  Ops,
  isHardMode,
  isMissingDivisor,
} from "src/utils/math/equations";
import { useT } from "src/hooks/useI18n";

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
 * A MODAL with the technique for the CURRENT question.
 *
 * Why a modal and not a bubble (todo: "Equation hint/tips should show up
 * as a modal"): the earlier version grew a bubble out of the equation
 * panel's layout. That made the tip share a box with the question, so a
 * long technique line re-flowed the whole plate — and the tip was
 * *ephemeral*: it self-dismissed after six seconds, which is a fine rule
 * for a bubble you read while the game keeps running and a bad one for a
 * reference the player is actively working through. As a modal the tip is
 * unambiguously ON TOP: the game behind it is dimmed and the player
 * dismisses it deliberately (backdrop, ✕, the Android back gesture).
 *
 * Controlled — the owner decides when it opens. The trigger is NOT a
 * separate "?" button beside the equation any more (todo: "Instead of '?'
 * replace with the input field with '?' placeholder text"): the answer
 * field shows a "?" while it is empty, and AnswerInput owns the press
 * target, the open state and the retire-on-new-question rule.
 *
 * The text is also exposed as that trigger's `accessibilityHint`, so the
 * content is available to a screen reader without ever opening it.
 */
const QuestionHintModal = memo(function QuestionHintModal({
  equation,
  visible,
  onClose,
}: {
  equation: Equation;
  visible: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const hint = t(getHintKey(equation));

  return (
    <Modal
      // The tip is a whole-screen interruption now, so it gets its own
      // window rather than an absolutely positioned overlay: on Android
      // that is the only way the dimmed backdrop reliably covers the game
      // (and the only way the hardware back button closes it).
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
      transparent
    >
      <View style={styles.backdrop}>
        {/* Tap anywhere outside the card closes it (the sheet idiom the
            rest of the app already uses). */}
        <Pressable
          testID="hint-backdrop"
          accessibilityRole="button"
          accessibilityLabel={t("a11y.closeHint")}
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
        <View testID="hint-modal" style={styles.card}>
          <Text style={styles.cardTitle}>{t("hint.modalTitle")}</Text>
          <Text testID="hint-modal-text" style={styles.cardText}>
            {hint}
          </Text>
          <Button
            title={t("hint.modalClose")}
            onPress={onClose}
            testId="hint-modal-close"
          />
        </View>
      </View>
    </Modal>
  );
});

/**
 * The hint BUTTON, and the modal it opens — self-contained, so a caller
 * just mounts it next to the question.
 *
 * It is a SEPARATE control rather than something the answer field does
 * (todo: "use a separate button from answer field to show hints"): the
 * field is inlined INTO the equation now and is only a caret wide when
 * empty, so making its placeholder the tap target meant aiming at a ~30px
 * box to get help, and it collided with the field's own job. Two separate
 * affordances also let the technique be opened for a question already
 * half-answered — the field's version vanished the moment a digit landed.
 *
 * It renders LAST in the equation row so the field can grow underneath it
 * without nudging the button sideways (see EquationDisplay's hintSlot).
 *
 * The text is also the button's `accessibilityHint`, so the content is
 * available to a screen reader without ever opening it.
 */
const QuestionHint = memo(function QuestionHint({
  equation,
}: {
  equation: Equation;
}) {
  const t = useT();
  const [visible, setVisible] = useState(false);
  const close = useCallback(() => setVisible(false), []);

  // A new question dismisses the open modal. Keyed on the equation object,
  // which useEquations replaces wholesale on every roll.
  useEffect(() => {
    setVisible(false);
  }, [equation]);

  return (
    <>
      <Pressable
        testID="hint-button"
        accessibilityRole="button"
        accessibilityLabel={t("hint.open")}
        accessibilityHint={t(getHintKey(equation))}
        onPress={() => setVisible(true)}
        // 24px glyph + 10px padding each way = a 44px tap target.
        hitSlop={10}
        style={({ pressed }) => [
          buttonStyles.button,
          visible ? buttonStyles.buttonActive : null,
          pressed ? buttonStyles.buttonPressed : null,
        ]}
      >
        <Text style={buttonStyles.buttonGlyph}>?</Text>
      </Pressable>
      <QuestionHintModal
        equation={equation}
        visible={visible}
        onClose={close}
      />
    </>
  );
});

export default QuestionHint;

const buttonStyles = StyleSheet.create({
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
});

const styles = StyleSheet.create({
  // Dim the whole screen so the tip reads as the only thing on it. Fixed
  // edges on the root rather than flex:1 — a Modal's content view is not
  // guaranteed to be a full-viewport flex container on every platform (the
  // same trap BottomModal documents).
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  // Width-capped so the sentence keeps a readable measure on a tablet, and
  // capped as a fraction so it still fits a 360px phone.
  card: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#303030",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 170, 68, 0.45)",
    padding: 14,
    gap: 10,
    alignItems: "center",
    elevation: 6,
  },
  cardTitle: {
    color: "#ffaa44",
    fontSize: 13,
    fontWeight: "bold",
    textAlign: "center",
    userSelect: "none",
  },
  cardText: {
    color: "#fff",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
});
