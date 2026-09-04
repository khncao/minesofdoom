/**
 * Optional login (docs/todo.md "Optional login", server half in
 * pb_hooks/): the account REST client.
 *
 * Identity model (the one the whole feature is built on): **anonymous
 * device play is the default and stays untouched** — everything here is
 * additive. An account is optional; signing in never moves or duplicates
 * data (the server only backfills an account tag onto rows this device
 * already owns). Login is therefore never a prerequisite for any feature
 * (guardrail: F2P parity).
 *
 * This module is the provider core, mirroring cloudSave.ts /
 * iapProvider.ts: pure fetch round-trips to the Pocketbase hook
 * endpoints (same base URL gate, same 20s timeout, same "never reject"
 * contract). The session token itself is NOT stored here — that is the
 * token store's job (secureToken.ts, Keychain/Keystore; never AsyncStorage)
 * — the hook (useAccount.ts) holds the session and the settings UI
 * (components/AccountSection.tsx) renders it.
 *
 * REST contract (mirrored by the server, pb_hooks/README.md — the "Optional
 * login" table; every reply carries a 30-day `token`):
 *   POST {base}/api/app/auth/register { email, password, deviceId }
 *        → { ok, token, account }        // 409: email already in use
 *   POST {base}/api/app/auth/login     { email, password, deviceId }
 *        → { ok, token, account }        // 401: one error for both halves
 *   POST {base}/api/app/auth/google    { idToken, deviceId }
 *   POST {base}/api/app/auth/apple     { idToken, deviceId }
 *        → { ok, token, account }        // 401: unverified idToken
 *   POST {base}/api/app/auth/me        { token }
 *        → { account }                   // 401: dead/expired session
 *   POST {base}/api/app/auth/logout    { token } → { ok: true } (idempotent)
 *   POST {base}/api/app/auth/link      { token, deviceId }
 *        → { ok, account }              // claim: attach this device's rows
 *
 * Account shape in replies (pb_hooks logic.accountShape): `{ email,
 * providers: [{ name, linked }] }` — no hashes, no raw provider ids.
 *
 * Gating: same rule as the ad/IAP/cloud providers — until the Pocketbase
 * URL is configured (and always on web, where the other store integrations
 * are no-ops by construction) the no-op provider keeps every sign-in entry
 * point hidden.
 */
import { Platform } from "react-native";
import { isPocketbaseConfigured, storeConfig } from "./storeConfig";
import { getIapDeviceId } from "./iapDeviceId";

/** The three sign-in mechanisms (the decision recorded in
 *  docs/blockers.md: all three, side by side). */
export type AuthProviderKind = "email" | "google" | "apple";

/** One linked-provider row of the account shape. */
export interface AuthProviderLink {
  name: AuthProviderKind;
  /** True when this mechanism is attached to the account. */
  linked: boolean;
}

/** The account as the server shapes it (no hashes, no raw provider ids).
 *  `email` is "" for an account created without one (e.g. an Apple
 *  private-relay account whose provider id is the identity). */
export interface AuthAccountInfo {
  email: string;
  providers: AuthProviderLink[];
}

/** A live session: the opaque 30-day token + the account it resolves to. */
export interface AuthSession {
  token: string;
  account: AuthAccountInfo;
}

/**
 * The outcome of a sign-in attempt (register / login / provider sign-in).
 *  - `signedIn`: the server issued a session (the token is what the token
 *    store persists).
 *  - `emailTaken`: register hit a 409 — the account exists; the UI offers
 *    "sign in instead" (the account shape comes along so the claim flow
 *    can name it).
 *  - `badCredentials`: login 401 — one error for both halves (the server
 *    never confirms which half is wrong; the UI must not either).
 *  - `unverified`: provider idToken 401 — the server's identity sidecar
 *    refused it (fail closed; a dev build without a real Google/Apple
 *    account hits exactly this).
 *  - `error`: network / non-JSON / rate-limited — nothing concluded, the
 *    player can retry.
 */
