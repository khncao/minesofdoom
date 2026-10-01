import { REMOVED_PERMISSIONS, modifyManifest } from "../withUnityAds";

/** A faithful stand-in for what `expo prebuild` + the local Expo module leave
 *  in android/app/src/main/AndroidManifest.xml: the app's own INTERNET
 *  permission, no tools namespace, no ad permissions (those merge in later
 *  from the Unity Ads AAR). */
const PRISTINE = {
  manifest: {
    $: { "xmlns:android": "http://schemas.android.com/apk/res/android" },
    "uses-permission": [{ $: { "android:name": "android.permission.INTERNET" } }],
    application: [{ $: { "android:name": ".MainActivity" } }],
  },
};

describe("withUnityAds.modifyManifest", () => {
  it("marks every ad permission for removal and adds the tools namespace", () => {
    const out = modifyManifest(structuredClone(PRISTINE)).manifest;

    expect(out.$["xmlns:tools"]).toBe("http://schemas.android.com/tools");
    const removed = out["uses-permission"]
      .filter((p) => p.$["tools:node"] === "remove")
      .map((p) => p.$["android:name"]);
    expect(removed).toEqual(REMOVED_PERMISSIONS);
    // The permission we DO want survives.
    expect(out["uses-permission"]).toContainEqual({
      $: { "android:name": "android.permission.INTERNET" },
    });
  });

  it("is idempotent (a repeat prebuild can't double the markers)", () => {
    const once = modifyManifest(structuredClone(PRISTINE));
    const twice = modifyManifest(once);

    expect(twice).toEqual(once);
    expect(
      twice.manifest["uses-permission"].filter((p) => p.$["tools:node"] === "remove"),
    ).toHaveLength(REMOVED_PERMISSIONS.length);
  });

  it("keeps an existing tools namespace instead of clobbering it", () => {
    const manifest = structuredClone(PRISTINE);
    manifest.manifest.$["xmlns:tools"] = "http://schemas.android.com/tools";

    const out = modifyManifest(manifest).manifest;

    expect(out.$["xmlns:tools"]).toBe("http://schemas.android.com/tools");
  });

  it("removes nothing when the stance flips to a teen+/adult posture", () => {
    const out = modifyManifest(structuredClone(PRISTINE), false).manifest;

    expect(out["uses-permission"]).toEqual([
      { $: { "android:name": "android.permission.INTERNET" } },
    ]);
    expect(out.$["xmlns:tools"]).toBeUndefined();
  });

  it("handles a manifest with no uses-permission block at all", () => {
    const out = modifyManifest({ manifest: { $: {} } }).manifest;

    expect(out["uses-permission"]).toHaveLength(REMOVED_PERMISSIONS.length);
  });
});