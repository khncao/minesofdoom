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
 *  - The web build resolves the `.web` provider files (no-ops) and never
 *    bundles a native ad/purchase SDK; web payments (Stripe) are not built
 *    yet.
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
    // (AdKind) per platform. The combo-save unit is production; the other
    // placements run AdMob's PUBLIC TEST unit ids (TestIds.ANDROID_REWARDED
    // / TestIds.IOS_REWARDED) until their production units are created
    // (docs/store-integration.md §2).
    rewardedUnitAndroid: {
      gemRolls: "ca-app-pub-3940256099942544/5224354917",
      offlineDouble: "ca-app-pub-3940256099942544/5224354917",
      offlineTopUp: "ca-app-pub-3940256099942544/5224354917",
      comboSave: "ca-app-pub-2101316086878618/9285949727",
    },
    rewardedUnitIos: {
      gemRolls: "ca-app-pub-3145189286508883/1712485313",
      offlineDouble: "ca-app-pub-3145189286508883/1712485313",
      offlineTopUp: "ca-app-pub-3145189286508883/1712485313",
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
  // integrations: cloud saves + leaderboard (docs/store-integration-plan.md).
  // Read by the IAP / cloud-save providers at call time. Empty = unset
  // (same rule as the ad ids): the real providers stay no-ops until it
  // lands.
  pocketbaseUrl: "",
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
