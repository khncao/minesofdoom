/**
 * Direct unit tests for the auth-plane handlers in handlerLib.js —
 * F39.2's last slice (the data plane is in handlerDataPlane.test.js,
 * verify in handlerVerify.test.js, GDPR delete in handlerDataPlane.test.js).
 * Covered surface:
 *
 *   - auth/register + auth/login (email/password, KDF, 409, legacy upgrade)
 *   - auth/google (provider sign-in; FAKE-TOKEN sandbox mode —
 *     loadHandlers({ MDOOM_DEV_FAKE_TOKEN: "1" }) makes identityVerify
 *     trust the token payload, no network)
 *   - auth/me + auth/logout (session validity + pruning)
 *   - auth/set-password (ownership via session, no-email refusal)
 *   - auth/link (device-row backfill on a new device)
 *   - auth/link/google (provider-taken 409, success patch)
 *
 * The datastore is the shared production-faithful fake in
 * fakeDatastore.js (bound records mutate stored rows in place).
 */

const crypto = require("crypto");
const { makeApp, loadHandlers } = require("./fakeDatastore.js");

const logic = require("../logic.js");

let lib = null;
let app = null;
let restore = null;

const PW = "correct-horse-battery";

function sha256hex(s) {
  return crypto.createHash("sha256").update(String(s)).digest("hex");
}

/** Build a fake-mode idToken for the given provider claims. */
function fakeToken(claims) {
  const payload = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");
  return "fakehdr." + payload + ".fakesig";
}

function hex(len) {
  return crypto.randomBytes(len).toString("hex");
}

/** Seed a full account row (id lives in the data); returns the row. */
function seedAccount(data) {
  return app.createRecord("accounts", {
    id: "acct-" + hex(8),
    email: "",
    passwordHash: "",
    passwordSalt: "",
    googleId: "",
    appleId: "",
    createdAt: Date.now(),
    ...data,
  })._row;
}

/** Seed a live authSessions row; returns { token, row }. */
function seedSession(accountId, { expiresInMs = 24 * 60 * 60 * 1000 } = {}) {
  const token = hex(64); // SESSION_TOKEN_BYTES is 32
  const now = Date.now();
  const row = app.createRecord("authSessions", {
    token,
    accountId,
    deviceId: "00000000-0000-4000-8000-000000000000",
    createdAt: now,
    expiresAt: now + expiresInMs,
  })._row;
  return { token, row };
}

beforeEach(() => {
  // identityVerify captures MDOOM_DEV_FAKE_TOKEN at module load — loadHandlers
  // does jest.resetModules() first, so per-test env is honored.
  ({ lib, restore } = loadHandlers({ MDOOM_DEV_FAKE_TOKEN: "1" }));
  app = makeApp();
});

afterEach(() => {
  restore();
});

// -- register / login --------------------------------------------------------

