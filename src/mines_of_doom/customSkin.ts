/**
 * User-uploaded custom skin (docs/todo.md custom-skinning line).
 *
 * One save slot: an optional 16×16 pixel grid (decoded from the user's PNG
 * — see utils/graphics/customSprite.ts), an optional bundled-sprite id
 * (bundledSprites.ts — the CC0 2D art library), and an optional
 * pickaxe-swing audio data URI. `unlocked` is the one-time purchase gate
 * (IAP `customSkinPass`, gems or cash); `equipped` toggles the look at
 * will.
 *
 * Everything here is pure: the decode (PNG bytes → grid) lives in
 * utils/graphics/customSprite.ts, the file picking (DOM input / OS
 * picker) in customSkinPicker(.web).ts. The React layer only wires the
 * pieces to the save.
 */

import { BUNDLED_SPRITE_IDS } from "./bundledSprites";

/** The grid shape the user's body sprite uses (the Miner body is 16×16). */
export const CUSTOM_SKIN_GRID_SIZE = 16;

/** Gem price of the one-time unlock (feature tier — the priciest line). */
export const CUSTOM_SKIN_UNLOCK_COST_GEMS = 250;

/**
 * Max size of the user's swing sound, as a data URI in the save. 300 KB
 * base64 ≈ 225 KB audio — a short clip, well inside the AsyncStorage
 * budget (the grid is ~2 KB; the save stays small).
 */
export const CUSTOM_SKIN_AUDIO_MAX_URI_LENGTH = 300_000;

/**
 * The swing sound is a SWING: a short clip, on every platform (3 s). The
 * web picker enforces it at decode time (AudioContext), the native picker
 * after WAV parse — one cap, both pickers.
 */
export const CUSTOM_SKIN_AUDIO_MAX_SECONDS = 3;

/**
 * Sanity cap on a picked file (bytes) before we spend a decode on it —
 * a skin image/sound will never be near this (the save keeps ~2 KB).
 */
export const CUSTOM_SKIN_MAX_PICK_BYTES = 20 * 1024 * 1024;

/** A 16×16 grid of CSS colors or null (transparent) cells. */
export type CustomSkinGrid = readonly (readonly (string | null)[] | null)[];

/**
 * The custom-skin save slot. It lives in a DEVICE-LOCAL AsyncStorage key
 * (`customSkin`, see hooks/useCustomSkin.ts) — deliberately NOT in the
 * SaveData model, for the same reason IAP entitlements are device-local
 * rather than save fields:
 *
 *   { unlocked: boolean; equipped: boolean; grid: CustomSkinGrid | null;
 *     audio: string | null }
 *
 * Device-local means an uploaded sprite/sound never travels through
 * save-code imports or cloud-save restores (a save code is someone
 * else's progress — not a carrier for a user-uploaded file), and the
 * ~2 KB blob never inflates the save blob or the cloud row.
 */
export interface CustomSkinSave {
 /** One-time-purchase gate (IAP packSkin or the gem buy). */
 unlocked: boolean;
 /** Equip the skin's art/sound over the outfit miner (visual). */
 equipped: boolean;
 /** The uploaded 16×16 body, or null for no image (body sprite shows). */
 grid: CustomSkinGrid | null;
 /**
  * A bundled sprite-library id (bundledSprites.ts), or null. Takes
  * PRECEDENCE over `grid` when set — the library picker and the image
  * upload are two ways to fill the same "body art" slot, and the most
  * recent choice wins.
  */
 artId: string | null;
 /** data:audio URI for the swing sound, or null (pickaxe sound plays). */
 audio: string | null;
}

export function defaultCustomSkin(): CustomSkinSave {
 return {
  unlocked: false,
  equipped: false,
  grid: null,
  artId: null,
  audio: null,
 };
}

/**
 * Normalize any parsed slot (a cold AsyncStorage read, a dev-tool edit)
 * into a valid CustomSkinSave: booleans coerced, the grid re-validated
 * (null on corruption), the audio re-checked as a data URI (null on
 * anything else) — so a corrupt slot degrades to "locked look, no skin"
 * instead of crashing the sprite pipeline or the audio layer.
 */
export function normalizeCustomSkinSave(value: unknown): CustomSkinSave {
 const v =
  value != null && typeof value === "object"
   ? (value as Record<string, unknown>)
   : {};
 return {
  unlocked: v.unlocked === true,
  equipped: v.equipped === true,
  grid: normalizeCustomSkinGrid(v.grid),
  artId: normalizeCustomSkinArtId(v.artId),
  audio: normalizeCustomSkinAudio(v.audio),
 };
}

