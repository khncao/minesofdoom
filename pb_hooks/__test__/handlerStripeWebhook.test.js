/**
 * Tests for handleStripeWebhook (pb_hooks/handlerLib.js) — the backup mint
 * path for web IAP. The Pocketbase `app` surface the handler touches is a
 * small fake (records + filters for the two collections it uses), the
 * Record/$security globals are stubbed, and store verification runs in
 * sandbox mode (MDOOM_DEV_FAKE_TOKEN=1 → any non-empty token mints) or
 * fail-closed (no env → refuses). handlerLib requires siblings via the
 * Pocketbase-only `__hooks` global, so the tests set it to this dir's
 * parent before each fresh require.
 */
const crypto = require("crypto");
const path = require("path");

const HOOKS_DIR = path.join(__dirname, "..");

/** A minimal Record stand-in with the Pocketbase surface the handler uses. */
class FakeRecord {
  constructor(collection, data) {
    this.collection = collection;
    this._data = { ...data };
  }
  set(key, value) {
    this._data[key] = value;
  }
  get(key) {
    return this._data[key];
  }
}

/** In-memory stand-in for the `app` datastore surface. */
function makeApp() {
  const rows = { events: [], entitlements: [] };
  const app = {
    rows,
    findRecordsByFilter(coll, filter, _sort, _pageSize, _page, params) {
      if (coll === "events") {
        // The handler queries: kind = {:kind} && payload = {:payload}
        return rows.events.filter(
          (r) => r.kind === params.kind && r.payload === params.payload,
        );
      }
      return [];
    },
    findFirstRecordByData(coll, field, value) {
      const data = rows[coll].find((r) => r[field] === value);
      // Real Pocketbase hands back Record instances (with .set/.get), so
      // wrap: the handler mutates through record.set(...).
      return data ? new FakeRecord({ name: coll }, data) : null;
    },
    findCollectionByNameOrId(name) {
      return { name };
    },
    save(record) {
      const data = record._data ?? record;
      const coll = record.collection?.name;
      rows[coll] = rows[coll] || [];
      let idx = -1;
      if (coll === "entitlements") {
        // upsertDeviceRow semantics: one row per device+product.
        idx = rows[coll].findIndex(
          (r) =>
            r.deviceId === data.deviceId && r.productId === data.productId,
        );
      } else if (coll === "events") {
        // event rows are append-only (the dedup query keys on them).
        idx = rows[coll].findIndex(
          (r) =>
            r.deviceId === data.deviceId &&
            r.kind === data.kind &&
            r.payload === data.payload,
        );
      }
      if (idx >= 0) rows[coll][idx] = { ...rows[coll][idx], ...data };
      else rows[coll].push({ ...data });
      return record;
    },
  };
  return app;
}

function loadHandlers(env) {
  jest.resetModules();
  const saved = {};
  for (const key of ["MDOOM_DEV_FAKE_TOKEN", "MDOOM_SIDECAR_URL"]) {
    saved[key] = process.env[key];
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }
  globalThis.__hooks = HOOKS_DIR;
  globalThis.Record = FakeRecord;
  globalThis.$security = {
    sha256: (s) => crypto.createHash("sha256").update(s).digest("hex"),
  };
  const lib = require("../handlerLib");
  const restore = () => {
    for (const key of Object.keys(saved)) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  };
  return { lib, restore };
}

const EVENT = {
  id: "evt_1",
  type: "checkout.session.completed",
  data: {
    object: {
      id: "cs_test_abc",
      metadata: { mdoomProductId: "packGold", mdoomDeviceId: "device-1" },
    },
  },
};

describe("handleStripeWebhook (sandbox verify mode)", () => {
  let lib;
  let app;
  const handler = () => lib.handlers["stripe/webhook"];

  beforeEach(() => {
    ({ lib } = loadHandlers({ MDOOM_DEV_FAKE_TOKEN: "1" }));
    app = makeApp();
  });

  test("a fresh event mints the entitlement row + records the dedup event", () => {
    const res = handler()(app, EVENT);
    expect(res.status).toBe(200);
    expect(res.json.processed).toBe(true);

    expect(app.rows.entitlements).toHaveLength(1);
    const row = app.rows.entitlements[0];
    expect(row.deviceId).toBe("device-1");
    expect(row.productId).toBe("pack_gold"); // the STORE id
    expect(row.platform).toBe("web");
    expect(row.tokenHash).toBe(
      crypto.createHash("sha256").update("cs_test_abc").digest("hex"),
    );
    expect(typeof row.verifiedAt).toBe("string");
    expect(app.rows.events).toHaveLength(1);
    expect(app.rows.events[0]).toMatchObject({
      deviceId: "device-1",
      kind: "stripe-event",
      payload: "evt_1",
    });
  });

  test("a repeated delivery is a no-op (dedup on the Stripe event id)", () => {
    handler()(app, EVENT);
    const again = handler()(app, EVENT);
    expect(again.json.processed).toBe(false);
    expect(again.json.reason).toBe("duplicate event");
    expect(app.rows.events).toHaveLength(1);
    expect(app.rows.entitlements).toHaveLength(1);
  });

  test("a second, different event for the same device is independent", () => {
    handler()(app, EVENT);
    const other = { ...EVENT, id: "evt_2", data: { object: { ...EVENT.data.object, id: "cs_other" } } };
    expect(handler()(app, other).json.processed).toBe(true);
    expect(app.rows.events).toHaveLength(2);
  });

  test("an unhandled event type is a 400 and mints nothing", () => {
    const res = handler()(app, { ...EVENT, type: "charge.refunded" });
    expect(res.status).toBe(400);
    expect(app.rows.events).toHaveLength(0);
    expect(app.rows.entitlements).toHaveLength(0);
  });

  test("an unknown product in the metadata is a 400 and mints nothing", () => {
    const res = handler()(app, {
      ...EVENT,
      data: { object: { ...EVENT.data.object, metadata: { mdoomProductId: "nope", mdoomDeviceId: "device-1" } } },
    });
    expect(res.status).toBe(400);
    expect(app.rows.entitlements).toHaveLength(0);
  });
});

describe("handleStripeWebhook (fail-closed verify mode)", () => {
  test("a REFUSED verify mints nothing AND does not record the event", () => {
    const { lib, restore } = loadHandlers({}); // no fake token, no sidecar
    try {
      const app = makeApp();
      const res = lib.handlers["stripe/webhook"](app, EVENT);
      expect(res.status).toBe(400);
      expect(res.json.error).toBe("token verification failed");
      // The entitlement is NOT minted…
      expect(app.rows.entitlements).toHaveLength(0);
      // …and the event is NOT recorded, so a Stripe retry (once the
      // sidecar is healthy) can still mint — a refused verify must not
      // poison the dedup marker.
      expect(app.rows.events).toHaveLength(0);
    } finally {
      restore();
    }
  });
});
