/**
 * Engine-wiring tests for optional login (useAccount.ts): session restore
 * on mount (live token → signed in; dead token → cleared), the sign-in
 * flows (token secured + the claim `link` runs best-effort; failures keep
 * the player out, never half-in), sign out (token cleared + server
 * session killed), and the stable getSessionToken accessor the data
 * hooks thread into their provider calls. Providers and the token store
 * are scripted fakes — the real fetch round-trips are pinned in
 * auth.test.ts, the real stores in secureToken.test.ts.
 */
import { act, renderHook } from "@testing-library/react-native";
import type { AuthAccountInfo, AuthProvider } from "../auth";
import type { TokenStore } from "../secureToken";
import { useAccount } from "../hooks/useAccount";

const ACCOUNT: AuthAccountInfo = {
  email: "dig@er.co",
  providers: [
    { name: "email", linked: true },
    { name: "google", linked: false },
    { name: "apple", linked: false },
  ],
};

function makeTokenStore(initial: string | null = null) {
  let token: string | null = initial;
  return {
    id: "fake",
    token: () => token,
    getToken: jest.fn(async () => token),
    setToken: jest.fn(async (t: string) => {
      token = t;
      return true;
    }),
    clearToken: jest.fn(async () => {
      token = null;
      return true;
    }),
  };
}

function makeProvider(
  overrides: Partial<AuthProvider> = {},
): AuthProvider {
  return {
    id: "fake",
    isAvailable: () => true,
    register: jest.fn(async (email: string) => ({
      status: "signedIn" as const,
      session: { token: `tok-${email}`, account: ACCOUNT },
    })),
    login: jest.fn(async () => ({
      status: "signedIn" as const,
      session: { token: "tok-login", account: ACCOUNT },
    })),
    providerSignIn: jest.fn(async () => ({
      status: "signedIn" as const,
      session: { token: "tok-provider", account: ACCOUNT },
    })),
    me: jest.fn(async (token: string) =>
      token === "tok-dead" ? null : ACCOUNT,
    ),
    logout: jest.fn(async () => true),
    link: jest.fn(async () => ACCOUNT),
    ...overrides,
  };
}

/** Let the hook's fire-and-forget chains (the claim link, the adopt)
 *  flush before asserting. */
async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useAccount: session restore on mount", () => {
  it("stays out when no token is stored", async () => {
    const tokenStore = makeTokenStore(null);
    const provider = makeProvider();
    const { result } = renderHook(() =>
      useAccount({ provider, tokenStore }),
    );
    await flush();
    expect(result.current.status).toBe("out");
    expect(result.current.getSessionToken()).toBeNull();
    expect(provider.me).not.toHaveBeenCalled();
  });

  it("restores a live token to the signed-in state", async () => {
    const tokenStore = makeTokenStore("tok-live");
    const provider = makeProvider();
    const { result } = renderHook(() =>
      useAccount({ provider, tokenStore }),
    );
    await flush();
    expect(result.current.status).toBe("in");
    expect(result.current.account).toEqual(ACCOUNT);
    expect(result.current.getSessionToken()).toBe("tok-live");
    expect(provider.me).toHaveBeenCalledWith("tok-live");
  });

  it("drops a dead token (the server expired/erased it) and stays out", async () => {
    const tokenStore = makeTokenStore("tok-dead");
    const provider = makeProvider();
    const { result } = renderHook(() =>
      useAccount({ provider, tokenStore }),
    );
    await flush();
    expect(result.current.status).toBe("out");
    expect(result.current.getSessionToken()).toBeNull();
    expect(tokenStore.clearToken).toHaveBeenCalledTimes(1);
    expect(tokenStore.token()).toBeNull();
  });
});

