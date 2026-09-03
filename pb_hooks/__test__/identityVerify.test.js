/**
 * Tests for pb_hooks/identityVerify.js — the Pocketbase-side sign-in
 * verification entry point. Mirrors storeVerify.test.js: the env is
 * controlled per case, $http is a globalThis mock (the v0.4x handler
 * runtime supplies the real one).
 */

const KEYS = ["MDOOM_DEV_FAKE_TOKEN", "MDOOM_SIDECAR_URL", "MDOOM_SIDECAR_SECRET"];
let savedEnv = null;

function withEnv(env) {
  if (savedEnv === null) {
    savedEnv = {};
    for (const key of KEYS) savedEnv[key] = process.env[key];
  }
  for (const key of KEYS) {
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }
}

afterEach(() => {
  if (savedEnv !== null) {
    for (const key of KEYS) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
    savedEnv = null;
  }
});

function loadIdentityVerify(env) {
  withEnv(env);
  jest.resetModules();
  return require("../identityVerify");
}

// Mirrors the pinned v0.40 $http contract: send(opts) -> { statusCode, json, raw }.
function mockHttp(reply, { throws = null } = {}) {
  const calls = [];
  const send = (opts) => {
    calls.push(opts);
    if (throws) throw throws;
    if (typeof reply === "function") return reply(opts);
    return reply;
  };
  const saved = globalThis.$http;
  globalThis.$http = { send };
  return { calls, restore: () => { if (saved === undefined) delete globalThis.$http; else globalThis.$http = saved; } };
}

const fakeToken = (payload) =>
  [
    Buffer.from(JSON.stringify({ alg: "ES256", kid: "FAKE" })).toString("base64url"),
    Buffer.from(JSON.stringify(payload)).toString("base64url"),
    "sig",
  ].join(".");

describe("identityVerify sandbox mode (MDOOM_DEV_FAKE_TOKEN)", () => {
  const S = loadIdentityVerify({ MDOOM_DEV_FAKE_TOKEN: "1" });

  test("trusts the JWT payload claims — sub required, email optional", () => {
    expect(S.verifyIdentity("google", fakeToken({ sub: "g-1", email: "d@example.com" }))).toEqual({
      valid: true,
      sub: "g-1",
      email: "d@example.com",
      emailVerified: true,
    });
    expect(S.verifyIdentity("apple", fakeToken({ sub: "ap|Ae1" }))).toEqual({
      valid: true,
      sub: "ap|Ae1",
      email: "",
      emailVerified: true,
    });
  });

  test("refuses a token without a usable sub", () => {
    expect(S.verifyIdentity("google", fakeToken({ email: "d@example.com" }))).toBe(null);
    expect(S.verifyIdentity("google", fakeToken({ sub: "bad sub!" }))).toBe(null);
  });

  test("refuses non-JWT junk and unknown providers", () => {
    expect(S.verifyIdentity("google", "not-a-jwt")).toBe(null);
    expect(S.verifyIdentity("google", "")).toBe(null);
    expect(S.verifyIdentity("github", fakeToken({ sub: "x" }))).toBe(null);
  });

  test("an oversized token refuses", () => {
    expect(S.verifyIdentity("google", "a".repeat(16385))).toBe(null);
  });
});

describe("identityVerify fail-closed (no sidecar configured)", () => {
  const S = loadIdentityVerify({});
  const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

  test("refuses every token and logs", () => {
    expect(S.verifyIdentity("google", fakeToken({ sub: "g-1" }))).toBe(null);
    expect(warn).toHaveBeenCalled();
  });

  afterAll(() => warn.mockRestore());
});

