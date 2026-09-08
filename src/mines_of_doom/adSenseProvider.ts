/**
 * NATIVE variant of the AdSense provider — a no-op.
 *
 * The AdSense "Ad Placement API" is a WEB-only API (the web build resolves
 * `./adSenseProvider.web` via Metro's `.web` swap, where the real
 * two-phase rewarded implementation lives). Native rewarded ads run on the
 * AdMob SDK (adProvider.ts), so this file only exists so `ads.ts` can
 * import ONE name on every platform and `pickAdProvider` can stay
 * platform-agnostic: on native the web branch is never selected
 * (`sel.web` is false), and even if it were, this no-op reports
 * unavailable and hides the entry points (guardrail 4).
 */
import type { AdKind, AdProvider, AdResult } from "./ads";

export const AD_SENSE_KINDS: readonly AdKind[] = [
  "gemRolls",
  "comboSave",
  "offlineDouble",
  "offlineTopUp",
];

export function primeReward(): void {
  // No-op on native — AdMob loads per-tap, there is nothing to prime.
  // (Zero-arg: the kind is irrelevant here and callers on native never
  // pass it — this is not the interface shape, just a native stand-in.)
}

export const adSenseAdProvider: AdProvider = {
  id: "adsense",
  isAvailable: () => false,
  primeReward,
  // Fewer params than the interface is legal (and keeps lint quiet): the
  // kind is irrelevant here — nothing ever resolves "rewarded" on native.
  showRewarded: async (): Promise<AdResult> => "error",
};
