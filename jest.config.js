module.exports = {
  preset: "jest-expo",
  testMatch: ["**/*.test.[jt]s?(x)"],
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  // Metro (via Expo's tsconfig-paths support) resolves bare `apps/*`
  // specifiers; map the same here so test files can import the same way.
  moduleNameMapper: {
    "^apps/(.*)$": "<rootDir>/apps/$1",
  },
};
