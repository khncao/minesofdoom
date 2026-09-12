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

// The canonical store catalog: internal app id -> store id (Play SKU /
// App Store Connect product id). Keep in sync with IAP_PRODUCTS in
// src/mines_of_doom/iaps.ts — pinned by __test__/logic.test.js. The
// verify request carries the INTERNAL id; entitlements are stored and
// returned by STORE id (the client's restore allowlist keys on store
// ids). A valid receipt for a product not in this table must never
// mint an entitlement (the plan's allowlist rule).
// One pack per paid cosmetic (PACK_SPECS in iaps.ts). Legacy rows from a
// removed product (remove_ads) are dropped by the allowlist, exactly like
// an unknown store id.
const PRODUCTS = {
 packGold: "pack_gold",
 packFrost: "pack_frost",
 packShadow: "pack_shadow",
 packNight: "pack_night",
 packGoldrush: "pack_goldrush",
 packCrystal: "pack_crystal",
 packMagma: "pack_magma",
 packBlocky: "pack_blocky",
 packSurface: "pack_surface",
 packKnight: "pack_knight",
 packHunter: "pack_hunter",
 packOni: "pack_oni",
 packMarmot: "pack_marmot",
 packFox: "pack_fox",
 packOtter: "pack_otter",
 packDamsel: "pack_damsel",
 packAmethyst: "pack_amethyst",
 packVerdant: "pack_verdant",
 packSolar: "pack_solar",
 packVoid: "pack_void",
 packVoxel: "pack_voxel",
 packWilds: "pack_wilds",
 packAshen: "pack_ashen",
 packGothic: "pack_gothic",
 packCherry: "pack_cherry",
 packSkin: "pack_skin",
};

// Highest save version this server will store. Keep in sync with
// `saveVersion` in src/mines_of_doom/game.ts — pinned by the test. A
// push with a newer version is REJECTED, not stored: a future client
// would import its own save back through a migration path this server
// doesn't know, so dropping it is the safe answer.
const MAX_SAVE_VERSION = 12;

// Cloud-save DoS boundary (plan): a real save is ~1.5KB, the cap is
// the spam boundary, not a feature limit.
const CLOUD_BLOB_MAX_BYTES = 16 * 1024;

// Leaderboard caps (docs/store-integration.md §3.3). The anti-
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

// The opt-in cohort record (docs/gap-ranking.md Tier 0 #1): a REDUCED copy
// of the client's local analytics record (analytics.ts buildCohortRecord —
// day keys, booleans, counters; never save data, never the per-purchase
// logs, never absolute timestamps). One row per device in `events`
// (kind="analytics"); 4KB is ~4x the largest real record (~1KB), well
// under the events payload text cap.
const TELEMETRY_PAYLOAD_MAX_CHARS = 4000;

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
 const achievementIds = [
  ...new Set(
   rawIds.filter(
    (id) =>
     typeof id === "string" && id.length > 0 && id.length <= ACHIEVEMENT_ID_MAX,
   ),
  ),
 ].slice(0, ACHIEVEMENT_IDS_MAX);
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
  lifetimeMinerals: Math.max(
   existing.lifetimeMinerals,
   submitted.lifetimeMinerals,
  ),
  achievementIds: [
   ...new Set([...existing.achievementIds, ...submitted.achievementIds]),
  ],
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
   return Array.isArray(parsed)
    ? parsed.filter((id) => typeof id === "string")
    : [];
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
  achievementCount: parseAchievementIds(fieldOf(record, "achievementIds"))
   .length,
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

/**
 * Validate a POST /api/app/telemetry/push body. `record` must be a plain
 * JSON object (never an array, never a scalar) whose SERIALIZED form fits
 * the cap — the canonical length is measured on the server-side stringify,
 * so a hostile client can't smuggle a long key in that the client-side
 * check wouldn't have seen. The handler stores that same stringified form
 * as the row payload, so validated length === stored length.
 */
