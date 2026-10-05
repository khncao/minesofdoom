/**
 * JS face of the local AdMob native module (modules/admob-ads/android).
 *
 * `requireOptionalNativeModule` returns null when the native side is absent —
 * iOS (no module yet), web, and Jest — so the provider can gate itself on
 * the config alone and never throw at import time.
 */
import { requireOptionalNativeModule } from "expo-modules-core";

/** Mirrors AdResult in src/mines_of_doom/ads.ts — the only three outcomes. */
export type AdMobAdResult = "rewarded" | "closed" | "error";

export type AdMobAdsNativeModule = {
  /**
   * Initialize once per process (idempotent, and lazily retried on the
   * first show).
   *  - `childDirected` = RequestConfiguration is tagged
   *    TAG_FOR_CHILD_DIRECTED_TREATMENT_TRUE + max content rating G, so
   *    every request is contextual / non-personalized (guardrail 6).
   *  - `testDeviceIds` = this device goes on Google's test-device list, so
   *    a dev session can never serve a live impression (guardrail 5).
   *    Pass [] for a production release.
   *
   * There is NO app-id argument: GMA's MobileAds.initialize has no such
   * overload — the App ID is read from the merged manifest's
   * com.google.android.gms.ads.APPLICATION_ID meta-data, written at
   * prebuild by plugins/withAdMobAds.js.
   */
  initialize(
    childDirected: boolean,
    testDeviceIds: string[],
  ): Promise<void>;
  /** Load + show one rewarded INTERSTITIAL; resolves exactly once. */
  showRewardedInterstitial(adUnitId: string): Promise<AdMobAdResult>;
  /** Hand the show slot back when JS stops waiting (watchdog). */
  cancelShow(): Promise<void>;
  /** Fires the moment the ad is on screen (clears the JS load watchdog). */
  addListener(
    eventName: "onAdStarted",
    listener: (payload: { adUnitId: string }) => void,
  ): { remove(): void };
};

const native = requireOptionalNativeModule<AdMobAdsNativeModule>("AdMobAds");

export default native;
