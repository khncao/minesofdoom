/**
 * In-app purchases (plan §5.2) — the product catalog, the entitlement
 * state, and the provider abstraction.
 *
 * Design rules (AGENTS.md guardrails, non-negotiable):
 *  - The catalog is Remove Ads (one-time) plus exactly ONE pack per paid
 *    cosmetic in cosmetics.ts (every pickaxe / outfit / cave theme with
 *    costGems > 0) — and every pack is also gem-earnable in-game, so
 *    buying is convenience, never access (F2P viability, guardrail 1).
 *    PACK_SPECS is the single source for the pack table; tests pin it
 *    against cosmetics.ts, so a new paid cosmetic without a pack is a
 *    test failure, not a store surprise.
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
import { Platform } from "react-native";
import { getCaveTheme, getOutfit, getPickaxe, isOutfitId } from "./cosmetics";
// The real provider (native; a no-op on web via the .web swap). Imported
// here (not the reverse) so the selection rules stay in one pure module;
// the import is only read at call time inside selectIapProvider, which
// keeps the module cycle lazy-safe.
import { storeIapProvider } from "./iapProvider";
import { isPocketbaseConfigured } from "./storeConfig";

/** The cosmetic lines packs sell (panel grouping + blurb shape). */
export type IapPackLine = "pickaxe" | "outfit" | "caveTheme";

/**
 * One pack per PAID cosmetic (costGems > 0) in cosmetics.ts, in
 * cosmetics.ts catalog order per line (pickaxes, outfits, cave themes).
 * The internal id is `pack` + the cosmetic id PascalCased — and it is
 * deliberately NOT the store id (the store id is the Play Billing SKU /
 * App Store product id; the two name different things and must stay
 * separate, see IapProduct.storeId).
 */
const PACK_SPECS = [
  { id: "packGold", line: "pickaxe", cosmeticId: "gold" },
  { id: "packFrost", line: "pickaxe", cosmeticId: "frost" },
  { id: "packShadow", line: "pickaxe", cosmeticId: "shadow" },
  { id: "packNight", line: "outfit", cosmeticId: "night" },
  { id: "packGoldrush", line: "outfit", cosmeticId: "goldrush" },
  { id: "packCrystal", line: "outfit", cosmeticId: "crystal" },
  { id: "packMagma", line: "outfit", cosmeticId: "magma" },
  { id: "packBlocky", line: "outfit", cosmeticId: "blocky" },
  { id: "packSurface", line: "outfit", cosmeticId: "surface" },
  { id: "packKnight", line: "outfit", cosmeticId: "knight" },
  { id: "packHunter", line: "outfit", cosmeticId: "hunter" },
  { id: "packOni", line: "outfit", cosmeticId: "oni" },
  { id: "packMarmot", line: "outfit", cosmeticId: "marmot" },
  { id: "packFox", line: "outfit", cosmeticId: "fox" },
  { id: "packOtter", line: "outfit", cosmeticId: "otter" },
  { id: "packDamsel", line: "outfit", cosmeticId: "damsel" },
  { id: "packAmethyst", line: "caveTheme", cosmeticId: "amethyst" },
  { id: "packVerdant", line: "caveTheme", cosmeticId: "verdant" },
  { id: "packSolar", line: "caveTheme", cosmeticId: "solar" },
  { id: "packVoid", line: "caveTheme", cosmeticId: "void" },
  { id: "packVoxel", line: "caveTheme", cosmeticId: "voxel" },
  { id: "packWilds", line: "caveTheme", cosmeticId: "wilds" },
  { id: "packAshen", line: "caveTheme", cosmeticId: "ashen" },
  { id: "packGothic", line: "caveTheme", cosmeticId: "gothic" },
  { id: "packCherry", line: "caveTheme", cosmeticId: "cherry" },
] as const;

export type IapPackId = (typeof PACK_SPECS)[number]["id"];

/** The kinds of store products the game knows about. */
export type IapProductId = "removeAds" | IapPackId;

/**
 * Outcome of a purchase attempt. Only "purchased" grants the entitlement;
 * "cancelled" means the player backed out of the store sheet, "error"
 * means no store is present (web / no SDK) or the attempt failed.
 */
export type PurchaseResult = "purchased" | "cancelled" | "error";