function validateTelemetryPush(body) {
 const b = body || {};
 if (!validDeviceId(b.deviceId)) return badResult("invalid deviceId");
 if (
  typeof b.record !== "object" ||
  b.record === null ||
  Array.isArray(b.record)
 ) {
  return badResult("record must be a JSON object");
 }
 const payload = JSON.stringify(b.record);
 if (payload.length > TELEMETRY_PAYLOAD_MAX_CHARS) {
  return badResult("record exceeds the size cap");
 }
 return { ok: true, value: { deviceId: b.deviceId, payload } };
}

// -- accounts / optional login (docs/store-integration.md) ---------------
//
// Identity model (the recorded decision): anonymous device-based default,
// login is additive. Accounts are provider-agnostic — email/password,
// Google, and Apple all sign into the SAME account row; the lower-cased
// email where one exists is the shared identity, and the provider subject
// ids (googleId / appleId) are secondary lookups. Data rows (cloudSaves,
// leaderboard, entitlements) stay keyed by deviceId and gain an accountId
// backfill so a signed-in session can reach every device that has linked.

const EMAIL_RE =
 /^[a-z0-9._%+-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/;

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 72; // the sha256 pre-image bound is arbitrary; 72 is a sane cap

// Session tokens are opaque random hex, single use per request, 30-day TTL.
// They carry no claims — the authSessions collection is the source of truth.
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SESSION_TOKEN_BYTES = 32;
const ACCOUNT_ID_BYTES = 16;
const PASSWORD_SALT_BYTES = 16;

function normalizeEmail(v) {
 return String(v == null ? "" : v)
  .trim()
  .toLowerCase();
}

function validEmail(v) {
 const e = normalizeEmail(v);
 return e.length >= 6 && e.length <= 254 && EMAIL_RE.test(e);
}

function validPassword(v) {
 return (
  typeof v === "string" &&
  v.length >= PASSWORD_MIN_LENGTH &&
  v.length <= PASSWORD_MAX_LENGTH
 );
}

/** Validate a register/login body. Returns the normalized email (the
 *  account key) + the raw password (never returned by the handlers). */
function validateEmailCredentials(email, password) {
 if (!validEmail(email)) return badResult("invalid email");
 if (!validPassword(password)) return badResult("invalid password");
 return { ok: true, value: { email: normalizeEmail(email), password } };
}

// Iterated-SHA-256 KDF. The goja runtime has no PBKDF2/scrypt/argon2 —
// $security exposes only raw sha256 — so this is a simple stretch: 100k
// rounds turns the previous single-iteration sha256 into a 100,000x-slower
// digest while staying in the runtime. Memory-hard Argon2/scrypt is strictly
// better but unavailable here; this is the strongest practical in-runtime
// option and a large step up from 1 round. The iteration count is stored in
// the hash (below) so it can be raised later without a migration. (docs/
// security-audit.md S3.)
const PASSWORD_KDF_ITERATIONS = 100000;

/**
 * Iterated SHA-256 stretch: h = sha256(salt:password); then h =
 * sha256(h:password) (iterations-1) more times. Pure w.r.t. the injected
 * `sha256`.
 */
function kdfSha256(password, salt, iterations, sha256) {
 let h = sha256(salt + ":" + password);
 for (let i = 1; i < iterations; i++) h = sha256(h + ":" + password);
 return h;
}

/**
 * Salted iterated-SHA-256 password digest, stored as
 * "pbkdf2-sha256:<iterations>:<salt>:<hash>". `sha256` is injected. Supersedes
 * the old single-iteration "sha256:<salt>:<hash>" form, which verifyPassword
 * still accepts and the login handler transparently upgrades.
 */
function hashPassword(password, salt, sha256) {
 return (
  "pbkdf2-sha256:" +
  PASSWORD_KDF_ITERATIONS +
  ":" +
  salt +
  ":" +
  kdfSha256(password, salt, PASSWORD_KDF_ITERATIONS, sha256)
 );
}

/**
 * True when `stored` is the legacy single-iteration "sha256:" form (needs a
 * transparent upgrade to the KDF on the next successful login).
 */
function passwordNeedsUpgrade(stored) {
 return String(stored == null ? "" : stored).split(":")[0] === "sha256";
}

function constantTimeEqual(a, b) {
 if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) {
  return false;
 }
 let diff = 0;
 for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
 return diff === 0;
}

