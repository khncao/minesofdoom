/**
 * The ONE place every store/SDK value is configured (runbook §1,
 * docs/store-integration.md).
 *
 * Rules:
 *  - **Empty string = unset.** The real providers read this module and fall
 *    back to the no-ops (entry points hidden) while their block is empty, so
 *    the repo stays buildable and shippable in every environment until the
 *    store ids exist.
 *  - **Native app ids flow through `app.config.ts`** (the
 *    `react-native-google-mobile-ads` config plugin reads `storeConfig.adMob`
 *    and bakes the app ids into the native manifests at `expo prebuild`
 *    time — never edit android/ or ios/ by hand).
 *  - **Server-side-only secrets live nowhere in this file** (the Play
 *    service-account JSON and Apple shared secret belong on the Pocketbase
 *    server — docs/pocketbase-plan.md).
 *  - The web build resolves the `.web` provider files and never bundles a
 *    native ad/purchase SDK. Web payments (Stripe Checkout) and the web
 *    AdSense banner follow the same empty-config = hidden rule (the
 *    `stripe` and `adsense` blocks below).
 */

/** The platforms a store/SDK value is keyed for (web is never keyed — it
 *  runs the no-op providers by construction). */
export type StorePlatform = "android" | "ios";

import type { AdKind } from "./ads";

export type AdMobIds = {
  /** The AdMob App ID for this platform (AdMob console → Apps). */
  appId: string;
  /** The rewarded ad unit id per placement (AdMob console → Ad units →
   *  Rewarded). Only rewarded placements exist in this app (guardrail 2);
   *  each `AdKind` (ads.ts) is its own placement so AdMob can report them
   *  separately. */
  rewardedUnitIds: Record<AdKind, string>;
};

export const storeConfig = {
  adMob: {
    // AdMob console → Apps → Android / iOS → App ID. Baked into the native
    // manifests by the config plugin in app.config.ts at prebuild.
    androidAppId: "ca-app-pub-2101316086878618~4973124022",
    iosAppId: "",
    // AdMob console → Ad units → Rewarded → unit id, one per placement
    // (AdKind) per platform. All four placements are production (one set
    // serves both platforms — ad units aren't platform-scoped; the App ID
    // is). AdMob's public test unit ids must never appear here —
    // storeConfig.test.ts fails on them (docs/store-integration.md §1).
    rewardedUnitAndroid: {
      gemRolls: "ca-app-pub-2101316086878618/8308813932",
      offlineDouble: "ca-app-pub-2101316086878618/9024953635",
      offlineTopUp: "ca-app-pub-2101316086878618/1898589303",
      comboSave: "ca-app-pub-2101316086878618/9285949727",
    },
    rewardedUnitIos: {
      gemRolls: "ca-app-pub-2101316086878618/8308813932",
      offlineDouble: "ca-app-pub-2101316086878618/9024953635",
      offlineTopUp: "ca-app-pub-2101316086878618/1898589303",
      // AdMob ad units aren't platform-scoped (the App ID is), so the same
      // production unit serves iOS — moot until iosAppId lands (the pair
      // stays hidden with an empty App ID).
      comboSave: "ca-app-pub-2101316086878618/9285949727",
    },
    // Guardrail 6 (kid safety): TAG_FOR_CHILD_DIRECTED_TREATMENT. Flip to
    // true once the final age rating is known; applied via
    // MobileAds().setRequestConfiguration in adProvider.ts.
    tagForChildDirectedTreatment: false,
  },
  // Self-hosted Pocketbase base URL — ONE deployment serves receipt
  // validation + entitlements (docs/pocketbase-plan.md) AND the store
  // integrations: cloud saves + leaderboard (docs/store-integration.md).
  // Read by the IAP / cloud-save providers at call time. Empty = unset
  // (same rule as the ad ids): the real providers stay no-ops until it
  // lands. Server-side verification is fail closed (the sidecar carries no
  // store credentials yet — real purchases are refused, never faked);
  // cloud saves / leaderboard work as-is.
  // Deployed: ~/docker/pocketbase on the servarica VPS (Caddy TLS on the
  // public domain; hooks in pb_hooks/; sidecar on the internal network).
  // https://minesofdoom.minus4kelvin.com
  pocketbaseUrl: "https://minesofdoom.minus4kelvin.com",
  /**
   * Stripe (web IAP, docs/todo.md #1) — `publishableKey` is the account's
   * PUBLIC key (pk_…; safe in the bundle; the sk_ secret lives only in the
   * VPS sidecar env) and `prices` maps every catalog product id to its
   * Stripe Price id (price_…, Stripe dashboard → Products). The web IAP
   * provider is available only when isStripeConfigured() passes
   * (all-or-nothing, like AdMob) — a half-filled price map keeps the whole
   * shop hidden on web so no button can lead to a purchase that cannot
   * complete. Keyed by the catalog's internal product ids ("packGold",
   * "pickaxeGoldPack", … — iaps.ts IAP_PRODUCT_LIST).
   */
  stripe: {
    publishableKey: "",
    prices: {} as Record<string, string>,
  },
  /**
   * AdSense (web banner ads, docs/todo.md #2) — `client` is the publisher
   * id (ca-pub-…) from the AdSense dashboard, `slot` the display unit's
   * slot id. BOTH must be non-empty to enable the banner; anything less
   * leaves the feature off end to end (the loader script in +html.tsx and
   * the banner in the shop sheet simply don't render). The banner renders
   * in the shop/settings sheet only — never over the game canvas (kid-safe
   * guardrail: ads must not overlap the play area).
   */
  adsense: {
    client: "",
    slot: "",
  },
};

