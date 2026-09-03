import fs from "fs";
import path from "path";
import { getAdMobIds, isAdMobIdsConfigured, storeConfig } from "../storeConfig";

describe("storeConfig (runbook §1 — the single SDK config point)", () => {
  it("ships with every value unset (empty = unconfigured)", () => {
    // Pins the "empty = unset" rule: until real ids land
    // (docs/store-integration.md), providers fall back to the no-ops.
    expect(storeConfig.adMob.androidAppId).toBe("");
    expect(storeConfig.adMob.iosAppId).toBe("");
    expect(storeConfig.adMob.rewardedUnitAndroid).toBe("");
    expect(storeConfig.adMob.rewardedUnitIos).toBe("");
    // Guardrail 7 default OFF until the final age rating is known.
    expect(storeConfig.adMob.tagForChildDirectedTreatment).toBe(false);
    expect(storeConfig.iap.pocketbaseUrl).toBe("");
  });

  it("isAdMobIdsConfigured requires BOTH the app id and a unit id", () => {
    expect(isAdMobIdsConfigured({ appId: "", rewardedUnitId: "" })).toBe(
      false,
    );
    expect(
      isAdMobIdsConfigured({ appId: "app", rewardedUnitId: "" }),
    ).toBe(false);
    expect(isAdMobIdsConfigured({ appId: "", rewardedUnitId: "unit" })).toBe(
      false,
    );
    expect(
      isAdMobIdsConfigured({ appId: "app", rewardedUnitId: "unit" }),
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
      rewardedUnitId: storeConfig.adMob.rewardedUnitAndroid,
    });
    expect(getAdMobIds("ios")).toEqual({
      appId: storeConfig.adMob.iosAppId,
      rewardedUnitId: storeConfig.adMob.rewardedUnitIos,
    });
  });
});