function verifyPassword(password, stored, sha256) {
 const parts = String(stored == null ? "" : stored).split(":");
 // Legacy: "sha256:<salt>:<hash>" (1 iteration).
 if (parts.length === 3 && parts[0] === "sha256" && parts[1].length > 0) {
  return constantTimeEqual(sha256(parts[1] + ":" + password), parts[2]);
 }
 // KDF: "pbkdf2-sha256:<iterations>:<salt>:<hash>".
 if (
  parts.length === 4 &&
  parts[0] === "pbkdf2-sha256" &&
  parts[2].length > 0 &&
  parts[3].length > 0
 ) {
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 1) return false;
  return constantTimeEqual(
   kdfSha256(password, parts[2], iterations, sha256),
   parts[3],
  );
 }
 return false;
}

/**
 * Random hex of `byteCount` bytes. `rand` is injectable (0..1) so tests
 * are deterministic; the default is Math.random — a PRNG, NOT a CSPRNG.
 * Do NOT use this for security-critical material: handlerLib.js mints
 * session tokens / password salts / account ids through secureRandomHex
 * ($security.randomStringWithAlphabet, crypto/rand-backed) instead
 * (docs/security-audit.md S1). This is the pure, test-friendly fallback.
 */
function randomHex(byteCount, rand) {
 const r = typeof rand === "function" ? rand : Math.random;
 let out = "";
 for (let i = 0; i < byteCount; i++) {
  out += ("0" + Math.floor(r() * 256).toString(16)).slice(-2);
 }
 return out;
}

function validSessionToken(v) {
 return (
  typeof v === "string" &&
  v.length >= 16 &&
  v.length <= 128 &&
  /^[A-Za-z0-9_-]+$/.test(v)
 );
}

/** A session row is live while now < expiresAt (the row itself must
 *  exist — the handler checks that). */
function sessionValid(session, nowMs) {
 if (!session) return false;
 // Live goja Records only expose fields through .get() — a raw
 // .expiresAt reads undefined on the server (the unit-test mocks are
 // plain objects, so support both shapes).
 const exp =
  typeof session.get === "function"
   ? session.get("expiresAt")
   : session.expiresAt;
 return Number(exp) > Number(nowMs);
}

function sessionExpiresAt(createdAtMs, ttlMs) {
 return Number(createdAtMs) + Number(ttlMs == null ? SESSION_TTL_MS : ttlMs);
}

const PROVIDERS = ["google", "apple"];

/** Index key for a provider's subject-id lookups (the `index` shape
 *  resolveProviderAccount consumes: { byGoogleId, byAppleId, byEmail }). */
function providerIndexKey(provider) {
 if (provider === "google") return "byGoogleId";
 if (provider === "apple") return "byAppleId";
 return null;
}

function providerIdField(provider) {
 if (provider === "google") return "googleId";
 if (provider === "apple") return "appleId";
 return null;
}

/**
 * Normalize a verified provider-token payload into the claims the account
 * resolution trusts. sub is the provider subject (opaque, ≤64 safe chars —
 * it is stored in a text column and interpolated into filters); email is
 * only trusted when the provider said it was verified (Google's
 * email_verified flag; Apple always controls the address it returns,
 * including privacy-proxy addresses).
 */
function normalizeProviderClaims(provider, claims) {
 const c = claims || {};
 const field = providerIdField(provider);
 if (!field) return null;
 if (typeof c.sub !== "string" || !/^[A-Za-z0-9._|:-]{1,256}$/.test(c.sub))
  return null;
 let email = "";
 if (provider === "apple" || c.emailVerified === true) {
  if (validEmail(c.email)) email = normalizeEmail(c.email);
 }
 return { provider: provider, sub: c.sub, email: email };
}

