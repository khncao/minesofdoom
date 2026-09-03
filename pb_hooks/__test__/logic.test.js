/**
 * Unit tests for the Pocketbase hook logic (pb_hooks/logic.js). These
 * run in the app's jest suite (node env, no Pocketbase needed) and pin
 * the two sync-critical constants against the app sources so the
 * server-side caps can never drift from the client.
 */
import { IAP_STORE_IDS } from "src/mines_of_doom/iaps";
import { saveVersion } from "src/mines_of_doom/game";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const L = require("../logic");

describe("pb_hooks/logic sync pins", () => {
  test("PRODUCTS matches the app's IAP_STORE_IDS catalog exactly", () => {
    expect(L.PRODUCTS).toEqual(IAP_STORE_IDS);
  });

  test("MAX_SAVE_VERSION tracks the app's saveVersion", () => {
    expect(L.MAX_SAVE_VERSION).toBe(saveVersion);
  });
});

describe("utf8ByteLength", () => {
  test("counts ascii as one byte each", () => {
    expect(L.utf8ByteLength("abc")).toBe(3);
  });

  test("counts 2/3/4-byte characters", () => {
    expect(L.utf8ByteLength("é")).toBe(2); // 2-byte
    expect(L.utf8ByteLength("€")).toBe(3); // 3-byte
    expect(L.utf8ByteLength("😀")).toBe(4); // surrogate pair, 4-byte
    expect(L.utf8ByteLength("aé€😀")).toBe(1 + 2 + 3 + 4);
  });
});

describe("validDeviceId", () => {
  test("accepts the client's UUID shape and a short id", () => {
    expect(L.validDeviceId("a1b2c3d4-e5f6-7890-abcd-ef1234567890")).toBe(true);
    expect(L.validDeviceId("abc_-16")).toBe(true);
  });

  test("rejects empty, overlong, and bad-charset ids", () => {
    expect(L.validDeviceId("")).toBe(false);
    expect(L.validDeviceId("a".repeat(65))).toBe(false);
    expect(L.validDeviceId("has space")).toBe(false);
    expect(L.validDeviceId('quote"inject')).toBe(false);
    expect(L.validDeviceId(123)).toBe(false);
  });
});

describe("sanitizeDisplayName", () => {
  test("strips control chars, trims, caps at 16", () => {
    expect(L.sanitizeDisplayName("  \u0000Digger\u0007  ")).toBe("Digger");
    expect(L.sanitizeDisplayName("a".repeat(40)).length).toBe(16);
  });

  test("falls back to the default for an empty result", () => {
    expect(L.sanitizeDisplayName("   ")).toBe(L.DEFAULT_NAME);
    expect(L.sanitizeDisplayName("")).toBe(L.DEFAULT_NAME);
    expect(L.sanitizeDisplayName(undefined)).toBe(L.DEFAULT_NAME);
  });
});

describe("validateCloudPush", () => {
  const base = {
    deviceId: "dev-1",
    blob: JSON.stringify({ saveVersion: 10, minerals: 0 }),
    saveVersion: 10,
    updatedAt: 1700000000000,
  };

  test("accepts a well-formed push", () => {
    const v = L.validateCloudPush(base);
    expect(v.ok).toBe(true);
    expect(v.value).toEqual(base);
  });

  test("rejects a non-JSON blob and a JSON-array blob", () => {
    expect(L.validateCloudPush({ ...base, blob: "{nope" }).ok).toBe(false);
    expect(L.validateCloudPush({ ...base, blob: "[1,2]" }).ok).toBe(false);
  });

  test("rejects an empty or oversized blob", () => {
    expect(L.validateCloudPush({ ...base, blob: "" }).ok).toBe(false);
    // 16KB of 'a's is 16384 bytes (allowed) — one more crosses the cap.
    const atCap = JSON.stringify({ s: "a".repeat(16300) });
    expect(L.validateCloudPush({ ...base, blob: atCap }).ok).toBe(true);
    const over = JSON.stringify({ s: "a".repeat(16380) });
    expect(L.validateCloudPush({ ...base, blob: over }).ok).toBe(false);
  });

  test("rejects saveVersion out of [0, MAX_SAVE_VERSION]", () => {
    expect(L.validateCloudPush({ ...base, saveVersion: -1 }).ok).toBe(false);
    expect(
      L.validateCloudPush({ ...base, saveVersion: L.MAX_SAVE_VERSION + 1 }).ok,
    ).toBe(false);
    expect(L.validateCloudPush({ ...base, saveVersion: "10" }).ok).toBe(false);
  });

  test("rejects implausible client timestamps", () => {
    expect(L.validateCloudPush({ ...base, updatedAt: 0 }).ok).toBe(false);
    expect(L.validateCloudPush({ ...base, updatedAt: -5 }).ok).toBe(false);
    expect(L.validateCloudPush({ ...base, updatedAt: NaN }).ok).toBe(false);
    expect(L.validateCloudPush({ ...base, updatedAt: L.TIMESTAMP_CAP + 1 }).ok).toBe(false);
    expect(L.validateCloudPush({ ...base, updatedAt: "1700000000000" }).ok).toBe(false);
  });

  test("rejects an invalid deviceId", () => {
    expect(L.validateCloudPush({ ...base, deviceId: "bad id" }).ok).toBe(false);
  });
});

