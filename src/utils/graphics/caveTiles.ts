/**
 * Cave background tile strips (plan §4.5 — replace the text-grid cave with a
 * memoized sprite layer). Each visible cave row is a horizontal strip of
 * small rock/crystal tiles, encoded to a PNG data URI through the same
 * runtime pipeline as the miner sprites (`pixelArt.ts`): no asset files, no
 * dependencies, and each unique (tint, tier, strip) combination is encoded
 * exactly once, so the rows rendered by `CaveBackground` are just cached
 * `<Image>` sources with zero per-frame React work.
 *
 * Colors are baked from the per-tier tint (which already reflects the
 * selected cave theme, `cosmetics.ts`), so themes keep working without any
 * image-side recoloring.
 *
 * The ROCK BODY is the only thing a direction gets to change
 * (`caveArt.ts`, the art-pack seam's rock side): the silhouette, the row /
 * band addressing and every object in the mine are the same in both
 * directions, so `setActiveArtPack("pixel")` brings the classic dithered
 * ramp back with the classic characters. `CAVE_ROCK_STYLES` below is the
 * registry; `rockPlaneValue` + `rockPlaneIndex` are the paper-cut
 * direction's own field, and they are geometry, not mark-making — they stay
 * here, next to the other fields, because they are sampled at global
 * pixels for exactly the same reason the silhouette is.
 */

import {
  createGrid,
  gridToPngDataUri,
  hashSeed,
  hline,
  hexToRgb,
  mulberry32,
  setPixel,
  stripSizeForWidth,
} from "./pixelArt";
import type { Pixel, PixelGrid } from "./pixelArt";
import { activeCaveArt } from "./artPack";
import {
  CAVE_ART_IDS,
  CAVE_ART_LABELS,
  PAPER_SHADOW_OFFSET,
  paintPaperRock,
  paperRockInk,
} from "./caveArt";
import type { CaveArtId, PaperInk } from "./caveArt";

export { CAVE_ART_IDS };
export type { CaveArtId };

/**
 * Minimum depth of each cave band. Mirrors `DEPTH_TIERS` in `game.ts` (a unit
 * test pins the two together).
 */
export const CAVE_TIER_ATS: number[] = [0, 10, 50, 150, 500];

/** Tiles per strip (the strip is stretched to the canvas width). */
export const CAVE_TILE_PX = 24;
/**
 * Minimum tiles across a strip. `buildCaveRow`/`caveRowUri` widen the strip
 * to the container width when given one (adaptive-width strips — the
 * encoder's multi-block stored-deflate path exists for this), floored at
 * this count so the default 14-tile layout (egg placement space included)
 * stays valid.
 */
export const CAVE_TILES_PER_ROW = 14;
/** Default strip width in source pixels (when the container width is unknown). */
export const CAVE_STRIP_WIDTH = CAVE_TILES_PER_ROW * CAVE_TILE_PX;
/**
 * Rows rendered from one strip generation pass…
 *
 * (History: rows used to CYCLE through CAVE_STRIPS_PER_TIER baked textures
 * per tier — `caveRowUri`'s strip = floor(depth) % 4 — which left a visible
 * 4-row texture cycle repeating forever. Rows are now keyed by ABSOLUTE row
 * index (every row unique; rolling cache below), but the constant is kept:
 * it still bounds per-tier test scans and matches the old texture-cycle
 * period, so "rows are 4 apart" remains a meaningful test stride.)
 */
export const CAVE_STRIPS_PER_TIER = 4;

/** Crystal density per tier — deeper bands glitter more. */
const GEM_CHANCE = [0.05, 0.08, 0.12, 0.1, 0.16];
/**
 * Share of pixels that are solid rock (the rest are empty gaps). The layout
 * is a domain-warped three-octave field (LAYOUT_FIELD below) thresholded at
 * GAP_LEVEL; ROCK_CHANCE is the target density GAP_LEVEL is calibrated to.
 */
export const ROCK_CHANCE = 0.62;
/**
 * Calibrated threshold of the layout field that yields ~ROCK_CHANCE rock at
 * PIXEL scale (measured over 5 tiers × a 400×200px sample: 0.622).
 */
export const GAP_LEVEL = 0.46;

/** One layout seed per tier — the layout is continuous down the whole wall. */
const LAYOUT_SEEDS = CAVE_TIER_ATS.map((_, t) => hashSeed(t * 7919, 0x1a70));

/**
 * The rock/gap layout field at a GLOBAL PIXEL: three octaves of value noise
 * (≈60px / 34px / 17px features) sampled through a low-frequency DOMAIN WARP.
 *
 * Two changes from the tile-level field it replaces, both aimed at visible
 * patterns:
 *
 *  - **Per pixel, not per tile.** The old field decided rock-vs-gap once per
 *    24px tile, so every rock mass was a staircase of tile-sized steps and a
 *    mass was chopped wherever it crossed a row boundary. Sampling at pixel
 *    scale makes the silhouette follow a smooth contour, and because the
 *    coordinates are global, one mass simply continues into the next row
 *    strip (and into the next row's PNG) with no seam at all.
 *  - **One seed per tier, not per row.** A per-row seed meant each 24px strip
 *    carried a completely different field, so nothing lined up vertically.
 *
 * The warp is the standard cure for value noise's residual regularity: the
 * octaves are sampled at displaced coordinates, which breaks the axis-aligned
 * lattice that otherwise reads as a repeating grid. Deterministic integer
 * math throughout.
 */
export function layoutField(px: number, py: number, tier: number): number {
  const s = LAYOUT_SEEDS[Math.max(0, Math.min(tier, LAYOUT_SEEDS.length - 1))];
  const wx = px + 14 * (valueNoise(px / 61, py / 47, s + 17) - 0.5);
  const wy = py + 14 * (valueNoise(px / 53, py / 67, s + 29) - 0.5);
  return (
    valueNoise(wx / 60, wy / 55, s) * 0.5 +
    valueNoise(wx / 34, wy / 30, s + 113) * 0.32 +
    valueNoise(wx / 17, wy / 15, s + 227) * 0.18
  );
}

/** Is there rock at this global pixel? */
export function isRockPixel(px: number, py: number, tier: number): boolean {
  return layoutField(px, py, tier) > GAP_LEVEL;
}
/**
 * Ore fleck density per tier — deeper mines carry more visible veins. The
 * flecks ride on rock only, so a gap tile never shows floating ore.
 */
