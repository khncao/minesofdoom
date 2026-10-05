/**
 * The real rewarded-ad provider — **AdMob rewarded INTERSTITIAL** on
 * Android, via the local native module in `modules/admob-ads`.
 *
 * WHY REWARDED *INTERSTITIAL* AND NOT REWARDED (2026-10-03). Google Play's
 * Families policy bans "rewarded or opt-in ads that cannot be closed after
 * 5 seconds", and that is exactly what got v1.0.10 rejected: a plain AdMob
 * **rewarded** unit's close button is Google's creative UI on a per-creative
 * 5-30 s countdown until the reward is granted, with no dismiss API on
 * `RewardedAd`. A **rewarded interstitial** only ever serves skippable ads,
 * which is what Google's own rejection guidance points at. Unity Ads was
 * tried in between (rewarded, then interstitial) and both served ads with
 * no skip and no way to close — see docs/store-integration.md §0/§1.1.
 *
 * The format is not opt-in by design (it is meant for app transitions); we
 * only ever show it from a player-tapped "watch" button, so the flow stays
 * opt-in (guardrail 2). Google's own guide says to present the reward
 * messaging and a skip option before showing one — which is exactly what
 * the game's watch button does.
 *
 * Selected only by `selectAdProvider` (ads.ts) when this platform's
 * `storeConfig.adMob` pair is configured and the build is production —
 * otherwise the no-op (hidden entry points) or the labeled dev-sim runs.
 * The Web build resolves `adMobAdProvider.web.ts` instead (Metro's `.web`
 * extension), so this file — and the native module — never enter the web
 * bundle.
 *
 * Result mapping (AdResult, ads.ts) — identical to the AdMob rewarded era:
 *  - "rewarded" — GMA reported the user earned the reward (the ONLY path
 *    that entitles the player; the hook grants it).
 *  - "closed"   — the ad was dismissed without an earned reward, i.e. the
 *    player skipped or left early: NO reward. This is the path that makes
 *    the format Families-compliant, and it must never grant anything.
 *  - "error"    — no fill / load or show failure / safety timeout.
 */
import { Platform } from "react-native";
import AdMobAds from "modules/admob-ads";
import type { AdKind, AdProvider, AdResult } from "./ads";
import { isProdEnvNow } from "./environment";
import {
  getAdMobIds,
  isAdMobIdsConfigured,
  storeConfig,
  type StorePlatform,
} from "./storeConfig";

function currentPlatform(): StorePlatform {
  return Platform.OS === "ios" ? "ios" : "android";
}

/** Whether a rewarded ad can actually be shown right now: the native module
 * must exist in this build (Android only — iOS has no module yet) AND the
 * App ID plus every ad unit must be configured. */
export function hasAdMobConfig(): boolean {
  return AdMobAds !== null && isAdMobIdsConfigured(getAdMobIds(currentPlatform()));
}

/**
 * How long a LOAD may take before we give up on it ("error"). Cleared as
 * soon as the ad has OPENED — after that the player is watching a video
 * that may run past any fixed window, and it will always end with a
 * CLOSED (or the process died, in which case no Promise matters).
 */
const LOAD_TIMEOUT_MS = 20_000;

let initStarted = false;
/** One initialize per process. */
function ensureAdMobReady(): void {
  if (initStarted || AdMobAds === null) return;
  initStarted = true;
  void AdMobAds.initialize(
    storeConfig.admob.childDirectedTreatment,
    // Dev builds register this device on Google's TEST-DEVICE list so a dev
    // session can never serve or spend on a live impression
    // (guardrail 5: measure before scaling). A release build on the
    // production domain sends [] and talks to real demand.
    isProdEnvNow() ? [] : [DEV_TEST_DEVICE_ID],
  ).catch((e: unknown) => console.warn("AdMob init failed", e));
}

/**
 * Google's own published test device id. Harmless in a production build
 * (the list is empty there), and it guarantees a dev session gets Google's
 * test creatives rather than real demand.
 */
const DEV_TEST_DEVICE_ID = "33BE2250B43518CCDA7DE426D04EE231";

export const adMobAdProvider: AdProvider = {
  id: "admob",
  isAvailable: () => hasAdMobConfig(),
  showRewarded(kind: AdKind): Promise<AdResult> {
    if (AdMobAds === null) return Promise.resolve("error");
    const { adUnitIds } = getAdMobIds(currentPlatform());
    const adUnitId = adUnitIds[kind];
    if (adUnitId.length === 0) return Promise.resolve("error");
    ensureAdMobReady();
    return new Promise<AdResult>((resolve) => {
      let settled = false;
      let loadTimeout: ReturnType<typeof setTimeout> | null = null;
      let started: { remove(): void } | null = null;
      const clearLoadTimeout = () => {
        if (loadTimeout != null) {
          clearTimeout(loadTimeout);
          loadTimeout = null;
        }
      };
      const settle = (result: AdResult) => {
        if (settled) return; // first terminal event wins
        settled = true;
        clearLoadTimeout();
        started?.remove();
        started = null;
        resolve(result);
      };
      // The ad is on screen: stop the load watchdog (the video can run as
      // long as it likes; the promise settles when the ad ends).
      try {
        started = AdMobAds!.addListener("onAdStarted", (payload) => {
          if (payload?.adUnitId === adUnitId) clearLoadTimeout();
        });
      } catch (e: unknown) {
        // Old native module without the event — keep the long watchdog.
        console.warn("AdMob onAdStarted listener failed", e);
      }
      // No fill / no network / an ad unit the SDK refuses to load.
      loadTimeout = setTimeout(() => {
        void AdMobAds!.cancelShow().catch(() => undefined);
        settle("error");
      }, LOAD_TIMEOUT_MS);
      AdMobAds!.showRewardedInterstitial(adUnitId)
        .then(settle)
        .catch((e: unknown) => {
          console.warn("AdMob show failed", e);
          settle("error");
        });
    });
  },
};
