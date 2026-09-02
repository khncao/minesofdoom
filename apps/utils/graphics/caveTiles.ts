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
  for (let tile = 0; tile < CAVE_TILES_PER_ROW; tile++) {
    const seed = hashSeed(t * 7919 + strip * 104729, 0x5eed + tile * 131);
    if (mulberry32(seed)() < ROCK_CHANCE) {
      drawRockTile(grid, tile * CAVE_TILE_PX, mulberry32(hashSeed(seed, 1)), shades);
    }
    if (mulberry32(hashSeed(seed, 2))() < GEM_CHANCE[t]) {
      drawGem(grid, tile * CAVE_TILE_PX, mulberry32(hashSeed(seed, 3)), gem, t >= 2);
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
