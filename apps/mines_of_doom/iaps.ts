/**
 * In-app purchases (plan §5.2) — the product catalog, the entitlement
 * state, and the provider abstraction.
 *
 * Design rules (AGENTS.md guardrails, non-negotiable):
 *  - The catalog is deliberately tiny (plan §5.2: "two kinds of product,
 *    nothing else"): Remove Ads (one-time) plus one cosmetic pack per
 *    cosmetic line (pickaxe / outfit / cave theme) — and every pack is
 *    also earnable in-game, so buying is convenience, never access
 *    (F2P viability, guardrail 1).
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
import { getCaveTheme, getOutfit, getPickaxe, isOutfitId } from "./cosmetics";

/** The kinds of store products the game knows about. */
export type IapProductId =
  | "removeAds"
  | "packShadowPick"
  | "packOniOutfit"
  | "packCherryTheme";

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
 * The store catalog (plan §5.2). Deliberately tiny: the anchor IAP plus one
 * cosmetic pack per cosmetic line (pickaxe, outfit, cave theme). Every pack
 * grants a cosmetic that is ALSO gem-earnable in-game (the panel shows the
 * gem price), so buying is convenience, never access (guardrail 1).
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
  packShadowPick: {
    id: "packShadowPick",
    label: "Shadow Pickaxe",
    priceLabel: "$1.99",
    blurb:
      "One-time purchase. Unlocks the Shadow pickaxe — its own swing sound " +
      "and the heaviest, most deliberate swing feel. Purely cosmetic.",
  },
  packOniOutfit: {
    id: "packOniOutfit",
    label: "Crimson Oni Outfit",
    priceLabel: "$0.99",
    blurb:
      "One-time purchase. Unlocks the Crimson Oni outfit (a samurai-era " +
      "vengeance tribute). Purely cosmetic.",
  },
  packCherryTheme: {
    id: "packCherryTheme",
    label: "Cherry & Indigo Theme",
    priceLabel: "$2.99",
    blurb:
      "One-time purchase. Unlocks the Cherry & Indigo cave theme. Purely " +
      "cosmetic.",
  },
};

/** Products in display order (Remove Ads first, packs after). */
export const IAP_PRODUCT_LIST: IapProduct[] = Object.values(IAP_PRODUCTS);

/**
 * Which cosmetic each pack grants. Pure catalog data: the pack id maps to
 * a cosmetic id that already exists in the gem shop (cosmetics.ts), so
 * the grant is just "add this id to the save's owned lists".
 */
export type IapPackGrant = {
  readonly kind: "cosmetic" | "caveTheme";
  readonly id: string;
};

export const IAP_PACK_GRANTS: Partial<
  Record<IapProductId, IapPackGrant>
> = {
  packShadowPick: { kind: "cosmetic", id: "shadow" },
  packOniOutfit: { kind: "cosmetic", id: "oni" },
  packCherryTheme: { kind: "caveTheme", id: "cherry" },
};

/**
 * The pack's granted cosmetic resolved against the live catalogs — name +
 * gem price for the panel's "also earnable in-game" transparency line
 * (guardrails 1 & 4). Undefined for non-pack products (Remove Ads).
 */
export function getIapPackCosmetic(
  productId: IapProductId,
): { name: string; costGems: number } | undefined {
  const grant = IAP_PACK_GRANTS[productId];
  if (!grant) return undefined;
  if (grant.kind === "caveTheme") {
    const theme = getCaveTheme(grant.id);
    return { name: theme.name, costGems: theme.costGems };
  }
  if (isOutfitId(grant.id)) {
    const outfit = getOutfit(grant.id);
    return { name: outfit.name, costGems: outfit.costGems };
  }
  const pickaxe = getPickaxe(grant.id);
  return { name: pickaxe.name, costGems: pickaxe.costGems };
}

/**
 * Split the currently-owned packs' grants by save list, so a validated
 * purchase / restore can join them to the save's owned lists at no gem
 * cost (the engine's grant is idempotent).
 */
export function iapGrantCosmeticIds(
  entitlements: IapEntitlements,
): { cosmetics: string[]; caveThemes: string[] } {
  const cosmetics: string[] = [];
  const caveThemes: string[] = [];
  for (const [productId, grant] of Object.entries(IAP_PACK_GRANTS)) {
    if (!hasIapEntitlement(entitlements, productId as IapProductId)) continue;
    if (grant?.kind === "cosmetic") cosmetics.push(grant.id);
    else if (grant?.kind === "caveTheme") caveThemes.push(grant.id);
  }
  return { cosmetics, caveThemes };
}

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
  // Derived from the catalog, so a new product can't be forgotten here.
  const empty = {} as IapEntitlements;
  for (const id of Object.keys(IAP_PRODUCTS) as IapProductId[]) {
    empty[id] = false;
  }
  return empty;
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
  if (entitlements[id] === true) return entitlements;
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
