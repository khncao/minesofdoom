/**
 * Detailed-art draft pass (todo: "draft improved generated graphics (more
 * detailed pixel art)"; see docs/art-detail.md).
 *
 * The current in-game art (pixelArt.ts / caveTiles.ts) is flat: every
 * region is one hand-placed color with no shading, so a 16×16 sprite reads
 * like a flat icon. This draft answers "what if the SAME base grids had
 * detail?" with a pure, deterministic PixelGrid -> PixelGrid transform
 * instead of re-authoring every grid by hand:
 *
 *   - a top-left light source;
 *   - a filled pixel whose LEFT or TOP neighbor is empty is a lit edge →
 *     its color is mixed toward white;
 *   - a filled pixel whose RIGHT or BOTTOM neighbor is empty is a shadow
 *     edge → its color is mixed toward black;
 *   - a thin part (lit AND shadow, e.g. a 1px-wide arm or 1px-tall bar)
 *     keeps its base color — beveling a one-pixel part just smears it;
 *   - interior pixels (all four neighbors filled) keep their base color;
 *   - empty pixels are never written.
 *
 * The pass also carries the two identity-preserving extensions the game
 * needed (both optional; the base pass above is unchanged without them):
 *
 *   - `mask` dithers edges into the transparent background — the bevel
 *     pass alone leaves sprites floating on a hard silhouette, which
 *     reads worse than flat at the 16px game scale; a checkerboard of
 *     base color and transparent is the classic way to soften a 1px
 *     boundary, and it keeps the sprite's footprint inside its grid;
 *   - `paletteMap` remaps identity colors to new hex values BEFORE the
 *     lighting pass runs, so the bevel derives its shades from the
 *     remapped color. This is what lets the pass carry the game's
 *     cosmetic skins (gold stays gold, bronze stays bronze — see the
 *     guardrail in game.ts) while changing their identity.
 *
 * The result is the same silhouette and the same identity colors on every
 * "flat" part — the detail rides entirely on the derived edge tones, so a
 * cosmetic's gold stays gold, a skin's tone stays that tone, and adopting
 * the look is one hook point in the cache layer (after the grid is built,
 * before `gridToPngDataUri`), exactly like the style passes in
 * stylePasses.ts (which this composes with: detail first, then style).
 *
 * NOT wired into the app — this is the draft the decision picks from.
 * `scripts/generate-detailed-art-samples.mjs` renders flat vs. detailed
 * side by side into docs/art-detail/samples/.
 *
 * Contract for the pass:
 *  - same grid dimensions in and out;
 *  - never mutates its input (returns a fresh grid);
 *  - empty cells stay empty;
 *  - every output color is either a base color from the input or a
 *    derived lighten/darken of one (identity is never lost);
 *  - deterministic (no rng, no Date).
 */

import { hexToRgb } from "./pixelArt";
import type { PixelGrid } from "./pixelArt";

export interface DetailOptions {
 /** How far lit (left/top-facing) edge pixels mix toward white (0..1). */
 highlight: number;
 /** How far shadow (right/bottom-facing) edge pixels mix toward black (0..1). */
 shadow: number;
}

/** The "detailed" look — a visible bevel at the 16px game scale. */
export const DETAIL_STRONG: DetailOptions = { highlight: 0.45, shadow: 0.3 };
/** The "detailed-soft" look — a whisper of roundness, flatter overall. */
export const DETAIL_SOFT: DetailOptions = { highlight: 0.28, shadow: 0.18 };

/**
 * Mix color `a` toward color `b` by fraction `t` (per channel). The mix is
 * done in integer space with per-channel truncation of the *difference*
 * (not the product), which pins down three properties the float+round
 * version could not guarantee:
 *
 *   - t=0 returns `a` exactly; t=1 returns `b` exactly;
 *   - every channel of the result stays in [min(a,b), max(a,b)] — the
 *     truncated step can never overshoot the target;
 *   - repeated partial moves toward the same target never reach it early:
 *     for a channel distance d ≥ 2 and t strictly inside (0,1) with
 *     d*t an integer gap (the FP boundary t → 1 aside), trunc(d·t) < d, so
 *     the first move lands strictly short of `b`, and a second move from
 *     there can at most close the remainder — the combined step is
 *     trunc(d·t₁) + trunc(remainder·t₂) ≤ d.
 *     The old Math.round version could land on `b` at t = 0.5 for any
 *     1-channel distance (round(1·0.5) = 1), i.e. a half step consumed the
 *     whole difference.
 */
export function mixHex(a: string, b: string, t: number): string {
 const [ar, ag, ab] = hexToRgb(a);
 const [br, bg, bb] = hexToRgb(b);
 const c = (x: number, y: number): number => {
  const d = y - x;
  const step = Math.floor(Math.abs(d) * t) * (d < 0 ? -1 : 1);
  return Math.min(255, Math.max(0, x + step));
 };
 const hex = (n: number): string => n.toString(16).padStart(2, "0");
 return `#${hex(c(ar, br))}${hex(c(ag, bg))}${hex(c(ab, bb))}`;
}

