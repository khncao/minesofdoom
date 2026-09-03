import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginReactConfig from "eslint-plugin-react/configs/recommended.js";
import reactHooks from "eslint-plugin-react-hooks";


export default [
  {
    // Build artifacts and generated bundles are not source; never lint them.
    ignores: [
      "dist/**",
      "public/assets/**",
      "node_modules/**",
      ".expo/**",
      "android/**",
      "ios/**",
      ".idea/**",
      ".vscode/**",
    ],
  },
  {languageOptions: { globals: { ...globals.browser, ...globals.node } }},
  {settings: { react: { version: "18.3" } }},
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  pluginReactConfig,
  {
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      "react/jsx-uses-react": "off",
      "react/react-in-jsx-scope": "off",
      "@/no-unused-vars": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      ...reactHooks.configs.recommended.rules
    },
  },
  {
    // CJS config files legitimately use require. Must come last so it
    // wins over the rules in tseslint.configs.recommended above.
    files: ["**/*.config.js"],
    rules: { "@typescript-eslint/no-var-requires": "off" },
  },
  {
    // The pb_hooks jest suite runs plain CommonJS; give it the test globals.
    files: ["pb_hooks/__test__/**/*.js"],
    languageOptions: { globals: { ...globals.jest } },
  },
  {
    // Pocketbase v0.4x JS-hook runtime bindings (pb_hooks/ — see
    // pocketbase/pocketbase plugins/jsvm in v0.40.x). require/module/
    // process are already covered by the globals.node block above.
    files: ["pb_hooks/**/*.js"],
    ignores: ["pb_hooks/__test__/**"],
    rules: {
      // Plain CommonJS by design — this folder ships as-is to a Pocketbase
      // hook runtime that has no ESM.
      "@typescript-eslint/no-var-requires": "off",
    },
    languageOptions: {
      globals: {
        $app: "readonly",
        $http: "readonly",
        $security: "readonly",
        $template: "readonly",
        routerAdd: "readonly",
        routerUse: "readonly",
        onBootstrap: "readonly",
        __hooks: "readonly",
        Record: "readonly",
        Collection: "readonly",
        FieldsList: "readonly",
        Field: "readonly",
        arrayOf: "readonly",
      },
    },
  }
];