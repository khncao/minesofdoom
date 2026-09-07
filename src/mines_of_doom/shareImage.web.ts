/**
 * WEB variant of the share-image module (Metro resolves this file for the
 * web target). The badge pixels are drawn straight onto an offscreen
 * canvas (no PNG re-decode needed — we own the pixel buffer) and shared
 * as a File via the Web Share API when the browser supports file sharing.
 *
 * Fallbacks, in order, each strictly more limited than the last:
 *  1. `navigator.canShare({files})` false → the plain-text share
 *     (the pre-baseline behavior — still honest, still a share sheet).
 *  2. Any render/share error → the same text share.
 * A user-closed share sheet (AbortError) is a no-op, NOT a fallback —
 * re-opening a text sheet after the user dismissed the image sheet would
 * be a nag.
 */
import type { ShareBadge } from "./shareBadge";
import { shareText } from "./share";

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

/**
 * Share the rendered badge as an image. Resolves (never rejects); every
 * failure degrades to the text share, except a user-closed share sheet.
 */
export async function shareBadgeBytes(
  badge: ShareBadge,
  fallbackText: string,
): Promise<void> {
  let blob: Blob;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = badge.width;
    canvas.height = badge.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    ctx.putImageData(
      new ImageData(
        new Uint8ClampedArray(badge.pixels),
        badge.width,
        badge.height,
      ),
      0,
      0,
    );
    blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
        "image/png",
      );
    });
  } catch {
    await shareText(fallbackText);
    return;
  }

  const file = new File([blob], "mine-badge.png", { type: "image/png" });
  const canShareFiles =
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] });
  try {
    if (canShareFiles) {
      await navigator.share({ text: fallbackText, files: [file] });
    } else {
      await shareText(fallbackText);
    }
  } catch (err) {
    if (isAbortError(err)) return; // user dismissed — deliberate no-op
    await shareText(fallbackText);
  }
}
