import { useCallback, useRef, useState } from "react";
import {
  Equation,
  EquationSettings,
  getRandomEquation,
  approxeq,
} from "src/utils/math/equations";
import { getAnswerPayoutMultiplier } from "../game";

/**
 * Equation flow: generate, submit, score. (The timed and streak modes that
 * used to live here were removed — see docs/todo.md "Remove streak mode
 * and timed mode settings" — a wrong answer is now simply a wrong answer:
 * the onIncorrect path resets the combo with resistance, shakes, and toasts,
 * and a fresh equation is rolled.)
 */
export function useEquations({
  equationSettings,
  onCorrect,
  onIncorrect,
  isSoftIncorrect,
  onSoftIncorrect,
}: {
  equationSettings: EquationSettings;
  onCorrect: (value: number) => void;
  onIncorrect: () => void;
  /**
   * Penalty-free wrong answers (the equation-of-the-day mode, todo
   * "daily equation"): when the returned flag is true, a wrong answer
   * does NOT call onIncorrect (no combo reset) and does NOT roll a new
   * equation — onSoftIncorrect (if given) is called instead, so the
   * caller can still shake/sound. The displayed equation stays put so
   * the player can retry.
   */
  isSoftIncorrect?: () => boolean;
  onSoftIncorrect?: () => void;
}) {
  const [equation, setEquation] = useState<Equation>(() =>
    getRandomEquation(equationSettings),
  );
  const [textInput, setTextInput] = useState("");

  // Latest-value refs: handleSubmit reads the fresh values from here, so
  // it can stay stable across renders. Stability is what lets the
  // memoized AnswerInput skip re-rendering — with an unstable onSubmit it
  // re-rendered the (focused on native) TextInput on every game tick and
  // every 20Hz tap flush, which was most of the "lag while tapping" cost
  // (worst on web, where a focused input's re-render steals event-loop
  // time).
  const latestRef = useRef({
    equationSettings,
    onCorrect,
    onIncorrect,
    isSoftIncorrect,
    onSoftIncorrect,
    textInput,
    equation,
  });
  latestRef.current = {
    equationSettings,
    onCorrect,
    onIncorrect,
    isSoftIncorrect,
    onSoftIncorrect,
    textInput,
    equation,
  };

  const handleSubmit = useCallback(() => {
    // Read through latestRef so the callback identity never changes; the
    // memoized AnswerInput only re-renders when the answer text itself
    // changes (typing), not on every game tick / tap flush.
    const {
      textInput,
      equation,
      equationSettings,
      onCorrect,
      onIncorrect,
      isSoftIncorrect,
      onSoftIncorrect,
    } = latestRef.current;

    // An empty answer is not a wrong one: Return in an empty box or the
    // keypad's "=" with nothing typed must not pay the onIncorrect price
    // (stone sound + shake + combo reset) or burn a roll (F53.1).
    if (textInput.trim() === "") return;

    let value = -1;
    try {
      value = Number.parseFloat(textInput);
    } catch (e) {
      // console.log(e);
    }

    if (approxeq(value, equation.answer)) {
      // Operator bonus (÷ ×10, ² ×4, %/missing ×3, − ×2) × hard-mode
      // premium (×2 for 3-term equations) — see getAnswerPayoutMultiplier.
      // Answers are always integral & non-negative by construction, so no
      // abs/fround.
      value *= getAnswerPayoutMultiplier(equation);
      onCorrect(Math.max(1, value));
      setTextInput("");
      setEquation(getRandomEquation(equationSettings));
      // eslint-disable-next-line react-hooks/exhaustive-deps
      return;
    }
    if (isSoftIncorrect?.()) {
      // Penalty-free mode: feedback only, the equation stays for a retry.
      onSoftIncorrect?.();
      setTextInput("");
      // eslint-disable-next-line react-hooks/exhaustive-deps
      return;
    }
    onIncorrect();
    setTextInput("");
    setEquation(getRandomEquation(equationSettings));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Force-display an equation (the equation of the day): swaps it into
   * the main display and clears any half-typed answer. The normal flow
   * resumes on the next submit (a correct answer rolls the next random
   * equation as usual).
   */
  const showEquation = useCallback((next: Equation) => {
    setEquation(next);
    setTextInput("");
  }, []);

  return {
    equation,
    textInput,
    setTextInput,
    handleSubmit,
    showEquation,
  };
}
