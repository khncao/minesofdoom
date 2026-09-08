/**
 * WEB variant of the rewarded-ad provider — Google AdSense "Ad Placement
 * API" (H5 Games Ads, developers.google.com/ad-placement), the web parity
 * path for rewarded ads (docs/store-integration.md §1.1). Metro resolves
 * this file (`.web` extension) for the web target; the native bundle
 * resolves `./adSenseProvider` instead (a no-op — native rewarded ads run
 * on the AdMob SDK, see adProvider.ts), so this file and its DOM access
 * never enter a native bundle.
 *
 * The API is TWO-PHASE, unlike AdMob:
 *  1. A probe — `primeReward(kind)` pushes a `type: "reward"` placement
 *     onto the `window.adsbygoogle` queue (the loader script is emitted by
 *     +html.tsx from the same storeConfig values). If a suitable ad is
 *     found, the loader asynchronously calls the placement's
 *     `beforeReward(showAdFn)` and we stash the show function.
 *  2. The "watch" tap — `showRewarded(kind)` (called from the tap handler)
 *     invokes the stashed `showAdFn` SYNCHRONOUSLY. The docs require the
 *     show function to be called as a direct user action, so the probe
 *     must precede the tap: the UI primes when the ad panel opens and
 *     when the combo-save pill appears, and this provider re-primes after
 *     every finished ad (the docs want a FRESH placement for every
 *     opportunity to show, so a stale/expired ad is replaced).
 *
 * Result mapping (AdResult, ads.ts):
 *  - "rewarded" — `adViewed` fired (the ONLY path that entitles the
 *    player to the reward; the hook grants it, not the SDK).
 *  - "closed"   — the ad ended without a full view (dismissed early).
 *  - "error"    — no probe had filled at tap time (no fill / loader not
 *    up yet), or the ad never opened (watchdog).
 *
 * Gating: `isAdSenseConfigured()` (storeConfig) — while the publisher
 * client is empty this provider reports unavailable and the entry points
 * stay hidden, exactly like the empty-config = hidden rule everywhere.
 */
import type { AdKind, AdProvider, AdResult } from "./ads";
import { isAdSenseConfigured } from "./storeConfig";

/** How long a tapped ad may take to OPEN before we give up ("error").
 *  Cleared by `beforeAd` — once the video is on screen it may run as
 *  long as it needs (same shape as the AdMob provider's load timeout). */
const OPEN_WATCHDOG_MS = 60_000;

/** All four placements, primed together when the ad panel opens. */
export const AD_SENSE_KINDS: readonly AdKind[] = [
  "gemRolls",
  "comboSave",
  "offlineDouble",
  "offlineTopUp",
];

/** The window as far as this module needs it (no DOM lib types here —
 *  native builds never resolve this file, but keep the access indirect
 *  so unit tests can stub `globalThis.window`). */
interface AdQueueWindow {
  adsbygoogle?: unknown;
}

/** The loader-maintained placement queue, or null while the async loader
 *  script from +html.tsx has not booted yet. */
function adQueue(): unknown[] | null {
  const w = (globalThis as { window?: AdQueueWindow }).window;
  const q = w?.adsbygoogle;
  return Array.isArray(q) ? (q as unknown[]) : null;
}

/** Per-placement slot: the probe result plus the in-flight ad's state.
 *  A module-level map (one per AdKind) — the provider is a singleton and
 *  the placements it pushes hold onto these closures for the page's
 *  lifetime. */
interface Slot {
  /** The show function handed over by the latest `beforeReward`
   *  (null = nothing filled yet). Consumed (nulled) by the tap. */
  showFn: (() => void) | null;
  /** True from the tap (or `beforeAd`) until the terminal callback. */
  showing: boolean;
  /** `adViewed` fired — the only flag that maps to "rewarded". */
  earned: boolean;
  /** The watchdog fired before the ad opened. */
  timedOut: boolean;
  /** Resolves the `showRewarded` promise for the in-flight ad. */
  settle: ((result: AdResult) => void) | null;
  watchdog: ReturnType<typeof setTimeout> | null;
}

