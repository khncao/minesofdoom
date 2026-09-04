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

/** Google (android + ios). Lazy require — see the module header. */
async function mintGoogleIdToken(): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires -- the lazy require IS the point (see the module header)
  const { GoogleSignin } = require("@react-native-google-signin/google-signin") as
    typeof import("@react-native-google-signin/google-signin");
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
