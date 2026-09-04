/**
 * Provider-core tests for optional login (auth.ts): the selection matrix
 * (dev/web/unconfigured/configured), the store provider's fetch
 * round-trips against a scripted fetch (register accepted/emailTaken/
 * badCredentials, login, provider sign-in, me alive/dead, logout, link),
 * and the client-side pre-validation. The engine wiring is tested in
 * useAccount.test.ts.
 *
 * storeConfig is a plain const object, so the tests flip
 * `pocketbaseUrl` (and restore it) — same pattern as cloudSave.test.ts.
 * The response shapes mirror pb_hooks/handlerLib.js exactly (signedInReply,
 * the 409/401 bodies, `me` → { account }, link → { ok, account }).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { storeConfig } from "../storeConfig";
import {
  AUTH_PASSWORD_MAX,
  AUTH_PASSWORD_MIN,
  type AuthAccountInfo,
  devSimAuthProvider,
  isValidEmailInput,
  isValidPasswordInput,
  noopAuthProvider,
  pickAuthProvider,
  storeAuthProvider,
} from "../auth";
import { IAP_DEVICE_ID_KEY } from "../iapDeviceId";

const BASE = "https://pb.example.test";
const DEVICE_ID = "abcdefgh234567890123456789";

const ACCOUNT: AuthAccountInfo = {
  email: "dig@er.co",
  providers: [
    { name: "email", linked: true },
    { name: "google", linked: false },
    { name: "apple", linked: false },
  ],
};

/** Scripted fetch: resolves a JSON body + status per call. */
const fetchMock = jest.fn();
const jsonResponse = (body: unknown, status: number) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

async function seedDeviceId() {
  await AsyncStorage.setItem(IAP_DEVICE_ID_KEY, DEVICE_ID);
}

beforeEach(async () => {
  await AsyncStorage.clear();
  await seedDeviceId();
  storeConfig.pocketbaseUrl = BASE;
  fetchMock.mockReset();
  (global.fetch as unknown) = fetchMock;
});

afterEach(() => {
  storeConfig.pocketbaseUrl = "";
});

// -- selection ----------------------------------------------------------------

describe("pickAuthProvider (selection matrix)", () => {
  const sel = (over: Partial<{ dev: boolean; web: boolean; pocketbaseConfigured: boolean }> = {}) => ({
    dev: false,
    web: false,
    pocketbaseConfigured: false,
    ...over,
  });

  it("dev always wins — the in-memory simulation", () => {
    expect(
      pickAuthProvider(sel({ dev: true, pocketbaseConfigured: true })),
    ).toBe(devSimAuthProvider);
  });

  it("web is a no-op, even with the backend configured", () => {
    expect(
      pickAuthProvider(sel({ web: true, pocketbaseConfigured: true })),
    ).toBe(noopAuthProvider);
  });

  it("native without the Pocketbase URL is a no-op (entry points hidden)", () => {
    expect(pickAuthProvider(sel())).toBe(noopAuthProvider);
  });

  it("native production with the URL gets the store provider", () => {
    expect(pickAuthProvider(sel({ pocketbaseConfigured: true }))).toBe(
      storeAuthProvider,
    );
  });
});

// -- store provider: gating ----------------------------------------------------

describe("storeAuthProvider (gating)", () => {
  it("is unavailable and inert while the URL is empty", async () => {
    storeConfig.pocketbaseUrl = "";
    expect(storeAuthProvider.isAvailable()).toBe(false);
    await expect(storeAuthProvider.register("a@b.co", "password1")).resolves.toEqual({
      status: "error",
    });
    await expect(storeAuthProvider.login("a@b.co", "password1")).resolves.toEqual({
      status: "error",
    });
    await expect(storeAuthProvider.providerSignIn("google", "x")).resolves.toEqual({
      status: "error",
    });
    await expect(storeAuthProvider.me("token")).resolves.toBeNull();
    await expect(storeAuthProvider.logout("token")).resolves.toBe(false);
    await expect(storeAuthProvider.link("token")).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is available once the URL is configured", () => {
    expect(storeAuthProvider.isAvailable()).toBe(true);
  });
});

