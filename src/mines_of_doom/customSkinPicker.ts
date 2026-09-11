/**
 * Native custom-skin upload pickers (docs/todo.md custom-skinning).
 *
 * The SHOP is the upload surface (the packSkin shop row's upload buttons):
 * these pickers turn a player-chosen file into a storage-ready value —
 * `pickCustomSkinImage` decodes/downscales the file to a 16×16 grid,
 * `pickCustomSkinAudio` parses a short WAV clip to the size-capped WAV
 * data URI — and both return a typed, testable result (cancelled /
 * value / invalid) so the caller toasts plain-language feedback (no
 * dark patterns: the player always hears what was stored and what
 * wasn't).
 *
 * Platform split:
 *  - **web** — `customSkinPicker.web.ts`: a hidden <input type=file>
 *    + canvas downscale + AudioContext decode (any format the canvas /
 *    audio stack can handle).
 *  - **native** (this file) — `expo-file-system`'s document picker
 *    (`File.pickFileAsync`, no new dependency, no runtime permissions —
 *    the Android SAF / iOS UIDocumentPicker document pickers). Decode
 *    is pure JS, the same funnels as the web path: images go through
 *    the ONE shared PNG decode (customSprite.pngBytesToGrid — native
 *    pickers filter to PNG, the only format decodable without a native
 *    image decoder) and audio through the shared WAV parser
 *    (utils/audio/wav — a plain .wav is the one format parseable
 *    without a native audio decoder; anything else is rejected and the
 *    caller toasts).
 */
import { File } from "expo-file-system";
import { CustomSkinGrid } from "./customSkin";
import {
 CUSTOM_SKIN_AUDIO_MAX_SECONDS,
 CUSTOM_SKIN_AUDIO_MAX_URI_LENGTH,
 CUSTOM_SKIN_MAX_PICK_BYTES,
} from "./customSkin";
import { pngBytesToGrid } from "src/utils/graphics/customSprite";
import { parseWav, pcmToWavDataUri } from "src/utils/audio/wav";

export type CustomSkinPickResult =
 | { kind: "cancelled" }
 | { kind: "image"; grid: CustomSkinGrid }
 | { kind: "audio"; uri: string }
 | { kind: "invalid"; error: string }
 | { kind: "unsupported" };

/**
 * One platform document-picker round-trip. `null` = the player
 * cancelled (the picker's native `canceled` result, not an error).
 */
type PickedFile =
 | { kind: "cancelled" }
 | { kind: "too-large" }
 | { kind: "bytes"; bytes: Uint8Array };

async function pickFile(mimeTypes: string[]): Promise<PickedFile> {
 const res = await File.pickFileAsync({ mimeTypes });
 if (res.canceled || res.result == null) {
  return { kind: "cancelled" };
 }
 if (res.result.size > CUSTOM_SKIN_MAX_PICK_BYTES) {
  return { kind: "too-large" };
 }
 const buffer = await res.result.arrayBuffer();
 return { kind: "bytes", bytes: new Uint8Array(buffer) };
}

export async function pickCustomSkinImage(): Promise<CustomSkinPickResult> {
 // image/* would let the player pick a JPEG that the pure-JS PNG
 // decoder can't read — filter to PNG so the failure mode is a
 // confusing toast, not the common case.
 const picked = await pickFile(["image/png"]);
 if (picked.kind === "cancelled") return { kind: "cancelled" };
 if (picked.kind === "too-large") {
  return { kind: "invalid", error: "too-large" };
 }
 const grid = pngBytesToGrid(picked.bytes);
 return grid == null
  ? { kind: "invalid", error: "decode" }
  : { kind: "image", grid };
}

export async function pickCustomSkinAudio(): Promise<CustomSkinPickResult> {
 const picked = await pickFile(["audio/*"]);
 if (picked.kind === "cancelled") return { kind: "cancelled" };
 if (picked.kind === "too-large") {
  return { kind: "invalid", error: "too-large" };
 }
 const pcm = parseWav(picked.bytes);
 if (pcm == null) {
  // Not a plain 16-bit PCM WAV (mp3/ogg/… need a native decoder).
  return { kind: "invalid", error: "decode-or-too-long" };
 }
 const seconds = pcm.samples.length / pcm.sampleRate;
 if (seconds <= 0 || seconds > CUSTOM_SKIN_AUDIO_MAX_SECONDS) {
  return { kind: "invalid", error: "decode-or-too-long" };
 }
 const uri = pcmToWavDataUri(pcm.samples, pcm.sampleRate);
 if (uri.length > CUSTOM_SKIN_AUDIO_MAX_URI_LENGTH) {
  return { kind: "invalid", error: "decode-or-too-long" };
 }
 return { kind: "audio", uri };
}
