import { withAndroidStyles, withGradleProperties } from "@expo/config-plugins";

/**
 * Android release hygiene (2026-10-03), for the three Play Console
 * warnings raised against 1.0.16:
 *
 *  1. **"Fix DEX code optimization" — Obfuscation 1%.** R8 was off, so the
 *     release shipped unminified. `android.enableMinifyInReleaseBuilds` and
 *     `android.enableShrinkResourcesInReleaseBuilds` are read via
 *     `findProperty(...)` in `android/app/build.gradle`; nothing set them,
 *     so `minifyEnabled` defaulted to false. We set BOTH here.
 *  2. **"Your app uses deprecated APIs or parameters for edge-to-edge."**
 *     The generated `AppTheme` still declares `android:statusBarColor` and
 *     `android:navigationBarColor`. Both were deprecated in API 35 and are
 *     no-ops under enforced edge-to-edge (`edgeToEdgeEnabled=true` is
 *     already in gradle.properties), and Play flags them. We strip the two
 *     items from `res/values/styles.xml`.
 *
 *  `prebuild` regenerates `android/`, so editing those files by hand would
 *  silently come back — this plugin re-applies both fixes on every prebuild,
 *  exactly like `withDebugSigning`.
 *
 *  Idempotent: a re-patch is a no-op. Not unit-tested (the transforms are
 *  file-level string edits against Expo's own output, and the real gate is
 *  the Play Console warning disappearing on the next upload).
 */

const MINIFY_PROPERTIES = [
  ["android.enableMinifyInReleaseBuilds", "R8 minification in release builds"],
  ["android.enableShrinkResourcesInReleaseBuilds", "resource shrinking in release builds"],
];

/** True when the property is already present (with any value). */
function hasProperty(text, key) {
  return new RegExp(`^\\s*${key}\\s*=`, "m").test(text);
}

/** Pure: append the release-hygiene properties if they are not there yet. */
function addMinifyProperties(text) {
  const missing = MINIFY_PROPERTIES.filter(([key]) => !hasProperty(text, key));
  if (missing.length === 0) return text;
  const block = [
    "",
    "// Added by plugins/withAndroidReleaseHygiene.js — Play Console: \"Fix DEX",
    "// code optimization\" (obfuscation was 1% with R8 off).",
    ...missing.map(([key, why]) => `${key}=true  # ${why}`),
    "",
  ].join("\n");
  return text + block;
}

/**
 * The two AppTheme items Play flags as "deprecated APIs or parameters for
 * edge-to-edge": both were deprecated in API 35 and are no-ops once
 * edge-to-edge is enforced (`edgeToEdgeEnabled=true` is already set in
 * gradle.properties, and the app draws its own insets from
 * `useSafeAreaInsets`).
 */
const DEPRECATED_BAR_COLOR_ITEMS = [
  "android:statusBarColor",
  "android:navigationBarColor",
];

module.exports = function withAndroidReleaseHygiene(config) {
  // gradle.properties — NOT app/build.gradle: the flags are read via
  // findProperty(), so they belong in the properties file.
  config = withGradleProperties(config, (cfg) => {
    const items = cfg.modResults;
    for (const [key] of MINIFY_PROPERTIES) {
      if (items.some((i) => i.type === "property" && i.key === key)) continue;
      items.push({ type: "property", key, value: "true" });
    }
    return cfg;
  });

  // AppTheme: drop the two deprecated edge-to-edge color items. This has
  // to go through withAndroidStyles (not a withDangerousMod file write):
  // the android mods run BEFORE Expo finishes writing the generated res
  // files, so a manual write is silently overwritten — verified, the items
  // came straight back. withAndroidStyles runs in the right phase.
  config = withAndroidStyles(config, (cfg) => {
    // modResults is the whole parsed styles.xml; each style is a group with
    // an `items` array. Drop the deprecated bar-color items wherever they
    // appear rather than assuming they sit on AppTheme.
    // xml2js nests the document under <resources>, but handle the bare
    // shape too so the transform does not silently no-op if that changes.
    const styles =
      cfg.modResults?.resources?.style ??
      cfg.modResults?.style ??
      [];
    for (const style of styles) {
      if (!Array.isArray(style?.item)) continue;
      style.item = style.item.filter(
        (entry) => !DEPRECATED_BAR_COLOR_ITEMS.includes(entry?.$?.["name"]),
      );
    }
    return cfg;
  });

  return config;
};

module.exports.addMinifyProperties = addMinifyProperties;
module.exports.MINIFY_PROPERTIES = MINIFY_PROPERTIES;
module.exports.DEPRECATED_BAR_COLOR_ITEMS = DEPRECATED_BAR_COLOR_ITEMS;
