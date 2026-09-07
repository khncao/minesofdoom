/**
 * NATIVE variant of the share-image module (Metro resolves this file on
 * android/ios; the web target gets shareImage.web.ts instead).
 *
 * Flow: the badge PNG bytes are written to a fixed cache file (overwritten
 * on every share — the system clears cache, so no cleanup is needed) and
 * handed to expo-sharing, which copies it to a content://-accessible
 * location and opens the platform share sheet with the image attached.
 * Anything failing (write error, no sharing intent filter) falls back to
 * the plain-text share, which is the pre-baseline behavior — a share tap
 * always does *something* honest.
 */
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import type { ShareBadge } from "./shareBadge";
import { shareText } from "./share";

const BADGE_FILE_NAME = "share-badge.png";

/** Bytes → base64 without Buffer/btoa (RN runtime has neither reliably). */
export function toBase64(bytes: Uint8Array): string {
  const CHARS =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += CHARS[b0 >> 2];
    out += CHARS[((b0 & 3) << 4) | (b1 >> 4)];
    out += i + 1 < bytes.length ? CHARS[((b1 & 15) << 2) | (b2 >> 6)] : "=";
    out += i + 2 < bytes.length ? CHARS[b2 & 63] : "=";
  }
  return out;
}

/**
 * Share the rendered badge as an image. Resolves (never rejects) — the
 * caller can `void` it; every failure mode degrades to the text share.
 */
export async function shareBadgeBytes(
  badge: ShareBadge,
  fallbackText: string,
): Promise<void> {
  try {
    const dir = FileSystem.cacheDirectory;
    if (!dir) throw new Error("no cache directory");
    // cacheDirectory is documented to end with '/'; be safe either way.
    const uri =
      dir.endsWith("/") ? `${dir}${BADGE_FILE_NAME}` : `${dir}/${BADGE_FILE_NAME}`;
    await FileSystem.writeAsStringAsync(uri, toBase64(badge.bytes), {
      encoding: "base64",
    });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: "image/png",
        dialogTitle: "Mines of Idle Doomath",
      });
      return;
    }
  } catch {
    // fall through to the text share
  }
  await shareText(fallbackText);
}
