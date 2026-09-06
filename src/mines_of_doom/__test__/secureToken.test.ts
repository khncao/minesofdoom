/**
 * Token-store tests (secureToken.ts): the memory store's round-trip, the
 * keychain wrapper (service/account pair, the "absent" sentinel, and the
 * degrade-to-memory path when the OS store throws), and the selection
 * (native → keychain; the web branch is the same ternary reading
 * Platform.OS, pinned by the native case below since the jest-expo
 * default platform is ios).
 *
 * react-native-keychain is mocked — the real module talks to the OS
 * Keychain/Keystore, which a jest run has no access to.
 */
import { Platform } from "react-native";

// __esModule: jest-expo's transform otherwise exposes the factory's
// object only as `.default` (the `import * as` namespace gets no names).
// Everything lives INSIDE the factory: imports are hoisted, so the
// factory can run before any module-level const is initialized (a
// spread of an out-of-scope const would hit the TDZ and mock an empty
// object).
jest.mock("react-native-keychain", () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    __store: store,
    setGenericPassword: jest.fn(
      async (_account: string, password: string, options: { service: string }) => {
        // v10: one username/password pair per service.
        store.set(options.service, password);
        return { service: options.service, storage: "mock" };
      },
    ),
    getGenericPassword: jest.fn(
      async (options: { service: string }) => {
        const value = store.get(options.service);
        return value === undefined
          ? false
          : { service: options.service, username: "sessionToken", password: value, storage: "mock" };
      },
    ),
    resetGenericPassword: jest.fn(
      async (options: { service: string }) => {
        store.delete(options.service);
        return true;
      },
    ),
  };
});

import * as KeychainMockModule from "react-native-keychain";

/** The mocked module's own jest.fn instances (the same references the
 *  store under test calls) + the fake credential store. */
type MockKeychain = {
  setGenericPassword: jest.Mock;
  getGenericPassword: jest.Mock;
  resetGenericPassword: jest.Mock;
  __store: Map<string, string>;
};
const mockKeychain = KeychainMockModule as unknown as MockKeychain;
const mockKeychainStore = mockKeychain.__store;

import {
  TOKEN_ACCOUNT,
  TOKEN_SERVICE,
  WEB_TOKEN_KEY,
  keychainTokenStore,
  localTokenStore,
  memoryTokenStore,
  selectTokenStore,
} from "../secureToken";

type FakeLocalStorage = {
  store: Map<string, string>;
  getItem: (k: string) => string | null;
  setItem: (k: string, v: string) => void;
  removeItem: (k: string) => void;
};

function makeFakeWindow(localStorage?: Storage) {
  const w = { localStorage };
  (globalThis as Record<string, unknown>).window = w;
  return w;
}

function clearFakeWindow() {
  delete (globalThis as Record<string, unknown>).window;
}

/** Reset the (module-level) memory store; the token is a secret-shaped
 *  string, so a test leak between cases would be confusing. */
async function resetMemoryStore() {
  if (await memoryTokenStore.getToken()) {
    await memoryTokenStore.clearToken();
  }
}

beforeEach(async () => {
  mockKeychainStore.clear();
  mockKeychain.setGenericPassword.mockClear();
  mockKeychain.getGenericPassword.mockClear();
  mockKeychain.resetGenericPassword.mockClear();
  await resetMemoryStore();
});

describe("memoryTokenStore", () => {
  it("round-trips a token and reports absence as null", async () => {
    expect(memoryTokenStore.id).toBe("memory");
    await expect(memoryTokenStore.getToken()).resolves.toBeNull();
    await expect(memoryTokenStore.setToken("tok-1")).resolves.toBe(true);
    await expect(memoryTokenStore.getToken()).resolves.toBe("tok-1");
    await expect(memoryTokenStore.clearToken()).resolves.toBe(true);
    await expect(memoryTokenStore.getToken()).resolves.toBeNull();
    // clearToken is idempotent — "nothing to delete" is a success.
    await expect(memoryTokenStore.clearToken()).resolves.toBe(true);
  });
});

