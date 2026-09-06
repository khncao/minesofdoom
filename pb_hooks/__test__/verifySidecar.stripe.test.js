/**
 * Unit tests for the sidecar's Stripe (web IAP) verification —
 * verifyStripeCheckout + the platform="web" dispatch in verifyPurchase.
 * Same scripted-fetch pattern as verifySidecar.test.js: all Stripe API
 * traffic is injected; nothing reaches the network.
 */
const S = require("../sidecar/verify");

const STRIPE = { secretKey: "sk_test_abc123", apiVersion: "2025-06-30.basil" };
const NOW_SEC = 1700000000;
const SESSION_ID = "cs_test_abc1234567890";
const PRODUCT_ID = "packGold";

function respond(obj, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => obj };
}

function scriptedFetch(routes) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    for (const route of routes) {
      if (route.match.test(url)) {
        if (typeof route.reply === "function") return route.reply(url, init);
        return respond(route.reply);
      }
    }
    throw new Error("no route for " + url);
  };
  return { fetchImpl, calls };
}

function session(paid, { productId = PRODUCT_ID, deviceId = "device-1" } = {}) {
  return {
    object: "checkout.session",
    id: SESSION_ID,
    payment_status: paid ? "paid" : "unpaid",
    metadata: {
      mdoomProductId: productId,
      mdoomDeviceId: deviceId,
      mdoomSession: "sess_1",
    },
  };
}