const ORE_CHANCE = [0.05, 0.07, 0.1, 0.13, 0.16];
/**
 * Ore fleck palette. Fixed object colors (like the egg palettes), not
 * tint-derived — the veins read as metals regardless of the theme tint.
 */
const ORE_COLORS = ["#ffd24a", "#e08040", "#6ab8ff", "#50d080"];
/**
 * Rock shade-field seed per tier: every tier has its own rock body, but
 * rows within a tier SHARE the field (sampled at global pixel y — see
 * drawRockTile), so the rock is continuous down the wall instead of
 * banding every row.
 */
const SHADE_SEEDS = CAVE_TIER_ATS.map((_, t) => hashSeed(t * 7919, 0x5eed));
/**
 * Plane-field seed per tier (the paper-cut direction's own field). One per
 * tier for the same reason as the shade seeds: a depth band is cut from
 * its own sheet, while every row within the band shares the cut.
 */
const PLANE_SEEDS = CAVE_TIER_ATS.map((_, t) => hashSeed(t * 7919, 0x9a9e));
/**
 * Share of the two path (shaft) tiles that carry a loose rubble chunk. The
 * shaft is no longer a fully empty column — a few blocks sit under the
 * player so the miner reads as standing on dug-out ground, but the density
 * is far below ROCK_CHANCE so the path still reads as an opening.
 */
const PATH_RUBBLE_CHANCE = 0.55;

/** Highest tier whose minimum depth has been reached (clamped at the last). */
export function caveTierForDepth(depth: number): number {
  let tier = 0;
  for (let i = 0; i < CAVE_TIER_ATS.length; i++) {
    if (depth >= CAVE_TIER_ATS[i]) tier = i;
  }
  return tier;
}

// ---------------------------------------------------------------------------
// Continuous descent (background rework — "feel as if digging deeper"):
// the cave no longer slides one tile per tier; it descends PROPORTIONAL to
// absolute depth. The top of the window sits at world pixel
// `CAVE_PX_PER_METER * depth`, so every meter mined pushes the whole strip
// down; the strip re-indexes exactly one row per CAVE_METERS_PER_ROW meters
// (one full row of slide), so the descent reads as one continuous sink
// that speeds up as the player earns faster. Because rows are addressed by
// absolute depth, the next depth tier's rock is already sliding in from
// the bottom of the window before the tint changes.
// ---------------------------------------------------------------------------

/** How far (px) the cave descends per meter of depth. */
export const CAVE_PX_PER_METER = 6;

/** Meters of depth per full row of strip (CAVE_TILE_PX / CAVE_PX_PER_METER). */
export const CAVE_METERS_PER_ROW = CAVE_TILE_PX / CAVE_PX_PER_METER;

/**
 * The absolute cave-row index that lands at the top of the window once the
 * player has descended to `depth` (the window's rows are then
 * `caveRowStartForDepth(d), +1, +2, …` — deeper rows lower on screen).
 */
export function caveRowStartForDepth(depth: number | bigint): number {
  const d = BigInt(Math.floor(Number(depth)));
  return Number(d / BigInt(CAVE_METERS_PER_ROW));
}

/**
 * The strip's target translateY so the window top sits exactly at `depth`
 * (∈ [-CAVE_TILE_PX, 0]). Negative = the strip is shifted up against the
 * `rowStart` top, exposing the sub-row fraction of the descent. Pair with
 * `caveRowStartForDepth`; see CaveBackground.tsx for the animation
 * hand-off at row re-indexes.
 */
export function caveTranslateForDepth(
  depth: number | bigint,
  rowStart: number,
): number {
  return rowStart * CAVE_TILE_PX - CAVE_PX_PER_METER * Number(depth);
}

function toHexByte(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n)))
    .toString(16)
    .padStart(2, "0");
}

