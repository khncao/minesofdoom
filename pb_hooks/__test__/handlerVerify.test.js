/**
 * Regression tests for F39.1 / Tier 1 #23 (entitlements:
 * clobber-on-second-purchase) — the PRIMARY verify path
 * (handleVerify), the restore read-back, the webhook backup mint,
 * and the sign-in backfill (linkDeviceRows).
 *
 * Why a NEW fake: the handlerStripeWebhook fake's save() implemented
 * the INTENDED upsert semantics ("one row per device+product" — its
 * comment says so), so a deviceId-keyed in-place rewrite could never
 * clobber there: the fake pushed a second row where Pocketbase mutates
 * the found record in place. This fake is production-faithful in the
 * one place it matters:
 *   - app.findFirstRecordByData(c, f, v) matches on the GIVEN field
 *     alone (deviceId, whatever the handler passes) and hands back a
 *     record BOUND to the stored row;
 *   - record.set() + app.save() on a bound record mutates THAT stored
 *     row in place (exactly what Pocketbase does) — save never
 *     de-duplicates or splits rows;
 *   - new Record(...) + app.save() appends a new row.
 * With the pre-fix code this fake reproduces the clobber (one row,
 * productId flipped); with the pair-keyed upsert it must yield one row
 * per (deviceId, productId).
 */
const crypto = require("crypto");
const path = require("path");

const HOOKS_DIR = path.join(__dirname, "..");

/** A record BOUND to a stored row: set() mutates the stored row in place. */
class StoredRecord {
  constructor(collName, row) {
    this.collection = { name: collName };
    this._row = row;
  }
  set(key, value) {
    this._row[key] = value;
  }
  get(key) {
    return this._row[key];
  }
}

/** A fresh, not-yet-persisted record (what the handler's `new Record` is). */
class NewRecord {
  constructor(collection, data) {
    this.collection = collection;
    this._data = { ...data };
    this._row = null;
  }
  set(key, value) {
    this._data[key] = value;
  }
  get(key) {
    return this._data[key];
  }
}

/** Tiny evaluator for the Pocketbase filter clauses the handlers use. */
function matchFilter(row, filter, params) {
  const parts = String(filter)
    .split("&&")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const p of parts) {
    let m = p.match(/^(\w+) = \{:(\w+)\}$/);
    if (m) {
      if (row[m[1]] !== params[m[2]]) return false;
      continue;
    }
    m = p.match(/^(\w+) >= \{:(\w+)\}$/);
    if (m) {
      if (!(row[m[1]] >= params[m[2]])) return false;
      continue;
    }
    m = p.match(/^(\w+) < \{:(\w+)\}$/);
    if (m) {
      if (!(row[m[1]] < params[m[2]])) return false;
      continue;
    }
    throw new Error("filter clause not modeled by the fake: " + p);
  }
  return true;
}

function makeApp() {
  const rows = {
    accounts: [],
    authSessions: [],
    entitlements: [],
    events: [],
    cloudSaves: [],
    leaderboard: [],
    passwords: [],
  };
  const app = {
    rows,
    save(record) {
      if (record._row) {
        // Bound record: set() already mutated the stored row IN PLACE —
        // save is an in-place update. This is the Pocketbase behavior the
        // pre-fix code relied on (and that made the clobber real).
        return record;
      }
      const coll = record.collection.name;
      rows[coll] = rows[coll] || [];
      const row = { ...record._data };
      rows[coll].push(row);
      record._row = row;
      return record;
    },
    findFirstRecordByData(coll, field, value) {
      const row = (rows[coll] || []).find((r) => r[field] === value) || null;
      return row ? new StoredRecord(coll, row) : null;
    },
    findRecordsByFilter(coll, filter, _sort, _pageSize, _page, params) {
      return (rows[coll] || [])
        .filter((r) => matchFilter(r, filter, params))
        .map((r) => new StoredRecord(coll, r));
    },
    findCollectionByNameOrId(name) {
      return { name };
    },
    delete(record) {
      const arr = rows[record.collection.name] || [];
      const idx = arr.indexOf(record._row);
      if (idx >= 0) arr.splice(idx, 1);
    },
  };
  return app;
}

