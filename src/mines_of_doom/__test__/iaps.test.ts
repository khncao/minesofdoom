import {
  IAP_PACK_GRANTS,
  IAP_PRODUCTS,
  IAP_PRODUCT_LIST,
  IAP_IOS_STORE_IDS,
  IAP_STORE_IDS,
  IapPackGrant,
  IapProductId,
  IOS_BUNDLE_ID,
  devSimIapProvider,
  emptyIapEntitlements,
  getIapPackCosmetic,
  getIapProductPreview,
  grantIapEntitlement,
  hasIapEntitlement,
  iapGrantCosmeticIds,
  isIapProductEquipped,
  isIapProductOwned,
  mergeIapEntitlements,
  noopIapProvider,
  pickIapProvider,
  selectIapProvider,
} from "../iaps";
import { storeIapProvider } from "../iapProvider";
import { isPocketbaseConfigured } from "../storeConfig";
import {
  CAVE_THEMES,
  CASH_PRICE_USD,
  COSMETIC_PREVIEW_SEED,
  DEFAULT_OUTFIT,
  OUTFITS,
  PICKAXES,
  SKINS,
  cashPriceLabel,
  getCaveTheme,
  getOutfit,
  getPickaxe,
  getSkin,
  rollMinerLook,
} from "../cosmetics";
// The art-pack seam, not pixelArt directly: the previews must match the
// sprites the game actually draws, whichever pack is active.
import {
  minerSpriteUri,
  pickaxeSpriteUri,
  skinSpriteUri,
} from "src/utils/graphics/artPack";

const ALL_PRODUCT_IDS = Object.keys(IAP_PRODUCTS) as IapProductId[];

describe("store product ids (docs/store-integration.md table)", () => {
  it("every product has a Play-Billing-safe, unique store id", () => {
    const seen = new Set<string>();
    for (const p of IAP_PRODUCT_LIST) {
      // Play Billing SKUs: a-z, 0-9, _, no dots; App Store + RevenueCat
      // accept the same slug, so ONE id serves both stores.
      expect(p.storeId).toMatch(/^[a-z][a-z0-9_]{0,59}$/);
      expect(seen.has(p.storeId)).toBe(false);
      seen.add(p.storeId);
      // The store id and the internal id must NOT collide — they name
      // different things (store SKU vs entitlement key).
      expect(p.storeId).not.toBe(p.id);
    }
  });

  it("IAP_STORE_IDS is derived from the catalog and stays in sync", () => {
    for (const id of ALL_PRODUCT_IDS) {
      expect(IAP_STORE_IDS[id]).toBe(IAP_PRODUCTS[id].storeId);
    }
    expect(Object.keys(IAP_STORE_IDS)).toHaveLength(ALL_PRODUCT_IDS.length);
  });

  it("App Store product ids use the {ios.bundleId}.{productId} convention", () => {
    // The bundle id that will ship on iOS (same reverse-domain id as
    // android.package — docs/store-integration.md §1; the
    // app.config ios.bundleIdentifier is filled when iOS ships, §5).
    expect(IOS_BUNDLE_ID).toBe("com.minus4kelvin.minesofdoom");
    for (const id of ALL_PRODUCT_IDS) {
      expect(IAP_IOS_STORE_IDS[id]).toBe(`${IOS_BUNDLE_ID}.${id}`);
    }
    expect(Object.keys(IAP_IOS_STORE_IDS)).toHaveLength(ALL_PRODUCT_IDS.length);
  });
});

describe("IAP catalog (plan §5.2)", () => {
  it("every product has a plain label, a display price, and a blurb", () => {
    for (const p of IAP_PRODUCT_LIST) {
      expect(p.id).toBeDefined();
      // "app: item" naming (matches the Stripe catalog names).
      expect(p.label).toMatch(/^Mines of Doom: /);
      expect(p.label.length).toBeGreaterThan(0);
      // $0.99–$3.99 band per plan §5.2 cosmetic packs.
      const price = Number.parseFloat(p.priceLabel.replace("$", ""));
      expect(price).toBeGreaterThanOrEqual(0.99);
      expect(price).toBeLessThanOrEqual(3.99);
      expect(p.blurb.length).toBeGreaterThan(0);
    }
    // First row is the first pickaxe pack (cosmetics.ts order), ids unique.
    expect(IAP_PRODUCT_LIST[0].id).toBe("packGold");
    expect(new Set(IAP_PRODUCT_LIST.map((p) => p.id)).size).toBe(
      IAP_PRODUCT_LIST.length,
    );
  });
});

