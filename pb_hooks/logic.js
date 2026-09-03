"use strict";
/*
 * Pure (no Pocketbase) logic for the app's /api/app/* endpoints: the
 * product catalog, input validation, and the upsert/merge rules the
 * clients in src/mines_of_doom/ (cloudSave.ts, leaderboard.ts,
 * iapProvider.ts) parse. The hook files (collections.js, endpoints.js,
 * storeVerify.js) are thin wrappers around this module, so its behavior
 * is unit-tested in pb_hooks/__test__/logic.test.js without a running
 * Pocketbase.
 */

// The four canonical products: internal app id -> store id (Play SKU /
// App Store Connect product id). Keep in sync with IAP_PRODUCTS in
// src/mines_of_doom/iaps.ts — pinned by __test__/logic.test.js. The
// verify request carries the INTERNAL id; entitlements are stored and
// returned by STORE id (the client's restore allowlist keys on store
// ids). A valid receipt for a product not in this table must never
// mint an entitlement (the plan's allowlist rule).
const PRODUCTS = {
  removeAds: "remove_ads",
  packShadowPick: "pack_shadow_pickaxe",
  packOniOutfit: "pack_crimson_oni",
  packCherryTheme: "pack_cherry_indigo",
};

// Highest save version this server will store. Keep in sync with
// `saveVersion` in src/mines_of_doom/game.ts — pinned by the test. A
// push with a newer version is REJECTED, not stored: a future client
// would import its own save back through a migration path this server
// doesn't know, so dropping it is the safe answer.
const MAX_SAVE_VERSION = 10;

// Cloud-save DoS boundary (plan): a real save is ~1.5KB, the cap is
// the spam boundary, not a feature limit.
const CLOUD_BLOB_MAX_BYTES = 16 * 1024;

// Leaderboard caps (docs/store-integration-plan.md §Backend). The anti-
// cheat stance is honest-casual: monotonic upserts + sanity caps, no
// server-simulated gameplay. Anything above a cap is a corrupt save —
// the submit is dropped, not clamped.
const NAME_MAX = 16;
const DEFAULT_NAME = "Digger";
// Number formatting stops at Qi (1e30) by design (AGENTS.md gotcha);
// 1e9 meters of depth is already ~99.9999% of the way to that, so the
// cap is far beyond anything a legitimate playthrough reaches.
const BEST_DEPTH_CAP = 1e9;
const MAX_COMBO_CAP = 1e9;
const LIFETIME_MINERALS_CAP = 1e15;
const ACHIEVEMENT_ID_MAX = 64;
const ACHIEVEMENT_IDS_MAX = 1000;

// Client-clock sanity: an updatedAt past year 2100 UTC would make the
// row "newer" than any future legitimate push, wedging the last-write-
// wins rule. Treated as corrupt.
const TIMESTAMP_CAP = 4102444800000; // 2100-01-01T00:00:00Z

// Device ids are the client's persisted UUID string (iapDeviceId.ts).
// A strict charset keeps them safe to interpolate into filters AND
// keeps the rate-limit map keyed on a bounded string.
const DEVICE_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

// Per-device write budget across the whole /api/app surface (plan's
// chosen starting point; reads are unlimited).
const WRITE_LIMIT_PER_HOUR = 30;
const WRITE_WINDOW_MS = 60 * 60 * 1000;

// eslint-disable-next-line no-control-regex -- control chars in a deviceId are exactly what we reject
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

/** UTF-8 byte length of a JS string (Buffer-free so this module stays
 *  portable between the Pocketbase runtime and the jest node env). */
function utf8ByteLength(str) {
  let n = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.codePointAt(i);
    if (code > 0xffff) i++; // a surrogate pair counts as one 4-byte char
    n += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return n;
}

function validDeviceId(v) {
  return typeof v === "string" && DEVICE_ID_RE.test(v);
}

/** Strip control chars + whitespace, cap at 16, fall back to the
 *  default — the board must never show a blank or invisible name.
 *  Mirrors sanitizeDisplayName in src/mines_of_doom/leaderboard.ts. */
function sanitizeDisplayName(raw) {
  const cleaned = String(raw == null ? "" : raw)
    .replace(CONTROL_CHARS, "")
    .trim()
    .slice(0, NAME_MAX);
  return cleaned.length > 0 ? cleaned : DEFAULT_NAME;
}

function isIntIn(v, lo, hi) {
  return Number.isInteger(v) && v >= lo && v <= hi;
}

/** Non-negative integer strictly below the cap — at/above the cap is a
 *  corrupt save, so the range is exclusive. */
function isIntBelowCap(v, cap) {
  return Number.isInteger(v) && v >= 0 && v < cap;
}

function badResult(error) {
  return { ok: false, error };
}

/**
 * Validate a POST /api/app/cloud/push body. `blob` must be a JSON
 * OBJECT string (the serialized save), ≤16KB, with a saveVersion this
 * server knows and a client timestamp in a sane range.
 */
function validateCloudPush(body) {
  const b = body || {};
  if (!validDeviceId(b.deviceId)) return badResult("invalid deviceId");
  if (typeof b.blob !== "string" || b.blob.length === 0) {
    return badResult("blob must be a non-empty string");
  }
  if (utf8ByteLength(b.blob) > CLOUD_BLOB_MAX_BYTES) {
    return badResult("blob exceeds the 16KB cap");
  }
  let parsed;
  try {
    parsed = JSON.parse(b.blob);
  } catch {
    return badResult("blob is not valid JSON");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return badResult("blob must be a JSON object");
  }
  if (!isIntIn(b.saveVersion, 0, MAX_SAVE_VERSION)) {
    return badResult("saveVersion out of range");
  }
  if (
    typeof b.updatedAt !== "number" ||
    !Number.isFinite(b.updatedAt) ||
    b.updatedAt <= 0 ||
    b.updatedAt > TIMESTAMP_CAP
  ) {
    return badResult("updatedAt out of range");
  }
  return {
    ok: true,
    value: {
      deviceId: b.deviceId,
      blob: b.blob,
      saveVersion: b.saveVersion,
      updatedAt: b.updatedAt,
    },
  };
}

