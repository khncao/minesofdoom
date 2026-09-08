/**
 * Programmatic Stripe setup for the web IAP (docs/store-integration.md
 * §2.6) — the console steps done as API calls.
 *
 * Zero dependencies, Node >= 18 (global fetch). Two commands:
 *
 *   node scripts/stripe/syncStripe.mjs products
 *     Ensures the 26 catalog products + one-time USD prices exist in the
 *     account (idempotent: products are looked up by the
 *     metadata mdoomProductId marker, so re-runs never duplicate).
 *     Prints a paste-ready snippet for src/mines_of_doom/storeConfig.ts
 *     (stripe.prices).
 *
 *   node scripts/stripe/syncStripe.mjs webhook
 *     Ensures the webhook endpoint at the public /stripe/webhook URL
 *     exists (idempotent by URL) with ONLY checkout.session.completed
 *     enabled, and prints the STRIPE_WEBHOOK_SECRET line for the sidecar
 *     env (VPS, ~/docker/pocketbase — never in the repo).
 *
 * SECRET HANDLING (the sk_ key never touches the repo or the app bundle):
 *   1. env STRIPE_SECRET_KEY, else
 *   2. ./stripe-secret.env at the project root (KEY=VALUE lines,
 *      gitignored — copy stripe-secret.env.example), else
 *   3. a hidden interactive prompt (terminal echo muted).
 *   A sk_live_… key is refused without --live (sandbox is the default;
 *   flip to live keys only at launch, §2.6 step 6).
 *
 * The test vs. live environment is pinned by the key itself: sk_test_
 * only ever sees test objects, so nothing here needs a mode flag.
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import readline from "readline";

const API_BASE = "https://api.stripe.com/v1";
const WEBHOOK_URL = "https://minesofdoom.minus4kelvin.com/stripe/webhook";
const WEBHOOK_EVENTS = ["checkout.session.completed"];
const APP_DIR = path.dirname(fileURLToPath(import.meta.url));
const CATALOG = JSON.parse(
  fs.readFileSync(path.join(APP_DIR, "catalog.json"), "utf8"),
);

// -- secret loading -----------------------------------------------------------

function readEnvFile() {
  const p = path.resolve(APP_DIR, "..", "..", "stripe-secret.env");
  if (!fs.existsSync(p)) return null;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = /^\s*STRIPE_SECRET_KEY\s*=\s*(\S+)\s*$/.exec(line);
    if (m && m[1].length > 0 && m[1] !== "...") return m[1];
  }
  return null;
}

async function promptSecret() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  process.stderr.write("Stripe secret key (input hidden): ");
  if (rl.output) rl.output.mute = true;
  const value = await new Promise((resolve) => rl.question("", (a) => resolve(a)));
  rl.close();
  process.stderr.write("\n");
  return value.trim();
}

async function loadSecret() {
  const fromEnv = process.env.STRIPE_SECRET_KEY;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  const fromFile = readEnvFile();
  if (fromFile) return fromFile;
  return await promptSecret();
}

// -- stripe api (plain fetch; form-encoded bodies like the SDK does) ---------

async function stripe(apiKey, method, urlPath, params = {}) {
  const form = new URLSearchParams(
    Object.entries(params).reduce((acc, [k, v]) => {
      if (v === undefined || v === null) return acc;
      acc[k] = typeof v === "object" ? JSON.stringify(v) : String(v);
      return acc;
    }, {}),
  );
  // GET params go in the query string (a body on GET is dropped); everything
  // else is a form-encoded POST body (fetch serializes URLSearchParams).
  const url = API_BASE + urlPath + (form.toString() && !urlPath.includes("?") ? "?" + form.toString() : "");
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: "Bearer " + apiKey,
      ...(method !== "GET" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: method === "GET" ? undefined : form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data && data.error && data.error.message) || JSON.stringify(data);
    throw new Error(`stripe ${method} ${urlPath} → ${res.status}: ${msg}`);
  }
  return data;
}

// -- commands ------------------------------------------------------------------

/** Idempotent: metadata marker → find or create product + its one price. */
async function ensureProducts(apiKey) {
  // No server-side metadata filter on the products list (400 on the current
  // API version) — page through the account's products once and match the
  // mdoomProductId marker locally.
  const byId = new Map();
  let start, page = {
    data: [],
  };
  do {
    page = await stripe(apiKey, "GET", "/products", {
      limit: 100,
      ...(start ? { starting_after: start } : {}),
    });
    for (const p of page.data) {
      if (p.metadata && p.metadata.mdoomProductId) byId.set(p.metadata.mdoomProductId, p);
    }
    start = page.has_more ? page.data[page.data.length - 1].id : undefined;
  } while (start);

  const result = [];
  for (const e of CATALOG) {
    let product = byId.get(e.id);
    if (!product) {
      product = await stripe(apiKey, "POST", "/products", {
        name: e.name,
        description: e.blurb,
        active: "true",
        "metadata[mdoomProductId]": e.id,
        "metadata[mdoomStoreId]": e.storeId,
      });
      console.error(`created  ${e.id}  ${product.id}  ${product.name}`);
    }
    const prices = await stripe(apiKey, "GET", `/prices?product=${encodeURIComponent(product.id)}&currency=usd&limit=100`);
    let price = (prices.data || []).find((p) => p.active);
    if (!price) {
      // prices_data on product create is rejected by the API — the price is
      // its own object and gets its own call (also the recovery path if the
      // product exists but its price is missing or was deleted).
      price = await stripe(apiKey, "POST", "/prices", {
        product: product.id,
        currency: "usd",
        unit_amount: String(e.amountUsd),
        lookup_key: e.id,
      });
    }
    console.error(`found ${e.id.padEnd(16)} ${price.id}  $${(price.unit_amount / 100).toFixed(2)}`);
    result.push({ id: e.id, price: price.id });
  }
  return result;
}

