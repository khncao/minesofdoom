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
} from "./pixelArt";
import type { Pixel, PixelGrid } from "./pixelArt";

/**
 * Minimum depth of each cave band. Mirrors `DEPTH_TIERS` in `game.ts` (a unit
 * test pins the two together).
 */
export const CAVE_TIER_ATS: number[] = [0, 10, 50, 150, 500];

/** Tiles per strip (the strip is stretched to the canvas width). */
export const CAVE_TILE_PX = 24;
/** Number of tiles across a strip. */
export const CAVE_TILES_PER_ROW = 12;
/**
 * Distinct strip textures generated per tier; rows cycle through them as
 * depth increases. Kept small on purpose: the cache holds one PNG data URI
 * per (tint × tier × strip), so the memory ceiling is
 * themes × tiers × STRIPS.
 */
export const CAVE_STRIPS_PER_TIER = 4;

/** Crystal density per tier — deeper bands glitter more. */
const GEM_CHANCE = [0.05, 0.08, 0.12, 0.1, 0.16];
/** Share of tiles that are solid rock (the rest are empty gaps). */
const ROCK_CHANCE = 0.62;

/** Highest tier whose minimum depth has been reached (clamped at the last). */
export function caveTierForDepth(depth: number): number {
  let tier = 0;
  for (let i = 0; i < CAVE_TIER_ATS.length; i++) {
    if (depth >= CAVE_TIER_ATS[i]) tier = i;
  }
  return tier;
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
  return toHexColor(
    ar + (br - ar) * t,
    ag + (bg - ag) * t,
    ab + (bb - ab) * t,
  );
}

/** The three rock shades derived from a tier tint. */
export function rockShades(tint: string): [string, string, string] {
  return [mixHex(tint, "#ffffff", 0.25), tint, mixHex(tint, "#000000", 0.3)];
}

/** Bright crystal color derived from a tier tint. */
export function gemColor(tint: string): string {
  return mixHex(tint, "#ffffff", 0.6);
}