/**
 * Last-write-wins decision for a push (the plan's conflict rule — no
 * server-side notion of "newer save" beyond the client timestamp):
 * return the updatedAt the server will hold after this push. The caller
 * writes only when the reply differs from the stored value, and replies
 * with it so a stale client learns it lost.
 */
function cloudPushReply(storedUpdatedAt, pushedUpdatedAt) {
  if (storedUpdatedAt == null) return pushedUpdatedAt;
  return storedUpdatedAt > pushedUpdatedAt ? storedUpdatedAt : pushedUpdatedAt;
}

/**
 * Validate a POST /api/app/leaderboard/submit body. Stats must be
 * integers inside the sanity caps (above a cap = corrupt save → the
 * submit is dropped, not clamped). achievementIds are deduped string
 * ids, capped in count and per-id length.
 */
function validateLeaderboardSubmit(body) {
  const b = body || {};
  if (!validDeviceId(b.deviceId)) return badResult("invalid deviceId");
  if (!isIntBelowCap(b.bestDepth, BEST_DEPTH_CAP)) {
    return badResult("bestDepth out of range");
  }
  if (!isIntBelowCap(b.maxCombo, MAX_COMBO_CAP)) {
    return badResult("maxCombo out of range");
  }
  if (!isIntBelowCap(b.lifetimeMinerals, LIFETIME_MINERALS_CAP)) {
    return badResult("lifetimeMinerals out of range");
  }
  const rawIds = Array.isArray(b.achievementIds) ? b.achievementIds : [];
  const achievementIds = [...new Set(rawIds.filter((id) => typeof id === "string" && id.length > 0 && id.length <= ACHIEVEMENT_ID_MAX))].slice(
    0,
    ACHIEVEMENT_IDS_MAX,
  );
  return {
    ok: true,
    value: {
      deviceId: b.deviceId,
      displayName: sanitizeDisplayName(b.displayName),
      bestDepth: b.bestDepth,
      maxCombo: b.maxCombo,
      lifetimeMinerals: b.lifetimeMinerals,
      achievementIds,
    },
  };
}

/**
 * The monotonic upsert (plan §Leaderboard): per-field max, union of
 * achievement ids, display name always from the latest submit (rename
 * takes effect at the next submit). A resubmitted old save can never
 * push a row backwards; a device can't farm a fresh row by resetting.
 */
function mergeLeaderboard(existing, submitted) {
  return {
    displayName: submitted.displayName,
    bestDepth: Math.max(existing.bestDepth, submitted.bestDepth),
    maxCombo: Math.max(existing.maxCombo, submitted.maxCombo),
    lifetimeMinerals: Math.max(existing.lifetimeMinerals, submitted.lifetimeMinerals),
    achievementIds: [...new Set([...existing.achievementIds, ...submitted.achievementIds])],
  };
}

/** `achievementIds` is stored as a JSON string (a text field); parse
 *  it defensively back to an array of strings. */
function parseAchievementIds(stored) {
  if (Array.isArray(stored)) {
    return stored.filter((id) => typeof id === "string");
  }
  if (typeof stored === "string" && stored.length > 0) {
    try {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
    } catch {
      return [];
    }
  }
  return [];
}

function fieldOf(record, key) {
  if (record == null) return null;
  // A live Pocketbase record model (v0.4x) exposes record.get(key);
  // tests pass plain objects.
  if (typeof record.get === "function") return record.get(key);
  return record[key];
}

/** One top-N row in the exact shape the client parses (leaderboard.ts
 *  parseRow): rank, displayName, bestDepth, maxCombo, achievementCount. */
function shapeTopRow(record, rank) {
  return {
    rank,
    displayName: fieldOf(record, "displayName"),
    bestDepth: fieldOf(record, "bestDepth"),
    maxCombo: fieldOf(record, "maxCombo"),
    achievementCount: parseAchievementIds(fieldOf(record, "achievementIds")).length,
  };
}

/**
 * Write budget check. Pocketbase v0.4x runs every request handler in a
 * pooled, per-invocation JS runtime, so no in-memory limiter can survive
 * across requests; the authoritative counter is the `events` collection
 * (one `kind: "write"` row per accepted write, pruned after the window).
 * This pure function maps the recent-window row count to a verdict.
 */
function writeBudgetExceeded(recentCount) {
  return Number(recentCount) >= WRITE_LIMIT_PER_HOUR;
}

module.exports = {
  PRODUCTS,
  MAX_SAVE_VERSION,
  CLOUD_BLOB_MAX_BYTES,
  NAME_MAX,
  DEFAULT_NAME,
  BEST_DEPTH_CAP,
  MAX_COMBO_CAP,
  LIFETIME_MINERALS_CAP,
  TIMESTAMP_CAP,
  WRITE_LIMIT_PER_HOUR,
  WRITE_WINDOW_MS,
  utf8ByteLength,
  validDeviceId,
  sanitizeDisplayName,
  validateCloudPush,
  cloudPushReply,
  validateLeaderboardSubmit,
  mergeLeaderboard,
  parseAchievementIds,
  shapeTopRow,
  writeBudgetExceeded,
};
