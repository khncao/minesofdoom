import { useCallback, useEffect, useRef, useState } from "react";
import {
  Equation,
  EquationSettings,
  getRandomEquation,
  approxeq,
} from "apps/utils/math/equations";
import {
  getAnswerPayoutMultiplier,
  STREAK_MODE_THRESHOLD,
  TIMED_MODE_WINDOW_MS,
} from "../game";

/**
 * Equation flow: generate, submit, score. Timed mode (plan §4.2): when
 * equationSettings.timedMode is on, every equation carries a
 * TIMED_MODE_WINDOW_MS countdown — `timeLeftMs` is exposed for the UI bar,
 * and a window that runs out goes through the SAME onIncorrect path as a
 * wrong answer (so combo resistance, the shake, and the toast all apply),
 * with the half-typed answer discarded and a fresh equation rolled.
 *
 * Streak mode (plan §4.2): `streak` counts consecutive correct answers and
 * only breaks on a wrong answer / timeout — a mine tap does NOT break it
 * (unlike the combo, this is the mode's "no wrong answers" pitch). Once
 * `streak >= STREAK_MODE_THRESHOLD` (exposed as `streakActive`), each
 * correct answer additionally pays STREAK_MODE_PAYOUT via the streak
 * branch of getAnswerPayoutMultiplier. The streak is session-scoped (like
 * the combo — it does not survive an app restart) and resets to 0 when the
 * setting is switched off.
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
  // Consecutive correct answers (streak mode, plan §4.2). Session-scoped;
  // breaks on wrong answer / timeout only — NOT on a mine tap.
  const [streak, setStreak] = useState(0);

  const timedMode = equationSettings.timedMode;
  const streakMode = equationSettings.streakMode;
  const streakActive = streakMode && streak >= STREAK_MODE_THRESHOLD;

  // Latest-value refs: the timed-mode interval and handleSubmit read the
  // fresh values from here, so BOTH can be stable across renders. Stability
  // is what lets the memoized AnswerInput skip re-rendering — with an
  // unstable onSubmit it re-rendered the (focused on native) TextInput on
  // every 1s tick and every 20Hz tap flush, which is most of the "lag
  // while tapping" cost (worst on web, where a focused input's re-render
  // steals event-loop time).
  const latestRef = useRef({
    equationSettings,
    onCorrect,
    onIncorrect,
    textInput,
    equation,
    timeLeftMs,
    streak,
    timedMode,
    streakMode,
  });
  latestRef.current = {
    equationSettings,
    onCorrect,
    onIncorrect,
    textInput,
    equation,
    timeLeftMs,
    streak,
    timedMode,
    streakMode,
  };

  // Switching streak mode off drops the (unpaid) streak so re-enabling it
  // never hands out a premium the player didn't earn in the new session.
  useEffect(() => {
    if (!streakMode) setStreak(0);
  }, [streakMode]);

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
          const { onIncorrect, streakMode, equationSettings } = latestRef.current;
          // Timeout = miss: same consequences as a wrong answer, so the
          // onIncorrect handler (combo reset + resistance, shake, toast)
          // gets exactly one call per expired window. A wrong answer also
          // breaks the streak-mode streak, so reset it on the same path.
          if (streakMode) setStreak(0);
          onIncorrect();
          setTextInput("");
          setEquation(getRandomEquation(equationSettings));
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
    // Read through latestRef so the callback identity never changes; the
    // memoized AnswerInput only re-renders when the answer text itself
    // changes (typing), not on every game tick / tap flush.
    const {
      textInput,
      equation,
      timeLeftMs,
      streak,
      timedMode,
      streakMode,
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
      // Streak as it stood BEFORE this answer: the threshold-th correct
      // answer ignites the streak, the one after it is the first to pay.
      const streakBonus = streakMode && streak >= STREAK_MODE_THRESHOLD;
      if (streakMode) setStreak(streak + 1);
      // Operator bonus (÷ ×10, − ×2) × hard-mode premium (×2 for 3-term
      // equations) × timed-mode premium (×2 for a within-window answer)
      // × streak premium (×2 while the streak is ignited) — see
      // getAnswerPayoutMultiplier. Answers are always integral &
      // non-negative by construction, so no abs/fround.
      value *= getAnswerPayoutMultiplier(
        equation,
        timedMode && timeLeftMs !== null && timeLeftMs > 0,
        streakBonus,
      );
      onCorrect(Math.max(1, value));
    } else {
      // A wrong answer breaks the streak (mine taps don't — that's the
      // mode's deal), then takes the normal wrong-answer path.
      if (streakMode) setStreak(0);
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
    timeLeftMs,
    streak,
    streakActive,
  };
}
