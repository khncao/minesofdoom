/**
 * User-uploaded custom skin (docs/todo.md custom-skinning line).
 *
 * One save slot: an optional 16×16 pixel grid (decoded from the user's PNG
 * — see utils/graphics/customSprite.ts) and an optional pickaxe-swing
 * audio data URI. `unlocked` is the one-time purchase gate (IAP
 * `customSkinPass`, gems or cash); `equipped` toggles the look at will.
 *
 * Everything here is pure: the decode (PNG bytes → grid) lives in
 * utils/graphics/customSprite.ts, the file picking (DOM input / OS
 * picker) in customSkinPicker(.web).ts. The React layer only wires the
 * pieces to the save.
 */

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

/** A 16×16 grid of CSS colors or null (transparent) cells. */
export type CustomSkinGrid = readonly (readonly (string | null)[] | null)[];

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
 return grid.some((row) =>
  Array.isArray(row) && row.some((cell) => cell !== null),
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
 * Validate + normalize the user's swing sound: must be a data: URI
 * (native file URIs are not — a file path in the save is a security
 * smell and breaks on reinstall), audio-ish, under the size cap.
 */
export function normalizeCustomSkinAudio(
 v: unknown,
): string | null {
 if (
  typeof v !== "string" ||
  !v.startsWith("data:audio/") ||
  v.length > CUSTOM_SKIN_AUDIO_MAX_URI_LENGTH
 ) {
  return null;
 }
 return v;
}
