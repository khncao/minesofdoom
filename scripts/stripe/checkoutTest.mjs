#!/usr/bin/env node
/**
 * Step 6 of docs/store-integration.md §2.6 — a purchase through hosted
 * Checkout (test mode only) verifying BOTH grant legs for the same
 * (device, product) row:
 *
 *   1. webhook leg   — a completed session makes Stripe deliver
 *      `checkout.session.completed` to the public webhook endpoint;
 *      the sidecar verifies the signature, confirms via the Stripe API and
 *      mints the entitlement row.
 *   2. redirect leg  — the exact client fetch shape of
 *      `iapProvider.web.ts` postVerify (POST /api/app/verify, platform
 *      "web", token = checkout session id) — the server re-confirms the
 *      session and upserts the SAME row idempotently.
 *
 * PAY LEG POLICY: this script NEVER sends a card number. Card fields, if
 * present, are deliberately left BLANK. The default mode is therefore a
 * no-cost order — Stripe's documented sandbox flow
 * (docs.stripe.com/payments/checkout/no-cost-orders): a line item with
 * `unit_amount=0`, where Checkout collects no payment method at all and
 * the hosted page completes with one click. The `checkout.session.completed`
 * event is the documented fulfillment signal for no-cost orders (there is
 * no PaymentIntent). Note: an open, unresolved Stripe bug report
 * (stripe/stripe-cli#1375) claims the event can be missing for the
 * 100%-COUPON variant — this script uses the zero-amount line-item variant
 * the docs prescribe; if the webhook leg still times out, that report is
 * the suspect.
 *
 * Modes (session creation):
 *   (default)        no-cost order, created straight against the Stripe
 *                    API with mint-gating metadata (mdoomDeviceId +
 *                    mdoomProductId) — completes with a blank card.
 *   --via-sidecar    the real client path: POST the sidecar's
 *                    /stripe/checkout (it picks the PAID Price from its own
 *                    map) — verifies session creation through the exact
 *                    route the web client calls; the pay leg still sends a
 *                    blank card, so a paid session will NOT complete.
 *   --direct         paid session straight against the Stripe API using the
 *                    storeConfig packGold price (same blank-card caveat).
 *   --session cs_…   re-drive an existing session (any mode above); its
 *                    mdoomDeviceId metadata is reused so grant rows stay
 *                    consistent.
 *
 * The pay leg runs in a real browser (Playwright): the browser is the
 * system Chrome install (or Playwright's own Chromium); the script drives
 * the same hosted page the player sees and records the return-to-app
 * navigation (?iap=success&iap_sid=…).
 *
 * Test mode only: a sk_live_ key is refused. The sk_ key comes from env
 * STRIPE_SECRET_KEY or the repo-root stripe-secret.env (same rule as
 * syncStripe.mjs); it is never printed.
 *
 * Usage:  node scripts/stripe/checkoutTest.mjs [--via-sidecar | --direct]
 *                                        [--session cs_…]
 * The script uses a fresh device id on every run, so it is safe to
 * re-run; it prints the session id + entitlement evidence for the todo
 * write-up.
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const API_BASE = "https://api.stripe.com/v1";
const PB_BASE = "https://minesofdoom.minus4kelvin.com";
const APP_DIR = path.dirname(fileURLToPath(import.meta.url));
const PRODUCT_ID = "packGold"; // storeId "pack_gold"

// Price id parsed from the source of truth (storeConfig.ts) so the PAID
// --direct mode can't drift from what the web client actually pays with.
const storeConfigSrc = fs.readFileSync(
  path.resolve(APP_DIR, "..", "..", "src", "mines_of_doom", "storeConfig.ts"),
  "utf8",
);
const PRICE_ID = /packGold:\s*"(price_[A-Za-z0-9]+)"/.exec(storeConfigSrc)?.[1];

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

const apiKey = process.env.STRIPE_SECRET_KEY || readKeyFile();
if (!apiKey)
  fail("no sk_ key (set STRIPE_SECRET_KEY or repo-root stripe-secret.env)");
if (!apiKey.startsWith("sk_test_"))
  fail("test mode only — sk_live keys are refused");

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
const viaSidecar = process.argv.includes("--via-sidecar");
const viaDirect = process.argv.includes("--direct");
const noCost = !viaSidecar && !viaDirect;
let deviceId = `mdoom-step6-${Date.now().toString(36)}`;
console.log("product :", PRODUCT_ID, "(store id pack_gold)");

// -- 1. Create the hosted Checkout session -------------------------------
let sessionId;
let successUrl = `${PB_BASE}/?iap=success&iap_product=${PRODUCT_ID}&iap_sid={CHECKOUT_SESSION_ID}`;
if (reuseSessionId) {
  // Reuse an existing session from an earlier run (forensics / re-drive).
  sessionId = reuseSessionId;
  const s = await stripe("GET", `/checkout/sessions/${sessionId}`);
  deviceId = s.metadata?.mdoomDeviceId || deviceId;
  console.log(
    "session :",
    sessionId,
    "status",
    s.status,
    "(reused, --session)",
  );
} else if (viaSidecar) {
  // The real client path: POST the sidecar's /stripe/checkout (it picks
  // the PAID Price from its own map and attaches the mint-gating metadata).
  const res = await fetch(`${PB_BASE}/stripe/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceId, productId: PRODUCT_ID }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.sessionId) {
    fail(
      `sidecar /stripe/checkout refused (HTTP ${res.status}): ${JSON.stringify(body)} — is the sidecar deployed with MDOOM_STRIPE_PRICE_MAP + MDOOM_WEB_BASE_URL?`,
    );
  }
  sessionId = body.sessionId;
  console.log(
    "session :",
    sessionId,
    "(via sidecar /stripe/checkout, PAID price)",
  );
} else if (viaDirect) {
  // Paid session straight against the Stripe API (storeConfig price).
  if (!PRICE_ID)
    fail(
      "could not parse the packGold price id from storeConfig.ts (--direct needs it)",
    );
  const session = await stripe("POST", "/checkout/sessions", {
    mode: "payment",
    "line_items[0][price]": PRICE_ID,
    "line_items[0][quantity]": "1",
    success_url: successUrl,
    cancel_url: `${PB_BASE}/?iap=cancel`,
    "metadata[mdoomDeviceId]": deviceId,
    "metadata[mdoomProductId]": PRODUCT_ID,
  });
  sessionId = session.id;
  console.log(
    "session :",
    sessionId,
    "status",
    session.status,
    "(direct API, PAID price)",
  );
} else {
  // Default: the documented no-cost order — unit_amount 0, no payment
  // method collected, no card number involved (blank-card policy).
  const session = await stripe("POST", "/checkout/sessions", {
    mode: "payment",
    "line_items[0][price_data][unit_amount]": "0",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][product_data][name]":
      "Mines of Doom — step 6 no-cost probe",
    "line_items[0][quantity]": "1",
    success_url: successUrl,
    cancel_url: `${PB_BASE}/?iap=cancel`,
    "metadata[mdoomDeviceId]": deviceId,
    "metadata[mdoomProductId]": PRODUCT_ID,
  });
  sessionId = session.id;
  console.log(
    "session :",
    sessionId,
    "status",
    session.status,
    "(direct API, no-cost order)",
  );
}

// -- 2. Complete it in a real browser — card fields left BLANK ------------
// No card number is ever sent (test policy). A no-cost session collects no
// payment method at all, so the hosted page completes with one click; a
// paid session (--direct/--via-sidecar/--session on a paid one) will NOT
// complete with a blank card.
const session = await stripe("GET", `/checkout/sessions/${sessionId}`);
if (!session.url)
  fail("session has no hosted url (unexpected for mode=payment)");
let playwright;
try {
  playwright = await import("playwright");
} catch {
  fail(
    "the pay leg needs Playwright (npm i --no-save playwright && npx playwright install chromium --only-shell) — it drives the hosted Checkout page with a BLANK card",
  );
}
const SYSTEM_CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const browser = await playwright.chromium.launch({
  headless: true,
  ...(fs.existsSync(SYSTEM_CHROME) ? { executablePath: SYSTEM_CHROME } : {}),
});
let landed = "";
let cardWasBlank = false;
let page = null;
try {
  page = await browser.newPage();
  await page.goto(session.url, { waitUntil: "domcontentloaded" });
  // The hosted page runs an invisible hCaptcha before the submit is
  // accepted: click too early and it spins through "Processing" forever
  // without navigating. Give the page a moment to stabilize first.
  await page.waitForTimeout(3000);
  // The hosted checkout is a stepped form: the payment fields can sit
  // behind an email step. Handle both shapes.
  // The hosted page renders the email field as type="text" (autocomplete
  // "email") — match all three shapes or it silently goes unfilled.
  const email = page
    .locator(
      'input[type="email"], input[autocomplete="email"], input[id="email"]',
    )
    .first();
  if (await email.isVisible().catch(() => false)) {
    await email.fill("mines.step6@example.com");
  }
  const cardInput = page.locator('input[autocomplete="cc-number"]').first();
  if (await cardInput.isVisible().catch(() => false)) {
    // A PAID session: the 2026 hosted checkout renders the card fields
    // LAZILY behind the "card" accordion item — open it (the radio itself
    // has tabindex -1; the React handler lives on the item container),
    // then deliberately leave the number BLANK per policy.
    const accordion = page
      .locator('[data-testid="card-accordion-item"]')
      .first();
    if (await accordion.isVisible().catch(() => false)) {
      await accordion.click().catch(() => {});
    }
    if (!(await cardInput.isVisible().catch(() => false))) {
      await page
        .locator("#payment-method-accordion-item-title-card")
        .click({ force: true })
        .catch(() => {});
    }
    await cardInput
      .waitFor({ state: "visible", timeout: 15000 })
      .catch(() => {});
    if (await cardInput.isVisible().catch(() => false)) {
      cardWasBlank = true;
      console.log("card    : PAID session — card fields left BLANK per policy");
    }
  } else {
    console.log(
      "card    : no payment-method field shown (no-cost order — as documented)",
    );
  }
  await page.locator('button[type="submit"]').last().click();
  // Stripe redirects to the success_url on a full-page navigation; the
  // {CHECKOUT_SESSION_ID} placeholder in the URL proves it carried our
  // session through. Poll the URL: waitForURL(waitUntil: load) can outwait
  // the navigation itself on a heavy success page, and the poll gives the
  // first (pre-captcha) "Processing" spin time to settle.
  for (let i = 0; i < 24; i++) {
    if (page.url().includes("iap=success")) break;
    await page.waitForTimeout(5000);
  }
  if (!page.url().includes("iap=success"))
    throw new Error(
      "no return navigation within 120s (last url: " + page.url() + ")",
    );
  landed = page.url();
} catch (err) {
  // Forensics before failing: what was the hosted page actually showing?
  if (page) {
    try {
      await page.screenshot({ path: ".checkout-fail.png" });
      fs.writeFileSync(".checkout-fail.html", await page.content());
      const inputs = await page.evaluate(() =>
        [...document.querySelectorAll("input")].map((i) => ({
          id: i.id,
          ac: i.autocomplete || undefined,
          type: i.type,
          visible: !!(i.offsetWidth || i.offsetHeight),
        })),
      );
      const buttons = await page.evaluate(() =>
        [...document.querySelectorAll("button")]
          .map((b) => b.innerText.trim().replace(/\s+/g, " ").slice(0, 40))
          .filter(Boolean),
      );
      console.error(
        "diagnostic: screenshot .checkout-fail.png; url:",
        page.url(),
      );
      console.error("inputs :", JSON.stringify(inputs));
      console.error("buttons:", JSON.stringify(buttons));
    } catch {
      /* page already gone */
    }
  }
  if (cardWasBlank) {
    console.error(
      "note    : a PAID session cannot complete with a blank card (policy) — use the default no-cost mode for the automated pass",
    );
  }
  throw err;
} finally {
  await browser.close();
}
console.log(
  "pay     : hosted page completed with a blank card; return navigation →",
  landed,
);
if (!landed.includes(`iap_sid=${sessionId}`)) {
  fail("the return navigation did not carry our checkout session id back");
}
const after = await stripe("GET", `/checkout/sessions/${sessionId}`);
console.log(
  "session :",
  after.status,
  `(PI ${after.payment_intent ?? "none"}, ${after.amount_total} total, payment_status ${after.payment_status})`,
);
if (after.status !== "complete")
  fail(`session did not reach 'complete' (saw '${after.status}')`);

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
    : noCost
      ? "NOT GRANTED within 36s — webhook leg FAILED (no-cost variant; if confirmed, suspect stripe/stripe-cli#1375)"
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
console.log(
  "  (no-cost probe; the row is harmless test-mode residue on the\n" +
    "   test account's device-scoped collection and can be left in place, or\n" +
    "   the row deleted in the PB admin UI if desired)",
);
