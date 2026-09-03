"use strict";
/*
 * Record I/O + per-endpoint handlers for the /api/app/* routes.
 *
 * IMPORTANT (Pocketbase v0.4x runtime model, see pb_hooks/README.md):
 * every hook handler (router handlers included) is executed in a pooled,
 * per-invocation JS runtime that only receives the handler's SOURCE —
 * module-level state from the hook file does NOT survive. So this file is
 * required INSIDE each handler (from endpoints.js); everything here is
 * stateless, and the write budget lives in the `events` collection, not
 * in process memory.
 *
 * Everything is SYNCHRONOUS: v0.4x handlers must be non-async (a returned
 * Promise is not awaited — it is only inspected for rejections).
 */
const logic = require(__hooks + "/logic.js");
const { verifyPurchase } = require(__hooks + "/storeVerify.js");
const { ensureCollections } = require(__hooks + "/collections.js");

function ok(json) {
  return { status: 200, json: json };
}
function badRequest(error) {
  return { status: 400, json: { error: error } };
}
function tooManyRequests() {
  return { status: 429, json: { error: "write rate limit exceeded; retry later" } };
}

function bodyOf(e) {
  const info = e.requestInfo();
  const body = info && info.body;
  return body && typeof body === "object" ? body : {};
}

/** findFirstRecordByData throws a GoError on no-row; normalize to null. */
function findDeviceRow(app, name, deviceId) {
  try {
    return app.findFirstRecordByData(name, "deviceId", deviceId) || null;
  } catch (err) {
    return null;
  }
}

function upsertDeviceRow(app, name, deviceId, data) {
  const record = findDeviceRow(app, name, deviceId);
  if (record) {
    for (const key of Object.keys(data)) record.set(key, data[key]);
    app.save(record);
    return record;
  }
  const row = Object.assign({ deviceId: deviceId }, data);
  const created = new Record(app.findCollectionByNameOrId(name), row);
  app.save(created);
  return created;
}

function listEntitlements(app, deviceId) {
  const records = app.findRecordsByFilter(
    "entitlements",
    "deviceId = {:deviceId}",
    "",
    -1,
    0,
    { deviceId: deviceId },
  );
  return (records || []).map((record) => record.get("productId"));
}

// -- write budget (durable: the `events` collection IS the counter) ---------

function recentWriteEvents(app, deviceId) {
  const sinceMs = Date.now() - logic.WRITE_WINDOW_MS;
  return app.findRecordsByFilter(
    "events",
    "deviceId = {:deviceId} && kind = {:kind} && ts >= {:since}",
    "",
    -1,
    0,
    { deviceId: deviceId, kind: "write", since: sinceMs },
  );
}

function spendWriteBudget(app, deviceId) {
  const collection = app.findCollectionByNameOrId("events");
  app.save(
    new Record(collection, {
      deviceId: deviceId,
      kind: "write",
      payload: "",
      ts: Date.now(),
    }),
  );
  // prune rows outside the window so the table can't grow unbounded
  const cutoffMs = Date.now() - logic.WRITE_WINDOW_MS;
  const stale = app.findRecordsByFilter(
    "events",
    "deviceId = {:deviceId} && ts < {:cutoff}",
    "",
    -1,
    0,
    { deviceId: deviceId, cutoff: cutoffMs },
  );
  for (const record of stale || []) app.delete(record);
}

// -- IAP --------------------------------------------------------------------

function handleVerify(app, body) {
  const deviceId = body.deviceId;
  const productId = body.productId;
  if (!logic.validDeviceId(deviceId)) return badRequest("invalid deviceId");
  if (!logic.PRODUCTS[productId]) return badRequest("unknown productId");
  const token = body.token;
  if (typeof token !== "string" || token.length < 1 || token.length > 16384) {
    return badRequest("invalid token");
  }
  if (logic.writeBudgetExceeded((recentWriteEvents(app, deviceId) || []).length)) {
    return tooManyRequests();
  }
  const verified = verifyPurchase(body.platform, productId, token);
  if (!verified) return badRequest("token verification failed");
  upsertDeviceRow(app, "entitlements", deviceId, {
    productId: logic.PRODUCTS[productId],
    platform: typeof body.platform === "string" ? body.platform.slice(0, 16) : "",
    tokenHash: globalThis.$security.sha256(token),
    verifiedAt: new Date().toISOString(),
  });
  spendWriteBudget(app, deviceId);
  return ok({ entitlements: listEntitlements(app, deviceId) });
}

function handleRestore(app, body) {
  if (!logic.validDeviceId(body.deviceId)) return badRequest("invalid deviceId");
  return ok({ entitlements: listEntitlements(app, body.deviceId) });
}

// -- cloud saves -------------------------------------------------------------

function handleCloudPush(app, body) {
  const v = logic.validateCloudPush(body);
  if (!v.ok) return badRequest(v.error);
  const deviceId = v.value.deviceId;
  if (logic.writeBudgetExceeded((recentWriteEvents(app, deviceId) || []).length)) {
    return tooManyRequests();
  }
  const record = findDeviceRow(app, "cloudSaves", deviceId);
  const storedUpdatedAt = record ? record.get("updatedAt") : null;
  const replyUpdatedAt = logic.cloudPushReply(storedUpdatedAt, v.value.updatedAt);
  // Last-write-wins: the server keeps the newer of (stored, pushed). A tie
  // rewrites the same value — harmless.
  if (replyUpdatedAt === v.value.updatedAt) {
    upsertDeviceRow(app, "cloudSaves", deviceId, {
      blob: v.value.blob,
      saveVersion: v.value.saveVersion,
      updatedAt: v.value.updatedAt,
    });
    spendWriteBudget(app, deviceId);
  }
  return ok({ updatedAt: replyUpdatedAt });
}

