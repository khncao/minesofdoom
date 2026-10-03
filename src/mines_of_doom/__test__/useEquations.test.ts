/**
 * Hook-level tests for the equation flow (useEquations): generate → submit →
 * score. The timed and streak modes were removed (todo: "Remove streak mode
 * and timed mode settings") — a wrong answer is now simply a wrong answer.
 * The payout math itself lives in game.test.ts — these tests pin the glue:
 * what the hook passes to onCorrect/onIncorrect and how its state
 * (equation, textInput) evolves.
 */
import { act, renderHook } from "@testing-library/react-native";
import { useEquations } from "../hooks/useEquations";
import * as equations from "src/utils/math/equations";
import {
  Equation,
  EquationSettings,
  defaultEquationSettings,
} from "src/utils/math/equations";

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
  it("rolls the first equation from settings and starts with an empty input", () => {
    eqQueue.push(eq(5));
    const result = renderEquationsTest(settings());
    expect(result.current.equation.answer).toBe(5);
    expect(result.current.textInput).toBe("");
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

  it("an empty submit is a no-op: no penalty, no roll, the input is left as-is (F53.1)", async () => {
    eqQueue.push(eq(5));
    const result = renderEquationsTest(settings());
    const rollsAtMount = spy.mock.calls.length; // 1 (initial equation)
    await submit(result, "");
    expect(result.onIncorrect).not.toHaveBeenCalled();
    expect(result.onCorrect).not.toHaveBeenCalled();
    expect(spy.mock.calls.length).toBe(rollsAtMount); // no roll
    expect(result.current.equation.answer).toBe(5);
    // A whitespace-only answer (OS keyboard) is equally a no-op.
    await submit(result, " ");
    expect(result.onIncorrect).not.toHaveBeenCalled();
    expect(spy.mock.calls.length).toBe(rollsAtMount);
  });
});

describe("useEquations — soft-incorrect mode (equation of the day)", () => {
  function renderSoftTest() {
    const onCorrect = jest.fn();
    const onIncorrect = jest.fn();
    const onSoftIncorrect = jest.fn();
    const soft = { current: false };
    const r = renderHook(() =>
      useEquations({
        equationSettings: settings(),
        onCorrect,
        onIncorrect,
        isSoftIncorrect: () => soft.current,
        onSoftIncorrect,
      }),
    );
    return {
      get current() {
        return r.result.current;
      },
      // submit() takes UseEquationsTest; props never change in these tests.
      rerender: () => {},
      onCorrect,
      onIncorrect,
      onSoftIncorrect,
      soft,
    };
  }

  it("showEquation force-displays an equation and clears the input", () => {
    const result = renderSoftTest();
    act(() => result.current.setTextInput("9"));
    const daily = { op: "*", a: 3, b: 4, answer: 12 } as const;
    act(() => result.current.showEquation(daily));
    expect(result.current.equation).toEqual(daily);
    expect(result.current.textInput).toBe("");
  });

  it("a wrong answer in soft mode is penalty-free: no onIncorrect, the equation stays for a retry", async () => {
    const result = renderSoftTest();
    act(() => result.current.showEquation({ op: "*", a: 3, b: 4, answer: 12 }));
    result.soft.current = true;
    await submit(result, "5");
    expect(result.onSoftIncorrect).toHaveBeenCalledTimes(1);
    expect(result.onIncorrect).not.toHaveBeenCalled();
    expect(result.onCorrect).not.toHaveBeenCalled();
    // No roll: the same equation is on screen for a retry.
    expect(result.current.equation.answer).toBe(12);
    expect(result.current.textInput).toBe("");
  });

  it("a correct answer in soft mode pays normally and rolls the next random equation", async () => {
    const result = renderSoftTest();
    act(() => result.current.showEquation({ op: "*", a: 3, b: 4, answer: 12 }));
    eqQueue.push(eq(7));
    result.soft.current = true;
    await submit(result, "12");
    // "*" carries no operator bonus: the raw answer value.
    expect(result.onCorrect).toHaveBeenCalledTimes(1);
    expect(result.onCorrect).toHaveBeenCalledWith(12);
    expect(result.onIncorrect).not.toHaveBeenCalled();
    expect(result.current.equation.answer).toBe(7);
  });

  it("without soft mode enabled, wrong answers keep the normal penalty", async () => {
    const result = renderSoftTest();
    act(() => result.current.showEquation({ op: "*", a: 3, b: 4, answer: 12 }));
    eqQueue.push(eq(9));
    // soft stays false
    await submit(result, "5");
    expect(result.onIncorrect).toHaveBeenCalledTimes(1);
    expect(result.onSoftIncorrect).not.toHaveBeenCalled();
    expect(result.current.equation.answer).toBe(9);
  });

  it("an empty submit in soft mode fires nothing and keeps the equation (F53.1)", async () => {
    const result = renderSoftTest();
    const rollsAtMount = spy.mock.calls.length; // 1 (initial equation)
    act(() => result.current.showEquation({ op: "*", a: 3, b: 4, answer: 12 }));
    result.soft.current = true;
    await submit(result, "");
    expect(result.onSoftIncorrect).not.toHaveBeenCalled();
    expect(result.onIncorrect).not.toHaveBeenCalled();
    expect(spy.mock.calls.length).toBe(rollsAtMount); // no roll
    expect(result.current.equation.answer).toBe(12);
  });
});

