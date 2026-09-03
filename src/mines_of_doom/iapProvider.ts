/**
 * The real IAP provider (docs/pocketbase-plan.md, "Client (repo changes)"
 * step 3): expo-iap (OpenIAP) for the store round-trip + the Pocketbase
 * server (runbook §1) for verification and the entitlement record.
 *
 * Flow, per plan §Client:
 *   1. `initConnection` once per app session.
 *   2. `requestPurchase` (in-app, one-time products) → wait on
 *      `purchaseUpdatedListener` for the matching store id.
 *   3. `finishTransaction` (acks on Play; completes the StoreKit
 *      transaction) so the store record is final.
 *   4. POST `/api/app/verify` with the unified `purchaseToken` (iOS JWS /
 *      Play token). The SERVER re-verifies with the store's API and
 *      upserts the device's entitlement record — the app never trusts the
 *      in-app SDK.
 *   5. The store completion is what the player gets granted on, even if the
 *      verify POST fails (plan: "a player never loses a completed purchase
 *      to a flaky network"). Failed verifies are queued locally and
 *      re-attempted on the next purchase/restore — that is "re-verify on
 *      next launch" in practice.
 *
 * REST contract (mirrored by the server, docs/pocketbase-plan.md §1):
 *   POST {base}/api/app/verify   { deviceId, platform, productId, token }
 *   POST {base}/api/app/restore  { deviceId }
 *   → 200 { entitlements: <store-id string>[] }
 *
 * Entry-point gating: `isAvailable()` is false until the Pocketbase URL is
 * configured, so the purchase UI stays hidden by default. Web never
 * resolves this file (Metro `.web` swap, see iapProvider.web.ts): web
 * purchases go through Stripe Checkout, which is not built yet.
 */
import { Platform } from "react-native";
import * as IAP from "expo-iap";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { IAP_STORE_IDS, IapProductId, IapProvider, PurchaseResult } from "./iaps";
import { storeConfig, isPocketbaseConfigured } from "./storeConfig";
import { getIapDeviceId } from "./iapDeviceId";

/** A purchase that completed in the store but whose verify POST has not
 *  succeeded yet (queued for re-verify; plan: never lose a purchase). */
interface PendingVerify {
  productId: IapProductId;
  token: string;
}

/** One purchase attempt gets up to 10 minutes in the store sheet. */
const PURCHASE_TIMEOUT_MS = 10 * 60 * 1000;
/** Verify/restore round-trips to a small VPS should not take long. */
const HTTP_TIMEOUT_MS = 20 * 1000;
/** How long we wait for the listener to flush before dropping it after
 *  the outcome is known. */
const LISTENER_SETTLE_MS = 200;

/** AsyncStorage key for the pending-verify queue. */
export const PENDING_VERIFY_KEY = "iapPendingVerifies";

// -- single initConnection per app session -----------------------------------
let connectionPromise: Promise<unknown> | null = null;

function ensureConnected(): Promise<unknown> {
  if (!connectionPromise) {
    connectionPromise = IAP.initConnection().catch((err) => {
      // A failed init is not fatal — the next attempt retries.
      connectionPromise = null;
      console.warn("expo-iap: initConnection failed", err);
      return undefined;
    });
  }
  return connectionPromise;
}

// -- pending-verify queue (plain AsyncStorage object API: this module is
// consumed by the provider, not a React component) ------------------------

async function loadPendingVerifies(): Promise<PendingVerify[]> {
  const raw = await AsyncStorage.getItem(PENDING_VERIFY_KEY);
  try {
    const parsed: unknown = JSON.parse(raw ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is PendingVerify =>
        !!p &&
        typeof p === "object" &&
        typeof (p as PendingVerify).productId === "string" &&
        typeof (p as PendingVerify).token === "string",
    );
  } catch {
    return [];
  }
}

async function savePendingVerifies(list: PendingVerify[]): Promise<void> {
  await AsyncStorage.setItem(PENDING_VERIFY_KEY, JSON.stringify(list));
}

async function enqueueVerify(
  productId: IapProductId,
  token: string,
): Promise<void> {
  const list = await loadPendingVerifies();
  // A repeat of the same token is a no-op (fast re-tap race).
  if (list.some((p) => p.productId === productId && p.token === token)) return;
  list.push({ productId, token });
  await savePendingVerifies(list);
}

/** Re-attempt every queued verify, dropping the ones that succeed. */
async function replayPendingVerifies(deviceId: string): Promise<void> {
  const list = await loadPendingVerifies();
  if (list.length === 0) return;
  const remaining: PendingVerify[] = [];
  for (const p of list) {
    const ok = await postVerify(deviceId, p.productId, p.token);
    if (!ok) remaining.push(p);
  }
  if (remaining.length !== list.length) {
    await savePendingVerifies(remaining);
  }
}

// -- server round-trip -----------------------------------------------------------
/**
 * POST the unified token to the Pocketbase verify endpoint. Returns true
 * only on an HTTP 2xx — anything else (network, 5xx, bad JSON) means
 * "unknown", which the caller treats as "queue and retry later".
 */
async function postVerify(
  deviceId: string,
  productId: IapProductId,
  token: string,
): Promise<boolean> {
  try {
    const res = await postJson(
      `${storeConfig.iap.pocketbaseUrl}/api/app/verify`,
      { deviceId, platform: Platform.OS, productId, token },
    );
    return res !== null;
  } catch {
    return false;
  }
}