describe("verifyStripeCheckout (sidecar, platform=web)", () => {
  test("a paid session for the same product+device mints", async () => {
    const { fetchImpl } = scriptedFetch([
      { match: /\/checkout\/sessions\//, reply: session(true) },
    ]);
    const verdict = await S.verifyStripeCheckout(
      STRIPE,
      PRODUCT_ID,
      SESSION_ID,
      "device-1",
      { fetch: fetchImpl, nowSec: NOW_SEC },
    );
    expect(verdict).toEqual({ valid: true });
  });

  test("authenticates with the secret key and pins the API version", async () => {
    const { fetchImpl, calls } = scriptedFetch([
      { match: /\/checkout\/sessions\//, reply: session(true) },
    ]);
    await S.verifyStripeCheckout(
      STRIPE,
      PRODUCT_ID,
      SESSION_ID,
      "device-1",
      { fetch: fetchImpl, nowSec: NOW_SEC },
    );
    expect(calls[0].url).toBe(
      "https://api.stripe.com/v1/checkout/sessions/" + SESSION_ID,
    );
    expect(calls[0].init.headers.Authorization).toBe(
      "Bearer " + STRIPE.secretKey,
    );
    expect(calls[0].init.headers["Stripe-Version"]).toBe(STRIPE.apiVersion);
  });

  test("no Stripe-Version header when the version is unpinned", async () => {
    const { fetchImpl, calls } = scriptedFetch([
      { match: /\/checkout\/sessions\//, reply: session(true) },
    ]);
    await S.verifyStripeCheckout(
      { secretKey: STRIPE.secretKey, apiVersion: null },
      PRODUCT_ID,
      SESSION_ID,
      "device-1",
      { fetch: fetchImpl, nowSec: NOW_SEC },
    );
    expect(calls[0].init.headers["Stripe-Version"]).toBeUndefined();
  });

  test("an unpaid session refuses", async () => {
    const { fetchImpl } = scriptedFetch([
      { match: /\/checkout\/sessions\//, reply: session(false) },
    ]);
    const verdict = await S.verifyStripeCheckout(
      STRIPE,
      PRODUCT_ID,
      SESSION_ID,
      "device-1",
      { fetch: fetchImpl, nowSec: NOW_SEC },
    );
    expect(verdict.valid).toBe(false);
    expect(verdict.reason).toMatch(/not paid/);
  });

  test("a missing session (404) refuses", async () => {
    const { fetchImpl } = scriptedFetch([
      {
        match: /\/checkout\/sessions\//,
        reply: { error: { message: "No such checkout session" } },
        status: 404,
      },
    ]);
    const verdict = await S.verifyStripeCheckout(
      STRIPE,
      PRODUCT_ID,
      SESSION_ID,
      "device-1",
      { fetch: fetchImpl, nowSec: NOW_SEC },
    );
    expect(verdict.valid).toBe(false);
    expect(verdict.reason).toMatch(/not found/);
  });

  test("a non-json reply refuses", async () => {
    const { fetchImpl } = scriptedFetch([
      { match: /\/checkout\/sessions\//, reply: () => ({ ok: true, status: 200, json: async () => { throw new Error("boom"); } }) },
    ]);
    const verdict = await S.verifyStripeCheckout(
      STRIPE,
      PRODUCT_ID,
      SESSION_ID,
      "device-1",
      { fetch: fetchImpl, nowSec: NOW_SEC },
    );
    expect(verdict.valid).toBe(false);
  });

  test("a product mismatch refuses (session bought something else)", async () => {
    const { fetchImpl } = scriptedFetch([
      { match: /\/checkout\/sessions\//, reply: session(true, { productId: "packSilver" }) },
    ]);
    const verdict = await S.verifyStripeCheckout(
      STRIPE,
      PRODUCT_ID,
      SESSION_ID,
      "device-1",
      { fetch: fetchImpl, nowSec: NOW_SEC },
    );
    expect(verdict.valid).toBe(false);
    expect(verdict.reason).toMatch(/product mismatch/);
  });

  test("a device mismatch refuses (session id copied to another device)", async () => {
    const { fetchImpl } = scriptedFetch([
      { match: /\/checkout\/sessions\//, reply: session(true, { deviceId: "other-device" }) },
    ]);
    const verdict = await S.verifyStripeCheckout(
      STRIPE,
      PRODUCT_ID,
      SESSION_ID,
      "device-1",
      { fetch: fetchImpl, nowSec: NOW_SEC },
    );
    expect(verdict.valid).toBe(false);
    expect(verdict.reason).toMatch(/device mismatch/);
  });

  test("an empty deviceId skips the binding check (webhook passes its own)", async () => {
    const { fetchImpl } = scriptedFetch([
      { match: /\/checkout\/sessions\//, reply: session(true, { deviceId: "whoever" }) },
    ]);
    const verdict = await S.verifyStripeCheckout(
      STRIPE,
      PRODUCT_ID,
      SESSION_ID,
      undefined,
      { fetch: fetchImpl, nowSec: NOW_SEC },
    );
    expect(verdict).toEqual({ valid: true });
  });

  test("a malformed session id refuses without any network call", async () => {
    const { fetchImpl, calls } = scriptedFetch([]);
    const verdict = await S.verifyStripeCheckout(
      STRIPE,
      PRODUCT_ID,
      "short",
      "device-1",
      { fetch: fetchImpl, nowSec: NOW_SEC },
    );
    expect(verdict.valid).toBe(false);
    expect(calls).toEqual([]);
  });

  test("no fetch in the context refuses", async () => {
    const verdict = await S.verifyStripeCheckout(
      STRIPE,
      PRODUCT_ID,
      SESSION_ID,
      "device-1",
      { fetch: null, nowSec: NOW_SEC },
    );
    expect(verdict.valid).toBe(false);
  });
});

describe("verifyPurchase platform=web dispatch", () => {
  test("an unconfigured sidecar refuses web (fail closed)", async () => {
    const verdict = await S.verifyPurchase({
      platform: "web",
      productId: PRODUCT_ID,
      token: SESSION_ID,
      deviceId: "device-1",
      cfg: {},
      ctx: { fetch: null, nowSec: NOW_SEC },
    });
    expect(verdict).toEqual({ valid: false, reason: "web not configured" });
  });

  test("the web dispatch reaches the Stripe lookup with the device id", async () => {
    const { fetchImpl } = scriptedFetch([
      { match: /\/checkout\/sessions\//, reply: session(true) },
    ]);
    const verdict = await S.verifyPurchase({
      platform: "web",
      productId: PRODUCT_ID,
      token: SESSION_ID,
      deviceId: "device-1",
      cfg: { stripe: STRIPE },
      ctx: { fetch: fetchImpl, nowSec: NOW_SEC },
    });
    expect(verdict).toEqual({ valid: true });
  });
});

describe("parseSidecarConfig Stripe block", () => {
  test("reads the key and the optional version pin", () => {
    const cfg = S.parseSidecarConfig({
      STRIPE_SECRET_KEY: "  sk_test_abc  ",
      STRIPE_API_VERSION: "2025-06-30.basil",
    });
    expect(cfg.stripe).toEqual({
      secretKey: "sk_test_abc",
      apiVersion: "2025-06-30.basil",
    });
  });

  test("an empty key leaves cfg.stripe absent", () => {
    const cfg = S.parseSidecarConfig({ STRIPE_SECRET_KEY: "   " });
    expect(cfg.stripe).toBeUndefined();
  });

  test("an empty version means unpinned", () => {
    const cfg = S.parseSidecarConfig({ STRIPE_SECRET_KEY: "sk_test_abc" });
    expect(cfg.stripe.apiVersion).toBeNull();
  });
});
