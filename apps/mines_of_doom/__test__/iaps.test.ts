import {
  IAP_PRODUCTS,
  IapEntitlements,
  devSimIapProvider,
  emptyIapEntitlements,
  grantIapEntitlement,
  hasIapEntitlement,
  mergeIapEntitlements,
  noopIapProvider,
} from "../iaps";

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
});

describe("entitlements", () => {
  it("starts with no entitlements", () => {
    expect(emptyIapEntitlements()).toEqual({ removeAds: false });
    expect(hasIapEntitlement(emptyIapEntitlements(), "removeAds")).toBe(false);
  });

  it("grant sets the flag and does not mutate the previous state", () => {
    const e: IapEntitlements = { removeAds: false };
    const g = grantIapEntitlement(e, "removeAds");
    expect(g).toEqual({ removeAds: true });
    expect(hasIapEntitlement(g, "removeAds")).toBe(true);
    expect(e.removeAds).toBe(false);
  });

  it("granting an already-owned product is idempotent", () => {
    const owned: IapEntitlements = { removeAds: true };
    expect(grantIapEntitlement(owned, "removeAds")).toEqual(owned);
  });

  it("merge is additive and never revokes", () => {
    const owned: IapEntitlements = { removeAds: true };
    // A store round-trip saying "not owned" must not revoke the record.
    expect(mergeIapEntitlements(owned, { removeAds: false })).toEqual(owned);
  });

  it("merge returns the original reference when nothing changes", () => {
    const stored: IapEntitlements = { removeAds: true };
    expect(mergeIapEntitlements(stored, {})).toBe(stored);
    expect(
      mergeIapEntitlements(stored, { removeAds: false }),
    ).toBe(stored);
  });

  it("merge adds newly restored entitlements", () => {
    expect(mergeIapEntitlements(emptyIapEntitlements(), { removeAds: true })).toEqual(
      { removeAds: true },
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
