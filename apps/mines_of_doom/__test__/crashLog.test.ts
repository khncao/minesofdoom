import {
  CRASH_LOG_MAX_ENTRIES,
  appendCrash,
  parseCrashLog,
  serializeCrash,
  type CrashEntry,
} from "../crashLog";

const makeEntry = (
  over: Partial<CrashEntry> = {},
): CrashEntry => ({
  ts: 1000,
  name: "Error",
  message: "boom",
  stack: "Error: boom\n    at foo",
  count: 1,
  source: "render",
  ...over,
});

describe("serializeCrash", () => {
  it("flattens an Error instance", () => {
    const err = new Error("kaboom");
    err.stack = "Error: kaboom\n    at mine";
    const entry = serializeCrash(err, null, 42);
    expect(entry).toEqual({
      ts: 42,
      name: "Error",
      message: "kaboom",
      stack: "Error: kaboom\n    at mine",
      count: 1,
      source: "render",
    });
  });

  it("tags the source layer (render default, global for the ErrorUtils net)", () => {
    const err = new Error("outside react");
    expect(serializeCrash(err).source).toBe("render");
    expect(serializeCrash(err, null, 1, "global").source).toBe("global");
  });

  it("keeps a custom error name", () => {
    const err = new Error("no describe for you");
    err.name = "ReferenceError";
    err.stack = "ReferenceError: no describe for you";
    expect(serializeCrash(err).name).toBe("ReferenceError");
  });

  it("appends the component stack when provided", () => {
    const err = new Error("boom");
    err.stack = "Error: boom";
    const entry = serializeCrash(err, "\n    in View\n    in MinesOfDoom");
    expect(entry.stack).toContain("Error: boom");
    expect(entry.stack).toContain("in MinesOfDoom");
  });

  it("handles a non-Error throw", () => {
    const entry = serializeCrash("plain string thrown");
    expect(entry.name).toBe("Error");
    expect(entry.message).toBe("plain string thrown");
    expect(entry.stack).toBe("");
  });

  it("truncates long stacks", () => {
    const err = new Error("long");
    err.stack = "Error: long\n" + "    at pad".padEnd(80) + " ".repeat(5000);
    const entry = serializeCrash(err);
    expect(entry.stack.length).toBeLessThan(4500);
    expect(entry.stack.endsWith("…[truncated]")).toBe(true);
  });

  it("caps the message length", () => {
    const err = new Error("x".repeat(500));
    expect(serializeCrash(err).message.length).toBe(300);
  });
});

describe("appendCrash", () => {
  it("starts an empty ring with the new entry", () => {
    const e = makeEntry();
    expect(appendCrash(null, e)).toEqual([e]);
  });

  it("prepends new entries", () => {
    const a = makeEntry({ ts: 1 });
    const b = makeEntry({ ts: 2, message: "other" });
    expect(appendCrash([a], b)).toEqual([b, a]);
  });

  it("bumps the head's count on a repeated crash instead of duplicating", () => {
    const a = makeEntry({ ts: 1, count: 2 });
    const aAgain = makeEntry({ ts: 2 });
    expect(appendCrash([a, makeEntry({ message: "x" })], aAgain)).toEqual([
      { ...a, ts: 2, count: 3 },
      makeEntry({ message: "x" }),
    ]);
  });

  it("caps the ring at the max size, dropping the oldest", () => {
    let list: CrashEntry[] = [];
    for (let i = 0; i < CRASH_LOG_MAX_ENTRIES + 3; i++) {
      list = appendCrash(list, makeEntry({ ts: i, message: `m${i}` }));
    }
    expect(list.length).toBe(CRASH_LOG_MAX_ENTRIES);
    expect(list[0].message).toBe(`m${CRASH_LOG_MAX_ENTRIES + 2}`);
    expect(list[list.length - 1].message).toBe(`m3`);
  });
});

describe("parseCrashLog", () => {
  it("returns [] for null / bad JSON / non-array", () => {
    expect(parseCrashLog(null)).toEqual([]);
    expect(parseCrashLog("not json")).toEqual([]);
    expect(parseCrashLog(JSON.stringify({ a: 1 }))).toEqual([]);
  });

  it("round-trips a valid log, including the source layer", () => {
    const log = [
      makeEntry({ source: "global" }),
      makeEntry({ ts: 2, message: "b", source: "render" }),
    ];
    expect(parseCrashLog(JSON.stringify(log))).toEqual(log);
  });

  it("defaults a missing source to render (pre-source logs were boundary-only)", () => {
    const out = parseCrashLog(JSON.stringify([{ message: "old" }]));
    expect(out[0].source).toBe("render");
  });

  it("coerces missing fields to safe defaults", () => {
    const out = parseCrashLog(
      JSON.stringify([{ message: "only a message" }, "junk", 42]),
    );
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("Error");
    expect(out[0].count).toBe(1);
    expect(out[0].stack).toBe("");
  });

  it("clamps a bad count", () => {
    const out = parseCrashLog(
      JSON.stringify([{ message: "m", count: -5 }, { message: "n", count: 2.9 }]),
    );
    expect(out[0].count).toBe(1);
    expect(out[1].count).toBe(2);
  });

  it("caps at the ring size", () => {
    const big = Array.from({ length: 10 }, (_, i) => ({
      ts: i,
      name: "Error",
      message: `m${i}`,
      stack: "",
      count: 1,
    }));
    expect(parseCrashLog(JSON.stringify(big)).length).toBe(
      CRASH_LOG_MAX_ENTRIES,
    );
  });
});
