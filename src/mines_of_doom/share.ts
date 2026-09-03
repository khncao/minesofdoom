/**
 * Share actions (docs/store-integration.md §3 "Share"):
 * each completed achievement row gets a share action — a plain-text
 * string via the platform share sheet. No backend, no tracking.
 *
 * Where the text goes is a PURE decision (`pickShareTarget`), pinned by
 * tests:
 *  - native (ios/android): react-native's `Share` (the platform share
 *    sheet — the sanctioned API on both).
 *  - web: the Web Share API when the browser provides it; otherwise
 *    "none" (a share tap quietly does nothing — no dark patterns, no
 *    silent clipboard writes).
 */
import { Platform, Share } from "react-native";

export type ShareTarget =
  | { kind: "react-native" }
  | { kind: "navigator" }
  | { kind: "none" };

/** The pure selection (unit-testable without a DOM or the RN runtime). */
export function pickShareTarget(
  platform: string,
  hasNavigatorShare: boolean,
): ShareTarget {
  if (platform === "web") {
    return hasNavigatorShare ? { kind: "navigator" } : { kind: "none" };
  }
  return { kind: "react-native" };
}

/** Resolve the target for the running platform. */
export function shareTarget(): ShareTarget {
  let hasNavigatorShare = false;
  try {
    hasNavigatorShare =
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function";
  } catch {
    hasNavigatorShare = false;
  }
  return pickShareTarget(Platform.OS, hasNavigatorShare);
}

/**
 * Share `text` via the platform share sheet. Resolves (never rejects
 * into the game — a share failure is nobody's crash); the caller treats
 * any throw (e.g. the user dismissing the sheet) as a no-op.
 */
export async function shareText(text: string): Promise<void> {
  const target = shareTarget();
  if (target.kind === "none") return;
  if (target.kind === "navigator") {
    await navigator.share({ title: "", text });
    return;
  }
  // RN 0.76's Share takes a ShareContent object ({message}, or a url).
  await Share.share({ message: text });
}
