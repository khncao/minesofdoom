import { withAndroidManifest } from "@expo/config-plugins";

/**
 * Native manifest patch for the Unity Ads switch (2026-10-01).
 *
 * Why: the Unity Ads AAR declares
 * `<uses-permission android:name="com.google.android.gms.permission.AD_ID" />`
 * (plus `ACCESS_ADSERVICES_AD_ID` / `_TOPICS` / `_ATTRIBUTION`) in its own
 * manifest. With the kid-safe posture the app runs in (child-directed
 * treatment on, contextual-only demand — guardrail 6, plus the Play Families
 * rule that an app serving children must not transmit the advertising ID),
 * no ad code may read the AAID at all. Removing the permission makes that
 * structurally impossible instead of merely policy-flagged — exactly the
 * option AdMob's own Families doc suggests ("You can also choose to disable
 * the advertising ID for your entire app by preventing the advertising ID
 * permission from being merged into your app"). The three
 * `ACCESS_ADSERVICES_*` permissions go with it: they exist only so an ad SDK
 * can read the ad id, so there is nothing to use them for here.
 *
 * Idempotent (a re-patch is a no-op) and driven by ONE flag,
 * `storeConfig.unityAds.stripAdvertisingId` mirrored in app.config.ts (pinned
 * together by src/mines_of_doom/__test__/storeConfig.test.ts). Flipping it to
 * `false` restores the permissions — do that only together with flipping
 * `childDirectedTreatment` off and a non-children target audience, since the
 * two are one decision.
 *
 * Unit-tested in plugins/__test__/withUnityAds.test.js.
 */

// Verified against the merged manifest of a real release build: the AAR
// declares AD_ID under the `com.google.android.gms.permission.` namespace
// but the three ACCESS_ADSERVICES_* ones under plain `android.permission.`.
// The gms-prefixed spellings are kept as well so a future SDK revision that
// switches them back is still covered (a removal marker for a permission
// nobody declares is a harmless no-op in the merger).
export const REMOVED_PERMISSIONS = [
  "com.google.android.gms.permission.AD_ID",
  "android.permission.ACCESS_ADSERVICES_AD_ID",
  "android.permission.ACCESS_ADSERVICES_TOPICS",
  "android.permission.ACCESS_ADSERVICES_ATTRIBUTION",
  "com.google.android.gms.permission.ACCESS_ADSERVICES_AD_ID",
  "com.google.android.gms.permission.ACCESS_ADSERVICES_TOPICS",
  "com.google.android.gms.permission.ACCESS_ADSERVICES_ATTRIBUTION",
];

/** `tools:node="remove"` needs the tools namespace, which Expo's generated
 *  manifest does not necessarily declare. */
function ensureToolsNamespace(manifest) {
  const attrs = manifest.$ || (manifest.$ = {});
  if (attrs["xmlns:tools"]) return;
  attrs["xmlns:tools"] = "http://schemas.android.com/tools";
}

/**
 * Pure transform of the merged AndroidManifest (exported for the unit test):
 * append one `tools:node="remove"` marker per ad permission, so our manifest
 * wins over the AAR's in the merger. Existing entries are kept as-is.
 */
export function modifyManifest(androidManifest, removeAdvertisingId = true) {
  const manifest = androidManifest.manifest;
  if (!manifest || !removeAdvertisingId) return androidManifest;

  const permissions = Array.isArray(manifest["uses-permission"])
    ? manifest["uses-permission"]
    : [];

  // Idempotency: the markers are already in place.
  if (permissions.some((p) => p?.$?.["tools:node"] === "remove")) {
    return androidManifest;
  }

  ensureToolsNamespace(manifest);
  manifest["uses-permission"] = [
    ...permissions,
    ...REMOVED_PERMISSIONS.map((name) => ({
      $: { "android:name": name, "tools:node": "remove" },
    })),
  ];
  return androidManifest;
}

export default function withUnityAds(config, { removeAdvertisingId = true } = {}) {
  return withAndroidManifest(config, (cfg) => {
    cfg.modResults = modifyManifest(cfg.modResults, removeAdvertisingId);
    return cfg;
  });
}