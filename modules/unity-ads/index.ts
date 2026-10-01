/**
 * JS face of the local Unity Ads native module (modules/unity-ads/android).
 *
 * `requireOptionalNativeModule` returns null when the native side is absent —
 * iOS (no module yet), web, and Jest — so the provider can gate itself on the
 * config alone and never throw at import time.
 *
 * iOS parity (deferred, docs/backlog.md) would add an apple/ implementation
 * of the same three functions over the Unity Ads iOS SDK; the JS contract
 * would not change.
 */
import { requireOptionalNativeModule } from "expo-modules-core";

/** Mirrors AdResult in src/mines_of_doom/ads.ts — the only three outcomes. */
export type UnityAdResult = "rewarded" | "closed" | "error";

export type UnityAdsNativeModule = {
  /**
   * Initialize once per process (idempotent, and lazily retried on the first
   * show). `nonBehavioral` = contextual / non-personalized demand only (the
   * kid-safe posture); `testMode` = Unity's test inventory + debug logging
   * (JS passes `!isProdEnvNow()`, i.e. false for any production release).
   */
  initialize(
    gameId: string,
    nonBehavioral: boolean,
    testMode: boolean,
  ): Promise<void>;
  /** Load + show one rewarded ad; resolves exactly once. */
  showRewarded(placementId: string): Promise<UnityAdResult>;
  /** Hand the show slot back when JS stops waiting (watchdog). */
  cancelShow(): Promise<void>;
  /** Fires the moment the ad is on screen (clears the JS load watchdog). */
  addListener(
    eventName: "onAdStarted",
    listener: (payload: { placementId: string }) => void,
  ): { remove(): void };
};

const native = requireOptionalNativeModule<UnityAdsNativeModule>("UnityAds");

export default native;