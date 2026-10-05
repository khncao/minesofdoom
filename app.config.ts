import { ExpoConfig, ConfigContext } from "expo/config";

// Icon source image, kept OUT of public/ so the static web export doesn't
// copy it into the deploy (it was a 988KB dead weight on every page load;
// only the icon/splash prebuild plugin + web favicon generation read it).
const pickaxePng = "./app-icons/logo.jpg";

// AdMob has no config passed from JS (unlike Unity's Game ID): GMA's
// MobileAds.initialize takes no app-id argument, so the App ID must be baked
// into the merged manifest — and the ad-id posture needs a build-time mirror
// so the GMA AAR's AD_ID permissions are stripped again at prebuild. The
// runtime source of truth is src/mines_of_doom/storeConfig.ts; it is
// repeated here ONLY because the Expo config loader can't import TS modules
// (plain node require). A test in
// src/mines_of_doom/__test__/storeConfig.test.ts pins the two together so
// they can't drift.
const adMobManifestOptions = {
  // true (ship posture, 2026-10-03): no advertising ID, at all. Flip to
  // false ONLY together with storeConfig.adMob.childDirectedTreatment and
  // the target-audience stance — they are one decision (docs/blockers.md).
  removeAdvertisingId: true,
  // The AdMob App ID. EMPTY = unset, and the plugin then writes NO
  // APPLICATION_ID meta-data at all, so the repo's "empty config = hidden"
  // rule also keeps the App ID out of the APK.
  appId: "ca-app-pub-2101316086878618~4973124022",
};

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  // Display name. The checked-in android/ strings.xml was updated in step
  // (2026-09-07) and the Play Console en-US listing title matches — both
  // track this value. A future `expo prebuild` regenerates the same label
  // from here; the two build.gradle patches (debuggableVariants, upload-key
  // signing) are re-applied automatically by the
  // ./plugins/androidPrebuildPatches config plugin below.
  name: "Mines of Idle Doomath",
  slug: "minesofdoom",
  scheme: "com.minus4kelvin.minesofdoom",
  // 1.0.15 / vc 15 — native ads on AdMob rewarded INTERSTITIAL. 1.0.12
  // (vc 12, Unity rewarded) and 1.0.14 (vc 14, Unity interstitial) both
  // FAILED on device: real ads with no skip and no way to close. 1.0.13
  // (vc 13) was the ad-free fallback and stays the ship-now option. A plain
  // AdMob REWARDED unit cannot be closed in 5 s (the v1.0.10 rejection);
  // the rewarded INTERSTITIAL format only serves skippable ads, which is
  // what Google's own guidance points at. Privacy policy v2.7 matches.
  // **MUST be verified on device before production.**
  version: "1.0.27",
  android: {
    // NO ad-id permissions: the AdMob (GMA) AAR declares
    // com.google.android.gms.permission.AD_ID (+ ACCESS_ADSERVICES_*), and
    // ./plugins/withAdMobAds below strips them from the merged manifest
    // (kid-safe posture — children must not be sent the advertising ID).
    versionCode: 27,
    adaptiveIcon: {
      foregroundImage: pickaxePng,
      backgroundColor: "#ffffff",
    },
    package: "com.minus4kelvin.minesofdoom",
  },
  // NO orientation lock. Play's large-screen requirement (raised against
  // 1.0.16): a fixed `portrait` screenOrientation blocks tablets,
  // foldables and desktop windows. The layout already handles it —
  // `styles.contentColumn` is width-capped at 640 and centered (the
  // "tablet/wide fix"), and edge-to-edge insets are applied via
  // `useSafeAreaInsets`, so the game centers and the depth banner/footer
  // stay clear of the system bars in any orientation.
  icon: pickaxePng,
  userInterfaceStyle: "dark",
  assetBundlePatterns: ["**/*"],
  ios: {
    supportsTablet: true,
  },
  web: {
    favicon: pickaxePng,
    // Document title + PWA/browser description. (web.name defaults to the
    // outer "name" — the lowercase package slug — so set the display title
    // explicitly; the exported index.html previously had an empty <title>.)
    name: "Mines of Idle Doomath",
    description:
      "Mines of Idle Doomath — an idle math-mining game. Solve equations, earn minerals, buy miners, sink new shafts.",
    bundler: "metro",
    output: "static",
  },
  // ONLY route files live under src/app — everything else in src/ is plain
  // source. (Previously the router root was the whole apps/ source tree, so
  // the static export emitted an HTML page per source file, incl. tests.)
  plugins: [
    ["expo-router", { root: "src/app" }],
    // Re-applies the local android/app/build.gradle patches (debuggableVariants = []
    // + Play upload-key signing) that `expo prebuild` wipes. See the plugin's header.
    "./plugins/withDebugSigning",
    // Play release hygiene: turn R8 minify + resource shrinking ON
    // (obfuscation was 1% with them off) and drop the deprecated
    // statusBarColor/navigationBarColor items from AppTheme, which Play
    // flags as "deprecated APIs or parameters for edge-to-edge". Both are
    // re-applied on every prebuild because it regenerates `android/`.
    "./plugins/withAndroidReleaseHygiene",
    // Rewarded ads run on AdMob rewarded INTERSTITIAL (modules/admob-ads):
    // injects the App ID into the merged manifest and strips the ad-id
    // permissions the GMA AAR merges in.
    ["./plugins/withAdMobAds", adMobManifestOptions],
    // SDK 57 dropped the top-level `splash` key from the config schema; the
    // splash screen is now configured through the expo-splash-screen plugin.
    [
      "expo-splash-screen",
      {
        image: pickaxePng,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
      },
    ],
  ],
  // Let Metro honor the tsconfig.json "paths" mapping (assets/* ->
  // dist/assets/*), otherwise "assets/index" imports don't resolve.
  experiments: {
    tsconfigPaths: true,
    // Hosted on Cloudflare Pages (static export served at the domain root),
    // so no baseUrl — asset URLs are emitted relative to "/".
  },
});
