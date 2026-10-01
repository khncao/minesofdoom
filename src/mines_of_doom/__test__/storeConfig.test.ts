import fs from "fs";
import path from "path";
import {
  getActiveStripe,
  getStripePrice,
  getUnityAdsIds,
  isUnityAdsConfigured,
  isAdSenseConfigured,
  isStripeConfigured,
  isStripeProdConfigured,
  storeConfig,
} from "../storeConfig";
import { IAP_PRODUCT_IDS, IAP_PRODUCTS } from "../iaps";

// Unity Ads placement ids (Unity dashboard → Monetization → Ad units →
// Rewarded; docs/store-integration.md §1). PLACEHOLDERS until the owner's
// Unity project exists: they are NOT wired into storeConfig, they only
// document the shape the paste must have and keep the "no test/demo ids"
// net honest. Real ids are numeric strings, one per placement.
const ANDROID_UNITS = {
  gemRolls: "0000001",
  offlineDouble: "0000002",
  offlineTopUp: "0000003",
  comboSave: "0000004",
};
const IOS_UNITS = { ...ANDROID_UNITS };

// Unity's PUBLIC TEST placement ids (Unity dashboard test mode) must never
// appear in a shipped config — they fill instantly on any device.
const UNITY_TEST_PLACEMENTS = ["1234567", "1234568"];

