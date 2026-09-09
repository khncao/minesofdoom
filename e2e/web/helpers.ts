/**
 * Shared helpers for the web e2e suite: boot the static build, skip the
 * first-run onboarding, mine, save, read the persisted save.
 *
 * Selectors: RN-web renders `testID` → `data-testid`, `accessibilityLabel`
 * → `aria-label`, and the game's Button component sets
 * accessibilityRole="button" — so getByRole("button", { name }) works for
 * every Button and pressable-with-role in the app.
 */
import { expect, type Page } from "playwright/test";

/** Load the app root and wait for the mining canvas to be interactive. */
export async function bootApp(page: Page): Promise<void> {
 await page.goto("/");
 await page
  .getByTestId("mining-canvas")
  .waitFor({ state: "visible", timeout: 30_000 });
 await skipOnboarding(page);
}

/** Skip the first-run onboarding overlay if it is up (fresh profiles). */
export async function skipOnboarding(page: Page): Promise<void> {
 const overlay = page.getByTestId("onboarding-overlay");
 if (await overlay.isVisible().catch(() => false)) {
  await page.getByTestId("onboarding-skip").click();
  await expect(overlay).toBeHidden({ timeout: 5_000 });
 }
}

/**
 * One hold-to-mine on the canvas (MINE_HOLD_MS = 300 in MiningCanvas.tsx;
 * RN-web's responder system takes plain mouse events, so down → hold → up).
 */
export async function mineOnce(page: Page): Promise<void> {
 const box = await page.getByTestId("mining-canvas").boundingBox();
 if (box === null) throw new Error("mining-canvas has no bounding box");
 await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
 await page.mouse.down();
 await page.waitForTimeout(650);
 await page.mouse.up();
}

/** Parse the mineral banner text ("1.11M" style) to a number. */
export async function readMinerals(page: Page): Promise<number> {
 const el = page.getByTestId("mineral-count");
 const raw = ((await el.textContent().catch(() => null)) ?? "").trim();
 const m = raw.replace(/,/g, "").match(/^([\d.]+)([KMB])?/i);
 if (!m) throw new Error(`unparseable mineral count: ${JSON.stringify(raw)}`);
 let value = Number.parseFloat(m[1]);
 const suffix = (m[2] ?? "").toUpperCase();
 if (suffix === "K") value *= 1_000;
 if (suffix === "M") value *= 1_000_000;
 if (suffix === "B") value *= 1_000_000_000;
 return value;
}

/**
 * Tap the save pill (persists the current game state). The pill is the
 * game's explicit save affordance; on web the storage is localStorage.
 */
export async function saveNow(page: Page): Promise<void> {
 await page.getByTestId("save-pill").click();
}

/**
 * Read the persisted save from localStorage (web AsyncStorage key is the
 * bare saveDataKey = "save", game.ts). Returns the parsed JSON or null.
 */
export async function readSave(
 page: Page,
): Promise<Record<string, unknown> | null> {
 return page.evaluate(() => {
  try {
   const raw = localStorage.getItem("save");
   return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  } catch {
   return null;
  }
 });
}