describe("auth/register + auth/login", () => {
  test("register creates account + session, KDF hash, and backfills device rows", () => {
    const deviceId = "11111111-1111-4111-8111-111111111111";
    // Pre-existing anonymous rows the new device carries:
    app.createRecord("cloudSaves", {
      deviceId, blob: "{}", saveVersion: 3, updatedAt: Date.now() - 1000,
    });
    app.createRecord("entitlements", {
      deviceId, productId: "remove_ads", platform: "web",
      tokenHash: "aa".repeat(32), verifiedAt: new Date().toISOString(),
    });
    app.createRecord("entitlements", {
      deviceId, productId: "lifetime_pickaxe", platform: "web",
      tokenHash: "bb".repeat(32), verifiedAt: new Date().toISOString(),
    });

    const res = lib.handlers["auth/register"](app, {
      email: "miner@example.com",
      password: PW,
      deviceId,
    });
    expect(res.status).toBe(200);
    expect(res.json.ok).toBe(true);
    const { token } = res.json;
    expect(/^[0-9a-f]{64}$/.test(token)).toBe(true);
    const providers = res.json.account.providers;
    expect(providers.find((p) => p.name === "email").linked).toBe(true);
    expect(providers.find((p) => p.name === "google").linked).toBe(false);

    // Account row: KDF format hash.
    expect(app.rows.accounts.length).toBe(1);
    const acc = app.rows.accounts[0];
    expect(acc.email).toBe("miner@example.com");
    expect(String(acc.passwordHash).startsWith("pbkdf2-sha256:")).toBe(true);

    // Session row exists and is keyed to the account.
    const session = app.rows.authSessions.find((s) => s.token === token);
    expect(session).toBeTruthy();
    expect(session.accountId).toBe(acc.id);

    // Backfill: every device row now carries the account id.
    const cloud = app.rows.cloudSaves.find((r) => r.deviceId === deviceId);
    expect(cloud.accountId).toBe(acc.id);
    const ents = app.rows.entitlements.filter((r) => r.deviceId === deviceId);
    expect(ents.length).toBe(2);
    expect(ents.every((r) => r.accountId === acc.id)).toBe(true);
  });

  test("register refuses an in-use email with 409", () => {
    seedAccount({
      email: "taken@example.com",
      passwordHash: logic.hashPassword(PW, hex(32), sha256hex),
    });
    const res = lib.handlers["auth/register"](app, {
      email: "taken@example.com",
      password: PW,
      deviceId: "11111111-1111-4111-8111-111111111111",
    });
    expect(res.status).toBe(409);
    expect(app.rows.accounts.length).toBe(1);
  });

  test("login returns the SAME error for wrong password and unknown email", () => {
    seedAccount({
      email: "known@example.com",
      passwordHash: logic.hashPassword(PW, hex(32), sha256hex),
    });
    const wrong = lib.handlers["auth/login"](app, {
      email: "known@example.com",
      password: "wrong-password-12345",
      deviceId: "11111111-1111-4111-8111-111111111111",
    });
    const unknown = lib.handlers["auth/login"](app, {
      email: "ghost@example.com",
      password: "whatever-123456",
      deviceId: "11111111-1111-4111-8111-111111111111",
    });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(unknown.json.error).toBe(wrong.json.error);
    // No session rows were created by the failures.
    expect(app.rows.authSessions.length).toBe(0);
  });

  test("login with the right password creates a session", () => {
    seedAccount({
      email: "known@example.com",
      passwordHash: logic.hashPassword(PW, hex(32), sha256hex),
    });
    const res = lib.handlers["auth/login"](app, {
      email: "known@example.com",
      password: PW,
      deviceId: "11111111-1111-4111-8111-111111111111",
    });
    expect(res.status).toBe(200);
    expect(app.rows.authSessions.length).toBe(1);
  });

  test("legacy single-iteration hash is transparently upgraded to the KDF", () => {
    const salt = hex(32);
    const legacyHash = "sha256:" + salt + ":" + sha256hex(salt + ":" + PW);
    const acc = seedAccount({
      email: "legacy@example.com",
      passwordHash: legacyHash,
    });
    const res = lib.handlers["auth/login"](app, {
      email: "legacy@example.com",
      password: PW,
      deviceId: "11111111-1111-4111-8111-111111111111",
    });
    expect(res.status).toBe(200);
    expect(String(acc.passwordHash).startsWith("pbkdf2-sha256:")).toBe(true);
    // And the upgraded hash still verifies on the next login.
    const again = lib.handlers["auth/login"](app, {
      email: "legacy@example.com",
      password: PW,
      deviceId: "11111111-1111-4111-8111-111111111111",
    });
    expect(again.status).toBe(200);
  });
});

// -- provider sign-in (fake-token sandbox) -----------------------------------

