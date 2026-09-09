/**
 * Web build boot + core loop: the free player's path is fully functional on
 * the static export — app boots, onboarding skips, hold-to-mine works, and
 * the save round-trips through a page reload.
 *
 * Hermetic: the ad-loader domain and the Pocketbase sidecar are aborted at
 * the network layer, so this also doubles as the offline-resilience check
 * (the game must work with zero backends — the free path, guardrail 1).
 */
import { expect, test } from "playwright/test";
import { bootApp, mineOnce, readMinerals, readSave, saveNow } from "./helpers";
import { installAdStubs, installIapStubs, createIapStubState } from "./stubs";

test.describe("web build — boot & free path", () => {
  test.beforeEach(async ({ context }) => {
    // Stub the loader (no Google network at all) and abort the sidecar,
    // so the run is fully hermetic AND proves the app boots without them.
    await installAdStubs(context);
    await installIapStubs(context, createIapStubState());
  });

  test("boots, skips onboarding, mines, and the save survives a reload", async ({
    page,
  }) => {
    await bootApp(page);

    // The core loop is visible: equation to solve + the hold-to-mine canvas.
    await expect(page.getByTestId("equation-display")).toBeVisible();
    await expect(page.getByTestId("mining-canvas")).toBeVisible();

    // The served build carries the AdSense loader tag in Google TEST MODE
    // (server.mjs injects it) — assert on the DOM, no network needed.
    const loader = page.locator("script[src*='adsbygoogle']");
    await expect(loader).toHaveAttribute("data-adbreak-test", "on");

    const before = await readMinerals(page);

    // Hold-to-mine works on web (pointer down → hold → up).
    await mineOnce(page);
    await expect
      .poll(() => readMinerals(page), { timeout: 10_000 })
      .toBeGreaterThan(before);
    const afterMine = await readMinerals(page);

    // Explicit save, then reload: the persisted save survives.
    await saveNow(page);
    const saved = await readSave(page);
    expect(saved, "a save should be written to localStorage").not.toBeNull();

    await page.reload();
    await page
      .getByTestId("mining-canvas")
      .waitFor({ state: "visible", timeout: 30_000 });
    const onboarding = page.getByTestId("onboarding-overlay");
    if (await onboarding.isVisible().catch(() => false)) {
      await page.getByTestId("onboarding-skip").click();
    }
    await expect
      .poll(() => readMinerals(page), { timeout: 10_000 })
      .toBeGreaterThanOrEqual(afterMine);
  });

  test("boots with the sidecar and ad network unreachable (offline resilience)", async ({
    page,
  }) => {
    // beforeTest already aborted sidecar + ad domains; just prove the app
    // still boots and the ad entry point is present but non-fatal.
    await bootApp(page);
    await expect(page.getByTestId("mining-canvas")).toBeVisible();
    await expect(page.getByTestId("equation-display")).toBeVisible();
    // The rewarded-ad entry point (🎬) is config-gated, not network-gated.
    await expect(page.locator('[aria-label="Rewarded ads"]')).toBeVisible();
    // And a purchase attempt with the sidecar down degrades, not crashes:
    // (covered in depth by iap.spec.ts with stubs; here only boot matters.)
    const save = await readSave(page);
    void save;
  });
});
