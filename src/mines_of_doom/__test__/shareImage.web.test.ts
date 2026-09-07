/** @jest-environment jsdom */

/**
 * Web share-image tests (shareImage.web.ts, required by explicit path —
 * jest does not apply Metro's .web resolution): canvas→File→Web Share
 * flow with stubbed DOM, plus every fallback mode (no 2d context,
 * no file-sharing support, user-closed sheet).
 */
import { Share } from "react-native";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { shareBadgeBytes } = require("../shareImage.web");

const badge = {
  width: 4,
  height: 3,
  pixels: new Uint8Array(4 * 3 * 4).fill(255),
  bytes: new Uint8Array([0x89, 0x50]),
};

type NavigatorStub = {
  canShare?: (desc: { files: unknown[] }) => boolean;
  share?: jest.Mock;
};

describe("shareBadgeBytes (web)", () => {
  let createElementSpy: jest.SpyInstance;
  let navigatorStub: NavigatorStub;
  let putImageData: jest.Mock;
  let toBlob: jest.Mock;
  let originalNavigator: PropertyDescriptor | undefined;
  let originalImageData: unknown;

  const installNavigator = (nav: Partial<NavigatorStub>) => {
    navigatorStub = nav as NavigatorStub;
    Object.defineProperty(globalThis, "navigator", {
      value: navigatorStub,
      configurable: true,
      writable: true,
    });
  };

  beforeEach(() => {
    originalNavigator = Object.getOwnPropertyDescriptor(
      globalThis,
      "navigator",
    );
    putImageData = jest.fn((_imageData: ImageData) => {
      void _imageData; // typed for mock.calls; the pixels are asserted below
    });
    toBlob = jest.fn((cb: (b: Blob) => void) =>
      cb(new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" })),
    );
    // jsdom's ImageData has no (data, w, h) constructor — stub it the way
    // the real browser provides it.
    class FakeImageData {
      data: Uint8ClampedArray;
      width: number;
      height: number;
      constructor(data: Uint8ClampedArray, width: number, height: number) {
        this.data = data;
        this.width = width;
        this.height = height;
      }
    }
    originalImageData = Object.getOwnPropertyDescriptor(
      globalThis,
      "ImageData",
    )?.value;
    Object.defineProperty(globalThis, "ImageData", {
      value: FakeImageData,
      configurable: true,
      writable: true,
    });
    const fakeCanvas = {
      width: 0,
      height: 0,
      getContext: jest.fn(() => ({ putImageData })),
      toBlob,
    };
    createElementSpy = jest
      .spyOn(document, "createElement")
      .mockReturnValue(fakeCanvas as unknown as HTMLElement);
    jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalNavigator) {
      Object.defineProperty(globalThis, "navigator", originalNavigator);
    }
    if (originalImageData) {
      Object.defineProperty(globalThis, "ImageData", {
        value: originalImageData,
        configurable: true,
        writable: true,
      });
    }
  });

  it("renders to a canvas and shares the File via navigator.share", async () => {
    const navShare = jest.fn(async (opts: { text: string; files: File[] }) => {
      void opts; // typed for the assertions below
    });
    installNavigator({ canShare: () => true, share: navShare });
    await shareBadgeBytes(badge, "I earned it!");
    expect(putImageData).toHaveBeenCalled();
    const imageData = putImageData.mock.calls[0][0];
    expect(imageData.width).toBe(4);
    expect(imageData.height).toBe(3);
    expect(toBlob).toHaveBeenCalled();
    expect(navShare).toHaveBeenCalledWith(
      expect.objectContaining({ text: "I earned it!" }),
    );
    const files = navShare.mock.calls[0][0].files;
    expect(files).toHaveLength(1);
    expect(files[0].name).toBe("mine-badge.png");
    expect(files[0].type).toBe("image/png");
    expect(Share.share).not.toHaveBeenCalled();
  });

  it("falls back to the text share when the browser can't share files", async () => {
    installNavigator({ canShare: () => false, share: jest.fn() });
    await shareBadgeBytes(badge, "text only");
    expect(Share.share).toHaveBeenCalledWith({ message: "text only" });
  });

  it("falls back to the text share when there is no 2d context", async () => {
    installNavigator({ canShare: () => true, share: jest.fn() });
    createElementSpy.mockReturnValue({
      width: 0,
      height: 0,
      getContext: jest.fn(() => null),
      toBlob: jest.fn(),
    } as unknown as HTMLElement);
    await shareBadgeBytes(badge, "text only");
    expect(Share.share).toHaveBeenCalledWith({ message: "text only" });
  });

  it("treats a user-closed share sheet as a no-op (no nag fallback)", async () => {
    const navShare = jest.fn(
      () =>
        Promise.reject(Object.assign(new Error("aborted"), { name: "AbortError" })),
    );
    installNavigator({ canShare: () => true, share: navShare });
    await expect(shareBadgeBytes(badge, "text only")).resolves.toBeUndefined();
    expect(Share.share).not.toHaveBeenCalled();
  });

  it("a non-abort share failure still degrades to the text share", async () => {
    const navShare = jest.fn(() => Promise.reject(new Error("security")));
    installNavigator({ canShare: () => true, share: navShare });
    await shareBadgeBytes(badge, "text only");
    expect(Share.share).toHaveBeenCalledWith({ message: "text only" });
  });
});