/** One row of the store catalog. */
export interface IapProduct {
  readonly id: IapProductId;
  /** Which cosmetic line the pack sells (undefined for Remove Ads) — the
   *  panel groups rows by this. */
  readonly line?: IapPackLine;
  /**
   * The STORE-side product id (Play Billing SKU / App Store product id /
   * RevenueCat product id — one canonical slug for both stores). Deliberately
   * separate from `id` (the internal key that also appears in entitlements
   * and analytics): store ids have platform constraints (Play Billing SKUs
   * are lowercase a-z/0-9/_, no dots) and are created in the stores BEFORE
   * this code ships, so they must stay stable once live. The runbook in
   * docs/store-integration.md creates products with exactly these ids.
   */
  readonly storeId: string;
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
 * Display price tier by gem price, keeping every pack inside the $0.99–
 * $3.99 band (plan §5.2): the pricier a cosmetic is in gems, the pricier
 * its pack, so a purchase and saving gems stay roughly comparable.
 * Adjust the tiers here — the console table in
 * docs/store-integration.md §2 must follow.
 */
function packPriceLabel(costGems: number): string {
  if (costGems <= 30) return "$0.99";
  if (costGems <= 60) return "$1.99";
  if (costGems <= 100) return "$2.99";
  return "$3.99";
}

/** One catalog row per spec, resolving the cosmetic name/price/blurb from
 *  cosmetics.ts so the pack copy can never drift from the gem shop. */
function packProduct(
  spec: (typeof PACK_SPECS)[number],
): IapProduct {
  const storeId = "pack_" + spec.cosmeticId;
  if (spec.line === "pickaxe") {
    const c = getPickaxe(spec.cosmeticId);
    return {
      id: spec.id,
      line: "pickaxe",
      storeId,
      label: `${c.name} Pickaxe`,
      priceLabel: packPriceLabel(c.costGems),
      blurb:
        `One-time purchase. Unlocks the ${c.name} pickaxe — its own swing ` +
        "sound and swing feel. Purely cosmetic.",
    };
  }
  if (spec.line === "outfit") {
    const c = getOutfit(spec.cosmeticId);
    return {
      id: spec.id,
      line: "outfit",
      storeId,
      label: `${c.name} Outfit`,
      priceLabel: packPriceLabel(c.costGems),
      blurb:
        `One-time purchase. Unlocks the ${c.name} outfit` +
        (c.blurb ? ` — ${c.blurb}.` : ".") + " Purely cosmetic.",
    };
  }
  const c = getCaveTheme(spec.cosmeticId);
  return {
    id: spec.id,
    line: "caveTheme",
    storeId,
    label: `${c.name} Theme`,
    priceLabel: packPriceLabel(c.costGems),
    blurb:
      `One-time purchase. Unlocks the ${c.name} cave theme` +
      (c.blurb ? ` — ${c.blurb}.` : ".") + " Purely cosmetic.",
  };
}

const packProducts = {} as Record<IapPackId, IapProduct>;
for (const spec of PACK_SPECS) {
  packProducts[spec.id] = packProduct(spec);
}

/**
 * The store catalog: the anchor IAP plus one pack per paid cosmetic.
 * Every pack grants a cosmetic that is ALSO gem-earnable in-game (the
 * panel shows the gem price), so buying is convenience, never access
 * (guardrail 1). Products the console creates are named by `storeId` —
 * the table in docs/store-integration.md §2 is generated from this
 * catalog and is the exact SKU list.
 */
export const IAP_PRODUCTS: Record<IapProductId, IapProduct> = {
  removeAds: {
    id: "removeAds",
    storeId: "remove_ads",
    label: "Remove Ads",
    priceLabel: "$2.99",
    blurb:
      "One-time purchase. Hides the rewarded-ads panel permanently — " +
      "nothing else changes, and the game stays fully free and completable " +
      "without it.",
  },
  ...packProducts,
};

/** Products in display order (Remove Ads first, then packs by line in
 *  cosmetics.ts order). */
export const IAP_PRODUCT_LIST: IapProduct[] = [
  IAP_PRODUCTS.removeAds,
  ...PACK_SPECS.map((spec) => packProducts[spec.id]),
];

/**
 * Store-side ids keyed by internal id — what a real `IapProvider` passes to
 * the store SDKs, and the table the store console setup follows (see
 * docs/store-integration.md). Derived from the catalog so the two can't
 * drift; a test pins uniqueness + Play Billing SKU shape.
 */
export const IAP_STORE_IDS: Record<IapProductId, string> = Object.fromEntries(
  (Object.keys(IAP_PRODUCTS) as IapProductId[]).map((id) => [
    id,
    IAP_PRODUCTS[id].storeId,
  ]),
) as Record<IapProductId, string>;

/**
 * Which cosmetic each pack grants. Derived from PACK_SPECS: the grant is
 * just "add the pack's cosmetic id to the save's owned lists" (the grant
 * in the engine is idempotent).
 */
export type IapPackGrant = {
  readonly kind: "cosmetic" | "caveTheme";
  readonly id: string;
};

export const IAP_PACK_GRANTS: Partial<
  Record<IapProductId, IapPackGrant>
> = Object.fromEntries(
  PACK_SPECS.map((spec) => [
    spec.id,
    {
      kind: spec.line === "caveTheme" ? ("caveTheme" as const) : ("cosmetic" as const),
      id: spec.cosmeticId,
    },
  ]),
) as Partial<Record<IapProductId, IapPackGrant>>;

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
   * Purchase a product. The optional `sessionToken` (optional login)
   * is threaded to the server verify so the minted entitlement row is
   * tagged with the account (cross-device restore of purchases). Resolves
   * (never rejects, callers shouldn't need a catch for the happy path)
   * to "purchased" only if the store confirmed and validated the
   * purchase; "cancelled" / "error" otherwise.
   */
  purchase(
    productId: IapProductId,
    sessionToken?: string | null,
  ): Promise<PurchaseResult>;
  /**
   * Round-trip the store's record of past purchases for "Restore
   * purchases". With a `sessionToken` the server answers the union of
   * this device's and the account's linked rows (a fresh install
   * recovers the old device's purchases). Returns the products the store
   * says the player owns.
   */
  restore(sessionToken?: string | null): Promise<
    Partial<Record<IapProductId, boolean>>
  >;
}

/**
 * The default production provider: no store backend is configured, so
 * purchase entry points are hidden everywhere until the real provider is
 * live (the UI must never offer a "Buy" button that charges nothing or
 * charges for nothing).
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

/** The inputs to provider selection — a pure decision so the swap point
 *  stays unit-testable (same pattern as pickAdProvider in ads.ts). */
export type IapProviderSelection = {
  /** `__DEV__` — the dev build runs the labeled simulation unless the
 *   real-store override below is set. */
  dev: boolean;
  /** Web target: the store provider is a no-op (`.web` swap); web
 *  purchases go through Stripe, which is not built yet. */
  web: boolean;
  /** `isPocketbaseConfigured()` (storeConfig.ts). */
  iapBackendConfigured: boolean;
  /** Dev-build-only opt-in (the "real store billing" toggle in the IAP
 *   panel): run the REAL expo-iap → Pocketbase provider from a debug
 *   build for on-device Play Billing tests (license key installed on the
 *   device, docs/store-integration.md §2.4). Ignored on web and until the
 *   backend URL is configured. */
  realStore?: boolean;
};

/**
 * Pure provider selection. The rules, in order:
 *  1. dev wins by default — the labeled simulation is what makes the whole
 *     buy → unlock flow testable before the backend exists. A dev build
 *     opts into the REAL store provider via `realStore` (native, backend
 *     configured) for on-device billing tests.
 *  2. web is a no-op: `iapProvider.web.ts` resolves a stub and the Stripe
 *     web path is not built yet.
 *  3. native production: the real expo-iap → Pocketbase provider only once
 *     the backend URL is configured (docs/store-integration.md §1); until
 *     then the no-op keeps the entry points hidden.
 */
export function pickIapProvider(sel: IapProviderSelection): IapProvider {
  if (sel.dev) {
    if (sel.realStore && !sel.web && sel.iapBackendConfigured) {
      return storeIapProvider;
    }
    return devSimIapProvider;
  }
  if (sel.web) return noopIapProvider;
  if (!sel.iapBackendConfigured) return noopIapProvider;
  return storeIapProvider;
}

/**
 * The ONE CALL that swaps store integrations (plan §5.2 / todo item: "the
 * provider swap is one line"). Today: dev builds run the labeled
 * simulation (the full buy → unlock → Cosmetics flow is exercisable
 * without any store account) unless `realStore` opts into the real store
 * provider (debug-APK billing tests — native, backend configured);
 * native production runs the real provider
 * once the Pocketbase URL is configured, otherwise the no-op (entry
 * points hidden); web runs the no-op until the Stripe path lands. The
 * decision itself is pure — see pickIapProvider and iaps.test.ts.
 */
export function selectIapProvider(dev: boolean, realStore = false): IapProvider {
  return pickIapProvider({
    dev,
    web: Platform.OS === "web",
    iapBackendConfigured: isPocketbaseConfigured(),
    realStore,
  });
}

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
