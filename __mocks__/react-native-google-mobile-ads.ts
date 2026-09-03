/**
 * Jest manual mock for `react-native-google-mobile-ads` (auto-applied by
 * jest for node modules — the real module resolves native TurboModules
 * that don't exist in the test environment). Unit tests never exercise the
 * SDK itself: the AdMob integration in src/mines_of_doom/adProvider.ts is
 * tested through the pure selection rules (ads.test.ts), the config rules
 * (storeConfig.test.ts) and on-device flows (Maestro, runbook §3).
 *
 * Shape mirrors the v16 API surface adProvider.ts imports: default
 * `MobileAds` module factory + `RewardedAd`/event-type enums.
 */
export const MobileAds = {
  initialize: jest.fn(async () => []),
  setRequestConfiguration: jest.fn(async () => undefined),
};
export default MobileAds;
export const RewardedAd = { createForAdRequest: jest.fn() };
export const AdEventType = {
  LOADED: "loaded",
  ERROR: "error",
  OPENED: "opened",
  PAID: "paid",
  CLICKED: "clicked",
  CLOSED: "closed",
};
export const RewardedAdEventType = {
  LOADED: "rewarded_loaded",
  EARNED_REWARD: "rewarded_earned_reward",
};