describe("cosmetic packs (plan §5.2)", () => {
  it("every pack grants a real catalog cosmetic", () => {
    const grantIds = Object.entries(IAP_PACK_GRANTS) as [
      IapProductId,
      IapPackGrant,
    ][];
    expect(grantIds.length).toBeGreaterThan(0);
    for (const [productId, grant] of grantIds) {
      expect(ALL_PRODUCT_IDS).toContain(productId);
      const info = getIapPackCosmetic(productId);
      expect(info).toBeDefined();
      if (grant.kind === "caveTheme") {
        expect(CAVE_THEMES.some((t) => t.id === grant.id)).toBe(true);
      } else if (grant.kind === "customSkin") {
        // The skin pass unlocks the device-local custom-skin slot
        // (useCustomSkin) — it grants no catalog item.
        expect(grant.id).toBe("customSkin");
      } else {
        expect(
          OUTFITS.some((o) => o.id === grant.id) ||
            PICKAXES.some((p) => p.id === grant.id) ||
            SKINS.some((k) => k.id === grant.id),
        ).toBe(true);
      }
    }
    // Distinct cosmetics — no two packs sell the same item.
    const allGrantIds = grantIds.map(([, g]) => g.id);
    expect(new Set(allGrantIds).size).toBe(allGrantIds.length);
  });

  it("every granted cosmetic is gem-earnable in-game (guardrail 1: convenience, not access)", () => {
    for (const productId of Object.keys(IAP_PACK_GRANTS) as IapProductId[]) {
      const info = getIapPackCosmetic(productId);
      expect(info).toBeDefined();
      // > 0: it sits in the gem shop (a free default would make the
      // pack grant nothing new).
      expect(info!.costGems).toBeGreaterThan(0);
    }
  });

  it("exactly one pack per PAID cosmetic, in cosmetics.ts order per line", () => {
    const paidPickaxes = PICKAXES.filter((p) => p.costGems > 0);
    const paidOutfits = OUTFITS.filter((o) => o.costGems > 0);
    const paidThemes = CAVE_THEMES.filter((t) => t.costGems > 0);
    const paidSkins = SKINS; // every skin is paid ("no skin" is the look)
    const packs = IAP_PRODUCT_LIST; // the catalog is packs only
    // Free defaults (steel / classic / natural) stay out of the catalog.
    // The +1 is the custom-skin FEATURE pack (todo: "Custom skinning") —
    // the catalog's one non-cosmetic line, which rides the same "skin" line
    // as the skin characters but grants no catalog item.
    expect(packs).toHaveLength(
      paidPickaxes.length +
        paidOutfits.length +
        paidThemes.length +
        paidSkins.length +
        1,
    );
    const byLine = (line: string) =>
      packs.filter((p) => p.line === line).map((p) => p.storeId);
    expect(byLine("pickaxe")).toEqual(paidPickaxes.map((p) => "pack_" + p.id));
    expect(byLine("outfit")).toEqual(paidOutfits.map((o) => "pack_" + o.id));
    expect(byLine("caveTheme")).toEqual(paidThemes.map((t) => "pack_" + t.id));
    // The skin line sells every character plus the one FEATURE pack, and the
    // store ids fold the hyphenated cosmetic ids to "_" (Play Billing's
    // alphabet is [a-z0-9_]).
    expect(byLine("skin")).toEqual([
      ...paidSkins.map((k) => "pack_" + k.id.replace(/-/g, "_")),
      "pack_skin",
    ]);
  });

  it("every pack price comes from the item's DEPTH tier, not its gem price", () => {
    // The cash price is chosen by how much new art an item carries
    // (cosmetics.CASH_PRICE_USD), so it must NOT track the gem price: a
    // rebalance of gem costs can never move a store price, and the two
    // ladders can disagree. Pinned by finding items whose gem price band and
    // cash tier disagree in both directions.
    // The ladder itself: four tiers, ascending, inside the $0.99–$3.99 band.
    expect(CASH_PRICE_USD).toEqual({ 1: 0.99, 2: 1.99, 3: 2.99, 4: 3.99 });
    for (const tier of [1, 2, 3, 4] as const) {
      expect(cashPriceLabel(tier)).toBe(`$${CASH_PRICE_USD[tier].toFixed(2)}`);
    }
    // Every catalog item carries a tier, and it is one of the four.
    const allCosmetics = [...PICKAXES, ...OUTFITS, ...CAVE_THEMES, ...SKINS];
    for (const item of allCosmetics) {
      if (item.costGems === 0) continue; // the free default has no pack
      expect([1, 2, 3, 4]).toContain(item.cashTier);
    }
    // Disagreement in both directions (so this cannot pass by accident):
    // Prism Cutter is the top cash tier on a 100-gem item; a Crystal Miner
    // outfit (40 💎) sits a tier below it.
    expect(getPickaxe("prism")!.cashTier).toBe(4);
    expect(getPickaxe("sledge")!.cashTier).toBe(3);
    expect(getOutfit("crystal").cashTier).toBe(2);
    expect(getSkin("ember-sunrise")!.cashTier).toBe(4);
    expect(getSkin("lantern-crew")!.cashTier).toBe(1);
    // …and the gem/cash bands really can differ: a 25-gem item is the top
    // tier and a 100-gem item is the bottom one somewhere in the catalog.
    const band = (g: number) => (g <= 30 ? 1 : g <= 60 ? 2 : g <= 100 ? 3 : 4);
    const disagreements = allCosmetics.filter(
      (c) => c.costGems > 0 && band(c.costGems) !== c.cashTier,
    );
    expect(disagreements.length).toBeGreaterThan(0);
  });

  it("pack blurbs and prices resolve from the gem shop (no drift)", () => {
    for (const p of IAP_PRODUCT_LIST) {
      const pack = getIapPackCosmetic(p.id);
      expect(pack).toBeDefined();
      // The label is the cosmetic name + the line word.
      expect(p.label).toContain(pack!.name);
      // The blurb names what it unlocks and says it's cosmetic.
      expect(p.blurb).toContain("One-time purchase");
      expect(p.blurb).toContain("Purely cosmetic.");
      expect(p.blurb).toContain(pack!.name);
      // The display price IS the item's depth tier (nothing else): resolve
      // the granted cosmetic and read its own cashTier back.
      const grantId = IAP_PACK_GRANTS[p.id].id;
      const item =
        PICKAXES.find((c) => c.id === grantId) ??
        OUTFITS.find((c) => c.id === grantId) ??
        CAVE_THEMES.find((c) => c.id === grantId) ??
        SKINS.find((c) => c.id === grantId);
      // …except the custom-skin FEATURE pack, which grants no catalog item
      // and keeps the top tier (its own constant).
      expect(p.priceLabel).toBe(
        item == null ? "$3.99" : cashPriceLabel(item.cashTier),
      );
    }
  });

  it("shop previews show the actual item (todo: cosmetic previews in shop listings)", () => {
    const packs = IAP_PRODUCT_LIST; // the catalog is packs only
    expect(packs).toHaveLength(Object.keys(IAP_PACK_GRANTS).length);
    const spriteUris: Record<"pickaxe" | "outfit" | "skin", string[]> = {
      pickaxe: [],
      outfit: [],
      skin: [],
    };
    for (const p of packs) {
      const grant = IAP_PACK_GRANTS[p.id]!;
      const preview = getIapProductPreview(p.id);
      if (grant.kind === "customSkin") {
        // The skin pass previews the default-outfit miner — the body the
        // uploaded 16×16 sprite replaces once the slot is unlocked.
        expect(preview).toEqual({
          kind: "sprite",
          uri: minerSpriteUri(
            rollMinerLook(COSMETIC_PREVIEW_SEED, DEFAULT_OUTFIT),
          ),
        });
      } else if (grant.kind === "caveTheme") {
        // Swatch strip == the theme's depth palette, exactly.
        expect(preview).toEqual({
          kind: "swatches",
          tints: getCaveTheme(grant.id).tints,
        });
      } else {
        if (preview.kind !== "sprite") {
          throw new Error(`expected a sprite preview, got ${preview.kind}`);
        }
        expect(preview.uri).toMatch(/^data:image\/png;base64,/);
        // This branch is non-theme, so p.line is the pack's sprite line.
        spriteUris[p.line as "pickaxe" | "outfit" | "skin"].push(preview.uri);
      }
    }
    // Each pickaxe previews as its own themed sprite; each outfit as its
    // own (preview-seed) look — in catalog order, which is cosmetics.ts
    // order minus the free defaults (the packs sell only paid items).
    expect(spriteUris.pickaxe).toEqual(
      PICKAXES.filter((p) => p.costGems > 0).map((p) =>
        pickaxeSpriteUri(p.theme, p.tool),
      ),
    );
    // …and the skin line previews each character AS AUTHORED.
    expect(spriteUris.skin).toEqual(SKINS.map((k) => skinSpriteUri(k)));
    expect(spriteUris.outfit).toEqual(
      OUTFITS.filter((o) => o.costGems > 0).map((o) =>
        minerSpriteUri(rollMinerLook(COSMETIC_PREVIEW_SEED, o.id)),
      ),
    );
    // Duplicates would mean two rows showing the same image.
    for (const uris of Object.values(spriteUris)) {
      expect(new Set(uris).size).toBe(uris.length);
    }
    // Stable across calls (the sprite pipeline caches URIs, so a row can't
    // re-encode a fresh image per render).
    expect(getIapProductPreview("packGold")).toEqual(
      getIapProductPreview("packGold"),
    );
  });

  it("iapGrantCosmeticIds splits owned packs by save list", () => {
    expect(iapGrantCosmeticIds(emptyIapEntitlements())).toEqual({
      cosmetics: [],
      caveThemes: [],
      customSkin: false,
    });
    const e = grantIapEntitlement(
      grantIapEntitlement(emptyIapEntitlements(), "packShadow"),
      "packCherry",
    );
    expect(iapGrantCosmeticIds(e)).toEqual({
      cosmetics: ["shadow"],
      caveThemes: ["cherry"],
      customSkin: false,
    });
    // The skin pass is a flag, not a save-list grant.
    const e2 = grantIapEntitlement(e, "packSkin");
    expect(iapGrantCosmeticIds(e2)).toEqual({
      cosmetics: ["shadow"],
      caveThemes: ["cherry"],
      customSkin: true,
    });
  });
});