export type AuthSigninOutcome =
  | { status: "signedIn"; session: AuthSession }
  | { status: "emailTaken"; account: AuthAccountInfo }
  | { status: "badCredentials" }
  | { status: "unverified" }
  | { status: "error" };

export interface AuthProvider {
  /** Stable id for logs/panels ("noop", "dev-sim", "pocketbase"). */
  readonly id: string;
  /** Whether sign-in can happen on this platform right now. */
  isAvailable(): boolean;
  /** Email/password register. Resolves (never rejects). */
  register(email: string, password: string): Promise<AuthSigninOutcome>;
  /** Email/password login (one error for both halves). */
  login(email: string, password: string): Promise<AuthSigninOutcome>;
  /** Google/Apple sign-in with a provider idToken (the native SDKs mint
   *  the idToken; the server's sidecar verifies it). */
  providerSignIn(
    kind: "google" | "apple",
    idToken: string,
  ): Promise<AuthSigninOutcome>;
  /** Resolve a stored token to its account, or null (dead/expired
   *  session, or a round-trip that ended in "nothing we can trust"). */
  me(token: string): Promise<AuthAccountInfo | null>;
  /** Kill the session on the server (idempotent). Best effort: resolves
   *  true only on 2xx, but a `false` is not an error the UI should show. */
  logout(token: string): Promise<boolean>;
  /** The claim: attach this device's pre-existing anonymous rows to the
   *  signed-in account (backfill only — nothing is copied or created).
   *  Resolves the (possibly updated) account, or null on failure. */
  link(token: string): Promise<AuthAccountInfo | null>;
}

// -- client-side pre-validation (the server re-checks everything; this
//    just keeps obviously-bad input out of the network round-trip) ----

/** Same shape the server's EMAIL_RE accepts (mirrors pb_hooks/logic.js);
 *  the server stays the source of truth, this is a pre-flight only. */
