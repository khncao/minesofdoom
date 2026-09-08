/**
 * Tests for the sidecar's POST /stripe/checkout route (server.js) and the
 * pure createStripeCheckoutSession (verify.js) — the server-side hosted
 * Checkout Session creation the web client calls before
 * stripe.redirectToCheckout({ sessionId }).
 *
 * Why this route exists: Stripe's current redirectToCheckout validator
 * rejects the legacy client-side params (metadata, lineItems, …) with an
 * IntegrationError before the redirect, AND the session must carry the
 * metadata the mint paths gate on (mdoomDeviceId / mdoomProductId /
 * mdoomSession) — which only a secret-key holder can attach. The Price id
 * comes from the SERVER's MDOOM_STRIPE_PRICE_MAP, never the client.
 *
 * Everything is raw node:http + an injected fake Stripe API (the
 * jest-expo preset's winter-fetch is not a real HTTP client), mirroring
 * the /stripe/webhook route tests.
 */
const http = require("http");
const { startServer } = require("../sidecar/server");
const {
  parseSidecarConfig,
  createStripeCheckoutSession,
} = require("../sidecar/verify.js");

const STRIPE_URL = "https://api.stripe.com/v1/checkout/sessions";
const PRICE_MAP = JSON.stringify({
  packGold: "price_packGold",
  premium: "price_premium",
});
const WEB_BASE = "https://khncao.github.io/minesofdoom";
const ENV = {
  STRIPE_SECRET_KEY: "sk_test_123",
  MDOOM_STRIPE_PRICE_MAP: PRICE_MAP,
  MDOOM_WEB_BASE_URL: WEB_BASE,
};

// -- parseSidecarConfig ------------------------------------------------------

describe("parseSidecarConfig: stripe checkout knobs", () => {
  it("parses the price map and web base url", () => {
    const cfg = parseSidecarConfig(ENV);
    expect(cfg.stripePriceMap).toEqual({
      packGold: "price_packGold",
      premium: "price_premium",
    });
    expect(cfg.webBaseUrl).toBe(WEB_BASE);
  });

  it("strips a trailing slash from the web base url", () => {
    const cfg = parseSidecarConfig({
      ...ENV,
      MDOOM_WEB_BASE_URL: WEB_BASE + "/",
    });
    expect(cfg.webBaseUrl).toBe(WEB_BASE);
  });

  it("malformed JSON → no price map (route stays unconfigured)", () => {
    const cfg = parseSidecarConfig({
      ...ENV,
      MDOOM_STRIPE_PRICE_MAP: "{not json",
    });
    expect(cfg.stripePriceMap).toBeUndefined();
  });

  it("empty / non-object JSON → no price map", () => {
    expect(parseSidecarConfig({ ...ENV, MDOOM_STRIPE_PRICE_MAP: "{}" }).stripePriceMap).toBeUndefined();
    expect(parseSidecarConfig({ ...ENV, MDOOM_STRIPE_PRICE_MAP: "[1,2]" }).stripePriceMap).toBeUndefined();
    expect(parseSidecarConfig({ ...ENV, MDOOM_STRIPE_PRICE_MAP: '"x"' }).stripePriceMap).toBeUndefined();
  });

  it("drops non-string map entries", () => {
    const cfg = parseSidecarConfig({
      ...ENV,
      MDOOM_STRIPE_PRICE_MAP: JSON.stringify({ a: "price_a", b: 42, c: "" }),
    });
    expect(cfg.stripePriceMap).toEqual({ a: "price_a" });
  });
});

// -- createStripeCheckoutSession (pure) --------------------------------------

/** A scripted fake Stripe API; records the calls. */
function fakeStripe(reply = { id: "cs_test_999", object: "checkout.session" }, status = 200) {
  const calls = [];
  const fetch = async (url, init) => {
    const form =
      typeof init.body === "string" ? new URLSearchParams(init.body) : init.body;
    calls.push({ url, init, form });
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => reply,
    };
  };
  return { calls, fetch };
}

const CTX = { nowSec: Math.floor(Date.now() / 1000) };

