/**
 * The contextual hint under the equation.
 *
 * Two halves, tested separately because they fail for different reasons:
 *  - getHintKey is pure and decides WHICH technique a shape gets. A wrong
 *    mapping here is a silent content bug — the player taps "?" and gets
 *    the wrong advice — so every shape is pinned, including the ambiguous
 *    ones (a missing-number ÷ is the divisor drill, a balance equation
 *    carries an op2 but is not hard mode).
 *  - the bubble's VISIBILITY is temporary behaviour: it self-dismisses,
 *    re-opening restarts the clock, and a new equation retires it. Those
 *    are component behaviours, so they are exercised through a render
 *    (the repo's usual "pure logic only" rule does not cover a timer).
 */
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import QuestionHint, { HINT_VISIBLE_MS, getHintKey } from "../components/QuestionHint";
import { Ops, type Equation } from "src/utils/math/equations";

const eq = (over: Partial<Equation> = {}): Equation => ({
  op: Ops.add,
  a: 7,
  b: 5,
  answer: 12,
  ...over,
});

/**
 * The text inside a node, flattened. RTL's getByText does not take an
 * asymmetric matcher here, and the bubble is a View wrapping a Text, so
 * read the rendered children back instead.
 */
function textOf(testID: string): string {
  const out: string[] = [];
  const walk = (n: unknown): void => {
    if (n === null || n === undefined || n === false) return;
    if (typeof n === "string" || typeof n === "number") {
      out.push(String(n));
      return;
    }
    if (Array.isArray(n)) {
      n.forEach(walk);
      return;
    }
    // React elements carry their children under props, not at the top
    // level; the bubble's text goes through the T text-scale wrapper, so
    // the string is one level deeper than the View.
    if (typeof n === "object" && "props" in n) {
      walk((n as { props?: { children?: unknown } }).props?.children);
    }
  };
  walk(screen.getByTestId(testID));
  return out.join(" ");
}

describe("getHintKey", () => {
  test("classic operators map to their own technique", () => {
    expect(getHintKey(eq({ op: Ops.mult }))).toBe("hint.multiply");
    expect(getHintKey(eq({ op: Ops.add }))).toBe("hint.add");
    expect(getHintKey(eq({ op: Ops.sub }))).toBe("hint.subtract");
    expect(getHintKey(eq({ op: Ops.div }))).toBe("hint.division");
    expect(getHintKey(eq({ op: Ops.pct }))).toBe("hint.percent");
    expect(getHintKey(eq({ op: Ops.sq }))).toBe("hint.square");
  });

  test("the real-world money shapes map to theirs", () => {
    expect(getHintKey(eq({ op: Ops.tip }))).toBe("hint.tip");
    expect(getHintKey(eq({ op: Ops.discount }))).toBe("hint.discount");
    expect(getHintKey(eq({ op: Ops.change }))).toBe("hint.change");
    expect(getHintKey(eq({ op: Ops.time }))).toBe("hint.time");
    expect(getHintKey(eq({ op: Ops.splitBill }))).toBe("hint.splitBill");
    expect(getHintKey(eq({ op: Ops.unitPrice }))).toBe("hint.unitPrice");
  });

  test("the sequence drill is keyed off `sequence`, not its op", () => {
    // Ops.seq would fall through to the multiply default if the flag were
    // missed, silently showing multiplication advice for a pattern puzzle.
    expect(getHintKey(eq({ op: Ops.seq, sequence: [2, 4, 8] }))).toBe("hint.sequence");
  });

  test("a missing-number ÷ is the DIVISOR drill, not plain division", () => {
    expect(getHintKey(eq({ op: Ops.div, missing: true }))).toBe(
      "hint.missingDivisor",
    );
    // ...while a forward division keeps the division technique.
    expect(getHintKey(eq({ op: Ops.div }))).toBe("hint.division");
  });

  test("a missing-number +/× is the missing-number drill", () => {
    expect(getHintKey(eq({ op: Ops.add, missing: true }))).toBe("hint.missing");
    expect(getHintKey(eq({ op: Ops.mult, missing: true }))).toBe("hint.missing");
  });

  test("a balance equation is NOT hard mode despite carrying op2", () => {
    // The shape collision this whole guard exists for: balance reuses the
    // hard-mode op2/c slots for its right-hand side.
    const balance = eq({
      op: Ops.add,
      b: 4,
      op2: Ops.add,
      c: 9,
      answer: 7,
      balance: true,
    });
    expect(getHintKey(balance)).toBe("hint.balance");
  });

  test("a real hard-mode equation gets the left-to-right hint", () => {
    expect(getHintKey(eq({ op: Ops.mult, op2: Ops.add, c: 3 }))).toBe(
      "hint.hardMode",
    );
  });

  test("every shape resolves to a real translation key", () => {
    const shapes: Equation[] = [
      eq({ op: Ops.mult }),
      eq({ op: Ops.add }),
      eq({ op: Ops.sub }),
      eq({ op: Ops.div }),
      eq({ op: Ops.pct }),
      eq({ op: Ops.sq }),
      eq({ op: Ops.mult, missing: true }),
      eq({ op: Ops.div, missing: true }),
      eq({ op: Ops.seq, sequence: [1, 2] }),
      eq({ op: Ops.add, balance: true, op2: Ops.add, c: 9 }),
      eq({ op: Ops.tip }),
      eq({ op: Ops.discount }),
      eq({ op: Ops.change }),
      eq({ op: Ops.time }),
      eq({ op: Ops.splitBill }),
      eq({ op: Ops.unitPrice }),
      eq({ op: Ops.add, op2: Ops.mult, c: 2 }),
    ];
    for (const shape of shapes) {
      expect(getHintKey(shape)).toMatch(/^hint\./);
    }
  });
});

