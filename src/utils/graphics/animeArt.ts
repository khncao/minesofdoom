/**
 * Draft HIGH-RESOLUTION "anime chibi" art (todo: "try completely different
 * art styles/designs with higher resolution and more details") — unlike
 * stylePasses.ts (16×16 grid transforms) and detailPass.ts (a bevel over the
 * base grids), this module BUILDS new 32×32 sprites from scratch: a chibi
 * character with big glossy eyes, shine-banded hair, a frilly-scarfed dress,
 * a chest bow (wings tapering to a V), and a scalloped hem. Pure,
 * framework-free, deterministic.
 *
 * This is the draft the decision picks from — it is NOT wired into the app.
 * The contact sheet lives in docs/art-anime.md and is rendered by
 * scripts/generate-anime-art-samples.mjs (the classic 16×16 look at the same
 * display size is the baseline row, so the sheets compare art direction,
 * not content).
 *
 * Every non-null pixel of a grid is a member of `animePalette(look)` — the
 * test pins that, so the palette is the whole tuning surface.
 */
import { createGrid } from "./pixelArt";
import { lightenHex, darkenHex } from "./detailPass";
import type { PixelGrid } from "./pixelArt";

/** Grid size of every anime sprite (2× the classic 16×16). */
export const ANIME_GRID_SIZE = 32;

/** Fixed (look-independent) colors, exported so the palette test can name them. */
export const ANIME_BLUSH = "#ffa8a8";
export const ANIME_EYELASH = "#3a2a3a";
export const ANIME_MOUTH = "#c96a7a";
export const ANIME_BOOT = "#5a3a2a";
export const ANIME_HIGHLIGHT = "#ffffff";
/** Default eye color when a look doesn't override it. */
export const ANIME_EYE_DEFAULT = "#4a2f3a";

export type AnimeHairStyle = "bob" | "long";

/** One anime character's colors + hair. */
export interface AnimeLook {
  skin: string;
  hair: string;
  dress: string;
  bow: string;
  /** Optional eye color; defaults to ANIME_EYE_DEFAULT. */
  eye?: string;
  hairStyle: AnimeHairStyle;
}

/**
 * The EXACT set of hex colors a grid built from `look` can contain: the
 * look's five colors (plus the eye default when unset) and the fixed
 * constants, plus their derived shades (hair shine, bow knot, boot trim,
 * dress fold light/dark, brow).
 */
export function animePalette(look: AnimeLook): string[] {
  return [
    look.skin,
    look.hair,
    look.dress,
    look.bow,
    look.eye ?? ANIME_EYE_DEFAULT,
    ANIME_BLUSH,
    ANIME_EYELASH,
    ANIME_MOUTH,
    ANIME_BOOT,
    ANIME_HIGHLIGHT,
    lightenHex(look.hair, 0.4), // hair shine band
    darkenHex(look.hair, 0.4), // brows
    lightenHex(look.dress, 0.35), // petticoat band
    darkenHex(look.dress, 0.3), // skirt folds
    darkenHex(look.bow, 0.3), // bow knot
    lightenHex(ANIME_BOOT, 0.3), // boot trim
  ];
}

/** Inclusive-axis helpers (mirror axis: x' = 31 - x on a 32-wide grid). */
function rect(
  g: PixelGrid,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  c: string,
): void {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) g[y][x] = c;
  }
}

/** Fill both mirrored rects (left x0..x1 and its mirror). */
function mirrorRect(
  g: PixelGrid,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  c: string,
): void {
  rect(g, x0, y0, x1, y1, c);
  rect(g, ANIME_GRID_SIZE - 1 - x1, y0, ANIME_GRID_SIZE - 1 - x0, y1, c);
}

/** Filled ellipse (inclusive-ish), centered at (cx, cy). */
function ellipse(
  g: PixelGrid,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  c: string,
): void {
  for (let y = Math.round(cy - ry); y <= Math.round(cy + ry); y++) {
    for (let x = Math.round(cx - rx); x <= Math.round(cx + rx); x++) {
      const dy = (y - cy) / ry;
      const dx = (x - cx) / rx;
      if (dy * dy + dx * dx <= 1) g[y][x] = c;
    }
  }
}

/**
 * Build one 32×32 chibi character. Drawing order is back-to-front:
 * back hair → wide face → fringe + shine → brows/eyes/blush/mouth → dress
 * (bodice, V-tapered bow, petticoat band, flared skirt, folds, scalloped
 * frill hem) → arms → feet → long side hair columns (long style only,
 * running from the lower head over the shoulders so they never float).
 * A fresh grid is returned; `look` is read, never mutated.
 */
