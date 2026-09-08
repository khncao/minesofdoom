#!/usr/bin/env node
/**
 * Step 6 of docs/store-integration.md §2.6 — one test-card purchase
 * through hosted Checkout (4242…, test mode only), verifying BOTH grant
 * legs for the same (device, product) row:
 *
 *   1. webhook leg   — a paid session makes Stripe deliver
 *      `checkout.session.completed` to the public webhook endpoint;
 *      the sidecar verifies the signature, confirms via the Stripe API and
 *      mints the entitlement row.
 *   2. redirect leg  — the exact client fetch shape of
 *      `iapProvider.web.ts` postVerify (POST /api/app/verify, platform
 *      "web", token = checkout session id) — the server re-confirms the
 *      session and upserts the SAME row idempotently.
 *
 * The session is created through the SAME route the web client now calls
 * (the sidecar's POST /stripe/checkout — the current stripe.js
 * redirectToCheckout rejects client-side metadata/lineItems, so the
 * server owns session creation). `--direct` falls back to creating the
 * session straight against the Stripe API (still needs the sk_ key).
 *
 * The PAY leg runs in a real browser (Playwright): a hosted mode=payment
 * session creates its PaymentIntent lazily — only when a payment is
 * attempted on the hosted page — so the 4242 card has to be typed where
 * the player types it. The browser is the system Chrome install (or
 * Playwright's own Chromium); the script drives the same hosted page the
 * player sees after redirectToCheckout and records the return-to-app
 * navigation (?iap=success).
 *
 * Test mode only: a sk_live_ key is refused (test cards don't pay live
 * prices). The sk_ key comes from env STRIPE_SECRET_KEY or the repo-root
 * stripe-secret.env (same rule as syncStripe.mjs); it is never printed.
 *
 * Usage:  node scripts/stripe/checkoutTest.mjs [--direct] [--session cs_…]
 * The script uses a fresh device id on every run, so it is safe to
 * re-run; `--session` re-drives an existing UNPAID session (its
 * mdoomDeviceId metadata is reused, so the grant rows stay consistent);
 * it prints the session id + entitlement evidence for the todo write-up.
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const API_BASE = "https://api.stripe.com/v1";
const PB_BASE = "https://minesofdoom.minus4kelvin.com";
const APP_DIR = path.dirname(fileURLToPath(import.meta.url));
const PRODUCT_ID = "packGold"; // storeId "pack_gold"

// Price id parsed from the source of truth (storeConfig.ts) so this can't
// drift from what the web client actually pays with.
const storeConfigSrc = fs.readFileSync(
  path.resolve(APP_DIR, "..", "..", "src", "mines_of_doom", "storeConfig.ts"),
  "utf8",
);
const priceMatch = /packGold:\s*"(price_[A-Za-z0-9]+)"/.exec(storeConfigSrc);
const PRICE_ID = priceMatch?.[1];

function fail(msg) {
  console.error("FAIL: " + msg);
  process.exit(1);
}

function readKeyFile() {
  const p = path.resolve(APP_DIR, "..", "..", "stripe-secret.env");
  if (!fs.existsSync(p)) return null;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = /^\s*STRIPE_SECRET_KEY\s*=\s*(\S+)\s*$/.exec(line);
    if (m && m[1].length > 0 && m[1] !== "...") return m[1];
  }
  return null;
}

if (!PRICE_ID) fail("could not parse the packGold price id from storeConfig.ts");

const apiKey = process.env.STRIPE_SECRET_KEY || readKeyFile();
if (!apiKey) fail("no sk_ key (set STRIPE_SECRET_KEY or repo-root stripe-secret.env)");
if (!apiKey.startsWith("sk_test_")) fail("test mode only — sk_live keys are refused");

async function stripe(method, urlPath, params = {}) {
  const form = new URLSearchParams(
    Object.entries(params).reduce((acc, [k, v]) => {
      if (v === undefined || v === null) return acc;
      acc[k] = typeof v === "object" ? JSON.stringify(v) : String(v);
      return acc;
    }, {}),
  );
  const res = await fetch(API_BASE + urlPath, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: method === "GET" ? undefined : form.toString(),
  });
  const body = await res.json();
  if (!res.ok) {
    const err = body?.error?.message || JSON.stringify(body);
    throw new Error(`stripe ${urlPath}: ${res.status} ${err}`);
  }
  return body;
}

/** The exact client-side fetch shape (storeIapProvider.postJson). */
async function pbPost(route, body) {
  const res = await fetch(`${PB_BASE}/api/app/${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON */
  }
  return { status: res.status, json };
}

const sessionFlagIdx = process.argv.indexOf("--session");
const reuseSessionId =
  sessionFlagIdx > -1 ? process.argv[sessionFlagIdx + 1] : null;
let deviceId = `mdoom-step6-${Date.now().toString(36)}`;
console.log("product :", PRODUCT_ID, "(store id pack_gold)");

// -- 1. Create the hosted Checkout session (same route as the client) ---
const viaDirect = process.argv.includes("--direct");
let sessionId;
if (reuseSessionId) {
  // Reuse an unpaid session from an earlier run (forensics / re-drive).
  sessionId = reuseSessionId;
  const s = await stripe("GET", `/checkout/sessions/${sessionId}`);
  deviceId = s.metadata?.mdoomDeviceId || deviceId;
  console.log("session :", sessionId, "status", s.status, "(reused, --session)");
} else if (viaDirect) {
  // Fallback: create the session straight against the Stripe API.
  const session = await stripe("POST", "/checkout/sessions", {
    mode: "payment",
    "line_items[0][price]": PRICE_ID,
    "line_items[0][quantity]": "1",
    success_url: `${PB_BASE}/?iap=success&iap_product=${PRODUCT_ID}&iap_sid={CHECKOUT_SESSION_ID}`,
    cancel_url: `${PB_BASE}/?iap=cancel`,
    "metadata[mdoomDeviceId]": deviceId,
    "metadata[mdoomProductId]": PRODUCT_ID,
  });
  sessionId = session.id;
  console.log("session :", sessionId, "status", session.status, "(direct API)");
} else {
  // The real client path: POST the sidecar's /stripe/checkout (it picks
  // the Price from its own map and attaches the mint-gating metadata).
  const res = await fetch(`${PB_BASE}/stripe/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceId, productId: PRODUCT_ID }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.sessionId) {
    fail(`sidecar /stripe/checkout refused (HTTP ${res.status}): ${JSON.stringify(body)} — is the sidecar deployed with MDOOM_STRIPE_PRICE_MAP + MDOOM_WEB_BASE_URL?`);
  }
  sessionId = body.sessionId;
  console.log("session :", sessionId, "(via sidecar /stripe/checkout)");
}

