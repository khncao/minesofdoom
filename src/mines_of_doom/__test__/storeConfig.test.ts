import fs from "fs";
import path from "path";
import { getAdMobIds, isAdMobIdsConfigured, storeConfig } from "../storeConfig";

// Production rewarded unit ids (AdMob console → Ad units → Rewarded).
// All four placements are production, and one set serves both platforms
// (ad units aren't platform-scoped — the App ID is).
const GEM_ROLLS_UNIT = "ca-app-pub-2101316086878618/8308813932";
const OFFLINE_DOUBLE_UNIT = "ca-app-pub-2101316086878618/9024953635";
const OFFLINE_TOPUP_UNIT = "ca-app-pub-2101316086878618/1898589303";
const COMBO_SAVE_UNIT = "ca-app-pub-2101316086878618/9285949727";

// AdMob's PUBLIC TEST rewarded unit ids (the same constants the
// react-native-google-mobile-ads package exports as TestIds — hardcoded
// here because storeConfig can't import the SDK module). These must
// never appear in the config (the "no test ids" test below enforces it).
const ANDROID_TEST_UNIT = "ca-app-pub-3940256099942544/5224354917";
const IOS_TEST_UNIT = "ca-app-pub-3145189286508883/1712485313";

const androidUnits = {
  gemRolls: GEM_ROLLS_UNIT,
  offlineDouble: OFFLINE_DOUBLE_UNIT,
  offlineTopUp: OFFLINE_TOPUP_UNIT,
  comboSave: COMBO_SAVE_UNIT,
};
const iosUnits = androidUnits;

describe("storeConfig (runbook §1 — the single SDK config point)", () => {
  it("pins the storeConfig values (empty = unconfigured)", () => {
    // The Android AdMob App ID and the production rewarded units for all
    // four placements have landed (docs/store-integration.md §1); the iOS
    // App ID is still unset, so iOS runs the no-op provider until it lands.
    expect(storeConfig.adMob.androidAppId).toBe(
      "ca-app-pub-2101316086878618~4973124022",
    );
    expect(storeConfig.adMob.iosAppId).toBe("");
    expect(storeConfig.adMob.rewardedUnitAndroid).toEqual(androidUnits);
    expect(storeConfig.adMob.rewardedUnitIos).toEqual(iosUnits);
    // Guardrail 7 default OFF until the final age rating is known.
    expect(storeConfig.adMob.tagForChildDirectedTreatment).toBe(false);
    // The Pocketbase deployment is live (docs/pocketbase-plan.md) — pin the
    // URL so a stray edit can't point the client at the wrong backend.
    expect(storeConfig.pocketbaseUrl).toBe(
      "https://minesofdoom.minus4kelvin.com",
    );
  });

  it("never ships an AdMob public test unit id", () => {
    // Test ids fill instantly on any device, so a leaked test id would
    // silently replace a production unit (docs/store-integration.md §1).
    const all = [
      ...Object.values(storeConfig.adMob.rewardedUnitAndroid),
      ...Object.values(storeConfig.adMob.rewardedUnitIos),
    ];
    for (const unit of all) {
      expect(unit).not.toBe(ANDROID_TEST_UNIT);
      expect(unit).not.toBe(IOS_TEST_UNIT);
    }
  });

  it("isAdMobIdsConfigured requires the app id AND every placement unit", () => {
    const filled = { gemRolls: "u", offlineDouble: "u", offlineTopUp: "u", comboSave: "u" };
    expect(
      isAdMobIdsConfigured({ appId: "", rewardedUnitIds: filled }),
    ).toBe(false);
    expect(
      isAdMobIdsConfigured({ appId: "app", rewardedUnitIds: { ...filled, gemRolls: "" } }),
    ).toBe(false);
    expect(
      isAdMobIdsConfigured({
        appId: "app",
        rewardedUnitIds: { gemRolls: "", offlineDouble: "", offlineTopUp: "", comboSave: "" },
      }),
    ).toBe(false);
    expect(
      isAdMobIdsConfigured({ appId: "app", rewardedUnitIds: filled }),
    ).toBe(true);
  });

  it("the app.config.ts plugin ids never drift from storeConfig", () => {
    // app.config.ts can't import this module (the Expo config loader uses a
    // plain node require), so the AdMob App ids are duplicated in the
    // `adMobAppIds` block there for the prebuild plugin. Pin them together.
    const cfg = fs
      .readFileSync(path.join(__dirname, "../../../app.config.ts"), "utf8")
      .match(/^const adMobAppIds = \{[^}]*\};/m)?.[0] ?? "";
    const valueOf = (name: string) =>
      cfg.match(new RegExp(`${name}: "([^"]*)"`))?.[1] ?? "";
    expect(valueOf("androidAppId")).toBe(storeConfig.adMob.androidAppId);
    expect(valueOf("iosAppId")).toBe(storeConfig.adMob.iosAppId);
  });

  it("getAdMobIds picks the matching pair per platform", () => {
    // Pinned against the config fields themselves (not hardcoded strings)
    // so a filled-in id can only ever reach the provider through here.
    expect(getAdMobIds("android")).toEqual({
      appId: storeConfig.adMob.androidAppId,
      rewardedUnitIds: storeConfig.adMob.rewardedUnitAndroid,
    });
    expect(getAdMobIds("ios")).toEqual({
      appId: storeConfig.adMob.iosAppId,
      rewardedUnitIds: storeConfig.adMob.rewardedUnitIos,
    });
  });
});
