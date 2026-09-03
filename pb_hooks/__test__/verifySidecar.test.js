/**
 * Unit tests for the store-verification sidecar (pb_hooks/sidecar/).
 * Runs in the app's jest suite (node env). All store traffic is scripted
 * through an injected fetch; the Apple cert chain is generated with
 * openssl in a temp dir (the tests skip the chain-dependent cases when
 * openssl is unavailable).
 */
const crypto = require("crypto");
const cp = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const S = require("../sidecar/verify");

// -- fixtures ------------------------------------------------------------------

const NOW_SEC = 1700000000; // fixed clock for deterministic iat/exp

const rsaKeyPair = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const SA = {
  client_email: "svc@example.com",
  private_key: rsaKeyPair.privateKey.export({ type: "pkcs8", format: "pem" }),
};

const ecKeyPair = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
const APPLE = {
  bundleId: "com.minus4kelvin.minesofdoom",
  appId: "1234567890",
  keyId: "MDKEY1",
  privateKeyPem: ecKeyPair.privateKey.export({ type: "pkcs8", format: "pem" }),
  env: "sandbox",
};

const respond = (obj, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => obj,
});

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

// openssl-generated chain (module scope so the skip decision is known at
// collection time); null → chain tests skip.
function buildChain() {
  try {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "md-sidecar-"));
    const f = (name) => path.join(dir, name);
    const run = (args) => {
      const r = cp.spawnSync("openssl", args, { encoding: "utf8" });
      if (r.status !== 0) throw new Error(r.stderr || "openssl failed");
    };
    run(["ecparam", "-name", "prime256v1", "-genkey", "-noout", "-out", f("root.key")]);
    run(["req", "-x509", "-new", "-key", f("root.key"), "-sha256", "-days", "1",
      "-subj", "/CN=md-test-root", "-addext", "basicConstraints=CA:TRUE", "-out", f("root.pem")]);
    run(["ecparam", "-name", "prime256v1", "-genkey", "-noout", "-out", f("leaf.key")]);
    run(["req", "-new", "-key", f("leaf.key"), "-subj", "/CN=md-test-leaf", "-out", f("leaf.csr")]);
    run(["x509", "-req", "-in", f("leaf.csr"), "-CA", f("root.pem"), "-CAkey", f("root.key"),
      "-CAcreateserial", "-sha256", "-days", "1", "-out", f("leaf.pem")]);
    run(["x509", "-in", f("root.pem"), "-outform", "DER", "-out", f("root.der")]);
    run(["x509", "-in", f("leaf.pem"), "-outform", "DER", "-out", f("leaf.der")]);
    return {
      leafKeyPem: fs.readFileSync(f("leaf.key"), "utf8"),
      leafDerB64: fs.readFileSync(f("leaf.der")).toString("base64"),
      rootDerB64: fs.readFileSync(f("root.der")).toString("base64"),
    };
  } catch {
    return null;
  }
}
const CHAIN = buildChain();
const chainTest = CHAIN ? test : test.skip;

function makeAppleJws(payload, { sigKeyPem = CHAIN.leafKeyPem, x5c = [CHAIN.leafDerB64, CHAIN.rootDerB64], alg = "ES256" } = {}) {
  const signingInput = S.b64url(JSON.stringify({ alg, x5c })) + "." + S.b64url(JSON.stringify(payload));
  const sig = crypto.sign("SHA256", Buffer.from(signingInput), sigKeyPem);
  return signingInput + "." + S.b64url(sig);
}

const applePayload = (over = {}) => ({
  transactionId: "987654321",
  productId: "remove_ads",
  environment: "Sandbox",
  transactionReason: 1,
  purchaseDate: NOW_SEC - 600,
  type: "ONE_TIME",
  ...over,
});

// -- jwt primitives -------------------------------------------------------------

