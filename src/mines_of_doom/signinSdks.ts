/**
 * The two native sign-in SDKs (docs/todo.md "Optional login" — the
 * Google/Apple half). The auth provider core (auth.ts) already speaks
 * both: it takes a provider idToken and the server's identity sidecar
 * verifies it (pb_hooks/README.md). This module is the last mile — it
 * mints the idToken through the OS sign-in sheet and hands it to
 * `useAccount.providerSignIn`.
 *
 *   - Google:  `@react-native-google-signin/google-signin` (android +
 *     ios) — `GoogleSignin.signIn()` resolves a discriminated union
 *     (`type: "success"` | `type: "cancelled"`), so a cancel is a
 *     RESULT, not an error.
 *   - Apple:   `expo-apple-authentication` (ios) —
 *     `signInAsync()` resolves the credential or REJECTS with
 *     `ERR_REQUEST_CANCELED`; a cancel is an error we have to
 *     recognize.
 *
 * Both normalise to the one contract below: `mintIdToken` resolves the
 * idToken string, rejects with `SignInCancelledError` when the user
 * dismissed the sheet (the UI stays quiet), or a plain Error when
 * something actually failed (the UI shows its single inline error).
 *
 * "Hidden until ready", same rule as the ad/IAP/cloud entry points: the
 * kinds list is a pure function of the platform (web → none — the auth
 * provider is a no-op there anyway, so the settings section is hidden
 * before this is ever consulted), and the SDK modules are only
 * required at the moment the button is pressed, never at import time
 * (their JS entries touch native-module wiring; a platform that never
 * renders the button must never evaluate them).
 */
import { Platform } from "react-native";

/** The two provider kinds the native SDKs mint idTokens for (the
 *  `email` kind is the form in the settings section, not an SDK). */
export type ProviderKind = "google" | "apple";

/** The user dismissed the OS sign-in sheet — NOT an error: the UI must
 *  not show the inline error for this. */
export class SignInCancelledError extends Error {
  constructor(kind: ProviderKind) {
    super(`${kind} sign-in cancelled by the user`);
    this.name = "SignInCancelledError";
  }
}

/** The kinds whose SDKs are in this build, for a given platform. Pure
 *  (unit-testable without touching Platform) — "ready" means "the
 *  SDK shipped with the build for this OS": Google rides the RN/Expo
 *  module on android + ios, Apple's Sign in with Apple on ios. */
export function providerKindsForPlatform(os: string): ProviderKind[] {
  if (os === "ios") return ["google", "apple"];
  if (os === "android") return ["google"];
  return [];
}

/** The kinds on the platform this bundle is running on (the settings
 *  section reads this to decide which buttons render). */
export const availableProviderKinds: ProviderKind[] =
  providerKindsForPlatform(Platform.OS);

/**
 * Mint an idToken through the OS sign-in sheet.
 *
 * Resolves: the idToken string (what `useAccount.providerSignIn`
 * posts to the server).
 * Rejects: `SignInCancelledError` (user dismissed — stay quiet) or a
 * plain Error (SDK failure — the UI's single inline error applies).
 */
export async function mintIdToken(kind: ProviderKind): Promise<string> {
  return kind === "google" ? mintGoogleIdToken() : mintAppleIdToken();
}

/** The Google WEB OAuth client ID (same Google Cloud project as the
 *  Android client `94426274846-c6vottone69be2m84n6s0d6ru1f08o8n...`
 *  registered for package `com.minus4kelvin.minesofdoom` + the
 *  upload-key SHA-1). v16 mints the idToken with
 *  `requestIdToken(webClientId)` — the token's `aud` IS this id, and the
 *  server sidecar verifies `aud` against its `GOOGLE_CLIENT_ID` env
 *  (pb_hooks/sidecar/verify.js `checkIdentityClaims`), so that env must
 *  equal this constant. Not a secret: a leaked client id alone can't
 *  mint tokens — same plain-constant treatment as the Pocketbase URL in
 *  storeConfig.ts. (Credential is the project's client id from
 *  google_oauth_web.json — an installed-type client; v16's Android
 *  path only needs an id to put in the token's `aud`, and the sidecar
 *  accepts whatever equals its env, so the two must stay in sync.
 *
 *  MUST be a WEB-application-type client id, not the installed-type
 *  `...c6vottone69be2m84n6s0d6ru1f08n...` one: Play Services'
 *  `requestIdToken()` only mints tokens for web-type audiences — with the
 *  installed id the sheet completed but returned success with no idToken
 *  (verified on-device 2026-09-05).) */
const GOOGLE_WEB_CLIENT_ID =
  "94426274846-7vsqc2habc84b0upion6clsdnl5cqj1f.apps.googleusercontent.com";

/** Google (android + ios). Lazy require — see the module header. */
async function mintGoogleIdToken(): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires -- the lazy require IS the point (see the module header)
  const { GoogleSignin } = require("@react-native-google-signin/google-signin") as
    typeof import("@react-native-google-signin/google-signin");
  // Re-setting the same native config is a no-op; doing it here (not at
  // import time) keeps the require-site lazy. No scopes passed: the SDK
  // defaults (profile + email) apply. webClientId is what mints the
  // idToken at all — v16 Android never requests one without it.
  GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
  const res = await GoogleSignin.signIn();
  // v16+ resolves (it does not throw) when the user cancels.
  if (res.type !== "success") throw new SignInCancelledError("google");
  const idToken = res.data.idToken;
  if (typeof idToken !== "string" || idToken.length === 0) {
    throw new Error("google sign-in returned no idToken");
  }
  return idToken;
}

/** Apple (ios only). Lazy require — see the module header. */
async function mintAppleIdToken(): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires -- the lazy require IS the point (see the module header)
  const AppleAuthentication = require("expo-apple-authentication") as typeof import(
    "expo-apple-authentication"
  );
  let credential: { identityToken: string | null } | null = null;
  try {
    // FULL_NAME asks for the name/email the player grants; they may
    // deny either and the sign-in still completes (the server keys the
    // account on the sub, not on the email).
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      ],
    });
  } catch (err) {
    // The SDK rejects (not resolves) on cancel — recognize the
    // documented sentinel, everything else is a real failure.
    if (err instanceof Error && isAppleCancel(err)) {
      throw new SignInCancelledError("apple");
    }
    throw err;
  }
  if (credential === null || typeof credential.identityToken !== "string") {
    throw new Error("apple sign-in returned no identityToken");
  }
  return credential.identityToken;
}

/** The documented cancel sentinels (`ERR_REQUEST_CANCELED` — the SDK
 *  puts it in the error code, and it also surfaces in the message). */
function isAppleCancel(err: Error): boolean {
  const code = (err as { code?: unknown }).code;
  return (
    code === "ERR_REQUEST_CANCELED" ||
    err.message.includes("ERR_REQUEST_CANCELED")
  );
}
