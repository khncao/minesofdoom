const fs = require("fs");
const path = require("path");
const { modifyBuildGradle } = require("../withDebugSigning");

// A faithful reconstruction of the parts of android/app/build.gradle that
// `expo prebuild` generates from the RN/Expo SDK 57 template (before our
// patches). Only the regions the plugin touches — not the full file — so the
// test stays readable and focused on the transform logic.
const PRISTINE = [
  "react {",
  "    /* Variants */",
  "    //   If you add flavors like lite, prod, etc. you'll have to list your debuggableVariants.",
  '    // debuggableVariants = ["liteDebug", "prodDebug"]',
  "",
  "    /* Bundling */",
  "    autolinkLibrariesWithApp()",
  "}",
  "",
  "android {",
  "    namespace 'com.minus4kelvin.minesofdoom'",
  "    defaultConfig {",
  "        applicationId 'com.minus4kelvin.minesofdoom'",
  "    }",
  "    signingConfigs {",
  "        debug {",
  "            storeFile file('debug.keystore')",
  "            storePassword 'android'",
  "            keyAlias 'androiddebugkey'",
  "            keyPassword 'android'",
  "        }",
  "    }",
  "    buildTypes {",
  "        debug {",
  "            signingConfig signingConfigs.debug",
  "        }",
  "        release {",
  "            // Caution! In production, you need to generate your own keystore file.",
  "            // see https://reactnative.dev/docs/signed-apk-android.",
  "            signingConfig signingConfigs.debug",
  "            def enableShrinkResources = findProperty('android.enableShrinkResourcesInReleaseBuilds') ?: 'false'",
  "            shrinkResources enableShrinkResources.toBoolean()",
  "            minifyEnabled enableMinifyInReleaseBuilds",
  '            proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"',
  "            def enablePngCrunchInRelease = findProperty('android.enablePngCrunchInReleaseBuilds') ?: 'true'",
  "            crunchPngs enablePngCrunchInRelease.toBoolean()",
  "        }",
  "    }",
  "}",
].join("\n");

// Grab the balanced `{ ... }` block that starts at `marker` (e.g. "buildTypes {").
function blockOf(src, marker) {
  const i = src.indexOf(marker);
  if (i === -1) return null;
  let depth = 0;
  for (let j = src.indexOf("{", i); j < src.length; j++) {
    if (src[j] === "{") depth += 1;
    else if (src[j] === "}") {
      depth -= 1;
      if (depth === 0) return src.slice(i, j + 1);
    }
  }
  return null;
}

const lines = (src) => src.split("\n");
const activeDvLines = (src) => lines(src).filter((l) => l.trim() === "debuggableVariants = []");

describe("withDebugSigning.modifyBuildGradle", () => {
  test("patch 1: adds exactly one active `debuggableVariants = []`", () => {
    const out = modifyBuildGradle(PRISTINE);
    expect(activeDvLines(out)).toHaveLength(1);
  });

  test("patch 2a: loads ../keystore.properties before signingConfigs", () => {
    const out = modifyBuildGradle(PRISTINE);
    expect(out).toContain("def keystorePropertiesFile = rootProject.file('../keystore.properties')");
    expect(out).toContain("def keystoreProperties = new Properties()");
    expect(out.indexOf("keystorePropertiesFile")).toBeLessThan(out.indexOf("signingConfigs {"));
  });

  test("patch 2b: adds the release (upload-key) signingConfig inside signingConfigs", () => {
    const out = modifyBuildGradle(PRISTINE);
    const sc = blockOf(out, "signingConfigs {");
    expect(sc).not.toBeNull();
    expect(sc).toContain("debug {");
    expect(sc).toContain("release {");
    expect(sc).toContain("storeFile rootProject.file('../my-upload-key.keystore')");
  });

  test("patch 2c: both buildTypes sign with the upload key, template lines preserved", () => {
    const out = modifyBuildGradle(PRISTINE);
    const bt = blockOf(out, "buildTypes {");
    expect(bt).not.toBeNull();
    // debug + release each carry the conditional signing form
    expect((bt.match(/keystorePropertiesFile\.exists\(\)/g) || []).length).toBe(2);
    expect(bt).toContain("signingConfig signingConfigs.release");
    // SDK template shrink/minify/proguard/crunch lines preserved verbatim
    expect(bt).toContain("minifyEnabled enableMinifyInReleaseBuilds");
    expect(bt).toContain("crunchPngs enablePngCrunchInRelease.toBoolean()");
  });

  test("is idempotent (second run is a no-op)", () => {
    const once = modifyBuildGradle(PRISTINE);
    expect(modifyBuildGradle(once)).toBe(once);
  });

  test("is a fixed point on the committed android/app/build.gradle (no git churn)", () => {
    const file = path.join(__dirname, "..", "..", "android", "app", "build.gradle");
    const src = fs.readFileSync(file, "utf8");
    expect(modifyBuildGradle(src)).toBe(src);
  });
});
