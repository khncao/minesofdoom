import { useCallback, useState } from "react";
import {
  Equation,
  EquationSettings,
  getRandomEquation,
  approxeq,
  Ops,
} from "apps/utils/math/equations";

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
      // Answer-type bonus: divisions pay ×10, subtractions ×2 (answers are
      // always integral & non-negative by construction, so no abs/fround).
      if (equation.op === Ops.div) {
        value *= 10;
      }
      if (equation.op === Ops.sub) {
        value *= 2;
      }
      onCorrect(Math.max(1, value));
    } else {
      onIncorrect();
    }
    setTextInput("");
    setEquation(getRandomEquation(equationSettings));
  }, [textInput, equation, equationSettings, onCorrect, onIncorrect]);

  return { equation, textInput, setTextInput, handleSubmit };
}
