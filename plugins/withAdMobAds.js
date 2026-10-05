import { withAndroidManifest } from "@expo/config-plugins";

/**
 * Native manifest patch for the AdMob rewarded-INTERSTITIAL switch (2026-10-03).
 *
 * Two jobs, both driven by ONE options object from app.config.ts:
 *
 * 1. **The App ID.** GMA has no `initialize(context, appId)` overload — the
 *    App ID is read from the merged manifest's
 *    `com.google.android.gms.ads.APPLICATION_ID` meta-data. So unlike Unity
 *    (where the Game ID travelled as a function argument) it MUST be baked
 *    in at prebuild. An EMPTY appId writes nothing, which keeps the
 *    repo's "empty config = hidden" rule honest: no App ID in the merged
 *    manifest means MobileAds.initialize has nothing to read and no ad
 *    request can go out.
 *
 * 2. **The advertising id.** The GMA AAR declares
 *    `<uses-permission android:name="com.google.android.gms.permission.AD_ID" />`
 *    (plus `ACCESS_ADSERVICES_*`). With the kid-safe posture (child-directed
 *    treatment on, contextual-only demand — guardrail 6, plus the Play
 *    Families rule that an app serving children must not transmit the
 *    advertising ID), no ad code may read the AAID at all. Removing the
 *    permission makes that structurally impossible instead of merely
 *    policy-flagged — exactly the option AdMob's own Families doc
 *    suggests ("You can also choose to disable the advertising ID for your
 *    entire app by preventing the advertising ID permission from being
 *    merged into your app"). The three `ACCESS_ADSERVICES_*` permissions go
 *    with it: they exist only so an ad SDK can read the ad id.
 *
 * Idempotent (a re-patch is a no-op) and driven by ONE flag,
 * `storeConfig.adMob.stripAdvertisingId` mirrored in app.config.ts (pinned
 * together by src/mines_of_doom/__test__/storeConfig.test.ts). Flipping it
 * to `false` restores the permissions — do that only together with
 * flipping `childDirectedTreatment` off and a non-children target
 * audience, since the two are one decision.
 *
 * Unit-tested in plugins/__test__/withAdMobAds.test.js.
 */

/** GMA reads this meta-data key; it must match exactly. */
export const APPLICATION_ID_KEY = "com.google.android.gms.ads.APPLICATION_ID";

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
 * remove one `tools:node="remove"` marker per ad permission so our manifest
 * wins over the AAR's in the merger, and inject the App ID meta-data when
 * one is configured. Existing entries are kept as-is.
 */
export function modifyManifest(
  androidManifest,
  { removeAdvertisingId = true, appId = "" } = {},
) {
  const manifest = androidManifest.manifest;
  if (!manifest) return androidManifest;

  if (removeAdvertisingId) {
    const permissions = Array.isArray(manifest["uses-permission"])
      ? manifest["uses-permission"]
      : [];
    // Idempotency: the markers are already in place.
    if (!permissions.some((p) => p?.$?.["tools:node"] === "remove")) {
      ensureToolsNamespace(manifest);
      manifest["uses-permission"] = [
        ...permissions,
        ...REMOVED_PERMISSIONS.map((name) => ({
          $: { "android:name": name, "tools:node": "remove" },
        })),
      ];
    }
  }

  // The App ID. Empty → write nothing (the "empty = hidden" rule).
  if (appId.length > 0) {
    const application = Array.isArray(manifest.application)
      ? manifest.application
      : manifest.application
        ? [manifest.application]
        : [];
    // The <application> element is the FIRST one and carries its own
    // android:name (".MainApplication"), NOT the literal "application" —
    // matching on the name would miss it and append a SECOND <application>,
    // which the Android bundler rejects ("At most one element <application>
    // … was expected, but 2 were found"). Positional lookup only.
    const target = application[0];
    if (target) {
      const metaData = Array.isArray(target["meta-data"])
        ? target["meta-data"]
        : [];
      // Idempotency: drop any previous copy, then append the current one.
      target["meta-data"] = [
        ...metaData.filter(
          (m) => m?.$?.["android:name"] !== APPLICATION_ID_KEY,
        ),
        {
          $: { "android:name": APPLICATION_ID_KEY, "android:value": appId },
        },
      ];
    }
  }

  return androidManifest;
}

export default function withAdMobAds(
  config,
  { removeAdvertisingId = true, appId = "" } = {},
) {
  return withAndroidManifest(config, (cfg) => {
    cfg.modResults = modifyManifest(cfg.modResults, {
      removeAdvertisingId,
      appId,
    });
    return cfg;
  });
}
