/**
 * Tests for the sidecar's POST /stripe/webhook route (sidecar/server.js) —
 * the docs/security-audit.md S2 fix: Stripe's delivery lands on the
 * sidecar, the HMAC over the RAW body is verified here, and only a valid
 * event is forwarded (untouched, with the shared x-mdoom-key) to
 * Pocketbase's /api/app/stripe/webhook. Drives the real http server on an
 * ephemeral port against a scripted fake Pocketbase; everything is raw
 * node:http — the jest-expo preset's winter-fetch is not a real HTTP
 * client, so the test client AND the sidecar's outbound fetch are
 * node:http-backed (injected via startServer({ fetch })).
 */
const http = require("http");
const crypto = require("crypto");
const { startServer } = require("../sidecar/server");

const EVENT = JSON.stringify({
  id: "evt_1",
  type: "checkout.session.completed",
  data: { object: { id: "cs_test_abc", metadata: {} } },
});
const NOW = Date.now();

function sign(secret, payload, t) {
  return crypto.createHmac("sha256", secret).update(t + "." + payload).digest("hex");
}
const goodHeader = (secret) => `t=${Math.floor(NOW / 1000)},v1=${sign(secret, EVENT, Math.floor(NOW / 1000))}`;

/** node:http client → { status, json() }; the test-side fetch stand-in. */
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
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
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

/** A scripted Pocketbase: records the webhook call, replies per script. */
function fakePocketbase(reply, status = 200) {
  const received = [];
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      received.push({ url: req.url, method: req.method, headers: req.headers, body: Buffer.concat(chunks).toString("utf8") });
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(reply));
    });
  });
  return {
    server,
    received,
    start: () => new Promise((resolve) => server.listen(0, "127.0.0.1", resolve)),
    stop: () => new Promise((resolve) => server.close(resolve)),
    port: () => server.address().port,
  };
}

/** Sidecar on an ephemeral port + fake Pocketbase; fn({ base, pb }). */
async function withSidecar(env, fn, { pbReply = { processed: true }, pbStatus = 200 } = {}) {
  const pb = fakePocketbase(pbReply, pbStatus);
  await pb.start();
  // MDOOM_PB_URL: omitted → the fake Pocketbase; present (even "") → the
  // test's explicit value (the not-configured / unreachable cases).
  const pbEnv = { ...env };
  if (pbEnv.MDOOM_PB_URL === undefined) pbEnv.MDOOM_PB_URL = `http://127.0.0.1:${pb.port()}`;
  const { server } = startServer({ env: pbEnv, listen: false, fetch: httpRequest });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    return await fn({ base, pb });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await pb.stop();
  }
}

function post(base, headers, body = EVENT) {
  return httpRequest(`${base}/stripe/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body,
  });
}

describe("sidecar POST /stripe/webhook (S2)", () => {
  test("unconfigured (no secret) refuses and never forwards", async () => {
    await withSidecar({ MDOOM_SIDECAR_SECRET: "k", MDOOM_PB_URL: "" }, async ({ base, pb }) => {
      const res = await post(base, { "Stripe-Signature": goodHeader("s") });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "webhook not configured" });
      expect(pb.received).toHaveLength(0);
    });
  });

  test("an unconfigured MDOOM_PB_URL refuses", async () => {
    await withSidecar({ STRIPE_WEBHOOK_SECRET: "whsec_s", MDOOM_SIDECAR_SECRET: "k", MDOOM_PB_URL: "" }, async ({ base, pb }) => {
      const res = await post(base, { "Stripe-Signature": goodHeader("whsec_s") });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "webhook not configured" });
      expect(pb.received).toHaveLength(0);
    });
  });

  test("a bad signature is refused and never reaches Pocketbase", async () => {
    await withSidecar({ STRIPE_WEBHOOK_SECRET: "whsec_real", MDOOM_SIDECAR_SECRET: "k" }, async ({ base, pb }) => {
      const res = await post(base, { "Stripe-Signature": goodHeader("whsec_forger") });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "signature mismatch" });
      expect(pb.received).toHaveLength(0);
    });
  });

  test("a missing signature is refused and never reaches Pocketbase", async () => {
    await withSidecar({ STRIPE_WEBHOOK_SECRET: "whsec_real", MDOOM_SIDECAR_SECRET: "k" }, async ({ base, pb }) => {
      const res = await post(base, {});
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "missing Stripe-Signature header" });
      expect(pb.received).toHaveLength(0);
    });
  });

  test("a valid signature forwards the RAW body + x-mdoom-key and passes the reply through", async () => {
    await withSidecar({ STRIPE_WEBHOOK_SECRET: "whsec_real", MDOOM_SIDECAR_SECRET: "shared-key" }, async ({ base, pb }) => {
      const res = await post(base, { "Stripe-Signature": goodHeader("whsec_real") });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ processed: true });
      expect(pb.received).toHaveLength(1);
      const call = pb.received[0];
      expect(call.url).toBe("/api/app/stripe/webhook");
      expect(call.method).toBe("POST");
      expect(call.body).toBe(EVENT); // untouched bytes — re-serializing risks drift
      expect(call.headers["x-mdoom-key"]).toBe("shared-key");
    });
  });

  test("without a shared key the forward carries no x-mdoom-key", async () => {
    await withSidecar({ STRIPE_WEBHOOK_SECRET: "whsec_real" }, async ({ base, pb }) => {
      const res = await post(base, { "Stripe-Signature": goodHeader("whsec_real") });
      expect(res.status).toBe(200);
      expect(pb.received).toHaveLength(1);
      expect(pb.received[0].headers["x-mdoom-key"]).toBeUndefined();
    });
  });

  test("a Pocketbase 400 (e.g. verify refusal) is passed through as 400", async () => {
    await withSidecar(
      { STRIPE_WEBHOOK_SECRET: "whsec_real", MDOOM_SIDECAR_SECRET: "k" },
      async ({ base }) => {
        const res = await post(base, { "Stripe-Signature": goodHeader("whsec_real") });
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: "token verification failed" });
      },
      { pbReply: { error: "token verification failed" }, pbStatus: 400 },
    );
  });

  test("a Pocketbase 5xx becomes a 502 (retryable for Stripe)", async () => {
    await withSidecar(
      { STRIPE_WEBHOOK_SECRET: "whsec_real", MDOOM_SIDECAR_SECRET: "k" },
      async ({ base }) => {
        const res = await post(base, { "Stripe-Signature": goodHeader("whsec_real") });
        expect(res.status).toBe(502);
        expect((await res.json()).upstream).toBe(500);
      },
      { pbReply: { error: "boom" }, pbStatus: 500 },
    );
  });

  test("an unreachable Pocketbase is a 502", async () => {
    await withSidecar({ STRIPE_WEBHOOK_SECRET: "whsec_real", MDOOM_SIDECAR_SECRET: "k", MDOOM_PB_URL: "http://127.0.0.1:1" }, async ({ base }) => {
      const res = await post(base, { "Stripe-Signature": goodHeader("whsec_real") });
      expect(res.status).toBe(502);
    });
  });

  test("healthz reports the webhook configuration state", async () => {
    await withSidecar({ STRIPE_WEBHOOK_SECRET: "whsec_real", MDOOM_SIDECAR_SECRET: "k" }, async ({ base }) => {
      const res = await httpRequest(`${base}/healthz`);
      expect(res.status).toBe(200);
      expect((await res.json()).configured.stripeWebhook).toEqual({ signature: true, pocketbase: true });
    });
  });
});
