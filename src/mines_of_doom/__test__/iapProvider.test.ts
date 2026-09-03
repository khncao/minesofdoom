/**
 * The real IAP provider (iapProvider.ts): store round-trip via the mocked
 * expo-iap, verify/restore via a mocked fetch, storage via an in-memory
 * AsyncStorage. storeConfig is a plain const object, so the tests flip its
 * pocketbaseUrl (and restore it) to cover both shipped and configured
 * states.
 */
import * as IAP from "expo-iap";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { storeConfig, isPocketbaseConfigured } from "../storeConfig";
import { IAP_STORE_IDS } from "../iaps";
import { storeIapProvider, PENDING_VERIFY_KEY } from "../iapProvider";
import { IAP_DEVICE_ID_KEY } from "../iapDeviceId";

const BASE = "https://pb.example.test";
const STORE_ID = IAP_STORE_IDS.removeAds;

type PurchaseEvent = {
  productId: string;
  purchaseState: string;
  purchaseToken?: string;
};

let updateCb: ((p: PurchaseEvent) => void) | null = null;
let errorCb: ((e: { code: string; productId?: string }) => void) | null = null;
const removeSpy = jest.fn();

function resetMocks() {
  jest.clearAllMocks();
  updateCb = null;
  errorCb = null;
  (IAP.initConnection as jest.Mock).mockResolvedValue(undefined);
  (IAP.requestPurchase as jest.Mock).mockImplementation(
    async () => undefined,
  );
  (IAP.finishTransaction as jest.Mock).mockResolvedValue(undefined);
  (IAP.purchaseUpdatedListener as jest.Mock).mockImplementation((cb) => {
    updateCb = cb;
    return { remove: removeSpy };
  });
  (IAP.purchaseErrorListener as jest.Mock).mockImplementation((cb) => {
    errorCb = cb;
    return { remove: removeSpy };
  });
}

function configure(base: string) {
  storeConfig.pocketbaseUrl = base;
}

/** Yield to the microtask queue a few times (async storage + provider). */
async function settle() {
  for (let i = 0; i < 8; i++) {
    await new Promise((r) => setImmediate(r));
  }
}

const fetchMock = jest.fn();

beforeEach(async () => {
  resetMocks();
  // The repo-level AsyncStorage mock (root __mocks__) is in-memory per
  // test file; clear it so each test starts from a fresh device.
  await AsyncStorage.clear();
  fetchMock.mockReset();
  (global.fetch as jest.Mock) = fetchMock;
});

afterEach(() => {
  storeConfig.pocketbaseUrl = "";
});

describe("storeIapProvider: gating", () => {
  it("is unavailable while the Pocketbase URL is empty (shipped state)", () => {
    storeConfig.pocketbaseUrl = "";
    expect(isPocketbaseConfigured()).toBe(false);
    expect(storeIapProvider.isAvailable()).toBe(false);
  });

  it("purchase resolves 'error' (never rejects) while unconfigured", async () => {
    storeConfig.pocketbaseUrl = "";
    await expect(storeIapProvider.purchase("removeAds")).resolves.toBe(
      "error",
    );
    expect(IAP.initConnection).not.toHaveBeenCalled();
  });

  it("restore resolves {} while unconfigured", async () => {
    storeConfig.pocketbaseUrl = "";
    await expect(storeIapProvider.restore()).resolves.toEqual({});
  });

  it("is available once the URL is configured", () => {
    configure(BASE);
    expect(storeIapProvider.isAvailable()).toBe(true);
  });
});

describe("storeIapProvider: purchase round-trip", () => {
  it("completes: sheet → store event → verify POST → finish → 'purchased'", async () => {
    configure(BASE);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ entitlements: [STORE_ID] }),
    });

    const pending = storeIapProvider.purchase("removeAds");
    await settle();
    expect(IAP.initConnection).toHaveBeenCalledTimes(1);
    expect(IAP.requestPurchase).toHaveBeenCalledWith({
      request: { apple: { sku: STORE_ID }, google: { skus: [STORE_ID] } },
      type: "in-app",
    });
    expect(updateCb).not.toBeNull();

    // The store emits the completed purchase.
    const purchase: PurchaseEvent = {
      productId: STORE_ID,
      purchaseState: "purchased",
      purchaseToken: "tok-123",
    };
    updateCb!(purchase);
    await expect(pending).resolves.toBe("purchased");

    // The device id was persisted (first launch).
    const deviceId = await AsyncStorage.getItem(IAP_DEVICE_ID_KEY);
    expect(deviceId).toMatch(/^dev-/);
    // Verify went to the server with the unified token.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, object];
    expect(url).toBe(`${BASE}/api/app/verify`);
    expect(JSON.parse((init as { body: string }).body)).toEqual({
      deviceId,
      platform: expect.any(String),
      productId: "removeAds",
      token: "tok-123",
    });
    // The store transaction was finalized.
    expect(IAP.finishTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ isConsumable: false }),
    );
  });

  it("maps a user cancel to 'cancelled' and never touches the network", async () => {
    configure(BASE);
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });

    const pending = storeIapProvider.purchase("removeAds");
    await settle();
    expect(errorCb).not.toBeNull();
    errorCb!({ code: "user-cancelled", productId: STORE_ID });
    await expect(pending).resolves.toBe("cancelled");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(IAP.finishTransaction).not.toHaveBeenCalled();
  });

  it("keeps 'purchased' when the verify POST fails and queues the token for re-verify", async () => {
    configure(BASE);
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });

    const pending = storeIapProvider.purchase("removeAds");
    await settle();
    updateCb!({
      productId: STORE_ID,
      purchaseState: "purchased",
      purchaseToken: "tok-456",
    });
    // The player must not lose a completed purchase to a flaky network.
    await expect(pending).resolves.toBe("purchased");

    const raw = await AsyncStorage.getItem(PENDING_VERIFY_KEY);
    expect(JSON.parse(raw as string)).toEqual([
      { productId: "removeAds", token: "tok-456" },
    ]);
  });

  it("restore replays the queued verify and returns the server's entitlements", async () => {
    configure(BASE);
    // Seed a queued verify from a "failed" previous purchase.
    await AsyncStorage.setItem(
      PENDING_VERIFY_KEY,
      JSON.stringify([{ productId: "removeAds", token: "tok-456" }]),
    );
    const calls: string[] = [];
    fetchMock.mockImplementation(async (url: string) => {
      calls.push(url);
      return {
        ok: true,
        json: async () => ({ entitlements: [STORE_ID] }),
      };
    });

    await expect(storeIapProvider.restore()).resolves.toEqual({
      removeAds: true,
    });
    // First the queued verify, then the restore itself.
    expect(calls).toEqual([`${BASE}/api/app/verify`, `${BASE}/api/app/restore`]);
    // The queue is now empty (the verify succeeded).
    const raw = await AsyncStorage.getItem(PENDING_VERIFY_KEY);
    expect(JSON.parse(raw as string)).toEqual([]);
  });

  it("restore maps only store ids we own (unknown ids are dropped)", async () => {
    configure(BASE);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        entitlements: [STORE_ID, "someone.elses.product", 42],
      }),
    });
    await expect(storeIapProvider.restore()).resolves.toEqual({
      removeAds: true,
    });
  });
});
