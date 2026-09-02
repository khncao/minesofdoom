import { useCallback, useEffect, useRef, useState } from "react";
import {
  Equation,
  EquationSettings,
  getRandomEquation,
  approxeq,
} from "apps/utils/math/equations";
import { getAnswerPayoutMultiplier, TIMED_MODE_WINDOW_MS } from "../game";

/**
 * Equation flow: generate, submit, score. Timed mode (plan §4.2): when
 * equationSettings.timedMode is on, every equation carries a
 * TIMED_MODE_WINDOW_MS countdown — `timeLeftMs` is exposed for the UI bar,
 * and a window that runs out goes through the SAME onIncorrect path as a
 * wrong answer (so combo resistance, the shake, and the toast all apply),
 * with the half-typed answer discarded and a fresh equation rolled.
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
  // null = timed mode off (or no active window); the UI hides the bar.
  const [timeLeftMs, setTimeLeftMs] = useState<number | null>(null);

  const timedMode = equationSettings.timedMode;

  // The interval callback can't see the latest closures; the refs keep the
  // expiry path fresh without re-arming the timer every render.
  const onIncorrectRef = useRef(onIncorrect);
  onIncorrectRef.current = onIncorrect;
  const equationSettingsRef = useRef(equationSettings);
  equationSettingsRef.current = equationSettings;

  useEffect(() => {
    if (!timedMode) {
      setTimeLeftMs(null);
      return;
    }
    const startedAt = Date.now();
    setTimeLeftMs(TIMED_MODE_WINDOW_MS);
    let expired = false;
    const id = setInterval(() => {
      const left = TIMED_MODE_WINDOW_MS - (Date.now() - startedAt);
      if (left <= 0) {
        if (!expired) {
          expired = true;
          clearInterval(id);
          // Timeout = miss: same consequences as a wrong answer, so the
          // onIncorrect handler (combo reset + resistance, shake, toast)
          // gets exactly one call per expired window.
          onIncorrectRef.current();
          setTextInput("");
          setEquation(getRandomEquation(equationSettingsRef.current));
        }
        setTimeLeftMs(0);
      } else {
        // 10Hz is plenty for a shrinking bar and keeps re-renders cheap
        // (only the equation block sees the changing prop).
        setTimeLeftMs(left);
      }
    }, 100);
    return () => clearInterval(id);
  }, [equation, timedMode]);

  const handleSubmit = useCallback(() => {
    let value = -1;
    try {
      value = Number.parseFloat(textInput);
    } catch (e) {
      // console.log(e);
    }

    if (approxeq(value, equation.answer)) {
      // Operator bonus (÷ ×10, − ×2) × hard-mode premium (×2 for 3-term
      // equations) × timed-mode premium (×2 for a within-window answer) —
      // see getAnswerPayoutMultiplier. Answers are always integral &
      // non-negative by construction, so no abs/fround.
      value *= getAnswerPayoutMultiplier(equation, timedMode && timeLeftMs !== null && timeLeftMs > 0);
      onCorrect(Math.max(1, value));
    } else {
      onIncorrect();
    }
    setTextInput("");
    setEquation(getRandomEquation(equationSettings));
  }, [
    textInput,
    equation,
    equationSettings,
    onCorrect,
    onIncorrect,
    timedMode,
    timeLeftMs,
  ]);

  return { equation, textInput, setTextInput, handleSubmit, timeLeftMs };
}
