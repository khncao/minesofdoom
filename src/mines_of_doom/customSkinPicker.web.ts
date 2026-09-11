/**
 * Web custom-skin upload pickers (todo: "Custom skinning").
 *
 * No file-picking API dependency: a hidden `<input type="file">` opened
 * on demand. The image goes through the ONE shared decode path
 * (customSprite.rgbaToGrid): any format the canvas can draw is cover-fit
 * onto a 16×16 canvas and box-averaged into the same premultiplied grid
 * the native PNG path produces — so the save stores one grid shape
 * regardless of platform. The audio is decoded with AudioContext (which
 * also enforces the short-swing limit) and re-encoded to a 16-bit PCM WAV
 * data URI capped at CUSTOM_SKIN_AUDIO_MAX_URI_LENGTH.
 *
 * Plain-language failures: cancel → "cancelled"; an undecodable image or
 * an over-long / undecodable audio → "invalid" with the reason the player
 * can act on (the caller toasts).
 */
import {
  CustomSkinGrid,
  CUSTOM_SKIN_AUDIO_MAX_SECONDS,
  CUSTOM_SKIN_AUDIO_MAX_URI_LENGTH,
  CUSTOM_SKIN_GRID_SIZE,
  CUSTOM_SKIN_MAX_PICK_BYTES,
} from "./customSkin";
import { CustomSkinPickResult } from "./customSkinPicker";
import { rgbaToGrid } from "src/utils/graphics/customSprite";
import { pcmToWavDataUri } from "src/utils/audio/wav";

/** Ask the browser for a file with the given accept filter. */
function chooseFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    // One file, one change — no multi-select, no drag-and-drop surface.
    input.addEventListener("change", () => {
      resolve(input.files?.[0] ?? null);
    });
    input.addEventListener("cancel", () => resolve(null));
    input.click();
  });
}

/** Cover-fit the file onto a 16×16 canvas and box-average to the grid. */
async function imageFileToGrid(file: File): Promise<CustomSkinGrid | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement | null>((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = url;
    });
    if (img == null || img.width <= 0 || img.height <= 0) return null;
    const n = CUSTOM_SKIN_GRID_SIZE;
    const canvas = document.createElement("canvas");
    canvas.width = n;
    canvas.height = n;
    const ctx = canvas.getContext("2d");
    if (ctx == null) return null;
    // Cover-fit: fill the 16×16 (a tall upload keeps its whole height,
    // wide margins crop to the body) — the sprite IS the player's upload.
    const scale = Math.max(n / img.width, n / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, (n - w) / 2, (n - h) / 2, w, h);
    const data = ctx.getImageData(0, 0, n, n).data;
    return rgbaToGrid(data, n, n);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function audioFileToUri(file: File): Promise<string | null> {
  // SAFETY: the DOM lib types window.AudioContext for modern browsers;
  // the webkitAudioContext fallback only carries the same constructor
  // shape (Safari's legacy name) — the cast states that, not a value.
  const AudioCtor =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (AudioCtor == null) return null;
  const arrayBuffer = await file.arrayBuffer();
  const ctx = new AudioCtor();
  try {
    const audio = await ctx.decodeAudioData(arrayBuffer);
    if (audio.duration <= 0 || audio.duration > CUSTOM_SKIN_AUDIO_MAX_SECONDS) {
      return null;
    }
    const uri = pcmToWavDataUri(audio.getChannelData(0), audio.sampleRate);
    return uri.length > CUSTOM_SKIN_AUDIO_MAX_URI_LENGTH ? null : uri;
  } catch {
    return null;
  } finally {
    void ctx.close();
  }
}

export async function pickCustomSkinImage(): Promise<CustomSkinPickResult> {
  const file = await chooseFile("image/*");
  if (file == null) return { kind: "cancelled" };
  if (file.size > CUSTOM_SKIN_MAX_PICK_BYTES) {
    return { kind: "invalid", error: "too-large" };
  }
  const grid = await imageFileToGrid(file);
  return grid == null
    ? { kind: "invalid", error: "decode" }
    : { kind: "image", grid };
}

export async function pickCustomSkinAudio(): Promise<CustomSkinPickResult> {
  const file = await chooseFile("audio/*");
  if (file == null) return { kind: "cancelled" };
  if (file.size > CUSTOM_SKIN_MAX_PICK_BYTES) {
    return { kind: "invalid", error: "too-large" };
  }
  const uri = await audioFileToUri(file);
  return uri == null
    ? { kind: "invalid", error: "decode-or-too-long" }
    : { kind: "audio", uri };
}
