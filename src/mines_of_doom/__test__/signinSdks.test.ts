/**
 * signinSdks tests (docs/todo.md "Optional login" — the native Google /
 * Apple half plus the web Google/GSI half). The modules are jest.mocked
 * (no native modules in jest; web gets a fake window); the suite pins
 * the CONTRACT the UI relies on:
 *  - the kinds list per platform (the "hidden until ready" rule that
 *    decides which buttons render),
 *  - `mintIdToken` resolves the idToken string on success,
 *  - a dismissed sheet is a `SignInCancelledError` (the UI stays
 *    quiet), anything else rejects as a real failure.
 */
import { Platform } from "react-native";
import {
  availableProviderKinds,
  mintGoogleIdTokenWeb,
  mintIdToken,
  providerKindsForPlatform,
  SignInCancelledError,
} from "../signinSdks";

jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: { signIn: jest.fn(), configure: jest.fn() },
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
  it("web: Google only (GSI script, no native SDKs — Apple needs a domain-verified service id that does not exist yet)", () => {
    expect(providerKindsForPlatform("web")).toEqual(["google"]);
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
    expect(GoogleSignin.signIn).toHaveBeenCalledTimes(1);
    // v16 Android mints the idToken only for the configured client id
    // (the token's aud — the sidecar's GOOGLE_CLIENT_ID env must
    // match, see the module header). Pin the real value: if the
    // constant in signinSdks.ts changes, this test fails until the
    // pin (and the VPS env) follow. Web-application-type id — the
    // installed-type one minted no token on-device.
    expect(GoogleSignin.configure).toHaveBeenLastCalledWith({
      webClientId:
        "94426274846-7vsqc2habc84b0upion6clsdnl5cqj1f.apps.googleusercontent.com",
    });
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

// -- the web Google path (Google Identity Services) -------------------------

type GsiCaptured = {
  opts?: {
    callback: (r: { access_token?: unknown } | null) => void;
    error_callback: (e: unknown) => void;
  };
};

describe("mintGoogleIdTokenWeb (Google Identity Services)", () => {
  let fake: {
    initTokenClient: jest.Mock;
    window: Record<string, unknown>;
  };
  let captured: GsiCaptured;

  /** Expose the fake GSI oauth2 API on the current fake window (the
   *  initTokenClient mock from beforeEach is already capturing). */
  function installGsi() {
    fake.window.google = { accounts: { oauth2: fake } };
  }

  beforeEach(() => {
    fake = { initTokenClient: jest.fn(), window: {} };
    captured = {};
    fake.initTokenClient = jest.fn(
      (opts: NonNullable<GsiCaptured["opts"]>) => {
        captured.opts = {
          callback: opts.callback,
          error_callback: opts.error_callback,
        };
        return { requestAccessToken: jest.fn() };
      },
    );
    (globalThis as Record<string, unknown>).window = fake.window;
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).window;
  });

  it("resolves the JWT the token-client flow hands back (the openid-scope access_token IS the idToken)", async () => {
    installGsi();
    const promise = mintGoogleIdTokenWeb();
    // Pin the client id the sidecar's GOOGLE_CLIENT_ID must match.
    expect(fake.initTokenClient).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id:
          "94426274846-7vsqc2habc84b0upion6clsdnl5cqj1f.apps.googleusercontent.com",
        scope: "openid email profile",
      }),
    );
    captured.opts?.callback({ access_token: "web-id-jwt" });
    await expect(promise).resolves.toBe("web-id-jwt");
  });

  it("popup_closed_by_user is a SignInCancelledError (the UI stays quiet)", async () => {
    installGsi();
    const promise = mintGoogleIdTokenWeb();
    captured.opts?.error_callback("popup_closed_by_user");
    await expect(promise).rejects.toThrow(SignInCancelledError);
  });

  it("any other GSI error is a real failure", async () => {
    installGsi();
    const promise = mintGoogleIdTokenWeb();
    captured.opts?.error_callback("access_denied");
    await expect(promise).rejects.toThrow("access_denied");
  });

  it("a callback with no usable token is a real failure", async () => {
    installGsi();
    const promise = mintGoogleIdTokenWeb();
    captured.opts?.callback({});
    await expect(promise).rejects.toThrow("no id token");
  });

  it("without a window there is no web sign-in", async () => {
    delete (globalThis as Record<string, unknown>).window;
    await expect(mintGoogleIdTokenWeb()).rejects.toThrow(
      "unavailable in this context",
    );
  });

  it("injects the gsi/client script and runs the flow once it loads", async () => {
    // No google API on the window: the module must inject the script
    // itself, and the (fake) script exposes the API on load.
    const fakeScript: Record<string, unknown> = { async: false };
    fake.window.document = {
      createElement: () => fakeScript,
      head: {
        appendChild: () => {
          fake.window.google = { accounts: { oauth2: fake } };
          (fakeScript.onload as () => void)();
        },
      },
    };
    const promise = mintGoogleIdTokenWeb();
    expect(fakeScript.src).toBe("https://accounts.google.com/gsi/client");
    // initTokenClient runs after the script-load await resolves.
    await flushMicrotasks();
    expect(captured.opts).toBeDefined();
    captured.opts?.callback({ access_token: "web-id-jwt-2" });
    await expect(promise).resolves.toBe("web-id-jwt-2");
  });
});

/** Let queued microtasks (resolved `await`s) drain before driving the fake. */
async function flushMicrotasks() {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
}
