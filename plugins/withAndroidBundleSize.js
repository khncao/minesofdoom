import { withAppBuildGradle } from "@expo/config-plugins";

/**
 * Release AAB size pass (2026-10-05).
 *
 * The 1.0.27 upload measured 72.4 MB, and the breakdown showed the app
 * itself is the small part: the AAB's `BUNDLE-METADATA` carried
 * ~53 MB of native debug symbols (.sym, one per .so per ABI — Play's
 * crash-symbolication input) on top of the 79 MB proguard.map, and
 * `base/lib` carried x86 and x86_64 native libraries that only exist
 * for emulators. The user-facing install is already per-ABI split by
 * Play, so this pass only trims what is uploaded/stored, not what a
 * phone downloads:
 *
 *  1. **Release ABIs: arm64-v8a + armeabi-v7a only.** Real devices.
 *     Dropping x86/x86_64 removes ~45 MB uncompressed of .so (and their
 *     .sym) from the bundle. A release build is no longer installable on
 *     an Intel emulator — internal testing uses real devices or an arm64
 *     emulator, and DEBUG builds are untouched (all ABIs, as before), so
 *     `expo run:android` on any machine still works.
 *
 *  Caveat: the buildType `ndk { abiFilters }` block does NOT reach
 *  CMake's ABI selection — externalNativeBuild (CMakeLists compiles
 *  libfbjni, libappmodules, …) still builds x86/x86_64 and the merge
 *  task pulls those .so into the release bundle regardless. Step 3
 *  closes that gap at package time.
 *  3. **`stripEmulatorAbisRelease` task (appended at project level).**
 *     Deletes the x86/x86_64 directories from
 *     `intermediates/stripped_native_libs/release/stripReleaseDebugSymbols/out/lib`
 *     — the final native-lib set the AAB actually packs (AGP 9's chain
 *     is mergeReleaseNativeLibs → stripReleaseDebugSymbols → bundle; the
 *     older `merged_jni_libs` folder is not the bundle's source here) —
 *     after `stripReleaseDebugSymbols` and before
 *     `bundleLibsToAabRelease` (task-name matched, so an AGP task rename
 *     fails loudly instead of silently shipping the fat bundle). Trims
 *     ~40 MB uncompressed out of the uploaded AAB; the per-device
 *     install is unchanged (Play splits it) and debug builds keep every
 *     ABI.
 *  2. **`debugSymbolLevel 'none'` on release.** No .sym files in the
 *     AAB (~53 MB uncompressed). Trade-off: Play can no longer
 *     symbolicate NATIVE (C++/Hermes) crash stacks; JS stack traces —
 *     what is actually debugged in this app — are unaffected.
 *
 *  The proguard.map stays in the bundle on purpose: it is Play's Java
 *  deobfuscation input, there is no supported AGP flag to remove it, and
 *  stripping it would silently de-obfuscate nothing on every crash
 *  report. (Third-party "delete-mapping" gradle plugins exist but are
 *  not worth a new dependency for a game.)
 *
 *  `prebuild` regenerates `android/`, so the ndk block lives here, not
 *  only in the checked-in gradle (same pattern as withDebugSigning —
 *  the committed file is patched by hand AND stays a fixed point of
 *  this transform, asserted in the unit test).
 *
 *  Coordination with withDebugSigning: that plugin runs FIRST in
 *  prebuild and REWRITES the whole buildTypes{} block from a template
 *  that (as of the 1.0.27 size pass) already carries the ndk block. So
 *  modifyBuildGradle guards the two patches INDEPENDENTLY — the ndk
 *  insertion is skipped whenever a `debugSymbolLevel` is already present
 *  (avoiding a duplicate block that would break withDebugSigning's own
 *  fixed point), and the strip task is appended whenever its marker is
 *  missing. A file patched by this plugin alone must stay a fixed point
 *  of BOTH transforms; the specs assert each direction.
 */

const RELEASE_NDK_BLOCK = `
            // Added by plugins/withAndroidBundleSize.js — release bundle
            // size: real-device ABIs only (x86/x86_64 are emulator-only)
            // and no native debug symbols in BUNDLE-METADATA.
            ndk {
                abiFilters 'arm64-v8a', 'armeabi-v7a'
                debugSymbolLevel 'none'
            }`;