const EMAIL_RE =
  /^[a-z0-9._%+-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/;

/** pb_hooks/logic.js PASSWORD_MIN_LENGTH / PASSWORD_MAX_LENGTH. */
export const AUTH_PASSWORD_MIN = 8;
export const AUTH_PASSWORD_MAX = 72;

/** Pre-flight the form's input before it goes to the network (the server
 *  re-validates and stays the source of truth). */
export function isValidEmailInput(email: string): boolean {
  const e = email.trim().toLowerCase();
  return e.length >= 6 && e.length <= 254 && EMAIL_RE.test(e);
}

export function isValidPasswordInput(password: string): boolean {
  return password.length >= AUTH_PASSWORD_MIN && password.length <= AUTH_PASSWORD_MAX;
}

// -- the fetch round-trip (auth is the one data path that NEEDS the HTTP
// status — 409/401 are distinct outcomes, not "failure") ----------------

const HTTP_TIMEOUT_MS = 20 * 1000;

/** POST JSON keeping the status code (cloudSave's postJson folds every
 *  non-2xx to null, which would erase the 409/401 distinction). Returns
 *  null on a network-level failure (timeout, offline, DNS). */
async function postJsonWithStatus(
  url: string,
  body: unknown,
): Promise<{ status: number; body: Record<string, unknown> | null } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    let parsedBody: Record<string, unknown> | null = null;
    try {
      const parsed: unknown = await res.json();
      if (typeof parsed === "object" && parsed !== null) {
        parsedBody = parsed as Record<string, unknown>;
      }
    } catch {
      /* non-JSON body (e.g. a 413 from a proxy) — the status alone is
         enough for the outcome mapping below */
    }
    return { status: res.status, body: parsedBody };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// -- strict reply parsing (the UI must never render a malformed account)

function parseAccount(raw: unknown): AuthAccountInfo | null {
  if (typeof raw !== "object" || raw === null) return null;
  const a = raw as Partial<AuthAccountInfo>;
  if (typeof a.email !== "string") return null;
  if (!Array.isArray(a.providers)) return null;
  const names: AuthProviderKind[] = ["email", "google", "apple"];
  const providers: AuthProviderLink[] = [];
  for (const name of names) {
    const p = a.providers.find((x) => x && x.name === name);
    if (p) providers.push({ name, linked: p.linked === true });
  }
  if (providers.length === 0) return null;
  return { email: a.email, providers };
}

function parseSignedIn(
  status: number,
  body: Record<string, unknown> | null,
): AuthSigninOutcome {
  if (status === 409 && body !== null) {
    const account = parseAccount(body.account);
    if (account) return { status: "emailTaken", account };
    return { status: "emailTaken", account: { email: "", providers: [] } };
  }
  if (status === 401) return { status: "badCredentials" };
  if (status < 200 || status >= 300) return { status: "error" };
  const token = body?.token;
  if (typeof token !== "string" || token.length === 0 || body === null) {
    return { status: "error" };
  }
  const account = parseAccount(body.account);
  if (account === null) return { status: "error" };
  return { status: "signedIn", session: { token, account } };
}

/** The provider sign-in's 401 is a distinct outcome ("unverified") — the
 *  dev-build copy for it is specific (no real Google/Apple account). */
function parseProviderSignedIn(
  status: number,
  body: Record<string, unknown> | null,
): AuthSigninOutcome {
  if (status === 401) return { status: "unverified" };
  if (status < 200 || status >= 300) return { status: "error" };
  const token = body?.token;
  if (typeof token !== "string" || token.length === 0 || body === null) {
    return { status: "error" };
  }
  const account = parseAccount(body.account);
  if (account === null) return { status: "error" };
  return { status: "signedIn", session: { token, account } };
}

// -- the providers ---------------------------------------------------------

export const noopAuthProvider: AuthProvider = {
  id: "noop",
  isAvailable: () => false,
  register: async () => ({ status: "error" }),
  login: async () => ({ status: "error" }),
  providerSignIn: async () => ({ status: "error" }),
  me: async () => null,
  logout: async () => false,
  link: async () => null,
};

/**
 * Development-build-only provider: an in-memory accounts map so the full
 * sign-in UI (form, claim line, sign out, session restore via `me`) can be
 * exercised on a dev build WITHOUT touching the live Pocketbase. It never
 * survives a restart — like the cloud dev sim, a dev build must not pretend
 * to be a durable identity provider (transparency guardrail).
 */
const devSimSessions = new Map<string, AuthSession>();
let devSimCounter = 0;
export const devSimAuthProvider: AuthProvider = {
  id: "dev-sim",
  isAvailable: () => true,
  async register(email) {
    const account: AuthAccountInfo = {
      email: email.trim().toLowerCase(),
      providers: [{ name: "email", linked: true }],
    };
    // The emailTaken half is still reachable in dev (register the same
    // email twice in one run) so the UI branch is testable on device.
    for (const s of devSimSessions.values()) {
      if (s.account.email === account.email) {
        return { status: "emailTaken", account };
      }
    }
    const session = { token: `dev-token-${devSimCounter++}`, account };
    devSimSessions.set(session.token, session);
    return { status: "signedIn", session };
  },
  async login(email) {
    const normalized = email.trim().toLowerCase();
    for (const session of devSimSessions.values()) {
      if (session.account.email === normalized) {
        return { status: "signedIn", session };
      }
    }
    return { status: "badCredentials" };
  },
  async providerSignIn(kind) {
    const account: AuthAccountInfo = {
      email: "",
      providers: [{ name: "email", linked: false }, { name: kind, linked: true }],
    };
    const session = {
      token: `dev-token-${devSimCounter++}`,
      account,
    };
    devSimSessions.set(session.token, session);
    return { status: "signedIn", session };
  },
  async me(token) {
    const session = devSimSessions.get(token);
    return session ? session.account : null;
  },
  async logout(token) {
    return devSimSessions.delete(token);
  },
  async link(token) {
    const session = devSimSessions.get(token);
    return session ? session.account : null;
  },
};

/**
 * The real provider: fetch round-trips to the Pocketbase auth endpoints.
 * Selected by `pickAuthProvider` for a native production build with the
 * Pocketbase URL configured; entry points stay hidden until then.
 */
export const storeAuthProvider: AuthProvider = {
  id: "pocketbase",
  isAvailable: () => isPocketbaseConfigured(),

  async register(email, password) {
    if (!isPocketbaseConfigured()) return { status: "error" };
    const deviceId = await getIapDeviceId();
    const res = await postJsonWithStatus(
      `${storeConfig.pocketbaseUrl}/api/app/auth/register`,
      { email, password, deviceId },
    );
    if (res === null) return { status: "error" };
    return parseSignedIn(res.status, res.body);
  },

  async login(email, password) {
    if (!isPocketbaseConfigured()) return { status: "error" };
    const deviceId = await getIapDeviceId();
    const res = await postJsonWithStatus(
      `${storeConfig.pocketbaseUrl}/api/app/auth/login`,
      { email, password, deviceId },
    );
    if (res === null) return { status: "error" };
    return parseSignedIn(res.status, res.body);
  },

  async providerSignIn(kind, idToken) {
    if (!isPocketbaseConfigured()) return { status: "error" };
    const deviceId = await getIapDeviceId();
    const res = await postJsonWithStatus(
      `${storeConfig.pocketbaseUrl}/api/app/auth/${kind}`,
      { idToken, deviceId },
    );
    if (res === null) return { status: "error" };
    return parseProviderSignedIn(res.status, res.body);
  },

  async me(token) {
    if (!isPocketbaseConfigured()) return null;
    const res = await postJsonWithStatus(
      `${storeConfig.pocketbaseUrl}/api/app/auth/me`,
      { token },
    );
    if (res === null) return null;
    if (res.status < 200 || res.status >= 300) return null; // 401: dead
    return parseAccount(res.body?.account);
  },

  async logout(token) {
    if (!isPocketbaseConfigured()) return false;
    const res = await postJsonWithStatus(
      `${storeConfig.pocketbaseUrl}/api/app/auth/logout`,
      { token },
    );
    return res !== null && res.status >= 200 && res.status < 300;
  },

  async link(token) {
    if (!isPocketbaseConfigured()) return null;
    const deviceId = await getIapDeviceId();
    const res = await postJsonWithStatus(
      `${storeConfig.pocketbaseUrl}/api/app/auth/link`,
      { token, deviceId },
    );
    if (res === null) return null;
    if (res.status < 200 || res.status >= 300) return null;
    return parseAccount(res.body?.account);
  },
};

/** The inputs to provider selection — a pure decision so the swap point
 *  stays unit-testable (same pattern as pickCloudSaveProvider). */
export type AuthProviderSelection = {
  /** `__DEV__` — the dev build always runs the labeled simulation. */
  dev: boolean;
  /** Web target: always the no-op (the store integrations are no-ops on
   *  web by construction; sign-in follows suit). */
  web: boolean;
  /** `isPocketbaseConfigured()` (storeConfig.ts). */
  pocketbaseConfigured: boolean;
};

/**
 * Pure provider selection. The rules, in order (mirror of
 * pickCloudSaveProvider):
 *  1. dev always wins — the in-memory simulation makes the sign-in UI
 *     testable without the live backend.
 *  2. web is a no-op by construction.
 *  3. native production: the real provider only once the Pocketbase URL
 *     is configured; until then the no-op keeps entry points hidden.
 */
export function pickAuthProvider(sel: AuthProviderSelection): AuthProvider {
  if (sel.dev) return devSimAuthProvider;
  if (sel.web) return noopAuthProvider;
  if (!sel.pocketbaseConfigured) return noopAuthProvider;
  return storeAuthProvider;
}

/** The one call the engine uses to get its provider. */
export function selectAuthProvider(dev: boolean): AuthProvider {
  return pickAuthProvider({
    dev,
    web: Platform.OS === "web",
    pocketbaseConfigured: isPocketbaseConfigured(),
  });
}
