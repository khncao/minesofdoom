/**
 * Rewarded ads on the web build (Ad Placement API — the "H5 Games Ads"
 * path, src/mines_of_doom/adSenseProvider.web.ts).
 *
 * Two layers (docs/todo.md: "proper test setup so ads aren't flagged"):
 *
 *  1. STUBBED LOADER — the adsbygoogle.js response is a local script
 *     implementing the exact push contract (beforeReward → beforeAd →
 *     adViewed → afterAd). Zero Google network, fully deterministic, and
 *     the guard asserts NOTHING else reaches an ad domain.
 *
 *  2. REAL LOADER IN GOOGLE TEST MODE — the loader loads from Google, but
 *     the build served for e2e has `data-adbreak-test="on"` injected
 *     (server.mjs). Per Google's docs that renders MOCK ads with NO ad
 *     requests to Google's servers, and cycles the loaded/not-loaded
 *     scenarios. A live-request guard still aborts (and the test fails on)
 *     anything that would become a real impression.
 */
import { expect, test } from "playwright/test";
import type { Page } from "playwright";
import { bootApp, readSave, saveNow } from "./helpers";
import {
  installAdStubs,
  installIapStubs,
  createIapStubState,
  installLiveAdGuard,
} from "./stubs";

/** Window extras the stub loader and the observation wrappers install. */
interface E2EWindow {
  __e2eAdEvents?: string[];
  __e2eRealAdEvents?: string[];
  adsbygoogle?: { push: (item: unknown) => unknown };
}

/** Read events recorded by the stub loader (in-page array). */
async function stubAdEvents(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const w = window as unknown as E2EWindow;
    return w.__e2eAdEvents ?? [];
  });
}

test.describe("rewarded ads — stubbed loader", () => {
  test.beforeEach(async ({ context }) => {
    await installAdStubs(context);
    await installIapStubs(context, createIapStubState());
  });

  test("gem-roll ad pays 5 gems and never touches a live ad domain", async ({
    page,
  }) => {
    await bootApp(page);

    // Open the rewarded-ads panel (🎬 in the header row).
    await page.locator('[aria-label="Rewarded ads"]').click();
    // Fresh save: the first row (gem rolls) is available (gemRollsLeft=3).
    const watch = page.getByRole("button", { name: "Watch" }).first();
    await expect(watch).toBeEnabled();
    await watch.click();

    // The stub plays: beforeReward → (tap) → beforeAd → adViewed (GRANT)
    // → afterAd. Wait on the recorded event sequence (deterministic).
    await expect
      .poll(() => stubAdEvents(page), { timeout: 15_000 })
      .toContain("adViewed");

    // Close the panel via the ✕ button (the 🎬 toggle in the header is
    // covered by the modal backdrop while the panel is open). Two nodes
    // share the "Close settings" label (backdrop + ✕); .last() is the ✕.
    // Then persist and read the grant: fresh save has 0 gems, one
    // gem-roll reward is AD_GEM_ROLLS_PER_USE = 5 (ads.ts).
    await page.getByRole("button", { name: "Close settings" }).last().click();
    await saveNow(page);
    const save = (await readSave(page)) as { gems?: number } | null;
    expect(save?.gems ?? 0).toBe(5);
  });

  test('no-fill path: a dead loader never sticks the button in "Playing…"', async ({
    page,
  }) => {
    await bootApp(page);

    // Simulate the "ad not loaded" half of the fill cycle BEFORE the
    // panel's first prime: swap the queue's push for a no-op so the
    // provider's primeReward lands nowhere (the provider primes when the
    // ad panel opens — adSenseProvider.web.ts). Opening the panel then
    // gives every row showFn === null at tap time → "error"/no-fill.
    await page.evaluate(() => {
      const w = window as unknown as E2EWindow;
      const q = w.adsbygoogle;
      if (q) q.push = () => 0;
    });

    await page.locator('[aria-label="Rewarded ads"]').click();
    const watch = page.getByRole("button", { name: "Watch" }).first();
    await expect(watch).toBeEnabled();
    await watch.click();
    // The no-fill resolves "error": the button re-enables (no toast by
    // design) and the app stays alive (canvas still there).
    await expect
      .poll(
        async () => {
          const btn = page.getByRole("button", { name: "Watch" }).first();
          return btn.isEnabled();
        },
        { timeout: 15_000 },
      )
      .toBeTruthy();
    await expect(page.getByTestId("mining-canvas")).toBeVisible();
  });
});

test.describe("rewarded ads — real loader, Google test mode", () => {
  test("loader runs in test mode with ZERO live ad requests", async ({
    page,
    context,
  }) => {
    // The REAL loader loads from Google (that's the point of this test),
    // but the served build is in documented test mode, and the guard
    // aborts + records anything that would become a live ad impression.
    const guard = await installLiveAdGuard(context);
    await installIapStubs(context, createIapStubState());

    await bootApp(page);

    // Sanity: the served build carries Google's test-mode flag on the
    // loader tag (server.mjs injected it).
    await expect(page.locator("script[src*='adsbygoogle']")).toHaveAttribute(
      "data-adbreak-test",
      "on",
    );

    // Observe the reward callbacks the app primes (wrap the queue's push;
    // delegate to the real array push so the REAL loader still receives
    // the placement). Records beforeAd/adViewed/afterAd in-page.
    await page.evaluate(() => {
      const w = window as unknown as E2EWindow;
      w.__e2eRealAdEvents = [];
      const q = w.adsbygoogle;
      if (!q) return;
      const delegate = q.push.bind(q);
      q.push = (item: unknown) => {
        const p = item as {
          beforeAd?: () => void;
          adViewed?: () => void;
          afterAd?: () => void;
        };
        const log = (name: string) => {
          const events = (window as unknown as E2EWindow).__e2eRealAdEvents;
          events?.push(name);
        };
        const wrapped = { ...p };
        wrapped.beforeAd = () => {
          log("beforeAd");
          p.beforeAd?.();
        };
        wrapped.adViewed = () => {
          log("adViewed");
          p.adViewed?.();
        };
        wrapped.afterAd = () => {
          log("afterAd");
          p.afterAd?.();
        };
        return delegate(wrapped);
      };
    });

    // The app primes all four placements the moment the panel opens
    // (adSenseProvider.primeReward) — that is the moment a live request
    // would go out. Give the real loader a bounded window to process the
    // primed placements, then assert the guard saw nothing.
    //
    // No Watch tap here on purpose: Google test-mode mock ads are
    // unstable in headless Chromium (the cycle can land on the
    // not-loaded side and leave the button stuck in "Playing…" for the
    // open watchdog), and the stubbed-loader suite above already covers
    // the full reward-grant flow deterministically.
    await page.locator('[aria-label="Rewarded ads"]').click();
    await expect(
      page.getByRole("button", { name: "Watch" }).first(),
    ).toBeVisible();
    await page.waitForTimeout(3_000);

    // THE safety assertion: even with the real loader in test mode, not a
    // single live ad request may have gone out.
    expect(
      guard.abortedLive,
      "live ad requests must be zero in test mode",
    ).toEqual([]);

    // The app stayed alive through the real loader round-trip.
    await expect(page.getByTestId("mining-canvas")).toBeVisible();
  });
});