// Appended to the END of build.gradle (project level, outside
// android{}): the post-merge ABI strip. See the module note (step 3)
// on why the buildType ndk block alone cannot keep x86/x86_64 out of
// the AAB.
const STRIP_TASK_BLOCK = `

// Added by plugins/withAndroidBundleSize.js — release bundle size:
// the buildType ndk.abiFilters above does not reach CMake's ABI
// selection, so the emulator-only x86/x86_64 .so's still merge into
// the release bundle. Strip them from the final (symbol-stripped)
// native-lib set after stripReleaseDebugSymbols and before the AAB
// packs. (Play splits installs per device ABI anyway — this trims only
// the uploaded/stored bundle. Debug is untouched.)
def releaseNativeLibs = layout.buildDirectory.dir("intermediates/stripped_native_libs/release/stripReleaseDebugSymbols/out/lib").get().asFile
def stripEmulatorAbisRelease = tasks.register("stripEmulatorAbisRelease") {
    inputs.dir(releaseNativeLibs).optional()
    outputs.upToDateWhen { false }
    doLast {
        ["x86", "x86_64"].each { abi ->
            def d = new File(releaseNativeLibs, abi)
            if (d.directory) { d.deleteDir() }
        }
    }
}
tasks.matching { it.name == "stripReleaseDebugSymbols" }.all {
    it.finalizedBy(stripEmulatorAbisRelease)
}
tasks.matching { it.name == "bundleLibsToAabRelease" }.configureEach {
    it.dependsOn(stripEmulatorAbisRelease)
}`;

/** Index just past the `}` that balances the `{` following `start`. */
function findBalancedBraces(text, start) {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth += 1;
    else if (text[i] === "}") {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  return null;
}

/**
 * Pure, side-effect-free transform: adds the `ndk { ... }` size block to
 * the RELEASE buildType of android/app/build.gradle. Idempotent — a file
 * that already carries a `debugSymbolLevel` is returned unchanged. Named
 * export for unit tests.
 */
export function modifyBuildGradle(src) {
  // Two INDEPENDENT, individually guarded patches (prebuild runs
  // withDebugSigning first, whose buildTypes template already carries
  // the ndk block — so each patch must detect the other plugin's work
  // instead of assuming a pristine file):
  const needsNdkBlock = !src.includes("debugSymbolLevel");
  const needsStripTask = !src.includes("stripEmulatorAbisRelease");
  if (!needsNdkBlock && !needsStripTask) return src;

  const btIdx = src.indexOf("buildTypes {");
  if (btIdx === -1) {
    throw new Error(
      "withAndroidBundleSize: no buildTypes { block found in android/app/build.gradle",
    );
  }
  const btEnd = findBalancedBraces(src, src.indexOf("{", btIdx));
  if (btEnd === null) {
    throw new Error("withAndroidBundleSize: unbalanced buildTypes {} block");
  }

  // The release sub-block, searched INSIDE buildTypes so a "release"
  // token elsewhere (signingConfigs) cannot be the anchor.
  const relIdx = src.indexOf("release {", btIdx);
  if (relIdx === -1 || relIdx >= btEnd) {
    throw new Error(
      "withAndroidBundleSize: no release { buildType found inside buildTypes",
    );
  }
  const relEnd = findBalancedBraces(src, src.indexOf("{", relIdx));
  if (relEnd === null) {
    throw new Error("withAndroidBundleSize: unbalanced release {} block");
  }

  let out = src;

  // The ndk block inserts before the release block's closing brace
  // (line-aligned); the original "        }" line is kept verbatim after
  // the block. Skipped when withDebugSigning's template already provided
  // it (a double ndk block would not be a fixed point of its transform).
  if (needsNdkBlock) {
    const closeLineStart = src.lastIndexOf("\n", relEnd - 1) + 1;
    out =
      src.slice(0, closeLineStart) + RELEASE_NDK_BLOCK + "\n" + src.slice(closeLineStart);
  }

  // The strip task lands at PROJECT level (outside android{}), so it is
  // appended to the end of the file, past the dependencies{} close.
  if (needsStripTask) {
    out = out.replace(/\s*$/, "") + STRIP_TASK_BLOCK + "\n";
  }
  return out;
}

export default function withAndroidBundleSize(config) {
  return withAppBuildGradle(config, (c) => {
    if (c.modResults.language !== "groovy") {
      throw new Error(
        "withAndroidBundleSize: expected android/app/build.gradle (groovy), got " +
          c.modResults.language,
      );
    }
    c.modResults.contents = modifyBuildGradle(c.modResults.contents);
    return c;
  });
}
