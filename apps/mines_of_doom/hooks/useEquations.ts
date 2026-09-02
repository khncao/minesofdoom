import { useCallback, useState } from "react";
import {
  Equation,
  EquationSettings,
  getRandomEquation,
  approxeq,
} from "apps/utils/math/equations";
import { getAnswerPayoutMultiplier } from "../game";

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

  const handleSubmit = useCallback(() => {
    let value = -1;
    try {
      value = Number.parseFloat(textInput);
    } catch (e) {
      // console.log(e);
    }

    if (approxeq(value, equation.answer)) {
      // Operator bonus (÷ ×10, − ×2) × hard-mode premium (×2 for 3-term
      // equations) — see getAnswerPayoutMultiplier. Answers are always
      // integral & non-negative by construction, so no abs/fround.
      value *= getAnswerPayoutMultiplier(equation);
      onCorrect(Math.max(1, value));
    } else {
      onIncorrect();
    }
    setTextInput("");
    setEquation(getRandomEquation(equationSettings));
  }, [textInput, equation, equationSettings, onCorrect, onIncorrect]);

  return { equation, textInput, setTextInput, handleSubmit };
}
