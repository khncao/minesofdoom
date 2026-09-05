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
});
