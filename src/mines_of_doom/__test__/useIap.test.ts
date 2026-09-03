/**
 * Hook-level tests for the IAP purchase lifecycle (useIap): availability →
 * provider.purchase → entitlement grant → persistence (device-local "iap"
 * key) → toast/analytics callbacks. The pure entitlement rules live in
 * iaps.test.ts — these tests pin the glue: the one-at-a-time guard, the
 * owned-gate, and the additive restore merge as surfaced to the UI.
 */
import { act, renderHook } from "@testing-library/react-native";
import { useIap, iapEntitlementsKey } from "../hooks/useIap";
import {
  IapEntitlements,
  IapProductId,
  IapProvider,
  PurchaseResult,
  emptyIapEntitlements,
} from "../iaps";

jest.mock("src/hooks/useI18n", () => ({
  useI18n: () => ({ locale: "en", t: (key: string) => key }),
}));

/**
 * In-memory AsyncStorage (same pattern as useGameEngine.test.ts: the map
 * lives inside the hoisted factory and is exposed on the mock module).
 */
jest.mock("@react-native-async-storage/async-storage", () => {
  const store = new Map<string, string>();
  const mem = {
    setItem: jest.fn(async (k: string, v: string) => {
      store.set(k, v);
    }),
    getItem: jest.fn(
      async (k: string) => (store.has(k) ? (store.get(k) as string) : null),
    ),
    removeItem: jest.fn(async (k: string) => {
      store.delete(k);
    }),
    clear: jest.fn(async () => {
      store.clear();
    }),
  };
  const useAsyncStorage = (key: string) => ({
    getItem: () => mem.getItem(key),
    setItem: (v: string) => mem.setItem(key, v),
  });
  return {
    __esModule: true,
    __store: store,
    default: mem,
    ...mem,
    useAsyncStorage,
  };
});

import * as AsyncStorageMock from "@react-native-async-storage/async-storage";

const mockStore: Map<string, string> = (AsyncStorageMock as unknown as {
  __store: Map<string, string>;
}).__store;

type MockProvider = {
  id: string;
  isAvailable: () => boolean;
  purchase: jest.Mock;
  restore: jest.Mock;
};

/** Test provider: scripts the purchase/restore outcomes. */
function makeProvider(
  result: PurchaseResult = "purchased",
  available = true,
  restored: Partial<Record<IapProductId, boolean>> = {},
): MockProvider {
  return {
    id: "test",
    isAvailable: () => available,
    purchase: jest.fn().mockResolvedValue(result),
    restore: jest.fn().mockResolvedValue(restored),
  };
}

type UseIapProps = Parameters<typeof useIap>[0];

/** Default props (available test provider) + overrides. */
function makeProps(overrides: Partial<UseIapProps> = {}): UseIapProps {
  return {
    provider: makeProvider() as unknown as IapProvider,
    displayMessage: jest.fn(),
    onPurchased: jest.fn(),
    ...overrides,
  } as UseIapProps;
}

type UseIap = ReturnType<typeof useIap>;