/**
 * Account resolution for a verified provider sign-in — the provider-
 * agnostic merge rule. `index` is the handler's pre-fetched lookups:
 *   { byGoogleId: {<sub>: account}, byAppleId: {<sub>: account},
 *     byEmail: {<email>: account} }
 * Rules, in order:
 *   1. an account keyed on THIS provider's sub already exists → sign in
 *      to it (a re-login, including after a proxy-email round trip);
 *   2. else a VERIFIED email matches an existing account → sign in to
 *      that account (email is the shared identity — this is what lets
 *      Google sign into an email/password account);
 *   3. else → create: the new account carries this provider's sub and
 *      the verified email (Apple may have none — privacy proxy).
 * Returns { action: "signin" | "create", account }.
 */
function resolveProviderAccount(index, { provider, sub, email }) {
 const field = providerIdField(provider);
 if (!field) return null;
 const idx = index || {};
 const byProvider = idx[providerIndexKey(provider)] || {};
 if (byProvider[sub]) return { action: "signin", account: byProvider[sub] };
 const byEmail = idx.byEmail || {};
 const normalizedEmail = normalizeEmail(email);
 if (normalizedEmail && byEmail[normalizedEmail]) {
  return { action: "signin", account: byEmail[normalizedEmail] };
 }
 const created = {};
 created[field] = sub;
 created.email = email || "";
 return { action: "create", account: created };
}

/**
 * Link decision for /api/app/auth/link/<provider> — a SIGNED-IN account
 * deliberately attaches a provider identity (the other direction of the
 * merge: rule 2 of resolveProviderAccount merges on sign-in when the
 * emails match, this is the path when they don't, e.g. Apple privacy
 * proxy or a second email). `ownerId` is the id of the account that
 * already carries this provider sub (null when unclaimed), `currentId`
 * the live session's account. Rules — the "one provider identity = one
 * account" invariant:
 *   1. unclaimed          → "link"  (attach it to this account)
 *   2. claimed by this one→ "noop"  (idempotent re-link)
 *   3. claimed by another → "error" (NEVER steal or merge accounts)
 */
function resolveProviderLink(ownerId, currentId) {
 if (!ownerId) return { action: "link" };
 if (ownerId === currentId) return { action: "noop" };
 return { action: "error", error: "provider-taken" };
}

/** The public shape of an account in API replies — nothing the client
 *  can act on beyond its own email; provider id links only. */
function accountShape(account) {
 const a = account || {};
 return {
  email: typeof a.email === "string" ? a.email : "",
  providers: [
   {
    name: "email",
    linked: typeof a.passwordHash === "string" && a.passwordHash.length > 0,
   },
   {
    name: "google",
    linked: typeof a.googleId === "string" && a.googleId.length > 0,
   },
   {
    name: "apple",
    linked: typeof a.appleId === "string" && a.appleId.length > 0,
   },
  ],
 };
}

/** Union of entitlement lists (cross-device restore): deduped, order of
 *  first appearance, non-strings dropped. */
function unionEntitlements(lists) {
 const flat = [];
 for (const list of lists || []) {
  if (Array.isArray(list)) for (const item of list) flat.push(item);
 }
 return [...new Set(flat.filter((v) => typeof v === "string" && v.length > 0))];
}

/** Newest row by numeric updatedAt (cloud pull across linked devices).
 *  Ties keep the FIRST row (the device's own row comes first, so a stale
 *  account copy never shadows the local device). */
function newestByUpdatedAt(rows) {
 let best = null;
 let bestTs = -Infinity;
 for (const row of rows || []) {
  const ts = Number(row && row.updatedAt);
  if (!Number.isFinite(ts)) continue;
  if (best === null || ts > bestTs) {
   best = row;
   bestTs = ts;
  }
 }
 return best;
}

