/**
 * The REAL web IAP provider (docs/todo.md #1) — Stripe Checkout (hosted)
 * with the Pocketbase server as the verify/restore + entitlement source.
 * Metro resolves this `.web` file for the web target, so no native
 * billing SDK is ever bundled into the web build.
 *
 * Flow (hosted Checkout, the no-card-UI-in-the-app option):
 *   1. `purchase()` loads stripe.js (publishable key from storeConfig —
 *      public by design; the sk_ secret lives only in the VPS sidecar)
 *      and calls `redirectToCheckout` with the product's Price id plus
 *      metadata { mdoomDeviceId, mdoomProductId, mdoomSession }.
 *   2. The browser navigates to Stripe's hosted page; payment happens
 *      THERE, not in this page. `redirectToCheckout` resolving means
 *      "the redirect has started" — NOT "the payment succeeded".
 *   3. The authoritative grant path is server-side: Stripe's
 *      `checkout.session.completed` webhook (→ VPS Pocketbase
 *      `/api/app/stripe` → sidecar Stripe-API confirmation → entitlement
 *      mint) AND the client's return-visit verify
 *      (`?iap=success` → noteCheckoutSuccess → restore replays the queue
 *      → POST /api/app/verify platform "web" token = session id → the
 *      sidecar confirms the session is paid via the Stripe API).
 *
 * Because the payment is confirmed OUTSIDE this page, this provider sets
 * `grantsLocally: false` (iaps.ts): a "purchased" result from
 * `purchase()` must never grant the entitlement on the local device —
 * the player is still on Stripe's hosted page and may cancel. The
 * entitlement arrives through `restore()` after the server mints the row.
 *
 * Entry-point gating: `isAvailable()` requires the Pocketbase URL AND a
 * fully configured Stripe block (publishable key + every catalog price);
 * anything less keeps the shop hidden on web (same all-or-nothing rule as
 * AdMob, same hidden-no-op pattern as the ads providers).
 */
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  IAP_PRODUCT_IDS,
  IAP_STORE_IDS,
  IapProductId,
  IapProvider,
} from "./iaps";
import {
  storeConfig,
  isPocketbaseConfigured,
  isStripeConfigured,
  getStripePrice,
} from "./storeConfig";
import { getIapDeviceId } from "./iapDeviceId";

/** A purchase whose server verify has not succeeded yet (queued for
 *  re-verify — "a player never loses a completed purchase to a flaky
 *  network"). On web the token is the Stripe Checkout session id. */
interface PendingVerify {
  productId: IapProductId;
  token: string;
}

/** Verify/restore round-trips to a small VPS should not take long. */
const HTTP_TIMEOUT_MS = 20 * 1000;

/** AsyncStorage key for the pending-verify queue (web storage backend). */
export const PENDING_VERIFY_KEY = "iapPendingVerifies";

// -- stripe.js loader (minimal hand-rolled types; no @stripe/stripe-js
// dependency — the hosted-redirect path needs exactly one method) --------

interface StripeRedirectClient {
  redirectToCheckout(params: {
    mode: "payment";
    lineItems: { price: string }[];
    successUrl: string;
    cancelUrl: string;
    allowPromotionCodes?: boolean;
    metadata?: Record<string, string>;
    clientReferenceId?: string;
  }): Promise<unknown>;
}
type StripeConstructor = (
  publishableKey: string,
  options?: Record<string, unknown>,
) => StripeRedirectClient;

declare global {
  interface Window {
    /** Injected by the https://js.stripe.com/v3/ script. */
    Stripe?: StripeConstructor;
  }
}

/** Inject the stripe.js script once and wait for it to load. Cached for
 *  the page's lifetime; a failed load returns null (never throws). */
let stripePromise: Promise<StripeRedirectClient | null> | null = null;

export function loadStripe(): Promise<StripeRedirectClient | null> {
  if (stripePromise) return stripePromise;
  stripePromise = new Promise<StripeRedirectClient | null>((resolve) => {
    const w = globalThis as { window?: Window };
    if (typeof w.window === "undefined") {
      resolve(null);
      return;
    }
    const win = w.window;
    if (win.Stripe) {
      resolve(safeConstruct(win.Stripe));
      return;
    }
    const existing = win.document.querySelector(
      "script[data-stripe-v3]",
    ) as HTMLScriptElement | null;
    let script = existing;
    if (!script) {
      script = win.document.createElement("script");
      script.src = "https://js.stripe.com/v3/";
      script.async = true;
      script.setAttribute("data-stripe-v3", "true");
      win.document.head?.appendChild(script);
    }
    // Both fresh scripts and an already-pending one settle here.
    script.addEventListener("load", () => {
      resolve(safeConstruct(win.Stripe));
    });
    script.addEventListener("error", () => {
      // Let a later purchase retry the load.
      stripePromise = null;
      resolve(null);
    });
  });
  return stripePromise;
}

function safeConstruct(ctor?: StripeConstructor): StripeRedirectClient | null {
  if (!ctor) return null;
  try {
    return ctor(storeConfig.stripe.publishableKey);
  } catch {
    return null;
  }
}

// -- pending-verify queue (AsyncStorage object API: this module is
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
  // A repeat of the same session id is a no-op (fast re-tap race).
  if (list.some((p) => p.productId === productId && p.token === token)) return;
  list.push({ productId, token });
  await savePendingVerifies(list);
}

