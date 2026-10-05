const { modifyManifest, APPLICATION_ID_KEY } = require("../withAdMobAds");

/**
 * Plugins run under plain node (the Expo config loader uses require), so
 * these tests drive the pure transform directly — the same way
 * withDebugSigning.test.js does.
 */

/** A minimal merged-manifest shape, in the shape the Android manifest
 *  merger hands a config plugin. */
function manifestFixture() {
  return {
    manifest: {
      $: { "xmlns:android": "http://schemas.android.com/apk/res/android" },
      "uses-permission": [
        { $: { "android:name": "android.permission.INTERNET" } },
      ],
      // Realistic: Expo's generated <application> carries android:name
      // ".MainApplication", NOT the literal "application". A fixture that
      // said "application" would hide a duplicate-element bug that the
      // Android bundler rejects outright.
      application: [
        {
          $: {
            "android:name": ".MainApplication",
            "android:label": "@string/app_name",
          },
        },
      ],
    },
  };
}

const permsOf = (m) => m.manifest["uses-permission"] ?? [];
const appEntries = (m) =>
  Array.isArray(m.manifest.application)
    ? m.manifest.application
    : [m.manifest.application];
const appOf = (m) => appEntries(m)[0];
const metaOf = (m) => appOf(m)?.["meta-data"] ?? [];
const appIdMetaOf = (m) =>
  metaOf(m).find((x) => x?.$?.["android:name"] === APPLICATION_ID_KEY);

describe("withAdMobAds", () => {
  it("adds a tools:node=remove marker for every ad-id permission", () => {
    const out = modifyManifest(manifestFixture(), {
      removeAdvertisingId: true,
      appId: "ca-app-pub-1~2",
    });
    const removed = permsOf(out).filter((p) => p?.$?.["tools:node"] === "remove");
    // AD_ID plus both spellings of the three ACCESS_ADSERVICES_* entries.
    expect(removed).toHaveLength(7);
    const names = removed.map((p) => p.$["android:name"]);
    expect(names).toContain("com.google.android.gms.permission.AD_ID");
    expect(names).toContain("android.permission.ACCESS_ADSERVICES_AD_ID");
    expect(out.manifest.$["xmlns:tools"]).toBe(
      "http://schemas.android.com/tools",
    );
    // Existing permissions are kept, not replaced.
    expect(
      permsOf(out).some((p) => p?.$?.["android:name"] === "android.permission.INTERNET"),
    ).toBe(true);
  });

  it("is idempotent — a second patch adds no duplicate markers or meta-data", () => {
    const once = modifyManifest(manifestFixture(), {
      removeAdvertisingId: true,
      appId: "ca-app-pub-1~2",
    });
    const twice = modifyManifest(once, {
      removeAdvertisingId: true,
      appId: "ca-app-pub-1~2",
    });
    expect(permsOf(twice).filter((p) => p?.$?.["tools:node"] === "remove")).toHaveLength(7);
    expect(metaOf(twice).filter((m) => m?.$?.["android:name"] === APPLICATION_ID_KEY)).toHaveLength(1);
  });

  it("writes the AdMob App ID so GMA can read it from the manifest", () => {
    const appId = "ca-app-pub-2101316086878618~4973124022";
    const out = modifyManifest(manifestFixture(), {
      removeAdvertisingId: true,
      appId,
    });
    expect(appIdMetaOf(out)?.$["android:value"]).toBe(appId);
  });

  it("writes NO App ID when it is empty (the 'empty = hidden' rule)", () => {
    // The whole point: an unconfigured build must not even carry the App
    // ID, so no ad request can go out.
    const out = modifyManifest(manifestFixture(), {
      removeAdvertisingId: true,
      appId: "",
    });
    expect(appIdMetaOf(out)).toBeUndefined();
  });

  it("never adds a SECOND <application> element", () => {
    // Regression: matching <application> by android:name == "application"
    // misses the real element (it is ".MainApplication"), which appended a
    // duplicate and failed the bundle with "At most one element
    // <application> … was expected, but 2 were found".
    const out = modifyManifest(manifestFixture(), {
      removeAdvertisingId: true,
      appId: "ca-app-pub-1~2",
    });
    expect(appEntries(out)).toHaveLength(1);
    expect(appOf(out).$["android:name"]).toBe(".MainApplication");
    // …and the meta-data landed on THAT one.
    expect(appIdMetaOf(out)?.$["android:value"]).toBe("ca-app-pub-1~2");
  });

  it("leaves the ad-id permissions alone when the flag is false", () => {
    const out = modifyManifest(manifestFixture(), {
      removeAdvertisingId: false,
      appId: "ca-app-pub-1~2",
    });
    expect(permsOf(out).filter((p) => p?.$?.["tools:node"] === "remove")).toHaveLength(0);
    // …but the App ID is still written: the flag governs the AAID, not the
    // SDK's identity.
    expect(appIdMetaOf(out)?.$["android:value"]).toBe("ca-app-pub-1~2");
  });
});
