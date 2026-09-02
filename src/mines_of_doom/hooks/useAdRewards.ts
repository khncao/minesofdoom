import { useCallback, useRef, useState } from "react";
import { useLocalStorage } from "src/hooks/useLocalStorage";
import { useI18n } from "src/hooks/useI18n";
import { formatNumber } from "src/utils/format";
import {
  AdKind,
  AdProvider,
  AdRewardsState,
  AD_GEM_ROLLS_PER_DAY,
  AD_MAX_REWARDS_PER_DAY,
  applyAdReward,
  computeAdEligibility,
  getAdRewardState,
} from "../ads";

/** AsyncStorage key for the ad-reward metering (see ads.ts for why it's
 *  not in the save). */
export const adRewardsKey = "adRewards";

/**
 * Rewarded-ad claims (plan §5.1). Owns the claim lifecycle: eligibility
 * (pure, in ads.ts) → provider.showRewarded → grant the reward through the
 * engine's additive callbacks → update the daily meter.
 *
 * The provider is passed in (MinesOfDoom picks noop vs dev-sim per build),
 * so swapping in a real SDK later touches exactly one line.
 */
export function useAdRewards({
  provider,
  grantGems,
  offlineDouble,
  claimOfflineDouble,
  offlineTopUp,
  claimOfflineTopUp,
  displayMessage,
  onAdView,
}: {
  provider: AdProvider;
  /** Engine callback: grant gems (ad gem rolls). */
  grantGems: (gems: number) => void;
  /** The pending "watch to double" haul from the last load (null = none). */
  offlineDouble: number | null;
  /** Engine callback: consume the pending offline-double offer. */
  claimOfflineDouble: () => void;
  /** The pending "+2h offline top-up" haul from the last load (null = none). */
  offlineTopUp: number | null;
  /** Engine callback: consume the pending offline-top-up offer. */
  claimOfflineTopUp: () => void;
  displayMessage: (message: string, timeout: number) => void;
  /** Fired when the player taps "watch" (analytics first-ad-view). */
  onAdView?: (kind: AdKind) => void;
}) {
  const { t } = useI18n();
  const [state, setState] = useLocalStorage<AdRewardsState | null>(
    adRewardsKey,
    null,
  );
  // The claim re-checks eligibility against the LATEST state via the ref:
  // setState only lands on the next render, and a fast second tap before
  // that render would otherwise see yesterday's meter (same race the daily
  // bonus guards).
  const stateRef = useRef(state);
  stateRef.current = state;
  // Kind currently mid-"ad", if any — one at a time, ever.
  const [claiming, setClaiming] = useState<AdKind | null>(null);
  const claimingRef = useRef(false);

  const available = provider.isAvailable();
  const { rollsUsed, rewardsToday } = getAdRewardState(state, Date.now());
  const gemRollsLeft = Math.max(0, AD_GEM_ROLLS_PER_DAY - rollsUsed);
  const dailyCapLeft = Math.max(0, AD_MAX_REWARDS_PER_DAY - rewardsToday);

  const claim = useCallback(
    (kind: AdKind) => {
      if (claimingRef.current) return;
      const now = Date.now();
      if (
        kind === "offlineDouble" &&
        (offlineDouble == null || offlineDouble <= 0)
      ) {
        return; // no haul to double — the UI should have disabled the row
      }
      if (
        kind === "offlineTopUp" &&
        (offlineTopUp == null || offlineTopUp <= 0)
      ) {
        return; // nothing was withheld by the 8h cap — row disabled
      }
      const eligibility = computeAdEligibility(stateRef.current, kind, now);
      if (!eligibility.eligible) return;
      claimingRef.current = true;
      setClaiming(kind);
      onAdView?.(kind);
      provider
        .showRewarded(kind)
        .then((result) => {
          if (result === "rewarded") {
            if (kind === "gemRolls") {
              grantGems(eligibility.gems);
              displayMessage(
                t("toast.adFinishedGems", {
                  count: formatNumber(eligibility.gems),
                }),
                4000,
              );
            } else if (kind === "offlineDouble") {
              claimOfflineDouble();
              displayMessage(
                t("toast.adFinishedDouble", {
                  count: formatNumber(offlineDouble ?? 0),
                }),
                5000,
              );
            } else {
              claimOfflineTopUp();
              displayMessage(
                t("toast.adFinishedTopUp", {
                  count: formatNumber(offlineTopUp ?? 0),
                }),
                5000,
              );
            }
            setState(applyAdReward(stateRef.current, kind, Date.now()));
          } else if (result === "closed") {
            displayMessage(t("toast.adClosedEarly"), 3000);
          }
          // "error" (no fill / no provider) gets no toast: the button
          // re-enables and that's the whole story.
        })
        .catch((e) => console.warn("Rewarded ad failed", e))
        .finally(() => {
          claimingRef.current = false;
          setClaiming(null);
        });
    },
    [
      provider,
      grantGems,
      offlineDouble,
      claimOfflineDouble,
      offlineTopUp,
      claimOfflineTopUp,
      displayMessage,
      onAdView,
      setState,
      t,
    ],
  );

  return {
    /** Whether "watch" entry points should be shown at all. */
    available,
    /** True while a simulated/real ad is "playing". */
    claiming,
    /** Gem-roll ads left today (the tight per-kind allowance). */
    gemRollsLeft,
    /** Rewards left under the total daily fraud cap. */
    dailyCapLeft,
    canClaimGemRolls: available && gemRollsLeft > 0 && dailyCapLeft > 0,
    canClaimOfflineDouble:
      available &&
      offlineDouble != null &&
      offlineDouble > 0 &&
      dailyCapLeft > 0,
    canClaimOfflineTopUp:
      available &&
      offlineTopUp != null &&
      offlineTopUp > 0 &&
      dailyCapLeft > 0,
    claim,
  };
}