/** POST JSON with a timeout; null on any failure (never throws). */
async function postJson(
  url: string,
  body: unknown,
): Promise<Record<string, unknown> | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const parsed: unknown = await res.json();
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Restore: the server's full entitlement list for this device. Returns
 *  partial local entitlements (additive — a restore can never revoke). */
async function restoreFromServer(
  deviceId: string,
): Promise<Partial<Record<IapProductId, boolean>>> {
  const res = await postJson(
    `${storeConfig.iap.pocketbaseUrl}/api/app/restore`,
    { deviceId },
  );
  const raw = res?.entitlements;
  if (!Array.isArray(raw)) return {};
  // Allowlist: only store ids we own map to a product (mirrors the
  // server's rule that unknown storeIds are dropped).
  const byStoreId: Record<string, IapProductId> = {};
  (Object.entries(IAP_STORE_IDS) as [IapProductId, string][]).forEach(
    ([id, sid]) => {
      byStoreId[sid] = id;
    },
  );
  const out: Partial<Record<IapProductId, boolean>> = {};
  for (const entry of raw) {
    const id = typeof entry === "string" ? byStoreId[entry] : undefined;
    if (id !== undefined) out[id] = true;
  }
  return out;
}

// -- the store round-trip ---------------------------------------------------------
interface StoreOutcome {
  result: PurchaseResult;
  /** The completed store purchase (full object — finishTransaction needs
   *  the real event payload, not a stub). */
  purchase?: IAP.Purchase;
}

/**
 * Open the store sheet for one product and wait for the outcome. The
 * listeners (not the request promise) are the source of truth: the store
 * can emit the completion on a path the request promise does not surface.
 */
function awaitStoreOutcome(storeId: string): Promise<StoreOutcome> {
  return new Promise((resolve) => {
    let settled = false;
    let updated: ReturnType<typeof IAP.purchaseUpdatedListener> | null = null;
    let errored: ReturnType<typeof IAP.purchaseErrorListener> | null = null;
    const timer = setTimeout(() => settle({ result: "error" }), PURCHASE_TIMEOUT_MS);
    const settle = (outcome: StoreOutcome) => {
      if (settled) return;
      settled = true;
      // Give the listeners a beat to flush before we drop them.
      setTimeout(() => {
        clearTimeout(timer);
        updated?.remove();
        errored?.remove();
        resolve(outcome);
      }, LISTENER_SETTLE_MS);
    };
    updated = IAP.purchaseUpdatedListener((purchase) => {
      if (purchase.productId !== storeId) return;
      if (purchase.purchaseState === "pending") return; // ack comes next
      if (purchase.purchaseToken) {
        settle({ result: "purchased", purchase });
      }
    });
    errored = IAP.purchaseErrorListener((error) => {
      if (error.productId && error.productId !== storeId) return;
      switch (error.code) {
        case IAP.ErrorCode.UserCancelled:
        case IAP.ErrorCode.Interrupted:
          settle({ result: "cancelled" });
          break;
        // "already owned" for a one-time product = the player bought it
        // before (reinstall, same store account): grant locally; the
        // entitlement record is (re)built by the server on restore.
        case IAP.ErrorCode.AlreadyOwned:
          settle({ result: "purchased" });
          break;
        default:
          console.warn("IAP store error", error);
          settle({ result: "error" });
      }
    });
    IAP.requestPurchase({
      request: { apple: { sku: storeId }, google: { skus: [storeId] } },
      type: "in-app",
    }).catch((err) => {
      // Billing unavailable / sku not found / no storefront on this
      // platform: the sheet never opened, so this is an error outcome.
      console.warn("IAP requestPurchase failed", err);
      settle({ result: "error" });
    });
  });
}

/**
 * The real provider: expo-iap → Pocketbase verify → entitlement record.
 * Selected by `pickIapProvider` (iaps.ts) only for a native production
 * build with the Pocketbase URL configured; entry points stay hidden
 * until then.
 */
export const storeIapProvider: IapProvider = {
  id: "store",
  isAvailable: () => isPocketbaseConfigured(),

  async purchase(productId) {
    if (!isPocketbaseConfigured()) return "error";
    await ensureConnected();
    const deviceId = await getIapDeviceId();
    // A previous launch may have queued this purchase with a dead network;
    // a fresh launch heals the queue before the player even opens the
    // panel (plan: re-verify on next launch).
    await replayPendingVerifies(deviceId);
    const outcome = await awaitStoreOutcome(IAP_STORE_IDS[productId]);
    if (outcome.result !== "purchased") return outcome.result;
    if (!outcome.purchase) return "purchased"; // AlreadyOwned path
    // Finalize the store record, then ask the server to verify.
    await IAP.finishTransaction({
      purchase: outcome.purchase,
      isConsumable: false,
    }).catch((err) => {
      console.warn("expo-iap: finishTransaction failed", err);
    });
    const verified = await postVerify(
      deviceId,
      productId,
      outcome.purchase.purchaseToken ?? "",
    );
    if (verified) return "purchased";
    // The purchase itself succeeded — queue it for re-verify and grant
    // locally (plan: never lose a completed purchase to a flaky network).
    console.warn("IAP verify failed; queued for re-verify", { productId });
    await enqueueVerify(productId, outcome.purchase.purchaseToken ?? "");
    return "purchased";
  },

  async restore() {
    if (!isPocketbaseConfigured()) return {};
    await ensureConnected();
    const deviceId = await getIapDeviceId();
    await replayPendingVerifies(deviceId);
    return restoreFromServer(deviceId);
  },
};