// -- store provider: sign-in round-trips ---------------------------------------

describe("storeAuthProvider.register", () => {
  it("sends the email/password/deviceId and reports the session", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true, token: "t1", account: ACCOUNT }, 200));
    await expect(
      storeAuthProvider.register("dig@er.co", "password1"),
    ).resolves.toEqual({ status: "signedIn", session: { token: "t1", account: ACCOUNT } });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/api/app/auth/register`);
    expect(JSON.parse(init.body)).toEqual({
      email: "dig@er.co",
      password: "password1",
      deviceId: DEVICE_ID,
    });
  });

  it("maps the 409 to emailTaken (the account may be absent — the UI offers 'sign in')", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "email already in use" }, 409));
    await expect(
      storeAuthProvider.register("dig@er.co", "password1"),
    ).resolves.toEqual({
      status: "emailTaken",
      account: { email: "", providers: [] },
    });
  });

  it("maps a network failure to error (retryable, nothing concluded)", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    await expect(
      storeAuthProvider.register("dig@er.co", "password1"),
    ).resolves.toEqual({ status: "error" });
  });

  it("never leaks a malformed reply as a session (no token = error)", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true, account: ACCOUNT }, 200));
    await expect(
      storeAuthProvider.register("dig@er.co", "password1"),
    ).resolves.toEqual({ status: "error" });
  });
});

describe("storeAuthProvider.login", () => {
  it("sends the same body and reports the session on success", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true, token: "t2", account: ACCOUNT }, 200));
    await expect(
      storeAuthProvider.login("dig@er.co", "password1"),
    ).resolves.toEqual({ status: "signedIn", session: { token: "t2", account: ACCOUNT } });
    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/api/app/auth/login`);
  });

  it("maps the 401 to badCredentials (one error for both halves)", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "invalid credentials" }, 401));
    await expect(
      storeAuthProvider.login("dig@er.co", "wrong"),
    ).resolves.toEqual({ status: "badCredentials" });
  });

  it("maps a 429 rate-limit to error (the player can retry)", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "too many requests" }, 429));
    await expect(
      storeAuthProvider.login("dig@er.co", "password1"),
    ).resolves.toEqual({ status: "error" });
  });
});

describe("storeAuthProvider.providerSignIn", () => {
  it("posts the idToken to the provider endpoint", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true, token: "t3", account: ACCOUNT }, 200));
    await expect(
      storeAuthProvider.providerSignIn("google", "id-token"),
    ).resolves.toEqual({ status: "signedIn", session: { token: "t3", account: ACCOUNT } });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/api/app/auth/google`);
    expect(JSON.parse(init.body)).toEqual({ idToken: "id-token", deviceId: DEVICE_ID });
  });

  it("maps the 401 to unverified (the sidecar refused the token)", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: "token verification failed" }, 401),
    );
    await expect(
      storeAuthProvider.providerSignIn("apple", "bad-token"),
    ).resolves.toEqual({ status: "unverified" });
  });
});

// -- store provider: session round-trips ---------------------------------------

describe("storeAuthProvider.me", () => {
  it("resolves the account of a live session", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ account: ACCOUNT }, 200));
    await expect(storeAuthProvider.me("t1")).resolves.toEqual(ACCOUNT);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ token: "t1" });
  });

  it("maps a dead/expired session (401) to null", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "invalid session" }, 401));
    await expect(storeAuthProvider.me("dead")).resolves.toBeNull();
  });

  it("maps a network failure to null (the token stays; retry next launch)", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    await expect(storeAuthProvider.me("t1")).resolves.toBeNull();
  });
});

describe("storeAuthProvider.logout", () => {
  it("is true only on 2xx (idempotent on the server side)", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }, 200));
    await expect(storeAuthProvider.logout("t1")).resolves.toBe(true);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ token: "t1" });
    fetchMock.mockResolvedValue(jsonResponse({ error: "invalid session" }, 401));
    await expect(storeAuthProvider.logout("t1")).resolves.toBe(false);
  });
});

describe("storeAuthProvider.link", () => {
  it("sends the token + deviceId and returns the account", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ ok: true, account: ACCOUNT }, 200),
    );
    await expect(storeAuthProvider.link("t1")).resolves.toEqual(ACCOUNT);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/api/app/auth/link`);
    expect(JSON.parse(init.body)).toEqual({ token: "t1", deviceId: DEVICE_ID });
  });

  it("maps a dead session to null", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "invalid session" }, 401));
    await expect(storeAuthProvider.link("dead")).resolves.toBeNull();
  });
});

