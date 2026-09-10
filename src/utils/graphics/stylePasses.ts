/**
 * Draft art-style passes (todo: "draft a few different generated art styles
 * for characters and cosmetics"; see docs/art-styles.md).
 *
 * Each pass is a PURE PixelGrid -> PixelGrid transform over the SAME base
 * grids the live sprite pipeline builds (pixelArt.ts, caveTiles.ts). That is
 * the point of the draft: a new art "style" is a small function over color
 * grids, so adopting one later is a single hook point in the pixelArt cache
 * layer (before `gridToPngDataUri`), not a re-asset of every sprite.
 *
 * These passes are NOT wired into the app yet — they are the draft the art
 * decision picks from. `scripts/generate-art-style-samples.mjs` renders all
 * of them side by side into docs/art-styles/samples/.
 *
 * Contract for every pass:
 *  - same grid dimensions in and out;
 *  - never mutates its input (returns a fresh grid);
 *  - transparent stays semantically transparent (mono/retro16 keep nulls;
 *    outline may paint ink into null cells *adjacent to* filled ones —
 *    that IS the effect, and only there);
 *  - deterministic (no rng, no Date).
 */

import { createGrid, hexToRgb } from "./pixelArt";
import type { Pixel, PixelGrid } from "./pixelArt";

export type StylePassId = "flat" | "mono" | "retro16" | "outline";
export type StylePass = (grid: PixelGrid) => PixelGrid;

function copyGrid(grid: PixelGrid): PixelGrid {
 return grid.map((row) => [...row]);
}

/**
 * Style "flat" — the CURRENT in-game look: hand-placed pixel colors, no
 * post-processing. Listed as a pass so the draft set includes the baseline
 * the alternatives are judged against.
 */
export function flatPass(grid: PixelGrid): PixelGrid {
 return copyGrid(grid);
}

// ---------------------------------------------------------------------------
// Style "mono" — 1-bit woodcut: a 4×4 Bayer ordered-dither collapse to
// ink + paper. Reads like a printed poster / woodcut; strongest contrast,
// loses all color.
// ---------------------------------------------------------------------------

export const MONO_INK = "#1a1a1a";
export const MONO_PAPER = "#f4efe6";
/** The two non-transparent colors mono ever emits. */
export const MONO_COLORS: readonly [string, string] = [MONO_INK, MONO_PAPER];

/** Bayer 4×4 ordered-dither matrix (classic). */
const BAYER_4: number[][] = [
 [0, 12, 3, 15],
 [8, 14, 6, 10],
 [2, 10, 12, 4],
 [14, 6, 8, 16],
];

function luminance(hex: string): number {
 const [r, g, b] = hexToRgb(hex);
 return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

export function monoPass(grid: PixelGrid): PixelGrid {
 const out = createGrid(grid[0].length, grid.length);
 for (let y = 0; y < grid.length; y++) {
  for (let x = 0; x < grid[y].length; x++) {
   const px = grid[y][x];
   if (px == null) continue;
   const threshold = (BAYER_4[y % 4][x % 4] + 0.5) / 16;
   out[y][x] = luminance(px) >= threshold ? MONO_PAPER : MONO_INK;
  }
 }
 return out;
}

// ---------------------------------------------------------------------------
// Style "retro16" — console 8-bit: every color snaps to the nearest of a
// curated 16-color palette, so any sprite (miner, pickaxe, cave) reads as
// one cohesive limited-palette console.
// ---------------------------------------------------------------------------

/**
 * The curated 16: darks/stone, cloth, skins & furs, metals/gems, glows.
 * Chosen from the pools already in circulation (cosmetics.ts + caveTiles)
 * so real looks land close to their intended hue, not a random neighbor.
 */
export const RETRO16_PALETTE: readonly string[] = [
 "#1a1a1a", // near-black (eyes, outlines, deep dark)
 "#56565e", // stone gray
 "#3b4a6b", // denim blue
 "#4a3524", // boot brown
 "#8fa8b8", // cave slate
 "#5cb85c", // leaf green
 "#e07020", // ember orange
 "#4a90d9", // shirt blue
 "#e8c33d", // gold
 "#ffdbb4", // light skin
 "#8d5524", // dark skin
 "#a08058", // fur tan
 "#d9534f", // red
 "#bdeeff", // gem ice
 "#fff3b0", // glow
 "#f0f0f0", // off-white
];

export function retro16Pass(grid: PixelGrid): PixelGrid {
 const out = createGrid(grid[0].length, grid.length);
 const palette = RETRO16_PALETTE.map((hex) => ({ hex, rgb: hexToRgb(hex) }));
 for (let y = 0; y < grid.length; y++) {
  for (let x = 0; x < grid[y].length; x++) {
   const px = grid[y][x];
   if (px == null) continue;
   const [r, g, b] = hexToRgb(px);
   let best = 0;
   let bestDist = Infinity;
   for (let i = 0; i < palette.length; i++) {
    const [pr, pg, pb] = palette[i].rgb;
    const dr = r - pr;
    const dg = g - pg;
    const db = b - pb;
    const dist = dr * dr + dg * dg + db * db;
    if (dist < bestDist) {
     bestDist = dist;
     best = i;
    }
   }
   out[y][x] = palette[best].hex;
  }
 }
 return out;
}

// ---------------------------------------------------------------------------
// Style "outline" — cartoon cel: keep the base colors, but paint every
// empty cell that touches a filled one (8-way) with a near-black ink, so
// every sprite stands off the cave with a hand-inked edge.
// ---------------------------------------------------------------------------

export const OUTLINE_INK = "#14141a";

export function outlinePass(grid: PixelGrid): PixelGrid {
 const out = copyGrid(grid);
 const w = grid[0].length;
 const h = grid.length;
 for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
   if (grid[y][x] != null) continue;
   let neighbor = false;
   for (let dy = -1; dy <= 1 && !neighbor; dy++) {
    for (let dx = -1; dx <= 1 && !neighbor; dx++) {
     if (dx === 0 && dy === 0) continue;
     const ny = y + dy;
     const nx = x + dx;
     if (ny < 0 || ny >= h || nx < 0 || nx >= w) continue;
     neighbor = grid[ny][nx] != null;
    }
   }
   if (neighbor) out[y][x] = OUTLINE_INK;
  }
 }
 return out;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/** The draft set, in sheet order (baseline first). */
export const STYLE_IDS: readonly StylePassId[] = [
 "flat",
 "mono",
 "retro16",
 "outline",
];

export const STYLE_PASSES: Record<StylePassId, StylePass> = {
 flat: flatPass,
 mono: monoPass,
 retro16: retro16Pass,
 outline: outlinePass,
};

/** Apply one draft style to a base grid (fresh grid, input untouched). */
export function applyStyle(id: StylePassId, grid: PixelGrid): PixelGrid {
 return STYLE_PASSES[id](grid);
}

export type { Pixel, PixelGrid };
