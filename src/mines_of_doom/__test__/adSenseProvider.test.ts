/**
 * Unit tests for the WEB AdSense provider (adSenseProvider.web.ts) — the
 * two-phase Ad Placement API flow. The DOM is faked with a plain
 * `globalThis.window.adsbygoogle` array that captures the pushed
 * placements, and the tests drive the loader's callbacks by hand
 * (beforeReward → beforeAd → adViewed/adDismissed → afterAd), which is
 * exactly the sequence the real loader emits.
 *
 * The provider module is a singleton (module-level slot map), so each test
 * uses a DISTINCT AdKind to avoid cross-test state; a fully settled kind
 * is clean again, but distinct kinds make the isolation obvious.
 */
import {
  adSenseAdProvider,
  primeReward,
} from "../adSenseProvider.web";

/** The shape the tests drive: the callbacks the loader invokes on a
 *  `type: "reward"` placement (see adSenseProvider.web.ts). */
interface FakePlacement {
  type: string;
  name: string;
  beforeReward: (showAdFn: () => void) => void;
  beforeAd: () => void;
  adViewed: () => void;
  adDismissed: () => void;
  afterAd: () => void;
}

let queue: FakePlacement[] = [];
let savedWindow: unknown;

beforeAll(() => {
  savedWindow = (globalThis as { window?: unknown }).window;
});

afterAll(() => {
  (globalThis as { window?: unknown }).window = savedWindow;
});

/** Install a fresh fake loader queue. */
function installLoader(): void {
  queue = [];
  (globalThis as { window?: unknown }).window = { adsbygoogle: queue };
}

/** Grab the placement pushed for `kind` (throws if absent). */
function placement(name: string): FakePlacement {
  const p = queue.find((x) => x.name === name);
  expect(p).toBeDefined();
  return p as FakePlacement;
}

it("viewed-to-the-end resolves 'rewarded' and re-primes the placement", async () => {
  installLoader();
  primeReward("gemRolls");
  expect(queue).toHaveLength(1);
  const p = placement("gemRolls");
  expect(p.type).toBe("reward");

  let shown = false;
  p.beforeReward(() => {
    shown = true;
  });

  const result = adSenseAdProvider.showRewarded("gemRolls");
  expect(shown).toBe(true); // showFn was invoked SYNCHRONOUSLY in the tap
  p.beforeAd();
  p.adViewed();
  p.adDismissed();
  await expect(result).resolves.toBe("rewarded");

  // A FRESH probe replaces the consumed placement (fresh placement per
  // opportunity to show), so the NEXT tap can fill again.
  expect(queue).toHaveLength(2);
  expect(queue[1].name).toBe("gemRolls");
});

it("dismissed before the full view resolves 'closed'", async () => {
  installLoader();
  primeReward("comboSave");
  placement("comboSave").beforeReward(() => {});
  const result = adSenseAdProvider.showRewarded("comboSave");
  placement("comboSave").beforeAd();
  placement("comboSave").adDismissed(); // no adViewed
  await expect(result).resolves.toBe("closed");
});

it("a tap with no filled probe resolves 'error' and re-primes", async () => {
  installLoader();
  primeReward("offlineDouble");
  expect(queue).toHaveLength(1);
  // The loader found no suitable ad: beforeReward is never called.
  await expect(adSenseAdProvider.showRewarded("offlineDouble")).resolves.toBe(
    "error",
  );
  // The tap itself is an opportunity to show — a fresh probe was pushed.
  expect(queue).toHaveLength(2);
});

it("priming before the loader booted is a silent no-op", () => {
  // No adsbyglobal array yet: the async script from +html.tsx hasn't run.
  (globalThis as { window?: unknown }).window = {};
  expect(() => primeReward("offlineTopUp")).not.toThrow();
  expect(
    (globalThis as { window: { adsbygoogle?: unknown[] } }).window
      .adsbygoogle,
  ).toBeUndefined();
  // Once the loader booted, priming works (and the kind was never marked
  // in-flight, so the tap path is unblocked).
  installLoader();
  primeReward("offlineTopUp");
  expect(queue).toHaveLength(1);
});

it("reporting: provider id and availability follow the config gate", () => {
  installLoader();
  expect(adSenseAdProvider.id).toBe("adsense");
  // Live storeConfig pins the client (docs/todo.md #2) → available.
  expect(adSenseAdProvider.isAvailable()).toBe(true);
});
