/**
 * Drift guard for scripts/stripe/catalog.json — the product table the
 * syncStripe.mjs ops script creates in the Stripe dashboard from. It was
 * generated from IAP_PRODUCT_LIST (src/mines_of_doom/iaps.ts), which is
 * derived from PACK_SPECS + cosmetics.ts; if the catalog changes (new
 * pack, new gem price → new tier), regenerate the table (the same snippet
 * that created it: map IAP_PRODUCT_LIST to { id, storeId, name:
 * { id, storeId, name: label, blurb, amountUsd: tierToCents(priceLabel) }
 * and write it to catalog.json) or this test fails.
 */
import * as fs from "fs";
import * as path from "path";
import {
 IAP_PRODUCT_IDS,
 IAP_PRODUCTS,
 IAP_STORE_IDS,
} from "src/mines_of_doom/iaps";

interface CatalogEntry {
 id: string;
 storeId: string;
 name: string;
 blurb: string;
 /**
  * Optional per-store copy for Play, captured from the live listing. The two
  * stores want different copy (Play's says "also earnable in-game for N gems
  * — the game stays fully free without it", which is the F2P-transparency
  * wording a store review wants), so it lives here rather than being
  * re-derived. `play.mjs sync-products` prefers it and falls back to the
  * derived blurb.
  */
 playBlurb?: string;
 amountUsd: number;
}

const CATALOG_PATH = path.join(__dirname, "..", "catalog.json");

function tierToCents(priceLabel: string): number {
 const m = /^\$(\d+)\.(\d\d)$/.exec(priceLabel);
 if (!m) throw new Error("bad tier " + priceLabel);
 return Number(m[1]) * 100 + Number(m[2]);
}

test("catalog.json covers exactly the IAP catalog", () => {
 const raw = fs.readFileSync(CATALOG_PATH, "utf8");
 const catalog: CatalogEntry[] = JSON.parse(raw);
 const ids = catalog.map((e) => e.id).sort();
 expect(ids).toEqual([...IAP_PRODUCT_IDS].sort());
});

test("every playBlurb is a real listing string, not a placeholder", () => {
 // Captured live, so it is data worth keeping honest: non-empty, no Stripe
 // framing leaking into it (the "Mines of Doom: " prefix and the
 // "One-time purchase." / "Purely cosmetic." wrapper are Stripe-only), and
 // it must name the item the row sells.
 const catalog: CatalogEntry[] = JSON.parse(
  fs.readFileSync(CATALOG_PATH, "utf8"),
 );
 const withCopy = catalog.filter((e) => e.playBlurb != null);
 expect(withCopy.length).toBeGreaterThan(0);
 for (const e of withCopy) {
  expect(e.playBlurb!.length).toBeGreaterThan(20);
  expect(e.playBlurb).not.toContain("Mines of Doom:");
  expect(e.playBlurb).not.toContain("One-time purchase.");
  expect(e.playBlurb).not.toContain("Purely cosmetic.");
  expect(e.playBlurb!.toLowerCase()).toContain(
   e.name.replace(/^Mines of Doom: /, "").split(" ")[0].toLowerCase(),
  );
 }
});

test("catalog.json matches names, store ids and price tiers", () => {
 const catalog: CatalogEntry[] = JSON.parse(
  fs.readFileSync(CATALOG_PATH, "utf8"),
 );
 for (const e of catalog) {
  const p = IAP_PRODUCTS[e.id as keyof typeof IAP_PRODUCTS];
  expect(p).toBeDefined();
  // p.label is the FULL store title ("Mines of Doom: <item>", the
  // "app: item" naming built in iaps.ts) — catalog.json carries it verbatim.
  expect(e.name).toBe(p.label);
  expect(e.storeId).toBe(IAP_STORE_IDS[e.id as keyof typeof IAP_STORE_IDS]);
  expect(e.amountUsd).toBe(tierToCents(p.priceLabel));
  expect(e.blurb).toBe(p.blurb);
 }
});