describe("useAccount: sign-in", () => {
  it("register secures the token and runs the claim (link)", async () => {
    const tokenStore = makeTokenStore();
    const provider = makeProvider();
    const { result } = renderHook(() =>
      useAccount({ provider, tokenStore }),
    );
    await flush();
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.register("dig@er.co", "password1");
    });
    expect(outcome).toEqual({
      status: "signedIn",
      session: { token: "tok-dig@er.co", account: ACCOUNT },
    });
    await flush();
    expect(result.current.status).toBe("in");
    expect(result.current.getSessionToken()).toBe("tok-dig@er.co");
    expect(tokenStore.setToken).toHaveBeenCalledWith("tok-dig@er.co");
    // The claim: the device's pre-existing rows attach to the account.
    expect(provider.link).toHaveBeenCalledWith("tok-dig@er.co");
  });

  it("login does the same round of work", async () => {
    const tokenStore = makeTokenStore();
    const provider = makeProvider();
    const { result } = renderHook(() =>
      useAccount({ provider, tokenStore }),
    );
    await flush();
    await act(async () => {
      await result.current.login("dig@er.co", "password1");
    });
    await flush();
    expect(result.current.status).toBe("in");
    expect(tokenStore.setToken).toHaveBeenCalledWith("tok-login");
    expect(provider.link).toHaveBeenCalledWith("tok-login");
  });

  it("a failed sign-in (emailTaken) leaves the player out and stores nothing", async () => {
    const tokenStore = makeTokenStore();
    const provider = makeProvider({
      register: jest.fn(async () => ({
        status: "emailTaken" as const,
        account: ACCOUNT,
      })),
    });
    const { result } = renderHook(() =>
      useAccount({ provider, tokenStore }),
    );
    await flush();
    await act(async () => {
      await result.current.register("dig@er.co", "password1");
    });
    expect(result.current.status).toBe("out");
    expect(tokenStore.setToken).not.toHaveBeenCalled();
    expect(provider.link).not.toHaveBeenCalled();
  });

  it("the claim failing never un-signs the player (the session is live either way)", async () => {
    const tokenStore = makeTokenStore();
    const provider = makeProvider({
      link: jest.fn(async () => {
        throw new Error("network");
      }),
    });
    const { result } = renderHook(() =>
      useAccount({ provider, tokenStore }),
    );
    await flush();
    await act(async () => {
      await result.current.login("dig@er.co", "password1");
    });
    await flush();
    expect(result.current.status).toBe("in");
    expect(result.current.getSessionToken()).toBe("tok-login");
  });
});

describe("useAccount: sign out", () => {
  it("clears the stored token and kills the server session (best effort)", async () => {
    const tokenStore = makeTokenStore("tok-live");
    const provider = makeProvider();
    const { result } = renderHook(() =>
      useAccount({ provider, tokenStore }),
    );
    await flush();
    expect(result.current.status).toBe("in");
    await act(async () => {
      await result.current.signOut();
    });
    expect(result.current.status).toBe("out");
    expect(result.current.getSessionToken()).toBeNull();
    expect(tokenStore.clearToken).toHaveBeenCalled();
    expect(provider.logout).toHaveBeenCalledWith("tok-live");
  });

  it("signing out twice is a no-op the second time (no second logout call)", async () => {
    const tokenStore = makeTokenStore();
    const provider = makeProvider();
    const { result } = renderHook(() =>
      useAccount({ provider, tokenStore }),
    );
    await flush();
    await act(async () => {
      await result.current.signOut();
      await result.current.signOut();
    });
    expect(provider.logout).not.toHaveBeenCalled();
  });
});

describe("useAccount: pass-through flags", () => {
  it("surfaces the provider availability and dev-sim flags", async () => {
    const tokenStore = makeTokenStore();
    const provider = makeProvider({ id: "dev-sim" });
    const { result } = renderHook(() =>
      useAccount({ provider, tokenStore }),
    );
    await flush();
    expect(result.current.available).toBe(true);
    expect(result.current.isDevSim).toBe(true);
  });
});

/** The token store's failure contract: a store that throws (the keychain
 *  degrades to memory internally, so this is the last line) must never
 *  break the hook. */
describe("useAccount: a broken token store", () => {
  it("a throwing store keeps sign-in working for the current run", async () => {
    const broken: TokenStore = {
      id: "broken",
      getToken: jest.fn(async () => {
        throw new Error("nope");
      }),
      setToken: jest.fn(async () => false),
      clearToken: jest.fn(async () => false),
    };
    const provider = makeProvider();
    const { result } = renderHook(() =>
      useAccount({ provider, tokenStore: broken }),
    );
    await flush();
    // getToken threw → treated as "no token" (stay out, don't crash).
    expect(result.current.status).toBe("out");
    await act(async () => {
      await result.current.login("dig@er.co", "password1");
    });
    await flush();
    // setToken failed → the session still lives for THIS run (React
    // state), the warning is in the logs, and the claim is skipped
    // (a token that can't be secured shouldn't be claimed): a restart
    // starts anonymous, which the restore path above covers.
    expect(result.current.status).toBe("in");
    expect(result.current.getSessionToken()).toBe("tok-login");
    expect(provider.link).not.toHaveBeenCalled();
  });
});
