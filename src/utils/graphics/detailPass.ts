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
 * Mix color `a` toward color `b` by fraction `t` (per channel, rounded
 * half-up at .5 — deterministic, no floating-point drift between passes).
 * t=0 returns `a` exactly; t=1 returns `b` exactly.
 */
export function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const c = (x: number, y: number): number =>
    Math.min(255, Math.max(0, Math.round(x + (y - x) * t)));
  const hex = (n: number): string => n.toString(16).padStart(2, "0");
  return `#${hex(c(ar, br))}${hex(c(ag, bg))}${hex(c(ab, bb))}`;
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

export type { PixelGrid };