describe("entitlements", () => {
  it("starts with no entitlements (one false flag per catalog product)", () => {
    const expected: Record<string, boolean> = {};
    for (const id of ALL_PRODUCT_IDS) expected[id] = false;
    expect(emptyIapEntitlements()).toEqual(expected);
    expect(hasIapEntitlement(emptyIapEntitlements(), "packGold")).toBe(false);
  });

  it("grant sets the flag and does not mutate the previous state", () => {
    const e = { ...emptyIapEntitlements() };
    const g = grantIapEntitlement(e, "packGold");
    expect(g.packGold).toBe(true);
    expect(hasIapEntitlement(g, "packGold")).toBe(true);
    expect(e.packGold).toBe(false);
  });

  it("granting an already-owned product is idempotent", () => {
    const owned = grantIapEntitlement(emptyIapEntitlements(), "packGold");
    expect(grantIapEntitlement(owned, "packGold")).toBe(owned);
  });

  it("merge is additive and never revokes", () => {
    const owned = grantIapEntitlement(emptyIapEntitlements(), "packGold");
    // A store round-trip saying "not owned" must not revoke the record.
    expect(mergeIapEntitlements(owned, { packGold: false })).toEqual(owned);
  });

  it("merge returns the original reference when nothing changes", () => {
    const stored = grantIapEntitlement(emptyIapEntitlements(), "packGold");
    expect(mergeIapEntitlements(stored, {})).toBe(stored);
    expect(mergeIapEntitlements(stored, { packGold: false })).toBe(stored);
  });

  it("merge adds newly restored entitlements (every product)", () => {
    const restored: Record<string, boolean> = {};
    for (const id of ALL_PRODUCT_IDS) restored[id] = true;
    expect(mergeIapEntitlements(emptyIapEntitlements(), restored)).toEqual(
      restored,
    );
  });
});

