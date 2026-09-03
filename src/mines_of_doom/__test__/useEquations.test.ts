/**
 * Hook-level tests for the equation flow (useEquations): generate → submit →
 * score, plus the timed-mode window (countdown, ×2 premium inside the
 * window, timeout = miss through the same onIncorrect path) and streak mode
 * (ignition at the threshold, premium payout, break on miss, reset on
 * toggle-off). The payout math itself lives in game.test.ts — these tests
 * pin the glue: what the hook passes to onCorrect/onIncorrect and how its
 * state (equation, textInput, timeLeftMs, streak) evolves.
 */
import { act, renderHook } from "@testing-library/react-native";
import { useEquations } from "../hooks/useEquations";
import * as equations from "src/utils/math/equations";
import {
  Equation,
  EquationSettings,
  defaultEquationSettings,
} from "src/utils/math/equations";
import { STREAK_MODE_THRESHOLD, TIMED_MODE_WINDOW_MS } from "../game";

/** Scripted equation queue: each call to getRandomEquation shifts the next
 *  equation off the queue (a fallback equation keeps the queue finite). */
const eqQueue: Equation[] = [];
const eq = (answer: number, over: Partial<Equation> = {}): Equation => ({
  op: "+",
  a: 1,
  b: answer - 1,
  answer,
  ...over,
});
const scriptedGetRandomEquation = (): Equation => eqQueue.shift() ?? eq(3);

let spy: jest.SpyInstance;
beforeEach(() => {
  eqQueue.length = 0;
  spy = jest
    .spyOn(equations, "getRandomEquation")
    .mockImplementation(scriptedGetRandomEquation);
});
afterEach(() => {
  spy.mockRestore();
});

const settings = (over: Partial<EquationSettings> = {}): EquationSettings => ({
  ...defaultEquationSettings,
  ...over,
});

type UseEquationsTest = {
  current: ReturnType<typeof useEquations>;
  rerender: (props: EquationSettings) => void;
  onCorrect: jest.Mock;
  onIncorrect: jest.Mock;
};

function renderEquationsTest(s: EquationSettings): UseEquationsTest {
  const onCorrect = jest.fn();
  const onIncorrect = jest.fn();
  const r = renderHook(
    (props: EquationSettings) =>
      useEquations({ equationSettings: props, onCorrect, onIncorrect }),
    { initialProps: s },
  );
  return {
    get current() {
      return r.result.current;
    },
    rerender: (props: EquationSettings) => act(() => r.rerender(props)),
    onCorrect,
    onIncorrect,
  };
}

async function submit(result: UseEquationsTest, text: string) {
  await act(async () => {
    result.current.setTextInput(text);
  });
  await act(async () => {
    result.current.handleSubmit();
  });
}

describe("useEquations — basics", () => {
  it("rolls the first equation from settings and shows no timer bar", () => {
    eqQueue.push(eq(5));
    const result = renderEquationsTest(settings());
    expect(result.current.equation.answer).toBe(5);
    expect(result.current.textInput).toBe("");
    expect(result.current.timeLeftMs).toBeNull();
    expect(result.current.streak).toBe(0);
    expect(result.current.streakActive).toBe(false);
  });

  it("a correct answer pays the operator-scaled value, clears the input and rolls a new equation", async () => {
    eqQueue.push(eq(5), eq(7));
    const result = renderEquationsTest(settings());
    await submit(result, "5");
    // "+" carries no operator bonus: raw answer value.
    expect(result.onCorrect).toHaveBeenCalledTimes(1);
    expect(result.onCorrect).toHaveBeenCalledWith(5);
    expect(result.onIncorrect).not.toHaveBeenCalled();
    expect(result.current.textInput).toBe("");
    expect(result.current.equation.answer).toBe(7);
  });

  it("a wrong answer fires onIncorrect and rolls a new equation", async () => {
    eqQueue.push(eq(5), eq(7));
    const result = renderEquationsTest(settings());
    await submit(result, "6");
    expect(result.onIncorrect).toHaveBeenCalledTimes(1);
    expect(result.onCorrect).not.toHaveBeenCalled();
    expect(result.current.equation.answer).toBe(7);
  });

  it("subtraction pays its ×2 operator bonus", async () => {
    eqQueue.push(eq(5, { op: "-", a: 9, b: 4 }), eq(3));
    const result = renderEquationsTest(settings());
    await submit(result, "5");
    expect(result.onCorrect).toHaveBeenCalledWith(10);
  });

  it("missing-number equations pay the ×3 missing bonus", async () => {
    eqQueue.push(eq(6, { op: "+", a: 3, b: 9, missing: true }), eq(3));
    const result = renderEquationsTest(settings());
    await submit(result, "6");
    expect(result.onCorrect).toHaveBeenCalledWith(18);
  });

  it("hard-mode (3-term) equations pay the ×2 hard premium", async () => {
    eqQueue.push(eq(10, { op: "*", op2: "+", a: 2, b: 3, c: 4 }), eq(3));
    const result = renderEquationsTest(settings());
    await submit(result, "10");
    expect(result.onCorrect).toHaveBeenCalledWith(20);
  });

  it("division answers pay the ×10 operator bonus", async () => {
    eqQueue.push(eq(4, { op: "/", a: 12, b: 3 }), eq(3));
    const result = renderEquationsTest(settings());
    await submit(result, "4");
    expect(result.onCorrect).toHaveBeenCalledWith(40);
  });
});

