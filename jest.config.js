module.exports = {
  preset: "jest-expo",
  testMatch: ["**/*.test.[jt]s?(x)"],
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  // Metro (via Expo's tsconfig-paths support) resolves bare `src/*`
  // specifiers; map the same here so test files can import the same way.
  moduleNameMapper: {
    "^src/(.*)$": "<rootDir>/src/$1",
    // Local Expo native modules (modules/unity-ads) — same alias as
    // tsconfig.json paths / Metro's tsconfigPaths support.
    "^modules/(.*)$": "<rootDir>/modules/$1",
  },
};
