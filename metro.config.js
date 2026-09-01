const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Prevent Metro from watching the android build/gradle directories on Windows
config.watchFolders = [__dirname];
config.resolver.blockList = [
  /android\/.gradle\/.*/,
  /android\/build\/.*/,
  /android\/app\/build\/.*/,
];

// Source imports use "assets/*" (see tsconfig.json paths); Metro has no
// tsconfig-paths support here, so map the bare "assets" module to the
// source asset folder directly.
config.resolver.extraNodeModules = {
  assets: path.join(__dirname, "public", "assets"),
};

module.exports = config;
