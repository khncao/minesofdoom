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
      const color = mixHex(shade, "#000000", ((by * 2) / CAVE_TILE_PX) * 0.35);
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
 * mined path stays centered at any width. Deterministic in
 * (tier, strip, tint, widthPx).
 */
export function buildCaveRow(
  tier: number,
  strip: number,
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
  const gem = gemColor(tint);
  const [pa, pb] = cavePathTiles(count);
  const egg = eggForStrip(t, strip, count);
  for (let tile = 0; tile < count; tile++) {
    const x0 = tile * CAVE_TILE_PX;
    const inPath = tile === pa || tile === pb;
    if (!inPath) {
      const seed = hashSeed(t * 7919 + strip * 104729, 0x5eed + tile * 131);
      if (mulberry32(seed)() < ROCK_CHANCE) {
        drawRockTile(grid, x0, mulberry32(hashSeed(seed, 1)), shades);
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
      const seed = hashSeed(t * 7919 + strip * 104729, 0x5eed + tile * 131);
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
// Caching + public API
// ---------------------------------------------------------------------------

const cache = new Map<string, string>();

/** Drop all cached cave-row PNGs (escape hatch for tests / low-memory). */
export function clearCaveTileCache(): void {
  cache.clear();
}

/**
 * Cached PNG data URI for the cave row visible at a given absolute depth,
 * theme tint and container width. Rows repeat with period
 * `CAVE_STRIPS_PER_TIER` within a tier (and the width is stable per
 * window), which is what keeps the cache bounded.
 */
export function caveRowUri(opts: {
  depth: number;
  tint: string;
  /** Container width in px; widens the strip adaptively (see buildCaveRow). */
  widthPx?: number;
}): string {
  const tier = caveTierForDepth(opts.depth);
  const strip =
    ((Math.floor(opts.depth) % CAVE_STRIPS_PER_TIER) + CAVE_STRIPS_PER_TIER) %
    CAVE_STRIPS_PER_TIER;
  const width = opts.widthPx ?? 0;
  const key = `${width}|${opts.tint}|${tier}|${strip}`;
  let uri = cache.get(key);
  if (uri == null) {
    uri = gridToPngDataUri(
      buildCaveRow(tier, strip, opts.tint, opts.widthPx),
    );
    cache.set(key, uri);
  }
  return uri;
}

export type { Pixel, PixelGrid };
