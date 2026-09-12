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

    // Wide-screen layout (todo: capped content, full-bleed cave): at
    // desktop width the cave spans the viewport while the content column
    // stays capped at 640px (styles.contentColumn / canvasFullBleed).
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.getByTestId("mining-canvas")).toBeVisible();
    const caveBox = await page.getByTestId("mining-canvas").boundingBox();
    if (caveBox === null) throw new Error("cave not laid out");
    expect(
      caveBox.width,
      "the cave is full-bleed across the viewport",
    ).toBeGreaterThan(1400);
    const eqBox = await page.getByTestId("equation-display").boundingBox();
    if (eqBox === null) throw new Error("equation display not laid out");
    expect(eqBox.width, "content stays width-capped").toBeLessThanOrEqual(640);

    // The served build carries the AdSense loader tag in Google TEST MODE
    // (server.mjs injects it) — assert on the DOM, no network needed.
    const loader = page.locator("script[src*='adsbygoogle']");
    await expect(loader).toHaveAttribute("data-adbreak-test", "on");

    // Hold-to-mine works on web (pointer down → hold → up). The exact
    // delta is measured from the persisted save, NOT the mineral banner —
    // the banner uses the player's number notation (compact by default,
    // iteration 20), so a small mining yield rounds to the same "11k".
    await saveNow(page);
    const savedBefore = await readSave(page);
    if (savedBefore === null) throw new Error("a save should be written");
    const before = Number(savedBefore.minerals);

    await mineOnce(page);
    await saveNow(page);
    await expect
      .poll(async () => Number((await readSave(page))?.minerals ?? 0), {
        timeout: 10_000,
      })
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
