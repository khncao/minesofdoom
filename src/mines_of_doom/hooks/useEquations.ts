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
}: {
  equationSettings: EquationSettings;
  onCorrect: (value: number) => void;
  onIncorrect: () => void;
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
    textInput,
    equation,
  });
  latestRef.current = {
    equationSettings,
    onCorrect,
    onIncorrect,
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
    } = latestRef.current;

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
    } else {
      onIncorrect();
    }
    setTextInput("");
    setEquation(getRandomEquation(equationSettings));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    equation,
    textInput,
    setTextInput,
    handleSubmit,
  };
}