/** The account's best leaderboard row across linked devices (max
 *  bestDepth; ties keep the first = the device's own row). */
function bestLeaderboardRow(rows) {
 let best = null;
 let bestDepth = -Infinity;
 for (const row of rows || []) {
  const depth = Number(row && row.bestDepth);
  if (!Number.isFinite(depth)) continue;
  if (best === null || depth > bestDepth) {
   best = row;
   bestDepth = depth;
  }
 }
 return best;
}

/** The only Stripe webhook event type that mints an entitlement. */
const STRIPE_WEBHOOK_EVENT_TYPE = "checkout.session.completed";
const STRIPE_EVENT_ID_MAX = 128;

/**
 * Shape-check a parsed Stripe webhook event and extract the fields the
 * mint needs. PURE — the actual gate is the sidecar's Stripe-API lookup
 * (verifyStripeCheckout); this only decides which (session, product,
 * device) to ask it about. Returns { ok, error?, sessionId?, productId?,
 * deviceId? }.
 *
 * A spoofed POST to /api/app/stripe-webhook costs the attacker one
 * sidecar API lookup that will not match their product/device — it can
 * never mint, so accepting an unauthenticated event body is safe.
 */
function validateStripeWebhookEvent(event) {
 if (!event || typeof event !== "object") {
  return { ok: false, error: "event is not an object" };
 }
 if (
  typeof event.id !== "string" ||
  event.id.length < 1 ||
  event.id.length > STRIPE_EVENT_ID_MAX
 ) {
  return { ok: false, error: "invalid event id" };
 }
 if (event.type !== STRIPE_WEBHOOK_EVENT_TYPE) {
  return { ok: false, error: "unhandled event type" };
 }
 const session =
  event.data &&
  typeof event.data === "object" &&
  typeof event.data.object === "object"
   ? event.data.object
   : null;
 if (
  !session ||
  typeof session.id !== "string" ||
  session.id.length < 1 ||
  session.id.length > 128
 ) {
  return { ok: false, error: "missing checkout session" };
 }
 const meta =
  session.metadata && typeof session.metadata === "object"
   ? session.metadata
   : {};
 const productId =
  typeof meta.mdoomProductId === "string" ? meta.mdoomProductId : "";
 if (productId.length < 1 || !PRODUCTS[productId]) {
  return { ok: false, error: "unknown productId in metadata" };
 }
 const deviceId =
  typeof meta.mdoomDeviceId === "string" ? meta.mdoomDeviceId : "";
 if (!validDeviceId(deviceId)) {
  return { ok: false, error: "invalid deviceId in metadata" };
 }
 return {
  ok: true,
  sessionId: session.id,
  productId: productId,
  deviceId: deviceId,
 };
}

module.exports = {
 PRODUCTS,
 STRIPE_WEBHOOK_EVENT_TYPE,
 STRIPE_EVENT_ID_MAX,
 validateStripeWebhookEvent,
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
 TELEMETRY_PAYLOAD_MAX_CHARS,
 validateTelemetryPush,
 // accounts / optional login
 EMAIL_RE,
 PASSWORD_MIN_LENGTH,
 PASSWORD_MAX_LENGTH,
 SESSION_TTL_MS,
 SESSION_TOKEN_BYTES,
 ACCOUNT_ID_BYTES,
 PASSWORD_SALT_BYTES,
 PROVIDERS,
 normalizeEmail,
 validEmail,
 validPassword,
 validateEmailCredentials,
 providerIndexKey,
 PASSWORD_KDF_ITERATIONS,
 kdfSha256,
 hashPassword,
 verifyPassword,
 passwordNeedsUpgrade,
 randomHex,
 validSessionToken,
 sessionValid,
 sessionExpiresAt,
 providerIdField,
 normalizeProviderClaims,
 resolveProviderAccount,
 resolveProviderLink,
 accountShape,
 unionEntitlements,
 newestByUpdatedAt,
 bestLeaderboardRow,
};
