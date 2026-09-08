#!/usr/bin/env node
/**
 * GSI origin probe for the blocker in docs/blockers.md ("Web Google
 * sign-in (GSI) fails on the deployed web build").
 *
 * The blocker's open question is whether the Web-application OAuth
 * client's Authorized JavaScript origins include
 * `https://minesofdoom.pages.dev`. GSI's token-client flow
 * (`mintGoogleIdTokenWeb`) is origin-gated by Google BEFORE any token
 * is minted: an authorized origin gets a popup to accounts.google.com;
 * an unauthorized one gets an error callback and the app's single
 * inline "failed to sign in" — no popup at all.
 *
 * This probe drives that exact flow in a real headless browser against
 * the deployed static build and reports which of the two happened. It
 * does NOT sign in: the moment a popup appears (proving origin
 * authorization) it is closed and the browser exits. No account
 * credentials are ever entered.
 *
 * Usage:  node scripts/gsiOriginProbe.mjs
 * Exit 0 = origin authorized, exit 1 = not authorized (inline error,
 * no popup), exit 2 = inconclusive (UI not reached, timeout, ...).
 */
const WEB_BASE = "https://minesofdoom.pages.dev";

let playwright;
try {
  playwright = await import("playwright");
} catch {
  console.error(
    "FAIL: playwright is not installed (npm i --no-save playwright && npx playwright install chromium --only-shell)",
  );
  process.exit(2);
}

const results = [];
const browser = await playwright.chromium.launch();
const context = await browser.newContext({
  // Block nothing: the gsi/client script must load from
  // accounts.google.com for the probe to mean anything.
});

const verdict = { authorized: false, reason: "", popupUrl: "" };
let popupWaitError = null;

try {
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  // Popup = GSI's requestAccessToken window. Any accounts.google.com
  // popup means the origin passed Google's gate. Attach the catch
  // immediately — the browser closing must not surface as an unhandled
  // rejection before the awaited line below runs.
  const popupPromise = context
    .waitForEvent("page", { timeout: 25_000 })
    .catch((e) => {
      popupWaitError = e;
      return null;
    });

  console.log(`→ loading ${WEB_BASE}`);
  await page.goto(WEB_BASE, { waitUntil: "domcontentloaded", timeout: 60_000 });

  // First run: the onboarding overlay blocks the menu, but its render
  // races the localStorage flag load (it can appear after the first
  // paint), so loop: dismiss while visible, re-check until quiet.
  console.log("→ settling onboarding overlay");
  const overlayGone = (timeout) =>
    page
      .waitForFunction(
        () => !document.querySelector('[data-testid="onboarding-overlay"]'),
        { timeout },
      )
      .catch(() => false);
  for (let round = 0; round < 5; round++) {
    // Give the overlay a chance to mount before deciding it is absent.
    await page.waitForTimeout(1_000);
    const skip = page.locator('[data-testid="onboarding-skip"]');
    if ((await skip.count()) === 0) break;
    console.log(`→ clicking onboarding skip (round ${round + 1})`);
    await skip.click({ timeout: 5_000 }).catch(() => {});
    const gone = await overlayGone(10_000);
    if (gone) break;
  }
  if (await page.locator('[data-testid="onboarding-overlay"]').count()) {
    throw new Error("onboarding overlay would not go away");
  }

  console.log("→ opening menu → account tab");
  await page.locator('[data-testid="menu-button"]').click({ timeout: 20_000 });
  await page
    .locator('[data-testid="menu-tab-account"]')
    .click({ timeout: 20_000 });

  const googleBtn = page.locator('[data-testid="account-google"]');
  if ((await googleBtn.count()) === 0) {
    verdict.reason =
      "account-google button not found (provider list may be hidden — check availableProviderKinds on web)";
  } else {
    console.log(
      "→ clicking the Google sign-in button (watching for a GSI popup)",
    );
    const [popup] = await Promise.all([
      popupPromise,
      googleBtn.click({ timeout: 10_000 }),
    ]);
    if (popup) {
      await popup.waitForLoadState("commit").catch(() => {});
      const url = popup.url();
      verdict.authorized = /accounts\.google\.com/.test(url);
      verdict.popupUrl = url;
      verdict.reason = verdict.authorized
        ? "GSI popup opened against accounts.google.com — the origin is authorized"
        : `popup opened but not accounts.google.com: ${url}`;
      await popup.close().catch(() => {});
    } else {
      // No popup: wait a moment for the inline error the app shows on
      // the GSI error-callback path, then read it.
      await page.waitForTimeout(3_000);
      const section = page.locator('[data-testid="account-section"]');
      const text = (await section.innerText().catch(() => "")) || "";
      const errorLine = text.split("\n").find((l) => /failed|error/i.test(l));
      verdict.reason = errorLine
        ? `no popup; inline error in account section: ${errorLine.trim()}`
        : "no popup, no visible inline error";
    }
  }

  results.push({
    verdict,
    consoleErrors: consoleErrors.slice(0, 10),
    popupWaitError: popupWaitError ? String(popupWaitError) : null,
  });
} finally {
  await browser.close();
}

const v = results[0].verdict;
console.log("");
if (v.authorized) {
  console.log(
    "VERDICT: AUTHORIZED — https://minesofdoom.pages.dev is in the OAuth client's Authorized JavaScript origins.",
  );
  console.log(`  (popup: ${v.popupUrl})`);
  process.exit(0);
} else if (v.reason.startsWith("no popup")) {
  console.log(
    "VERDICT: NOT AUTHORIZED — GSI produced no popup; the origin is still missing from the OAuth client's Authorized JavaScript origins.",
  );
  console.log(`  ${v.reason}`);
  if (results[0].consoleErrors.length) {
    console.log("  console errors:");
    for (const e of results[0].consoleErrors)
      console.log(`    - ${e.slice(0, 300)}`);
  }
  process.exit(1);
} else {
  console.log(`VERDICT: INCONCLUSIVE — ${v.reason}`);
  if (results[0].consoleErrors.length) {
    console.log("  console errors:");
    for (const e of results[0].consoleErrors)
      console.log(`    - ${e.slice(0, 300)}`);
  }
  process.exit(2);
}