/** Idempotent: list endpoints, match by URL, reuse or create. */
async function ensureWebhook(apiKey) {
  const list = await stripe(apiKey, "GET", "/webhook_endpoints?limit=100");
  const existing = (list.data || []).find((e) => e.url === WEBHOOK_URL);
  if (existing) {
    // The signing secret is only returned once, at creation — a re-run
    // can't re-read it (the API 400s `expand[0]=secret`), so point at
    // where it already lives.
    console.error(
      `found  webhook endpoint ${existing.id} — the whsec_ secret is ` +
        `already in the sidecar env (STRIPE_WEBHOOK_SECRET). To rotate it, ` +
        `delete the endpoint and re-run.`,
    );
    return existing;
  }
  const created = await stripe(apiKey, "POST", "/webhook_endpoints", {
    url: WEBHOOK_URL,
    "enabled_events[0]": WEBHOOK_EVENTS[0],
    // `name` is not an API parameter — context goes in metadata.
    "metadata[purpose]": "mines-of-doom web IAP checkout",
  });
  console.error(`created  webhook endpoint ${created.id}`);
  return created;
}

// -- main -----------------------------------------------------------------------

const [cmd, ...flags] = process.argv.slice(2);

async function main() {
  if (cmd !== "products" && cmd !== "webhook") {
    console.error(
      "usage: node scripts/stripe/syncStripe.mjs products | webhook\n" +
        "       (--live allowed for a sk_live_ key; sandbox is the default)",
    );
    return 2;
  }
  const apiKey = (await loadSecret()).trim();
  if (!/^sk_(test|live)_[A-Za-z0-9]+$/.test(apiKey)) {
    console.error("that does not look like a Stripe secret key (sk_test_/sk_live_)");
    return 1;
  }
  if (apiKey.startsWith("sk_live_") && !flags.includes("--live")) {
    console.error(
      "refusing a LIVE key without --live (sandbox is the default; " +
        "docs/store-integration.md §2.6 step 6 is when the flip happens)",
    );
    return 1;
  }
  if (cmd === "products") {
    const result = await ensureProducts(apiKey);
    console.log("\nPaste into src/mines_of_doom/storeConfig.ts (stripe.prices):");
    console.log("  prices: {");
    for (const r of result) console.log(`    ${r.id}: "${r.price}",`);
    console.log("  },");
    console.log(
      "\nAll-or-nothing gate: the web shop appears only when every id in\nIAP_PRODUCT_IDS has a price (isStripeConfigured).",
    );
  } else {
    const ep = await ensureWebhook(apiKey);
    if (!ep.secret) {
      console.log(
        "\nThe endpoint already existed — nothing to create. Its whsec_\n" +
          "secret is the STRIPE_WEBHOOK_SECRET line in the sidecar env\n" +
          "(VPS ~/docker/pocketbase/.env).",
      );
      return 0;
    }
    console.log("\nSidecar env lines (VPS ~/docker/pocketbase, then reload the sidecar):");
    console.log("  STRIPE_WEBHOOK_SECRET=" + ep.secret);
    console.log("  STRIPE_SECRET_KEY=<your sk_ key — already held by this script>");
    console.log(
      "\nVerify: sidecar /healthz → configured.web: true + stripeWebhook:\n" +
        "  { signature: true, pocketbase: true } (MDOOM_PB_URL must also be set).",
    );
  }
  return 0;
}

let code = 0;
try {
  code = await main();
} catch (err) {
  console.error("failed:", err && err.message ? err.message : err);
  code = 1;
}
process.exitCode = code;
