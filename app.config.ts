import { ExpoConfig, ConfigContext } from "expo/config";

const pickaxePng = "./public/assets/logo.jpg";

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
  splash: {
    image: pickaxePng,
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
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
  plugins: [["expo-router", { root: "src/app" }]],
  // Let Metro honor the tsconfig.json "paths" mapping (assets/* ->
  // dist/assets/*), otherwise "assets/index" imports don't resolve.
  experiments: {
    tsconfigPaths: true,
  },
});
