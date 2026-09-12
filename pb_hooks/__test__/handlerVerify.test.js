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

const { makeApp, loadHandlers } = require("./fakeDatastore");

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
