/**
 * signinSdks tests (docs/todo.md "Optional login" — the native Google /
 * Apple half). The modules are jest.mocked (no native modules in
 * jest); the suite pins the CONTRACT the UI relies on:
 *  - the kinds list per platform (the "hidden until ready" rule that
 *    decides which buttons render),
 *  - `mintIdToken` resolves the idToken string on success,
 *  - a dismissed sheet is a `SignInCancelledError` (the UI stays
 *    quiet), anything else rejects as a real failure.
 */
import { Platform } from "react-native";
import {
  availableProviderKinds,
  mintIdToken,
  providerKindsForPlatform,
  SignInCancelledError,
} from "../signinSdks";

jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: { signIn: jest.fn() },
}));
jest.mock("expo-apple-authentication", () => ({
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { GoogleSignin } = require("@react-native-google-signin/google-signin");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const AppleAuthentication = require("expo-apple-authentication");

describe("providerKindsForPlatform (hidden until ready)", () => {
  it("web: no native SDKs — the auth section is a no-op there anyway", () => {
    expect(providerKindsForPlatform("web")).toEqual([]);
  });
  it("android: Google only (Sign in with Apple is iOS-only)", () => {
    expect(providerKindsForPlatform("android")).toEqual([
      "google",
    ]);
  });
  it("ios: Google and Apple side by side", () => {
    expect(providerKindsForPlatform("ios")).toEqual([
      "google",
      "apple",
    ]);
  });
});

describe("availableProviderKinds (computed once at import)", () => {
  it("agrees with the platform matrix for the running platform", () => {
    expect(availableProviderKinds).toEqual(
      providerKindsForPlatform(Platform.OS),
    );
  });
});

describe("mintIdToken: google", () => {
  beforeEach(() => {
    (GoogleSignin.signIn as jest.Mock).mockReset();
  });

  it("resolves the idToken from a success response", async () => {
    (GoogleSignin.signIn as jest.Mock).mockResolvedValue({
      type: "success",
      data: { idToken: "g-id-token", email: "a@b.c" },
    });
    await expect(mintIdToken("google")).resolves.toBe("g-id-token");
    // No scopes/options: the SDK defaults (profile/email) mint the
    // idToken the server's sidecar verifies.
    expect(GoogleSignin.signIn).toHaveBeenCalledTimes(1);
  });

  it("a cancelled response (v16 resolves, not throws) is a SignInCancelledError", async () => {
    (GoogleSignin.signIn as jest.Mock).mockResolvedValue({ type: "cancelled" });
    await expect(mintIdToken("google")).rejects.toThrow(
      SignInCancelledError,
    );
  });

  it("a success without an idToken is a real failure", async () => {
    (GoogleSignin.signIn as jest.Mock).mockResolvedValue({
      type: "success",
      data: { idToken: "" },
    });
    await expect(mintIdToken("google")).rejects.toThrow("no idToken");
  });

  it("an SDK rejection propagates as a real failure", async () => {
    (GoogleSignin.signIn as jest.Mock).mockRejectedValue(
      new Error("boom"),
    );
    await expect(mintIdToken("google")).rejects.toThrow("boom");
  });
});

describe("mintIdToken: apple", () => {
  beforeEach(() => {
    (AppleAuthentication.signInAsync as jest.Mock).mockReset();
  });

  it("resolves the identityToken and asks for the FULL_NAME scope", async () => {
    (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue({
      identityToken: "a-id-token",
      user: { fullName: null, email: null },
    });
    await expect(mintIdToken("apple")).resolves.toBe("a-id-token");
    expect(AppleAuthentication.signInAsync).toHaveBeenCalledWith({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      ],
    });
  });

  it("the documented cancel rejection is a SignInCancelledError", async () => {
    (AppleAuthentication.signInAsync as jest.Mock).mockRejectedValue(
      Object.assign(new Error("sign in failed"), {
        code: "ERR_REQUEST_CANCELED",
      }),
    );
    await expect(mintIdToken("apple")).rejects.toThrow(
      SignInCancelledError,
    );
  });

  it("a cancel without a code (message only) is still recognized", async () => {
    (AppleAuthentication.signInAsync as jest.Mock).mockRejectedValue(
      new Error("ERR_REQUEST_CANCELED"),
    );
    await expect(mintIdToken("apple")).rejects.toThrow(
      SignInCancelledError,
    );
  });

  it("an SDK rejection that is NOT a cancel propagates", async () => {
    (AppleAuthentication.signInAsync as jest.Mock).mockRejectedValue(
      new Error("boom"),
    );
    await expect(mintIdToken("apple")).rejects.toThrow("boom");
  });

  it("a credential without an identityToken is a real failure", async () => {
    (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue({
      identityToken: null,
      user: null,
    });
    await expect(mintIdToken("apple")).rejects.toThrow(
      "no identityToken",
    );
  });
});