/** One 24×24 rock tile: 2×2-block shade noise with a slight bottom falloff. */
function drawRockTile(
  grid: PixelGrid,
  x0: number,
  rng: () => number,
  shades: [string, string, string],
): void {
  const [light, base, dark] = shades;
  const blocks = CAVE_TILE_PX / 2;
  for (let by = 0; by < blocks; by++) {
    for (let bx = 0; bx < blocks; bx++) {
      const r = rng();
      const shade = r < 0.3 ? dark : r < 0.8 ? base : light;
      // Slight vertical falloff so strips read as strata, not static.
      const color = mixHex(shade, "#000000", (by * 2) / CAVE_TILE_PX * 0.35);
      setPixel(grid, x0 + bx * 2, by * 2, color);
      setPixel(grid, x0 + bx * 2 + 1, by * 2, color);
      setPixel(grid, x0 + bx * 2, by * 2 + 1, color);
      setPixel(grid, x0 + bx * 2 + 1, by * 2 + 1, color);
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
 * The mined path (plan "Adjust"): the two middle tiles of every strip, kept
 * dug out (no rock, no gems) so the cave reads as one vertical shaft the
 * player is mining down, with dark wall edges on the tiles flanking it.
 */
export const CAVE_PATH_TILES: readonly number[] = [5, 6];

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

export const CAVE_EGG_KINDS = ["spider", "princess", "chest"] as const;
export type CaveEggKind = (typeof CAVE_EGG_KINDS)[number];

/** Share of strips that carry an egg. */
const EGG_CHANCE = 0.15;
/** Egg placement space: every tile except the two path tiles. */
const EGG_OUTER_TILES: readonly number[] = [0, 1, 2, 3, 8, 9, 10, 11];

/**
 * Deterministic per (tier, strip): the egg's tile + kind, or null. Rows
 * cycle through the strips, so an egg reappears every CAVE_STRIPS_PER_TIER
 * rows — same texture-cycle discipline as the rock strips themselves.
 */
export function eggForStrip(
  tier: number,
  strip: number,
): { tile: number; kind: CaveEggKind } | null {
  const seed = hashSeed(tier * 7919 + strip * 104729, 0x9e69);
  const rng = mulberry32(seed);
  if (rng() >= EGG_CHANCE) {
    return null;
  }
  return {
    tile: EGG_OUTER_TILES[Math.floor(rng() * EGG_OUTER_TILES.length)],
    kind: CAVE_EGG_KINDS[Math.floor(rng() * CAVE_EGG_KINDS.length)],
  };
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
  } else {
    // Treasure chest: brown box, dark lid, gold band + keyhole.
    for (let y = 10; y <= 14; y++) hline(grid, x0 + 8, x0 + 15, y, "#8a5a2a");
    hline(grid, x0 + 8, x0 + 15, 10, "#5f3c1c");
    hline(grid, x0 + 8, x0 + 15, 13, "#ffd24a");
    setPixel(grid, x0 + 11, 12, "#5f3c1c");
  }
}

/**
 * Build one full cave row: `CAVE_TILES_PER_ROW` tiles of
 * `CAVE_TILE_PX` × `CAVE_TILE_PX`. Deterministic in (tier, strip, tint).
 */
export function buildCaveRow(
  tier: number,
  strip: number,
  tint: string,
): PixelGrid {
  const t = Math.max(0, Math.min(tier, GEM_CHANCE.length - 1));
  const grid = createGrid(
    CAVE_TILES_PER_ROW * CAVE_TILE_PX,
    CAVE_TILE_PX,
  );
  const shades = rockShades(tint);
  const gem = gemColor(tint);
  const egg = eggForStrip(t, strip);
  for (let tile = 0; tile < CAVE_TILES_PER_ROW; tile++) {
    const x0 = tile * CAVE_TILE_PX;
    const inPath = CAVE_PATH_TILES.includes(tile);
    if (!inPath) {
      const seed = hashSeed(t * 7919 + strip * 104729, 0x5eed + tile * 131);
      if (mulberry32(seed)() < ROCK_CHANCE) {
        drawRockTile(grid, x0, mulberry32(hashSeed(seed, 1)), shades);
      }
      if (mulberry32(hashSeed(seed, 2))() < GEM_CHANCE[t]) {
        drawGem(grid, x0, mulberry32(hashSeed(seed, 3)), gem, t >= 2);
      }
      if (egg != null && egg.tile === tile) {
        drawEgg(grid, x0, egg.kind);
      }
    }
    // Path wall edges: a dark 3px stripe on the inner side of the tiles
    // flanking the shaft, drawn even over gaps so the path reads clearly.
    if (tile === CAVE_PATH_TILES[0] - 1) {
      for (let dx = CAVE_TILE_PX - 3; dx < CAVE_TILE_PX; dx++) {
        vline(grid, x0 + dx, 0, CAVE_TILE_PX - 1, pathEdgeColor(tint));
      }
    } else if (tile === CAVE_PATH_TILES[CAVE_PATH_TILES.length - 1] + 1) {
      for (let dx = 0; dx < 3; dx++) {
        vline(grid, x0 + dx, 0, CAVE_TILE_PX - 1, pathEdgeColor(tint));
      }
    }
  }
  return grid;
}

// ---------------------------------------------------------------------------
// Caching + public API
// ---------------------------------------------------------------------------

const cache = new Map<string, string>();

/** Drop all cached cave-row PNGs (escape hatch for tests / low-memory). */
export function clearCaveTileCache(): void {
  cache.clear();
}

/**
 * Cached PNG data URI for the cave row visible at a given absolute depth and
 * theme tint. Rows repeat with period `CAVE_STRIPS_PER_TIER` within a tier,
 * which is what keeps the cache bounded.
 */
export function caveRowUri(opts: { depth: number; tint: string }): string {
  const tier = caveTierForDepth(opts.depth);
  const strip =
    ((Math.floor(opts.depth) % CAVE_STRIPS_PER_TIER) + CAVE_STRIPS_PER_TIER) %
    CAVE_STRIPS_PER_TIER;
  const key = `${opts.tint}|${tier}|${strip}`;
  let uri = cache.get(key);
  if (uri == null) {
    uri = gridToPngDataUri(buildCaveRow(tier, strip, opts.tint));
    cache.set(key, uri);
  }
  return uri;
}

export type { Pixel, PixelGrid };