describe("keychainTokenStore", () => {
  it("stores under the app's service + account pair", async () => {
    expect(TOKEN_SERVICE).toBe("com.minus4kelvin.minesofdoom");
    expect(TOKEN_ACCOUNT).toBe("sessionToken");
    await expect(keychainTokenStore.setToken("tok-2")).resolves.toBe(true);
    expect(mockKeychain.setGenericPassword).toHaveBeenCalledWith(
      "sessionToken",
      "tok-2",
      { service: TOKEN_SERVICE },
    );
    await expect(keychainTokenStore.getToken()).resolves.toBe("tok-2");
    // v10 takes no username in the get options — the service is the key.
    expect(mockKeychain.getGenericPassword).toHaveBeenCalledWith({
      service: TOKEN_SERVICE,
    });
  });

  it("reports absence as null (the SDK's `false` sentinel)", async () => {
    await expect(keychainTokenStore.getToken()).resolves.toBeNull();
  });

  it("clearToken resolves true whether or not an entry existed", async () => {
    await expect(keychainTokenStore.clearToken()).resolves.toBe(true);
    await keychainTokenStore.setToken("tok-3");
    await expect(keychainTokenStore.clearToken()).resolves.toBe(true);
    await expect(keychainTokenStore.getToken()).resolves.toBeNull();
  });

  it("degrades to the memory store when the OS store throws (a token that can't be secured never goes plaintext)", async () => {
    mockKeychain.setGenericPassword.mockRejectedValueOnce(
      new Error("keychain locked"),
    );
    await expect(keychainTokenStore.setToken("tok-4")).resolves.toBe(true);
    // The token is still readable for THIS run (memory fallback).
    await expect(memoryTokenStore.getToken()).resolves.toBe("tok-4");
    mockKeychain.getGenericPassword.mockRejectedValueOnce(
      new Error("keychain locked"),
    );
    await expect(keychainTokenStore.getToken()).resolves.toBe("tok-4");
    mockKeychain.resetGenericPassword.mockRejectedValueOnce(
      new Error("keychain locked"),
    );
    await expect(keychainTokenStore.clearToken()).resolves.toBe(true);
    await expect(memoryTokenStore.getToken()).resolves.toBeNull();
  });
});

describe("selectTokenStore", () => {
  it("picks the keychain store on a native platform (jest-expo runs ios)", () => {
    if (Platform.OS === "web") {
      // The web build runs the localStorage store by construction (a
      // session must survive a page reload — web sign-in is real now).
      expect(selectTokenStore()).toBe(localTokenStore);
      return;
    }
    expect(selectTokenStore()).toBe(keychainTokenStore);
  });
});

describe("localTokenStore (the web store)", () => {
  let storage: FakeLocalStorage;

  beforeEach(() => {
    const store = new Map<string, string>();
    storage = {
      store,
      getItem: (k) => (store.has(k) ? (store.get(k) as string) : null),
      setItem: (k, v) => {
        store.set(k, v);
      },
      removeItem: (k) => {
        store.delete(k);
      },
    };
    makeFakeWindow(storage as unknown as Storage);
  });

  afterEach(() => {
    clearFakeWindow();
  });

  it("is the web store (id + the one row, service.account)", async () => {
    expect(localTokenStore.id).toBe("localstorage");
    expect(WEB_TOKEN_KEY).toBe(`${TOKEN_SERVICE}.${TOKEN_ACCOUNT}`);
    await expect(localTokenStore.setToken("tok-web-1")).resolves.toBe(true);
    expect(storage.store.get(WEB_TOKEN_KEY)).toBe("tok-web-1");
  });

  it("round-trips a token and reports absence as null", async () => {
    await expect(localTokenStore.getToken()).resolves.toBeNull();
    await expect(localTokenStore.setToken("tok-web-2")).resolves.toBe(true);
    await expect(localTokenStore.getToken()).resolves.toBe("tok-web-2");
    await expect(localTokenStore.clearToken()).resolves.toBe(true);
    await expect(localTokenStore.getToken()).resolves.toBeNull();
    // clearToken is idempotent — "nothing to delete" is a success.
    await expect(localTokenStore.clearToken()).resolves.toBe(true);
  });

  it("degrades to the memory store when the window is gone (SSR/prerender pass)", async () => {
    clearFakeWindow();
    await expect(localTokenStore.setToken("tok-ssr")).resolves.toBe(true);
    await expect(localTokenStore.getToken()).resolves.toBe("tok-ssr");
    await expect(localTokenStore.clearToken()).resolves.toBe(true);
    await expect(localTokenStore.getToken()).resolves.toBeNull();
  });

  it("degrades to the memory store when localStorage throws (privacy mode)", async () => {
    const broken = makeFakeWindow({
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
      removeItem: () => {
        throw new Error("denied");
      },
    } as unknown as Storage);
    await expect(localTokenStore.setToken("tok-priv")).resolves.toBe(true);
    await expect(localTokenStore.getToken()).resolves.toBe("tok-priv");
    await expect(localTokenStore.clearToken()).resolves.toBe(true);
    void broken;
  });
});
