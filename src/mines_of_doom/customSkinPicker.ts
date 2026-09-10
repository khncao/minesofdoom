/**
 * Custom-skin upload pickers (docs/todo.md custom-skinning).
 *
 * The SHOP is the upload surface (the packSkin shop row's upload buttons):
 * these pickers turn a player-chosen file into a storage-ready value —
 * `pickCustomSkinImage` decodes/downscales the file to a 16×16 RGBA grid
 * (stored via `toStorageGrid`, never as a URL), `pickCustomSkinAudio`
 * decodes + re-encodes the file to a size-capped WAV data URI — and both
 * return a typed, testable result (cancelled / value / invalid /
 * unsupported) so the caller toasts plain-language feedback (no dark
 * patterns: the player always hears what was stored and what wasn't).
 *
 * Platform split:
 *  - **web** — `customSkinPicker.web.ts`: a hidden <input type=file>
 *    (no file-picking API dependency) + canvas downscale + AudioContext
 *    decode. This is where the upload flow works first (the web app is
 *    the player's primary surface).
 *  - **native** (this file) — the pickers report `unsupported`: the
 *    store's file-picker API (expo-image-picker / expo-document-picker)
 *    is the follow-up step, so the shop row shows the "available on web
 *    for now" hint instead of a dead button.
 */
import { CustomSkinGrid } from "./customSkin";

export type CustomSkinPickResult =
 | { kind: "cancelled" }
 | { kind: "image"; grid: CustomSkinGrid }
 | { kind: "audio"; uri: string }
 | { kind: "invalid"; error: string }
 | { kind: "unsupported" };

/** Pick (and normalize) a skin body image. */
export async function pickCustomSkinImage(): Promise<CustomSkinPickResult> {
 return { kind: "unsupported" };
}

/** Pick (and normalize) a swing-sound file. */
export async function pickCustomSkinAudio(): Promise<CustomSkinPickResult> {
 return { kind: "unsupported" };
}
