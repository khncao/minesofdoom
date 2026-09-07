import { withAppBuildGradle } from "@expo/config-plugins";

/**
 * Re-apply the two local patches to android/app/build.gradle that `expo prebuild`
 * wipes because the file is regenerated from the Expo/RN template. Runs on every
 * prebuild via the `plugins` array in app.config.ts, and is idempotent (running
 * it on an already-patched file is a no-op) so a repeat prebuild can't churn it.
 *
 * The two patches (both documented in AGENTS.md → "Gotchas"):
 *
 *   1. `react { }` — `debuggableVariants = []`. An empty list means the debug
 *      variant is NOT skipped for JS bundling, so a debug APK embeds
 *      assets/index.android.bundle and boots standalone on an emulator without a
 *      Metro dev server. This is what makes the e2e emulator flow work; without
 *      it a debug APK shows the red box "Unable to load script".
 *
 *   2. `android { }` — Play Console upload-key signing. Loads ../keystore.properties
 *      (root of the repo, gitignored, holds storePassword/keyAlias/keyPassword —
 *      NO storeFile) and, when the file exists, signs BOTH the debug and release
 *      buildTypes with the upload key (../my-upload-key.keystore, also gitignored).
 *      Fallback to the debug signature when the props file is absent keeps local
 *      smoke builds working.
 *
 * The exact canonical text below is the committed state of
 * android/app/build.gradle — the goal is for `expo prebuild` + this plugin to
 * reproduce it byte-for-byte.
 */

// Byte-exact region texts (copied from the committed android/app/build.gradle so
// the plugin output matches it exactly → no git churn). Keep these in sync if the
// committed file's comments are ever reworded.

// Patch 1 — react block. The RN/Expo template ships only a *commented-out*
// `// debuggableVariants = ["liteDebug", "prodDebug"]` line; we add the active
// assignment right after it.
const DV_BLOCK = [
  "    // MARK (local patch, re-apply after every expo prebuild — AGENTS.md):",
  "    // empty list = the debug variant is NOT skipped for bundling, so a debug",
  "    // APK embeds assets/index.android.bundle and boots standalone on an",
  "    // emulator without a Metro dev server (the e2e flow needs this; without",
  '    // it a debug APK shows the red box "Unable to load script").',
  "    debuggableVariants = []",
].join("\n");

// Patch 2 — inserted immediately before the `signingConfigs {` block.
const KEYS_PROPS_BLOCK = [
  "    // Release (upload) signing for Play Console. The upload keystore and its",
  "    // properties NEVER get committed and live at the PROJECT ROOT (not under",
  "    // android/ — `expo prebuild` wipes that directory): my-upload-key.keystore",
  "    // + keystore.properties (both gitignored). Re-download the JKS from the",
  "    // Play Console App-signing page if lost. See docs/store-integration.md §2.5.",
  "    // Re-apply this block after every `expo prebuild`.",
  "    def keystorePropertiesFile = rootProject.file('../keystore.properties')",
  "    def keystoreProperties = new Properties()",
  "    if (keystorePropertiesFile.exists()) {",
  "        keystoreProperties.load(new FileInputStream(keystorePropertiesFile))",
  "    }",
].join("\n");

// Patch 2 — the release (upload-key) signingConfig, inserted inside the existing
// `signingConfigs { }` block after the template's `debug { }` sub-config.
const KEYS_RELEASE_CONFIG = [
  "        if (keystorePropertiesFile.exists()) {",
  "            release {",
  "                storeFile rootProject.file('../my-upload-key.keystore')",
  "                storePassword keystoreProperties['storePassword']",
  "                keyAlias keystoreProperties['keyAlias']",
  "                keyPassword keystoreProperties['keyPassword']",
  "            }",
  "        }",
].join("\n");

// Patch 2 — the whole `buildTypes { }` block, replaced wholesale so both
// buildTypes sign with the upload key when ../keystore.properties is present. The
// shrink/minify/proguard/crunch lines are the SDK 57 template defaults kept
// verbatim (they are NOT part of the patch but are needed to reproduce the
// committed block exactly).
const BUILDTYPES_BLOCK = [
  "    buildTypes {",
  "        debug {",
  "            if (keystorePropertiesFile.exists()) {",
  "                signingConfig signingConfigs.release",
  "            } else {",
  "                signingConfig signingConfigs.debug",
  "            }",
  "        }",
  "        release {",
  "            // Play Console upload key when ../keystore.properties is present;",
  "            // otherwise the debug signature (a keyless release build is for",
  "            // local smoke tests only — Play rejects debug-signed AABs, so it",
  "            // can never be the one that ships).",
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
].join("\n");

