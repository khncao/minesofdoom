import { ExpoConfig, ConfigContext } from "expo/config";

// Icon source image, kept OUT of public/ so the static web export doesn't
// copy it into the deploy (it was a 988KB dead weight on every page load;
// only the icon/splash prebuild plugin + web favicon generation read it).
const pickaxePng = "./app-icons/logo.jpg";

// Unity Ads has nothing to bake into the native manifests (the Game ID and
// placement ids are passed to the SDK from JS — modules/unity-ads), but the
// AD_ID posture does need a build-time mirror: the Unity AAR declares the ad
// id permissions and the kid-safe posture (storeConfig.unityAds
// .stripAdvertisingId) removes them again at prebuild. The runtime's single
// source of truth is src/mines_of_doom/storeConfig.ts; it is repeated here
// ONLY because the Expo config loader can't import TS modules (plain node
// require). A test in src/mines_of_doom/__test__/storeConfig.test.ts pins
// the two together so they can't drift.
const unityAdsManifestOptions = {
  // true (ship posture, 2026-10-01): no advertising ID, at all. Flip to false
  // ONLY together with storeConfig.unityAds.childDirectedTreatment and the
  // target-audience stance — they are one decision (docs/blockers.md).
  removeAdvertisingId: true,
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
  version: "1.0.11",
  android: {
    // NO ad-id permissions: the Unity Ads AAR declares
    // com.google.android.gms.permission.AD_ID (+ ACCESS_ADSERVICES_*), and
    // ./plugins/withUnityAds below strips them from the merged manifest
    // (kid-safe posture — children must not be sent the advertising ID).
    versionCode: 11,
    adaptiveIcon: {
      foregroundImage: pickaxePng,
      backgroundColor: "#ffffff",
    },
    package: "com.minus4kelvin.minesofdoom",
  },
  orientation: "portrait",
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
    // Rewarded ads run on Unity Ads (modules/unity-ads): nothing to inject
    // into the manifest except the ad-id removal above.
    ["./plugins/withUnityAds", unityAdsManifestOptions],
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
