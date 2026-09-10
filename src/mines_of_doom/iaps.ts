/**
 * In-app purchases (plan §5.2) — the product catalog, the entitlement
 * state, and the provider abstraction.
 *
 * Design rules (AGENTS.md guardrails, non-negotiable):
 *  - The catalog is exactly ONE pack per paid cosmetic in cosmetics.ts
 *    (every pickaxe / outfit / cave theme with costGems > 0) — and every
 *    pack is also gem-earnable in-game, so buying is convenience, never
 *    access (F2P viability, guardrail 1).
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
import {
 COSMETIC_PREVIEW_SEED,
 DEFAULT_OUTFIT,
 getCaveTheme,
 getOutfit,
 getPickaxe,
 isOutfitId,
 rollMinerLook,
} from "./cosmetics";
import { CUSTOM_SKIN_UNLOCK_COST_GEMS } from "./customSkin";
import { minerSpriteUri, pickaxeSpriteUri } from "src/utils/graphics/pixelArt";
// The real provider (native; a no-op on web via the .web swap). Imported
// here (not the reverse) so the selection rules stay in one pure module;
// the import is only read at call time inside selectIapProvider, which
// keeps the module cycle lazy-safe.
import { storeIapProvider } from "./iapProvider";
import {
 getActiveStripe,
 isPocketbaseConfigured,
 isStripeConfigured,
} from "./storeConfig";

/**
 * The cosmetic lines packs sell (panel grouping + blurb shape).
 * "skin" is the CUSTOM SKIN feature pack — it unlocks the custom-skin
 * save slot (docs/todo.md custom-skinning line) instead of granting a
 * fixed catalog cosmetic; it is the catalog's one non-cosmetic line.
 */
export type IapPackLine = "pickaxe" | "outfit" | "caveTheme" | "skin";

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
 // The custom-skin feature pack (feature tier — the priciest line,
 // price derived from the gem price via packPriceLabel). `cosmeticId`
 // doubles as the store-slug stem (pack_skin — the store id is a
 // Play Billing SKU, not the internal key); the GRANT id is
 // "customSkin" (the skin save slot), resolved in IAP_PACK_GRANTS.
 { id: "packSkin", line: "skin", cosmeticId: "skin" },
] as const;

export type IapPackId = (typeof PACK_SPECS)[number]["id"];

/** The kinds of store products the game knows about. */
export type IapProductId = IapPackId;

/**
 * Outcome of a purchase attempt. Only "purchased" grants the entitlement;
 * "cancelled" means the player backed out of the store sheet, "error"
 * means no store is present (web / no SDK) or the attempt failed.
 */
export type PurchaseResult = "purchased" | "cancelled" | "error";

