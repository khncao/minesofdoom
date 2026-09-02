/**
 * Rewarded video ads (plan §5.1) — the reward economy and the provider
 * abstraction.
 *
 * Design rules (AGENTS.md guardrails, non-negotiable):
 *  - Rewarded ads only, strictly opt-in: a reward is granted ONLY after the
 *    provider reports a completed ad ("rewarded"). No interstitials, no
 *    banners, nothing in the equation flow.
 *  - Web is 100% free with no ad SDKs: the production provider here is a
 *    no-op whose entry points are hidden (`noopAdProvider`), and a real SDK
 *    provider plugs in behind the same interface when it ships.
 *  - Fraud caps (plan §5.1 "track impressions/rewards in-app to detect
 *    fraud"): rewards are metered per local day (≤ AD_MAX_REWARDS_PER_DAY),
 *    gem rolls have their own tighter daily allowance. The caps are enforced
 *    HERE, in pure code — the provider can only ever trigger them.
 */

import { getLocalDayKey } from "./dailyBonus";

/** The kinds of rewards a completed ad can grant. */
export type AdKind = "gemRolls" | "offlineDouble" | "offlineTopUp" | "comboSave";

/**
 * Outcome of a rewarded ad session. Only "rewarded" entitles the player to
 * the reward; "closed" means the player bailed before finishing, "error"
 * means the ad never showed (no network, no fill, no provider).
 */
export type AdResult = "rewarded" | "closed" | "error";

/**
 * Provider abstraction (plan §5.1: "gate behind a provider abstraction so
 * web falls back to a no-op"). A real SDK integration implements this
 * interface; the reward rules in this file stay untouched by that swap.
 */
export interface AdProvider {
  /** Stable id for logs/toasts ("noop", "dev-sim", "admob", ...). */
  readonly id: string;
  /** Whether a rewarded ad can be shown on this platform right now. */
  isAvailable(): boolean;
  /**
   * Show a rewarded ad. Resolves to "rewarded" only if the player finished
   * it; resolves (never rejects, callers shouldn't need a catch for the
   * happy path) to "closed" or "error" otherwise.
   */
  showRewarded(kind: AdKind): Promise<AdResult>;
}

/**
 * The default production provider: no ad SDK is bundled, so rewarded entry
 * points are hidden everywhere until a real provider is wired in (plan
 * §5.1 — the UI must never offer a "watch" button that plays nothing).
 */
export const noopAdProvider: AdProvider = {
  id: "noop",
  isAvailable: () => false,
  showRewarded: async () => "error",
};

/**
 * Development-build-only provider: simulates a completed ad after a short
 * delay so the full flow (button → watch → reward → daily caps) can be
 * exercised before the real SDK lands. The UI labels it clearly as a
 * simulation (transparency guardrail) and it is only ever selected behind
 * `__DEV__`, so production builds never grant simulated rewards.
 */
export const devSimAdProvider: AdProvider = {
  id: "dev-sim",
  isAvailable: () => true,
  showRewarded: () =>
    new Promise<AdResult>((resolve) => {
      setTimeout(() => resolve("rewarded"), 1500);
    }),
};

/**
 * The ONE LINE that swaps ad integrations (mirrors `selectIapProvider` in
 * iaps.ts). Today: dev builds run the labeled simulation so the full
 * watch → reward → daily caps flow is exercisable without an ad account;
 * production runs the no-op (no ad SDK bundled, entry points hidden, web
 * stays 100% free — guardrail 5). When the real SDK lands
 * (docs/store-integration.md), this body becomes e.g.
 * `Platform.OS === "web" ? noopAdProvider : sdkAdProvider` —
 * `MinesOfDoom.tsx` and every reward rule below are untouched by that change.
 */
export function selectAdProvider(dev: boolean): AdProvider {
  return dev ? devSimAdProvider : noopAdProvider;
}

// ---------------------------------------------------------------------------
// Reward rules
// ---------------------------------------------------------------------------

/** Gems granted per completed "gem roll" ad (plan §5.1 "5 free gem rolls"). */
export const AD_GEM_ROLLS_PER_USE = 5;
/** Completed gem-roll ads per local day. */
export const AD_GEM_ROLLS_PER_DAY = 3;
/**
 * Combo-save ads per local day. A combo save restores a lost combo in full
 * (a multiplier recovery, the strongest of the ad rewards), so it gets the
 * tightest per-kind allowance — one per day.
 */