describe("identityVerify sidecar mode (MDOOM_SIDECAR_URL)", () => {
  let S;

  beforeEach(() => {
    S = loadIdentityVerify({ MDOOM_SIDECAR_URL: "http://127.0.0.1:8180/" });
  });

  test("2xx { valid: true, sub } accepts, with the pinned request shape", () => {
    const http = mockHttp({ statusCode: 200, json: { valid: true, sub: "g-1", email: "d@example.com", emailVerified: true }, raw: "" });
    expect(S.verifyIdentity("google", fakeToken({ sub: "g-1" }))).toEqual({
      valid: true,
      sub: "g-1",
      email: "d@example.com",
      emailVerified: true,
    });
    expect(http.calls[0].url).toBe("http://127.0.0.1:8180/identity");
    expect(http.calls[0].method).toBe("POST");
    expect(JSON.parse(http.calls[0].body)).toEqual({ provider: "google", idToken: expect.any(String) });
    expect(http.calls[0].headers["Content-Type"]).toBe("application/json");
    http.restore();
  });

  test("a string json field is parsed; a raw fallback is honoured", () => {
    const http = mockHttp({ statusCode: 200, json: JSON.stringify({ valid: true, sub: "g-1" }) });
    expect(S.verifyIdentity("google", "x.y.z").sub).toBe("g-1");
    http.restore();
    const http2 = mockHttp({ statusCode: 200, json: undefined, raw: '{"valid":true,"sub":"ap|1"}' });
    expect(S.verifyIdentity("apple", "x.y.z").sub).toBe("ap|1");
    http2.restore();
  });

  test("valid:false / missing sub / non-2xx / unparsable all refuse", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const cases = [
      { statusCode: 200, json: { valid: false, reason: "bad apple signature" } },
      { statusCode: 200, json: { valid: true } }, // valid but no sub — refuse
      { statusCode: 500, json: { error: "boom" } },
      { statusCode: 200, json: undefined, raw: "{not json" },
    ];
    for (const reply of cases) {
      const http = mockHttp(reply);
      expect(S.verifyIdentity("google", "x.y.z")).toBe(null);
      http.restore();
    }
    warn.mockRestore();
  });

  test("a transport error refuses (never throws); an absent $http refuses", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const http = mockHttp(null, { throws: new Error("connection refused") });
    expect(S.verifyIdentity("google", "x.y.z")).toBe(null);
    http.restore();
    const saved = globalThis.$http;
    delete globalThis.$http;
    expect(S.verifyIdentity("google", "x.y.z")).toBe(null);
    if (saved !== undefined) globalThis.$http = saved;
    warn.mockRestore();
  });

  test("MDOOM_SIDECAR_SECRET rides along as x-mdoom-key", () => {
    const Sv = loadIdentityVerify({
      MDOOM_SIDECAR_URL: "http://127.0.0.1:8180",
      MDOOM_SIDECAR_SECRET: "s3cret",
    });
    const http = mockHttp({ statusCode: 200, json: { valid: true, sub: "g-1" } });
    expect(Sv.verifyIdentity("apple", "x.y.z")).not.toBe(null);
    expect(http.calls[0].headers["x-mdoom-key"]).toBe("s3cret");
    http.restore();
  });

  test("fake-token mode takes precedence over the sidecar", () => {
    const Sboth = loadIdentityVerify({ MDOOM_DEV_FAKE_TOKEN: "true", MDOOM_SIDECAR_URL: "http://x" });
    const saved = globalThis.$http;
    delete globalThis.$http;
    try {
      expect(Sboth.verifyIdentity("google", fakeToken({ sub: "g-fake" })).sub).toBe("g-fake");
    } finally {
      if (saved !== undefined) globalThis.$http = saved;
    }
  });
});

describe("b64urlToUtf8 / decodeJwtPayload (pure, goja-safe)", () => {
  const S = loadIdentityVerify({});

  test("decodes ascii, multibyte, and non-base64-padded payloads", () => {
    for (const payload of [
      { sub: "g-1" },
      { email: "düger@example.com" },
      { deep: { a: [1, 2, 3], b: "ünïcode-😀" } },
    ]) {
      const token = fakeToken(payload);
      expect(S._decodeJwtPayload(token)).toEqual(payload);
    }
  });

  test("garbage input returns null, never throws", () => {
    expect(S._decodeJwtPayload("nope")).toBe(null);
    expect(S._decodeJwtPayload("!!!.!!!.!!!")).toBe(null);
    expect(S._decodeJwtPayload("a.b.!!!")).toBe(null);
  });
});
