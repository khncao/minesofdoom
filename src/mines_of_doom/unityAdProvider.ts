/**
 * The real rewarded-ad provider — **Unity Ads** on Android, via the local
 * native module in `modules/unity-ads` (see that directory's README and
 * docs/store-integration.md §1 for the Unity dashboard runbook).
 *
 * Why Unity and not AdMob (2026-10-01): Google Play's Families policy bans
 * "rewarded or opt-in ads that cannot be closed after 5 seconds", and the
 * AdMob rewarded unit has no app-side control over that countdown — that is
 * what got the v1.0.10 update rejected. Unity Ads is a Families
 * Self-Certified Ads SDK whose rewarded placements carry an "Allow skip after
 * 5 seconds" setting, so the SAME player-tapped rewarded flow is compliant
 * for every age with no age screen and no second ad surface.
 *
 * Selected only by `selectAdProvider` (ads.ts) when this platform's
 * `storeConfig.unityAds` pair is configured and the build is production —
 * otherwise the no-op (hidden entry points) or the labeled dev-sim runs.
 * The Web build resolves `unityAdProvider.web.ts` instead (Metro's `.web`
 * extension), so this file — and the native module — never enter the web
 * bundle.
 *
 * Result mapping (AdResult, ads.ts) — identical to the AdMob era:
 *  - "rewarded" — the native module reported the ad completed AND the reward
 *    fired (the ONLY path that entitles the player; the hook grants it).
 *  - "closed"   — the player used the 5-second close (skip) or bailed before
 *    finishing: NO reward. This is the path that makes the format
 *    Families-compliant, and it must never hand out the reward.
 *  - "error"    — no fill / load or show failure / safety timeout.
 */
import { Platform } from "react-native";
import UnityAds from "modules/unity-ads";
import type { AdKind, AdProvider, AdResult } from "./ads";
import { isProdEnvNow } from "./environment";
import {
  getUnityAdsIds,
  isUnityAdsConfigured,
  storeConfig,
  type StorePlatform,
} from "./storeConfig";

function currentPlatform(): StorePlatform {
  return Platform.OS === "ios" ? "ios" : "android";
}

/** Whether a rewarded ad can actually be shown right now: the native module
 * must exist in this build (Android only — iOS has no module yet) AND the
 * Game ID plus every placement must be configured. */
export function hasUnityAdsConfig(): boolean {
  return UnityAds !== null && isUnityAdsConfigured(getUnityAdsIds(currentPlatform()));
}

/**
 * How long a LOAD may take before we give up on it ("error"). Unity has no
 * "ad opened" callback on the promise, so the native side emits `onAdStarted`
 * when the video is on screen and this watchdog is cleared then — a rewarded
 * video legitimately runs past 20s and must never be cut off (or silently
 * turned into a "no reward"). What is left after that is the real backstop:
 * a native call that never answers at all.
 */
const LOAD_TIMEOUT_MS = 20_000;

let initStarted = false;
/** One initialize per process; also handed to the native module so a missing
 * call can never leave the entry points dead (it initializes lazily). */
function ensureUnityAdsReady(): void {
  if (initStarted || UnityAds === null) return;
  initStarted = true;
  const { gameId } = getUnityAdsIds(currentPlatform());
  if (gameId.length === 0) return;
  void UnityAds.initialize(
    gameId,
    storeConfig.unityAds.childDirectedTreatment,
    // Dev builds get Unity's test inventory so a dev session can never serve
    // or spend on a live ad (guardrail 5: measure before scaling).
    !isProdEnvNow(),
  ).catch((e: unknown) => console.warn("Unity Ads init failed", e));
}

export const unityAdProvider: AdProvider = {
  id: "unity",
  isAvailable: () => hasUnityAdsConfig(),
  showRewarded(kind: AdKind): Promise<AdResult> {
    if (UnityAds === null) return Promise.resolve("error");
    const { rewardedPlacementIds } = getUnityAdsIds(currentPlatform());
    const placementId = rewardedPlacementIds[kind];
    if (placementId.length === 0) return Promise.resolve("error");
    ensureUnityAdsReady();
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
        started = UnityAds!.addListener("onAdStarted", (payload) => {
          if (payload?.placementId === placementId) clearLoadTimeout();
        });
      } catch (e: unknown) {
        // Old native module without the event — keep the long watchdog.
        console.warn("Unity Ads onAdStarted listener failed", e);
      }
      // No fill / no network / a placement the SDK refuses to load.
      loadTimeout = setTimeout(() => {
        // Give the native show slot back, or every later "watch" tap would
        // keep failing on the one-session-at-a-time guard.
        void UnityAds!.cancelShow().catch(() => undefined);
        settle("error");
      }, LOAD_TIMEOUT_MS);
      UnityAds!.showRewarded(placementId)
        .then(settle)
        .catch((e: unknown) => {
          console.warn("Unity Ads show failed", e);
          settle("error");
        });
    });
  },
};