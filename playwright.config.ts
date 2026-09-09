import { defineConfig } from "playwright/test";

// Web e2e (todo: "add e2e tests that the web build is fully functional,
// including IAP and ads"). The suite serves the STATIC WEB BUILD (dist/,
// produced by `expo export -p web` — run `pnpm run test:e2e:web`, which
// exports first) from e2e/web/server.mjs and drives it in Chromium:
//
//   boot.spec.ts  app boots, onboarding skips, hold-to-mine works, the save
//                 round-trips through a reload (web build is "fully
//                 functional" for a free player)
//   ads.spec.ts   rewarded-ad pipeline (Ad Placement API) with a STUBBED
//                 loader (zero Google network) AND with the REAL loader in
//                 Google's documented test mode (data-adbreak-test="on" —
//                 mock ads, no ad requests to Google servers)
//   iap.spec.ts   web IAP round-trip: shop → POST /stripe/checkout →
//                 js.stripe.com redirectToCheckout → ?iap=success return
//                 → POST /api/app/verify → /api/app/restore → entitlement
//                 visible in the shop. The Pocketbase sidecar and Stripe
//                 are stubbed with page.route (docs/store-integration.md §2.7).

export default defineConfig({
  testDir: "./e2e/web",
  testMatch: /.*\.spec\.ts$/,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  // One worker: the specs are fast and the suite should read top-to-bottom.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:4173",
    headless: true,
    // The game is a mobile layout; drive it at a phone viewport.
    viewport: { width: 480, height: 800 },
  },
  webServer: {
    command: "node e2e/web/server.mjs",
    url: "http://localhost:4173/__e2e/ping",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
