import { ExpoConfig, ConfigContext } from "expo/config";

const pickaxePng = "./public/assets/logo.jpg";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "minesofdoom",
  slug: "minesofdoom",
  scheme: "com.minus4kelvin.minesofdoom",
  version: "1.0.7",
  android: {
    versionCode: 7,
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
    bundler: "metro",
    output: "static",
  },
  plugins: [["expo-router", { root: "apps" }]],
  // Let Metro honor the tsconfig.json "paths" mapping (assets/* ->
  // dist/assets/*), otherwise "assets/index" imports don't resolve.
  experiments: {
    tsconfigPaths: true,
  },
});
