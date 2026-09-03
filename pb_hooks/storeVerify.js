"use strict";
/*
 * Server-side IAP receipt verification (both plans — the app bundle never
 * carries store credentials).
 *
 * MODES
 *   MDOOM_DEV_FAKE_TOKEN=1 (or "true"/"yes") → sandbox: mint for any
 *     non-empty token, no store call. This is the dev flag the
 *     pocketbase-plan "phase 2: sandbox" is verified against before any
 *     store credential exists.
 *
 *   default (production) → FAIL CLOSED.
 *
 * WHY NOT REAL STORE CALLS YET (blocker, see docs/blockers.md):
 *   Real verification needs a SERVER-TO-SERVER signed credential:
 *     - Play: a service-account OAuth token, which is an RS256-signed JWT
 *       (Google publishes JWKS; the assertion itself must be RSA-signed).
 *     - Apple: an App Store Connect JWT, ES256-signed (ECDSA P-256).
 *   PocketBase's JS hook runtime (goja) only exposes HMAC helpers
 *   ($security.*); it has no RSA/ECDSA signing. Until we either (a) put a
 *   tiny native sidecar in front of Pocketbase for the two store round
 *   trips, or (b) move the verify/restore endpoints to a runtime with real
 *   crypto, a store token can only be faked in sandbox — and minting on an
 *   unverified token in production is a direct money leak, so production
 *   mode refuses everything and logs.
 */
const FAKE_TOKEN_MODE = ["1", "true", "yes"].includes(
  String(process.env.MDOOM_DEV_FAKE_TOKEN || "").toLowerCase(),
);

function fakeTokenOk(token) {
  return typeof token === "string" && token.trim().length > 0;
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
  console.warn(
    `[pb_hooks] verify REFUSED (fail closed): platform=${platform} ` +
      `product=${productId} — real store verification is not wired yet ` +
      `(see docs/blockers.md "IAP verification needs RSA/ECDSA signing").`,
  );
  return false;
}

module.exports = {
  verifyPurchase,
  _fakeTokenOk: fakeTokenOk,
};
