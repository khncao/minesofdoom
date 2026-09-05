"use strict";
/*
 * Programmatic collection setup (plan: "collections: create the 4
 * collections with a migration — not by hand"). Runs at hook boot; each
 * definition is a plain object the v0.40 `Collection` model accepts.
 *
 * All collections are PRIVATE: every rule is null, so the only writer/
 * reader in the universe is this hooks folder via $app. The app client
 * never talks to the collection REST API directly.
 */
const COLLECTION_DEFS = [
  {
    type: "base",
    name: "entitlements",
    // one row per (deviceId, productId); verifiedAt lets us audit refunds
    fields: [
      { name: "deviceId", type: "text", required: true, max: 64 },
      // Optional login: set when the owning device has signed into an
      // account — cross-device restore queries on this column.
      { name: "accountId", type: "text", max: 32 },
      { name: "productId", type: "text", required: true, max: 64 },
      { name: "platform", type: "text", max: 16 },
      { name: "tokenHash", type: "text", max: 64 },
      { name: "verifiedAt", type: "text", max: 40 },
    ],
  },
  {
    type: "base",
    name: "cloudSaves",
    // one row per deviceId; blob ≤ 16KB enforced in logic.validateCloudPush
    fields: [
      { name: "deviceId", type: "text", required: true, max: 64 },
      { name: "accountId", type: "text", max: 32 },
      { name: "blob", type: "text", required: true, max: 20000 },
      { name: "saveVersion", type: "number", required: true },
      { name: "updatedAt", type: "number", required: true },
    ],
  },
  {
    type: "base",
    name: "leaderboard",
    // one row per deviceId; values only ever move forward (logic.merge)
    fields: [
      { name: "deviceId", type: "text", required: true, max: 64 },
      { name: "accountId", type: "text", max: 32 },
      { name: "displayName", type: "text", max: 16 },
      // NOT required: a brand-new device's first submit is all zeros, and
      // Pocketbase v0.4x rejects 0 on a required number field ("cannot be
      // blank") — the fresh row is the common case, so zeros must be legal.
      { name: "bestDepth", type: "number" },
      { name: "maxCombo", type: "number" },
      { name: "lifetimeMinerals", type: "number" },
      { name: "achievementIds", type: "text", max: 8000 },
      { name: "updatedAt", type: "number", required: true },
    ],
  },
  {
    type: "base",
    name: "accounts",
    // one row per account (optional login). provider-agnostic: any of the
    // three mechanisms signs into the same row; the lower-cased email
    // (where one exists) is the shared identity, googleId/appleId are
    // secondary lookups. email may be empty (Apple privacy proxy).
    fields: [
      { name: "id", type: "text", required: true, max: 32 },
      { name: "email", type: "text", max: 254 },
      { name: "passwordHash", type: "text", max: 128 },
      { name: "passwordSalt", type: "text", max: 32 },
      { name: "googleId", type: "text", max: 64 },
      { name: "appleId", type: "text", max: 64 },
      { name: "createdAt", type: "number", required: true },
    ],
  },
  {
    type: "base",
    name: "authSessions",
    // one row per live sign-in; the opaque token IS the credential. Pruned
    // lazily on expiry (a dead row costs a lookup, nothing more).
    fields: [
      { name: "token", type: "text", required: true, max: 64 },
      { name: "accountId", type: "text", required: true, max: 32 },
      { name: "deviceId", type: "text", max: 64 },
      { name: "createdAt", type: "number", required: true },
      { name: "expiresAt", type: "number", required: true },
    ],
  },
  {
    type: "base",
    name: "events",
    // phase 2 (plan): analytics/audit rows; created now so the GDPR delete
    // endpoint can clear it even before any endpoint writes it.
    fields: [
      { name: "deviceId", type: "text", required: true, max: 64 },
      { name: "kind", type: "text", max: 64 },
      { name: "payload", type: "text", max: 8000 },
      // v0.4x records expose no filterable created/updated fields, so the
      // write-budget window is tracked with an explicit millisecond stamp.
      { name: "ts", type: "number", required: true },
    ],
  },
];

function hasCollection(app, name) {
  try {
    return Boolean(app.findCollectionByNameOrId(name));
  } catch (err) {
    return false; // "not found" surfaces as a GoError
  }
}

function ensureCollections() {
  const app = globalThis.$app;
  for (const def of COLLECTION_DEFS) {
    const live = hasCollection(app, def.name) ? safeCollection(app, def.name) : null;
    if (!live) {
      const collection = new Collection(def);
      app.save(collection); // automigrates the table (flag defaults on)
      console.log(`[pb_hooks] created collection: ${def.name}`);
      continue;
    }
    // Schema drift on EXISTING collections: reconcile the `required` flag
    // field-by-field (the only def property that ever changes after deploy
    // — e.g. leaderboard stats went from required:true to required:false
    // because v0.4x treats a stored 0 as "blank" on required numbers).
    let changed = false;
    for (const fieldDef of def.fields) {
      const liveField = live.fields.find(
        (f) => f.name === fieldDef.name,
      );
      if (liveField && Boolean(liveField.required) !== Boolean(fieldDef.required)) {
        liveField.required = Boolean(fieldDef.required);
        changed = true;
      }
    }
    if (changed) {
      app.save(live);
      console.log(`[pb_hooks] reconciled field flags: ${def.name}`);
    }
  }
}

function safeCollection(app, name) {
  try {
    return app.findCollectionByNameOrId(name);
  } catch (err) {
    return null;
  }
}

// NOTE: this module is required from inside the pooled handler runtime
// (handlerLib.run), where the on* registration bindings do not exist —
// so no onBootstrap registration here. The datastore is only reachable
// from request handlers anyway (onBootstrap has no DB transaction).
module.exports = { ensureCollections, COLLECTION_DEFS };