describe("createStripeCheckoutSession (pure)", () => {
  it("creates the session with the SERVER's price + the mint-gating metadata", async () => {
    const fake = fakeStripe();
    const cfg = parseSidecarConfig(ENV);
    const out = await createStripeCheckoutSession(
      cfg.stripe,
      cfg.stripePriceMap,
      cfg.webBaseUrl,
      "packGold",
      "dev_testdevice",
      { ...CTX, fetch: fake.fetch },
    );
    expect(out.ok).toBe(true);
    expect(out.sessionId).toBe("cs_test_999");
    expect(out.mdoomSession).toMatch(/^[a-f0-9]{32}$/);

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0].url).toBe(STRIPE_URL);
    expect(fake.calls[0].init.headers.Authorization).toBe("Bearer sk_test_123");
    const form = fake.calls[0].form;
    expect(form.get("mode")).toBe("payment");
    expect(form.get("line_items[0][price]")).toBe("price_packGold");
    expect(form.get("line_items[0][quantity]")).toBe("1");
    expect(form.get("metadata[mdoomDeviceId]")).toBe("dev_testdevice");
    expect(form.get("metadata[mdoomProductId]")).toBe("packGold");
    expect(form.get("metadata[mdoomSession]")).toBe(out.mdoomSession);
    const successUrl = form.get("success_url");
    expect(successUrl).toContain(WEB_BASE + "?iap=success");
    expect(successUrl).toContain("iap_product=packGold");
    expect(successUrl).toContain("{CHECKOUT_SESSION_ID}");
    expect(form.get("cancel_url")).toBe(WEB_BASE + "?iap=cancel");
  });

  it("unknown product → refused (no Stripe call)", async () => {
    const fake = fakeStripe();
    const cfg = parseSidecarConfig(ENV);
    const out = await createStripeCheckoutSession(
      cfg.stripe,
      cfg.stripePriceMap,
      cfg.webBaseUrl,
      "nope",
      "dev_x",
      { ...CTX, fetch: fake.fetch },
    );
    expect(out.ok).toBe(false);
    expect(fake.calls).toHaveLength(0);
  });

  it("non-https web base → refused (open-redirect guard)", async () => {
    const fake = fakeStripe();
    const out = await createStripeCheckoutSession(
      { secretKey: "sk_test_123" },
      { packGold: "price_packGold" },
      "http://insecure.test",
      "packGold",
      "dev_x",
      { ...CTX, fetch: fake.fetch },
    );
    expect(out.ok).toBe(false);
    expect(fake.calls).toHaveLength(0);
  });

  it("missing stripe config → refused", async () => {
    const out = await createStripeCheckoutSession(
      null,
      { packGold: "price_packGold" },
      WEB_BASE,
      "packGold",
      "dev_x",
      { ...CTX, fetch: fakeStripe().fetch },
    );
    expect(out.ok).toBe(false);
  });

  it("Stripe 402 → refused (card declined at creation)", async () => {
    const fake = fakeStripe({ error: { message: "card error" } }, 402);
    const cfg = parseSidecarConfig(ENV);
    const out = await createStripeCheckoutSession(
      cfg.stripe,
      cfg.stripePriceMap,
      cfg.webBaseUrl,
      "packGold",
      "dev_x",
      { ...CTX, fetch: fake.fetch },
    );
    expect(out.ok).toBe(false);
    expect(out.reason).toContain("402");
  });

  it("fetch throws → refused, never throws", async () => {
    const cfg = parseSidecarConfig(ENV);
    const out = await createStripeCheckoutSession(
      cfg.stripe,
      cfg.stripePriceMap,
      cfg.webBaseUrl,
      "packGold",
      "dev_x",
      { ...CTX, fetch: async () => { throw new Error("net down"); } },
    );
    expect(out.ok).toBe(false);
  });
});

// -- the HTTP route ------------------------------------------------------------

function httpRequest(url, { method = "GET", headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const req = http.request(
      {
        hostname: target.hostname,
        port: target.port,
        path: target.pathname + target.search,
        method,
        headers,
        timeout: 5000,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          resolve({
            status: res.statusCode,
            headers: res.headers,
            json: async () => JSON.parse(text || "{}"),
          });
        });
      },
    );
    req.on("timeout", () => req.destroy(new Error("client timeout")));
    req.on("error", reject);
    if (body != null) req.write(body);
    req.end();
  });
}

async function withServer(env, stripeFetch) {
  const started = await new Promise((resolve) => {
    const { server, cfg } = startServer({ env, listen: false, fetch: stripeFetch });
    server.listen(0, "127.0.0.1", () => resolve({ server, cfg }));
  });
  const port = started.server.address().port;
  return {
    base: `http://127.0.0.1:${port}`,
    cfg: started.cfg,
    stop: () =>
      new Promise((resolve) => started.server.close(() => resolve())),
  };
}