/**
 * Coerce unknown JSON (save round-trip, cloud merge, save-code import)
 * into a valid grid, or null. Rejects: wrong shape, wrong size, non-string
 * cells, and colors that are not 3/6/8-digit hex (a corrupt save must
 * degrade to "no image", never to an unstyled canvas).
 */
export function normalizeCustomSkinGrid(
 v: unknown,
 size: number = CUSTOM_SKIN_GRID_SIZE,
): (readonly (string | null)[] | null)[] | null {
 if (!Array.isArray(v) || v.length !== size) {
  return null;
 }
 for (const row of v) {
  if (
   !Array.isArray(row) ||
   row.length !== size ||
   !row.every((cell) => cell === null || isValidCustomSkinColor(cell))
  ) {
   return null;
  }
 }
 return v as (readonly (string | null)[] | null)[];
}

const HEX_COLOR = /^[#]?[0-9a-f]{3}([0-9a-f]{3})?([0-9a-f]{2})?$/i;

export function isValidCustomSkinColor(v: unknown): boolean {
 return typeof v === "string" && HEX_COLOR.test(v.trim());
}

/** True when the grid has at least one opaque cell (a visible skin). */
export function hasCustomSkinPixels(
 grid: readonly (readonly (string | null)[] | null)[] | null,
): boolean {
 if (grid == null) {
  return false;
 }
 return grid.some(
  (row) => Array.isArray(row) && row.some((cell) => cell !== null),
 );
}

// grid → data URI cache: the URI is what the canvas/Miner prop carries;
// re-encoding 256 cells per re-render would be wasteful and the grid JSON
// is stable per save.
const gridUriCache = new Map<string, string>();
let gridUriCacheBytes = 0;

/** JSON fingerprint of a grid — the cache key (and the log shape). */
export function customSkinGridKey(grid: CustomSkinGrid): string {
 return JSON.stringify(grid);
}

export function customSkinGridToUri(
 grid: CustomSkinGrid,
 toDataUri: (grid: CustomSkinGrid) => string,
): string {
 const key = customSkinGridKey(grid);
 const hit = gridUriCache.get(key);
 if (hit != null) {
  return hit;
 }
 const uri = toDataUri(grid);
 gridUriCache.set(key, uri);
 gridUriCacheBytes += key.length + uri.length;
 // The cache only ever holds "the current save's grids" — bound it
 // anyway (two uploads churn it): drop the whole map, it rebuilds lazily.
 if (gridUriCacheBytes > 512_000 || gridUriCache.size > 4) {
  gridUriCache.clear();
  gridUriCache.set(key, uri);
  gridUriCacheBytes = key.length + uri.length;
 }
 return uri;
}

/**
 * The bundled sprite id: must be one of the ids in bundledSprites.ts
 * (an unknown id — a save edited by hand or a future library change —
 * falls back to "no bundled art" rather than a blank body).
 */
export function normalizeCustomSkinArtId(v: unknown): string | null {
 if (typeof v !== "string") return null;
 return BUNDLED_SPRITE_IDS.includes(v) ? v : null;
}

/** The art the equipped skin resolves to — bundled sprite first, then the uploaded grid. */
export type ActiveSkinArt =
 | { kind: "bundled"; spriteId: string }
 | { kind: "grid"; grid: CustomSkinGrid };

/**
 * The body art the skin slot carries right now, or null when nothing is
 * equipped to show. A bundled sprite id wins over an uploaded grid (the
 * library picker is the more recent intent); the caller maps the result
 * to a URI (sprite.uri / customSkinGridToUri) — this module stays free
 * of image encoding.
 */
export function activeSkinArt(save: CustomSkinSave): ActiveSkinArt | null {
 if (!save.equipped) return null;
 if (save.artId !== null) return { kind: "bundled", spriteId: save.artId };
 const grid = save.grid;
 if (grid !== null && hasCustomSkinPixels(grid)) {
  return { kind: "grid", grid };
 }
 return null;
}

/**
 * Validate + normalize the user's swing sound: must be a data: URI
 * (native file URIs are not — a file path in the save is a security
 * smell and breaks on reinstall), audio-ish, under the size cap.
 */
export function normalizeCustomSkinAudio(v: unknown): string | null {
 if (
  typeof v !== "string" ||
  !v.startsWith("data:audio/") ||
  v.length > CUSTOM_SKIN_AUDIO_MAX_URI_LENGTH
 ) {
  return null;
 }
 return v;
}
