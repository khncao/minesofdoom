/**
 * Web variant of `./iapProvider` — Metro resolves this file (`.web`
 * extension) for the web target, so `expo-iap` is never bundled into the
 * web build. Web purchases go through Stripe Checkout (hosted, no card UI
 * in the app) with Pocketbase as the webhook + entitlement source — that
 * half is not built yet (it needs the deployed Pocketbase + a Stripe
 * account), so the IAP panel stays hidden on web until it lands.
 *
 * The no-op is defined inline (types-only import from ./iaps) to keep the
 * iaps.ts ↔ iapProvider(.web).ts import graph cycle-free at runtime, the
 * same shape as adProvider.web.ts.
 */
import type { IapProvider, PurchaseResult } from "./iaps";

export const storeIapProvider: IapProvider = {
  id: "noop",
  isAvailable: () => false,
  // Fewer params than the interface is legal (and keeps lint quiet): the
  // id is irrelevant on web — nothing ever resolves a purchase here.
  purchase: async (): Promise<PurchaseResult> => "error",
  restore: async () => ({}),
};