describe("useEquations — decimal money answers", () => {
  /** A tip: 45 at 15% = 51.75, paying ×3. */
  const tip = (): Equation => ({
    op: "tip",
    a: 45,
    b: 15,
    answer: 51.75,
  });

  it("accepts the answer in any notation and pays a whole number of minerals", async () => {
    // 51.75 × ×3 = 155.25 minerals. The paid value MUST be an integer: the
    // reward path does BigInt(value), which throws a RangeError on a
    // fraction and would crash the state updater rather than mis-pay.
    for (const typed of ["51.75", "51.750", "051.75"]) {
      // The scripted queue is only reset in beforeEach, so refill it here.
      eqQueue.length = 0;
      eqQueue.push(tip(), eq(3));
      const result = renderEquationsTest(settings());
      await submit(result, typed);
      expect(result.onCorrect).toHaveBeenCalledTimes(1);
      const paid = result.onCorrect.mock.calls[0][0] as number;
      expect(Number.isInteger(paid)).toBe(true);
      expect(paid).toBe(155); // Math.round(51.75 × 3)
      expect(result.onIncorrect).not.toHaveBeenCalled();
    }
  });

  it("still rejects an answer that is wrong by a single cent", async () => {
    // The reason the old epsilon comparator had to go: |51.76 − 51.75| is
    // 0.01, inside approxeq's tolerance, so it used to be accepted.
    eqQueue.push(tip(), eq(3));
    const result = renderEquationsTest(settings());
    await submit(result, "51.76");
    expect(result.onCorrect).not.toHaveBeenCalled();
    expect(result.onIncorrect).toHaveBeenCalledTimes(1);
  });

  it("a discount answer pays its exact premium", async () => {
    eqQueue.push(
      { op: "-%", a: 45, b: 15, answer: 38.25 },
      eq(3),
    );
    const result = renderEquationsTest(settings());
    await submit(result, "38.25");
    // 38.25 × the discount premium (×3) = 114.75 -> 115 minerals.
    expect(result.onCorrect).toHaveBeenCalledWith(115);
  });

  it("never pays less than one mineral, however small the answer", async () => {
    eqQueue.push({ op: "-%", a: 1, b: 15, answer: 0.85 }, eq(3));
    const result = renderEquationsTest(settings());
    await submit(result, "0.85");
    const paid = result.onCorrect.mock.calls[0][0] as number;
    expect(Number.isInteger(paid)).toBe(true);
    expect(paid).toBeGreaterThanOrEqual(1);
  });
});