describe("providers", () => {
  it("noop: hidden in production, purchases error out, restore is empty", async () => {
    expect(noopIapProvider.id).toBe("noop");
    expect(noopIapProvider.isAvailable()).toBe(false);
    await expect(noopIapProvider.purchase("packGold")).resolves.toBe("error");
    await expect(noopIapProvider.restore()).resolves.toEqual({});
  });

  it("dev-sim: available, resolves to a completed purchase, restore empty", async () => {
    expect(devSimIapProvider.id).toBe("dev-sim");
    expect(devSimIapProvider.isAvailable()).toBe(true);
    await expect(devSimIapProvider.purchase("packGold")).resolves.toBe(
      "purchased",
    );
    await expect(devSimIapProvider.restore()).resolves.toEqual({});
  });

  it("all three providers implement the same interface surface", () => {
    for (const provider of [
      noopIapProvider,
      devSimIapProvider,
      storeIapProvider,
    ]) {
      expect(typeof provider.id).toBe("string");
      expect(typeof provider.isAvailable()).toBe("boolean");
      expect(provider.purchase("packGold")).resolves.toBeDefined();
      expect(provider.restore()).resolves.toBeDefined();
    }
  });
});

describe("provider selection (the swap point, pure)", () => {
  it("dev builds always select the labeled simulation, no matter what", () => {
    // The simulation is what makes the buy → unlock flow testable before
    // any backend exists; it must never be hidden by a missing config.
    expect(
      pickIapProvider({ dev: true, web: false, iapBackendConfigured: false }),
    ).toBe(devSimIapProvider);
    expect(
      pickIapProvider({ dev: true, web: true, iapBackendConfigured: true }),
    ).toBe(devSimIapProvider);
  });

  it("dev + realStore runs the REAL store provider (debug-APK billing tests, native + configured)", () => {
    // The on-device billing path: a debug APK with the Play license key
    // installed opens the real store sheet (docs §2.4). It must require
    // BOTH a native target and a configured backend...
    expect(
      pickIapProvider({
        dev: true,
        web: false,
        iapBackendConfigured: true,
        realStore: true,
      }),
    ).toBe(storeIapProvider);
    // ...and must fall back to the labeled simulation on web (no store
    // billing there) or without a backend (the store provider would
    // have nowhere to verify).
    expect(
      pickIapProvider({
        dev: true,
        web: true,
        iapBackendConfigured: true,
        realStore: true,
      }),
    ).toBe(devSimIapProvider);
    expect(
      pickIapProvider({
        dev: true,
        web: false,
        iapBackendConfigured: false,
        realStore: true,
      }),
    ).toBe(devSimIapProvider);
  });

  it("web production stays on the no-op (web Stripe path is not built yet, even if configured)", () => {
    expect(
      pickIapProvider({ dev: false, web: true, iapBackendConfigured: true }),
    ).toBe(noopIapProvider);
  });

  it("native production selects the no-op until the Pocketbase URL is configured", () => {
    // Pins the shipped state: the repo builds with an empty URL, so
    // entry points stay hidden everywhere.
    expect(
      pickIapProvider({ dev: false, web: false, iapBackendConfigured: false }),
    ).toBe(noopIapProvider);
  });

  it("native production selects the store provider once configured", () => {
    expect(
      pickIapProvider({ dev: false, web: false, iapBackendConfigured: true }),
    ).toBe(storeIapProvider);
  });

  it("live: the deployed Pocketbase URL selects the store provider (native)", () => {
    // The deployment is live (storeConfig pin test locks the URL), so a
    // production selector must hand out the store provider. Web still stays
    // on the no-op — see the pickIapProvider pin above (web Stripe path
    // not built yet).
    expect(isPocketbaseConfigured()).toBe(true);
    expect(selectIapProvider(false)).toBe(storeIapProvider);
  });
});

