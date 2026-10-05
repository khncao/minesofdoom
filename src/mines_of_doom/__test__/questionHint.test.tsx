/**
 * The contextual hint for the current question.
 *
 * Two halves, tested separately because they fail for different reasons:
 *  - getHintKey is pure and decides WHICH technique a shape gets. A wrong
 *    mapping here is a silent content bug — the player taps “?” and gets
 *    the wrong advice — so every shape is pinned, including the ambiguous
 *    ones (a missing-number ÷ is the divisor drill, a balance equation
 *    carries an op2 but is not hard mode).
 *  - the BUTTON + the MODAL’s behaviour: it opens on the tap, closes from the
 *    backdrop or the button, and a new equation retires it. Those are
 *    component behaviours, so they are exercised through a render (the
 *    repo’s usual “pure logic only” rule does not cover them). The last
 *    block pins that the answer field is NOT that control any more.
 */
import { Animated } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import QuestionHint, { getHintKey } from "../components/QuestionHint";
import AnswerInput from "../components/AnswerInput";
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
 * asymmetric matcher here, and the modal's text goes through the T
 * text-scale wrapper, so read the rendered children back instead.
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
    // level; the modal's text goes through the T text-scale wrapper, so
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

describe("the hint button + modal", () => {
  test("starts closed — the tip is opt-in, never in the way", () => {
    render(<QuestionHint equation={eq()} />);
    expect(screen.queryByTestId("hint-modal")).toBeNull();
    expect(screen.getByTestId("hint-button")).toBeTruthy();
  });

  test("pressing the button opens the modal with the shape’s technique", () => {
    render(<QuestionHint equation={eq({ op: Ops.div })} />);
    fireEvent.press(screen.getByTestId("hint-button"));
    // The text is the translated technique, not the operands.
    expect(textOf("hint-modal-text")).toContain("multiplied by the divisor");
  });

  test("the close button closes it", () => {
    render(<QuestionHint equation={eq()} />);
    fireEvent.press(screen.getByTestId("hint-button"));
    expect(screen.getByTestId("hint-modal")).toBeTruthy();
    fireEvent.press(screen.getByTestId("hint-modal-close"));
    expect(screen.queryByTestId("hint-modal")).toBeNull();
  });

  test("the backdrop closes it", () => {
    render(<QuestionHint equation={eq()} />);
    fireEvent.press(screen.getByTestId("hint-button"));
    expect(screen.getByTestId("hint-modal")).toBeTruthy();
    fireEvent.press(screen.getByTestId("hint-backdrop"));
    expect(screen.queryByTestId("hint-modal")).toBeNull();
  });

  test("a new equation retires the open modal", () => {
    // The hint belongs to the question it was opened for; carrying it
    // across a roll would show advice for a question no longer on screen.
    const { rerender } = render(<QuestionHint equation={eq({ op: Ops.div })} />);
    fireEvent.press(screen.getByTestId("hint-button"));
    expect(screen.getByTestId("hint-modal")).toBeTruthy();
    rerender(<QuestionHint equation={eq({ op: Ops.tip })} />);
    expect(screen.queryByTestId("hint-modal")).toBeNull();
    // ...and it opens again for the new shape, with that shape’s hint.
    fireEvent.press(screen.getByTestId("hint-button"));
    expect(textOf("hint-modal-text")).toContain("move the point one left");
  });

  test("the hint is exposed to screen readers without opening it", () => {
    render(<QuestionHint equation={eq({ op: Ops.sq })} />);
    expect(screen.getByTestId("hint-button").props.accessibilityHint).toContain(
      "append 25",
    );
  });
});

describe("the answer field is not the hint control", () => {
  /**
   * todo: "use a separate button from answer field to show hints". The
   * "?" button beside the equation is a SEPARATE control again: as the
   * field’s placeholder it meant aiming at a ~30px box for help, and it
   * disappeared the moment a digit landed, so a half-answered question
   * could not be helped at all.
   */
  function field(value: string) {
    return (
      <AnswerInput
        value={value}
        setTextInput={jest.fn()}
        onSubmit={jest.fn()}
        shakeAnim={new Animated.Value(0)}
        useKeypad
        focusable={false}
      />
    );
  }

  test("the empty field shows a plain caret, not a ? control", () => {
    render(field(""));
    expect(textOf("answer-display")).toContain("…");
    expect(screen.queryByTestId("hint-placeholder")).toBeNull();
    expect(screen.queryByTestId("hint-button")).toBeNull();
  });

  test("a part-typed answer opens no hint affordance at all", () => {
    render(field("12"));
    expect(screen.queryByTestId("hint-placeholder")).toBeNull();
    expect(screen.queryByTestId("hint-modal")).toBeNull();
  });
});
