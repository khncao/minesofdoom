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

module.exports = config;
