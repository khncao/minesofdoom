"use strict";
/*
 * The store-verification sidecar — the Node HTTP front that Pocketbase's
 * storeVerify.js reaches over the internal network (option 1 in
 * docs/blockers.md). Zero dependencies, Node >= 18.
 *
 *   node pb_hooks/sidecar/server.js
 *
 * Routes
 *   GET  /healthz  → { ok, configured: { android, ios }, playPackage }
 *   POST /verify   body { platform, productId, token }
 *                  → 200 { valid: bool, reason?: string }
 *                    (a "not valid" verdict is a 200 with valid:false —
 *                     the Pocketbase side treats anything but valid:true
 *                     as a refusal and fails closed on its own too)
 *
 * Env (container only — never in the repo; see pb_hooks/README.md)
 *   MDOOM_SIDECAR_PORT      default 8180
 *   MDOOM_SIDECAR_HOST      default 127.0.0.1
 *   MDOOM_SIDECAR_SECRET    optional; if set, /verify requires the same
 *                           value in the `x-mdoom-key` header (the
 *                           Pocketbase container carries the same env)
 *   PLAY_SERVICE_ACCOUNT_JSON  Play SA JSON inline, or a path to the file
 *   PLAY_PACKAGE               default com.minus4kelvin.minesofdoom
 *   APPLE_BUNDLE_ID / APPLE_APP_ID / APPLE_KEY_ID
 *   APPLE_PRIVATE_KEY          P-256 PEM inline, or a path to the file
 *   APPLE_IAP_ENV              sandbox (default) | production
 */

const http = require("http");
const crypto = require("crypto");
const { parseSidecarConfig, verifyPurchase } = require("./verify.js");

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

function startServer({ env = process.env, listen = true } = {}) {
  const cfg = parseSidecarConfig(env);
  const port = Number(env.MDOOM_SIDECAR_PORT || 8180);
  const host = env.MDOOM_SIDECAR_HOST || "127.0.0.1";
  const secret = String(env.MDOOM_SIDECAR_SECRET || "").trim();

  // fetch with a hard timeout; every external call dies at TIMEOUT_MS.
  const fetchImpl = (url, init) =>
    globalThis.fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });

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
    const { platform, productId, token } = body || {};
    if (typeof platform !== "string" || (platform !== "android" && platform !== "ios")) {
      return json(res, 400, { error: "invalid platform" });
    }
    if (typeof productId !== "string" || productId.length < 1 || productId.length > 128) {
      return json(res, 400, { error: "invalid productId" });
    }
    if (typeof token !== "string" || token.length < 1 || token.length > 16384) {
      return json(res, 400, { error: "invalid token" });
    }
    const nowSec = Date.now() / 1000;
    let verdict;
    try {
      verdict = await verifyPurchase({ platform, productId, token, cfg, ctx: { fetch: fetchImpl, nowSec } });
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

  const server = http.createServer(async (req, res) => {
    try {
      const url = (req.url || "/").split("?")[0];
      if (req.method === "GET" && url === "/healthz") {
        return json(res, 200, {
          ok: true,
          configured: { android: !!cfg.play, ios: !!cfg.apple },
          playPackage: cfg.playPackage,
          appleEnv: cfg.apple ? cfg.apple.env : null,
        });
      }
      if (req.method === "POST" && url === "/verify") {
        return await handleVerify(req, res);
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
      `[sidecar] listening on ${host}:${port} (android=${!!cfg.play} ios=${!!cfg.apple})`,
    );
  }
  return { server, cfg };
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer };
