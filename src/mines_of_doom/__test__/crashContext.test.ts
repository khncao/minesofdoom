import {
  CRASH_CONTEXT_MAX_EVENTS,
  CRASH_CONTEXT_MAX_STATE_KEYS,
  appendCrashContextEvent,
  formatCrashContext,
  mergeCrashContextState,
  noteCrashEvent,
  setCrashContextState,
  snapshotCrashContext,
  type CrashContext,
  type CrashContextEvent,
} from "../crashContext";

describe("appendCrashContextEvent", () => {
  it("starts an empty trail with the new event", () => {
    expect(appendCrashContextEvent([], "app start", 0)).toEqual([
      { s: 0, label: "app start" },
    ]);
  });

  it("appends newest last", () => {
    const a: CrashContextEvent[] = [{ s: 0, label: "app start" }];
    const out = appendCrashContextEvent(a, "save loaded", 90);
    expect(out).toEqual([
      { s: 0, label: "app start" },
      { s: 90, label: "save loaded" },
    ]);
  });

  it("collapses consecutive repeats into the last entry, updating its time", () => {
    let out = appendCrashContextEvent([], "manual save", 10);
    out = appendCrashContextEvent(out, "manual save", 40);
    out = appendCrashContextEvent(out, "prestige", 50);
    out = appendCrashContextEvent(out, "manual save", 60);
    expect(out).toEqual([
      { s: 40, label: "manual save" },
      { s: 50, label: "prestige" },
      { s: 60, label: "manual save" },
    ]);
  });

  it("caps the ring, evicting the oldest", () => {
    let out: CrashContextEvent[] = [];
    for (let i = 0; i < CRASH_CONTEXT_MAX_EVENTS + 5; i++) {
      out = appendCrashContextEvent(out, `e${i}`, i);
    }
    expect(out).toHaveLength(CRASH_CONTEXT_MAX_EVENTS);
    expect(out[0].label).toBe("e5");
    expect(out[out.length - 1].label).toBe(`e${CRASH_CONTEXT_MAX_EVENTS + 4}`);
  });

  it("ignores empty and whitespace-only labels", () => {
    const a: CrashContextEvent[] = [{ s: 0, label: "keep" }];
    expect(appendCrashContextEvent(a, "   ", 5)).toEqual(a);
  });

  it("clamps negative / non-finite seconds to 0", () => {
    expect(appendCrashContextEvent([], "x", -10)[0].s).toBe(0);
    expect(appendCrashContextEvent([], "x", Number.NaN)[0].s).toBe(0);
  });

  it("truncates long labels", () => {
    const out = appendCrashContextEvent([], "x".repeat(100), 1);
    expect(out[0].label.length).toBe(40);
  });
});

describe("mergeCrashContextState", () => {
  it("merges and lets later keys win", () => {
    expect(
      mergeCrashContextState({ depth: 1 }, { depth: 9, gems: 3 }),
    ).toEqual({ depth: 9, gems: 3 });
  });

  it("keeps numbers as numbers and truncates strings", () => {
    const out = mergeCrashContextState({}, {
      prestiges: 123,
      platform: "p".repeat(200),
    });
    expect(out.prestiges).toBe(123);
    expect(out.platform).toHaveLength(60);
  });

  it("caps the key count, keeping the newest-inserted", () => {
    const partial: Record<string, number> = {};
    for (let i = 0; i < CRASH_CONTEXT_MAX_STATE_KEYS + 5; i++) {
      partial[`k${i}`] = i;
    }
    const out = mergeCrashContextState({}, partial);
    expect(Object.keys(out)).toHaveLength(CRASH_CONTEXT_MAX_STATE_KEYS);
    // oldest-inserted evicted
    expect(out.k0).toBeUndefined();
    expect(out[`k${CRASH_CONTEXT_MAX_STATE_KEYS + 4}`]).toBe(
      CRASH_CONTEXT_MAX_STATE_KEYS + 4,
    );
  });
});

describe("formatCrashContext", () => {
  it("renders nothing for null/undefined (pre-context entries)", () => {
    expect(formatCrashContext(null)).toBe("");
    expect(formatCrashContext(undefined)).toBe("");
  });

  it("renders session duration, state, and the event trail", () => {
    const ctx: CrashContext = {
      startedAt: 0,
      at: 5 * 60 * 1000 + 12000,
      state: { depth: 4, platform: "android" },
      events: [
        { s: 0, label: "app start" },
        { s: 90, label: "save loaded" },
        { s: 300, label: "prestige" },
      ],
    };
    const text = formatCrashContext(ctx);
    expect(text).toContain("session 5m 12s");
    expect(text).toContain("state: depth 4 · platform android");
    expect(text).toContain(
      "events: +0s app start → +90s save loaded → +300s prestige",
    );
  });

  it("omits empty state/event lines", () => {
    const text = formatCrashContext({
      startedAt: 0,
      at: 5000,
      state: {},
      events: [],
    });
    expect(text).toBe("session 5s");
  });
});

describe("session store", () => {
  // NOTE: the store is module-scoped and tests share it — this suite relies
  // on running in declaration order (default jest) and never resets it.

  it("is empty before anything is noted", () => {
    expect(snapshotCrashContext()).toBeNull();
  });

  it("collects events and state, then snapshots an immutable shape", () => {
    const now = Date.now();
    noteCrashEvent("app start");
    setCrashContextState({ platform: "android" });
    noteCrashEvent("save loaded");

    const snap = snapshotCrashContext(now);
    expect(snap).not.toBeNull();
    expect(snap!.startedAt).toBeLessThanOrEqual(now);
    expect(snap!.at).toBe(now);
    expect(snap!.state).toEqual({ platform: "android" });
    expect(snap!.events.map((e) => e.label)).toEqual([
      "app start",
      "save loaded",
    ]);

    // mutating the snapshot must not corrupt the live store
    snap!.events.push({ s: 999, label: "injected" });
    snap!.state.platform = "hacked";
    const next = snapshotCrashContext(now);
    expect(next!.events).toHaveLength(2);
    expect(next!.state).toEqual({ platform: "android" });
  });

  it("dedupes consecutive repeats through the store too", () => {
    noteCrashEvent("manual save");
    noteCrashEvent("manual save");
    noteCrashEvent("manual save");
    const snap = snapshotCrashContext()!;
    expect(
      snap.events.filter((e) => e.label === "manual save"),
    ).toHaveLength(1);
  });
});