async function renderIap(props: UseIapProps, seed?: IapEntitlements) {
  mockStore.clear();
  if (seed != null) {
    mockStore.set(iapEntitlementsKey, JSON.stringify(seed));
  }
  const { result } = renderHook(() => useIap(props));
  // Let the initial localStorage read land (so a seeded entitlement is
  // visible).
  for (let i = 0; i < 20; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
  return result;
}

const stored = (): IapEntitlements | null =>
  mockStore.has(iapEntitlementsKey)
    ? (JSON.parse(mockStore.get(iapEntitlementsKey) as string) as IapEntitlements)
    : null;

async function buy(result: { current: UseIap }, id: IapProductId) {
  await act(async () => {
    result.current.purchase(id);
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function restore(result: { current: UseIap }) {
  await act(async () => {
    result.current.restore();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useIap — availability", () => {
  it("mirrors provider availability", async () => {
    const result = await renderIap(
      makeProps({ provider: makeProvider("purchased", false) }),
    );
    expect(result.current.available).toBe(false);

    const available = await renderIap(makeProps());
    expect(available.current.available).toBe(true);
  });

  it("starts with empty entitlements on a fresh device", async () => {
    const result = await renderIap(makeProps());
    expect(result.current.entitlements).toEqual(emptyIapEntitlements());
    expect(result.current.removeAds).toBe(false);
    // Nothing has been written yet (no purchase, no restore).
    expect(stored()).toBeNull();
  });
});

describe("useIap — purchase", () => {
  it("removeAds: a validated purchase grants the entitlement, persists it, fires onPurchased and the toast", async () => {
    const provider = makeProvider("purchased");
    const displayMessage = jest.fn();
    const onPurchased = jest.fn();
    const result = await renderIap(
      makeProps({ provider, displayMessage, onPurchased }),
    );
    await buy(result, "removeAds");
    expect(provider.purchase).toHaveBeenCalledWith("removeAds");
    expect(result.current.removeAds).toBe(true);
    expect(result.current.entitlements.removeAds).toBe(true);
    expect(onPurchased).toHaveBeenCalledWith("removeAds");
    expect(displayMessage).toHaveBeenCalledWith("toast.iapRemoveAds", 4000);
    expect(stored()?.removeAds).toBe(true);
    expect(result.current.purchasing).toBeNull();
  });

  it("a pack purchase toasts the pack name line and persists the entitlement", async () => {
    const provider = makeProvider("purchased");
    const displayMessage = jest.fn();
    const onPurchased = jest.fn();
    const result = await renderIap(
      makeProps({ provider, displayMessage, onPurchased }),
    );
    await buy(result, "packOniOutfit");
    expect(displayMessage).toHaveBeenCalledWith("toast.iapPackUnlocked", 4000);
    expect(onPurchased).toHaveBeenCalledWith("packOniOutfit");
    expect(stored()?.packOniOutfit).toBe(true);
  });

  it("a cancelled store sheet grants nothing and stays silent", async () => {
    const provider = makeProvider("cancelled");
    const displayMessage = jest.fn();
    const onPurchased = jest.fn();
    const result = await renderIap(
      makeProps({ provider, displayMessage, onPurchased }),
    );
    await buy(result, "removeAds");
    expect(result.current.removeAds).toBe(false);
    expect(onPurchased).not.toHaveBeenCalled();
    expect(displayMessage).not.toHaveBeenCalled();
    expect(stored()).toBeNull();
  });

  it("an errored purchase grants nothing and stays silent", async () => {
    const provider = makeProvider("error");
    const displayMessage = jest.fn();
    const result = await renderIap(makeProps({ provider, displayMessage }));
    await buy(result, "removeAds");
    expect(result.current.removeAds).toBe(false);
    expect(displayMessage).not.toHaveBeenCalled();
    expect(stored()).toBeNull();
  });

  it("an already-owned product is gated before the provider is called", async () => {
    const provider = makeProvider("purchased");
    const seed = emptyIapEntitlements();
    seed.removeAds = true;
    const result = await renderIap(makeProps({ provider }), seed);
    expect(result.current.removeAds).toBe(true);
    await buy(result, "removeAds");
    expect(provider.purchase).not.toHaveBeenCalled();
  });

  it("only one purchase in flight (double-tap guard)", async () => {
    let resolvePurchase!: (r: PurchaseResult) => void;
    const provider: MockProvider = {
      id: "slow",
      isAvailable: () => true,
      purchase: jest.fn(
        () =>
          new Promise<PurchaseResult>((resolve) => {
            resolvePurchase = resolve;
          }),
      ),
      restore: jest.fn().mockResolvedValue({}),
    };
    const result = await renderIap(makeProps({ provider }));
    act(() => {
      result.current.purchase("removeAds");
      result.current.purchase("removeAds");
    });
    expect(result.current.purchasing).toBe("removeAds");
    expect(provider.purchase).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolvePurchase("purchased");
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.purchasing).toBeNull();
    expect(result.current.removeAds).toBe(true);
  });
});

describe("useIap — restore", () => {
  it("folds the store's record in additively and persists the merge", async () => {
    const provider = makeProvider("purchased", true, {
      removeAds: true,
      packCherryTheme: true,
    });
    const result = await renderIap(makeProps({ provider }));
    expect(result.current.removeAds).toBe(false);
    await restore(result);
    expect(provider.restore).toHaveBeenCalledTimes(1);
    expect(result.current.removeAds).toBe(true);
    expect(result.current.entitlements.packCherryTheme).toBe(true);
    expect(stored()?.removeAds).toBe(true);
    expect(stored()?.packCherryTheme).toBe(true);
    expect(result.current.restoring).toBe(false);
  });

  it("a no-op restore (player owns everything) writes nothing", async () => {
    const provider = makeProvider("purchased", true, { removeAds: true });
    const seed = emptyIapEntitlements();
    seed.removeAds = true;
    const result = await renderIap(makeProps({ provider }), seed);
    // The seeded read is not a write: the key exists but restore adds nothing.
    const before = mockStore.get(iapEntitlementsKey);
    await restore(result);
    expect(mockStore.get(iapEntitlementsKey)).toBe(before);
  });

  it("restore can only ADD: a product the local record shows owned stays owned even if the store says otherwise", async () => {
    const provider = makeProvider("purchased", true, { removeAds: false });
    const seed = emptyIapEntitlements();
    seed.removeAds = true;
    const result = await renderIap(makeProps({ provider }), seed);
    await restore(result);
    expect(result.current.removeAds).toBe(true);
  });

  it("only one restore in flight (double-tap guard)", async () => {
    let resolveRestore!: (r: Partial<Record<IapProductId, boolean>>) => void;
    const provider: MockProvider = {
      id: "slow",
      isAvailable: () => true,
      purchase: jest.fn(),
      restore: jest.fn(
        () =>
          new Promise<Partial<Record<IapProductId, boolean>>>(
            (resolve) => {
              resolveRestore = resolve;
            },
          ),
      ),
    };
    const result = await renderIap(makeProps({ provider }));
    act(() => {
      result.current.restore();
      result.current.restore();
    });
    expect(result.current.restoring).toBe(true);
    expect(provider.restore).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveRestore({ removeAds: true });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.restoring).toBe(false);
    expect(result.current.removeAds).toBe(true);
  });
});
