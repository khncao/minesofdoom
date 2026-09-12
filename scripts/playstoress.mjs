#!/usr/bin/env node
/**
 * Play Store listing screenshots (todo: "add a script to take screenshots of
 * the game with phone, 7 inch tablet, 10 inch tablet resolutions").
 *
 * Uses the WEB build (fastest viable path — no emulators): exports
 * dist/ if missing, serves it with the existing e2e static server
 * (e2e/web/server.mjs — its AdSense test-mode injection keeps the page from
 * phoning Google), then drives headless Chromium with Playwright at the
 * three Play Store screenshot ratios:
 *
 *   phone     412x915  @2x  → 824x1830   (16:9)
 *   tablet-7  1280x800 @1x  → 1280x800   (16:10)
 *   tablet-10 1920x1200 @1x → 1920x1200  (16:10)
 *
 * Three screens per device: the main mining view (after a few
 * hold-to-mines, so the equation/combo are live), the upgrades drawer, and
 * the menu. Output lands in playstore-screenshots/<device>/ (gitignored);
 * pick 2-8 of the shots per listing in Play Console.
 *
 * Usage: pnpm exec playstoress
 */
import { existsSync, mkdirSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const DIST = join(ROOT, "dist");
const OUT = join(ROOT, "playstore-screenshots");
const PORT = Number(process.env.PLAYSTORESS_PORT || 4399);
const BASE = `http://localhost:${PORT}`;

const DEVICES = [
  { name: "phone", width: 412, height: 915, scale: 2 },
  { name: "tablet-7", width: 1280, height: 800, scale: 1 },
  { name: "tablet-10", width: 1920, height: 1200, scale: 1 },
];

/** Boot the app on a fresh profile and leave it on the main screen. */
async function boot(page) {
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("mining-canvas").waitFor({ state: "visible", timeout: 30_000 });
  const overlay = page.getByTestId("onboarding-overlay");
  if (await overlay.isVisible().catch(() => false)) {
    await page.getByTestId("onboarding-skip").click();
    await expectHidden(overlay);
  }
  // Let the auto-daily-equation / auto-daily-bonus toasts come and go.
  await page.waitForTimeout(3_500);
}

async function expectHidden(locator) {
  await locator.waitFor({ state: "hidden", timeout: 5_000 }).catch(() => {});
}

/** One hold-to-mine on the canvas (same gesture the web e2e helpers use). */
async function mineOnce(page) {
  const box = await page.getByTestId("mining-canvas").boundingBox();
  if (box === null) throw new Error("mining-canvas has no bounding box");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(650);
  await page.mouse.up();
}

async function shoot(page, device, n, screen) {
  const dir = join(OUT, device.name);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${String(n).padStart(2, "0")}-${screen}.png`);
  await page.screenshot({ path });
  console.log(`  ${join("playstore-screenshots", device.name, path.split("/").pop())}`);
}

async function main() {
  if (!existsSync(join(DIST, "index.html"))) {
    console.log("[playstoress] no web build — running `expo export -p web` first…");
    const r = spawnSync("npx", ["expo", "export", "-p", "web"], {
      cwd: ROOT,
      stdio: "inherit",
    });
    if (r.status !== 0) throw new Error("expo export failed");
  }

  const server = spawn(process.execPath, [join(ROOT, "e2e", "web", "server.mjs")], {
    cwd: ROOT,
    env: { ...process.env, E2E_WEB_PORT: String(PORT) },
    stdio: ["ignore", "inherit", "inherit"],
  });
  let browser;
  try {
    for (let i = 0; i < 50; i++) {
      const ok = await fetch(`${BASE}/__e2e/ping`)
        .then((r) => r.ok)
        .catch(() => false);
      if (ok) break;
      await new Promise((res) => setTimeout(res, 300));
    }
    const ping = await fetch(`${BASE}/__e2e/ping`)
      .then((r) => r.ok)
      .catch(() => false);
    if (!ping) throw new Error(`e2e server did not come up on :${PORT}`);

    browser = await chromium.launch();
    mkdirSync(OUT, { recursive: true });
    for (const device of DEVICES) {
      console.log(`[playstoress] ${device.name} (${device.width}x${device.height} @${device.scale}x)`);
      const context = await browser.newContext({
        viewport: { width: device.width, height: device.height },
        deviceScaleFactor: device.scale,
      });
      const page = await context.newPage();
      try {
        await boot(page);
        for (let i = 0; i < 6; i++) await mineOnce(page);
        await page.waitForTimeout(800); // let the last combo/fx settle
        await shoot(page, device, 1, "main");

        await page.getByTestId("upgrades-toggle").click();
        await page.getByTestId("upgrades-drawer").waitFor({ state: "visible", timeout: 5_000 });
        await page.waitForTimeout(600);
        await shoot(page, device, 2, "upgrades");
        await page.getByTestId("upgrades-drawer-close").click();
        await page.waitForTimeout(600);

        await page.getByTestId("menu-button").click();
        await page.waitForTimeout(900);
        await shoot(page, device, 3, "menu");
      } finally {
        await context.close();
      }
    }
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.kill("SIGTERM");
  }
  console.log(`[playstoress] done — ${join("playstore-screenshots", "")} (pick 2-8 shots per listing)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
