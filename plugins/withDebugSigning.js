import { withAppBuildGradle } from "@expo/config-plugins";

export default function withReleaseSigningInDebug(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language === "groovy") {
      config.modResults.contents = modifyBuildGradle(
        config.modResults.contents,
      );
    } else {
      throw new Error(
        "Cannot set signing config because build.gradle is not in Groovy",
      );
    }
    return config;
  });
}

function modifyBuildGradle(contents) {
  // 1. Prepare the keystore properties loading block
  const keystorePropertiesBlock = `
def keystorePropertiesFile = rootProject.file("../keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
`;

  // 2. Prepare the release signingConfigs block
  const signingConfigBlock = `
    signingConfigs {
        release {
            if (keystorePropertiesFile.exists() && keystoreProperties.containsKey('storeFile')) {
                storeFile = file(keystoreProperties['storeFile'])
                storePassword = keystoreProperties['storePassword']
                keyAlias = keystoreProperties['keyAlias']
                keyPassword = keystoreProperties['keyPassword']
            }
        }
    }
`;

  let updated = contents;

  // Insert properties file reading before signingConfigs or defaultConfig if signingConfigs doesn't exist yet
  if (!updated.includes("def keystorePropertiesFile")) {
    if (updated.includes("signingConfigs {")) {
      updated = updated.replace(
        "signingConfigs {",
        `${keystorePropertiesBlock}\n    signingConfigs {`,
      );
    } else if (updated.includes("defaultConfig {")) {
      updated = updated.replace(
        "defaultConfig {",
        `${keystorePropertiesBlock}\n    defaultConfig {`,
      );
    }
  }

  // Insert or update the signingConfigs release block
  if (!updated.includes("signingConfigs {")) {
    // If signingConfigs block completely missing, add it before buildTypes
    updated = updated.replace(
      "buildTypes {",
      `${signingConfigBlock}\n    buildTypes {`,
    );
  } else if (
    !updated.includes("release {") ||
    !updated
      .substring(updated.indexOf("signingConfigs {"))
      .includes("release {")
  ) {
    // If signingConfigs exists but release block is missing inside it
    updated = updated.replace(
      "signingConfigs {",
      `signingConfigs {\n${signingConfigBlock.replace("signingConfigs {", "").replace("}", "")}`,
    );
  }

  // 3. Force debug buildType to use release signingConfig
  const debugBuildTypeRegex = /(debug\s*\{[^}]*)/;
  if (updated.match(debugBuildTypeRegex)) {
    // Check if signingConfig is already defined in debug, if so replace it, otherwise add it
    if (updated.match(/debug\s*\{[^}]*signingConfig/)) {
      updated = updated.replace(
        /(debug\s*\{[^}]*signingConfig\s+signingConfigs\.)\w+/,
        "$1release",
      );
    } else {
      updated = updated.replace(
        /(debug\s*\{)/,
        "$1\n            signingConfig signingConfigs.release",
      );
    }
  }

  return updated;
}
