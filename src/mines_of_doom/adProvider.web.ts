/**
 * Web variant of `./adProvider` — Metro resolves this file (`.web`
 * extension) for the web target, so `react-native-google-mobile-ads` is
 * never bundled into the web build (guardrail 5: web is 100% free with no
 * ad SDKs at all). It mirrors the native module's shape exactly, so
 * `ads.ts` and its tests are platform-agnostic: on web the pair is by
 * construction "not configured" and the no-op provider is selected.
 */
import type { AdProvider, AdResult } from "./ads";

export function hasAdMobConfig(): boolean {
  return false;
}

export const adMobAdProvider: AdProvider = {
  id: "noop",
  isAvailable: () => false,
  // Fewer params than the interface is legal (and keeps lint quiet): the
  // kind is irrelevant on web — nothing ever resolves "rewarded" here.
  showRewarded: async (): Promise<AdResult> => "error",
};