function loadHandlers(env) {
  jest.resetModules();
  const saved = {};
  for (const key of ["MDOOM_DEV_FAKE_TOKEN", "MDOOM_SIDECAR_URL", "MDOOM_SIDECAR_SECRET"]) {
    saved[key] = process.env[key];
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }
  globalThis.__hooks = HOOKS_DIR;
  globalThis.Record = NewRecord;
  globalThis.$security = {
    sha256: (s) => crypto.createHash("sha256").update(s).digest("hex"),
    randomStringWithAlphabet: (length, alphabet) => {
      const buf = crypto.randomBytes(length);
      let out = "";
      for (let i = 0; i < length; i++) out += alphabet[buf[i] % alphabet.length];
      return out;
    },
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

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

/** A verify request body for the given internal product id. */
function verifyBody(deviceId, productId, token, sessionToken) {
  return {
    deviceId,
    productId,
    token: token || "receipt-" + productId,
    platform: "web",
    ...(sessionToken ? { sessionToken } : {}),
  };
}

const WEBHOOK_EVENT = (id, sessionId, productId, deviceId) => ({
  id,
  type: "checkout.session.completed",
  data: {
    object: {
      id: sessionId,
      metadata: { mdoomProductId: productId, mdoomDeviceId: deviceId },
    },
  },
});

describe("handleVerify — one row per (deviceId, productId) (F39.1)", () => {
  let lib;
  let app;
  let restore;

  beforeEach(() => {
    ({ lib, restore } = loadHandlers({ MDOOM_DEV_FAKE_TOKEN: "1" }));
    app = makeApp();
  });

  afterEach(() => restore());

  test("a second, DIFFERENT pack on the same device does not clobber the first (the F39.1 regression)", () => {
    const first = lib.handlers.verify(app, verifyBody("device-1", "packGold", "tok-gold"));
    expect(first.status).toBe(200);
    expect(first.json.entitlements).toEqual(["pack_gold"]);

    const second = lib.handlers.verify(app, verifyBody("device-1", "packFrost", "tok-frost"));
    expect(second.status).toBe(200);

    // TWO rows — the pre-fix code rewrote row 1 in place (productId
    // flipped to pack_frost) and only one row survived.
    expect(app.rows.entitlements).toHaveLength(2);
    const byProduct = Object.fromEntries(
      app.rows.entitlements.map((r) => [r.productId, r]),
    );
    expect(byProduct.pack_gold.tokenHash).toBe(sha256("tok-gold"));
    expect(byProduct.pack_frost.tokenHash).toBe(sha256("tok-frost"));
    expect(app.rows.entitlements.every((r) => r.deviceId === "device-1")).toBe(true);

    // The verify response and the RESTORE both return every purchased
    // product — restore is the recovery source on reinstall, which is
    // exactly where the clobber bit.
    expect(second.json.entitlements.sort()).toEqual(["pack_frost", "pack_gold"]);
    const restored = lib.handlers.restore(app, { deviceId: "device-1" });
    expect(restored.status).toBe(200);
    expect(restored.json.entitlements.sort()).toEqual(["pack_frost", "pack_gold"]);
  });

  test("re-verifying the SAME product stays one row and refreshes the receipt", () => {
    lib.handlers.verify(app, verifyBody("device-1", "packGold", "tok-a"));
    const again = lib.handlers.verify(app, verifyBody("device-1", "packGold", "tok-b"));
    expect(again.status).toBe(200);
    expect(app.rows.entitlements).toHaveLength(1);
    // The row refreshed to the new receipt hash (idempotent re-verify,
    // F39.3's documented property — the pair-keyed upsert keeps it).
    expect(app.rows.entitlements[0].tokenHash).toBe(sha256("tok-b"));
    expect(again.json.entitlements).toEqual(["pack_gold"]);
  });

  test("a different device's purchase is a separate row", () => {
    lib.handlers.verify(app, verifyBody("device-1", "packGold", "tok-a"));
    lib.handlers.verify(app, verifyBody("device-2", "packGold", "tok-b"));
    expect(app.rows.entitlements).toHaveLength(2);
    expect(app.rows.entitlements.map((r) => r.deviceId).sort()).toEqual([
      "device-1",
      "device-2",
    ]);
  });
});

describe("handleStripeWebhook — pair-keyed mint on the backup path too (F39.1)", () => {
  let lib;
  let app;
  let restore;

  beforeEach(() => {
    ({ lib, restore } = loadHandlers({ MDOOM_DEV_FAKE_TOKEN: "1" }));
    app = makeApp();
  });

  afterEach(() => restore());

  test("two different products, one device → two rows (the webhook used the same shared writer)", () => {
    const r1 = lib.handlers["stripe/webhook"](
      app,
      WEBHOOK_EVENT("evt_1", "cs_g", "packGold", "device-1"),
    );
    const r2 = lib.handlers["stripe/webhook"](
      app,
      WEBHOOK_EVENT("evt_2", "cs_f", "packFrost", "device-1"),
    );
    expect(r1.json.processed).toBe(true);
    expect(r2.json.processed).toBe(true);
    expect(app.rows.entitlements).toHaveLength(2);
    expect(app.rows.entitlements.map((r) => r.productId).sort()).toEqual([
      "pack_frost",
      "pack_gold",
    ]);
  });

  test("a re-delivery of the same event still no-ops (dedup intact on the new fake)", () => {
    const event = WEBHOOK_EVENT("evt_1", "cs_g", "packGold", "device-1");
    expect(lib.handlers["stripe/webhook"](app, event).json.processed).toBe(true);
    const again = lib.handlers["stripe/webhook"](app, event);
    expect(again.json.processed).toBe(false);
    expect(again.json.reason).toBe("duplicate event");
    expect(app.rows.entitlements).toHaveLength(1);
  });
});

describe("linkDeviceRows — the sign-in backfill tags EVERY entitlement row (F39.1 blast radius)", () => {
  let lib;
  let app;
  let restore;

  beforeEach(() => {
    ({ lib, restore } = loadHandlers({ MDOOM_DEV_FAKE_TOKEN: "1" }));
    app = makeApp();
  });

  afterEach(() => restore());

  test("two anonymous purchases, then sign-in: both rows get the account tag, and the account-union restore sees both", () => {
    // Anonymous purchases: no accountId on the rows.
    lib.handlers.verify(app, verifyBody("device-1", "packGold", "tok-a"));
    lib.handlers.verify(app, verifyBody("device-1", "packFrost", "tok-b"));
    expect(app.rows.entitlements).toHaveLength(2);
    expect(app.rows.entitlements.every((r) => !r.accountId)).toBe(true);

    const reg = lib.handlers["auth/register"](app, {
      email: "miner@example.com",
      password: "hunter22",
      deviceId: "device-1",
    });
    expect(reg.status).toBe(200);
    expect(reg.json.ok).toBe(true);

    // The pre-fix single-row backfill tagged only the FIRST row, so the
    // account-union restore (a fresh device, signed in) missed the rest.
    expect(app.rows.entitlements).toHaveLength(2);
    const accountId = app.rows.accounts[0].id;
    expect(app.rows.entitlements.every((r) => r.accountId === accountId)).toBe(true);

    // The account-union read (what a fresh device restores) returns both.
    const res = lib.handlers.restore(app, {
      deviceId: "device-fresh",
      sessionToken: reg.json.token,
    });
    expect(res.status).toBe(200);
    expect(res.json.entitlements.sort()).toEqual(["pack_frost", "pack_gold"]);
  });
});