export const AD_COMBO_SAVES_PER_DAY = 1;
/**
 * How long a lost combo stays restorable after the loss (a wrong answer or
 * a mine tap). The save is an "undo" for the loss that just happened, not
 * a banked reward — after the window it's gone.
 */
export const COMBO_SAVE_WINDOW_MS = 60_000;
/**
 * Total completed-ad rewards per local day, all kinds combined — the fraud
 * cap (plan §5.1: "cap rewards per session, e.g. ≤10/day").
 */
export const AD_MAX_REWARDS_PER_DAY = 10;

/**
 * Persisted ad-reward metering (storage key "adRewards", see
 * useAdRewards). Kept out of the save on purpose: it is a fraud meter, not
 * progress — a shared/imported save must never import the sender's
 * ad-metering, and losing it can only cost the player their free rewards.
 */
export type AdRewardsState = {
  /** Local day key the counters below were last written under. */
  dayKey: string;
  /** Gem-roll ads completed on `dayKey`. */
  rollsUsed: number;
  /** ALL ad rewards granted on `dayKey` (the fraud-cap counter). */
  rewardsToday: number;
  /** Combo-save ads granted on `dayKey` (absent in pre-comboSave saves). */
  savesUsed?: number;
};

/**
 * The counters as they stand right now: a null state or a state from before
 * today reads as fresh (counters reset at the local midnight, same day
 * boundary as the daily bonus).
 */
export function getAdRewardState(
  state: AdRewardsState | null,
  now: number,
): { rollsUsed: number; rewardsToday: number; savesUsed: number } {
  if (state == null || state.dayKey !== getLocalDayKey(now)) {
    return { rollsUsed: 0, rewardsToday: 0, savesUsed: 0 };
  }
  // `state.savesUsed` is absent from states persisted before combo saves
  // shipped (optional in the type for exactly that reason).
  return {
    rollsUsed: Math.max(0, Math.floor(state.rollsUsed)),
    rewardsToday: Math.max(0, Math.floor(state.rewardsToday)),
    savesUsed: Math.max(0, Math.floor(state.savesUsed ?? 0)),
  };
}

export type AdEligibility = {
  /** Whether a completed ad of this kind would grant its reward right now. */
  eligible: boolean;
  /** The gem grant when kind === "gemRolls" (0 for other kinds). */
  gems: number;
};

/**
 * What a completed ad of `kind` would grant right now, without mutating
 * anything. `offlineDouble`, `offlineTopUp` and `comboSave` additionally
 * need their pending offers (a haul to double / an 8h-cap top-up / a recent
 * combo loss) — the caller checks those; this covers the daily-cap side of
 * eligibility.
 */
export function computeAdEligibility(
  state: AdRewardsState | null,
  kind: AdKind,
  now: number,
): AdEligibility {
  const { rollsUsed, rewardsToday, savesUsed } = getAdRewardState(state, now);
  if (rewardsToday >= AD_MAX_REWARDS_PER_DAY) {
    return { eligible: false, gems: 0 };
  }
  if (kind === "gemRolls") {
    if (rollsUsed >= AD_GEM_ROLLS_PER_DAY) {
      return { eligible: false, gems: 0 };
    }
    return { eligible: true, gems: AD_GEM_ROLLS_PER_USE };
  }
  if (kind === "comboSave") {
    if (savesUsed >= AD_COMBO_SAVES_PER_DAY) {
      return { eligible: false, gems: 0 };
    }
    return { eligible: true, gems: 0 };
  }
  return { eligible: true, gems: 0 };
}

/**
 * The persisted state after a completed ad of `kind` was granted (assumes
 * eligibility was checked). Counters are recomputed from the *today* view,
 * so a state from an earlier day rolls over instead of accumulating.
 */
export function applyAdReward(
  state: AdRewardsState | null,
  kind: AdKind,
  now: number,
): AdRewardsState {
  const cur = getAdRewardState(state, now);
  return {
    dayKey: getLocalDayKey(now),
    rollsUsed: cur.rollsUsed + (kind === "gemRolls" ? 1 : 0),
    rewardsToday: cur.rewardsToday + 1,
    savesUsed: cur.savesUsed + (kind === "comboSave" ? 1 : 0),
  };
}
