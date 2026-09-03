"use strict";
/*
 * Store-side receipt verification — the "tiny sidecar" (docs/blockers.md
 * "IAP store-token verification needs RSA/ECDSA", option 1, chosen).
 *
 * Pocketbase's goja hook runtime can only sign HMAC, but Play's
 * service-account assertion needs RS256 and Apple's App Store Server JWT
 * needs ES256. This module runs in plain Node (>=18: global fetch,
 * AbortSignal.timeout), signs both JWTs with node:crypto, and calls the
 * two store APIs. Pocketbase reaches it over the internal network via
 * storeVerify.js ($http POST to MDOOM_SIDECAR_URL/verify) — the app
 * bundle still carries no store credentials.
 *
 * Play (Android): service-account JWT (RS256, jwt-bearer grant) → access
 * token → GET purchases/products/{sku}/tokens/{token}; purchaseState 0 is
 * the only minting verdict.
 *
 * Apple (iOS): App Store Server JWT (ES256, iss/sub = bundleId:appId) →
 * GET /inApps/v1/transactions/lookup/{transactionId}. The response only
 * carries Apple-signed JWS (`signedTransactionInfo`), so before trusting a
 * verdict the JWS is verified: signature against the x5c leaf, chain links
 * leaf→…→root, and the root must be one of the certs from
 * /oauth/certificates fetched moments before (same call). Only a payload
 * that matches (productId, environment, transactionId, reason = purchase,
 * not revoked, purchaseDate not in the future) mints.
 *
 * Every function here is pure w.r.t. the network: `ctx.fetch` is
 * injectable (the server passes the real one), so the whole flow is unit-
 * tested with scripted fetches — see pb_hooks/__test__/verifySidecar.test.js.
 */

const crypto = require("crypto");
const fs = require("fs");

const PLAY_TOKEN_URL = "https://oauth2.googleapis.com/token";
const PLAY_PUBLISHER_BASE =
  "https://androidpublisher.googleapis.com/androidpublisher/v3";
const PLAY_SCOPE = "https://www.googleapis.com/auth/androidpublisher";
const APPLE_BASE = {
  sandbox: "https://sandbox.storekit.itunes.apple.com",
  production: "https://api.storekit.itunes.apple.com",
};
const APPLE_AUD = "https://api.storekit.itunes.apple.com";
const APPLE_SCOPE = "storekit-app-store-server-api";
const APPLE_ENV_NAME = { sandbox: "Sandbox", production: "Production" };
// App Store Server API AppAuth bounds: 10 min is the documented sweet spot
// (max 15).
const APPLE_JWT_TTL_SEC = 600;
const PLAY_JWT_TTL_SEC = 3600;

function b64url(buf) {
  return Buffer.from(buf).toString("base64url");
}

/**
 * Sign a compact JWT. RSA key → RS256, EC key → ES256 (node:crypto emits
 * the DER signature ES256 mandates). Throws on an unusable key.
 */
function signJwt(header, claims, privateKeyPem) {
  const key = crypto.createPrivateKey(privateKeyPem);
  const signingInput =
    b64url(JSON.stringify(header)) + "." + b64url(JSON.stringify(claims));
  // Digest names (node:crypto): for EC keys this yields a DER signature,
  // which is what ES256 mandates.
  const algorithm = key.asymmetricKeyType === "ec" ? "SHA256" : "RSA-SHA256";
  const signature = crypto.sign(algorithm, Buffer.from(signingInput), key);
  return signingInput + "." + b64url(signature);
}

/** Split a compact JWT back into { header, claims, signature } (no verify). */
function decodeJwt(token) {
  const parts = String(token).split(".");
  if (parts.length !== 3) return null;
  try {
    return {
      header: JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")),
      claims: JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")),
      signature: Buffer.from(parts[2], "base64url"),
    };
  } catch {
    return null;
  }
}

// -- config ------------------------------------------------------------------

/**
 * Accepts an inline value, or a file path / `@path` (read as UTF-8). The
 * env values come from the container, never the repo.
 */
function readMaybeFile(v) {
  if (typeof v !== "string" || v.trim().length === 0) return null;
  const s = v.trim();
  const isPath =
    s.startsWith("@") ||
    s.startsWith("/") ||
    s.startsWith("\\") ||
    /^[A-Za-z]:[\\/]/.test(s);
  if (isPath) {
    try {
      return fs.readFileSync(s.startsWith("@") ? s.slice(1) : s, "utf8");
    } catch {
      return null;
    }
  }
  // Inline value: returned untouched (PEMs and JSON keep their form).
  return v;
}

/**
 * Container env → verification config. A platform that is missing (or
 * malformed) simply verifies nothing: verifyPurchase returns a
 * not-configured verdict for it, and the Pocketbase side fails closed.
 */