/** Re-attempt every queued verify, dropping the ones that succeed. */
async function replayPendingVerifies(
  deviceId: string,
  sessionToken?: string | null,
): Promise<void> {
  const list = await loadPendingVerifies();
  if (list.length === 0) return;
  const remaining: PendingVerify[] = [];
  for (const p of list) {
    const ok = await postVerify(deviceId, p.productId, p.token, sessionToken);
    if (!ok) remaining.push(p);
  }
  if (remaining.length !== list.length) {
    await savePendingVerifies(remaining);
  }
}

// -- server round-trip (same REST contract as the native provider) ---------

/** POST the session id to the Pocketbase verify endpoint (platform "web").
 *  The SERVER confirms the session with the Stripe API before minting —
 *  this client never asserts its own payment. Returns true only on a 2xx. */
async function postVerify(
  deviceId: string,
  productId: IapProductId,
  token: string,
  sessionToken?: string | null,
): Promise<boolean> {
  try {
    const res = await postJson(`${storeConfig.pocketbaseUrl}/api/app/verify`, {
      deviceId,
      platform: Platform.OS,
      productId,
      token,
      ...sessionFields(sessionToken),
    });
    return res !== null;
  } catch {
    return false;
  }
}

/** The optional-login body field (same rule as the native provider). */
function sessionFields(
  sessionToken?: string | null,
): { sessionToken?: string } {
  return sessionToken === null || sessionToken === undefined || sessionToken === ""
    ? {}
    : { sessionToken };
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
  sessionToken?: string | null,
): Promise<Partial<Record<IapProductId, boolean>>> {
  const res = await postJson(
    `${storeConfig.pocketbaseUrl}/api/app/restore`,
    { deviceId, ...sessionFields(sessionToken) },
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

/**
 * The real web provider: Stripe Checkout → Pocketbase verify →
 * entitlement record. Selected by `pickIapProvider` (iaps.ts) only for a
 * web production build with the Stripe block AND the Pocketbase URL
 * configured; entry points stay hidden until then.
 */
export const storeIapProvider: IapProvider = {
  id: "stripe",
  grantsLocally: false,
  isAvailable: () =>
    isPocketbaseConfigured() &&
    isStripeConfigured(
      storeConfig.stripe.publishableKey,
      storeConfig.stripe.prices,
      IAP_PRODUCT_IDS,
    ),

  async purchase(productId, sessionToken) {
    if (!this.isAvailable()) return "error";
    const priceId = getStripePrice(productId);
    if (!priceId) return "error";
    const deviceId = await getIapDeviceId();
    // A previous launch may have queued this session with a dead network;
    // a fresh launch heals the queue before the player opens the panel.
    await replayPendingVerifies(deviceId, sessionToken);
    const stripe = await loadStripe();
    if (!stripe) return "error";
    const origin =
      typeof globalThis !== "undefined" &&
      (globalThis as { window?: { location?: { origin?: string } } })
        .window?.location?.origin;
    const base = origin && origin.startsWith("http") ? origin : "http://localhost";
    try {
      await stripe.redirectToCheckout({
        mode: "payment",
        lineItems: [{ price: priceId }],
        // success/cancel return to the app root with flags; the
        // {CHECKOUT_SESSION_ID} placeholder is replaced by Stripe with the
        // hosted session's id. The app's web-only on-mount effect
        // (MinesOfDoom.tsx) reads ?iap=success + ?iap_sid, calls
        // noteCheckoutSuccess + restore, and cleans the URL.
        successUrl:
          `${base}/?iap=success` +
          `&iap_product=${encodeURIComponent(productId)}` +
          "&iap_sid={CHECKOUT_SESSION_ID}",
        cancelUrl: `${base}/?iap=cancel`,
        allowPromotionCodes: false,
        metadata: {
          mdoomDeviceId: deviceId,
          mdoomProductId: productId,
          ...(sessionToken
            ? { mdoomSession: sessionToken }
            : {}),
        },
        clientReferenceId: deviceId,
      });
      // The redirect has started — the page is navigating to Stripe's
      // hosted checkout. NOT a payment confirmation: this provider sets
      // grantsLocally:false, so useIap must not grant on this result.
      // The grant arrives via restore() after server-side verification
      // (the webhook mint and/or the return-visit verify).
      return "purchased";
    } catch (err) {
      // Session creation failed (bad price id, declined before the
      // redirect, browser without support, ...): the hosted page never
      // opened, so this is a plain error outcome.
      console.warn("Stripe redirectToCheckout failed", err);
      return "error";
    }
  },

  /**
   * The player returned from Stripe Checkout (the `?iap=success` flag).
   * Record the (productId, session-id) pair for verification: the next
   * restore() replays the queue → the server confirms the session with
   * the Stripe API → the entitlement row is minted → the restore fetch
   * returns it. (The webhook path mints the same row server-side as a
   * backup; the two are idempotent — the upsert is keyed by
   * device+product.)
   */
  async noteCheckoutSuccess(productId, sessionId) {
    if (sessionId) {
      await enqueueVerify(productId, sessionId);
    }
  },

  async restore(sessionToken) {
    if (!this.isAvailable()) return {};
    const deviceId = await getIapDeviceId();
    await replayPendingVerifies(deviceId, sessionToken);
    return restoreFromServer(deviceId, sessionToken);
  },
};
