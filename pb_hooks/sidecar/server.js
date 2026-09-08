"use strict";
/*
 * The store-verification sidecar — the Node HTTP front that Pocketbase's
 * storeVerify.js reaches over the internal network (option 1 in
 * docs/blockers.md). Zero dependencies, Node >= 18.
 *
 *   node pb_hooks/sidecar/server.js
 *
 * Routes
 *   GET  /healthz  → { ok, configured: { android, ios, web, identity: { google, apple } },
 *                       playPackage }
 *   POST /verify   body { platform: "android"|"ios"|"web", productId, token,
 *                           deviceId? }   (deviceId: web/Stripe device
 *                                          binding check — the session
 *                                          metadata's mdoomDeviceId must
 *                                          match it)
 *                  → 200 { valid: bool, reason?: string }
 *                    (a "not valid" verdict is a 200 with valid:false —
 *                     the Pocketbase side treats anything but valid:true
 *                     as a refusal and fails closed on its own too)
 *   POST /identity body { provider: "google"|"apple", idToken }
 *                  → 200 { valid, sub?, email?, emailVerified?, reason? }
 *                    (optional-login sign-in tokens; same 200-with-
 *                     valid:false convention)
 *   POST /stripe/webhook   (Stripe's checkout.session.completed delivery,
 *                          fronted by Caddy at the public Pocketbase URL)
 *                  → 200 { processed, … }  (Pocketbase's reply, passed
 *                    through verbatim)
 *                    Verifies Stripe-Signature (HMAC-SHA256, ±5 min
 *                    tolerance) against STRIPE_WEBHOOK_SECRET over the RAW
 *                    body, then forwards the untouched bytes to
 *                    $MDOOM_PB_URL/api/app/stripe/webhook with the
 *                    x-mdoom-key shared key. Unconfigured → 400, bad
 *                    signature → 400 (never forwarded, never minted).
 *
 * Env (container only — never in the repo; see pb_hooks/README.md)
 *   MDOOM_SIDECAR_PORT      default 8180
 *   MDOOM_SIDECAR_HOST      default 127.0.0.1
 *   MDOOM_SIDECAR_SECRET    optional; if set, /verify and /identity require
 *                           the same value in the `x-mdoom-key` header (the
 *                           Pocketbase container carries the same env)
 *   PLAY_SERVICE_ACCOUNT_JSON  Play SA JSON inline, or a path to the file
 *   PLAY_PACKAGE               default com.minus4kelvin.minesofdoom
 *   APPLE_BUNDLE_ID / APPLE_APP_ID / APPLE_KEY_ID
 *   APPLE_PRIVATE_KEY          P-256 PEM inline, or a path to the file
 *   APPLE_IAP_ENV              sandbox (default) | production
 *   STRIPE_SECRET_KEY          the sk_test_ / sk_live_ key — web Checkout
 *                              sessions are confirmed against the Stripe
 *                              API with it (empty → web verifies nothing)
 *   STRIPE_API_VERSION         optional pin (e.g. 2025-06-30.basil);
 *                              empty = Stripe's account default
 *   STRIPE_WEBHOOK_SECRET      the whsec_… from the Stripe webhook endpoint
 *                              (checkout.session.completed → /stripe/webhook
 *                              on THIS port; Caddy fronts the public URL).
 *                              Empty → /stripe/webhook refuses everything.
 *   MDOOM_STRIPE_PRICE_MAP    JSON { internalProductId: "price_…" } — the
 *                              server-side Price source for the browser
 *                              POST /stripe/checkout (hosted-session
 *                              creation). The client never supplies a
 *                              Price id. Empty/malformed → that route
 *                              refuses everything (fail closed).
 *   MDOOM_WEB_BASE_URL        https origin+base path of the deployed web
 *                              app (no trailing slash) — the hosted
 *                              page's success/cancel return URLs. Must be
 *                              https for /stripe/checkout to arm.
 *   MDOOM_PB_URL               internal Pocketbase base URL — after a valid
 *                              signature the event is forwarded verbatim to
 *                              Pocketbase's /api/app/stripe/webhook (which
 *                              mints, gated by the x-mdoom-key below).
 *                              Empty → /stripe/webhook refuses everything.
 *   GOOGLE_CLIENT_ID           the "Sign in with Google" OAuth client id
 *                              (audience for /identity google tokens)
 *   APPLE_BUNDLE_ID            also the audience for /identity apple tokens
 */

