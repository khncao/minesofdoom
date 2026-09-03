"use strict";
/*
 * Server-side IAP receipt verification (both plans — the app bundle never
 * carries store credentials).
 *
 * MODES (first match wins)
 *   1. MDOOM_DEV_FAKE_TOKEN=1 (or "true"/"yes") → sandbox: mint for any
 *      non-empty token, no store call. This is the dev flag the
 *      pocketbase-plan "phase 2: sandbox" is verified against before any
 *      store credential exists.
 *   2. MDOOM_SIDECAR_URL set → production path: the Pocketbase hook POSTs
 *      to the store-verification sidecar (pb_hooks/sidecar/), which signs
 *      the RS256/ES256 JWTs the goja runtime can't and talks to Play /
 *      Apple. Only `valid: true` from the sidecar mints.
 *   3. default → FAIL CLOSED: refuse and log. Minting on an unverified
 *      token in production is a direct money leak.
 *
 * The sidecar call goes through $http (synchronous in the v0.4x handler
 * runtime — same requirement as the datastore calls). $http contract
 * (pinned by probing the v0.40.2 sandbox, see pb_hooks/README.md):
 *   $http.send(opts)  with  opts = { url, method, headers, body: string }
 *   → { statusCode: number, json: parsed, raw: string, ... }
 * The request body must be a JSON STRING (an object body arrives as {});
 * `json` on the reply is the parsed body. The reply is still read
 * defensively (json accessor, then raw fallback) so a future $http reshuffle
 * degrades to a refusal, not a mint.
 */
const FAKE_TOKEN_MODE = ["1", "true", "yes"].includes(
  String(process.env.MDOOM_DEV_FAKE_TOKEN || "").toLowerCase(),
);

function fakeTokenOk(token) {
  return typeof token === "string" && token.trim().length > 0;
}

/** Configured sidecar base URL (no trailing slash), or "". */
function sidecarBaseUrl() {
  return String(process.env.MDOOM_SIDECAR_URL || "").trim().replace(/\/+$/, "");
}

/**
 * Ask the sidecar. Returns true only for a 2xx { valid: true }; every
 * other outcome (no $http, transport error, bad reply, 5xx) is false.
 * Never throws.
 */
function sidecarVerify(platform, productId, token) {
  const base = sidecarBaseUrl();
  if (base.length === 0) return false;
  const http = globalThis.$http;
  if (!http || typeof http.send !== "function") {
    console.warn("[pb_hooks] $http unavailable — verify REFUSED (fail closed).");
    return false;
  }
  const headers = { "Content-Type": "application/json" };
  const secret = String(process.env.MDOOM_SIDECAR_SECRET || "").trim();
  if (secret.length > 0) headers["x-mdoom-key"] = secret;
  let res;
  try {
    res = http.send({
      url: base + "/verify",
      method: "POST",
      headers: headers,
      body: JSON.stringify({ platform: platform, productId: productId, token: token }),
    });
  } catch (err) {
    console.warn("[pb_hooks] sidecar call failed: " + err + " — REFUSED.");
    return false;
  }
  const status = Number(res && res.statusCode);
  if (!(status >= 200 && status < 300)) {
    console.warn("[pb_hooks] sidecar replied " + status + " — REFUSED.");
    return false;
  }
  // Reply: the $http wrapper already parses the JSON body into `json`;
  // fall back to `raw` (and a string `json`) in case of a reshuffle.
  let parsed = res && res.json;
  if (typeof parsed === "string" && parsed.length > 0) {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      console.warn("[pb_hooks] sidecar reply is not JSON — REFUSED.");
      return false;
    }
  }
  if (parsed == null && typeof res.raw === "string" && res.raw.length > 0) {
    try {
      parsed = JSON.parse(res.raw);
    } catch {
      console.warn("[pb_hooks] sidecar reply is not JSON — REFUSED.");
      return false;
    }
  }
  if (parsed && parsed.valid === true) return true;
  console.warn(
    "[pb_hooks] sidecar verdict valid=false" +
      (parsed && parsed.reason ? " (" + parsed.reason + ")" : "") +
      " — REFUSED.",
  );
  return false;
}

/**
 * Verifies a store receipt token for (platform, productId). Returns a
 * bool. Never throws.
 *
 * @param {string} platform   "android" | "ios"
 * @param {string} productId  internal product id (allow-listed upstream)
 * @param {string} token      store purchase token from the client
 */
function verifyPurchase(platform, productId, token) {
  if (FAKE_TOKEN_MODE) return fakeTokenOk(token);
  if (sidecarBaseUrl().length === 0) {
    console.warn(
      `[pb_hooks] verify REFUSED (fail closed): platform=${platform} ` +
        `product=${productId} — MDOOM_SIDECAR_URL is not configured. ` +
        `See pb_hooks/README.md (sidecar) and docs/blockers.md.`,
    );
    return false;
  }
  return sidecarVerify(platform, productId, token);
}

module.exports = {
  verifyPurchase,
  _fakeTokenOk: fakeTokenOk,
  _sidecarVerify: sidecarVerify,
  _sidecarBaseUrl: sidecarBaseUrl,
};