function handleCloudPull(app, body) {
  if (!logic.validDeviceId(body.deviceId)) return badRequest("invalid deviceId");
  const record = findDeviceRow(app, "cloudSaves", body.deviceId);
  if (!record) return ok({ snapshot: null });
  return ok({
    snapshot: {
      blob: record.get("blob"),
      saveVersion: record.get("saveVersion"),
      updatedAt: record.get("updatedAt"),
    },
  });
}

// -- leaderboard ---------------------------------------------------------------

function handleLeaderboardSubmit(app, body) {
  const v = logic.validateLeaderboardSubmit(body);
  if (!v.ok) return badRequest(v.error);
  const deviceId = v.value.deviceId;
  if (logic.writeBudgetExceeded((recentWriteEvents(app, deviceId) || []).length)) {
    return tooManyRequests();
  }
  const record = findDeviceRow(app, "leaderboard", deviceId);
  const merged = record
    ? logic.mergeLeaderboard(
        {
          displayName: record.get("displayName"),
          bestDepth: record.get("bestDepth"),
          maxCombo: record.get("maxCombo"),
          lifetimeMinerals: record.get("lifetimeMinerals"),
          achievementIds: logic.parseAchievementIds(record.get("achievementIds")),
        },
        v.value,
      )
    : v.value;
  upsertDeviceRow(app, "leaderboard", deviceId, {
    displayName: merged.displayName,
    bestDepth: merged.bestDepth,
    maxCombo: merged.maxCombo,
    lifetimeMinerals: merged.lifetimeMinerals,
    achievementIds: JSON.stringify(merged.achievementIds),
    // Server clock, used only for tie-breaking the top-N sort.
    updatedAt: Date.now(),
  });
  spendWriteBudget(app, deviceId);
  return ok({ ok: true });
}

function handleLeaderboardTop(app, body) {
  const limit = Number.isInteger(body.limit) ? Math.min(Math.max(body.limit, 1), 50) : 10;
  // deviceId is the unique-per-row tiebreak (v0.4x exposes no created field)
  const records = app.findRecordsByFilter("leaderboard", "", "-bestDepth,deviceId", limit, 0);
  return ok({ rows: (records || []).map((record, i) => logic.shapeTopRow(record, i + 1)) });
}

function handleLeaderboardRank(app, body) {
  if (!logic.validDeviceId(body.deviceId)) return badRequest("invalid deviceId");
  const record = findDeviceRow(app, "leaderboard", body.deviceId);
  if (!record) return ok({ entry: null });
  const above = app.findRecordsByFilter(
    "leaderboard",
    "bestDepth > {:depth}",
    "",
    -1,
    0,
    { depth: record.get("bestDepth") },
  );
  return ok({ entry: { rank: (above || []).length + 1, bestDepth: record.get("bestDepth") } });
}

// -- GDPR -------------------------------------------------------------------

function handleDelete(app, body) {
  if (!logic.validDeviceId(body.deviceId)) return badRequest("invalid deviceId");
  // cloudSaves + leaderboard rows go; `events` rows are pruned by the write
  // budget; `entitlements` intentionally SURVIVE (a refund/restore must
  // remain possible — see the endpoints.js header).
  for (const name of ["cloudSaves", "leaderboard"]) {
    const record = findDeviceRow(app, name, body.deviceId);
    if (record) app.delete(record);
  }
  const events = app.findRecordsByFilter(
    "events",
    "deviceId = {:deviceId}",
    "",
    -1,
    0,
    { deviceId: body.deviceId },
  );
  for (const record of events || []) app.delete(record);
  return ok({ ok: true });
}

// -- router plumbing ---------------------------------------------------------

const handlers = {
  verify: handleVerify,
  restore: handleRestore,
  "cloud/push": handleCloudPush,
  "cloud/pull": handleCloudPull,
  "leaderboard/submit": handleLeaderboardSubmit,
  "leaderboard/top": handleLeaderboardTop,
  "leaderboard/rank": handleLeaderboardRank,
  delete: handleDelete,
};

/**
 * Runs a handler with its own try/catch so a Go-level failure (e.g. a
 * collection missing) surfaces as a clean 500 instead of a broken
 * response. Sync only — see the file header.
 */
function run(e, path, handlerName) {
  try {
    // Lazy first-request setup: onBootstrap cannot touch the datastore
    // (no DB transaction is open yet — ModelQuery nil-derefs), so the
    // collections are created on the first call that reaches them. The
    // check is four index lookups; at this scale that is negligible.
    ensureCollections(globalThis.$app);
    const result = handlers[handlerName](globalThis.$app, bodyOf(e));
    e.json(result.status, result.json);
  } catch (err) {
    console.error("[pb_hooks] " + path + " failed: " + err);
    try {
      e.json(500, { error: "internal error" });
    } catch (_) {
      /* response may already be closed; nothing else to do */
    }
  }
}

module.exports = { handlers: handlers, run: run };