const http = require("http");
const crypto = require("crypto");
const {
  parseSidecarConfig,
  verifyPurchase,
  verifyIdentity,
  verifyStripeWebhookSignature,
  createStripeCheckoutSession,
} = require("./verify.js");

const TIMEOUT_MS = 15000;
const MAX_BODY_BYTES = 1024 * 1024;

function json(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function constantTimeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

// `fetch` (test injection point) overrides globalThis.fetch for the
// outbound calls — the route tests run inside the jest-expo preset,
// whose winter-fetch is not a real HTTP client.
function startServer({ env = process.env, listen = true, fetch: injectedFetch = null } = {}) {
  const cfg = parseSidecarConfig(env);
  const port = Number(env.MDOOM_SIDECAR_PORT || 8180);
  const host = env.MDOOM_SIDECAR_HOST || "127.0.0.1";
  const secret = String(env.MDOOM_SIDECAR_SECRET || "").trim();
  // Stripe webhook intake (docs/security-audit.md S2): the sidecar is the
  // only component that still holds the RAW body, so the Stripe-Signature
  // HMAC is verified here, and only then is the event forwarded to
  // Pocketbase. Both knobs must be set or the route refuses everything
  // (fail closed — a webhook that can't verify can't mint).
  const webhookSecret = String(env.STRIPE_WEBHOOK_SECRET || "").trim();
  const pbUrl = String(env.MDOOM_PB_URL || "").trim().replace(/\/+$/, "");
  // Browser-facing CORS. /stripe/checkout is the ONLY route the deployed web
  // app calls cross-origin (GH Pages origin → this sidecar); every other
  // route is server-to-server (Pocketbase, Stripe) and needs no CORS. The
  // allowed origin is the ORIGIN part (scheme+host) of MDOOM_WEB_BASE_URL —
  // the same env that arms the route, so an unconfigured sidecar allows NO
  // origin (fail closed, matching the route's own all-or-nothing rule).
  let webCorsOrigin = null;
  if (cfg.webBaseUrl) {
    try {
      webCorsOrigin = new URL(cfg.webBaseUrl).origin;
    } catch {
      webCorsOrigin = null; // malformed base URL → no origin allowed
    }
  }

  // fetch with a hard timeout; every external call dies at TIMEOUT_MS.
  const baseFetch = injectedFetch || globalThis.fetch;
  const fetchImpl = (url, init) =>
    baseFetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });

  async function handleVerify(req, res) {
    if (secret.length > 0) {
      const key = req.headers["x-mdoom-key"];
      if (typeof key !== "string" || !constantTimeEqual(key, secret)) {
        return json(res, 403, { error: "bad key" });
      }
    }
    let raw;
    try {
      raw = await readBody(req);
    } catch {
      return json(res, 400, { error: "body too large" });
    }
    let body;
    try {
      body = JSON.parse(raw || "{}");
    } catch {
      return json(res, 400, { error: "body must be JSON" });
    }
    const { platform, productId, token, deviceId } = body || {};
    if (
      typeof platform !== "string" ||
      (platform !== "android" && platform !== "ios" && platform !== "web")
    ) {
      return json(res, 400, { error: "invalid platform" });
    }
    if (typeof productId !== "string" || productId.length < 1 || productId.length > 128) {
      return json(res, 400, { error: "invalid productId" });
    }
    if (typeof token !== "string" || token.length < 1 || token.length > 16384) {
      return json(res, 400, { error: "invalid token" });
    }
    // Device binding (web/Stripe): the sidecar compares the session
    // metadata's mdoomDeviceId against this value. Absent/empty → no
    // binding check (the webhook path passes the metadata's own value).
    const deviceIdOk =
      typeof deviceId === "string" && deviceId.length > 0 && deviceId.length <= 64;
    const nowSec = Date.now() / 1000;
    let verdict;
    try {
      verdict = await verifyPurchase({
        platform,
        productId,
        token,
        deviceId: deviceIdOk ? deviceId : undefined,
        cfg,
        ctx: { fetch: fetchImpl, nowSec },
      });
    } catch (err) {
      // verifyPurchase never throws by contract; a 500 is the honest
      // fallback if it ever does (fail closed, never a mint).
      console.error("[sidecar] verify crashed:", err);
      verdict = { valid: false, reason: "internal error" };
    }
    if (!verdict.valid && verdict.reason) {
      console.warn(`[sidecar] verify REFUSED platform=${platform} product=${productId}: ${verdict.reason}`);
    }
    return json(res, 200, verdict);
  }

  async function handleIdentity(req, res) {
    if (secret.length > 0) {
      const key = req.headers["x-mdoom-key"];
      if (typeof key !== "string" || !constantTimeEqual(key, secret)) {
        return json(res, 403, { error: "bad key" });
      }
    }
    let raw;
    try {
      raw = await readBody(req);
    } catch {
      return json(res, 400, { error: "body too large" });
    }
    let body;
    try {
      body = JSON.parse(raw || "{}");
    } catch {
      return json(res, 400, { error: "body must be JSON" });
    }
    const { provider, idToken } = body || {};
    if (typeof provider !== "string" || (provider !== "google" && provider !== "apple")) {
      return json(res, 400, { error: "invalid provider" });
    }
    if (typeof idToken !== "string" || idToken.length < 1 || idToken.length > 16384) {
      return json(res, 400, { error: "invalid idToken" });
    }
    const nowSec = Date.now() / 1000;
    let verdict;
    try {
      verdict = await verifyIdentity({ provider, idToken, cfg, ctx: { fetch: fetchImpl, nowSec } });
    } catch (err) {
      // verifyIdentity never throws by contract; a 500 is the honest
      // fallback if it ever does (fail closed, never a sign-in).
      console.error("[sidecar] identity crashed:", err);
      verdict = { valid: false, reason: "internal error" };
    }
    if (!verdict.valid && verdict.reason) {
      console.warn(`[sidecar] identity REFUSED provider=${provider}: ${verdict.reason}`);
    }
    return json(res, 200, verdict);
  }

  async function handleStripeWebhook(req, res) {
    if (webhookSecret.length === 0 || pbUrl.length === 0) {
      return json(res, 400, { error: "webhook not configured" });
    }
    let raw;
    try {
      raw = await readBody(req);
    } catch {
      return json(res, 400, { error: "body too large" });
    }
    const verdict = verifyStripeWebhookSignature(
      webhookSecret,
      raw,
      req.headers["stripe-signature"],
      Date.now() / 1000,
    );
    if (!verdict.ok) {
      console.warn(`[sidecar] stripe webhook REFUSED: ${verdict.reason}`);
      return json(res, 400, { error: verdict.reason });
    }
    // The signature proves the body is exactly what Stripe sent, so the
    // raw bytes are forwarded untouched (re-serializing would only risk
    // a serialization drift) and trusted with the shared key —
    // Pocketbase's webhook handler mints only after its own sidecar
    // Stripe-API lookup.
    const headers = { "Content-Type": "application/json" };
    if (secret.length > 0) headers["x-mdoom-key"] = secret;
    let up;
    try {
      up = await fetchImpl(pbUrl + "/api/app/stripe/webhook", {
        method: "POST",
        headers: headers,
        body: raw,
      });
    } catch (err) {
      console.error("[sidecar] stripe webhook: Pocketbase unreachable:", err);
      return json(res, 502, { error: "pocketbase unreachable" });
    }
    const out = await up.json().catch(() => ({}));
    if (up.status >= 200 && up.status < 300) return json(res, 200, out);
    // 4xx from Pocketbase (e.g. a verify refusal) is terminal for THIS
    // event — pass it through so Stripe marks the delivery failed instead
    // of retrying a verdict that will not change. 5xx → retryable.
    if (up.status >= 400 && up.status < 500) return json(res, 400, out);
    console.warn(`[sidecar] stripe webhook: Pocketbase replied ${up.status}`);
    return json(res, 502, { error: "pocketbase error", upstream: up.status });
  }

  // The browser-facing checkout-creation route. The client posts its
  // device id + the internal product id; the server picks the Price from
  // its own map (the client never sees or supplies a Price id) and
  // returns the session id for stripe.redirectToCheckout({ sessionId }).
  // Unauthenticated by design: the caller is the public web app. It mints
  // nothing — the grant still requires a PAID session confirmed against
  // the Stripe API (the /stripe/webhook mint and the return-visit verify).
  async function handleStripeCheckout(req, res) {
    if (!cfg.stripe || !cfg.stripePriceMap || !cfg.webBaseUrl) {
      return json(res, 400, { error: "checkout not configured" });
    }
    let raw;
    try {
      raw = await readBody(req);
    } catch {
      return json(res, 400, { error: "body too large" });
    }
    let body;
    try {
      body = JSON.parse(raw || "{}");
    } catch {
      return json(res, 400, { error: "body must be JSON" });
    }
    const { deviceId, productId } = body || {};
    // deviceId feeds the session's device-binding metadata; productId is
    // an allowlist key into the server's price map. Both are echoed into
    // Stripe metadata, so keep them short and character-allowlisted.
    if (typeof deviceId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(deviceId)) {
      return json(res, 400, { error: "invalid deviceId" });
    }
    if (typeof productId !== "string" || !Object.prototype.hasOwnProperty.call(cfg.stripePriceMap, productId)) {
      return json(res, 400, { error: "invalid productId" });
    }
    let out;
    try {
      out = await createStripeCheckoutSession(
        cfg.stripe,
        cfg.stripePriceMap,
        cfg.webBaseUrl,
        productId,
        deviceId,
        { fetch: fetchImpl, nowSec: Date.now() / 1000 },
      );
    } catch (err) {
      console.error("[sidecar] stripe checkout crashed:", err);
      return json(res, 500, { error: "internal error" });
    }
    if (!out.ok) {
      console.warn(`[sidecar] stripe checkout REFUSED product=${productId}: ${out.reason}`);
      return json(res, 502, { error: out.reason });
    }
    return json(res, 200, { sessionId: out.sessionId });
  }

  const server = http.createServer(async (req, res) => {
    try {
      const url = (req.url || "/").split("?")[0];
      // CORS: answer the browser's preflight for a same-web-app origin and
      // stamp the allow-origin header on the real response. setHeader'd CORS
      // fields survive the later res.writeHead(...) in json(), which merges
      // rather than clears. A non-matching origin gets no CORS headers and
      // the request falls through to the normal (405 / auth) handling.
      const origin = req.headers["origin"];
      if (webCorsOrigin && typeof origin === "string" && origin === webCorsOrigin) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Vary", "Origin");
        res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        if (req.method === "OPTIONS") {
          res.setHeader("Access-Control-Max-Age", "86400");
          res.writeHead(204);
          return res.end();
        }
      }
      if (req.method === "GET" && url === "/healthz") {
        return json(res, 200, {
          ok: true,
          configured: {
            android: !!cfg.play,
            ios: !!cfg.apple,
            web: !!cfg.stripe,
            stripeCheckout: { priceMap: !!cfg.stripePriceMap, webBaseUrl: !!cfg.webBaseUrl },
            stripeWebhook: { signature: webhookSecret.length > 0, pocketbase: pbUrl.length > 0 },
            identity: { google: !!cfg.googleClientId, apple: !!cfg.appleBundleId },
          },
          playPackage: cfg.playPackage,
          appleEnv: cfg.apple ? cfg.apple.env : null,
        });
      }
      if (req.method === "POST" && url === "/verify") {
        return await handleVerify(req, res);
      }
      if (req.method === "POST" && url === "/identity") {
        return await handleIdentity(req, res);
      }
      if (req.method === "POST" && url === "/stripe/webhook") {
        return await handleStripeWebhook(req, res);
      }
      if (req.method === "POST" && url === "/stripe/checkout") {
        return await handleStripeCheckout(req, res);
      }
      return json(res, 405, { error: "not found" });
    } catch (err) {
      console.error("[sidecar] request failed:", err);
      if (!res.headersSent) json(res, 500, { error: "internal error" });
    }
  });

  if (listen) {
    server.listen(port, host);
    console.log(
      `[sidecar] listening on ${host}:${port} (android=${!!cfg.play} ios=${!!cfg.apple} ` +
        `stripe-webhook=${webhookSecret.length > 0 && pbUrl.length > 0 ? "on" : "off"} ` +
        `identity: google=${!!cfg.googleClientId} apple=${!!cfg.appleBundleId})`,
    );
  }
  return { server, cfg };
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer };
