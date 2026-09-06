/**
 * Tests for pb_hooks/storeVerify.js — the Pocketbase-side verification
 * entry point. The fake-token flag is read at module load, so each case
 * re-requires the module under a controlled process.env; $http is a
 * globalThis mock (the v0.4x handler runtime supplies the real one).
 */

const KEYS = ["MDOOM_DEV_FAKE_TOKEN", "MDOOM_SIDECAR_URL", "MDOOM_SIDECAR_SECRET"];
let savedEnv = null;

// storeVerify reads the env LIVE (sidecarBaseUrl at call time), so the env
// must stay set for the whole test — apply it here, restore in afterEach.
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

function loadStoreVerify(env) {
  withEnv(env);
  jest.resetModules();
  return require("../storeVerify");
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

describe("storeVerify sandbox mode (MDOOM_DEV_FAKE_TOKEN)", () => {
  const S = loadStoreVerify({ MDOOM_DEV_FAKE_TOKEN: "1" });

  test("mints for any non-empty token, no $http involved", () => {
    expect(S.verifyPurchase("android", "packGold", "any-token")).toBe(true);
    expect(S.verifyPurchase("ios", "packGold", "12345")).toBe(true);
    expect(S.verifyPurchase("android", "packGold", "")).toBe(false);
  });
});

describe("storeVerify fail-closed (no sidecar configured)", () => {
  const S = loadStoreVerify({});
  const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

  test("refuses every token and logs", () => {
    expect(S.verifyPurchase("android", "packGold", "token")).toBe(false);
    expect(warn).toHaveBeenCalled();
  });

  afterAll(() => warn.mockRestore());
});

describe("storeVerify sidecar mode (MDOOM_SIDECAR_URL)", () => {
  let S;

  beforeEach(() => {
    S = loadStoreVerify({ MDOOM_SIDECAR_URL: "http://127.0.0.1:8180/" });
  });

  test("2xx { valid: true } mints, with the pinned request shape", () => {
    const http = mockHttp({ statusCode: 200, json: { valid: true }, raw: '{"valid":true}' });
    expect(S.verifyPurchase("android", "packGold", "tok")).toBe(true);
    expect(http.calls[0].url).toBe("http://127.0.0.1:8180/verify");
    expect(http.calls[0].method).toBe("POST");
    // The $http contract requires a JSON STRING body (an object arrives as {}).
    expect(JSON.parse(http.calls[0].body)).toEqual({ platform: "android", productId: "packGold", token: "tok" });
    expect(http.calls[0].headers["Content-Type"]).toBe("application/json");
    http.restore();
  });

  test("a string json field is parsed", () => {
    const http = mockHttp({ statusCode: 200, json: JSON.stringify({ valid: true }) });
    expect(S.verifyPurchase("ios", "packGold", "42")).toBe(true);
    http.restore();
  });

  test("a raw fallback is honoured when json is absent", () => {
    const http = mockHttp({ statusCode: 200, raw: '{"valid":true}' });
    expect(S.verifyPurchase("ios", "packGold", "42")).toBe(true);
    http.restore();
  });

  test("valid:false refuses", () => {
    mockHttp({ statusCode: 200, json: { valid: false, reason: "play lookup 404" } });
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    expect(S.verifyPurchase("android", "packGold", "tok")).toBe(false);
    warn.mockRestore();
  });

  test("non-2xx refuses", () => {
    mockHttp({ statusCode: 500, json: { error: "boom" } });
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    expect(S.verifyPurchase("android", "packGold", "tok")).toBe(false);
    warn.mockRestore();
  });

  test("an unparseable reply refuses", () => {
    mockHttp({ statusCode: 200, json: undefined, raw: "{not json" });
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    expect(S.verifyPurchase("android", "packGold", "tok")).toBe(false);
    warn.mockRestore();
  });

  test("a transport error refuses (never throws)", () => {
    mockHttp(null, { throws: new Error("connection refused") });
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    expect(S.verifyPurchase("android", "packGold", "tok")).toBe(false);
    warn.mockRestore();
  });

  test("an absent $http refuses (fail closed)", () => {
    const saved = globalThis.$http;
    delete globalThis.$http;
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect(S.verifyPurchase("android", "packGold", "tok")).toBe(false);
    } finally {
      if (saved !== undefined) globalThis.$http = saved;
      warn.mockRestore();
    }
  });

  test("web verify sends the deviceId so the sidecar can bind the session", () => {
    const http = mockHttp({ statusCode: 200, json: { valid: true } });
    expect(S.verifyPurchase("web", "packGold", "cs_test_abc", "device-1")).toBe(true);
    expect(JSON.parse(http.calls[0].body)).toEqual({
      platform: "web",
      productId: "packGold",
      token: "cs_test_abc",
      deviceId: "device-1",
    });
    http.restore();
  });

  test("non-web verify omits the deviceId field", () => {
    const http = mockHttp({ statusCode: 200, json: { valid: true } });
    expect(S.verifyPurchase("android", "packGold", "tok", "device-1")).toBe(true);
    const body = JSON.parse(http.calls[0].body);
    expect(body.deviceId).toBeUndefined();
    http.restore();
  });

  test("MDOOM_SIDECAR_SECRET rides along as x-mdoom-key", () => {
    const Sv = loadStoreVerify({
      MDOOM_SIDECAR_URL: "http://127.0.0.1:8180",
      MDOOM_SIDECAR_SECRET: "s3cret",
    });
    const http = mockHttp({ statusCode: 200, json: { valid: true } });
    expect(Sv.verifyPurchase("android", "packGold", "tok")).toBe(true);
    expect(http.calls[0].headers["x-mdoom-key"]).toBe("s3cret");
    http.restore();
  });

  test("fake-token mode takes precedence over the sidecar", () => {
    const Sboth = loadStoreVerify({ MDOOM_DEV_FAKE_TOKEN: "true", MDOOM_SIDECAR_URL: "http://x" });
    const saved = globalThis.$http;
    delete globalThis.$http;
    try {
      expect(Sboth.verifyPurchase("android", "packGold", "tok")).toBe(true);
    } finally {
      if (saved !== undefined) globalThis.$http = saved;
    }
  });
});