describe("auth/google (fake-token sandbox mode)", () => {
  test("first sign-in creates an account pinned to the provider sub", () => {
    const res = lib.handlers["auth/google"](app, {
      deviceId: "22222222-2222-4222-8222-222222222222",
      idToken: fakeToken({ sub: "google-sub-1", email: "g1@example.com" }),
    });
    expect(res.status).toBe(200);
    expect(app.rows.accounts.length).toBe(1);
    const acc = app.rows.accounts[0];
    expect(acc.googleId).toBe("google-sub-1");
    expect(acc.email).toBe("g1@example.com");
    expect(app.rows.authSessions.length).toBe(1);
  });

  test("a second device with the same sub signs into the SAME account", () => {
    const token = fakeToken({ sub: "google-sub-2", email: "g2@example.com" });
    expect(lib.handlers["auth/google"](app, {
      deviceId: "22222222-2222-4222-8222-222222222222", idToken: token,
    }).status).toBe(200);
    expect(lib.handlers["auth/google"](app, {
      deviceId: "33333333-3333-4333-8333-333333333333", idToken: token,
    }).status).toBe(200);
    expect(app.rows.accounts.length).toBe(1);
  });

  test("a verified email merges into the pre-existing email account", () => {
    seedAccount({
      email: "merge@example.com",
      passwordHash: logic.hashPassword(PW, hex(32), sha256hex),
    });
    const res = lib.handlers["auth/google"](app, {
      deviceId: "22222222-2222-4222-8222-222222222222",
      idToken: fakeToken({ sub: "google-sub-3", email: "merge@example.com" }),
    });
    expect(res.status).toBe(200);
    expect(app.rows.accounts.length).toBe(1); // merged, not duplicated
    const acc = app.rows.accounts[0];
    expect(acc.googleId).toBe("google-sub-3");
    expect(acc.email).toBe("merge@example.com");
    expect(String(acc.passwordHash).startsWith("pbkdf2-sha256:")).toBe(true);
  });

  test("an unparseable / invalid idToken is a hard 401 (fail closed)", () => {
    for (const idToken of ["not-a-jwt", "a.b.c", ""]) {
      const res = lib.handlers["auth/google"](app, {
        deviceId: "22222222-2222-4222-8222-222222222222",
        idToken,
      });
      expect(res.status).toBe(401);
    }
    // A well-formed token with an invalid sub is also refused.
    const badSub = fakeToken({ sub: "bad sub with spaces", email: "x@y.z" });
    expect(lib.handlers["auth/google"](app, {
      deviceId: "22222222-2222-4222-8222-222222222222",
      idToken: badSub,
    }).status).toBe(401);
    expect(app.rows.accounts.length).toBe(0);
    expect(app.rows.authSessions.length).toBe(0);
  });
});

// -- me / logout -------------------------------------------------------------

describe("auth/me + auth/logout", () => {
  test("me returns the account shape for a live session", () => {
    const acc = seedAccount({
      email: "me@example.com",
      passwordHash: logic.hashPassword(PW, hex(32), sha256hex),
    });
    const { token } = seedSession(acc.id);
    const res = lib.handlers["auth/me"](app, { token });
    expect(res.status).toBe(200);
    expect(res.json.account.email).toBe("me@example.com");
    expect(res.json.account.providers.find((p) => p.name === "email").linked).toBe(true);
  });

  test("me with a garbage or expired token is a 401 (expired rows are pruned)", () => {
    const acc = seedAccount({ email: "me@example.com" });
    expect(lib.handlers["auth/me"](app, { token: "zz-not-hex" }).status).toBe(401);

    const expired = seedSession(acc.id, { expiresInMs: -1000 });
    const before = app.rows.authSessions.length;
    const res = lib.handlers["auth/me"](app, { token: expired.token });
    expect(res.status).toBe(401);
    expect(app.rows.authSessions.length).toBe(before - 1);
  });

  test("logout invalidates the session (me afterwards is 401, repeat is 200)", () => {
    const acc = seedAccount({ email: "me@example.com" });
    const { token } = seedSession(acc.id);
    expect(lib.handlers["auth/logout"](app, { token }).status).toBe(200);
    expect(app.rows.authSessions.length).toBe(0);
    expect(lib.handlers["auth/me"](app, { token }).status).toBe(401);
    expect(lib.handlers["auth/logout"](app, { token }).status).toBe(200);
  });
});

