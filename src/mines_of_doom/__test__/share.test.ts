/**
 * Share-action tests (share.ts): the target-selection decision (the
 * pure `pickShareTarget`) and the resolved behavior per platform
 * (react-native Share spy / stubbed navigator.share).
 */
import { Platform, Share } from "react-native";
import { pickShareTarget, shareText, shareTarget } from "../share";

describe("pickShareTarget (the pure decision)", () => {
  it("web uses the Web Share API when the browser provides it", () => {
    expect(pickShareTarget("web", true)).toEqual({ kind: "navigator" });
  });
  it("web without navigator.share falls back to 'none' (a quiet no-op — no silent clipboard)", () => {
    expect(pickShareTarget("web", false)).toEqual({ kind: "none" });
  });
  it("native always uses react-native Share (ios + android)", () => {
    expect(pickShareTarget("ios", true)).toEqual({ kind: "react-native" });
    expect(pickShareTarget("ios", false)).toEqual({ kind: "react-native" });
    expect(pickShareTarget("android", true)).toEqual({ kind: "react-native" });
  });
});

describe("shareText", () => {
  let shareSpy: jest.SpyInstance;
  let origNavigator: unknown;

  beforeEach(() => {
    shareSpy = jest
      .spyOn(Share, "share")
      .mockResolvedValue({ action: "sharedAction" });
    origNavigator = globalThis.navigator;
  });

  afterEach(() => {
    shareSpy.mockRestore();
    Object.defineProperty(globalThis, "navigator", {
      value: origNavigator,
      configurable: true,
      writable: true,
    });
  });

  it("native target: hands the text to react-native Share as ShareContent", async () => {
    // Platform.OS is "ios" in the jest-expo preset.
    expect(shareTarget()).toEqual({ kind: "react-native" });
    await shareText("I earned 'Bog Standard' in Mines of Idle Doomath!");
    expect(shareSpy).toHaveBeenCalledWith({
      message: "I earned 'Bog Standard' in Mines of Idle Doomath!",
    });
  });

  it("web with navigator.share: shareTarget() picks the navigator branch", async () => {
    await withPlatformOS("web", async () => {
      const navigatorShare = jest.fn().mockResolvedValue(undefined);
      Object.defineProperty(globalThis, "navigator", {
        value: { share: navigatorShare },
        configurable: true,
        writable: true,
      });
      expect(shareTarget()).toEqual({ kind: "navigator" });
      // And the text actually reaches the Web Share API.
      await shareText("hello");
      expect(navigatorShare).toHaveBeenCalledWith({
        title: "",
        text: "hello",
      });
    });
  });

  it("web without navigator.share: resolves to 'none' (a quiet no-op)", async () => {
    await withPlatformOS("web", async () => {
      Object.defineProperty(globalThis, "navigator", {
        value: {},
        configurable: true,
        writable: true,
      });
      expect(shareTarget()).toEqual({ kind: "none" });
      await expect(shareText("nothing happens")).resolves.toBeUndefined();
    });
  });

  it("a rejected share propagates for the caller to ignore (never crashes the game)", async () => {
    shareSpy.mockRejectedValue(new Error("User cancelled"));
    // The panel awaits shareText with `void` and treats any throw as a
    // no-op (the user dismissed the sheet) — so the contract is:
    // propagate, don't swallow with a lie.
    await expect(shareText("x")).rejects.toThrow("User cancelled");
  });
});

/** Temporarily pretend the app is running on a given Platform.OS (the
 *  jest preset says "ios"). Restores the original property descriptor. */
async function withPlatformOS(os: string, fn: () => Promise<void>) {
  const original = Object.getOwnPropertyDescriptor(Platform, "OS");
  Object.defineProperty(Platform, "OS", { value: os, configurable: true });
  try {
    await fn();
  } finally {
    Object.defineProperty(Platform, "OS", original!);
  }
}