function parseSidecarConfig(env) {
  const e = env || {};
  const cfg = {
    play: null,
    playPackage: typeof e.PLAY_PACKAGE === "string" && e.PLAY_PACKAGE.length > 0
      ? e.PLAY_PACKAGE
      : "com.minus4kelvin.minesofdoom",
    apple: null,
  };
  const saRaw = readMaybeFile(e.PLAY_SERVICE_ACCOUNT_JSON);
  if (saRaw) {
    try {
      const sa = JSON.parse(saRaw);
      if (sa && typeof sa.client_email === "string" && typeof sa.private_key === "string") {
        cfg.play = sa;
      }
    } catch {
      /* malformed SA json → android stays unconfigured (fail closed) */
    }
  }
  const appleEnv = String(e.APPLE_IAP_ENV || "sandbox").toLowerCase();
  if (appleEnv === "sandbox" || appleEnv === "production") {
    const pem = readMaybeFile(e.APPLE_PRIVATE_KEY);
    if (
      typeof e.APPLE_BUNDLE_ID === "string" &&
      typeof e.APPLE_APP_ID === "string" &&
      typeof e.APPLE_KEY_ID === "string" &&
      pem &&
      pem.length > 0
    ) {
      cfg.apple = {
        bundleId: e.APPLE_BUNDLE_ID,
        appId: e.APPLE_APP_ID,
        keyId: e.APPLE_KEY_ID,
        privateKeyPem: pem,
        env: appleEnv,
      };
    }
  }
  return cfg;
}

// -- Play (Android) ------------------------------------------------------------

function buildPlayAssertion(serviceAccount, nowSec) {
  const iat = Math.floor(Number(nowSec) || Date.now() / 1000);
  return signJwt(
    { alg: "RS256", typ: "JWT" },
    {
      iss: serviceAccount.client_email,
      scope: PLAY_SCOPE,
      aud: PLAY_TOKEN_URL,
      iat,
      exp: iat + PLAY_JWT_TTL_SEC,
    },
    serviceAccount.private_key,
  );
}

/** Exchange the signed assertion for a short-lived access token. */
async function getPlayAccessToken(serviceAccount, ctx) {
  const assertion = buildPlayAssertion(serviceAccount, ctx.nowSec);
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });
  const res = await ctx.fetch(PLAY_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || typeof data.access_token !== "string") return null;
  return data.access_token;
}

/**
 * Play one-time-purchase verdict. The SKU is pinned in the URL, so
 * purchaseState === 0 is the minting condition; a populated productIds
 * list must agree with the requested SKU.
 */
async function verifyPlayPurchase(serviceAccount, packageId, productId, token, ctx) {
  const accessToken = await getPlayAccessToken(serviceAccount, ctx);
  if (!accessToken) return { valid: false, reason: "play token exchange failed" };
  const url =
    PLAY_PUBLISHER_BASE +
    "/applications/" + encodeURIComponent(packageId) +
    "/purchases/products/" + encodeURIComponent(productId) +
    "/tokens/" + encodeURIComponent(token) +
    "?access_token=" + encodeURIComponent(accessToken);
  const res = await ctx.fetch(url, { headers: { "Content-Type": "application/json" } });
  if (!res.ok) return { valid: false, reason: "play lookup " + res.status };
  const data = await res.json().catch(() => null);
  if (data && data.purchaseState === 0) {
    const ids = Array.isArray(data.productIds) ? data.productIds : [];
    if (ids.length === 0 || ids.includes(productId)) return { valid: true };
    return { valid: false, reason: "play productIds mismatch" };
  }
  return { valid: false, reason: "play purchaseState=" + (data ? data.purchaseState : "?") };
}

// -- Apple (iOS) ---------------------------------------------------------------

function buildAppleJwt(appleCfg, nowSec) {
  const iat = Math.floor((Number(nowSec) || Date.now()) / 1000);
  const issuer = appleCfg.bundleId + ":" + appleCfg.appId;
  return signJwt(
    { alg: "ES256", typ: "JWT", kid: appleCfg.keyId },
    {
      iss: issuer,
      sub: issuer,
      aud: APPLE_AUD,
      scope: APPLE_SCOPE,
      iat,
      exp: iat + APPLE_JWT_TTL_SEC,
    },
    appleCfg.privateKeyPem,
  );
}

/**
 * Verify one Apple JWS (`signedTransactionInfo`) against a cert chain.
 * rootCerts: X509Certificate[] from Apple's /oauth/certificates (fetched in
 * the same request cycle). Returns { ok, payload? | reason? }.
 */