describe("QuestionHint bubble", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  test("starts hidden — the bubble is opt-in, never in the way", () => {
    render(<QuestionHint equation={eq()} />);
    expect(screen.queryByTestId("hint-bubble")).toBeNull();
    expect(screen.getByTestId("hint-button")).toBeTruthy();
  });

  test("tapping the button opens the bubble with the shape's technique", () => {
    render(<QuestionHint equation={eq({ op: Ops.div })} />);
    fireEvent.press(screen.getByTestId("hint-button"));
    // The bubble text is the translated technique, not the operands.
    expect(textOf("hint-bubble")).toContain("multiplied by the divisor");
  });

  test("tapping again closes it", () => {
    render(<QuestionHint equation={eq()} />);
    const button = screen.getByTestId("hint-button");
    fireEvent.press(button);
    expect(screen.getByTestId("hint-bubble")).toBeTruthy();
    fireEvent.press(button);
    expect(screen.queryByTestId("hint-bubble")).toBeNull();
  });

  test("the bubble dismisses itself after the timeout", () => {
    render(<QuestionHint equation={eq()} />);
    fireEvent.press(screen.getByTestId("hint-button"));
    expect(screen.getByTestId("hint-bubble")).toBeTruthy();
    act(() => {
      jest.advanceTimersByTime(HINT_VISIBLE_MS - 1);
    });
    expect(screen.getByTestId("hint-bubble")).toBeTruthy(); // not yet
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(screen.queryByTestId("hint-bubble")).toBeNull();
  });

  test("a new equation retires the old bubble", () => {
    // The hint belongs to the question it was opened for; carrying it
    // across a roll would show advice for a question no longer on screen.
    const { rerender } = render(<QuestionHint equation={eq({ op: Ops.div })} />);
    fireEvent.press(screen.getByTestId("hint-button"));
    expect(screen.getByTestId("hint-bubble")).toBeTruthy();
    rerender(<QuestionHint equation={eq({ op: Ops.tip })} />);
    expect(screen.queryByTestId("hint-bubble")).toBeNull();
    // ...and it opens again for the new shape, with that shape's hint.
    fireEvent.press(screen.getByTestId("hint-button"));
    expect(screen.getByTestId("hint-bubble")).toBeTruthy();
  });

  test("the hint is exposed to screen readers without opening it", () => {
    render(<QuestionHint equation={eq({ op: Ops.sq })} />);
    expect(screen.getByTestId("hint-button").props.accessibilityHint).toContain(
      "append 25",
    );
  });
});