describe("signJwt / decodeJwt", () => {
  test("RS256 with an RSA key verifies against the public key", () => {
    const token = S.signJwt({ alg: "RS256" }, { sub: "x" }, SA.private_key);
    const decoded = S.decodeJwt(token);
    expect(decoded).not.toBeNull();
    expect(decoded.header.alg).toBe("RS256");
    expect(decoded.claims.sub).toBe("x");
    const [h, p] = token.split(".");
    expect(
      crypto.verify("RSA-SHA256", Buffer.from(h + "." + p), rsaKeyPair.publicKey, decoded.signature),
    ).toBe(true);
  });

  test("ES256 with a P-256 key (DER signature) verifies", () => {
    const token = S.signJwt({ alg: "ES256", kid: "K1" }, { sub: "y" }, APPLE.privateKeyPem);
    const decoded = S.decodeJwt(token);
    expect(decoded.header.kid).toBe("K1");
    const [h, p] = token.split(".");
    expect(
      crypto.verify("SHA256", Buffer.from(h + "." + p), ecKeyPair.publicKey, decoded.signature),
    ).toBe(true);
  });

  test("decodeJwt rejects a non-JWT", () => {
    expect(S.decodeJwt("nope")).toBeNull();
  });
});

// -- config ----------------------------------------------------------------------

describe("parseSidecarConfig", () => {
  test("parses inline play SA json + apple env; defaults the package", () => {
    const cfg = S.parseSidecarConfig({
      PLAY_SERVICE_ACCOUNT_JSON: JSON.stringify(SA),
      APPLE_BUNDLE_ID: APPLE.bundleId,
      APPLE_APP_ID: APPLE.appId,
      APPLE_KEY_ID: APPLE.keyId,
      APPLE_PRIVATE_KEY: APPLE.privateKeyPem,
    });
    expect(cfg.play).toEqual(SA);
    expect(cfg.playPackage).toBe("com.minus4kelvin.minesofdoom");
    expect(cfg.apple).toEqual({ ...APPLE, env: "sandbox" });
  });

  test("reads SA json and the apple key from files (path and @path)", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "md-sidecar-env-"));
    const saFile = path.join(dir, "sa.json");
    const keyFile = path.join(dir, "apple.pem");
    fs.writeFileSync(saFile, JSON.stringify(SA));
    fs.writeFileSync(keyFile, APPLE.privateKeyPem);
    const cfg = S.parseSidecarConfig({
      PLAY_SERVICE_ACCOUNT_JSON: saFile,
      PLAY_PACKAGE: "com.other.app",
      APPLE_BUNDLE_ID: APPLE.bundleId,
      APPLE_APP_ID: APPLE.appId,
      APPLE_KEY_ID: APPLE.keyId,
      APPLE_PRIVATE_KEY: "@" + keyFile,
      APPLE_IAP_ENV: "Production",
    });
    expect(cfg.play).toEqual(SA);
    expect(cfg.playPackage).toBe("com.other.app");
    expect(cfg.apple.env).toBe("production");
  });

  test("malformed SA json or missing apple fields leave the platform unconfigured", () => {
    const cfg = S.parseSidecarConfig({
      PLAY_SERVICE_ACCOUNT_JSON: "{not json",
      APPLE_BUNDLE_ID: "b", // missing appId/keyId/key
    });
    expect(cfg.play).toBeNull();
    expect(cfg.apple).toBeNull();
  });

  test("a junk APPLE_IAP_ENV disables apple (never an implicit sandbox)", () => {
    const cfg = S.parseSidecarConfig({
      APPLE_BUNDLE_ID: APPLE.bundleId,
      APPLE_APP_ID: APPLE.appId,
      APPLE_KEY_ID: APPLE.keyId,
      APPLE_PRIVATE_KEY: APPLE.privateKeyPem,
      APPLE_IAP_ENV: "banana",
    });
    expect(cfg.apple).toBeNull();
  });
});

// -- Play flow ---------------------------------------------------------------------

