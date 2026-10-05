const fs = require("fs");
const path = require("path");
const { modifyBuildGradle } = require("../withAndroidBundleSize");

// A faithful reconstruction of the buildTypes region that `expo prebuild`
// generates from the RN/Expo SDK 57 template (before this plugin runs) —
// including the withDebugSigning signing patches, since that plugin runs
// first and its output is what a real prebuild sees.
const PRISTINE = [
  "android {",
  "    signingConfigs {",
  "        debug {",
  "            storeFile file('debug.keystore')",
  "        }",
  "        release {",
  "            storeFile rootProject.file('../my-upload-key.keystore')",
  "        }",
  "    }",
  "    buildTypes {",
  "        debug {",
  "            signingConfig signingConfigs.debug",
  "        }",
  "        release {",
  "            if (keystorePropertiesFile.exists()) {",
  "                signingConfig signingConfigs.release",
  "            } else {",
  "                signingConfig signingConfigs.debug",
  "            }",
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

// Grab the balanced `{ ... }` block that starts at `marker`.
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

describe("withAndroidBundleSize.modifyBuildGradle", () => {
  test("adds the ndk size block inside the RELEASE buildType only", () => {
    const out = modifyBuildGradle(PRISTINE);
    const release = blockOf(out, "buildTypes {").match(
      /release \{[\s\S]*?\n        \}/,
    );
    expect(release).not.toBeNull();
    expect(release[0]).toContain("abiFilters 'arm64-v8a', 'armeabi-v7a'");
    expect(release[0]).toContain("debugSymbolLevel 'none'");
    // The debug buildType is untouched: emulators (x86_64, all ABIs) and
    // native crash symbols stay available for development builds.
    const bt = blockOf(out, "buildTypes {");
    const debugBlock = bt.slice(0, bt.indexOf("release {"));
    expect(debugBlock).not.toContain("ndk {");
    expect(debugBlock).not.toContain("abiFilters");
  });

  test("does not anchor on the release block of signingConfigs", () => {
    // signingConfigs' release { appears BEFORE buildTypes in the file;
    // the ndk block must land in buildTypes.release, not there.
    const out = modifyBuildGradle(PRISTINE);
    const sc = blockOf(out, "signingConfigs {");
    expect(sc).not.toContain("ndk {");
    expect(sc).not.toContain("abiFilters");
  });

  test("appends the stripEmulatorAbisRelease task at project level",
    () => {
      // The buildType ndk block alone does not keep x86/x86_64 out of
      // the AAB (CMake's ABI selection bypasses it), so the transform
      // must also register the strip task at PROJECT level (outside
      // android{}), targeting the final stripped native-lib set and
      // wired before bundleLibsToAabRelease.
      const out = modifyBuildGradle(PRISTINE);
      expect(out).toContain("stripEmulatorAbisRelease");
      expect(out).toContain(
        'intermediates/stripped_native_libs/release/stripReleaseDebugSymbols/out/lib',
      );
      expect(out).toContain(
        'tasks.matching { it.name == "bundleLibsToAabRelease" }',
      );
      expect(out).toContain('tasks.matching { it.name == "stripReleaseDebugSymbols" }');
      // Project level: after the android{} block's close, not inside it.
      const androidBlock = blockOf(out, "android {");
      expect(androidBlock).not.toContain("stripEmulatorAbisRelease");
      // And exactly once (a double run must not append a second copy).
      expect(out.split("stripEmulatorAbisRelease = tasks.register").length - 1).toBe(1);
    });

  test("is idempotent (second run is a no-op)", () => {
    const once = modifyBuildGradle(PRISTINE);
    expect(modifyBuildGradle(once)).toBe(once);
  });

  test("does not duplicate the ndk block when withDebugSigning ran first (prebuild order)", () => {
    // Real prebuild order: withDebugSigning rewrites buildTypes{} from a
    // template that already carries the ndk block. This transform must
    // then append ONLY the strip task — and the result must be a fixed
    // point of BOTH plugins (no git churn from either one).
    const { modifyBuildGradle: withDebugSigning } = require("../withDebugSigning");
    // withDebugSigning also patches the react{} block (debuggableVariants);
    // give it that header so it runs as it does in a real prebuild.
    const withReact = [
      "react {",
      "    //   If you add flavors like lite, prod, etc. you'll have to list your debuggableVariants.",
      '    // debuggableVariants = ["liteDebug", "prodDebug"]',
      "",
      "    /* Bundling */",
      "    autolinkLibrariesWithApp()",
      "}",
      "",
    ].join("\n") + PRISTINE;
    const afterSigning = withDebugSigning(withReact);
    const out = modifyBuildGradle(afterSigning);
    expect(out.split("debugSymbolLevel").length - 1).toBe(1);
    expect(out).toContain("stripEmulatorAbisRelease");
    expect(modifyBuildGradle(out)).toBe(out);
    expect(withDebugSigning(out)).toBe(out);
  });

  test("is a fixed point on the committed android/app/build.gradle (no git churn)", () => {
    const file = path.join(__dirname, "..", "..", "android", "app", "build.gradle");
    const src = fs.readFileSync(file, "utf8");
    expect(modifyBuildGradle(src)).toBe(src);
  });

  test("throws when buildTypes or the release buildType is missing", () => {
    expect(() => modifyBuildGradle("android {\n}\n")).toThrow(
      /no buildTypes/,
    );
    const noRelease =
      "android {\n    buildTypes {\n        debug {\n        }\n    }\n}\n";
    expect(() => modifyBuildGradle(noRelease)).toThrow(/no release \{/);
  });
});
