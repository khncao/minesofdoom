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
 *  - Web stays 100% free (guardrail 5): the web build resolves
 *    `adProvider.web.ts` (no-ops) and never bundles an ad SDK.
 */

/** The platforms a store/SDK value is keyed for (web is never keyed — it
 *  runs the no-op providers by construction). */
export type StorePlatform = "android" | "ios";

export type AdMobIds = {
  /** The AdMob App ID for this platform (AdMob console → Apps). */
  appId: string;
  /** The rewarded ad unit id for this platform (AdMob console → Ad units →
   *  Rewarded). Only rewarded placements exist in this app (guardrail 2). */
  rewardedUnitId: string;
};

export const storeConfig = {
  adMob: {
    // AdMob console → Apps → Android / iOS → App ID. Baked into the native
    // manifests by the config plugin in app.config.ts at prebuild.
    androidAppId: "",
    iosAppId: "",
    // AdMob console → Ad units → Rewarded → unit id (one per platform).
    // Public AdMob test unit ids (react-native-google-mobile-ads' TestIds)
    // work here without an AdMob account for device testing.
    rewardedUnitAndroid: "",
    rewardedUnitIos: "",
    // Guardrail 7 (kid safety): TAG_FOR_CHILD_DIRECTED_TREATMENT. Flip to
    // true once the final age rating is known; applied via
    // MobileAds().setRequestConfiguration in adProvider.ts.
    tagForChildDirectedTreatment: false,
  },
  iap: {
    // Self-hosted Pocketbase base URL for receipt validation + entitlements
    // (docs/pocketbase-plan.md). Read by the IAP provider at call time.
    pocketbaseUrl: "",
  },
};

/** The AdMob ids for one platform, straight out of the config. */
export function getAdMobIds(platform: StorePlatform): AdMobIds {
  if (platform === "ios") {
    return {
      appId: storeConfig.adMob.iosAppId,
      rewardedUnitId: storeConfig.adMob.rewardedUnitIos,
    };
  }
  return {
    appId: storeConfig.adMob.androidAppId,
    rewardedUnitId: storeConfig.adMob.rewardedUnitAndroid,
  };
}

/** Pure: an ad pair is usable only when BOTH the app id and a rewarded unit
 *  id are present — an app id without a unit (or vice versa) can never
 *  produce a rewarded ad, so the entry points must stay hidden. */
export function isAdMobIdsConfigured(ids: AdMobIds): boolean {
  return ids.appId.length > 0 && ids.rewardedUnitId.length > 0;
}