describe("POST /stripe/checkout (route)", () => {
  it("returns the session id for a mapped product", async () => {
    const fake = fakeStripe({ id: "cs_test_route" });
    const s = await withServer(ENV, fake.fetch);
    const res = await httpRequest(`${s.base}/stripe/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: "dev_route", productId: "packGold" }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sessionId: "cs_test_route" });
    await s.stop();
  });

  it("400 on a product that is not in the map (no Stripe call)", async () => {
    const fake = fakeStripe();
    const s = await withServer(ENV, fake.fetch);
    const res = await httpRequest(`${s.base}/stripe/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: "dev_route", productId: "nope" }),
    });
    expect(res.status).toBe(400);
    expect(fake.calls).toHaveLength(0);
    await s.stop();
  });

  it("400 on a bad device id (allowlisted charset, bounded)", async () => {
    const fake = fakeStripe();
    const s = await withServer(ENV, fake.fetch);
    for (const deviceId of ["", "has space", "a".repeat(129), "semi;colon"]) {
      const res = await httpRequest(`${s.base}/stripe/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, productId: "packGold" }),
      });
      expect(res.status).toBe(400);
    }
    expect(fake.calls).toHaveLength(0);
    await s.stop();
  });

  it("400 on non-JSON body / missing fields", async () => {
    const fake = fakeStripe();
    const s = await withServer(ENV, fake.fetch);
    const bad = await httpRequest(`${s.base}/stripe/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    expect(bad.status).toBe(400);
    const missing = await httpRequest(`${s.base}/stripe/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: "packGold" }),
    });
    expect(missing.status).toBe(400);
    expect(fake.calls).toHaveLength(0);
    await s.stop();
  });

  it("502 when Stripe refuses (declined at creation)", async () => {
    const fake = fakeStripe({ error: { message: "declined" } }, 402);
    const s = await withServer(ENV, fake.fetch);
    const res = await httpRequest(`${s.base}/stripe/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: "dev_route", productId: "packGold" }),
    });
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(typeof body.error).toBe("string");
    await s.stop();
  });

  it("400 (fail closed) when the price map is not configured", async () => {
    const fake = fakeStripe();
    const s = await withServer(
      { STRIPE_SECRET_KEY: "sk_test_123", MDOOM_WEB_BASE_URL: WEB_BASE },
      fake.fetch,
    );
    const res = await httpRequest(`${s.base}/stripe/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: "dev_route", productId: "packGold" }),
    });
    expect(res.status).toBe(400);
    expect(fake.calls).toHaveLength(0);
    await s.stop();
  });

  it("healthz exposes the checkout config state", async () => {
    const fake = fakeStripe();
    const s = await withServer(ENV, fake.fetch);
    const res = await httpRequest(`${s.base}/healthz`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.configured.stripeCheckout).toEqual({
      priceMap: true,
      webBaseUrl: true,
    });
    await s.stop();
  });
});

// -- CORS (the browser calls /stripe/checkout cross-origin) -------------------

const WEB_ORIGIN = "https://khncao.github.io"; // origin of WEB_BASE

describe("POST /stripe/checkout (CORS)", () => {
  it("answers the preflight OPTIONS with 204 + the allow-origin header", async () => {
    const fake = fakeStripe();
    const s = await withServer(ENV, fake.fetch);
    const res = await httpRequest(`${s.base}/stripe/checkout`, {
      method: "OPTIONS",
      headers: { Origin: WEB_ORIGIN },
    });
    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe(WEB_ORIGIN);
    expect(res.headers["access-control-allow-methods"]).toContain("POST");
    // The allow-headers list is case-insensitive per spec; the server
    // stamps "Content-Type", so compare folded.
    expect(
      String(res.headers["access-control-allow-headers"]).toLowerCase(),
    ).toContain("content-type");
    expect(res.headers["vary"]).toContain("Origin");
    await s.stop();
  });

  it("stamps the allow-origin header on the real POST response", async () => {
    const fake = fakeStripe({ id: "cs_test_cors" });
    const s = await withServer(ENV, fake.fetch);
    const res = await httpRequest(`${s.base}/stripe/checkout`, {
      method: "POST",
      headers: { Origin: WEB_ORIGIN, "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: "dev_cors", productId: "packGold" }),
    });
    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBe(WEB_ORIGIN);
    expect((await res.json()).sessionId).toBe("cs_test_cors");
    await s.stop();
  });

  it("a foreign origin gets no allow-origin header (route still works)", async () => {
    const fake = fakeStripe({ id: "cs_test_other" });
    const s = await withServer(ENV, fake.fetch);
    const res = await httpRequest(`${s.base}/stripe/checkout`, {
      method: "POST",
      headers: { Origin: "https://evil.example", "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: "dev_cors", productId: "packGold" }),
    });
    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    await s.stop();
  });

  it("no web base url configured → no origin allowed (fail closed)", async () => {
    const fake = fakeStripe();
    const s = await withServer(
      { STRIPE_SECRET_KEY: "sk_test_123", MDOOM_STRIPE_PRICE_MAP: PRICE_MAP },
      fake.fetch,
    );
    const res = await httpRequest(`${s.base}/stripe/checkout`, {
      method: "OPTIONS",
      headers: { Origin: WEB_ORIGIN },
    });
    // webBaseUrl unset → webCorsOrigin null → the preflight is not answered
    // (it falls through to the 405 handler) and no allow-origin is emitted.
    expect(res.status).toBe(405);
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    await s.stop();
  });
});
