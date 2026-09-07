/**
 * Native share-image tests (shareImage.ts): base64 encoding vectors and
 * the share flow with the expo modules mocked — image share on success,
 * text share on every failure mode.
 */
import { Share } from "react-native";

jest.mock("expo-file-system/legacy", () => ({
  cacheDirectory: "file:///caches/",
  writeAsStringAsync: jest.fn(async () => undefined),
}));
jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => undefined),
}));

// Re-require AFTER the mocks so the module under test sees them.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const FileSystem = require("expo-file-system/legacy");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Sharing = require("expo-sharing");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { toBase64, shareBadgeBytes } = require("../shareImage");

const badge = {
  width: 4,
  height: 3,
  pixels: new Uint8Array(4 * 3 * 4),
  bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
};

describe("toBase64 (no Buffer/btoa in RN)", () => {
  it("matches the standard vectors", () => {
    // Vectors verified against node:Buffer.toString("base64").
    expect(toBase64(new Uint8Array([0x65, 0x66, 0x67]))).toBe("ZWZn");
    expect(toBase64(new Uint8Array([0x61, 0x62]))).toBe("YWI=");
    expect(toBase64(new Uint8Array([0x61]))).toBe("YQ==");
    expect(toBase64(new Uint8Array([0xff, 0x00, 0x7f]))).toBe("/wB/");
    expect(toBase64(new Uint8Array([]))).toBe("");
  });
});

describe("shareBadgeBytes (native)", () => {
  beforeEach(() => {
    FileSystem.writeAsStringAsync.mockClear();
    FileSystem.writeAsStringAsync.mockResolvedValue(undefined);
    Sharing.isAvailableAsync.mockResolvedValue(true);
    Sharing.shareAsync.mockClear();
    Sharing.shareAsync.mockResolvedValue(undefined);
    jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("writes the PNG to the cache and hands it to expo-sharing", async () => {
    await shareBadgeBytes(badge, "fallback");
    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
      "file:///caches/share-badge.png",
      toBase64(badge.bytes),
      { encoding: "base64" },
    );
    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      "file:///caches/share-badge.png",
      expect.objectContaining({ mimeType: "image/png" }),
    );
    expect(Share.share).not.toHaveBeenCalled();
  });

  it("falls back to the text share when sharing is unavailable", async () => {
    Sharing.isAvailableAsync.mockResolvedValue(false);
    await shareBadgeBytes(badge, "text only");
    expect(Share.share).toHaveBeenCalledWith({ message: "text only" });
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
  });

  it("falls back to the text share when the file write fails", async () => {
    FileSystem.writeAsStringAsync.mockRejectedValue(new Error("disk full"));
    await shareBadgeBytes(badge, "text only");
    expect(Share.share).toHaveBeenCalledWith({ message: "text only" });
  });

  it("falls back to the text share when the share sheet throws", async () => {
    Sharing.shareAsync.mockRejectedValue(new Error("no handler"));
    await expect(shareBadgeBytes(badge, "text only")).resolves.toBeUndefined();
    expect(Share.share).toHaveBeenCalledWith({ message: "text only" });
  });
});
