import { ExpoConfig, ConfigContext } from "expo/config";

const pickaxePng = "./public/assets/logo.jpg";

// AdMob App ids for the react-native-google-mobile-ads config plugin, which
// bakes them into the native manifests at `expo prebuild` (the v16 SDK reads
// them from the manifest — MobileAds().initialize() takes no arguments).
// The runtime's single source of truth is
// src/mines_of_doom/storeConfig.ts; they are repeated here ONLY because the
// Expo config loader can't import TS modules (plain node require). A test
// in src/mines_of_doom/__test__/storeConfig.test.ts pins the two together
// so they can't drift. Fill storeConfig.ts AND this block, then prebuild.
// Empty = omitted from the native manifests — the plugin then only sets
// the lazy-init manifest flags and logs a "no appId" warning at prebuild,
// which is expected and harmless for a platform whose id hasn't landed yet
// (the iOS App ID is still empty).
const adMobAppIds = {
  androidAppId: "ca-app-pub-2101316086878618~4973124022",
  iosAppId: "",
};

const googleMobileAdsPluginOptions = {
  ...(adMobAppIds.androidAppId
    ? { androidAppId: adMobAppIds.androidAppId }
    : {}),
  ...(adMobAppIds.iosAppId ? { iosAppId: adMobAppIds.iosAppId } : {}),
  // Delay SDK init until the first ad load (recommended; this app only
  // shows ads on explicit "watch" taps — guardrail 2).
  optimizeInitialization: true,
};

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "minesofdoom",
  slug: "minesofdoom",
  scheme: "com.minus4kelvin.minesofdoom",
  version: "1.0.8",
  android: {
    versionCode: 8,
    adaptiveIcon: {
      foregroundImage: pickaxePng,
      backgroundColor: "#ffffff",
    },
    package: "com.minus4kelvin.minesofdoom",
  },
  orientation: "portrait",
  icon: pickaxePng,
  userInterfaceStyle: "light",
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
      "Mines of Doom — an idle math-mining game. Solve equations, earn minerals, buy miners, sink new shafts.",
    bundler: "metro",
    output: "static",
  },
  // ONLY route files live under src/app — everything else in src/ is plain
  // source. (Previously the router root was the whole apps/ source tree, so
  // the static export emitted an HTML page per source file, incl. tests.)
  plugins: [
    ["expo-router", { root: "src/app" }],
    ["react-native-google-mobile-ads", googleMobileAdsPluginOptions],
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
  },
});