/** One row of the store catalog. */
export interface IapProduct {
 readonly id: IapProductId;
 /** Which cosmetic line the pack sells — the panel groups rows by this. */
 readonly line: IapPackLine;
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
/**
 * The brand name in store-facing product titles — the "app: item" naming
 * (e.g. "Mines of Doom: Gold Pickaxe") that matches the Stripe catalog
 * names in scripts/stripe/catalog.json, so the app and the stores show
 * the same product name.
 */
export const APP_NAME = "Mines of Doom";

function packProduct(spec: (typeof PACK_SPECS)[number]): IapProduct {
 const storeId = "pack_" + spec.cosmeticId;
 if (spec.line === "pickaxe") {
  const c = getPickaxe(spec.cosmeticId);
  return {
   id: spec.id,
   line: "pickaxe",
   storeId,
   label: `${APP_NAME}: ${c.name} Pickaxe`,
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
   label: `${APP_NAME}: ${c.name} Outfit`,
   priceLabel: packPriceLabel(c.costGems),
   blurb:
    `One-time purchase. Unlocks the ${c.name} outfit` +
    (c.blurb ? ` — ${c.blurb}.` : ".") +
    " Purely cosmetic.",
  };
 }
 if (spec.line === "skin") {
  return {
   id: spec.id,
   line: "skin",
   storeId,
   label: `${APP_NAME}: Custom Skin`,
   priceLabel: packPriceLabel(CUSTOM_SKIN_UNLOCK_COST_GEMS),
   blurb:
    "One-time purchase. Unlocks Custom Skin — upload your own 16×16 " +
    "miner sprite and swing sound. Purely cosmetic.",
  };
 }
 const c = getCaveTheme(spec.cosmeticId);
 return {
  id: spec.id,
  line: "caveTheme",
  storeId,
  label: `${APP_NAME}: ${c.name} Theme`,
  priceLabel: packPriceLabel(c.costGems),
  blurb:
   `One-time purchase. Unlocks the ${c.name} cave theme` +
   (c.blurb ? ` — ${c.blurb}.` : ".") +
   " Purely cosmetic.",
 };
}

const packProducts = {} as Record<IapPackId, IapProduct>;
for (const spec of PACK_SPECS) {
 packProducts[spec.id] = packProduct(spec);
}

/**
 * The store catalog: one pack per paid cosmetic. Every pack grants a
 * cosmetic that is ALSO gem-earnable in-game (the panel shows the gem
 * price), so buying is convenience, never access (guardrail 1). Products
 * the console creates are named by `storeId` — the table in
 * docs/store-integration.md §2 is generated from this catalog and is the
 * exact SKU list.
 */
export const IAP_PRODUCTS: Record<IapProductId, IapProduct> = packProducts;

/** The catalog's internal product ids — the ids the Stripe price map must
 *  cover (the all-or-nothing gate in isStripeConfigured). */
export const IAP_PRODUCT_IDS = Object.keys(IAP_PRODUCTS) as IapProductId[];

/** Products in display order (packs by line in cosmetics.ts order). */
export const IAP_PRODUCT_LIST: IapProduct[] = PACK_SPECS.map(
 (spec) => packProducts[spec.id],
);

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
 * iOS (App Store Connect) product ids — Apple's own convention
 * `{ios.bundleId}.{productId}` (the iOS bundle id that will ship is
 * `com.minus4kelvin.minesofdoom`, the same reverse-domain id as
 * android.package — docs/store-integration.md §1 lists it; the
 * app.config `ios.bundleIdentifier` is filled when the iOS half
 * ships, §5). Deliberately separate from the
 * Play Billing SKUs in IAP_STORE_IDS: one id per store, created in the
 * store consoles. The provider reverse-maps BOTH id spaces to the
 * catalog (iapProvider.ts), so a device's store record — whatever id
 * space it carries — still resolves to the same product.
 */
export const IOS_BUNDLE_ID = "com.minus4kelvin.minesofdoom";
export const IAP_IOS_STORE_IDS: Record<IapProductId, string> =
 Object.fromEntries(
  (Object.keys(IAP_PRODUCTS) as IapProductId[]).map((id) => [
   id,
   `${IOS_BUNDLE_ID}.${id}`,
  ]),
 ) as Record<IapProductId, string>;

/**
 * Which cosmetic each pack grants. Derived from PACK_SPECS: the grant is
 * just "add the pack's cosmetic id to the save's owned lists" (the grant
 * in the engine is idempotent).
 */
export type IapPackGrant = {
 readonly kind: "cosmetic" | "caveTheme" | "customSkin";
 readonly id: string;
};

export const IAP_PACK_GRANTS: Record<IapProductId, IapPackGrant> =
 Object.fromEntries(
  PACK_SPECS.map((spec) => [
   spec.id,
   spec.line === "skin"
    ? { kind: "customSkin" as const, id: "customSkin" }
    : {
       kind:
        spec.line === "caveTheme"
         ? ("caveTheme" as const)
         : ("cosmetic" as const),
       id: spec.cosmeticId,
      },
  ]),
 ) as Record<IapProductId, IapPackGrant>;

/**
 * The pack's granted cosmetic resolved against the live catalogs — name +
 * gem price for the panel's "also earnable in-game" transparency line
 * (guardrails 1 & 4). Defined for every catalog product (the catalog is
 * packs only).
 */
export function getIapPackCosmetic(productId: IapProductId): {
 name: string;
 costGems: number;
} {
 const grant = IAP_PACK_GRANTS[productId];
 if (grant.kind === "customSkin") {
  // The gem price of the one-time skin unlock (the feature tier).
  return { name: "Custom Skin", costGems: CUSTOM_SKIN_UNLOCK_COST_GEMS };
 }
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
 * Shop-row preview (todo: "Show cosmetic previews in shop listings"): what
 * the player actually gets, generated by the SAME sprite pipeline as the
 * in-game sprites — never a placeholder icon. Outfit thumbnails roll
 * COSMETIC_PREVIEW_SEED so the shop and the settings gem shop show the
 * same look; pickaxe previews are theme-fixed; cave themes preview as
 * their 5-swatch depth palette (one tint per tier, shallow to deep).
 */
export type IapProductPreview =
 | { readonly kind: "sprite"; readonly uri: string }
 | { readonly kind: "swatches"; readonly tints: readonly string[] };

export function getIapProductPreview(id: IapProductId): IapProductPreview {
 const grant = IAP_PACK_GRANTS[id];
 if (grant.kind === "customSkin") {
  // A default-outfit miner — the body the uploaded 16×16 sprite
  // replaces once the slot is unlocked.
  return {
   kind: "sprite",
   uri: minerSpriteUri(rollMinerLook(COSMETIC_PREVIEW_SEED, DEFAULT_OUTFIT)),
  };
 }
 if (grant.kind === "caveTheme") {
  return { kind: "swatches", tints: getCaveTheme(grant.id).tints };
 }
 if (isOutfitId(grant.id)) {
  return {
   kind: "sprite",
   uri: minerSpriteUri(rollMinerLook(COSMETIC_PREVIEW_SEED, grant.id)),
  };
 }
 return {
  kind: "sprite",
  uri: pickaxeSpriteUri(getPickaxe(grant.id).theme),
 };
}

/**
 * Split the currently-owned packs' grants by save list, so a validated
 * purchase / restore can join them to the save's owned lists at no gem
 * cost (the engine's grant is idempotent).
 */
export function iapGrantCosmeticIds(entitlements: IapEntitlements): {
 cosmetics: string[];
 caveThemes: string[];
 /** True when the custom-skin pass is entitled (packSkin). */
 customSkin: boolean;
} {
 const cosmetics: string[] = [];
 const caveThemes: string[] = [];
 let customSkin = false;
 for (const [productId, grant] of Object.entries(IAP_PACK_GRANTS)) {
  if (!hasIapEntitlement(entitlements, productId as IapProductId)) continue;
  if (grant?.kind === "cosmetic") cosmetics.push(grant.id);
  else if (grant?.kind === "caveTheme") caveThemes.push(grant.id);
  else if (grant?.kind === "customSkin") customSkin = true;
 }
 return { cosmetics, caveThemes, customSkin };
}

/**
 * Provider abstraction (mirrors AdProvider in ads.ts): "gate behind a
 * provider abstraction so web falls back to a no-op". A real store
 * integration implements this interface.
 */
export interface IapProvider {
 /** Stable id for logs/panels ("noop", "dev-sim", "google-play", ...). */
 readonly id: string;
 /**
  * Whether a "purchased" result may be granted on the LOCAL device
  * immediately. Native stores confirm the payment inside the page, so a
  * local grant (pending server verify) is safe. Redirect flows (web /
  * Stripe Checkout) CANNOT confirm in-page — the player is on Stripe's
  * hosted page when the promise resolves, so granting there would hand
  * out free entitlements to anyone who cancels on the hosted page. Web
  * providers set this to false and deliver the entitlement through
  * restore() after server-side verification mints the row instead.
  */
 readonly grantsLocally: boolean;
 /**
  * Optional web-only hook: record that the player came back from a
  * Stripe Checkout redirect for `productId` with session id `sid`
  * (the `?iap=success` URL). The provider enqueues the (productId, sid)
  * pair for verification on the next restore. Absent on native/noop /
  * dev-sim providers.
  */
 noteCheckoutSuccess?(
  productId: IapProductId,
  sessionId: string,
 ): Promise<void> | void;
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
 restore(
  sessionToken?: string | null,
 ): Promise<Partial<Record<IapProductId, boolean>>>;
 /**
  * Re-derive entitlements from the store's OWN record of completed
  * purchases. The native stores keep non-consumable purchases for the
  * life of the store account (Play Billing retains the record after
  * `finishTransaction`), so the store query re-derives every completed
  * purchase even after the app's local data — entitlements AND the
  * device id the server rows are keyed by — has been wiped. Providers
  * without a store-side record (noop, dev-sim, web Stripe — the web
  * record lives on the server) omit this.
  */
 reconcileStore?(
  sessionToken?: string | null,
 ): Promise<Partial<Record<IapProductId, boolean>>>;
}

/**
 * The default production provider: no store backend is configured, so
 * purchase entry points are hidden everywhere until the real provider is
 * live (the UI must never offer a "Buy" button that charges nothing or
 * charges for nothing).
 */
export const noopIapProvider: IapProvider = {
 id: "noop",
 grantsLocally: true,
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
 grantsLocally: true,
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
 /** Web target: the `.web` provider swap — the store provider on web IS
  *  the Stripe Checkout provider (iapProvider.web.ts), enabled only once
  *  the Stripe block is configured (sel.stripeConfigured). */
 web: boolean;
 /** `isStripeConfigured()` (storeConfig.ts) AND the backend is
  *  configured — the web shop needs BOTH the Stripe keys/prices and the
  *  Pocketbase verify/restore round-trip. */
 stripeConfigured?: boolean;
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
 *  2. web production: the Stripe Checkout provider (`.web` swap) only when
 *     the Stripe block is configured AND the backend is configured; until
 *     then the no-op keeps the shop hidden.
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
 if (sel.web) {
  return sel.stripeConfigured === true ? storeIapProvider : noopIapProvider;
 }
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
export function selectIapProvider(
 dev: boolean,
 realStore = false,
): IapProvider {
 const backendConfigured = isPocketbaseConfigured();
 return pickIapProvider({
  dev,
  web: Platform.OS === "web",
  iapBackendConfigured: backendConfigured,
  // The web shop needs BOTH the Stripe config (publishable key + every
  // price) and the Pocketbase backend (verify/restore round-trip).
  // getActiveStripe(): prod env + a configured live block auto-enables
  // the prod variables (environment.ts / storeConfig.stripeProd).
  stripeConfigured:
   backendConfigured &&
   isStripeConfigured(
    getActiveStripe().publishableKey,
    getActiveStripe().prices,
    IAP_PRODUCT_IDS,
   ),
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

/**
 * Shop-row ownership (the unified shop, todo: "move gem shop cosmetics to
 * one time purchase shop"): a product reads as owned when this device is
 * entitled to the pack (a validated store purchase) OR the current save
 * already owns the granted cosmetic from any source (a gem buy, a pack,
 * an imported save). The save is the source of truth for what the player
 * can equip, so both paths count.
 */
export function isIapProductOwned(
 productId: IapProductId,
 entitlements: IapEntitlements,
 saveOwnedCosmeticIds: readonly string[],
 /**
  * The device-local custom-skin slot's unlock flag (useCustomSkin).
  * The packSkin grant is not a save field, so the caller joins it here
  * (default false — a stale caller just shows the row as buyable).
  */
 customSkinUnlocked?: boolean,
): boolean {
 if (hasIapEntitlement(entitlements, productId)) return true;
 const grant = IAP_PACK_GRANTS[productId];
 if (grant == null) return false;
 if (grant.kind === "customSkin") return customSkinUnlocked === true;
 return saveOwnedCosmeticIds.includes(grant.id);
}

/**
 * Shop-row equipped state: the granted cosmetic is the one the save
 * currently has selected (outfit / pickaxe / cave theme).
 */
export function isIapProductEquipped(
 productId: IapProductId,
 selectedOutfit: string,
 selectedPickaxe: string,
 selectedCaveTheme: string,
 /** The device-local skin slot's equip flag (useCustomSkin). */
 customSkinEquipped?: boolean,
): boolean {
 const grant = IAP_PACK_GRANTS[productId];
 if (grant.kind === "customSkin") return customSkinEquipped === true;
 if (grant.kind === "caveTheme") return selectedCaveTheme === grant.id;
 if (isOutfitId(grant.id)) return selectedOutfit === grant.id;
 return selectedPickaxe === grant.id;
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