describe("Play (android) verification", () => {
  const ctx = { nowSec: NOW_SEC };

  test("exchange posts a jwt-bearer grant and returns the access token", async () => {
    const { fetchImpl, calls } = scriptedFetch([
      { match: /oauth2\.googleapis\.com\/token/, reply: { access_token: "AT-1" } },
    ]);
    const token = await S.getPlayAccessToken(SA, { fetch: fetchImpl, ...ctx });
    expect(token).toBe("AT-1");
    expect(String(calls[0].init.body)).toContain(
      "grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer",
    );
    expect(String(calls[0].init.body)).toContain("assertion=");
  });

  test("buildPlayAssertion claims (iss/scope/aud/exp)", () => {
    const decoded = S.decodeJwt(S.buildPlayAssertion(SA, NOW_SEC));
    expect(decoded.claims.iss).toBe("svc@example.com");
    expect(decoded.claims.scope).toBe("https://www.googleapis.com/auth/androidpublisher");
    expect(decoded.claims.aud).toBe(S.PLAY_TOKEN_URL);
    expect(decoded.claims.exp - decoded.claims.iat).toBe(3600);
  });

  test("purchaseState 0 on the pinned SKU mints", async () => {
    const { fetchImpl, calls } = scriptedFetch([
      { match: /oauth2\.googleapis\.com\/token/, reply: { access_token: "AT-1" } },
      {
        match: /androidpublisher/,
        reply: { purchaseState: 0, productIds: ["remove_ads"], orderId: "GPA.1" },
      },
    ]);
    const verdict = await S.verifyPlayPurchase(SA, "com.minus4kelvin.minesofdoom", "remove_ads", "TOK-1", { fetch: fetchImpl, ...ctx });
    expect(verdict).toEqual({ valid: true });
    const lookup = calls.find((c) => /androidpublisher/.test(c.url));
    expect(lookup.url).toContain("/applications/com.minus4kelvin.minesofdoom/purchases/products/remove_ads/tokens/TOK-1");
    expect(lookup.url).toContain("access_token=AT-1");
  });

  test("purchaseState 1 (canceled) refuses", async () => {
    const { fetchImpl } = scriptedFetch([
      { match: /oauth2\.googleapis\.com\/token/, reply: { access_token: "AT-1" } },
      { match: /androidpublisher/, reply: { purchaseState: 1 } },
    ]);
    const verdict = await S.verifyPlayPurchase(SA, "p", "remove_ads", "T", { fetch: fetchImpl, ...ctx });
    expect(verdict.valid).toBe(false);
  });

  test("a populated productIds list that contradicts the SKU refuses", async () => {
    const { fetchImpl } = scriptedFetch([
      { match: /oauth2\.googleapis\.com\/token/, reply: { access_token: "AT-1" } },
      { match: /androidpublisher/, reply: { purchaseState: 0, productIds: ["something_else"] } },
    ]);
    const verdict = await S.verifyPlayPurchase(SA, "p", "remove_ads", "T", { fetch: fetchImpl, ...ctx });
    expect(verdict.valid).toBe(false);
  });

  test("an exchange failure refuses without calling the lookup", async () => {
    const { fetchImpl } = scriptedFetch([
      { match: /oauth2\.googleapis\.com\/token/, reply: { error: "invalid_grant" }, status: 400 },
    ]);
    const verdict = await S.verifyPlayPurchase(SA, "p", "remove_ads", "T", { fetch: fetchImpl, ...ctx });
    expect(verdict.valid).toBe(false);
  });

  test("a lookup 404 (unknown token) refuses", async () => {
    const { fetchImpl } = scriptedFetch([
      { match: /oauth2\.googleapis\.com\/token/, reply: { access_token: "AT-1" } },
      { match: /androidpublisher/, reply: { error: "not found" }, status: 404 },
    ]);
    const verdict = await S.verifyPlayPurchase(SA, "p", "remove_ads", "T", { fetch: fetchImpl, ...ctx });
    expect(verdict.valid).toBe(false);
  });
});

// -- Apple flow ---------------------------------------------------------------------

