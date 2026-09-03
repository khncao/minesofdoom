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
const { verifyIdentity } = require(__hooks + "/identityVerify.js");
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

function listAccountEntitlements(app, accountId) {
  const records = app.findRecordsByFilter(
    "entitlements",
    "accountId = {:accountId}",
    "",
    -1,
    0,
    { accountId: accountId },
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
  // Optional login: a live session tags the minted row so ANY of the
  // account's devices can restore it (cross-device restore).
  const session = sessionOfToken(app, body.sessionToken);
  if (logic.writeBudgetExceeded((recentWriteEvents(app, deviceId) || []).length)) {
    return tooManyRequests();
  }
  const verified = verifyPurchase(body.platform, productId, token);
  if (!verified) return badRequest("token verification failed");
  const row = {
    productId: logic.PRODUCTS[productId],
    platform: typeof body.platform === "string" ? body.platform.slice(0, 16) : "",
    tokenHash: globalThis.$security.sha256(token),
    verifiedAt: new Date().toISOString(),
  };
  if (session) row.accountId = session.account.get("id");
  upsertDeviceRow(app, "entitlements", deviceId, row);
  spendWriteBudget(app, deviceId);
  const entitlements = session
    ? logic.unionEntitlements([listEntitlements(app, deviceId), listAccountEntitlements(app, session.account.get("id"))])
    : listEntitlements(app, deviceId);
  return ok({ entitlements: entitlements });
}

function handleRestore(app, body) {
  if (!logic.validDeviceId(body.deviceId)) return badRequest("invalid deviceId");
  // Anonymous default: the device's own rows. Signed in: the union with
  // every row the account has linked (a fresh device recovers purchases
  // made on the old one — the cross-device restore the login scope adds).
  const session = sessionOfToken(app, body.sessionToken);
  const entitlements = session
    ? logic.unionEntitlements([
        listEntitlements(app, body.deviceId),
        listAccountEntitlements(app, session.account.get("id")),
      ])
    : listEntitlements(app, body.deviceId);
  return ok({ entitlements: entitlements });
}

// -- cloud saves -------------------------------------------------------------

function handleCloudPush(app, body) {
  const v = logic.validateCloudPush(body);
  if (!v.ok) return badRequest(v.error);
  const deviceId = v.value.deviceId;
  const session = sessionOfToken(app, body.sessionToken);
  if (logic.writeBudgetExceeded((recentWriteEvents(app, deviceId) || []).length)) {
    return tooManyRequests();
  }
  const record = findDeviceRow(app, "cloudSaves", deviceId);
  const storedUpdatedAt = record ? record.get("updatedAt") : null;
  const replyUpdatedAt = logic.cloudPushReply(storedUpdatedAt, v.value.updatedAt);
  // Last-write-wins: the server keeps the newer of (stored, pushed). A tie
  // rewrites the same value — harmless.
  if (replyUpdatedAt === v.value.updatedAt) {
    const row = {
      blob: v.value.blob,
      saveVersion: v.value.saveVersion,
      updatedAt: v.value.updatedAt,
    };
    if (session) row.accountId = session.account.get("id");
    upsertDeviceRow(app, "cloudSaves", deviceId, row);
    spendWriteBudget(app, deviceId);
  }
  return ok({ updatedAt: replyUpdatedAt });
}

function cloudSnapshotOf(record) {
  return {
    blob: record.get("blob"),
    saveVersion: record.get("saveVersion"),
    updatedAt: Number(record.get("updatedAt")),
  };
}

function handleCloudPull(app, body) {
  if (!logic.validDeviceId(body.deviceId)) return badRequest("invalid deviceId");
  // The device's own row first (a tie keeps it — a stale copy from a
  // sibling device never shadows the local one), then every row linked
  // to the signed-in account. Newest updatedAt wins.
  const rows = [];
  const record = findDeviceRow(app, "cloudSaves", body.deviceId);
  if (record) rows.push(cloudSnapshotOf(record));
  const session = sessionOfToken(app, body.sessionToken);
  if (session) {
    const accountRows = app.findRecordsByFilter(
      "cloudSaves",
      "accountId = {:accountId}",
      "",
      -1,
      0,
      { accountId: session.account.get("id") },
    );
    for (const row of accountRows || []) rows.push(cloudSnapshotOf(row));
  }
  const best = logic.newestByUpdatedAt(rows);
  return ok({ snapshot: best === null ? null : best });
}

// -- leaderboard ---------------------------------------------------------------

function handleLeaderboardSubmit(app, body) {
  const v = logic.validateLeaderboardSubmit(body);
  if (!v.ok) return badRequest(v.error);
  const deviceId = v.value.deviceId;
  const session = sessionOfToken(app, body.sessionToken);
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
  const row = {
    displayName: merged.displayName,
    bestDepth: merged.bestDepth,
    maxCombo: merged.maxCombo,
    lifetimeMinerals: merged.lifetimeMinerals,
    achievementIds: JSON.stringify(merged.achievementIds),
    // Server clock, used only for tie-breaking the top-N sort.
    updatedAt: Date.now(),
  };
  if (session) row.accountId = session.account.get("id");
  upsertDeviceRow(app, "leaderboard", deviceId, row);
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
  // The player's row is the best across every device linked to the signed-
  // in account (anonymous default: just the device's own row).
  const rows = [];
  const record = findDeviceRow(app, "leaderboard", body.deviceId);
  if (record) rows.push({ bestDepth: Number(record.get("bestDepth")) });
  const session = sessionOfToken(app, body.sessionToken);
  if (session) {
    const accountRows = app.findRecordsByFilter(
      "leaderboard",
      "accountId = {:accountId}",
      "",
      -1,
      0,
      { accountId: session.account.get("id") },
    );
    for (const row of accountRows || []) rows.push({ bestDepth: Number(row.get("bestDepth")) });
  }
  const best = logic.bestLeaderboardRow(rows);
  if (best === null) return ok({ entry: null });
  const above = app.findRecordsByFilter(
    "leaderboard",
    "bestDepth > {:depth}",
    "",
    -1,
    0,
    { depth: best.bestDepth },
  );
  return ok({ entry: { rank: (above || []).length + 1, bestDepth: best.bestDepth } });
}

// -- GDPR -------------------------------------------------------------------

function handleDelete(app, body) {
  if (!logic.validDeviceId(body.deviceId)) return badRequest("invalid deviceId");
  // Device scope (the shipped behavior): cloudSaves + leaderboard rows go;
  // `events` rows are pruned by the write budget; `entitlements`
  // intentionally SURVIVE (a refund/restore must remain possible — see the
  // endpoints.js header).
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

  // Account scope (optional login): the GDPR `delete my data` endpoint gains
  // the account target — the account + all linked devices. Here the legal
  // erasure beats the refund convenience, so entitlements go TOO, and every
  // live session of the account is killed (all devices sign out).
  const session = sessionOfToken(app, body.sessionToken);
  if (session) {
    const accountId = session.account.get("id");
    for (const name of ["cloudSaves", "leaderboard", "entitlements"]) {
      const rows = app.findRecordsByFilter(
        name,
        "accountId = {:accountId}",
        "",
        -1,
        0,
        { accountId: accountId },
      );
      for (const record of rows || []) app.delete(record);
    }
    const sessions = app.findRecordsByFilter(
      "authSessions",
      "accountId = {:accountId}",
      "",
      -1,
      0,
      { accountId: accountId },
    );
    for (const record of sessions || []) app.delete(record);
    app.delete(session.account);
  }
  return ok({ ok: true, deletedAccount: session !== null });
}

// -- accounts / optional login -----------------------------------------------
//
// Identity model: anonymous device default; login is additive. Three
// mechanisms (email/password, Google, Apple) sign into the SAME provider-
// agnostic account row — the lower-cased email (where one exists) is the
// shared identity, googleId/appleId are secondary lookups. Data rows stay
// deviceId-keyed and gain an accountId backfill, so signing in NEVER loses
// or duplicates data: it only re-labels rows the device already owns.

function sha256hex(str) {
  return globalThis.$security.sha256(String(str));
}

function findRecordBy(app, name, field, value) {
  try {
    return app.findFirstRecordByData(name, field, value) || null;
  } catch (err) {
    return null;
  }
}

/** The index shape logic.resolveProviderAccount consumes (all values are
 *  live records or null on a lookup miss). */
function accountIndex(app, provider, claims) {
  const field = logic.providerIdField(provider);
  const idxKey = logic.providerIndexKey(provider);
  const idx = { byGoogleId: {}, byAppleId: {}, byEmail: {} };
  if (field && idxKey && claims.sub) {
    idx[idxKey][claims.sub] = findRecordBy(app, "accounts", field, claims.sub);
  }
  if (claims.email) idx.byEmail[claims.email] = findRecordBy(app, "accounts", "email", claims.email);
  return idx;
}

function createAccountRow(app, partial) {
  const row = {
    id: logic.randomHex(logic.ACCOUNT_ID_BYTES),
    email: typeof partial.email === "string" ? partial.email : "",
    passwordHash: typeof partial.passwordHash === "string" ? partial.passwordHash : "",
    passwordSalt: typeof partial.passwordSalt === "string" ? partial.passwordSalt : "",
    googleId: typeof partial.googleId === "string" ? partial.googleId : "",
    appleId: typeof partial.appleId === "string" ? partial.appleId : "",
    createdAt: Date.now(),
  };
  return app.save(new Record(app.findCollectionByNameOrId("accounts"), row));
}


function createSession(app, account, deviceId) {
  const now = Date.now();
  return app.save(
    new Record(app.findCollectionByNameOrId("authSessions"), {
      token: logic.randomHex(logic.SESSION_TOKEN_BYTES),
      accountId: account.get("id"),
      deviceId: logic.validDeviceId(deviceId) ? deviceId : "",
      createdAt: now,
      expiresAt: logic.sessionExpiresAt(now),
    }),
  );
}

/**
 * Resolve a session token to its live account (null on any miss). An
 * expired row is pruned in place — dead sessions cost nothing after the
 * lookup that finds them.
 */
function sessionOfToken(app, token) {
  if (!logic.validSessionToken(token)) return null;
  const session = findRecordBy(app, "authSessions", "token", token);
  if (!session) return null;
  if (!logic.sessionValid(session, Date.now())) {
    try {
      app.delete(session);
    } catch (_) {
      /* race: another request already pruned it */
    }
    return null;
  }
  const accountId = session.get("accountId");
  const account = accountId ? findRecordBy(app, "accounts", "id", accountId) : null;
  if (!account) return null;
  return { session: session, account: account };
}

/**
 * Link the device's existing data rows to the account — BACKFILL ONLY
 * (set accountId where the device already has a row). Nothing is copied or
 * created, so nothing can be lost or duplicated; the device rows keep
 * their deviceId as the primary key.
 */
function linkDeviceRows(app, accountId, deviceId) {
  if (!accountId || !logic.validDeviceId(deviceId)) return;
  for (const name of ["cloudSaves", "leaderboard", "entitlements"]) {
    const record = findDeviceRow(app, name, deviceId);
    if (!record) continue;
    if (record.get("accountId") === accountId) continue;
    record.set("accountId", accountId);
    app.save(record);
  }
}

function accountJson(account) {
  return logic.accountShape({
    email: account.get("email") || "",
    passwordHash: account.get("passwordHash") || "",
    googleId: account.get("googleId") || "",
    appleId: account.get("appleId") || "",
  });
}

function signedInReply(account, session) {
  return { ok: true, token: session.get("token"), account: accountJson(account) };
}

function handleAuthRegister(app, body) {
  const v = logic.validateEmailCredentials(body.email, body.password);
  if (!v.ok) return badRequest(v.error);
  if (findRecordBy(app, "accounts", "email", v.value.email)) {
    return { status: 409, json: { error: "email already in use" } };
  }
  if (!logic.validDeviceId(body.deviceId)) return badRequest("invalid deviceId");
  if (logic.writeBudgetExceeded((recentWriteEvents(app, body.deviceId) || []).length)) {
    return tooManyRequests();
  }
  const salt = logic.randomHex(logic.PASSWORD_SALT_BYTES);
  const account = createAccountRow(app, {
    email: v.value.email,
    passwordHash: logic.hashPassword(v.value.password, salt, sha256hex),
    passwordSalt: salt,
  });
  const session = createSession(app, account, body.deviceId);
  linkDeviceRows(app, account.get("id"), body.deviceId);
  spendWriteBudget(app, body.deviceId);
  return ok(signedInReply(account, session));
}

function handleAuthLogin(app, body) {
  const v = logic.validateEmailCredentials(body.email, body.password);
  if (!v.ok) return badRequest(v.error);
  // One error for both misses — the endpoint must not confirm which half
  // of (email, password) is wrong.
  const account = findRecordBy(app, "accounts", "email", v.value.email);
  const stored = account ? account.get("passwordHash") : "";
  if (!account || !logic.verifyPassword(v.value.password, stored, sha256hex)) {
    return { status: 401, json: { error: "invalid credentials" } };
  }
  if (!logic.validDeviceId(body.deviceId)) return badRequest("invalid deviceId");
  if (logic.writeBudgetExceeded((recentWriteEvents(app, body.deviceId) || []).length)) {
    return tooManyRequests();
  }
  const session = createSession(app, account, body.deviceId);
  linkDeviceRows(app, account.get("id"), body.deviceId);
  spendWriteBudget(app, body.deviceId);
  return ok(signedInReply(account, session));
}

function handleAuthProvider(app, provider, body) {
  if (provider !== "google" && provider !== "apple") return badRequest("unknown provider");
  if (!logic.validDeviceId(body.deviceId)) return badRequest("invalid deviceId");
  // Verified by the sidecar (or fake-decoded in sandbox) — an unverified
  // sign-in would be an account takeover, so null is a hard 401.
  const verdict = verifyIdentity(provider, body.idToken);
  if (!verdict) return { status: 401, json: { error: "token verification failed" } };
  const claims = logic.normalizeProviderClaims(provider, verdict);
  if (!claims) return { status: 401, json: { error: "token verification failed" } };
  if (logic.writeBudgetExceeded((recentWriteEvents(app, body.deviceId) || []).length)) {
    return tooManyRequests();
  }
  const resolved = logic.resolveProviderAccount(accountIndex(app, provider, claims), claims);
  const account =
    resolved.action === "create" ? createAccountRow(app, resolved.account) : resolved.account;
  // Claim upgrades: pin a provider id / a real email the first time they
  // appear (an Apple proxy-email account gains a provider id at sign-in,
  // and any account gains its email when the provider first carries one).
  const field = logic.providerIdField(provider);
  const patch = {};
  if (!account.get(field) && claims.sub) patch[field] = claims.sub;
  if (!account.get("email") && claims.email) patch.email = claims.email;
  if (Object.keys(patch).length > 0) {
    for (const key of Object.keys(patch)) account.set(key, patch[key]);
    app.save(account);
  }
  const session = createSession(app, account, body.deviceId);
  linkDeviceRows(app, account.get("id"), body.deviceId);
  spendWriteBudget(app, body.deviceId);
  return ok(signedInReply(account, session));
}

function handleAuthMe(app, body) {
  const s = sessionOfToken(app, body.token);
  if (!s) return { status: 401, json: { error: "invalid session" } };
  return ok({ account: accountJson(s.account) });
}

function handleAuthLogout(app, body) {
  const s = sessionOfToken(app, body.token);
  if (s) {
    try {
      app.delete(s.session);
    } catch (_) {
      /* race: already gone */
    }
  }
  return ok({ ok: true });
}

function handleAuthLink(app, body) {
  // The claim flow on a NEW device: the device already signed in (it has a
  // session) and now wants its pre-existing anonymous rows attached to the
  // account.
  const s = sessionOfToken(app, body.token);
  if (!s) return { status: 401, json: { error: "invalid session" } };
  if (!logic.validDeviceId(body.deviceId)) return badRequest("invalid deviceId");
  if (logic.writeBudgetExceeded((recentWriteEvents(app, body.deviceId) || []).length)) {
    return tooManyRequests();
  }
  linkDeviceRows(app, s.account.get("id"), body.deviceId);
  spendWriteBudget(app, body.deviceId);
  return ok({ ok: true, account: accountJson(s.account) });
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
  "auth/register": handleAuthRegister,
  "auth/login": handleAuthLogin,
  "auth/google": (app, body) => handleAuthProvider(app, "google", body),
  "auth/apple": (app, body) => handleAuthProvider(app, "apple", body),
  "auth/me": handleAuthMe,
  "auth/logout": handleAuthLogout,
  "auth/link": handleAuthLink,
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
    const handler = handlers[handlerName];
    if (!handler) {
      e.json(404, { error: "unknown route " + path });
      return;
    }
    const result = handler(globalThis.$app, bodyOf(e));
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
