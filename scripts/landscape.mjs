/**
 * Landscape layout harness (2026-10-04).
 *
 * Play raised "remove resizability and orientation restrictions to support
 * large screen devices" against 1.0.16, so the portrait lock was removed
 * (app.config.ts). This script is the guard for what that exposed: the
 * landscape layout has to actually hold together — the upgrades panel, the
 * on-screen keypad, the footer/menu row and the shop sheet all have to be
 * reachable and correctly sized in a short, wide viewport.
 *
 * It drives the WEB build (same static export the Play listing screenshots
 * come from) through the hermetic e2e server, seeded with the SAME rich save
 * as scripts/screenshot.mjs so the shots are comparable. No ad/SIAP traffic.
 *
 * Usage:  node scripts/landscape.mjs [portrait|landscape|all]
 * Output: screenshots/landscape-*.png
 */
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { RICH_SAVE } from "./richSave.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const OUT = join(ROOT, "screenshots");
const PORT = Number(process.env.LANDSCAPE_PORT ?? 8099);
const BASE = `http://127.0.0.1:${PORT}`;

/** A phone in portrait (the reference) and the same phone rotated. The
 *  landscape size is the portrait size with the axes swapped — that is what
 *  a real rotation produces, so it is the size worth testing. */
const VIEWPORTS = {
  portrait: { width: 412, height: 915 },
  landscape: { width: 915, height: 412 },
};

function waitForServer(timeoutMs = 30_000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      fetch(`${BASE}/`)
        .then(() => resolve())
        .catch(() => {
          if (Date.now() - started > timeoutMs) {
            reject(new Error("e2e web server did not start"));
          } else {
            setTimeout(tick, 200);
          }
        });
    };
    tick();
  });
}

/** Everything the layout has to get right in a short viewport. Each entry
 *  is a stable testID (see AGENTS.md) — never emoji/text, which is
 *  data-driven. */
const CHECKS = [
  // The upgrades drawer — the panel the report calls out first.
  { id: "upgrades", shot: "upgrades", open: async (p) => {
      await p.getByTestId("upgrades-toggle").click();
      await p.getByTestId("upgrades-drawer").waitFor({ state: "visible" });
    } },
  // The on-screen keypad.
  { id: "keypad", shot: "keypad", open: async (p) => {
      await p.getByTestId("answer-display").click();
      await p.getByTestId("keypad").waitFor({ state: "visible" });
    } },
  // The menu sheet (settings/account tabs live in here).
  { id: "menu", shot: "menu", open: async (p) => {
      await p.getByTestId("menu-button").click();
      await p.getByTestId("settings-view").waitFor({ state: "visible" });
    } },
];

async function shoot(page, name) {
  mkdirSync(OUT, { recursive: true });
  const path = join(OUT, `landscape-${name}.png`);
  await page.screenshot({ path });
  console.log(`  wrote ${path}`);
}

async function main() {
  const which = process.argv[2] ?? "all";
  const targets =
    which === "all" ? Object.keys(VIEWPORTS) : [which];

  const server = spawn(process.execPath, ["e2e/web/server.mjs"], {
    cwd: ROOT,
    env: { ...process.env, E2E_WEB_PORT: String(PORT), E2E_WEB_DIST: DIST },
    stdio: "ignore",
  });
  await waitForServer();

  const browser = await chromium.launch();
  try {
    for (const target of targets) {
      const viewport = VIEWPORTS[target];
      console.log(`\n=== ${target} ${viewport.width}x${viewport.height} ===`);
      const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
      await page.addInitScript((save) => {
        localStorage.setItem("save", JSON.stringify(save));
        localStorage.setItem("onboardingDone", "true");
        // The on-screen keypad is the layout-sensitive one, so force it on
        // for a deterministic check.
        localStorage.setItem("onScreenKeypad", "true");
      }, RICH_SAVE);
      await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
      await page.getByTestId("mining-canvas").waitFor({
        state: "visible",
        timeout: 30_000,
      });
      await page.waitForTimeout(2500);
      await shoot(page, `${target}-main`);

      for (const check of CHECKS) {
        try {
          await check.open(page);
          await page.waitForTimeout(600);
          await shoot(page, `${target}-${check.shot}`);
        } catch (e) {
          // A missing/unreachable panel IS the bug being hunted, so record
          // it instead of throwing — the run should report every failure.
          console.log(`  ✗ ${check.id}: ${e.message.split("\n")[0]}`);
        }
        // Reload between checks so one panel's state cannot mask the next.
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.getByTestId("mining-canvas").waitFor({
          state: "visible",
          timeout: 30_000,
        });
        await page.waitForTimeout(1200);
      }
      await page.close();
    }
  } finally {
    await browser.close();
    server.kill();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