describe("unified shop rows (isIapProductOwned / isIapProductEquipped)", () => {
  it("a product is owned via the device entitlement (a cash pack)", () => {
    const e = grantIapEntitlement(emptyIapEntitlements(), "packGold");
    expect(isIapProductOwned("packGold", e, [])).toBe(true);
    // A NOT-entitled product stays unowned even with an empty save.
    expect(isIapProductOwned("packShadow", e, [])).toBe(false);
  });

  it("a product is owned via the save (a gem buy or an imported save)", () => {
    const e = emptyIapEntitlements();
    expect(isIapProductOwned("packShadow", e, ["shadow"])).toBe(true);
    expect(isIapProductOwned("packAmethyst", e, ["amethyst"])).toBe(true);
    expect(isIapProductOwned("packGold", e, ["shadow"])).toBe(false);
  });

  it("equipped tracks the save's selected outfit/pickaxe/theme", () => {
    // Default selections: classic outfit, steel pickaxe, natural theme.
    expect(
      isIapProductEquipped("packGold", "classic", "gold", "natural", ""),
    ).toBe(true);
    expect(
      isIapProductEquipped(
        "packShadow",
        "classic",
        "gold",
        "natural",
        "",
      ),
    ).toBe(false);
    expect(
      isIapProductEquipped("packCrystal", "crystal", "steel", "natural", ""),
    ).toBe(true);
    expect(
      isIapProductEquipped(
        "packAmethyst",
        "classic",
        "steel",
        "amethyst",
        "",
      ),
    ).toBe(true);
    expect(
      isIapProductEquipped("packAmethyst", "classic", "steel", "natural", ""),
    ).toBe(false);
  });
});
