"use strict";
/*
 * Server-side IDENTITY verification for optional login (Google / Apple
 * sign-in). Same fail-closed philosophy as storeVerify.js — a sign-in is
 * only accepted on a verified provider token, because an unverified
 * sign-in would be an account takeover (the token links the caller's
 * device rows to the victim's account).
 *
 * MODES (first match wins)
 *   1. MDOOM_DEV_FAKE_TOKEN=1 (or "true"/"yes") → sandbox: the token must
 *      be a compact JWT whose PAYLOAD is trusted WITHOUT signature
 *      (sub is required; email optional). Dev builds mint such a token
 *      locally — no Google/Apple account needed. NEVER mint on a real
 *      deployment.
 *   2. MDOOM_SIDECAR_URL set → production path: the Pocketbase hook POSTs
 *      to the identity sidecar (pb_hooks/sidecar/ /identity), which
 *      verifies the RS256 (Google) / ES256 (Apple) JWTs the goja runtime
 *      can't and fetches the provider's published keys. Only `valid: true`
 *      with a `sub` is accepted.
 *   3. default → FAIL CLOSED: refuse and log.
 *
 * The $http contract is the same pinned one storeVerify.js uses
 * (see pb_hooks/README.md): $http.send(opts) -> { statusCode, json, raw },
 * body must be a JSON STRING.
 */
const FAKE_TOKEN_MODE = ["1", "true", "yes"].includes(
  String(process.env.MDOOM_DEV_FAKE_TOKEN || "").toLowerCase(),
);

function sidecarBaseUrl() {
  return String(process.env.MDOOM_SIDECAR_URL || "").trim().replace(/\/+$/, "");
}

/**
 * Minimal base64url → UTF-8 string decoder (pure JS — the goja runtime
 * has no Buffer and atob is not guaranteed; node tests run the same
 * code path, so the fake-mode claim decode is exercised in jest).
 */
const B64_TABLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function b64urlToUtf8(input) {
  let b64 = String(input).replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4 !== 0) b64 += "=";
  // bytes as a binary string
  let bin = "";
  for (let i = 0; i < b64.length; i += 4) {
    const c = [b64.charAt(i), b64.charAt(i + 1), b64.charAt(i + 2), b64.charAt(i + 3)];
    for (const ch of c) {
      if (ch !== "=" && B64_TABLE.indexOf(ch) < 0) throw new Error("bad base64");
    }
    const e1 = B64_TABLE.indexOf(c[0]);
    const e2 = B64_TABLE.indexOf(c[1]);
    const e3 = c[2] === "=" ? -1 : B64_TABLE.indexOf(c[2]);
    const e4 = c[3] === "=" ? -1 : B64_TABLE.indexOf(c[3]);
    const b = [
      (e1 << 2) | (e2 >> 4),
      e3 < 0 ? null : ((e2 & 15) << 4) | (e3 >> 2),
      e4 < 0 ? null : ((e3 & 3) << 6) | e4,
    ];
    for (const byte of b) {
      if (byte !== null) bin += String.fromCharCode(byte);
    }
  }
  // UTF-8 decode the binary string
  let out = "";
  for (let i = 0; i < bin.length; i++) {
    let c = bin.charCodeAt(i);
    if (c < 0x80) {
      out += String.fromCharCode(c);
    } else if (c < 0xe0) {
      const c2 = bin.charCodeAt(i + 1);
      out += String.fromCharCode(((c & 0x1f) << 6) | (c2 & 0x3f));
      i++;
    } else if (c < 0xf0) {
      const c2 = bin.charCodeAt(i + 1);
      const c3 = bin.charCodeAt(i + 2);
      out += String.fromCharCode(((c & 0xf) << 12) | ((c2 & 0x3f) << 6) | (c3 & 0x3f));
      i += 2;
    } else {
      const c2 = bin.charCodeAt(i + 1);
      const c3 = bin.charCodeAt(i + 2);
      const c4 = bin.charCodeAt(i + 3);
      // fromCharCode clamps above 0xFFFF — split the code point into a
      // surrogate pair explicitly.
      const cp = ((c & 7) << 18) | ((c2 & 0x3f) << 12) | ((c3 & 0x3f) << 6) | (c4 & 0x3f);
      out +=
        String.fromCharCode(0xd800 + ((cp - 0x10000) >> 10), 0xdc00 + ((cp - 0x10000) & 0x3ff));
      i += 3;
    }
  }
  return out;
}

