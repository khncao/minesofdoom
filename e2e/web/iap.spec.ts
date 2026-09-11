/**
 * Web IAP round-trip (docs/store-integration.md §2.7, todo #1): the
 * full free-player-visible purchase flow on the static web build, with the
 * Pocketbase sidecar and Stripe stubbed at the network layer:
 *
 *   shop → cash buy → POST /stripe/checkout (stub session id)
 *   → js.stripe.com stub → redirectToCheckout → the COMPLETED hosted
 *   checkout's return visit (?iap=success&iap_product=…&iap_sid=…)
 *   → POST /api/app/verify (mint) → POST /api/app/restore (entitlements)
 *   → the pack shows owned (✓ + Equip) in the shop.
 *
 * No live Stripe/Pocketbase calls: the stubs mint and replay exactly what
 * the real sidecar would (verify mints the entitlement, restore returns it),
 * and every other sidecar/Stripe request is aborted — the app must survive
 * without its backends. The separate `checkoutTest.mjs` script covers the
 * LIVE test-account round-trip (real sessions, real VPS).
 */
import { expect, test } from "playwright/test";
import { bootApp } from "./helpers";
import { createIapStubState, installAdStubs, installIapStubs } from "./stubs";

test.describe("web IAP — purchase round-trip", () => {
   test("cash buy → hosted checkout → return visit → verify → owned in shop", async ({
      page,
      context,
   }) => {
      const iap = createIapStubState();
      await installAdStubs(context);
      await installIapStubs(context, iap);

      await bootApp(page);

      // The web provider has no launch reconcile (that's native-store only;
      // see useIap.ts) — the first sidecar IAP traffic is the purchase itself.
      expect(iap.checkoutCalls).toEqual([]);

      // Open the unified shop (🛍️) — the single place cosmetics are bought.
      await page.locator('[aria-label="Shop"]').click();
      // exact: the description line also mentions the pickaxe by name.
      // "app: item" naming (the same title the Stripe catalog shows).
      await expect(
         page.getByText("Mines of Doom: Gold Pickaxe", { exact: true }),
      ).toBeVisible();

      // packGold is the first catalog row (pickaxe group first); its cash
      // button is the first "$0.99" price label in the panel.
      const cash = page.getByRole("button", { name: /^\$0\.99$/ }).first();
      await expect(cash).toBeEnabled();
      await cash.click();

      // The provider POSTs /stripe/checkout, loads the (stubbed)
      // js.stripe.com, and redirectToCheckout sends the browser to the
      // success return URL — a real navigation (fresh document).
      await page.waitForURL(/iap=success&iap_product=packGold&iap_sid=cs_e2e_/);

      // The return-visit effect: noteCheckoutSuccess enqueues, then
      // restore() replays the queue (verify POST, mint) and fetches the
      // entitlement list. Poll the recorded call bodies.
      await expect
         .poll(() => iap.verifyCalls.length, { timeout: 20_000 })
         .toBe(1);
      await expect
         .poll(() => iap.restoreCalls.length)
         .toBeGreaterThanOrEqual(1);

      // The verify body is the app's contract with the sidecar: platform
      // "web", the catalog product id, and the checkout session token.
      expect(iap.verifyCalls[0]).toMatchObject({
         platform: "web",
         productId: "packGold",
         token: iap.lastSession?.sessionId,
      });
      expect(iap.lastSession?.productId).toBe("packGold");

      // The one-shot flags must be stripped from the URL (no re-verify on
      // refresh — the return visit ran exactly once).
      await expect(page).not.toHaveURL(/iap=success/);
      await expect
         .poll(() => iap.verifyCalls.length, { timeout: 5_000 })
         .toBe(1);

      // Re-open the shop: the pack is owned now (✓ + Equip, no cash button).
      await page.getByTestId("mining-canvas").waitFor({ state: "visible" });
      await page.locator('[aria-label="Shop"]').click();
      await expect(page.getByText(/Gold Pickaxe\s*✓/)).toBeVisible();
      await expect(page.getByRole("button", { name: "Equip" })).toBeVisible();
   });

   test("a verify the sidecar can't confirm is refused and stays queued", async ({
      page,
      context,
   }) => {
      const iap = createIapStubState();
      await installAdStubs(context);
      await installIapStubs(context, iap);

      // Seed the pending-verify queue (the bare AsyncStorage web key,
      // PENDING_VERIFY_KEY in iapProvider.web.ts) with a FORGED entry —
      // a session id no sidecar ever issued — before the app loads.
      await page.addInitScript(() => {
        localStorage.setItem(
           "iapPendingVerifies",
           JSON.stringify([
            { productId: "packGold", token: "cs_forged_never_issued" },
           ]),
        );
      });

      await bootApp(page);

      // Boot has no launch reconcile on web (the first IAP traffic is the
      // player's own purchase) — the forged entry is untouched so far.
      expect(iap.verifyCalls).toEqual([]);
      expect(iap.rejectedVerifies).toEqual([]);

      // The player's real purchase: purchase() replays the queue FIRST,
      // so the forged verify fires and the strict stub refuses it
      // (400 — the real sidecar's unconfirmed-session contract).
      await page.locator('[aria-label="Shop"]').click();
      const cash = page.getByRole("button", { name: /^\$0\.99$/ }).first();
      await expect(cash).toBeEnabled();
      await cash.click();
      await page.waitForURL(/iap=success&iap_product=packGold&iap_sid=cs_e2e_/);

      // The return-visit verify (an ISSUED token) is accepted and mints;
      // the forged one was refused (and is refused again on replay).
      await expect
         .poll(() => iap.verifyCalls.length, { timeout: 20_000 })
         .toBeGreaterThanOrEqual(2);
      expect(iap.rejectedVerifies).toContainEqual({
         productId: "packGold",
         token: "cs_forged_never_issued",
      });

      await expect(page.getByTestId("mining-canvas")).toBeVisible();

      // A failed verify is NEVER dropped from the pending queue (pass 58
      // semantics), while the verified issued pair is. And the real
      // purchase still granted its pack.
      const queue = await page.evaluate(() =>
         JSON.parse(
          localStorage.getItem("iapPendingVerifies") ?? "[]",
         ) as unknown,
      );
      expect(queue).toEqual([
       { productId: "packGold", token: "cs_forged_never_issued" },
      ]);
      await page.locator('[aria-label="Shop"]').click();
      await expect(page.getByText(/Gold Pickaxe\s*✓/)).toBeVisible();
   });

   test("no live sidecar/Stripe traffic escapes the stubs", async ({
      page,
      context,
   }) => {
      const iap = createIapStubState();
      await installAdStubs(context);
      await installIapStubs(context, iap);
      await bootApp(page);

      // Booting the web build must not touch the sidecar's IAP surface at
      // all (no launch reconcile on web) — the first IAP traffic is the
      // player's own purchase.
      expect(iap.aborted).toEqual([]);
      expect(iap.checkoutCalls).toEqual([]);
      expect(iap.verifyCalls).toEqual([]);
      expect(iap.restoreCalls).toEqual([]);
   });
});
