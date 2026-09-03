/**
 * The real rewarded-ad provider (react-native-google-mobile-ads v16).
 *
 * Selected only by `selectAdProvider` (ads.ts) when this platform's
 * `storeConfig.adMob` pair is configured and the build is production —
 * otherwise the no-op (hidden entry points) or the labeled dev-sim runs.
 * The Web build resolves `adProvider.web.ts` instead (Metro's `.web`
 * extension), so this file — and the SDK — never enters the web bundle
 * (verified by the bundle grep in docs/store-integration.md §3).
 *
 * v16 API notes (differs from the older docs this package has been
 * documented with): `MobileAds()` is a module factory whose `initialize()`
 * takes NO app id (the app id comes from the native manifest — the config
 * plugin in app.config.ts), and the rewarded flow is
 * `RewardedAd.createForAdRequest(unit)` + event listeners + `load()`.
 *
 * Result mapping (AdResult, ads.ts):
 *  - "rewarded" — the SDK reported EARNED_REWARD (the ONLY path that
 *    entitles the player to the reward; the hook grants it, not the SDK).
 *  - "closed"   — the ad was dismissed without an earned reward.
 *  - "error"    — no fill / load or show failure / safety timeout.
 */
import { Platform } from "react-native";
import MobileAds, {
  AdEventType,
  RewardedAd,
  RewardedAdEventType,
} from "react-native-google-mobile-ads";
import type { AdKind, AdProvider, AdResult } from "./ads";
import {
  getAdMobIds,
  isAdMobIdsConfigured,
  storeConfig,
  type StorePlatform,
} from "./storeConfig";

function currentPlatform(): StorePlatform {
  return Platform.OS === "ios" ? "ios" : "android";
}

/** Whether a rewarded ad can actually be shown right now on this platform
 * (the manifest app id plus every placement's unit id must be configured —
 * they travel together: app id via the prebuild plugin, units via JS). */
export function hasAdMobConfig(): boolean {
  return isAdMobIdsConfigured(getAdMobIds(currentPlatform()));
}

/**
 * How long a load may take before we give up on it ("error"). Cleared as
 * soon as the ad has OPENED — after that the player is watching a video
 * that may run past any fixed window, and it will always end with a
 * CLOSED (or the process died, in which case no Promise matters).
 */
const LOAD_TIMEOUT_MS = 20_000;

let sdkReady = false;
function ensureMobileAdsReady(): void {
  if (sdkReady) return;
  sdkReady = true;
  // Fire-and-forget: the SDK's init is a version/adapter check; the first
  // `load()` below surfaces real failures through the ERROR listener.
  void MobileAds()
    .initialize()
    .then(() =>
      MobileAds().setRequestConfiguration({
        // Guardrail 7 — applied from storeConfig, not scattered constants.
        tagForChildDirectedTreatment:
          storeConfig.adMob.tagForChildDirectedTreatment,
      }),
    )
    .catch((e) => console.warn("AdMob init failed", e));
}

export const adMobAdProvider: AdProvider = {
  id: "admob",
  isAvailable: () => hasAdMobConfig(),
  showRewarded(kind: AdKind): Promise<AdResult> {
    // `kind` doubles as the placement selector: each AdKind has its own
    // rewarded unit in storeConfig (adMob can report placements separately)
    // as well as driving the hook's reward rules / analytics.
    if (!hasAdMobConfig()) return Promise.resolve("error");
    const { rewardedUnitIds } = getAdMobIds(currentPlatform());
    const rewardedUnitId = rewardedUnitIds[kind];
    if (rewardedUnitId.length === 0) return Promise.resolve("error");
    return new Promise<AdResult>((resolve) => {
      const ad = RewardedAd.createForAdRequest(rewardedUnitId);
      let settled = false;
      let earned = false;
      let loadTimeout: ReturnType<typeof setTimeout> | null = null;
      const settle = (result: AdResult) => {
        if (settled) return; // first terminal event wins
        settled = true;
        if (loadTimeout != null) clearTimeout(loadTimeout);
        try {
          ad.removeAllListeners();
        } catch (e) {
          console.warn("AdMob listener cleanup failed", e);
        }
        resolve(result);
      };
      ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
        void ad?.show().catch(() => settle("error"));
      });
      // The player is now watching: cancel the load timeout (a full
      // rewarded video routinely runs past 20s and must not be cut off).
      ad.addAdEventListener(AdEventType.OPENED, () => {
        if (loadTimeout != null) {
          clearTimeout(loadTimeout);
          loadTimeout = null;
        }
      });
      ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        earned = true;
      });
      ad.addAdEventListener(AdEventType.CLOSED, () => {
        settle(earned ? "rewarded" : "closed");
      });
      ad.addAdEventListener(AdEventType.ERROR, () => settle("error"));
      loadTimeout = setTimeout(() => settle("error"), LOAD_TIMEOUT_MS);
      ensureMobileAdsReady();
      ad.load();
    });
  },
};
