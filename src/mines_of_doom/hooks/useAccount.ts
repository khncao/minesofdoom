/**
 * Optional login — engine wiring (docs/todo.md "Optional login", client
 * half). Consumes the auth provider (auth.ts) and the token store
 * (secureToken.ts) and owns the React state for "who is signed in".
 *
 * What it does, and what it deliberately does NOT do:
 *  - **Restores the session on mount**: read the stored token, resolve it
 *    with `me()`, and drop it if the server says it's dead (30-day
 *    expiry, signed out on another device, GDPR-erased). The player is
 *    never asked for a password the app can't prove anymore.
 *  - **Signs in / out**: register or login → store the token → the claim
 *    (`link()`) attaches this device's pre-existing anonymous rows to
 *    the account (backfill only — the server never copies, so nothing
 *    can be lost or duplicated). Sign out kills the server session
 *    (best effort) and clears the stored token.
 *  - **Exposes `getSessionToken`** — a STABLE callback (reads a ref) the
 *    data hooks (useCloudSave / useLeaderboard / useIap) thread into
 *    their provider calls as the optional `sessionToken`. That is the
 *    whole "signed-in" surface of the data path: with no session it
 *    returns null and every round-trip is exactly the anonymous device
 *    default (guardrail: login is never a prerequisite for anything).
 *
 * It does NOT persist anything in the save (a shared/imported save must
 * never carry a session — the token lives in the OS secure store), and
 * it does NOT touch entitlements or data rows directly (those stay in
 * their own hooks; the server tags them from the token it's handed).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AuthAccountInfo,
  AuthProvider,
  AuthSession,
  AuthSigninOutcome,
} from "../auth";
import type { TokenStore } from "../secureToken";

export type AccountStatus =
  /** The stored token is being resolved (`me()` in flight). */
  | "loading"
  /** No live session — the anonymous device default. */
  | "out"
  /** A live session, signed in. */
  | "in";

export interface AccountOptions {
  provider: AuthProvider;
  tokenStore: TokenStore;
}

export interface AccountHandle {
  status: AccountStatus;
  /** The live session (null unless `status === "in"`). */
  session: AuthSession | null;
  /** The account view (null unless signed in) — for the settings line. */
  account: AuthAccountInfo | null;
  /** The STABLE token accessor the data hooks thread into their
   *  provider calls (null = anonymous device default). */
  getSessionToken: () => string | null;
  /** The provider's availability flag (the settings section renders only
   *  when true — the "hidden until configured" rule). */
  available: boolean;
  /** True on a dev build (the labeled in-memory simulation). */
  isDevSim: boolean;
  /** Register a new account (email/password). The claim runs after the
   *  sign-in succeeds. Resolves the outcome for the UI's inline copy. */
  register: (
    email: string,
    password: string,
  ) => Promise<AuthSigninOutcome>;
  /** Log into an existing account (the single error path). */
  login: (
    email: string,
    password: string,
  ) => Promise<AuthSigninOutcome>;
  /** Google/Apple sign-in (the native SDK mints the idToken). */
  providerSignIn: (
    kind: "google" | "apple",
    idToken: string,
  ) => Promise<AuthSigninOutcome>;
  /** Sign out: kill the server session (best effort) + clear the token. */
  signOut: () => Promise<void>;
}

/** After a successful sign-in: persist the token, then run the claim.
 *  The claim is best effort — the server ALREADY backfilled the device's
 *  rows during the sign-in round-trip (pb_hooks linkDeviceRows); the
 *  explicit link is the UI-visible confirmation of the claim flow and
 *  the safety net for rows that appeared between the two calls. A failed
 *  claim never un-signs the player (the session is live either way). */
async function adoptSession(
  provider: AuthProvider,
  tokenStore: TokenStore,
  session: AuthSession,
): Promise<boolean> {
  const stored = await tokenStore.setToken(session.token).catch(() => false);
  if (!stored) {
    // The token can't be secured (no keychain, memory fallback also
    // failed — should be impossible, but the contract says never
    // reject): keep the session for this run so the player is not
    // locked out mid-flow, but report it so the UI can say "this
    // device's secure storage is unavailable".
    console.warn("account: could not secure the session token");
    return false;
  }
  await provider.link(session.token).catch(() => null);
  return true;
}

export function useAccount(opts: AccountOptions): AccountHandle {
  const [status, setStatus] = useState<AccountStatus>("loading");
  const [session, setSession] = useState<AuthSession | null>(null);

  const provider = opts.provider;
  const tokenStore = opts.tokenStore;

  // Refs so the stable callbacks below always see the latest session
  // without re-subscribing (same pattern as useCloudSave's refs).
  const sessionRef = useRef<AuthSession | null>(null);
  sessionRef.current = session;
  const providerRef = useRef(provider);
  providerRef.current = provider;
  const tokenStoreRef = useRef(tokenStore);
  tokenStoreRef.current = tokenStore;

  // Session restore on mount (once per app run).
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    void (async () => {
      const token = await tokenStoreRef.current.getToken().catch(() => null);
      if (token === null) {
        setStatus("out");
        return;
      }
      const account = await providerRef.current.me(token).catch(() => null);
      if (account === null) {
        // Dead/expired session: drop the stale token, stay anonymous.
        await tokenStoreRef.current.clearToken().catch(() => true);
        setStatus("out");
        return;
      }
      setSession({ token, account });
      setStatus("in");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getSessionToken = useCallback(
    () => sessionRef.current?.token ?? null,
    [],
  );

  /** `credential` is the password (email kinds) or the provider idToken
   *  (google/apple) — the provider interface takes one string either way. */
  const finishSignIn = useCallback(
    async (
      kind: "register" | "login" | "google" | "apple",
      email: string,
      credential: string,
    ) => {
      const prov = providerRef.current;
      const outcome =
        kind === "register"
          ? await prov.register(email, credential)
          : kind === "login"
            ? await prov.login(email, credential)
            : await prov.providerSignIn(kind, credential);
      if (outcome.status !== "signedIn") return outcome;
      setSession(outcome.session);
      setStatus("in");
      void adoptSession(prov, tokenStoreRef.current, outcome.session);
      return { status: "signedIn" as const, session: outcome.session };
    },
    [],
  );

  const register = useCallback(
    (email: string, password: string) =>
      finishSignIn("register", email, password),
    [finishSignIn],
  );

  const login = useCallback(
    (email: string, password: string) =>
      finishSignIn("login", email, password),
    [finishSignIn],
  );

  const providerSignIn = useCallback(
    (kind: "google" | "apple", idToken: string) =>
      finishSignIn(kind, "", idToken),
    [finishSignIn],
  );

  const signOut = useCallback(async () => {
    const current = sessionRef.current;
    setSession(null);
    setStatus("out");
    await tokenStoreRef.current.clearToken().catch(() => true);
    if (current !== null) {
      await providerRef.current.logout(current.token).catch(() => false);
    }
  }, []);

  return {
    status,
    session,
    account: session?.account ?? null,
    getSessionToken,
    available: provider.isAvailable(),
    isDevSim: provider.id === "dev-sim",
    register,
    login,
    providerSignIn,
    signOut,
  };
}