function toHexColor(r: number, g: number, b: number): string {
  return `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;
}

/** Linear mix of two hex colors, t = 0 → a, t = 1 → b. */
export function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return toHexColor(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

/** The three rock shades derived from a tier tint. */
export function rockShades(tint: string): [string, string, string] {
  return [mixHex(tint, "#ffffff", 0.25), tint, mixHex(tint, "#000000", 0.3)];
}

/** Bright crystal color derived from a tier tint. */
export function gemColor(tint: string): string {
  return mixHex(tint, "#ffffff", 0.6);
}

// ---------------------------------------------------------------------------
// Coherent value noise (the rock body). The old per-tile `rng()` shade
// pick made every 2×2 block an independent die roll — the background read
// as static. Sampling a smooth value-noise field at global block coords
// (shared across tiles AND strips via the (tier, strip) seed) makes the
// rock's light/dark structure continuous across tile boundaries, which is
// the standard trick for procedural rock/stone textures (value noise →
// fBm → shade ramp). Deterministic: the hash is pure integer math, so a
// given (tier, strip) always produces the same rock at any width.
// ---------------------------------------------------------------------------

/** Integer hash → [0,1). Fast, allocation-free, stable across platforms. */
function hash2i(x: number, y: number, seed: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 2246822519)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth 2D value noise (bilinear + smoothstep), [0,1). Exported for tests. */
export function valueNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash2i(xi, yi, seed);
  const b = hash2i(xi + 1, yi, seed);
  const c = hash2i(xi, yi + 1, seed);
  const d = hash2i(xi + 1, yi + 1, seed);
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
}

/**
 * Domain-warp offset for the rock body, in pixels. Two slow noise samples
 * displace the octave lookup coordinates; this is what stops bilinear value
 * noise from reading as a regular grid of blobs (the "pattern in the rock"
 * tell). Kept smooth (≈20px wavelength) so it never becomes its own pattern.
 */
function rockWarp(px: number, py: number, seed: number): [number, number] {
  return [
    px + 5 * (valueNoise(px / 23, py / 21, seed + 401) - 0.5),
    py + 5 * (valueNoise(px / 19, py / 26, seed + 733) - 0.5),
  ];
}

/**
 * Three-octave fBm of value noise, sampled at PIXEL coords through a domain
 * warp. Coherent across tiles AND rows: the same seed + global pixel x/y →
 * the same value, so widening the strip never reshuffles the rock and
 * consecutive row strips continue one body (tests pin both).
 *
 * The octaves are isotropic on purpose. They used to be anisotropic (fine in
 * x, slow in y) to read as sedimentary strata, but at 24px tiles that read
 * as vertical hatching — a fine repeated texture across the whole wall.
 * Isotropic octaves keep the rock coherent across row seams on their own
 * (the field is globally continuous), so the strata effect costs nothing.
 */
export function rockField(px: number, py: number, seed: number): number {
  const [wx, wy] = rockWarp(px, py, seed);
  return (
    valueNoise(wx / 7.5, wy / 7, seed) * 0.42 +
    valueNoise(wx / 3.4, wy / 3.1, seed + 101) * 0.34 +
    valueNoise(wx / 1.7, wy / 2.1, seed + 202) * 0.24
  );
}

/** Number of discrete shades in the rock ramp (dark → light). */
export const ROCK_SHADE_STEPS = 10;

/**
 * Quantized shade index (0 dark → ROCK_SHADE_STEPS-1 light) of the rock
 * field at a single PIXEL. A light per-pixel dither (keyed on GLOBAL pixel
 * coords, so it's stable across strips) is added before quantization so the
 * shade steps' borders wander pixel by pixel instead of marching in hard
 * lattice-aligned steps (the old per-2×2-block sampling + hard thresholds
 * read as a visible block pattern even though the field itself was
 * coherent). Ten steps keep the quantized bands thin enough that no 2×2
 * pixel cell sits flat in one shade — while the dither stays small enough
 * that the field still matches at strip-row seams (caveTiles.test pins both
 * properties).
 */
export function rockShadeIndex(px: number, py: number, seed: number): number {
  const dither = (hash2i(px, py, (seed ^ 0x5e57) | 0) - 0.5) * 0.02;
  const r = Math.max(0, Math.min(1, rockField(px, py, seed) + dither));
  return Math.min(
    ROCK_SHADE_STEPS - 1,
    Math.floor(r * ROCK_SHADE_STEPS),
  );
}

/**
 * The ROCK_SHADE_STEPS-color ramp from dark to light around a tier tint
 * (dark → base → light, so the middle steps sit on the tint itself).
 * `rockShades` (light/base/dark) is kept for the non-rock rock colors
 * (rubble, path edges, gems).
 */
export function rockShadeRamp(tint: string): string[] {
  const [light, base, dark] = rockShades(tint);
  const ramp: string[] = [];
  for (let i = 0; i < ROCK_SHADE_STEPS; i++) {
    const t = i / (ROCK_SHADE_STEPS - 1);
    ramp.push(
      t < 0.5
        ? mixHex(dark, base, t * 2)
        : mixHex(base, light, (t - 0.5) * 2),
    );
  }
  return ramp;
}

// ---------------------------------------------------------------------------
// The rock directions (caveArt.ts holds the paper-cut one). The strip
// pipeline below is identical in both: it asks the direction for a color
// per pixel and paints it. `classic` is the dithered ramp above, byte for
// byte; the paper-cut sheets take their color from `paintPaperRock`.
// ---------------------------------------------------------------------------

/**
 * The inks one rock direction paints with, for one tier tint. Both sets are
 * built (a dozen cheap mixes, once per strip) so the pipeline has one shape
 * to pass around; each direction reads only its own, except `rubble` which
 * both read — the loose chunks in the dug shaft are cut from the same stock
 * as the wall they sit against, so the shaft doesn't read as a hole in a
 * different material.
 */
export interface CaveRockInk {
  /** The classic 10-step dithered ramp, dark → light. */
  ramp: string[];
  /** The paper-cut stock: flat planes, lit cut core, cast shadow. */
  paper: PaperInk;
  /** Flat chunk colors for the shaft rubble (light / mid / dark). */
  rubble: readonly [string, string, string];
}

export function buildCaveRockInk(
  tint: string,
  art: CaveArtId,
): CaveRockInk {
  const paper = paperRockInk(tint);
  return {
    ramp: rockShadeRamp(tint),
    paper,
    rubble: art === "papercut" ? paper.planes : rockShades(tint),
  };
}

/**
 * The per-tier fields a direction samples, plus the silhouette reader the
 * paper-cut renderer needs for its cut edges and cast shadow.
 */
export interface CaveRockCtx {
  /** This tier's rock-shade seed (the classic field). */
  shadeSeed: number;
  /** This tier's plane seed (the paper-cut field). */
  planeSeed: number;
  /** Painted rock at a global pixel — silhouette minus the dug shaft. */
  rockAt: (x: number, y: number) => boolean;
}

/** One rock direction, wired into the strip pipeline. */
export interface CaveRockStyle {
  id: CaveArtId;
  label: string;
  /**
   * Paint one pixel of the rock body. `rock` is the silhouette at this
   * pixel, and `null` means leave the grid alone (an open gap).
   */
  paint(
    ink: CaveRockInk,
    x: number,
    y: number,
    rock: boolean,
    ctx: CaveRockCtx,
  ): string | null;
}

/**
 * The plane field: the value the paper-cut rock is CUT into sheets by.
 * Deliberately low frequency (≈86/44/17px features, wider than tall so the
 * sheets read as strata) through a domain warp — cut paper needs big flat
 * plates, and a fine field quantized into three planes is just mush. It
 * shares the load-bearing property of every other field in this file:
 * sampled at GLOBAL pixel coords with a per-tier seed, so a plate continues
 * across tile boundaries, row strips and wall bands with no seam.
 */
export function rockPlaneValue(px: number, py: number, seed: number): number {
  const wx = px + 20 * (valueNoise(px / 79, py / 57, seed + 7) - 0.5);
  const wy = py + 20 * (valueNoise(px / 67, py / 83, seed + 29) - 0.5);
  return (
    valueNoise(wx / 86, wy / 44, seed) * 0.5 +
    valueNoise(wx / 33, wy / 22, seed + 61) * 0.32 +
    valueNoise(wx / 17, wy / 15, seed + 137) * 0.18
  );
}

/**
 * Plane boundaries, calibrated for roughly a quarter / a half / a quarter of
 * the rock: the mid plane carries the wall and the two ends are the accents,
 * which is the balance a cut-paper stack wants. Pinned by the plane-area test
 * in caveTiles.test.ts.
 */
export const PLANE_EDGES = [0.4, 0.6] as const;

/** Plane index (0 lightest → 2 darkest) for a field value. */
export function rockPlaneIndex(value: number): number {
  return value < PLANE_EDGES[0] ? 0 : value < PLANE_EDGES[1] ? 1 : 2;
}

export const CAVE_ROCK_STYLES: Record<CaveArtId, CaveRockStyle> = {
  classic: {
    id: "classic",
    label: CAVE_ART_LABELS.classic,
    paint: (ink, x, y, rock, ctx) =>
      rock ? ink.ramp[rockShadeIndex(x, y, ctx.shadeSeed)] : null,
  },
  papercut: {
    id: "papercut",
    label: CAVE_ART_LABELS.papercut,
    paint: (ink, x, y, rock, ctx) =>
      paintPaperRock(ink.paper, x, y, {
        plane: rockPlaneIndex(rockPlaneValue(x, y, ctx.planeSeed)),
        // The row above, at the global pixel the world actually has there:
        // rows are addressed absolutely, so this never reads across a strip
        // boundary — that is what would print a lit line at every row seam.
        above: rockPlaneIndex(rockPlaneValue(x, y - 1, ctx.planeSeed)),
        rock,
        rockAt: ctx.rockAt,
      }),
  },
};

/**
 * Paint one row strip's rock at PIXEL resolution: every pixel whose layout
 * field clears GAP_LEVEL gets its direction's color, sampled at GLOBAL
 * pixel coords so the body continues seamlessly across tile boundaries,
 * row strips and the adaptive-width widening.
 *
 * Per-pixel is the whole point: the old version painted whole 24×24 tiles
 * whenever the tile's layout value cleared the threshold, which is what made
 * every rock mass a staircase of tile-sized steps ("regular blocks").
 * Returns the per-tile opaque-pixel counts so the caller can gate objects
 * (crystals, eggs) on there actually being rock under them.
 *
 * The silhouette is resolved ONCE into a small boolean window (two rows and
 * two columns of slack) rather than being re-sampled per question: the
 * paper-cut direction asks about neighbouring pixels (the lit cut edge) and
 * up to four more about the cast shadow, and a noise sample per question per
 * pixel is the kind of cost that shows up as a scroll hitch. The window is
 * what makes `ctx.rockAt` an array read.
 */
function drawRockStrip(
  grid: PixelGrid,
  rowStartY: number,
  tier: number,
  style: CaveRockStyle,
  ink: CaveRockInk,
  pathTiles: ReadonlySet<number>,
): number[] {
  const w = grid[0].length;
  const counts = new Array(w / CAVE_TILE_PX).fill(0);
  // Slack: 2px left/down for the shadow, 2px up for the lit edge's "the row
  // above" read (and the direction's own above-plane read).
  const maskW = w + PAPER_SHADOW_OFFSET;
  const maskH = CAVE_TILE_PX + PAPER_SHADOW_OFFSET;
  const maskTop = rowStartY - PAPER_SHADOW_OFFSET;
  const mask = new Uint8Array(maskW * maskH);
  for (let py = 0; py < maskH; py++) {
    const gy = maskTop + py;
    for (let px = 0; px < maskW; px++) {
      // The mined shaft stays open — the layout field runs through it, but
      // rock never does (the player digs this column), and neither does a
      // cast shadow: the shaft is a hole, not a sheet.
      if (pathTiles.has(Math.floor(px / CAVE_TILE_PX))) continue;
      if (isRockPixel(px, gy, tier)) mask[py * maskW + px] = 1;
    }
  }
  const ctx: CaveRockCtx = {
    shadeSeed: SHADE_SEEDS[tier],
    planeSeed: PLANE_SEEDS[tier],
    rockAt: (px, gy) =>
      px < 0 || px >= w || gy < maskTop || gy >= maskTop + maskH
        ? false
        : mask[(gy - maskTop) * maskW + px] === 1,
  };
  for (let py = 0; py < CAVE_TILE_PX; py++) {
    const gy = rowStartY + py;
    for (let px = 0; px < w; px++) {
      const rock = ctx.rockAt(px, gy);
      // The shaft is a hole, not a sheet: a path tile gets rubble (below)
      // and nothing else — no rock, and no cast shadow either. A shadow
      // thrown by the wall into the shaft would read as the shaft being
      // narrower than it is, and the path-edge stripe already draws the
      // separation there.
      if (!rock && pathTiles.has(Math.floor(px / CAVE_TILE_PX))) continue;
      const color = style.paint(ink, px, gy, rock, ctx);
      if (color == null) continue;
      grid[py][px] = color;
      if (rock) counts[Math.floor(px / CAVE_TILE_PX)]++;
    }
  }
  return counts;
}

/** A diamond crystal cluster with a white glint, centered on the tile. */
function drawGem(
  grid: PixelGrid,
  x0: number,
  rng: () => number,
  gem: string,
  sparkles: boolean,
): void {
  const cx = x0 + 12 + Math.floor(rng() * 5) - 2;
  const cy = 12 + Math.floor(rng() * 5) - 2;
  for (let dy = -4; dy <= 4; dy++) {
    const w = 4 - Math.abs(dy);
    hline(grid, cx - w, cx + w, cy + dy, gem);
  }
  setPixel(grid, cx - 2, cy - 2, "#ffffff");
  setPixel(grid, cx - 1, cy - 3, "#ffffff");
  if (sparkles) {
    for (let i = 0; i < 3; i++) {
      setPixel(
        grid,
        x0 + 1 + Math.floor(rng() * (CAVE_TILE_PX - 2)),
        1 + Math.floor(rng() * (CAVE_TILE_PX - 2)),
        "#ffffff",
      );
    }
  }
}

/**
 * The mined path (plan "Adjust"): the two middle tiles of a `count`-wide
 * strip, kept sparse (only loose rubble — no rock tiles, no gems, no
 * eggs) so the cave reads as one vertical shaft the player is mining down,
 * with dark wall edges on the tiles flanking it. Centered so the shaft
 * stays on screen mid as the strip widens adaptively.
 */
export function cavePathTiles(count: number): [number, number] {
  const mid = Math.floor(count / 2);
  return [mid - 1, mid];
}

/** Path tiles for the default (minimum) 14-tile strip. */
export const CAVE_PATH_TILES: readonly number[] =
  cavePathTiles(CAVE_TILES_PER_ROW);

/** Dark wall edge drawn on the inner side of the tiles flanking the path. */
export function pathEdgeColor(tint: string): string {
  return mixHex(tint, "#000000", 0.55);
}

/** One vline (pixelArt only exports hline). */
function vline(
  grid: PixelGrid,
  x: number,
  y0: number,
  y1: number,
  color: Pixel,
): void {
  for (let y = y0; y <= y1; y++) setPixel(grid, x, y, color);
}

// ---------------------------------------------------------------------------
// Easter eggs (plan "Adjust"): rare fixed objects sitting in the rock
// OUTSIDE the mined path. Deterministic per (tier, strip) — deliberately
// NOT seeded by the tint, so switching cave themes never relocates an egg
// (the cave contents are the same mine, repainted).
// ---------------------------------------------------------------------------

export const CAVE_EGG_KINDS = [
  "spider",
  "princess",
  "chest",
  "skeleton",
  "mole",
  "dwarf",
  "cave",
] as const;
export type CaveEggKind = (typeof CAVE_EGG_KINDS)[number];

/** Share of strips that carry an egg. */
const EGG_CHANCE = 0.25;

/**
 * Deterministic per (tier, strip, count): the egg's tile + kind, or null.
 * Rows cycle through the strips, so an egg reappears every
 * CAVE_STRIPS_PER_TIER rows — same texture-cycle discipline as the rock
 * strips themselves. The tile is picked from the strip's OUTER space
 * (every tile except the two centered path tiles), so an egg never lands
 * in the shaft; at the default `count` the space is the 14-tile one.
 */
export function eggForStrip(
  tier: number,
  strip: number,
  count = CAVE_TILES_PER_ROW,
): { tile: number; kind: CaveEggKind } | null {
  const seed = hashSeed(tier * 7919 + strip * 104729, 0x9e69);
  const rng = mulberry32(seed);
  if (rng() >= EGG_CHANCE) {
    return null;
  }
  const [pa, pb] = cavePathTiles(count);
  const outer: number[] = [];
  for (let tile = 0; tile < count; tile++) {
    if (tile !== pa && tile !== pb) outer.push(tile);
  }
  return {
    tile: outer[Math.floor(rng() * outer.length)],
    kind: CAVE_EGG_KINDS[Math.floor(rng() * CAVE_EGG_KINDS.length)],
  };
}

/**
 * A few small ore flecks in a rock tile (two-pixel veins). `isRock` gates
 * each fleck on the pixel actually having rock under it, so a vein on a
 * ragged silhouette edge never ends up floating in the gap.
 */
function drawOre(
  grid: PixelGrid,
  x0: number,
  rng: () => number,
  color: string,
  isRock: (px: number, py: number) => boolean,
): void {
  for (let i = 0; i < 4; i++) {
    const fx = x0 + 2 + Math.floor(rng() * (CAVE_TILE_PX - 4));
    const fy = 2 + Math.floor(rng() * (CAVE_TILE_PX - 4));
    for (let d = 0; d < 2; d++) {
      if (isRock(fx + d, fy)) setPixel(grid, fx + d, fy, color);
    }
  }
}

/**
 * Loose rubble for the path (shaft) tiles: 1–3 small chunks biased to the
 * LOWER half of the tile, so the blocks pile at the bottom of the shaft —
 * under the player, never over their head.
 */
function drawRubble(
  grid: PixelGrid,
  x0: number,
  rng: () => number,
  shades: readonly [string, string, string],
): void {
  const [, base, dark] = shades;
  const chunks = 1 + Math.floor(rng() * 3);
  for (let i = 0; i < chunks; i++) {
    const w = 2 + Math.floor(rng() * 3); // 2–4 px wide
    const h = 2 + Math.floor(rng() * 2); // 2–3 px tall
    const cx = x0 + 1 + Math.floor(rng() * (CAVE_TILE_PX - w - 2));
    const cy = 12 + Math.floor(rng() * (CAVE_TILE_PX - h - 12));
    const color = rng() < 0.4 ? dark : base;
    for (let dy = 0; dy < h; dy++) {
      hline(grid, cx, cx + w - 1, cy + dy, color);
    }
  }
}

/**
 * Draw one egg into the tile at `x0` (its 24×24 area), centered. Colors are
 * fixed (they're objects, not rock), so they don't depend on the tint.
 */
function drawEgg(grid: PixelGrid, x0: number, kind: CaveEggKind): void {
  if (kind === "spider") {
    // 4×3 dark body, red eyes, four leg stubs.
    const body = "#202020";
    for (let y = 11; y <= 13; y++) hline(grid, x0 + 10, x0 + 13, y, body);
    setPixel(grid, x0 + 10, 11, "#e03030");
    setPixel(grid, x0 + 13, 11, "#e03030");
    hline(grid, x0 + 5, x0 + 9, 12, body);
    hline(grid, x0 + 14, x0 + 18, 12, body);
    hline(grid, x0 + 6, x0 + 9, 14, body);
    hline(grid, x0 + 14, x0 + 17, 14, body);
  } else if (kind === "princess") {
    // Trapped princess: crown pixel row, skin head, pink dress triangle.
    hline(grid, x0 + 10, x0 + 13, 7, "#ffd24a");
    hline(grid, x0 + 11, x0 + 12, 8, "#f2c79b");
    hline(grid, x0 + 11, x0 + 12, 9, "#f2c79b");
    hline(grid, x0 + 11, x0 + 12, 10, "#ff7bb0");
    hline(grid, x0 + 10, x0 + 13, 11, "#ff7bb0");
    hline(grid, x0 + 9, x0 + 14, 12, "#ff7bb0");
  } else if (kind === "skeleton") {
    // Skeleton: white skull with dark eyes, spine and ribs below.
    const bone = "#e8e8e0";
    hline(grid, x0 + 10, x0 + 13, 8, bone);
    hline(grid, x0 + 10, x0 + 13, 9, bone);
    setPixel(grid, x0 + 11, 9, "#101010");
    setPixel(grid, x0 + 12, 9, "#101010");
    hline(grid, x0 + 11, x0 + 12, 10, bone);
    vline(grid, x0 + 12, 11, 15, bone);
    hline(grid, x0 + 9, x0 + 15, 12, bone);
    hline(grid, x0 + 10, x0 + 14, 14, bone);
    hline(grid, x0 + 10, x0 + 14, 16, bone);
  } else if (kind === "mole") {
    // Mole: brown round body, dark eyes, light snout.
    const fur = "#7a4a2a";
    hline(grid, x0 + 9, x0 + 14, 12, fur);
    hline(grid, x0 + 8, x0 + 15, 13, fur);
    hline(grid, x0 + 8, x0 + 15, 14, fur);
    hline(grid, x0 + 9, x0 + 14, 15, fur);
    hline(grid, x0 + 10, x0 + 13, 16, fur);
    setPixel(grid, x0 + 10, 13, "#101010");
    setPixel(grid, x0 + 13, 13, "#101010");
    setPixel(grid, x0 + 12, 15, "#d8b898");
  } else if (kind === "dwarf") {
    // Dwarf miner: steel helm, skin face, red beard.
    const skin = "#f2c79b";
    const beard = "#c03020";
    const helm = "#d8d8e0";
    hline(grid, x0 + 10, x0 + 13, 8, helm);
    hline(grid, x0 + 9, x0 + 14, 9, helm);
    hline(grid, x0 + 10, x0 + 13, 10, skin);
    setPixel(grid, x0 + 11, 10, "#101010");
    setPixel(grid, x0 + 12, 10, "#101010");
    hline(grid, x0 + 10, x0 + 13, 11, beard);
    hline(grid, x0 + 10, x0 + 13, 12, beard);
    hline(grid, x0 + 11, x0 + 12, 13, beard);
  } else {
    // Cave opening: a dark arch in the rock (the mine goes on).
    const dark = "#080808";
    hline(grid, x0 + 10, x0 + 13, 9, dark);
    for (let y = 10; y <= 16; y++) hline(grid, x0 + 9, x0 + 14, y, dark);
  }
}

/**
 * Build one full cave row: tiles of `CAVE_TILE_PX` × `CAVE_TILE_PX`,
 * `CAVE_TILES_PER_ROW` across by default, or — when `widthPx` is given —
 * widened to the nearest tile multiple at or above `widthPx` (clamped to
 * `STRIP_MAX_BLOCK_PX`, floored at the default count) so a container of
 * that width renders the strip with (near-)zero horizontal stretch. The
 * mined path stays centered at any width. `row` is the ABSOLUTE cave-row
 * index (deeper = larger), so every row is its own unique texture and
 * adjacent rows continue one rock body vertically. Deterministic in
 * (tier, row, tint, widthPx, art).
 *
 * `art` defaults to the ACTIVE art pack's rock direction (caveArt.ts), which
 * is what makes `setActiveArtPack("pixel")` bring the classic cave back with
 * the classic characters; pass it explicitly to render either one (tests,
 * the contact-sheet generator).
 */
export function buildCaveRow(
  tier: number,
  row: number,
  tint: string,
  widthPx?: number,
  art: CaveArtId = activeCaveArt(),
): PixelGrid {
  const t = Math.max(0, Math.min(tier, GEM_CHANCE.length - 1));
  const count =
    widthPx == null
      ? CAVE_TILES_PER_ROW
      : Math.max(
          CAVE_TILES_PER_ROW,
          Math.round(stripSizeForWidth(widthPx, CAVE_TILE_PX) / CAVE_TILE_PX),
        );
  const grid = createGrid(count * CAVE_TILE_PX, CAVE_TILE_PX);
  const style = CAVE_ROCK_STYLES[art] ?? CAVE_ROCK_STYLES.classic;
  const ink = buildCaveRockInk(tint, style.id);
  const gem = gemColor(tint);
  const [pa, pb] = cavePathTiles(count);
  const egg = eggForStrip(t, row, count);
  // Rock body first: the layout field is per PIXEL and global, so rock
  // masses cross tile and row boundaries instead of stepping along them.
  // `tileFill[t]` = opaque pixels in tile t, used to gate objects below.
  const tileFill = drawRockStrip(
    grid,
    row * CAVE_TILE_PX,
    t,
    style,
    ink,
    new Set([pa, pb]),
  );
  /** A tile with real rock under it — objects never float in a gap. */
  const solid = (tile: number): boolean =>
    tileFill[tile] > 0.5 * CAVE_TILE_PX * CAVE_TILE_PX;
  for (let tile = 0; tile < count; tile++) {
    const x0 = tile * CAVE_TILE_PX;
    const inPath = tile === pa || tile === pb;
    if (!inPath) {
      const seed = hashSeed(t * 7919 + row * 104729, 0x5eed + tile * 131);
      // Ore veins ride on rock only — with a per-pixel silhouette, check the
      // pixel itself, not the tile: a fleck on a ragged edge would float.
      if (
        tileFill[tile] > 0 &&
        mulberry32(hashSeed(seed, 4))() < ORE_CHANCE[t]
      ) {
        const color =
          ORE_COLORS[
            Math.floor(mulberry32(hashSeed(seed, 6))() * ORE_COLORS.length)
          ];
        drawOre(
          grid,
          x0,
          mulberry32(hashSeed(seed, 5)),
          color,
          (px, py) => isRockPixel(px, row * CAVE_TILE_PX + py, t),
        );
      }
      if (solid(tile) && mulberry32(hashSeed(seed, 2))() < GEM_CHANCE[t]) {
        drawGem(grid, x0, mulberry32(hashSeed(seed, 3)), gem, t >= 2);
      }
      if (solid(tile) && egg != null && egg.tile === tile) {
        drawEgg(grid, x0, egg.kind);
      }
    } else {
      // Dug shaft: sparse rubble chunks in the lower half so the player
      // stands on blocks instead of floating in an empty column.
      const seed = hashSeed(t * 7919 + row * 104729, 0x5eed + tile * 131);
      if (mulberry32(hashSeed(seed, 7))() < PATH_RUBBLE_CHANCE) {
        drawRubble(grid, x0, mulberry32(hashSeed(seed, 8)), ink.rubble);
      }
    }
    // Path wall edges: a dark 3px stripe on the inner side of the tiles
    // flanking the shaft, drawn even over gaps so the path reads clearly.
    if (tile === pa - 1) {
      for (let dx = CAVE_TILE_PX - 3; dx < CAVE_TILE_PX; dx++) {
        vline(grid, x0 + dx, 0, CAVE_TILE_PX - 1, pathEdgeColor(tint));
      }
    } else if (tile === pb + 1) {
      for (let dx = 0; dx < 3; dx++) {
        vline(grid, x0 + dx, 0, CAVE_TILE_PX - 1, pathEdgeColor(tint));
      }
    }
  }
  return grid;
}

// ---------------------------------------------------------------------------
// Foreground cave walls (todo 2026-07-14 #3 — full-screen background with
// parallax layers): short vertical rock columns for the screen's LEFT and
// RIGHT edges, rendered OVER the scrolling tile rows at a faster parallax
// rate so the shaft reads as being INSIDE the cave. Strips repeat
// vertically with period CAVE_WALL_TILE_H, so the wall can scroll any
// distance by wrapping within one period (the repeat makes the wrap
// content-seamless by construction — no row re-indexing needed).
// ---------------------------------------------------------------------------

/** Vertical repeat period of a wall strip (px). */
export const CAVE_WALL_TILE_H = CAVE_TILE_PX * 6;

/**
 * Adaptive wall column width for a container width: wide screens get
 * thicker walls, phones stay at one tile. 4px steps keep the pixel-art
 * grid crisp; clamped to [CAVE_TILE_PX, 96].
 */
export function caveWallWidthPx(width: number): number {
  if (!Number.isFinite(width) || width <= 0) return CAVE_TILE_PX;
  const target = Math.round(width / 28 / 4) * 4;
  return Math.min(96, Math.max(CAVE_TILE_PX, target));
}

/**
 * One wall strip: a `widthPx` × CAVE_WALL_TILE_H column of solid rock with
 * a jagged inner edge (the side facing the shaft), a dark edge accent along
 * the cut, a few ore flecks, and (deterministically) maybe a crystal.
 *
 * `band` is the strip's ABSOLUTE vertical band index — the wall scrolls like
 * the rows do, addressed by depth, so successive strips are different
 * textures instead of the same 144px strip repeating forever (the visible
 * vertical repeat). Both the rock field and the edge profile are sampled at
 * GLOBAL y = band * CAVE_WALL_TILE_H + py, so consecutive bands continue one
 * rock body and one edge line with no seam between them. Deterministic in
 * (side, tint, widthPx, band, art).
 *
 * The wall is the nearest rock, so it gets the direction's planes and the
 * cut edge keeps its dark accent in both: the cut faces the shaft (into the
 * light well), so it is the frame of the diorama and reads best dark, and a
 * cast shadow cannot be thrown into a hole that has to stay transparent.
 */
export function buildCaveWall(
  side: "left" | "right",
  tint: string,
  widthPx: number,
  band = 0,
  art: CaveArtId = activeCaveArt(),
): PixelGrid {
  const w = Math.max(CAVE_TILE_PX, Math.round(widthPx));
  const h = CAVE_WALL_TILE_H;
  const grid = createGrid(w, h);
  const edge = pathEdgeColor(tint);
  const gem = gemColor(tint);
  const bandY = band * h;
  const rng = mulberry32(
    hashSeed(
      w * 7919 + (side === "left" ? 31 : 97) + band * 104729,
      0x5eed,
    ),
  );
  // Base rock: the SAME coherent value-noise field as the tile rows (seeded
  // per side), so the wall reads as one rock body with the cave behind it,
  // and sampled at global y so consecutive bands continue it.
  // No per-strip fade: a fade would print a dark line at every band seam.
  const wallSeed = hashSeed(w * 7919 + (side === "left" ? 31 : 97), 0x5eed + 1);
  const style = CAVE_ROCK_STYLES[art] ?? CAVE_ROCK_STYLES.classic;
  const ink = buildCaveRockInk(tint, style.id);
  // The wall is solid before the cut, so its silhouette reads as "always
  // rock": the direction paints planes and lips, and the cut is applied
  // below (which is also why no cut edge can be lit inside this loop).
  const ctx: CaveRockCtx = {
    shadeSeed: wallSeed,
    planeSeed: wallSeed,
    rockAt: () => true,
  };
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      // The wall is solid here, so every direction returns a plane — the
      // `?? edge` is only the type guard, never a color you can see.
      const c = style.paint(ink, px, bandY + py, true, ctx);
      setPixel(grid, px, py, c ?? edge);
    }
  }
  // A few ore flecks anywhere (the cut below may clip some — that reads
  // as veins running into the shaft edge).
  const flecks = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < flecks; i++) {
    const fx = 2 + Math.floor(rng() * Math.max(1, w - 6));
    const fy = 2 + Math.floor(rng() * (h - 4));
    const color = ORE_COLORS[Math.floor(rng() * ORE_COLORS.length)];
    for (let dy = 0; dy < 2; dy++) hline(grid, fx, fx + 1, fy + dy, color);
  }
  // Occasional crystal, also drawn before the cut (same clipping logic).
  if (rng() < 0.3) {
    const gx = 3 + Math.floor(rng() * Math.max(1, w - 8));
    const gy = 8 + Math.floor(rng() * (h - 18));
    for (let dy = -1; dy <= 1; dy++) {
      hline(grid, gx - 1 + Math.abs(dy), gx + 1 - Math.abs(dy), gy + dy, gem);
    }
    setPixel(grid, gx, gy, "#ffffff");
  }
  // Jagged inner edge: a mean-reverting random walk over GLOBAL y, so it is
  // organic, never pins to one depth (the old walk drifted into a flat
  // diagonal cliff), and continues across band boundaries instead of
  // restarting every strip. At least 12px of rock survives on the outer side.
  const maxCut = w - 12;
  const targetCut = Math.max(2, Math.floor(w / 4));
  let cut = targetCut;
  for (let y = 0; y < h; y++) {
    const gy = bandY + y;
    const pull = (targetCut - cut) / 6;
    const step =
      Math.round(
        (valueNoise(gy / 23, side === "left" ? 0.5 : 9.5, wallSeed + 5) - 0.5) *
          7,
      ) + Math.round((rng() - 0.5) * 3);
    // Floor of 1: the inner edge must always open at least one pixel, or a
    // stray row paints solid rock across the shaft side of the wall.
    cut = Math.max(1, Math.min(maxCut, cut + step + pull));
    if (side === "left") {
      // Inner edge = the strip's RIGHT side: clear the rightmost cut px.
      for (let x = w - cut; x < w; x++) grid[y][x] = null;
      grid[y][w - cut - 1] = edge;
    } else {
      // Inner edge = the LEFT side: clear the leftmost cut px.
      for (let x = 0; x < cut; x++) grid[y][x] = null;
      grid[y][cut] = edge;
    }
  }
  return grid;
}

// ---------------------------------------------------------------------------
// Caching + public API
// ---------------------------------------------------------------------------

const cache = new Map<string, string>();
/**
 * Rolling-cache span for the wall bands: the wall layer shows ~4 bands per
 * screen, so a span of ~24 covers the window plus slack. Wall keys are
 * `wall|side|width|tint|art|band`; the band is after the last pipe, and ROW
 * keys are `<width>|<tint>|<tier>|<art>|<row>` — the two evictions share one
 * Map but each only touches its own prefix, so they can't delete each other's
 * rows.
 */
const WALL_CACHE_SPAN = 24;
/** Deepest absolute wall band requested so far (the wall descends monotonically). */
let wallHighWater = Number.NEGATIVE_INFINITY;
/**
 * Rolling-cache span (rows): the window shows ~26 rows per layer and the
 * far layer lags at half speed, so a span of ~3 windows covers both plus
 * slack. Rows older than `highWater - ROW_CACHE_SPAN` are evicted on each
 * insert. The span is what bounds memory despite every row being unique
 * (a row URI is a few KB, so 96 rows ≈ <1 MB per theme/width).
 */
const ROW_CACHE_SPAN = 96;
/** Deepest absolute row requested so far (rows descend monotonically). */
let rowHighWater = Number.NEGATIVE_INFINITY;

/** Drop all cached cave-row PNGs (escape hatch for tests / low-memory). */
export function clearCaveTileCache(): void {
  cache.clear();
  rowHighWater = Number.NEGATIVE_INFINITY;
  wallHighWater = Number.NEGATIVE_INFINITY;
}

/**
 * Cached PNG data URI for the cave row visible at a given absolute depth,
 * theme tint and container width. Rows are keyed by their ABSOLUTE index
 * (`caveRowStartForDepth`) — every row is a unique texture, so the cave
 * never shows a repeating texture cycle (the old `% CAVE_STRIPS_PER_TIER`
 * key left a visible 4-row repeat). The cache rolls with the descent:
 * rows more than ROW_CACHE_SPAN behind the deepest row requested are
 * evicted, so memory stays bounded while the window + far layer scroll.
 * A shaft-sinking reset (depth → 0) leaves the deep rows cached until the
 * new run descends past the span again — bounded, self-healing.
 *
 * `art` is in the key (before the row, which stays last for the rolling
 * eviction), so a live pack swap can never serve the other direction's
 * rock out of the cache.
 */
/**
 * The WIDTH the cave strips are actually generated at (2026-10-04).
 *
 * `caveRowUri`'s cache key includes the generation width, so a container
 * whose width changed generates a whole new set of strips — and generating
 * one is not cheap (build the grid, then PNG-encode it). Rotating a phone
 * changed the width from ~416 to ~920, missed every row in the cache, and
 * rebuilt the whole cave synchronously on the JS thread: the UI froze for
 * several seconds before the rotated layout could paint.
 *
 * Snapping to powers of two (min 512) means a phone's portrait and
 * landscape both land on ONE of a handful of buckets, so the second time
 * you rotate it is a cache hit and the layout comes back instantly. The
 * strips are drawn with `resizeMode="stretch"` to the real container width
 * anyway, so generating WIDER than asked (a downscale, which stays sharp)
 * is free visually — the only cost is that the rock grain reads a little
 * finer than a native-resolution strip.
 *
 * This does not change `stripSizeForWidth` (which stays the fine,
 * cell-multiple quantiser its callers and tests rely on) — this is the
 * coarser ladder the cave asks it to round UP to.
 */
export const CAVE_GEN_WIDTH_MIN = 512;

export function caveStripWidthFor(widthPx: number): number {
  const w = Math.max(CAVE_GEN_WIDTH_MIN, Math.ceil(widthPx));
  // Next power of two, so a handful of buckets cover every device.
  const bucket = 2 ** Math.ceil(Math.log2(w));
  // Keep the cell multiple so buildCaveRow's cell maths is unchanged.
  const cells = Math.ceil(bucket / CAVE_TILE_PX);
  return cells * CAVE_TILE_PX;
}

export function caveRowUri(opts: {
  depth: number;
  tint: string;
  /** Container width in px; widens the strip adaptively (see buildCaveRow). */
  widthPx?: number;
  /** Rock direction; defaults to the active art pack's (see caveArt.ts). */
  art?: CaveArtId;
}): string {
  const depth = Math.floor(opts.depth);
  const tier = caveTierForDepth(depth);
  const row = caveRowStartForDepth(depth);
  const width = opts.widthPx ?? 0;
  const art = opts.art ?? activeCaveArt();
  const key = `${width}|${opts.tint}|${tier}|${art}|${row}`;
  let uri = cache.get(key);
  if (uri == null) {
    uri = gridToPngDataUri(
      buildCaveRow(tier, row, opts.tint, opts.widthPx, art),
    );
    if (row > rowHighWater) rowHighWater = row;
    cache.set(key, uri);
    const floor = rowHighWater - ROW_CACHE_SPAN;
    if (Number.isFinite(floor)) {
      for (const k of cache.keys()) {
        if (k.startsWith("wall|")) continue; // wall bands roll separately
        // Keys are `${width}|${tint}|${tier}|${art}|${row}`; the row is the
        // part after the last pipe (tint is a hex color, never has a '|').
        const lastPipe = k.lastIndexOf("|");
        const r = Number(k.slice(lastPipe + 1));
        if (Number.isFinite(r) && r < floor) cache.delete(k);
      }
    }
  }
  return uri;
}

/**
 * Cached PNG data URI for ONE band of a foreground cave-wall strip (todo #3).
 *
 * Bands are addressed by absolute depth like the rows (`band`), so the wall
 * scrolls as unique textures instead of one strip repeating forever. Its
 * cache rolls the same way: entries older than WALL_CACHE_SPAN bands behind
 * the deepest band requested are evicted. A wall strip is `widthPx` × 144 px
 * (≈1 KB), so the span costs well under a megabyte per theme/width.
 */
export function caveWallUri(opts: {
  tint: string;
  side: "left" | "right";
  /** Container width in px — sizes the column (see caveWallWidthPx). */
  widthPx?: number;
  /** Absolute band index (floor of the wall's world px / CAVE_WALL_TILE_H). */
  band?: number;
  /** Rock direction; defaults to the active art pack's (see caveArt.ts). */
  art?: CaveArtId;
}): string {
  const w = caveWallWidthPx(opts.widthPx ?? 0);
  const band = Math.floor(opts.band ?? 0);
  const art = opts.art ?? activeCaveArt();
  const key = `wall|${opts.side}|${w}|${opts.tint}|${art}|${band}`;
  let uri = cache.get(key);
  if (uri == null) {
    uri = gridToPngDataUri(buildCaveWall(opts.side, opts.tint, w, band, art));
    cache.set(key, uri);
    if (band > wallHighWater) wallHighWater = band;
    const floor = wallHighWater - WALL_CACHE_SPAN;
    if (Number.isFinite(floor)) {
      for (const k of cache.keys()) {
        if (!k.startsWith("wall|")) continue;
        const b = Number(k.slice(k.lastIndexOf("|") + 1));
        if (Number.isFinite(b) && b < floor) cache.delete(k);
      }
    }
  }
  return uri;
}

export type { Pixel, PixelGrid };
