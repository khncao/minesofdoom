/**
 * The answer-text rules, isolated from both input paths (the on-screen
 * NumericKeypad and the OS TextInput). These used to live inline in the
 * gesture handler, where a mistake in the decimal rules could not be
 * tested without mounting the whole game screen.
 */
import {
  MAX_ANSWER_LENGTH,
  appendAnswerKey,
  sanitizeAnswerText,
} from "../components/AnswerInput";

describe("sanitizeAnswerText", () => {
  test("keeps digits", () => {
    expect(sanitizeAnswerText("1234")).toBe("1234");
    expect(sanitizeAnswerText("")).toBe("");
  });

  test("keeps a single decimal point", () => {
    expect(sanitizeAnswerText("22.40")).toBe("22.40");
    expect(sanitizeAnswerText("0.05")).toBe("0.05");
  });

  test("drops a second decimal point and everything after it", () => {
    // Without this, "1.2.3" parses as 1.2 and the player is marked wrong
    // for text they never typed.
    expect(sanitizeAnswerText("1.2.3")).toBe("1.23");
    expect(sanitizeAnswerText("1.2.3.4")).toBe("1.234");
  });

  test("drops letters and symbols (paste, autofill, stray keypress)", () => {
    expect(sanitizeAnswerText("12a.40")).toBe("12.40");
    expect(sanitizeAnswerText("$22.40")).toBe("22.40");
    expect(sanitizeAnswerText("22,40")).toBe("2240");
    expect(sanitizeAnswerText("1e5")).toBe("15");
    expect(sanitizeAnswerText("-22.40")).toBe("22.40");
  });

  test("enforces the display cap", () => {
    expect(sanitizeAnswerText("123456789012345")).toBe(
      "123456789012".slice(0, MAX_ANSWER_LENGTH),
    );
    expect(sanitizeAnswerText("1".repeat(MAX_ANSWER_LENGTH + 5)).length).toBe(
      MAX_ANSWER_LENGTH,
    );
  });
});

describe("appendAnswerKey", () => {
  test("appends digits", () => {
    expect(appendAnswerKey("", "2")).toBe("2");
    expect(appendAnswerKey("2", "2")).toBe("22");
    expect(appendAnswerKey("22", "4")).toBe("224");
  });

  test('a leading "." becomes "0." — a bare point parses as NaN', () => {
    expect(appendAnswerKey("", ".")).toBe("0.");
    expect(appendAnswerKey("3", ".")).toBe("3.");
    expect(Number.parseFloat("0.")).toBe(0);
    expect(Number.parseFloat(".")).toBeNaN();
  });

  test("a second decimal point is refused (the text comes back unchanged)", () => {
    // Unchanged is the signal the caller shakes on — see handleKeypadDigit.
    expect(appendAnswerKey("22.4", ".")).toBe("22.4");
    expect(appendAnswerKey("0.", ".")).toBe("0.");
  });

  test("the cap refuses further keys, unchanged", () => {
    const full = "1".repeat(MAX_ANSWER_LENGTH);
    expect(appendAnswerKey(full, "5")).toBe(full);
    expect(appendAnswerKey(full, ".")).toBe(full);
  });

  test("money answers compose: 2 2 . 4 0", () => {
    let text = "";
    for (const key of ["2", "2", ".", "4", "0"]) {
      text = appendAnswerKey(text, key);
    }
    expect(text).toBe("22.40");
    expect(Number.parseFloat(text)).toBe(22.4);
  });
});