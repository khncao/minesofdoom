import {
  IAP_PACK_GRANTS,
  IAP_PRODUCTS,
  IAP_PRODUCT_LIST,
  IAP_STORE_IDS,
  IapProductId,
  devSimIapProvider,
  emptyIapEntitlements,
  getIapPackCosmetic,
  grantIapEntitlement,
  hasIapEntitlement,
  iapGrantCosmeticIds,
  mergeIapEntitlements,
  noopIapProvider,
  selectIapProvider,
} from "../iaps";
import {
  CAVE_THEMES,
  OUTFITS,
  PICKAXES,
} from "../cosmetics";

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
});

describe("IAP catalog (plan §5.2)", () => {
  it("lists Remove Ads with a plain label, a display price, and a blurb", () => {
    const p = IAP_PRODUCTS.removeAds;
    expect(p.id).toBe("removeAds");
    expect(p.label.length).toBeGreaterThan(0);
    // Display price only (transparency line); the store sheet shows the
    // localized one.
    expect(p.priceLabel).toMatch(/^\$\d+\.\d{2}$/);
    expect(p.blurb.length).toBeGreaterThan(0);
  });

  it("every product has a plain label, a display price, and a blurb", () => {
    for (const p of IAP_PRODUCT_LIST) {
      expect(p.id).toBeDefined();
      expect(p.label.length).toBeGreaterThan(0);
      // $0.99–$3.99 band per plan §5.2 cosmetic packs.
      const price = Number.parseFloat(p.priceLabel.replace("$", ""));
      expect(price).toBeGreaterThanOrEqual(0.99);
      expect(price).toBeLessThanOrEqual(3.99);
      expect(p.blurb.length).toBeGreaterThan(0);
    }
    // Remove Ads stays first (anchor IAP), ids unique.
    expect(IAP_PRODUCT_LIST[0].id).toBe("removeAds");
    expect(new Set(IAP_PRODUCT_LIST.map((p) => p.id)).size).toBe(
      IAP_PRODUCT_LIST.length,
    );
  });
});

describe("cosmetic packs (plan §5.2)", () => {
  it("every pack grants a real catalog cosmetic", () => {
    const grantIds = Object.entries(IAP_PACK_GRANTS) as [
      IapProductId,
      { kind: "cosmetic" | "caveTheme"; id: string },
    ][];
    expect(grantIds.length).toBeGreaterThan(0);
    for (const [productId, grant] of grantIds) {
      expect(ALL_PRODUCT_IDS).toContain(productId);
      const info = getIapPackCosmetic(productId);
      expect(info).toBeDefined();
      if (grant.kind === "caveTheme") {
        expect(CAVE_THEMES.some((t) => t.id === grant.id)).toBe(true);
      } else {
        expect(
          OUTFITS.some((o) => o.id === grant.id) ||
            PICKAXES.some((p) => p.id === grant.id),
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

  it("Remove Ads is not a pack", () => {
    expect(getIapPackCosmetic("removeAds")).toBeUndefined();
  });

  it("iapGrantCosmeticIds splits owned packs by save list", () => {
    expect(iapGrantCosmeticIds(emptyIapEntitlements())).toEqual({
      cosmetics: [],
      caveThemes: [],
    });
    const e = grantIapEntitlement(
      grantIapEntitlement(emptyIapEntitlements(), "packShadowPick"),
      "packCherryTheme",
    );
    expect(iapGrantCosmeticIds(e)).toEqual({
      cosmetics: ["shadow"],
      caveThemes: ["cherry"],
    });
  });
});

describe("entitlements", () => {
  it("starts with no entitlements (one false flag per catalog product)", () => {
    const expected: Record<string, boolean> = {};
    for (const id of ALL_PRODUCT_IDS) expected[id] = false;
    expect(emptyIapEntitlements()).toEqual(expected);
    expect(hasIapEntitlement(emptyIapEntitlements(), "removeAds")).toBe(false);
  });

  it("grant sets the flag and does not mutate the previous state", () => {
    const e = { ...emptyIapEntitlements() };
    const g = grantIapEntitlement(e, "removeAds");
    expect(g.removeAds).toBe(true);
    expect(hasIapEntitlement(g, "removeAds")).toBe(true);
    expect(e.removeAds).toBe(false);
  });

  it("granting an already-owned product is idempotent", () => {
    const owned = grantIapEntitlement(emptyIapEntitlements(), "removeAds");
    expect(grantIapEntitlement(owned, "removeAds")).toBe(owned);
  });

  it("merge is additive and never revokes", () => {
    const owned = grantIapEntitlement(emptyIapEntitlements(), "removeAds");
    // A store round-trip saying "not owned" must not revoke the record.
    expect(mergeIapEntitlements(owned, { removeAds: false })).toEqual(owned);
  });

  it("merge returns the original reference when nothing changes", () => {
    const stored = grantIapEntitlement(emptyIapEntitlements(), "removeAds");
    expect(mergeIapEntitlements(stored, {})).toBe(stored);
    expect(
      mergeIapEntitlements(stored, { removeAds: false }),
    ).toBe(stored);
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
    await expect(noopIapProvider.purchase("removeAds")).resolves.toBe("error");
    await expect(noopIapProvider.restore()).resolves.toEqual({});
  });

  it("dev-sim: available, resolves to a completed purchase, restore empty", async () => {
    expect(devSimIapProvider.id).toBe("dev-sim");
    expect(devSimIapProvider.isAvailable()).toBe(true);
    await expect(devSimIapProvider.purchase("removeAds")).resolves.toBe(
      "purchased",
    );
    await expect(devSimIapProvider.restore()).resolves.toEqual({});
  });

  it("both providers implement the same interface surface", () => {
    for (const provider of [noopIapProvider, devSimIapProvider]) {
      expect(typeof provider.id).toBe("string");
      expect(typeof provider.isAvailable()).toBe("boolean");
      expect(provider.purchase("removeAds")).resolves.toBeDefined();
      expect(provider.restore()).resolves.toBeDefined();
    }
  });
});

describe("provider selection (the one-line swap point)", () => {
  it("production (dev: false) selects the no-op provider", () => {
    // Pins guardrail 5: no store SDK is bundled today, so production
    // selects the no-op whose entry points stay hidden. When the real
    // provider lands, this test asserts the swap is deliberate.
    expect(selectIapProvider(false)).toBe(noopIapProvider);
  });

  it("dev builds select the labeled simulation", () => {
    expect(selectIapProvider(true)).toBe(devSimIapProvider);
  });
});