describe("cloudPushReply (last-write-wins)", () => {
  test("no stored row → the pushed value wins", () => {
    expect(L.cloudPushReply(null, 100)).toBe(100);
  });

  test("stored newer → the stored value wins (the client hears it lost)", () => {
    expect(L.cloudPushReply(200, 100)).toBe(200);
  });

  test("tie or pushed newer → the pushed value wins", () => {
    expect(L.cloudPushReply(100, 100)).toBe(100);
    expect(L.cloudPushReply(50, 100)).toBe(100);
  });
});

describe("validateLeaderboardSubmit", () => {
  const base = {
    deviceId: "dev-1",
    displayName: "Digger",
    bestDepth: 1200,
    maxCombo: 25,
    lifetimeMinerals: 900000,
    achievementIds: ["diamond-hands", "first-strike"],
  };

  test("accepts a well-formed submit and sanitizes the name", () => {
    const v = L.validateLeaderboardSubmit({
      ...base,
      displayName: "  \u0007Big\u0000 Digger (truncated)" ,
    });
    expect(v.ok).toBe(true);
    expect(v.value.displayName).toBe("Big Digger (trun");
    expect(v.value.achievementIds).toEqual(["diamond-hands", "first-strike"]);
  });

  test("dedupes and drops non-string achievement ids", () => {
    const v = L.validateLeaderboardSubmit({
      ...base,
      achievementIds: ["a", "a", "b", 42, "", "x".repeat(65)],
    });
    expect(v.value.achievementIds).toEqual(["a", "b"]);
  });

  test("rejects stats at/above the sanity caps (dropped, not clamped)", () => {
    expect(L.validateLeaderboardSubmit({ ...base, bestDepth: L.BEST_DEPTH_CAP }).ok).toBe(false);
    expect(L.validateLeaderboardSubmit({ ...base, maxCombo: L.MAX_COMBO_CAP }).ok).toBe(false);
    expect(
      L.validateLeaderboardSubmit({ ...base, lifetimeMinerals: L.LIFETIME_MINERALS_CAP }).ok,
    ).toBe(false);
  });

  test("rejects negative / non-integer stats", () => {
    expect(L.validateLeaderboardSubmit({ ...base, bestDepth: -1 }).ok).toBe(false);
    expect(L.validateLeaderboardSubmit({ ...base, bestDepth: 12.5 }).ok).toBe(false);
    expect(L.validateLeaderboardSubmit({ ...base, maxCombo: "25" }).ok).toBe(false);
  });

  test("rejects an invalid deviceId", () => {
    expect(L.validateLeaderboardSubmit({ ...base, deviceId: "" }).ok).toBe(false);
  });
});

describe("mergeLeaderboard (monotonic upsert)", () => {
  const existing = {
    displayName: "Old",
    bestDepth: 100,
    maxCombo: 10,
    lifetimeMinerals: 500,
    achievementIds: ["a", "b"],
  };

  test("per-field max — an old resubmit can't push the row backwards", () => {
    const merged = L.mergeLeaderboard(existing, {
      ...existing,
      displayName: "New",
      bestDepth: 50,
      maxCombo: 10,
      lifetimeMinerals: 100,
      achievementIds: [],
    });
    expect(merged.bestDepth).toBe(100);
    expect(merged.maxCombo).toBe(10);
    expect(merged.lifetimeMinerals).toBe(500);
    expect(merged.achievementIds).toEqual(["a", "b"]);
  });

  test("newer values win; achievement ids union; name always from the submit", () => {
    const merged = L.mergeLeaderboard(existing, {
      displayName: "New",
      bestDepth: 200,
      maxCombo: 30,
      lifetimeMinerals: 900,
      achievementIds: ["b", "c"],
    });
    expect(merged.displayName).toBe("New");
    expect(merged.bestDepth).toBe(200);
    expect(merged.maxCombo).toBe(30);
    expect(merged.lifetimeMinerals).toBe(900);
    expect(merged.achievementIds).toEqual(["a", "b", "c"]);
  });
});

describe("shapeTopRow", () => {
  test("renders the client row shape and counts stored achievement ids", () => {
    const row = L.shapeTopRow(
      {
        displayName: "Digger",
        bestDepth: 42,
        maxCombo: 3,
        achievementIds: JSON.stringify(["a", "b"]),
      },
      2,
    );
    expect(row).toEqual({
      rank: 2,
      displayName: "Digger",
      bestDepth: 42,
      maxCombo: 3,
      achievementCount: 2,
    });
  });

  test("survives a corrupt stored achievementIds value", () => {
    expect(L.shapeTopRow({ achievementIds: "{nope", displayName: "d", bestDepth: 1, maxCombo: 1 }, 1).achievementCount).toBe(0);
    expect(L.shapeTopRow({ achievementIds: null, displayName: "d", bestDepth: 1, maxCombo: 1 }, 1).achievementCount).toBe(0);
  });
});

describe("writeBudgetExceeded", () => {
  test("blocks at the per-hour limit, allows below it", () => {
    for (let i = 0; i < L.WRITE_LIMIT_PER_HOUR - 1; i++) {
      expect(L.writeBudgetExceeded(i)).toBe(false);
    }
    expect(L.writeBudgetExceeded(L.WRITE_LIMIT_PER_HOUR)).toBe(true);
    expect(L.writeBudgetExceeded(L.WRITE_LIMIT_PER_HOUR + 5)).toBe(true);
  });
});