function verifySignedTransactionInfo(signedInfo, rootCerts) {
  const parts = typeof signedInfo === "string" ? signedInfo.split(".") : null;
  if (!parts || parts.length !== 3) return { ok: false, reason: "malformed jws" };
  let header;
  let payload;
  try {
    header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "unparsable jws" };
  }
  if (header.alg !== "ES256" || !Array.isArray(header.x5c) || header.x5c.length < 1) {
    return { ok: false, reason: "bad jws header" };
  }
  const signature = Buffer.from(parts[2], "base64url");
  let chain;
  try {
    chain = header.x5c.map((b64) => new crypto.X509Certificate(Buffer.from(b64, "base64")));
  } catch {
    return { ok: false, reason: "bad x5c chain" };
  }
  // x5c order is leaf → … → root: check every link, then that the final
  // cert is one of Apple's published roots.
  for (let i = 0; i < chain.length - 1; i++) {
    if (!chain[i].verify(chain[i + 1].publicKey)) {
      return { ok: false, reason: "broken cert chain" };
    }
  }
  const rootSeen = chain[chain.length - 1];
  if (!rootCerts.some((c) => c.fingerprint256 === rootSeen.fingerprint256)) {
    return { ok: false, reason: "root not issued by Apple" };
  }
  const leaf = chain[0];
  // null algorithm → node picks ECDSA for the EC key; the signature is
  // DER (the ES256 encoding).
  const signatureOk = crypto.verify(
    null,
    Buffer.from(parts[0] + "." + parts[1]),
    { key: leaf.publicKey },
    signature,
  );
  if (!signatureOk) return { ok: false, reason: "bad jws signature" };
  return { ok: true, payload };
}

/**
 * App Store Server API transaction lookup. Only a transaction whose
 * Apple-signed payload matches this (transactionId, productId), this
 * deployment environment, is a plain purchase (reason 1), is unrevoked,
 * and is not dated in the future can mint.
 */
async function verifyApplePurchase(appleCfg, productId, transactionId, ctx) {
  const base = APPLE_BASE[appleCfg.env];
  const headers = {
    Authorization: "Bearer " + buildAppleJwt(appleCfg, ctx.nowSec),
    "Content-Type": "application/json",
  };
  const certRes = await ctx.fetch(base + "/oauth/certificates", { headers });
  if (!certRes.ok) return { valid: false, reason: "apple certs " + certRes.status };
  const certData = await certRes.json().catch(() => null);
  const contents = (certData && Array.isArray(certData.certificateContents))
    ? certData.certificateContents
    : [];
  let rootCerts;
  try {
    rootCerts = contents.map((b64) => new crypto.X509Certificate(Buffer.from(b64, "base64")));
  } catch {
    return { valid: false, reason: "apple certs unparsable" };
  }
  if (rootCerts.length === 0) return { valid: false, reason: "no apple certs" };

  const lookRes = await ctx.fetch(
    base + "/inApps/v1/transactions/lookup/" + encodeURIComponent(transactionId),
    { headers },
  );
  if (lookRes.status === 404) return { valid: false, reason: "transaction not found" };
  if (!lookRes.ok) return { valid: false, reason: "apple lookup " + lookRes.status };
  const lookData = await lookRes.json().catch(() => null);
  const infos = (lookData && Array.isArray(lookData.transactionInfo))
    ? lookData.transactionInfo
    : [];
  const expectedEnv = APPLE_ENV_NAME[appleCfg.env];
  for (const info of infos) {
    const v = verifySignedTransactionInfo(info && info.signedTransactionInfo, rootCerts);
    if (!v.ok) continue;
    const p = v.payload || {};
    if (String(p.transactionId) !== String(transactionId)) continue;
    if (p.productId !== productId) continue;
    if (p.environment !== expectedEnv) continue;
    if (p.transactionReason !== 1) continue; // 1 = purchase (not offer/refund/replacement)
    if (p.revocationDate != null) continue;
    if (typeof p.purchaseDate === "number" && p.purchaseDate > ctx.nowSec + 60) continue;
    return { valid: true };
  }
  return { valid: false, reason: "no matching transaction" };
}

// -- dispatcher ---------------------------------------------------------------

/**
 * Platform dispatch. `cfg` from parseSidecarConfig; `ctx` = { fetch,
 * nowSec }. Never throws — every failure path is a `valid: false` verdict.
 */
async function verifyPurchase({ platform, productId, token, cfg, ctx }) {
  const context = {
    fetch: ctx && ctx.fetch,
    nowSec: ctx && Number.isFinite(ctx.nowSec) ? ctx.nowSec : Date.now() / 1000,
  };
  try {
    if (platform === "android") {
      if (!cfg || !cfg.play) return { valid: false, reason: "android not configured" };
      return await verifyPlayPurchase(cfg.play, cfg.playPackage, productId, token, context);
    }
    if (platform === "ios") {
      if (!cfg || !cfg.apple) return { valid: false, reason: "ios not configured" };
      if (!/^\d{1,32}$/.test(String(token))) {
        return { valid: false, reason: "ios token is not a transaction id" };
      }
      return await verifyApplePurchase(cfg.apple, productId, token, context);
    }
    return { valid: false, reason: "unknown platform" };
  } catch (err) {
    return { valid: false, reason: String(err && err.message || err) };
  }
}

module.exports = {
  PLAY_TOKEN_URL,
  PLAY_PUBLISHER_BASE,
  APPLE_BASE,
  APPLE_AUD,
  APPLE_SCOPE,
  b64url,
  signJwt,
  decodeJwt,
  readMaybeFile,
  parseSidecarConfig,
  buildPlayAssertion,
  getPlayAccessToken,
  verifyPlayPurchase,
  buildAppleJwt,
  verifySignedTransactionInfo,
  verifyApplePurchase,
  verifyPurchase,
};
