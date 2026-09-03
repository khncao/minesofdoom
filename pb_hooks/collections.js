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
      { name: "displayName", type: "text", max: 16 },
      { name: "bestDepth", type: "number", required: true },
      { name: "maxCombo", type: "number", required: true },
      { name: "lifetimeMinerals", type: "number", required: true },
      { name: "achievementIds", type: "text", max: 8000 },
      { name: "updatedAt", type: "number", required: true },
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
    if (hasCollection(app, def.name)) continue;
    const collection = new Collection(def);
    app.save(collection); // automigrates the table (flag defaults on)
    console.log(`[pb_hooks] created collection: ${def.name}`);
  }
}

// NOTE: this module is required from inside the pooled handler runtime
// (handlerLib.run), where the on* registration bindings do not exist —
// so no onBootstrap registration here. The datastore is only reachable
// from request handlers anyway (onBootstrap has no DB transaction).
module.exports = { ensureCollections, COLLECTION_DEFS };