describe("useEquations — streak mode", () => {
  it("counts consecutive correct answers and ignites at the threshold; the first paid answer is the one after", async () => {
    for (let i = 1; i <= STREAK_MODE_THRESHOLD + 1; i++) eqQueue.push(eq(i));
    eqQueue.push(eq(1)); // roll after the last submit
    const result = renderEquationsTest(settings({ streakMode: true }));
    // The threshold answers build the streak: all pay at the base rate.
    for (let i = 1; i <= STREAK_MODE_THRESHOLD; i++) {
      await submit(result, String(i));
    }
    expect(result.current.streak).toBe(STREAK_MODE_THRESHOLD);
    expect(result.current.streakActive).toBe(true);
    expect(result.onCorrect.mock.calls).toEqual(
      Array.from({ length: STREAK_MODE_THRESHOLD }, (_, i) => [i + 1]),
    );
    // The answer AFTER ignition is the first to pay the ×2 streak premium.
    const next = STREAK_MODE_THRESHOLD + 1;
    await submit(result, String(next));
    expect(result.onCorrect).toHaveBeenLastCalledWith(next * 2);
    expect(result.current.streak).toBe(next);
    expect(result.current.streakActive).toBe(true);
  });

  it("a wrong answer breaks the run", async () => {
    for (let i = 1; i <= STREAK_MODE_THRESHOLD; i++) eqQueue.push(eq(i));
    eqQueue.push(eq(1)); // roll after the wrong answer
    const result = renderEquationsTest(settings({ streakMode: true }));
    for (let i = 1; i <= STREAK_MODE_THRESHOLD; i++) {
      await submit(result, String(i));
    }
    expect(result.current.streakActive).toBe(true);
    await submit(result, "definitely-wrong");
    expect(result.onIncorrect).toHaveBeenCalledTimes(1);
    expect(result.current.streak).toBe(0);
    expect(result.current.streakActive).toBe(false);
  });

  it("switching streak mode off drops the (unpaid) streak", async () => {
    eqQueue.push(eq(1), eq(2), eq(3), eq(1));
    const result = renderEquationsTest(settings({ streakMode: true }));
    for (let i = 1; i <= 3; i++) await submit(result, String(i));
    expect(result.current.streak).toBe(3);
    result.rerender(settings({ streakMode: false }));
    expect(result.current.streak).toBe(0);
    expect(result.current.streakActive).toBe(false);
  });
});

describe("useEquations — timed mode", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("counts down from the window and exposes timeLeftMs", async () => {
    eqQueue.push(eq(5));
    const result = renderEquationsTest(settings({ timedMode: true }));
    expect(result.current.timeLeftMs).toBe(TIMED_MODE_WINDOW_MS);
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current.timeLeftMs).toBe(TIMED_MODE_WINDOW_MS - 1000);
  });

  it("a correct answer inside the window pays the ×2 timed premium", async () => {
    eqQueue.push(eq(5), eq(7));
    const result = renderEquationsTest(settings({ timedMode: true }));
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(result.current.timeLeftMs).toBe(TIMED_MODE_WINDOW_MS - 5000);
    await submit(result, "5");
    expect(result.onCorrect).toHaveBeenCalledWith(10);
  });

  it("an expired window counts as a miss, discards the half-typed answer and rolls a new equation", async () => {
    eqQueue.push(eq(5), eq(7));
    const result = renderEquationsTest(settings({ timedMode: true }));
    await act(async () => {
      result.current.setTextInput("half");
    });
    await act(async () => {
      jest.advanceTimersByTime(TIMED_MODE_WINDOW_MS + 100);
    });
    expect(result.onIncorrect).toHaveBeenCalledTimes(1);
    expect(result.current.textInput).toBe("");
    expect(result.current.equation.answer).toBe(7);
    // The window restarted with the fresh equation.
    expect(result.current.timeLeftMs).toBe(TIMED_MODE_WINDOW_MS);
  });

  it("the timeout fires exactly once per window (no double onIncorrect)", async () => {
    eqQueue.push(eq(5), eq(7));
    const result = renderEquationsTest(settings({ timedMode: true }));
    // Advance well past TWO full windows: the second window must not have
    // expired yet (100ms ticks only fire after its own window elapses).
    await act(async () => {
      jest.advanceTimersByTime(TIMED_MODE_WINDOW_MS + 100);
    });
    expect(result.onIncorrect).toHaveBeenCalledTimes(1);
  });

  it("a timeout breaks the streak when streak mode is on", async () => {
    for (let i = 1; i <= 3; i++) eqQueue.push(eq(i));
    eqQueue.push(eq(9)); // roll after the 3rd answer
    eqQueue.push(eq(1)); // roll after the timeout
    const result = renderEquationsTest(
      settings({ timedMode: true, streakMode: true }),
    );
    for (let i = 1; i <= 3; i++) await submit(result, String(i));
    expect(result.current.streak).toBe(3);
    await act(async () => {
      jest.advanceTimersByTime(TIMED_MODE_WINDOW_MS + 100);
    });
    expect(result.onIncorrect).toHaveBeenCalledTimes(1);
    expect(result.current.streak).toBe(0);
  });

  it("switching timed mode off clears the bar", () => {
    eqQueue.push(eq(5), eq(7));
    const result = renderEquationsTest(settings({ timedMode: true }));
    expect(result.current.timeLeftMs).not.toBeNull();
    result.rerender(settings());
    expect(result.current.timeLeftMs).toBeNull();
  });
});