const slots = new Map<AdKind, Slot>();
/** The kind with an in-flight ad (one at a time, ever — mirrors the
 *  `claiming` guard in useAdRewards). */
let activeKind: AdKind | null = null;

function slot(kind: AdKind): Slot {
  let s = slots.get(kind);
  if (s == null) {
    s = {
      showFn: null,
      showing: false,
      earned: false,
      timedOut: false,
      settle: null,
      watchdog: null,
    };
    slots.set(kind, s);
  }
  return s;
}

/**
 * End the in-flight ad for `kind` with whatever outcome the callbacks
 * accumulated, then re-probe so the NEXT tap can fill again (fresh
 * placement per opportunity to show — see the file header).
 */
function settle(kind: AdKind): void {
  const s = slot(kind);
  if (!s.showing) return;
  s.showing = false;
  if (s.watchdog != null) {
    clearTimeout(s.watchdog);
    s.watchdog = null;
  }
  const result: AdResult = s.timedOut
    ? "error"
    : s.earned
      ? "rewarded"
      : "closed";
  s.settle?.(result);
  s.settle = null;
  s.earned = false;
  s.timedOut = false;
  s.showFn = null;
  if (activeKind === kind) activeKind = null;
  primeReward(kind);
}

/**
 * Phase 1: push (or refresh) the `type: "reward"` placement for `kind`.
 * Safe to call any number of times — a placement is just a queue entry,
 * and a later one supersedes an earlier probe for the same kind.
 */
export function primeReward(kind: AdKind): void {
  if (!isAdSenseConfigured() || activeKind != null) return;
  const queue = adQueue();
  if (queue == null) return; // loader not up yet — the UI primes again on open
  const s = slot(kind);
  queue.push({
    type: "reward",
    // `name` is the placement's identity in the AdSense console — one
    // per AdKind so reports group by the game's placement, not by page.
    name: kind,
    beforeReward: (showAdFn: () => void) => {
      // Only the LIVE slot may receive a show function (a superseded
      // probe's callback must not clobber a fresher one).
      if (activeKind == null && slot(kind) === s) s.showFn = showAdFn;
    },
    beforeAd: () => {
      // The ad is on screen — the open watchdog no longer applies
      // (a full video routinely outlasts any fixed window).
      s.showing = true;
      if (s.watchdog != null) {
        clearTimeout(s.watchdog);
        s.watchdog = null;
      }
    },
    adViewed: () => {
      s.earned = true;
    },
    adDismissed: () => settle(kind),
    afterAd: () => settle(kind),
  });
}

export const adSenseAdProvider: AdProvider = {
  id: "adsense",
  // Config-gated like every other provider (the loader script is emitted
  // by +html.tsx under the same condition). Network state is checked at
  // tap time, not here — mirrors the AdMob provider, whose isAvailable
  // is likewise just the config gate.
  isAvailable: () => isAdSenseConfigured(),
  primeReward,
  showRewarded(kind: AdKind): Promise<AdResult> {
    if (!isAdSenseConfigured() || activeKind != null) {
      return Promise.resolve("error");
    }
    const s = slot(kind);
    if (s.showFn == null) {
      // No fill at tap time. The tap itself is an "opportunity to show"
      // — re-probe so the NEXT tap can fill — and resolve "error" like
      // any other no-fill (the button re-enables; no toast by design).
      primeReward(kind);
      return Promise.resolve("error");
    }
    const showFn = s.showFn;
    activeKind = kind;
    s.showing = true;
    s.earned = false;
    s.timedOut = false;
    s.showFn = null; // consumed
    const p = new Promise<AdResult>((resolve) => {
      s.settle = resolve;
    });
    s.watchdog = setTimeout(() => {
      s.timedOut = true;
      settle(kind);
    }, OPEN_WATCHDOG_MS);
    try {
      // The synchronous call inside the tap handler is the "direct user
      // action" the Ad Placement API requires.
      showFn();
    } catch (e) {
      console.warn("AdSense show failed", e);
      settle(kind);
    }
    return p;
  },
};
