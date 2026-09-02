/**
 * In-app purchases (plan §5.2) — the product catalog, the entitlement
 * state, and the provider abstraction.
 *
 * Design rules (AGENTS.md guardrails, non-negotiable):
 *  - The catalog is deliberately tiny (plan §5.2: "two kinds of product,
 *    nothing else"): Remove Ads (one-time) plus, later, cosmetic packs —
 *    and every pack is also earnable in-game, so buying is convenience,
 *    never access (F2P viability, guardrail 1).
 *  - No store SDK is bundled yet: the production provider is a no-op whose
 *    entry points are hidden (`noopIapProvider`), mirroring the ads
 *    pattern in ads.ts. A real store integration (Google Play Billing /
 *    StoreKit / RevenueCat) plugs in behind `IapProvider`; the pure rules
 *    here stay untouched by that swap.
 *  - Entitlements are device-local (store-scoped) and deliberately live
 *    OUTSIDE the game save: a shared/imported save must never import the
 *    sender's store receipts, and losing the record only costs the player
 *    the cosmetic convenience.
 *  - Transparency (guardrail 4): the purchase page states plainly what
 *    each product is and that the game stays fully free without it.
 */

/** The kinds of store products the game knows about. */
export type IapProductId = "removeAds";

/**
 * Outcome of a purchase attempt. Only "purchased" grants the entitlement;
 * "cancelled" means the player backed out of the store sheet, "error"
 * means no store is present (web / no SDK) or the attempt failed.
 */
export type PurchaseResult = "purchased" | "cancelled" | "error";

/** One row of the (deliberately tiny) store catalog. */
export interface IapProduct {
  readonly id: IapProductId;
  /** Plain-language name shown on the purchase page. */
  readonly label: string;
  /**
   * Display price for the panel's transparency line. The store's own
   * checkout sheet shows its localized price; this is never charged.
   */
  readonly priceLabel: string;
  /** Plain-language description of exactly what the product does. */
  readonly blurb: string;
}

/**
 * The store catalog (plan §5.2): the anchor IAP. Cosmetic packs join this
 * record when the store SDK ships (they must remain earnable in-game too).
 */
export const IAP_PRODUCTS: Record<IapProductId, IapProduct> = {
  removeAds: {
    id: "removeAds",
    label: "Remove Ads",
    priceLabel: "$2.99",
    blurb:
      "One-time purchase. Hides the rewarded-ads panel permanently — " +
      "nothing else changes, and the game stays fully free and completable " +
      "without it.",
  },
};

/**
 * Provider abstraction (mirrors AdProvider in ads.ts): "gate behind a
 * provider abstraction so web falls back to a no-op". A real store
 * integration implements this interface.
 */
export interface IapProvider {
  /** Stable id for logs/panels ("noop", "dev-sim", "google-play", ...). */
  readonly id: string;
  /** Whether store purchases can be completed on this platform right now. */
  isAvailable(): boolean;
  /**
   * Purchase a product. Resolves (never rejects, callers shouldn't need a
   * catch for the happy path) to "purchased" only if the store confirmed
   * and validated the purchase; "cancelled" / "error" otherwise.
   */
  purchase(productId: IapProductId): Promise<PurchaseResult>;
  /**
   * Round-trip the store's record of past purchases for "Restore
   * purchases". Returns the products the store says the player owns.
   */
  restore(): Promise<Partial<Record<IapProductId, boolean>>>;
}

/**
 * The default production provider: no store SDK is bundled, so purchase
 * entry points are hidden everywhere until a real provider is wired in
 * (guardrail 5 — web stays 100% free, and the UI must never offer a
 * "Buy" button that charges nothing or charges for nothing).
 */
export const noopIapProvider: IapProvider = {
  id: "noop",
  isAvailable: () => false,
  purchase: async () => "error",
  restore: async () => ({}),
};

/**
 * Development-build-only provider: simulates a completed purchase after a
 * short delay so the full flow (button → store sheet → entitlement →
 * ads panel disappearing) can be exercised before the real store SDK
 * lands. The UI labels it clearly as a simulation (transparency
 * guardrail) and it is only ever selected behind `__DEV__`, so
 * production builds never grant simulated entitlements. `restore` finds
 * nothing (the simulation has no external store to round-trip), which
 * still exercises the merge path as a no-op.
 */
export const devSimIapProvider: IapProvider = {
  id: "dev-sim",
  isAvailable: () => true,
  purchase: () =>
    new Promise<PurchaseResult>((resolve) => {
      setTimeout(() => resolve("purchased"), 1500);
    }),
  restore: async () => ({}),
};

// ---------------------------------------------------------------------------
// Entitlement state
// ---------------------------------------------------------------------------

/**
 * Which products the player currently owns. Persisted device-locally
 * (storage key "iap", see useIap) — never in the game save, for the
 * reasons in the module docs.
 */
export type IapEntitlements = Record<IapProductId, boolean>;

export function emptyIapEntitlements(): IapEntitlements {
  return { removeAds: false };
}

export function hasIapEntitlement(
  entitlements: IapEntitlements,
  id: IapProductId,
): boolean {
  return entitlements[id] === true;
}

/** The persisted state after a validated purchase of `id` (pure). */
export function grantIapEntitlement(
  entitlements: IapEntitlements,
  id: IapProductId,
): IapEntitlements {
  return { ...entitlements, [id]: true };
}

/**
 * Fold a "restore" round-trip into the stored state. Additive only: a
 * restore can only ADD entitlements, never revoke the local record (we
 * don't enforce store-side revocations here — the save and the ad meter
 * are unaffected either way, and re-purchasing is the player's choice).
 * Returns the original reference when nothing changes, so callers can
 * skip a write.
 */
export function mergeIapEntitlements(
  stored: IapEntitlements,
  restored: Partial<Record<IapProductId, boolean>>,
): IapEntitlements {
  let changed = false;
  const next: IapEntitlements = { ...stored };
  for (const id of Object.keys(IAP_PRODUCTS) as IapProductId[]) {
    if (restored[id] === true && next[id] !== true) {
      next[id] = true;
      changed = true;
    }
  }
  return changed ? next : stored;
}