/**
 * Build the dither mask for `grid`: for every *boundary* pixel (a filled
 * pixel with at least one empty orthogonal neighbor), `1` at the
 * checkerboard cell (x + y) % 2 === 0, `2` elsewhere, `0` for interior
 * pixels. The mask feeds `makeDetailedSprite` so the bevel pass and the
 * dither pass agree on which pixels are boundaries — recomputing the
 * boundary test in each pass independently drifted and left isolated
 * transparent holes in the output.
 */
export function buildDitherMask(grid: PixelGrid): number[][] {
 const h = grid.length;
 const w = grid[0].length;
 const mask: number[][] = Array.from({ length: h }, () =>
  new Array<number>(w).fill(0),
 );
 for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
   const px = grid[y][x];
   if (px == null) continue;
   const boundary =
    x === 0 ||
    x === w - 1 ||
    y === 0 ||
    y === h - 1 ||
    grid[y][x - 1] == null ||
    grid[y][x + 1] == null ||
    grid[y - 1]?.[x] == null ||
    grid[y + 1]?.[x] == null;
   if (!boundary) continue;
   mask[y][x] = (x + y) % 2 === 0 ? 1 : 2;
  }
 }
 return mask;
}

/**
 * One stop of the detail pipeline: palette remap (optional), the bevel
 * pass, and the dither mask (optional). This is the single entry point
 * the rest of the game calls so the three steps can't drift out of sync.
 */
export function applyDetailPass(
 grid: PixelGrid,
 opts: {
  detail: DetailOptions;
  mask?: PixelGrid | null;
  paletteMap?: Record<string, string> | null;
 },
): PixelGrid {
 let g: PixelGrid = grid;
 if (opts.paletteMap) {
  g = g.map((row) =>
   row.map((cell) =>
    cell != null && opts.paletteMap![cell] ? opts.paletteMap![cell]! : cell,
   ),
  );
 }
 const beveled = detailPass(g, opts.detail);
 if (!opts.mask) return beveled;
 // Compute the boundary dither map once — per-pixel recomputation was an
 // O(n²) pass over an O(n) grid (and the two passes must agree on which
 // pixels are boundaries, so they share this single source of truth).
 const dither = buildDitherMask(beveled);
 const h = beveled.length;
 const w = beveled[0].length;
 const out: PixelGrid = beveled.map((row) => [...row]);
 for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
   if (opts.mask[y][x] != null) continue;
   if (dither[y][x] % 2 === 1) out[y][x] = null;
  }
 }
 return out;
}

export function lightenHex(hex: string, t: number): string {
 return mixHex(hex, "#ffffff", t);
}

export function darkenHex(hex: string, t: number): string {
 return mixHex(hex, "#000000", t);
}

/**
 * Apply the detail pass to `grid` with the given light amounts (fresh
 * grid, input untouched — see the module contract).
 */
export function detailPass(
 grid: PixelGrid,
 opts: DetailOptions = DETAIL_STRONG,
): PixelGrid {
 const h = grid.length;
 const w = grid[0].length;
 const out: PixelGrid = grid.map((row) => [...row]);
 for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
   const px = grid[y][x];
   if (px == null) continue;
   const lit = x === 0 || grid[y][x - 1] == null || grid[y - 1]?.[x] == null;
   const shadow =
    x === w - 1 ||
    grid[y][x + 1] == null ||
    (y === h - 1 ? true : grid[y + 1][x] == null);
   if (lit && shadow) continue; // thin part: keep base
   if (lit) {
    out[y][x] = lightenHex(px, opts.highlight);
   } else if (shadow) {
    out[y][x] = darkenHex(px, opts.shadow);
   }
  }
 }
 return out;
}

/** The "detailed" draft: visible top-left bevel. */
export function detailedPass(grid: PixelGrid): PixelGrid {
 return detailPass(grid, DETAIL_STRONG);
}

/** The "detailed-soft" draft: subtle bevel, flatter overall. */
export function detailedSoftPass(grid: PixelGrid): PixelGrid {
 return detailPass(grid, DETAIL_SOFT);
}

export interface DetailedSpriteOptions {
 detail: DetailOptions;
 /** When set, boundary pixels dither toward transparent (see buildDitherMask). */
 mask?: PixelGrid | null;
 /** When set, identity colors are remapped before the bevel pass. */
 paletteMap?: Record<string, string> | null;
}

export function makeDetailedSprite(
 grid: PixelGrid,
 opts: DetailedSpriteOptions,
): PixelGrid {
 return applyDetailPass(grid, opts);
}

export type { PixelGrid };