describe("Apple (ios) verification", () => {
  const ctx = { nowSec: NOW_SEC };

  test("buildAppleJwt claims (iss/sub = bundleId:appId, scope, kid, ≤10min)", () => {
    const decoded = S.decodeJwt(S.buildAppleJwt(APPLE, NOW_SEC * 1000));
    expect(decoded.header.alg).toBe("ES256");
    expect(decoded.header.kid).toBe("MDKEY1");
    expect(decoded.claims.iss).toBe(APPLE.bundleId + ":" + APPLE.appId);
    expect(decoded.claims.sub).toBe(decoded.claims.iss);
    expect(decoded.claims.aud).toBe(S.APPLE_AUD);
    expect(decoded.claims.scope).toBe(S.APPLE_SCOPE);
    expect(decoded.claims.exp - decoded.claims.iat).toBe(600);
  });

  chainTest("a valid JWS on Apple's chain verifies to its payload", () => {
    const jws = makeAppleJws(applePayload());
    const rootCerts = [new crypto.X509Certificate(Buffer.from(CHAIN.rootDerB64, "base64"))];
    const v = S.verifySignedTransactionInfo(jws, rootCerts);
    expect(v.ok).toBe(true);
    expect(v.payload.productId).toBe("remove_ads");
  });

  chainTest("a tampered JWS signature refuses", () => {
    const jws = makeAppleJws(applePayload());
    const [h, p, s] = jws.split(".");
    const tampered = h + "." + p + "." + S.b64url(Buffer.from("~" + s.toString("base64url")));
    const rootCerts = [new crypto.X509Certificate(Buffer.from(CHAIN.rootDerB64, "base64"))];
    expect(S.verifySignedTransactionInfo(tampered, rootCerts).ok).toBe(false);
  });

  chainTest("a broken chain refuses (leaf presented twice)", () => {
    const jws = makeAppleJws(applePayload(), { x5c: [CHAIN.leafDerB64, CHAIN.leafDerB64] });
    const rootCerts = [new crypto.X509Certificate(Buffer.from(CHAIN.rootDerB64, "base64"))];
    expect(S.verifySignedTransactionInfo(jws, rootCerts).ok).toBe(false);
  });

  chainTest("a root outside Apple's published set refuses", () => {
    const jws = makeAppleJws(applePayload());
    expect(S.verifySignedTransactionInfo(jws, []).ok).toBe(false);
  });

  chainTest("an alg mismatch (claims RS256, signed EC) refuses", () => {
    const jws = makeAppleJws(applePayload(), { alg: "RS256" });
    const rootCerts = [new crypto.X509Certificate(Buffer.from(CHAIN.rootDerB64, "base64"))];
    expect(S.verifySignedTransactionInfo(jws, rootCerts).ok).toBe(false);
  });

  chainTest("a JWS signed by a key outside the presented chain refuses", () => {
    const jws = makeAppleJws(applePayload(), { sigKeyPem: APPLE.privateKeyPem });
    const rootCerts = [new crypto.X509Certificate(Buffer.from(CHAIN.rootDerB64, "base64"))];
    expect(S.verifySignedTransactionInfo(jws, rootCerts).ok).toBe(false);
  });

  const appleRoutes = (lookReply, status = 200) => [
    {
      match: /\/oauth\/certificates/,
      reply: { certificateContents: [CHAIN.leafDerB64, CHAIN.rootDerB64] },
    },
    { match: /\/inApps\/v1\/transactions\/lookup\//, reply: lookReply, status },
  ];

  const appleCtx = (routes) => {
    const s = scriptedFetch(routes);
    return { fetch: s.fetchImpl, calls: s.calls, ...ctx };
  };

  chainTest("a matching signed transaction mints", async () => {
    const c = appleCtx(appleRoutes({ transactionInfo: [{ signedTransactionInfo: makeAppleJws(applePayload()) }] }));
    const verdict = await S.verifyApplePurchase(APPLE, "remove_ads", "987654321", c);
    expect(verdict).toEqual({ valid: true });
    expect(c.calls.some((x) => /sandbox\.storekit\.itunes\.apple\.com/.test(x.url))).toBe(true);
    expect(c.calls[0].init.headers.Authorization).toMatch(/^Bearer /);
  });

  chainTest("productId mismatch refuses", async () => {
    const c = appleCtx(appleRoutes({ transactionInfo: [{ signedTransactionInfo: makeAppleJws(applePayload()) }] }));
    const verdict = await S.verifyApplePurchase(APPLE, "pack_oni", "987654321", c);
    expect(verdict.valid).toBe(false);
  });

  chainTest("an environment mismatch (Sandbox token in production mode) refuses", async () => {
    const c = appleCtx(appleRoutes({ transactionInfo: [{ signedTransactionInfo: makeAppleJws(applePayload()) }] }));
    const cfg = { ...APPLE, env: "production" };
    const verdict = await S.verifyApplePurchase(cfg, "remove_ads", "987654321", { ...c, fetch: c.fetch });
    expect(verdict.valid).toBe(false);
  });

  chainTest("a refunded transaction (reason 2) refuses", async () => {
    const c = appleCtx(appleRoutes({ transactionInfo: [{ signedTransactionInfo: makeAppleJws(applePayload({ transactionReason: 2 })) }] }));
    const verdict = await S.verifyApplePurchase(APPLE, "remove_ads", "987654321", c);
    expect(verdict.valid).toBe(false);
  });

  chainTest("a revoked transaction refuses", async () => {
    const c = appleCtx(appleRoutes({ transactionInfo: [{ signedTransactionInfo: makeAppleJws(applePayload({ revocationDate: NOW_SEC - 10 })) }] }));
    const verdict = await S.verifyApplePurchase(APPLE, "remove_ads", "987654321", c);
    expect(verdict.valid).toBe(false);
  });

  chainTest("a future purchaseDate refuses", async () => {
    const c = appleCtx(appleRoutes({ transactionInfo: [{ signedTransactionInfo: makeAppleJws(applePayload({ purchaseDate: NOW_SEC + 3600 })) }] }));
    const verdict = await S.verifyApplePurchase(APPLE, "remove_ads", "987654321", c);
    expect(verdict.valid).toBe(false);
  });

  chainTest("an unknown transaction (404) refuses", async () => {
    const c = appleCtx(appleRoutes({ transactionInfo: [] }, 404));
    const verdict = await S.verifyApplePurchase(APPLE, "remove_ads", "000", c);
    expect(verdict.valid).toBe(false);
  });

  chainTest("a signed payload for another transactionId refuses", async () => {
    const c = appleCtx(appleRoutes({ transactionInfo: [{ signedTransactionInfo: makeAppleJws(applePayload()) }] }));
    const verdict = await S.verifyApplePurchase(APPLE, "remove_ads", "111111111", c);
    expect(verdict.valid).toBe(false);
  });
});

// -- dispatcher ----------------------------------------------------------------------

describe("verifyPurchase dispatcher", () => {
  const cfg = { play: SA, playPackage: "p", apple: APPLE };

  test("android routes to the play flow", async () => {
    const { fetchImpl } = scriptedFetch([
      { match: /oauth2\.googleapis\.com\/token/, reply: { access_token: "AT-1" } },
      { match: /androidpublisher/, reply: { purchaseState: 0, productIds: ["remove_ads"] } },
    ]);
    const verdict = await S.verifyPurchase({ platform: "android", productId: "remove_ads", token: "T", cfg, ctx: { fetch: fetchImpl, nowSec: NOW_SEC } });
    expect(verdict).toEqual({ valid: true });
  });

  test("ios rejects non-numeric transaction ids without any network call", async () => {
    const { fetchImpl } = scriptedFetch([]);
    const verdict = await S.verifyPurchase({ platform: "ios", productId: "remove_ads", token: "not-a-number", cfg, ctx: { fetch: fetchImpl, nowSec: NOW_SEC } });
    expect(verdict.valid).toBe(false);
  });

  test("an unconfigured platform refuses", async () => {
    const { fetchImpl } = scriptedFetch([]);
    expect(
      (await S.verifyPurchase({ platform: "android", productId: "x", token: "T", cfg: { play: null, apple: null }, ctx: { fetch: fetchImpl, nowSec: NOW_SEC } })).valid,
    ).toBe(false);
  });

  test("an unknown platform refuses", async () => {
    const { fetchImpl } = scriptedFetch([]);
    const verdict = await S.verifyPurchase({ platform: "web", productId: "x", token: "T", cfg, ctx: { fetch: fetchImpl, nowSec: NOW_SEC } });
    expect(verdict.valid).toBe(false);
  });

  test("a fetch crash becomes a refusal, never a throw", async () => {
    const fetchImpl = async () => { throw new Error("boom"); };
    const verdict = await S.verifyPurchase({ platform: "android", productId: "x", token: "T", cfg, ctx: { fetch: fetchImpl, nowSec: NOW_SEC } });
    expect(verdict.valid).toBe(false);
  });
});

// -- identity (optional login) --------------------------------------------------

const GOOGLE_CLIENT_ID = "1234567890-abc.apps.googleusercontent.com";
const APPLE_BUNDLE_ID = "com.minus4kelvin.minesofdoom";

const googleJwk = Object.assign({ kid: "g-kid-1" }, rsaKeyPair.publicKey.export({ format: "jwk" }));
const appleJwk = Object.assign({ kid: "ap-kid-1" }, ecKeyPair.publicKey.export({ format: "jwk" }));

function googleToken(claims, { pem = SA.private_key, kid = "g-kid-1" } = {}) {
  return S.signJwt({ alg: "RS256", kid }, claims, pem);
}

function appleToken(claims, { pem = APPLE.privateKeyPem, kid = "ap-kid-1" } = {}) {
  return S.signJwt({ alg: "ES256", kid }, claims, pem);
}

const googleClaims = (over = {}) => ({
  iss: "https://accounts.google.com",
  aud: GOOGLE_CLIENT_ID,
  iat: NOW_SEC - 10,
  exp: NOW_SEC + 3600,
  sub: "g-1",
  email: "digger@example.com",
  email_verified: true,
  ...over,
});

const appleClaims = (over = {}) => ({
  iss: "https://appleid.apple.com",
  aud: [APPLE_BUNDLE_ID],
  iat: NOW_SEC - 10,
  exp: NOW_SEC + 3600,
  sub: "ap|Ae1",
  ...over,
});

const identityCfg = S.parseSidecarConfig({
  GOOGLE_CLIENT_ID: GOOGLE_CLIENT_ID,
  APPLE_BUNDLE_ID: APPLE_BUNDLE_ID,
});

const identityRoutes = [
  { match: /googleapis\.com\/oauth2\/v3\/certs/, reply: { keys: [googleJwk] } },
  { match: /appleid\.apple\.com\/auth\/keys/, reply: { keys: [appleJwk] } },
];

describe("parseSidecarConfig identity audiences", () => {
  test("GOOGLE_CLIENT_ID / APPLE_BUNDLE_ID stand alone (no store creds needed)", () => {
    const cfg = S.parseSidecarConfig({
      GOOGLE_CLIENT_ID: GOOGLE_CLIENT_ID,
      APPLE_BUNDLE_ID: APPLE_BUNDLE_ID,
    });
    expect(cfg.googleClientId).toBe(GOOGLE_CLIENT_ID);
    expect(cfg.appleBundleId).toBe(APPLE_BUNDLE_ID);
    expect(cfg.play).toBeNull();
    expect(cfg.apple).toBeNull(); // store IAP stays unconfigured
  });

  test("missing audiences leave the identity providers unconfigured", () => {
    const cfg = S.parseSidecarConfig({});
    expect(cfg.googleClientId).toBeUndefined();
    expect(cfg.appleBundleId).toBeUndefined();
  });
});

describe("Google identity verification", () => {
  test("a valid ID token verifies against the JWKS and passes claims through", async () => {
    const { fetchImpl, calls } = scriptedFetch(identityRoutes);
    const verdict = await S.verifyIdentity({
      provider: "google",
      idToken: googleToken(googleClaims()),
      cfg: identityCfg,
      ctx: { fetch: fetchImpl, nowSec: NOW_SEC },
    });
    expect(verdict).toEqual({
      valid: true,
      sub: "g-1",
      email: "digger@example.com",
      emailVerified: true,
    });
    expect(calls.some((c) => c.url === "https://www.googleapis.com/oauth2/v3/certs")).toBe(true);
  });

  test("a token signed by a different key refuses (the spoofing case)", async () => {
    const other = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
    const forged = googleToken(googleClaims(), { pem: other.privateKey.export({ type: "pkcs8", format: "pem" }) });
    const { fetchImpl } = scriptedFetch(identityRoutes);
    const verdict = await S.verifyIdentity({ provider: "google", idToken: forged, cfg: identityCfg, ctx: { fetch: fetchImpl, nowSec: NOW_SEC } });
    expect(verdict.valid).toBe(false);
  });

  test("wrong audience, wrong issuer, expiry, and kid miss all refuse", async () => {
    const cases = [
      googleToken(googleClaims({ aud: "other-client-id" })),
      googleToken(googleClaims({ iss: "https://evil.example.com" })),
      googleToken(googleClaims({ exp: NOW_SEC - 1 })),
      googleToken(googleClaims(), { kid: "unknown-kid" }),
      "not-a-jwt",
    ];
    for (const token of cases) {
      const { fetchImpl } = scriptedFetch(identityRoutes);
      const verdict = await S.verifyIdentity({ provider: "google", idToken: token, cfg: identityCfg, ctx: { fetch: fetchImpl, nowSec: NOW_SEC } });
      expect(verdict.valid).toBe(false);
    }
  });

  test("an unconfigured client id refuses without a network call", async () => {
    const { fetchImpl, calls } = scriptedFetch([]);
    const verdict = await S.verifyIdentity({ provider: "google", idToken: googleToken(googleClaims()), cfg: { googleClientId: null }, ctx: { fetch: fetchImpl, nowSec: NOW_SEC } });
    expect(verdict).toEqual({ valid: false, reason: "google not configured" });
    expect(calls).toEqual([]);
  });
});

describe("Apple identity verification", () => {
  test("a valid ID token verifies (email optional — the privacy proxy)", async () => {
    const { fetchImpl } = scriptedFetch(identityRoutes);
    const verdict = await S.verifyIdentity({
      provider: "apple",
      idToken: appleToken(appleClaims()),
      cfg: identityCfg,
      ctx: { fetch: fetchImpl, nowSec: NOW_SEC },
    });
    expect(verdict).toEqual({ valid: true, sub: "ap|Ae1", email: "", emailVerified: false });
    const withEmail = await S.verifyIdentity({
      provider: "apple",
      idToken: appleToken(appleClaims({ email: "x@privaterelay.appleid.com" })),
      cfg: identityCfg,
      ctx: { fetch: fetchImpl, nowSec: NOW_SEC },
    });
    expect(withEmail.email).toBe("x@privaterelay.appleid.com");
  });

  test("a token signed by a different key refuses", async () => {
    const other = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
    const forged = appleToken(appleClaims(), { pem: other.privateKey.export({ type: "pkcs8", format: "pem" }) });
    const { fetchImpl } = scriptedFetch(identityRoutes);
    const verdict = await S.verifyIdentity({ provider: "apple", idToken: forged, cfg: identityCfg, ctx: { fetch: fetchImpl, nowSec: NOW_SEC } });
    expect(verdict.valid).toBe(false);
  });

  test("wrong bundle-id audience, wrong issuer, and expiry refuse", async () => {
    const cases = [
      appleToken(appleClaims({ aud: ["com.other.app"] })),
      appleToken(appleClaims({ iss: "https://evil.example.com" })),
      appleToken(appleClaims({ exp: NOW_SEC - 1 })),
    ];
    for (const token of cases) {
      const { fetchImpl } = scriptedFetch(identityRoutes);
      const verdict = await S.verifyIdentity({ provider: "apple", idToken: token, cfg: identityCfg, ctx: { fetch: fetchImpl, nowSec: NOW_SEC } });
      expect(verdict.valid).toBe(false);
    }
  });

  test("an unconfigured bundle id refuses; unknown providers refuse", async () => {
    const { fetchImpl, calls } = scriptedFetch([]);
    expect(
      (await S.verifyIdentity({ provider: "apple", idToken: appleToken(appleClaims()), cfg: {}, ctx: { fetch: fetchImpl, nowSec: NOW_SEC } })).reason,
    ).toBe("apple not configured");
    const verdict = await S.verifyIdentity({ provider: "github", idToken: "x.y.z", cfg: identityCfg, ctx: { fetch: fetchImpl, nowSec: NOW_SEC } });
    expect(verdict).toEqual({ valid: false, reason: "unknown provider" });
    expect(calls).toEqual([]);
  });

  test("a fetch crash becomes a refusal, never a throw", async () => {
    const fetchImpl = async () => { throw new Error("boom"); };
    const verdict = await S.verifyIdentity({ provider: "google", idToken: googleToken(googleClaims()), cfg: identityCfg, ctx: { fetch: fetchImpl, nowSec: NOW_SEC } });
    expect(verdict.valid).toBe(false);
  });
});