describe("storeConfig (runbook §1 — the single SDK config point)", () => {
  it("pins the storeConfig values (empty = unconfigured)", () => {
    // Native ads moved to Unity Ads (2026-10-01) because Play's Families
    // rules require a rewarded ad to be closeable within 5 seconds and the
    // AdMob rewarded unit cannot be. Values stay EMPTY until the owner's
    // Unity project exists (docs/store-integration.md §1) — empty = hidden
    // entry points, so the game is still shippable without them.
    expect(storeConfig.unityAds.androidGameId).toBe("");
    expect(storeConfig.unityAds.iosGameId).toBe("");
    expect(storeConfig.unityAds.rewardedPlacementAndroid).toEqual({
      gemRolls: "",
      offlineDouble: "",
      offlineTopUp: "",
      comboSave: "",
    });
    expect(storeConfig.unityAds.rewardedPlacementIos).toEqual({
      gemRolls: "",
      offlineDouble: "",
      offlineTopUp: "",
      comboSave: "",
    });
    // Guardrail 6 (kid safety): ads are served child-directed /
    // non-personalized for EVERY user, which is what makes one ad surface
    // valid for all ages (docs/store-integration.md §0 "Re-opened"), and it
    // is why the ad-id permissions are stripped at prebuild.
    expect(storeConfig.unityAds.childDirectedTreatment).toBe(true);
    expect(storeConfig.unityAds.stripAdvertisingId).toBe(true);
    // The Pocketbase deployment is live (docs/pocketbase-plan.md) — pin the
    // URL so a stray edit can't point the client at the wrong backend.
    expect(storeConfig.pocketbaseUrl).toBe(
      "https://minesofdoom.minus4kelvin.com",
    );
  });

  it("never ships a Unity test-mode placement id", () => {
    // Unity test placements fill instantly on any device, so a leaked one
    // would silently replace a production placement
    // (docs/store-integration.md §1).
    const all = [
      ...Object.values(storeConfig.unityAds.rewardedPlacementAndroid),
      ...Object.values(storeConfig.unityAds.rewardedPlacementIos),
      ...Object.values(ANDROID_UNITS),
      ...Object.values(IOS_UNITS),
    ];
    for (const placement of all) {
      expect(UNITY_TEST_PLACEMENTS).not.toContain(placement);
    }
  });

  it("isUnityAdsConfigured requires the Game ID AND every placement id", () => {
    const filled = {
      gemRolls: "u",
      offlineDouble: "u",
      offlineTopUp: "u",
      comboSave: "u",
    };
    expect(isUnityAdsConfigured({ gameId: "", rewardedPlacementIds: filled })).toBe(
      false,
    );
    expect(
      isUnityAdsConfigured({
        gameId: "game",
        rewardedPlacementIds: { ...filled, gemRolls: "" },
      }),
    ).toBe(false);
    expect(
      isUnityAdsConfigured({
        gameId: "game",
        rewardedPlacementIds: {
          gemRolls: "",
          offlineDouble: "",
          offlineTopUp: "",
          comboSave: "",
        },
      }),
    ).toBe(false);
    expect(
      isUnityAdsConfigured({ gameId: "game", rewardedPlacementIds: filled }),
    ).toBe(true);
  });

  it("the app.config.ts manifest flags never drift from storeConfig", () => {
    // app.config.ts can't import this module (the Expo config loader uses a
    // plain node require), so the ad-id posture is duplicated in the
    // `unityAdsManifestOptions` block there for plugins/withUnityAds. Pin
    // them together: flipping one and not the other would ship an app whose
    // ad code can read the advertising ID while the policy says it cannot.
    const cfg =
      fs
        .readFileSync(path.join(__dirname, "../../../app.config.ts"), "utf8")
        .match(/^const unityAdsManifestOptions = \{[^}]*\};/m)?.[0] ?? "";
    expect(cfg).not.toBe("");
    const valueOf = (name: string) =>
      cfg.match(new RegExp(`${name}: (true|false)`))?.[1] ?? "";
    expect(valueOf("removeAdvertisingId")).toBe(
      String(storeConfig.unityAds.stripAdvertisingId),
    );
  });

  it("getUnityAdsIds picks the matching pair per platform", () => {
    // Pinned against the config fields themselves (not hardcoded strings)
    // so a filled-in id can only ever reach the provider through here.
    expect(getUnityAdsIds("android")).toEqual({
      gameId: storeConfig.unityAds.androidGameId,
      rewardedPlacementIds: storeConfig.unityAds.rewardedPlacementAndroid,
    });
    expect(getUnityAdsIds("ios")).toEqual({
      gameId: storeConfig.unityAds.iosGameId,
      rewardedPlacementIds: storeConfig.unityAds.rewardedPlacementIos,
    });
  });

  it("the AdSense client and Stripe key are pinned; the price map covers the full catalog", () => {
    // Stripe web IAP: the publishable key is configured (pk_test — the
    // PUBLIC key, safe in the bundle); the price map (synced by
    // `node scripts/stripe/syncStripe.mjs products`) must cover the FULL
    // catalog — a missing product would silently hide it from the web
    // shop while native still sells it.
    expect(storeConfig.stripe.publishableKey).toMatch(/^pk_test_[A-Za-z0-9]+$/);
    expect(new Set(Object.keys(storeConfig.stripe.prices))).toEqual(
      new Set(IAP_PRODUCT_IDS),
    );
    for (const price of Object.values(storeConfig.stripe.prices)) {
      expect(price).toMatch(/^price_[A-Za-z0-9]+$/);
    }
    // Live default is now configured (key + full price map).
    expect(isStripeConfigured()).toBe(true);
    // The AdSense client is configured (docs/todo.md #2) — pinned so a
    // stray edit can't point the loader at the wrong account. (No slot id:
    // the Ad Placement API placements are per-kind adBreaks on the same
    // client, see adSenseProvider.web.ts.)
    expect(storeConfig.adsense.client).toBe("ca-pub-2101316086878618");
  });

  it("isStripeConfigured is all-or-nothing over the full catalog", () => {
    const ids = IAP_PRODUCT_IDS;
    // No publishable key → never.
    expect(isStripeConfigured("", {})).toBe(false);
    // A malformed key (not pk_test_/pk_live_) → never.
    expect(isStripeConfigured("pk_foo_abc", { a: "p" }, ["a"])).toBe(false);
    expect(isStripeConfigured("pk_test_abc123", { a: "" }, ["a"])).toBe(false);
    // A half-filled price map → the WHOLE catalog stays hidden.
    const partial = Object.fromEntries(
      ids.slice(0, -1).map((id) => [id, "price_x"]),
    );
    expect(isStripeConfigured("pk_test_abc", partial, ids)).toBe(false);
    // A full map (every catalog id priced) → configured.
    const full = Object.fromEntries(ids.map((id) => [id, "price_x"]));
    expect(isStripeConfigured("pk_test_abc", full, ids)).toBe(true);
    expect(isStripeConfigured("pk_live_abc", full, ids)).toBe(true);
    // The live default (no args) is TRUE: the key and the full price map
    // are configured (test mode).
    expect(isStripeConfigured()).toBe(true);
  });

  it("the price map is keyed by every catalog product id once configured", () => {
    // Guardrail: when prices land, they must cover the FULL catalog
    // (IAP_PRODUCTS keys) — a missing product would silently hide it from
    // the web shop while native still sells it.
    const ids = IAP_PRODUCT_IDS;
    const keys = Object.keys(storeConfig.stripe.prices);
    if (keys.length > 0) {
      expect(new Set(keys)).toEqual(new Set(ids));
    }
    expect(Object.keys(IAP_PRODUCTS)).toHaveLength(ids.length);
  });

  it("getStripePrice returns '' for a missing product", () => {
    expect(getStripePrice("packGold", {})).toBe("");
    expect(getStripePrice("packGold", { packGold: "price_1" })).toBe("price_1");
  });

  it("isAdSenseConfigured requires a ca-pub- client", () => {
    expect(isAdSenseConfigured("")).toBe(false);
    // A non-pub client id (typo) can't silently load another account.
    expect(isAdSenseConfigured("not-a-pub-id")).toBe(false);
    expect(isAdSenseConfigured("ca-pub-1234567890")).toBe(true);
    // The live default is true: the client is configured (docs/todo.md #2).
    expect(isAdSenseConfigured()).toBe(true);
  });

  describe("prod variables (stripeProd — the auto-enable, environment.ts)", () => {
    // The flip is a data paste: these mutate the prod block, then
    // restore it (the file pin above keeps the committed state exact).
    const savedKey = storeConfig.stripeProd.publishableKey;
    const savedPrices = storeConfig.stripeProd.prices;
    afterEach(() => {
      storeConfig.stripeProd.publishableKey = savedKey;
      storeConfig.stripeProd.prices = savedPrices;
    });

    it("pins the flipped price map (launch flip, §2.6 step 6)", () => {
      // The price map is pasted (syncStripe.mjs products --live) and must
      // cover the FULL catalog with live price ids.
      expect(new Set(Object.keys(storeConfig.stripeProd.prices))).toEqual(
        new Set(IAP_PRODUCT_IDS),
      );
      for (const price of Object.values(storeConfig.stripeProd.prices)) {
        expect(price).toMatch(/^price_[A-Za-z0-9]+$/);
      }
    });

    it("never activates on a non-prod env, even fully filled", () => {
      storeConfig.stripeProd.publishableKey = "pk_live_fixture123";
      storeConfig.stripeProd.prices = Object.fromEntries(
        IAP_PRODUCT_IDS.map((id) => [id, "price_LiveFixture123"]),
      );
      expect(isStripeProdConfigured()).toBe(true);
      // Non-prod env (dev server / preview) always runs the test block.
      expect(getActiveStripe(false)).toBe(storeConfig.stripe);
    });

    it("prod env + unconfigured prod block falls back to the test block", () => {
      // No publishable key → never an activation, however full the map.
      storeConfig.stripeProd.publishableKey = "";
      expect(isStripeProdConfigured()).toBe(false);
      expect(getActiveStripe(true)).toBe(storeConfig.stripe);
    });

    it("a test key in the prod block is a config error, not an activation", () => {
      storeConfig.stripeProd.publishableKey = "pk_test_fixture123";
      storeConfig.stripeProd.prices = Object.fromEntries(
        IAP_PRODUCT_IDS.map((id) => [id, "price_TestFixture123"]),
      );
      expect(isStripeProdConfigured()).toBe(false);
      expect(getActiveStripe(true)).toBe(storeConfig.stripe);
    });

    it("prod env + a fully live prod block auto-enables the prod variables", () => {
      storeConfig.stripeProd.publishableKey = "pk_live_fixture123";
      storeConfig.stripeProd.prices = Object.fromEntries(
        IAP_PRODUCT_IDS.map((id) => [id, "price_LiveFixture123"]),
      );
      const active = getActiveStripe(true);
      expect(active).toBe(storeConfig.stripeProd);
      expect(active.publishableKey).toBe("pk_live_fixture123");
    });

    it("a half-pasted prod map is served but the provider's catalog gate still refuses it", () => {
      storeConfig.stripeProd.publishableKey = "pk_live_fixture123";
      // One id missing from the full catalog.
      storeConfig.stripeProd.prices = Object.fromEntries(
        IAP_PRODUCT_IDS.slice(0, -1).map((id) => [id, "price_LiveFixture123"]),
      );
      const active = getActiveStripe(true);
      // The activation check is coarse (live key + non-empty map) so the
      // half map IS served — but the all-or-nothing catalog gate the
      // providers use on top of it refuses it (shop stays hidden).
      expect(active).toBe(storeConfig.stripeProd);
      expect(
        isStripeConfigured(
          active.publishableKey,
          active.prices,
          IAP_PRODUCT_IDS,
        ),
      ).toBe(false);
    });
  });
});