// -- 2. Pay it in a real browser with the 4242 test card ------------------
// A hosted mode=payment session has NO PaymentIntent until a payment is
// attempted on the hosted page (Stripe creates it lazily), so the API alone
// can't pay it — the card goes through the page the player would see.
const session = await stripe("GET", `/checkout/sessions/${sessionId}`);
if (!session.url) fail("session has no hosted url (unexpected for mode=payment)");
let playwright;
try {
  playwright = await import("playwright");
} catch {
  fail("the pay leg needs Playwright (npm i --no-save playwright) — it drives the hosted Checkout page with the test card");
}
const SYSTEM_CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const browser = await playwright.chromium.launch({
  headless: true,
  ...(fs.existsSync(SYSTEM_CHROME) ? { executablePath: SYSTEM_CHROME } : {}),
});
let landed = "";
let page = null;
try {
  page = await browser.newPage();
  await page.goto(session.url, { waitUntil: "domcontentloaded" });
  // The hosted checkout is a stepped form: the card fields can sit behind
  // an email/continue step. Handle both shapes.
  const email = page.locator('input[type="email"]').first();
  if (await email.isVisible().catch(() => false)) {
    await email.fill("mines.step6@example.com");
  }
  // The 2026 hosted checkout hides the card inputs inside a collapsed
  // "card" accordion — open it (its radio, then a visible-label fallback).
  const cardInput = page.locator('input[autocomplete="cc-number"]').first();
  if (!(await cardInput.isVisible().catch(() => false))) {
    const radio = page.locator('#payment-method-accordion-item-title-card');
    if (await radio.isVisible().catch(() => false)) {
      await radio.click().catch(() => {});
    }
    if (!(await cardInput.isVisible().catch(() => false))) {
      await page.locator('text=Card').first().click().catch(() => {});
    }
  }
  await cardInput.waitFor({ state: "visible", timeout: 30000 });
  const card = cardInput;
  await card.fill("4242424242424242");
  await page.locator('input[autocomplete="cc-exp"]').first().fill("1230");
  await page.locator('input[autocomplete="cc-csc"]').first().fill("123");
  const name = page.locator('input[autocomplete="cc-name"]').first();
  if (await name.isVisible().catch(() => false)) await name.fill("Mines Test");
  await page.locator('button[type="submit"]').last().click();
  // Stripe redirects to the success_url on a full-page navigation; the
  // {CHECKOUT_SESSION_ID} placeholder in the URL proves it carried our
  // session through.
  await page.waitForURL(/iap=success/, { timeout: 60000 });
  landed = page.url();
} catch (err) {
  // Forensics before failing: what was the hosted page actually showing?
  if (page) {
    try {
      await page.screenshot({ path: ".checkout-fail.png" });
      fs.writeFileSync(".checkout-fail.html", await page.content());
      const inputs = await page.evaluate(() =>
        [...document.querySelectorAll("input")].map((i) => ({
          id: i.id, ac: i.autocomplete || undefined,
          type: i.type, visible: !!(i.offsetWidth || i.offsetHeight),
        })),
      );
      const buttons = await page.evaluate(() =>
        [...document.querySelectorAll("button")]
          .map((b) => b.innerText.trim().replace(/\s+/g, " ").slice(0, 40))
          .filter(Boolean),
      );
      console.error("diagnostic: screenshot .checkout-fail.png; url:", page.url());
      console.error("inputs :", JSON.stringify(inputs));
      console.error("buttons:", JSON.stringify(buttons));
    } catch { /* page already gone */ }
  }
  throw err;
} finally {
  await browser.close();
}
console.log("pay     : test card paid the hosted page; return navigation →", landed);
console.log("pay     : test card paid the hosted page; return navigation →", landed);
if (!landed.includes(`iap_sid=${sessionId}`)) {
  fail("the return navigation did not carry our checkout session id back");
}
const after = await stripe("GET", `/checkout/sessions/${sessionId}`);
console.log(
  "session :", after.status,
  `(PI ${after.payment_intent ?? "none"}, ${after.amount_total} total)`,
);
if (after.status !== "complete") fail(`session did not reach 'complete' (saw '${after.status}')`);