/** The AdMob ids for one platform, straight out of the config. */
export function getAdMobIds(platform: StorePlatform): AdMobIds {
  if (platform === "ios") {
    return {
      appId: storeConfig.adMob.iosAppId,
      rewardedUnitIds: storeConfig.adMob.rewardedUnitIos,
    };
  }
  return {
    appId: storeConfig.adMob.androidAppId,
    rewardedUnitIds: storeConfig.adMob.rewardedUnitAndroid,
  };
}

/** Pure: an ad pair is usable only when the app id is set AND every
 *  placement has a unit id (a test id counts) — any entry point that could
 *  not fill must stay hidden. */
export function isAdMobIdsConfigured(ids: AdMobIds): boolean {
  return (
    ids.appId.length > 0 &&
    Object.values(ids.rewardedUnitIds).every((unitId) => unitId.length > 0)
  );
}

/** The Pocketbase backend is configured — the IAP provider's
 *  `isAvailable()` gate AND the cloud-save/leaderboard providers' (empty
 *  = unset, same rule as the ad ids). Until the URL lands the purchase UI
 *  and the store integrations stay hidden. */
export function isPocketbaseConfigured(): boolean {
  return storeConfig.pocketbaseUrl.length > 0;
}

/**
 * AdSense is usable only when BOTH the publisher client and the banner
 * slot are filled (docs/todo.md #2). The client id is validated against
 * the ca-pub- prefix so a typo can't silently load someone else's account
 * script. Empty → the web banner feature is off end to end (no script
 * tag, no banner, no network).
 */
export function isAdSenseConfigured(
  client: string = storeConfig.adsense.client,
  slot: string = storeConfig.adsense.slot,
): boolean {
  return /^ca-pub-\d+$/.test(client) && slot.length > 0;
}

/**
 * Stripe web IAP (docs/todo.md #1): enabled ALL-OR-NOTHING, like AdMob —
 * the publishable key must be set AND every id in `requiredIds` must have
 * a non-empty price. A half-configured account (some prices missing)
 * keeps the whole shop hidden on web, so no button can ever lead to a
 * purchase that cannot complete. Passing no arguments checks the live
 * storeConfig values (the default `requiredIds` is the key set of the
 * price map itself, so a caller with a full map gets the simple check).
 */
export function isStripeConfigured(
  publishableKey: string = storeConfig.stripe.publishableKey,
  prices: Record<string, string> = storeConfig.stripe.prices,
  requiredIds: readonly string[] = Object.keys(prices),
): boolean {
  return (
    /^pk_(test|live)_[A-Za-z0-9]+$/.test(publishableKey) &&
    requiredIds.every((id) => (prices[id] ?? "").length > 0)
  );
}

/**
 * The Stripe Price id for a product, or "" when unconfigured (callers
 * must treat "" as "not buyable" and keep the button disabled/hidden).
 */
export function getStripePrice(
  productId: string,
  prices: Record<string, string> = storeConfig.stripe.prices,
): string {
  return prices[productId] ?? "";
}