// Given the index of an opening `{`, return the index just past the matching
// close brace (naive depth count — safe here because none of these gradle blocks
// contain `{`/`}` inside strings or comments).
function findBalancedBraces(text, openIdx) {
  if (text[openIdx] !== "{") return null;
  let depth = 0;
  for (let i = openIdx; i < text.length; i++) {
    if (text[i] === "{") depth += 1;
    else if (text[i] === "}") {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  return null;
}

// Replace the balanced `{ ... }` block that begins at `marker` (e.g. "buildTypes {")
// with `replacement` (which must itself start at `marker` and end at the block's
// closing `}`). Replaces from the start of marker's line so `replacement`'s own
// leading indentation wins. Returns the input unchanged if marker is missing/unbalanced.
function replaceBalancedBlock(text, marker, replacement) {
  const markerIdx = text.indexOf(marker);
  if (markerIdx === -1) return text;
  const openIdx = text.indexOf("{", markerIdx);
  if (openIdx === -1) return text;
  const blockEnd = findBalancedBraces(text, openIdx);
  if (blockEnd === null) return text;
  const lineStart = text.lastIndexOf("\n", markerIdx - 1) + 1;
  return text.slice(0, lineStart) + replacement + text.slice(blockEnd);
}

/**
 * Pure, side-effect-free transform: takes the android/app/build.gradle contents
 * and returns the contents with both patches applied. Idempotent — calling it on
 * an already-patched file returns the same text. Named export for unit tests.
 */
export function modifyBuildGradle(src) {
  let out = src;

  // ── Patch 1: react { } — debuggableVariants = [] ───────────────────────────
  // Guard: skip if an active (uncommented) `debuggableVariants = [...]` exists.
  if (!/^\s*debuggableVariants\s*=\s*\[\s*\]/m.test(out)) {
    const anchor = '// debuggableVariants = ["liteDebug", "prodDebug"]';
    if (out.includes(anchor)) {
      out = out.replace(anchor, anchor + "\n" + DV_BLOCK);
    } else if (out.includes("autolinkLibrariesWithApp()")) {
      // Fallback anchor if the template comment ever disappears.
      out = out.replace(
        "autolinkLibrariesWithApp()",
        "debuggableVariants = []\n    autolinkLibrariesWithApp()",
      );
    } else {
      throw new Error("withDebugSigning: could not find a place to add debuggableVariants = []");
    }
  }

  // ── Patch 2a: load ../keystore.properties (Play upload key) ────────────────
  // Guard: skip if the def line is already present.
  if (!out.includes("def keystorePropertiesFile = rootProject.file('../keystore.properties')")) {
    if (!out.includes("signingConfigs {")) {
      throw new Error("withDebugSigning: no signingConfigs {} block found to add upload-key signing");
    }
    out = out.replace("    signingConfigs {", KEYS_PROPS_BLOCK + "\n    signingConfigs {");
  }

  // ── Patch 2b: add the release (upload-key) signingConfig ───────────────────
  // Guard: skip if the upload-key storeFile line is already present.
  if (!out.includes("storeFile rootProject.file('../my-upload-key.keystore')")) {
    const openIdx = out.indexOf("signingConfigs {") + "signingConfigs ".length;
    const blockEnd = findBalancedBraces(out, openIdx);
    if (blockEnd === null) {
      throw new Error("withDebugSigning: could not balance the signingConfigs {} block");
    }
    // Insert the release sub-config right before the signingConfigs block's final
    // closing brace (i.e. after the existing debug sub-config).
    const closeLineStart = out.lastIndexOf("\n", blockEnd - 1) + 1;
    out = out.slice(0, closeLineStart) + KEYS_RELEASE_CONFIG + "\n" + out.slice(closeLineStart);
  }

  // ── Patch 2c: sign both buildTypes with the upload key when present ────────
  // Replace the whole block so the template's plain `signingConfig
  // signingConfigs.debug` (both buildTypes) becomes the upload-key-aware form.
  out = replaceBalancedBlock(out, "buildTypes {", BUILDTYPES_BLOCK);

  return out;
}

export default function withDebugSigning(config) {
  return withAppBuildGradle(config, (c) => {
    if (c.modResults.language !== "groovy") {
      throw new Error(
        "withDebugSigning: expected android/app/build.gradle (groovy), got " + c.modResults.language,
      );
    }
    c.modResults.contents = modifyBuildGradle(c.modResults.contents);
    return c;
  });
}