// -- set-password ------------------------------------------------------------

describe("auth/set-password", () => {
  test("refuses an account that has no email (login would be unusable)", () => {
    const acc = seedAccount({ googleId: "google-sub-9", email: "" });
    const { token } = seedSession(acc.id);
    const res = lib.handlers["auth/set-password"](app, {
      token,
      deviceId: "11111111-1111-4111-8111-111111111111",
      password: "new-password-123456",
    });
    expect(res.status).toBe(400);
  });

  test("changes the password: the old one stops working, the new one logs in", () => {
    seedAccount({
      email: "setpw@example.com",
      passwordHash: logic.hashPassword(PW, hex(32), sha256hex),
    });
    const acc = app.rows.accounts[0];
    const { token } = seedSession(acc.id);
    const newPw = "brand-new-password-9";
    const res = lib.handlers["auth/set-password"](app, {
      token,
      deviceId: "11111111-1111-4111-8111-111111111111",
      password: newPw,
    });
    expect(res.status).toBe(200);
    const loginBody = { email: "setpw@example.com", deviceId: "11111111-1111-4111-8111-111111111111" };
    expect(lib.handlers["auth/login"](app, { ...loginBody, password: PW }).status).toBe(401);
    expect(lib.handlers["auth/login"](app, { ...loginBody, password: newPw }).status).toBe(200);
  });

  test("requires a live session (401 without one)", () => {
    const res = lib.handlers["auth/set-password"](app, {
      token: "nope",
      deviceId: "11111111-1111-4111-8111-111111111111",
      password: "whatever-1234567890",
    });
    expect(res.status).toBe(401);
  });
});

// -- auth/link (device backfill) + auth/link/google ----------------------------

describe("auth/link + auth/link/google", () => {
  test("auth/link attaches the new device's anonymous rows to the account", () => {
    const acc = seedAccount({ email: "link@example.com" });
    const { token } = seedSession(acc.id);
    const deviceId = "44444444-4444-4444-8444-444444444444";
    app.createRecord("cloudSaves", {
      deviceId, blob: "{}", saveVersion: 1, updatedAt: Date.now() - 500,
    });
    app.createRecord("leaderboard", {
      deviceId, displayName: "Deep", bestDepth: 100, maxCombo: 5,
      lifetimeMinerals: 10, achievementIds: "[]", updatedAt: Date.now() - 500,
    });
    const res = lib.handlers["auth/link"](app, { token, deviceId });
    expect(res.status).toBe(200);
    expect(app.rows.cloudSaves.find((r) => r.deviceId === deviceId).accountId).toBe(acc.id);
    expect(app.rows.leaderboard.find((r) => r.deviceId === deviceId).accountId).toBe(acc.id);
  });

  test("auth/link/google: 409 when the provider id belongs to another account", () => {
    seedAccount({ googleId: "google-sub-10" });
    const other = seedAccount({ email: "other@example.com" });
    const { token } = seedSession(other.id);
    const res = lib.handlers["auth/link/google"](app, {
      token,
      deviceId: "11111111-1111-4111-8111-111111111111",
      idToken: fakeToken({ sub: "google-sub-10", email: "other@example.com" }),
    });
    expect(res.status).toBe(409);
    expect(other.googleId).toBe("");
  });

  test("auth/link/google: success pins the provider id (and an unclaimed email)", () => {
    const other = seedAccount({ email: "" });
    const { token } = seedSession(other.id);
    const res = lib.handlers["auth/link/google"](app, {
      token,
      deviceId: "11111111-1111-4111-8111-111111111111",
      idToken: fakeToken({ sub: "google-sub-11", email: "new@example.com" }),
    });
    expect(res.status).toBe(200);
    expect(other.googleId).toBe("google-sub-11");
    expect(other.email).toBe("new@example.com");
  });
});