// -- 3. Webhook leg: the sidecar mints on checkout.session.completed -----
let webhooksOk = null;
for (let i = 0; i < 12; i++) {
  const r = await pbPost("restore", { deviceId });
  const list = Array.isArray(r.json?.entitlements) ? r.json.entitlements : [];
  if (list.includes("pack_gold")) {
    webhooksOk = i * 3 + 1;
    break;
  }
  await new Promise((res) => setTimeout(res, 3000));
}
console.log(
  "webhook leg (restore after pay):",
  webhooksOk
    ? `GRANTED after ~${webhooksOk}s`
    : "NOT GRANTED within 36s — webhook leg FAILED",
);

// -- 4. Redirect leg: the exact client verify fetch, then re-restore -----
const verify = await pbPost("verify", {
  deviceId,
  platform: "web",
  productId: PRODUCT_ID,
  token: sessionId,
});
console.log(
  "redirect leg (verify, client shape): HTTP",
  verify.status,
  JSON.stringify(verify.json ?? null),
);
const finalR = await pbPost("restore", { deviceId });
const finalList = Array.isArray(finalR.json?.entitlements)
  ? finalR.json.entitlements
  : [];
console.log(
  "restore after verify:",
  JSON.stringify(finalR.json?.entitlements ?? finalR.json),
);

// -- 5. Idempotency: same (device, product) row, exactly once ------------
const count = finalList.filter((e) => e === "pack_gold").length;
console.log(`pack_gold rows visible to restore: ${count}`);

if (!webhooksOk) fail("webhook leg failed");
if (verify.status >= 300) fail("verify endpoint refused the client fetch");
if (count !== 1) fail(`expected exactly 1 entitlement row, saw ${count}`);

console.log("\nSTEP 6 PASSED — both legs granted the same row, idempotently.");
console.log(`  session:  ${sessionId}`);
console.log(`  device :  ${deviceId}`);
console.log("  (probe device; the row is harmless test-mode residue on the\n" +
  "   test account's device-scoped collection and can be left in place, or\n" +
  "   the row deleted in the PB admin UI if desired)");