export function buildAnimeCharacterGrid(look: AnimeLook): PixelGrid {
  const g = createGrid(ANIME_GRID_SIZE, ANIME_GRID_SIZE);
  const eye = look.eye ?? ANIME_EYE_DEFAULT;
  const hairShine = lightenHex(look.hair, 0.4);
  const brow = darkenHex(look.hair, 0.4);
  const dressLight = lightenHex(look.dress, 0.35);
  const dressDark = darkenHex(look.dress, 0.3);
  const bowKnot = darkenHex(look.bow, 0.3);
  const bootTrim = lightenHex(ANIME_BOOT, 0.3);

  // --- head (chibi: the head is ~half the sprite) --------------------------
  ellipse(g, 15.5, 10.5, 9, 8.5, look.hair); // back hair
  ellipse(g, 15.5, 13, 8, 7, look.skin); // wide face (the chibi face shows)
  // Fringe: solid band + four down-tips over the forehead.
  rect(g, 8, 6, 23, 9, look.hair);
  rect(g, 9, 10, 10, 10, look.hair);
  rect(g, 13, 10, 14, 10, look.hair);
  rect(g, 17, 10, 18, 10, look.hair);
  rect(g, 21, 10, 22, 10, look.hair);
  rect(g, 11, 3, 20, 4, hairShine); // gloss band (inside the hair at both rows)
  // Brows (thin, one row above the eyes).
  mirrorRect(g, 11, 12, 12, 12, brow);
  // Eyes: lash line, iris, rounded bottom, two gloss highlights per eye.
  mirrorRect(g, 10, 13, 13, 13, ANIME_EYELASH);
  mirrorRect(g, 10, 14, 13, 15, eye);
  mirrorRect(g, 11, 16, 12, 16, eye); // rounded bottom (corners stay face)
  g[14][11] = ANIME_HIGHLIGHT;
  g[15][12] = ANIME_HIGHLIGHT; // left-eye gloss
  g[14][20] = ANIME_HIGHLIGHT;
  g[15][19] = ANIME_HIGHLIGHT; // right-eye gloss (mirror)
  // Blush + small mouth.
  mirrorRect(g, 8, 15, 9, 16, ANIME_BLUSH);
  rect(g, 15, 17, 16, 17, ANIME_MOUTH);

  // --- dress ----------------------------------------------------------------
  rect(g, 11, 20, 20, 20, look.dress); // shoulders
  rect(g, 12, 20, 19, 22, look.dress); // bodice
  // Bow: wings tapering to a V + a darker knot over the chest.
  mirrorRect(g, 12, 20, 14, 20, look.bow);
  mirrorRect(g, 13, 21, 14, 21, look.bow);
  mirrorRect(g, 14, 22, 14, 22, look.bow);
  rect(g, 15, 21, 16, 22, bowKnot);
  // Petticoat peek + flared skirt with three fold lines...
  rect(g, 10, 23, 21, 23, dressLight);
  rect(g, 10, 24, 21, 24, look.dress);
  rect(g, 9, 25, 22, 26, look.dress);
  rect(g, 8, 26, 23, 26, look.dress);
  rect(g, 12, 24, 12, 26, dressDark);
  rect(g, 16, 24, 16, 26, dressDark);
  rect(g, 20, 24, 20, 26, dressDark);
  // ...and a scalloped frill hem (four lobes, 1px gaps).
  rect(g, 9, 27, 11, 27, look.dress);
  rect(g, 13, 27, 15, 27, look.dress);
  rect(g, 17, 27, 19, 27, look.dress);
  rect(g, 21, 27, 23, 27, look.dress);
  // Arms: little hands at the skirt's sides.
  mirrorRect(g, 9, 21, 10, 22, look.skin);

  // --- feet ------------------------------------------------------------------
  g[28][13] = look.skin; // legs (1px each)
  g[28][18] = look.skin;
  mirrorRect(g, 12, 29, 14, 30, ANIME_BOOT);
  rect(g, 12, 29, 14, 29, bootTrim);
  rect(g, 17, 29, 19, 29, bootTrim);

  // --- long side hair (long style only) --------------------------------------
  // Columns from the lower head over the shoulders — continuous, so the
  // strands can never float off the head the way separate tufts did.
  if (look.hairStyle === "long") {
    // Overlap the lower head (back hair reaches x 7 at y 14) so the columns
    // connect, and taper: outer column shortest, inner longest.
    mirrorRect(g, 6, 14, 6, 22, look.hair);
    mirrorRect(g, 7, 14, 8, 24, look.hair);
    mirrorRect(g, 9, 20, 9, 24, look.hair);
  }

  return g;
}