/** Decode a compact JWT payload without verifying the signature. */
function decodeJwtPayload(token) {
  const parts = String(token).split(".");
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(b64urlToUtf8(parts[1]));
  } catch {
    return null;
  }
}

/** Fake-mode verdict: trust the payload claims (sandbox only). */
function fakeIdentity(provider, idToken) {
  if (provider !== "google" && provider !== "apple") return null;
  const claims = decodeJwtPayload(idToken);
  if (claims == null || typeof claims !== "object") return null;
  if (typeof claims.sub !== "string" || !/^[A-Za-z0-9._|:-]{1,256}$/.test(claims.sub)) {
    return null;
  }
  return {
    valid: true,
    sub: claims.sub,
    email: typeof claims.email === "string" ? claims.email : "",
    emailVerified: true, // fake mode: the payload is trusted as-is
  };
}

/**
 * Ask the sidecar. Returns the verdict object { valid, sub, email,
 * emailVerified } or null — every failure path is a refusal.
 */
function sidecarIdentity(provider, idToken) {
  const base = sidecarBaseUrl();
  if (base.length === 0) return null;
  const http = globalThis.$http;
  if (!http || typeof http.send !== "function") {
    console.warn("[pb_hooks] $http unavailable — identity sign-in REFUSED (fail closed).");
    return null;
  }
  const headers = { "Content-Type": "application/json" };
  const secret = String(process.env.MDOOM_SIDECAR_SECRET || "").trim();
  if (secret.length > 0) headers["x-mdoom-key"] = secret;
  let res;
  try {
    res = http.send({
      url: base + "/identity",
      method: "POST",
      headers: headers,
      body: JSON.stringify({ provider: provider, idToken: idToken }),
    });
  } catch (err) {
    console.warn("[pb_hooks] sidecar identity call failed: " + err + " — REFUSED.");
    return null;
  }
  const status = Number(res && res.statusCode);
  if (!(status >= 200 && status < 300)) {
    console.warn("[pb_hooks] sidecar identity replied " + status + " — REFUSED.");
    return null;
  }
  let parsed = res && res.json;
  if (typeof parsed === "string" && parsed.length > 0) {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      parsed = null;
    }
  }
  if (parsed == null && typeof res.raw === "string" && res.raw.length > 0) {
    try {
      parsed = JSON.parse(res.raw);
    } catch {
      parsed = null;
    }
  }
  if (parsed && parsed.valid === true && typeof parsed.sub === "string" && parsed.sub.length >= 1) {
    return parsed;
  }
  console.warn(
    "[pb_hooks] sidecar identity verdict invalid" +
      (parsed && parsed.reason ? " (" + parsed.reason + ")" : "") +
      " — REFUSED.",
  );
  return null;
}

/**
 * Verify a provider id token for optional login.
 *
 * @param {string} provider "google" | "apple"
 * @param {string} idToken  the compact JWT from the client SDK
 * @returns {null | { valid: true, sub: string, email: string,
 *                    emailVerified: boolean }}
 *   null = refusal (the handler answers 401). Never throws.
 */
function verifyIdentity(provider, idToken) {
  if (typeof idToken !== "string" || idToken.length < 1 || idToken.length > 16384) {
    return null;
  }
  if (provider !== "google" && provider !== "apple") return null;
  if (FAKE_TOKEN_MODE) return fakeIdentity(provider, idToken);
  if (sidecarBaseUrl().length === 0) {
    console.warn(
      "[pb_hooks] identity sign-in REFUSED (fail closed): provider=" +
        provider +
        " — MDOOM_SIDECAR_URL is not configured. See pb_hooks/README.md " +
        "(sidecar /identity) and docs/blockers.md.",
    );
    return null;
  }
  return sidecarIdentity(provider, idToken);
}

module.exports = {
  verifyIdentity,
  _fakeIdentity: fakeIdentity,
  _decodeJwtPayload: decodeJwtPayload,
  _b64urlToUtf8: b64urlToUtf8,
  _sidecarIdentity: sidecarIdentity,
  _sidecarBaseUrl: sidecarBaseUrl,
};
