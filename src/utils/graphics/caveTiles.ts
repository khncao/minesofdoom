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
 * Share of tiles that are solid rock (the rest are empty gaps). The
 * layout itself is a two-octave coherent value-noise field (GAP_FIELD below)
 * thresholded at GAP_LEVEL; ROCK_CHANCE is the target density that
 * GAP_LEVEL is calibrated to.
 */
export const ROCK_CHANCE = 0.62;
/** Calibrated threshold of the gap field that yields ~ROCK_CHANCE rock. */
export const GAP_LEVEL = 0.468;

/**
 * The rock/gap layout field at (tile, absolute row, tier): two octaves of
 * value noise at TILE scale — a low octave (~2.5-tile features) so the
 * layout drifts coherently down the wall, and a high octave (~1.6-tile)
 * so gaps scatter inside the rock instead of marching in long clumps. The
 * y coord is the ABSOLUTE row (scaled), so the field is unique per row:
 * rows are no longer cycled textures. Deterministic integer-seeded math.
 */
export function gapField(tile: number, row: number, tier: number): number {
  const s = hashSeed(tier * 7919 + row * 104729, 61);
  return (
    valueNoise(tile / 2.5, (tier * 40 + row) / 1.4, s) * 0.62 +
    valueNoise(tile / 1.6, (tier * 40 + row) / 0.52, s + 113) * 0.38
  );
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
 * Three-octave fBm of value noise, sampled at PIXEL coords. Coherent
 * across tiles: the same (tier, strip) seed + global pixel x/y → the same
 * value, so widening the strip (adaptive width) never reshuffles the rock.
 * Exported for tests.
 */
export function rockField(px: number, py: number, seed: number): number {
  return (
    valueNoise(px / 7, py / 7, seed) * 0.4 +
    valueNoise(px / 3.2, py / 4.5, seed + 101) * 0.2 +
    // Every octave is anisotropic — fine in x, slow in y — so the rock
    // reads as sedimentary strata: the fine octaves break up 2×2 pixel
    // cells horizontally while the slow y-scale keeps adjacent rows in
    // the same shade (no per-row banding at strip seams).
    valueNoise(px / 1.6, py / 6, seed + 202) * 0.4
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

/**
 * One 24×24 rock tile: per-pixel coherent shade noise (from the shared
 * strip field, so neighbouring tiles continue the same rock body) with a
 * slight bottom falloff. `x0` is the tile's global pixel column; the shade
 * is `rockShadeIndex(x0 + px, py, seed)`, so the field is continuous across
 * tile boundaries.
 */
function drawRockTile(
  grid: PixelGrid,
  x0: number,
  y0: number,
  seed: number,
  ramp: string[],
): void {
  // The shade field is sampled at GLOBAL pixel coords (y0 + py), so the
  // rock body continues seamlessly from one row strip into the next. (The
  // old per-row seed + per-row bottom fade reset every 24px and read as a
  // repeating dark stripe at every row boundary.)
  for (let py = 0; py < CAVE_TILE_PX; py++) {
    const gy = y0 + py;
    for (let px = 0; px < CAVE_TILE_PX; px++) {
      const shade = ramp[rockShadeIndex(x0 + px, gy, seed)];
      setPixel(grid, x0 + px, py, shade);
    }
  }
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

/** A few small ore flecks in a rock tile (two-pixel veins). */
function drawOre(
  grid: PixelGrid,
  x0: number,
  rng: () => number,
  color: string,
): void {
  for (let i = 0; i < 4; i++) {
    const fx = x0 + 2 + Math.floor(rng() * (CAVE_TILE_PX - 4));
    const fy = 2 + Math.floor(rng() * (CAVE_TILE_PX - 4));
    setPixel(grid, fx, fy, color);
    setPixel(grid, fx + 1, fy, color);
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
  shades: [string, string, string],
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
 * (tier, row, tint, widthPx).
 */
export function buildCaveRow(
  tier: number,
  row: number,
  tint: string,
  widthPx?: number,
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
  const shades = rockShades(tint);
  const ramp = rockShadeRamp(tint);
  const gem = gemColor(tint);
  const [pa, pb] = cavePathTiles(count);
  const egg = eggForStrip(t, row, count);
  for (let tile = 0; tile < count; tile++) {
    const x0 = tile * CAVE_TILE_PX;
    const inPath = tile === pa || tile === pb;
    if (!inPath) {
      const seed = hashSeed(t * 7919 + row * 104729, 0x5eed + tile * 131);
      // Rock/gap layout: a TWO-OCTAVE coherent field (GAP_FIELD), NOT an
      // independent per-tile die roll (the old roll scattered
      // checkerboard-style) and not a single low-frequency octave either
      // (that clumped each row into one or two big rock masses — the
      // "regular blocks" pattern). The high octave scatters gaps inside
      // the clumps while the low octave keeps the layout coherent down
      // the wall. Absolute row in the y coord: every row is unique, no
      // texture cycle.
      const gap = gapField(tile, row, t);
      if (gap > GAP_LEVEL) {
        // Coherent rock: the shade field is seeded per tier and sampled at
        // GLOBAL pixel coords, so adjacent tiles, the adaptive-width
        // widening, and the row strips below/above continue the same rock
        // body instead of each tile/row being an independent die roll.
        drawRockTile(grid, x0, row * CAVE_TILE_PX, SHADE_SEEDS[t], ramp);
        // Ore veins ride on rock only — a gap tile never shows floating ore.
        if (mulberry32(hashSeed(seed, 4))() < ORE_CHANCE[t]) {
          const color =
            ORE_COLORS[
              Math.floor(mulberry32(hashSeed(seed, 6))() * ORE_COLORS.length)
            ];
          drawOre(grid, x0, mulberry32(hashSeed(seed, 5)), color);
        }
      }
      if (mulberry32(hashSeed(seed, 2))() < GEM_CHANCE[t]) {
        drawGem(grid, x0, mulberry32(hashSeed(seed, 3)), gem, t >= 2);
      }
      if (egg != null && egg.tile === tile) {
        drawEgg(grid, x0, egg.kind);
      }
    } else {
      // Dug shaft: sparse rubble chunks in the lower half so the player
      // stands on blocks instead of floating in an empty column.
      const seed = hashSeed(t * 7919 + row * 104729, 0x5eed + tile * 131);
      if (mulberry32(hashSeed(seed, 7))() < PATH_RUBBLE_CHANCE) {
        drawRubble(grid, x0, mulberry32(hashSeed(seed, 8)), shades);
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
 * a jagged inner edge (the side facing the shaft) cut in 2px steps, a dark
 * edge accent along the cut, a few ore flecks, and (deterministically)
 * maybe a crystal. Deterministic in (side, tint, widthPx).
 */
export function buildCaveWall(
  side: "left" | "right",
  tint: string,
  widthPx: number,
): PixelGrid {
  const w = Math.max(CAVE_TILE_PX, Math.round(widthPx));
  const h = CAVE_WALL_TILE_H;
  const grid = createGrid(w, h);
  const edge = pathEdgeColor(tint);
  const gem = gemColor(tint);
  const rng = mulberry32(
    hashSeed(w * 7919 + (side === "left" ? 31 : 97), 0x5eed),
  );
  // Base rock: the SAME coherent value-noise field as the tile rows (seeded
  // per side), so the wall reads as one rock body with the cave behind it.
  // No per-strip fade: the wall repeats every CAVE_WALL_TILE_H, and a fade
  // would print a dark line at every repeat seam.
  const wallSeed = hashSeed(w * 7919 + (side === "left" ? 31 : 97), 0x5eed + 1);
  const ramp = rockShadeRamp(tint);
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      setPixel(grid, px, py, ramp[rockShadeIndex(px, py, wallSeed)]);
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
  // Jagged inner edge: a bounded random walk per 2px row keeps the cut
  // organic; at least 12px of rock always survives on the outer side.
  const maxCut = w - 12;
  const targetCut = Math.max(2, Math.floor(w / 4));
  let cut = targetCut;
  for (let i = 0; i < h / 2; i++) {
    // Mean-reverting random walk: the plain walk above drifted and could sit
    // pinned at maxCut for long stretches (the edge read as a flat diagonal
    // cliff). Pulling a fraction of the way back to `targetCut` keeps the
    // cut wandering around the middle of the column at every width.
    const pull = (targetCut - cut) / 6;
    cut = Math.max(0, Math.min(maxCut, Math.round(cut + Math.floor(rng() * 5) - 2 + pull)));
    for (let dy = 0; dy < 2; dy++) {
      const y = i * 2 + dy;
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
  }
  return grid;
}

// ---------------------------------------------------------------------------
// Caching + public API
// ---------------------------------------------------------------------------

const cache = new Map<string, string>();
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
 */
export function caveRowUri(opts: {
  depth: number;
  tint: string;
  /** Container width in px; widens the strip adaptively (see buildCaveRow). */
  widthPx?: number;
}): string {
  const depth = Math.floor(opts.depth);
  const tier = caveTierForDepth(depth);
  const row = caveRowStartForDepth(depth);
  const width = opts.widthPx ?? 0;
  const key = `${width}|${opts.tint}|${tier}|${row}`;
  let uri = cache.get(key);
  if (uri == null) {
    uri = gridToPngDataUri(buildCaveRow(tier, row, opts.tint, opts.widthPx));
    if (row > rowHighWater) rowHighWater = row;
    cache.set(key, uri);
    const floor = rowHighWater - ROW_CACHE_SPAN;
    if (Number.isFinite(floor)) {
      for (const k of cache.keys()) {
        // Keys are `${width}|${tint}|${tier}|${row}`; the row is the part
        // after the last pipe (tint is a hex color, never contains '|').
        const lastPipe = k.lastIndexOf("|");
        const r = Number(k.slice(lastPipe + 1));
        if (Number.isFinite(r) && r < floor) cache.delete(k);
      }
    }
  }
  return uri;
}

/**
 * Cached PNG data URI for a foreground cave-wall strip (todo #3). The
 * strip content is what repeats vertically (CAVE_WALL_TILE_H), so the
 * cache stays small: one entry per (side, width, tint).
 */
export function caveWallUri(opts: {
  tint: string;
  side: "left" | "right";
  /** Container width in px — sizes the column (see caveWallWidthPx). */
  widthPx?: number;
}): string {
  const w = caveWallWidthPx(opts.widthPx ?? 0);
  const key = `wall|${opts.side}|${w}|${opts.tint}`;
  let uri = cache.get(key);
  if (uri == null) {
    uri = gridToPngDataUri(buildCaveWall(opts.side, opts.tint, w));
    cache.set(key, uri);
  }
  return uri;
}

export type { Pixel, PixelGrid };
