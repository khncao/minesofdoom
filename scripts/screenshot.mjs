#!/usr/bin/env node
/**
 * Todo screenshots (todo: "screenshot the result when done"): serves the
 * static web build (dist/) through the existing e2e static server, seeds a
 * RICH save (a crew + gems + several owned outfits with per-crew
 * assignments) via localStorage, then drives headless Chromium at a phone
 * viewport and captures the new todo items:
 *
 *   main.png       the vertical crew column down the middle of the shaft
 *                  (per-miner outfits visible: Night Shift / Gold Rush /
 *                  Crystal on different hires) + the translucent UI panels
 *                  (header bar, depth banner, equation, answer, combo,
 *                  hint pill)
 *   shop.png       the cosmetic shop: grid cards with larger previews, the
 *                  "worn by" wearer selector on the Outfits group
 *
 * Output lands in screenshots/ (gitignored). Usage: node scripts/screenshot.mjs
 */
import { existsSync, mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const DIST = join(ROOT, "dist");
const OUT = join(ROOT, "screenshots");
const PORT = Number(process.env.SCREENSHOT_PORT || 4411);
const BASE = `http://localhost:${PORT}`;

/** A mid-game save: a crew with per-miner outfits, gems to browse the
 *  shop, and owned clothes/pickaxes so owned cards render "Wear/Equip". */
const richSave = {
  minerals: "150000",
  gems: 300,
  clickPower: 20,
  miners: 5,
  minerPower: 4,
  fastMiners: 2,
  legendaryMiners: 1,
  gemChanceLevels: 2,
  prestigeLevel: 0,
  clickBoostLevels: 0,
  comboResistLevels: 0,
  startTime: Date.now(),
  saveTime: Date.now(),
  saveVersion: 13,
  lifetimeMinerals: "150000",
  lifetimeCorrect: 40,
  maxCombo: 12,
  maxDepth: "300",
  minersOwnedEver: 8,
  totalGemsMinted: 25,
  gemsBoughtWithMinerals: 0,
  totalGemsSpent: 0,
  totalPrestiges: 0,
  playSeconds: 900,
  lastActiveDay: "",
  completedTiers: ["miner-power", "fast-miner", "cave-theme", "legendary-miner"],
  completedAchievements: [],
  playerSeed: 123456789,
  ownedCosmetics: [
    "classic",
    "steel",
    "night",
    "goldrush",
    "crystal",
    "magma",
    "marmot",
    "gold",
    "frost",
  ],
  selectedOutfit: "classic",
  selectedPickaxe: "gold",
  ownedCaveThemes: ["natural"],
  selectedCaveTheme: "natural",
  minerOutfits: {
    "0": "night",
    "1": "goldrush",
    "2": "crystal",
    "3": "magma",
    "4": "marmot",
  },
};

async function main() {
  if (!existsSync(DIST)) {
    console.error(
      `No web build at ${DIST} — run \`pnpm run test:e2e:web\` once or \`pnpm exec expo export -p web\` first.`,
    );
    process.exit(1);
  }
  mkdirSync(OUT, { recursive: true });

  // Serve the static build through the e2e server (test-mode ads, no
  // Google traffic) on our own port.
  const server = spawn(
    process.execPath,
    ["e2e/web/server.mjs"],
    {
      cwd: ROOT,
      env: { ...process.env, E2E_WEB_PORT: String(PORT), E2E_WEB_DIST: DIST },
      stdio: "ignore",
    },
  );
  // Give the server a moment to bind, then probe it.
  await waitForServer();

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 412, height: 915 },
      deviceScaleFactor: 1,
    });

    // Seed the rich save BEFORE the app boots (the loader reads it cold).
    await page.addInitScript(
      (save) => {
        localStorage.setItem("save", JSON.stringify(save));
        localStorage.setItem("onboardingDone", "true");
      },
      richSave,
    );

    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("mining-canvas").waitFor({
      state: "visible",
      timeout: 30_000,
    });
    // Let the auto-daily equation/bonus toasts come and go.
    await page.waitForTimeout(3500);

    // Main view: the vertical crew + the translucent UI panels.
    await page.screenshot({ path: join(OUT, "main.png") });

    // Shop: open 🛍️ and scroll to the Outfits group (wearer row + grid).
    await page.locator('[aria-label="Shop"]').click();
    await page.getByText("Outfits").first().waitFor({ state: "visible" });
    // Scroll the outfit cards into view (the sheet scrolls internally).
    await page
      .getByText(/Night Shift/)
      .first()
      .scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    await page.screenshot({ path: join(OUT, "shop.png") });
    console.log(`screenshots written to ${OUT}/`);
  } finally {
    await browser.close();
    server.kill();
  }
}

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`${BASE}/__e2e/ping`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("e2e server did not come up in time");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});