// -- dev sim --------------------------------------------------------------------

describe("devSimAuthProvider (the labeled simulation)", () => {
  it("is available and issues in-memory sessions", async () => {
    expect(devSimAuthProvider.isAvailable()).toBe(true);
    const outcome = await devSimAuthProvider.register("sim@dev.co", "password1");
    expect(outcome.status).toBe("signedIn");
    if (outcome.status !== "signedIn") throw new Error("unreachable");
    expect(outcome.session.account.email).toBe("sim@dev.co");
    expect(outcome.session.token.length).toBeGreaterThan(0);
  });

  it("re-registering the same email hits the emailTaken branch", async () => {
    const first = await devSimAuthProvider.register("dup@dev.co", "password1");
    expect(first.status).toBe("signedIn");
    const second = await devSimAuthProvider.register("dup@dev.co", "password2");
    expect(second.status).toBe("emailTaken");
  });

  it("login of an unknown email is badCredentials; a live one resolves", async () => {
    await expect(
      devSimAuthProvider.login("ghost@dev.co", "password1"),
    ).resolves.toEqual({ status: "badCredentials" });
    const reg = await devSimAuthProvider.register("live@dev.co", "password1");
    expect(reg.status).toBe("signedIn");
    if (reg.status !== "signedIn") throw new Error("unreachable");
    await expect(
      devSimAuthProvider.login("live@dev.co", "password1"),
    ).resolves.toEqual({ status: "signedIn", session: reg.session });
  });

  it("me/link honor the token; logout kills it", async () => {
    const reg = await devSimAuthProvider.register("sim2@dev.co", "password1");
    if (reg.status !== "signedIn") throw new Error("unreachable");
    await expect(devSimAuthProvider.me(reg.session.token)).resolves.toEqual(
      reg.session.account,
    );
    await expect(devSimAuthProvider.link(reg.session.token)).resolves.toEqual(
      reg.session.account,
    );
    await expect(devSimAuthProvider.logout(reg.session.token)).resolves.toBe(true);
    await expect(devSimAuthProvider.me(reg.session.token)).resolves.toBeNull();
  });

  it("providerSignIn issues a provider-linked account", async () => {
    const outcome = await devSimAuthProvider.providerSignIn("apple", "id-token");
    expect(outcome.status).toBe("signedIn");
    if (outcome.status !== "signedIn") throw new Error("unreachable");
    const apple = outcome.session.account.providers.find((p) => p.name === "apple");
    expect(apple).toEqual({ name: "apple", linked: true });
  });
});

// -- pre-validation --------------------------------------------------------------

describe("client-side pre-validation", () => {
  it("accepts the server's email domain (6–254 chars, sane shapes)", () => {
    expect(isValidEmailInput("a@b.co")).toBe(true);
    expect(isValidEmailInput("dig.er+tag@example.co.uk")).toBe(true);
    expect(isValidEmailInput("short@b.c")).toBe(false); // < 6
    expect(isValidEmailInput("no-at-sign")).toBe(false);
    expect(isValidEmailInput("@@b.co")).toBe(false); // no local part
    expect(isValidEmailInput("a" + "x".repeat(300) + "@b.co")).toBe(false); // > 254
    expect(isValidEmailInput("  spaced@b.co  ")).toBe(true); // trimmed
  });

  it("accepts the server's password range (8–72)", () => {
    expect(isValidPasswordInput("12345678")).toBe(true);
    expect(isValidPasswordInput("1234567")).toBe(false);
    expect(AUTH_PASSWORD_MIN).toBe(8);
    expect(AUTH_PASSWORD_MAX).toBe(72);
    expect(isValidPasswordInput("x".repeat(72))).toBe(true);
    expect(isValidPasswordInput("x".repeat(73))).toBe(false);
  });
});
