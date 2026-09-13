import { DEPTH_TIERS } from "src/mines_of_doom/game";
import {
  buildCaveRow,
  buildCaveWall,
  CAVE_EGG_KINDS,
  CAVE_METERS_PER_ROW,
  CAVE_PATH_TILES,
  CAVE_PX_PER_METER,
  CAVE_WALL_TILE_H,
  CAVE_STRIPS_PER_TIER,
  CAVE_STRIP_WIDTH,
  CAVE_TILE_PX,
  CAVE_TIER_ATS,
  cavePathTiles,
  caveRowStartForDepth,
  caveRowUri,
  caveWallUri,
  caveWallWidthPx,
  caveTierForDepth,
  caveTranslateForDepth,
  clearCaveTileCache,
  eggForStrip,
  gemColor,
  mixHex,
  pathEdgeColor,
  rockField,
  rockShades,
  valueNoise,
} from "./caveTiles";
import type { PixelGrid } from "./caveTiles";
import { STRIP_MAX_BLOCK_PX } from "./pixelArt";

const PREFIX = "data:image/png;base64,";

describe("tier mapping", () => {
  test("CAVE_TIER_ATS mirrors DEPTH_TIERS in game.ts", () => {
    expect(CAVE_TIER_ATS).toEqual(DEPTH_TIERS.map((t) => t.at));
  });

  test("caveTierForDepth is monotone and pinned at the boundaries", () => {
    expect(caveTierForDepth(0)).toBe(0);
    expect(caveTierForDepth(9)).toBe(0);
    expect(caveTierForDepth(10)).toBe(1);
    expect(caveTierForDepth(49)).toBe(1);
    expect(caveTierForDepth(50)).toBe(2);
    expect(caveTierForDepth(149)).toBe(2);
    expect(caveTierForDepth(150)).toBe(3);
    expect(caveTierForDepth(499)).toBe(3);
    expect(caveTierForDepth(500)).toBe(4);
    expect(caveTierForDepth(1_000_000)).toBe(4);
    // Fractional / negative depth can't crash or escape the band table.
    expect(caveTierForDepth(49.7)).toBe(1);
    expect(caveTierForDepth(-5)).toBe(0);
  });
});

describe("color helpers", () => {
  test("mixHex endpoints and midpoint", () => {
    expect(mixHex("#000000", "#ffffff", 0)).toBe("#000000");
    expect(mixHex("#000000", "#ffffff", 1)).toBe("#ffffff");
    expect(mixHex("#000000", "#ffffff", 0.5)).toBe("#808080"); // 127.5 rounds up
  });

  test("rockShades are light/base/dark around the tint", () => {
    const [light, base, dark] = rockShades("#a0856a");
    expect(base).toBe("#a0856a");
    expect(light).not.toBe(base);
    expect(dark).not.toBe(base);
    // Light must be brighter than base, base brighter than dark.
    const lum = (h: string) =>
      parseInt(h.slice(1, 3), 16) +
      parseInt(h.slice(3, 5), 16) +
      parseInt(h.slice(5, 7), 16);
    expect(lum(light)).toBeGreaterThan(lum(base));
    expect(lum(base)).toBeGreaterThan(lum(dark));
  });

  test("gemColor is a lightened tint", () => {
    const gem = gemColor("#a0856a");
    expect(gem.startsWith("#")).toBe(true);
    expect(gem).not.toBe("#a0856a");
  });
});

describe("coherent rock field (value-noise background blocks)", () => {
  test("valueNoise is deterministic, in [0,1)", () => {
    for (const [x, y, s] of [
      [0, 0, 1],
      [3.7, -2.1, 42],
      [123.4, 56.8, 7],
    ] as const) {
      const a = valueNoise(x, y, s);
      expect(a).toBe(valueNoise(x, y, s)); // pure
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(1);
    }
  });

  test("valueNoise is spatially smooth (nearby ≈, far ≠)", () => {
    // Sample a line; adjacent cells must be close, distant cells decorrelated.
    let nearDiff = 0;
    let farDiff = 0;
    const N = 200;
    for (let i = 0; i < N; i++) {
      const x = i * 0.7;
      nearDiff += Math.abs(valueNoise(x, 4, 9) - valueNoise(x + 0.15, 4, 9));
      farDiff += Math.abs(valueNoise(x, 4, 9) - valueNoise(x + 9, 4, 9));
    }
    expect(nearDiff / N).toBeLessThan(farDiff / N);
  });

  test("rockField is coherent ACROSS tile boundaries (the fix)", () => {
    // A tile is CAVE_TILE_PX/2 = 12 blocks wide. The old code reseeded rng
    // per tile, so the last block of tile N and the first of tile N+1 were
    // independent die rolls. The new field is sampled at GLOBAL block coords
    // with one seed, so the seam pair is no coarser than any other adjacent
    // pair — the rock body continues across the boundary.
    const seed = 0x5eed;
    const tiles = 6;
    let seamDiff = 0; // adjacent pair straddling the tile seam
    let innerDiff = 0; // adjacent pair well inside a tile (control)
    let farDiff = 0; // pair 12 blocks apart (one full tile)
    for (let t = 1; t <= tiles; t++) {
      const b = t * 12; // block column of the seam after tile t
      seamDiff += Math.abs(rockField(b - 1, 5, seed) - rockField(b, 5, seed));
      innerDiff += Math.abs(
        rockField(b - 6, 5, seed) - rockField(b - 5, 5, seed),
      );
      farDiff += Math.abs(rockField(b - 12, 5, seed) - rockField(b, 5, seed));
    }
    const s = seamDiff / tiles;
    const i = innerDiff / tiles;
    const f = farDiff / tiles;
    expect(s).toBeGreaterThanOrEqual(0);
    // The seam behaves like any other adjacent pair (within one step of the
    // inner control) — no per-tile discontinuity.
    expect(s).toBeLessThan(i + 0.05);
    // …and the field does vary over a tile's span (not a constant plane).
    expect(f).toBeGreaterThan(s);
  });

  test("rockField varies by (tier, strip) seed but not by tile index", () => {
    // Same seed, different tile (blockX) → different texture, but a given
    // (blockX, by, seed) is stable regardless of which tile it is "in".
    expect(rockField(0, 0, 11)).toBe(rockField(0, 0, 11));
    expect(rockField(0, 0, 11)).not.toBe(rockField(0, 0, 12));
    expect(rockField(0, 0, 11)).toBeGreaterThanOrEqual(0);
    expect(rockField(0, 0, 11)).toBeLessThan(1);
  });
});

describe("buildCaveRow", () => {
  test("produces a deterministically-sized, deterministic grid", () => {
    const a = buildCaveRow(2, 0, "#9a7fb8");
    const b = buildCaveRow(2, 0, "#9a7fb8");
    expect(a.length).toBe(24);
    expect(a[0].length).toBe(14 * 24); // CAVE_TILES_PER_ROW × CAVE_TILE_PX
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  test("tint and strip change the texture", () => {
    expect(JSON.stringify(buildCaveRow(2, 0, "#9a7fb8"))).not.toBe(
      JSON.stringify(buildCaveRow(2, 0, "#5ab8b8")),
    );
    let same = true;
    for (let s = 1; s < CAVE_STRIPS_PER_TIER; s++) {
      if (
        JSON.stringify(buildCaveRow(2, s, "#9a7fb8")) !==
        JSON.stringify(buildCaveRow(2, 0, "#9a7fb8"))
      ) {
        same = false;
      }
    }
    expect(same).toBe(false);
  });

  test("deeper tiers contain crystals of the derived gem color", () => {
    const gem = gemColor("#5ab8b8");
    let found = false;
    for (let s = 0; s < CAVE_STRIPS_PER_TIER; s++) {
      const grid = buildCaveRow(4, s, "#5ab8b8");
      if (grid.some((row) => row.includes(gem))) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  test("widthPx widens the strip to a tile multiple with a centered path", () => {
    // 1280px container → 1296 source px (1280 rounded up to a 24px tile
    // multiple), 54 tiles, path at the middle pair (26, 27).
    const grid = buildCaveRow(2, 0, "#9a7fb8", 1280);
    expect(grid[0].length).toBe(1296);
    expect(grid.length).toBe(CAVE_TILE_PX);
    const [pa, pb] = cavePathTiles(54);
    expect([pa, pb]).toEqual([26, 27]);
    // Path tiles stay sparse (loose rubble only, far below the rock
    // density) — the encoder's multi-block stored-deflate path makes any
    // width round-trip, see pixelArt tests.
    const area = (pb + 1 - pa) * CAVE_TILE_PX * CAVE_TILE_PX;
    let filled = 0;
    for (const row of grid) {
      for (let x = pa * CAVE_TILE_PX; x < (pb + 1) * CAVE_TILE_PX; x++) {
        if (row[x] !== null) filled++;
      }
    }
    expect(filled).toBeGreaterThan(0); // rubble under the player
    expect(filled).toBeLessThan(area * 0.1); // still reads as an opening
    // Wall edges flank the widened path.
    const edge = pathEdgeColor("#9a7fb8");
    const leftX = (pa - 1) * CAVE_TILE_PX + CAVE_TILE_PX - 3;
    const rightX = (pb + 1) * CAVE_TILE_PX;
    for (const row of grid) {
      expect([row[leftX], row[leftX + 1], row[leftX + 2]]).toEqual([
        edge,
        edge,
        edge,
      ]);
      expect([row[rightX], row[rightX + 1], row[rightX + 2]]).toEqual([
        edge,
        edge,
        edge,
      ]);
    }
    // Deterministic at a given width.
    expect(JSON.stringify(buildCaveRow(2, 0, "#9a7fb8", 1280))).toBe(
      JSON.stringify(grid),
    );
  });

  test("widthPx floors at the default strip width", () => {
    // Narrower containers don't shrink the strip below CAVE_TILES_PER_ROW
    // (the egg placement space is pinned to the 14-tile layout).
    expect(buildCaveRow(2, 0, "#9a7fb8", 200)[0].length).toBe(CAVE_STRIP_WIDTH);
    expect(buildCaveRow(2, 0, "#9a7fb8", 336)[0].length).toBe(CAVE_STRIP_WIDTH);
  });

  test("widthPx never exceeds the stored-block cap in cells", () => {
    const grid = buildCaveRow(2, 0, "#9a7fb8", 100000);
    expect(grid[0].length % CAVE_TILE_PX).toBe(0);
    expect(grid[0].length).toBeLessThanOrEqual(STRIP_MAX_BLOCK_PX + 23);
  });

  test("strip size is pinned and the PNG payload stays bounded", () => {
    // The encoder (pixelArt) splits the raw payload into stored deflate
    // blocks of ≤65535 bytes, so any width works, but pin the budget: a
    // width bump that blew the strip into many blocks is a visible cost
    // change and should fail here first.
    const grid = buildCaveRow(4, 3, "#5ab8b8");
    expect(grid.length).toBe(CAVE_TILE_PX);
    expect(grid[0].length).toBe(CAVE_STRIP_WIDTH);
    const raw = grid.length * (1 + grid[0].length * 4);
    expect(raw).toBe(CAVE_TILE_PX * (1 + CAVE_STRIP_WIDTH * 4));
    expect(raw).toBeLessThanOrEqual(2 * 65535);
  });
});

describe("mined path + easter eggs", () => {
  const TINT = "#a0856a";
  const allRows = (): PixelGrid[] => {
    const rows: PixelGrid[] = [];
    for (let t = 0; t < CAVE_TIER_ATS.length; t++) {
      for (let s = 0; s < CAVE_STRIPS_PER_TIER; s++) {
        rows.push(buildCaveRow(t, s, TINT));
      }
    }
    return rows;
  };

  test("path tiles are sparse rubble, lower-half only, in every strip", () => {
    // The dug shaft keeps loose rubble (blocks under the player), but it
    // must stay far sparser than rock: no full rock tiles, no gems, no
    // eggs — only small chunks, and only in the LOWER half (y >= 12) so
    // the rubble piles at the bottom of the shaft, never over the miner.
    const gem = gemColor(TINT);
    const x0 = CAVE_PATH_TILES[0] * CAVE_TILE_PX;
    const x1 = (CAVE_PATH_TILES[CAVE_PATH_TILES.length - 1] + 1) * CAVE_TILE_PX;
    let someRubble = false;
    for (const grid of allRows()) {
      for (let y = 0; y < CAVE_TILE_PX; y++) {
        const row = grid[y];
        for (let x = x0; x < x1; x++) {
          expect(row[x]).not.toBe(gem);
          if (row[x] !== null) {
            expect(y).toBeGreaterThanOrEqual(12);
            someRubble = true;
          }
        }
      }
    }
    expect(someRubble).toBe(true);
  });

  test("deeper tiers carry ore flecks from the fixed ore palette", () => {
    const oreColors = ["#ffd24a", "#e08040", "#6ab8ff", "#50d080"];
    let found = false;
    for (let s = 0; s < CAVE_STRIPS_PER_TIER && !found; s++) {
      const grid = buildCaveRow(4, s, "#5ab8b8");
      found = grid.some((row) =>
        row.some((p) => p != null && oreColors.includes(p)),
      );
    }
    expect(found).toBe(true);
  });

  test("dark wall edges flank the path in every strip", () => {
    const edge = pathEdgeColor(TINT);
    const leftX = (CAVE_PATH_TILES[0] - 1) * CAVE_TILE_PX + CAVE_TILE_PX - 3;
    const rightX =
      (CAVE_PATH_TILES[CAVE_PATH_TILES.length - 1] + 1) * CAVE_TILE_PX;
    for (const grid of allRows()) {
      for (const row of grid) {
        for (const x of [
          leftX,
          leftX + 1,
          leftX + 2,
          rightX,
          rightX + 1,
          rightX + 2,
        ]) {
          expect(row[x]).toBe(edge);
        }
      }
    }
  });

  test("every egg kind in the catalog is rollable", () => {
    // The visible 20 strips (5 tiers × 4) only roll a couple of eggs —
    // rarity is deliberate — so scan a wider deterministic (tier, strip)
    // grid: every catalog kind must be reachable, or it's dead art.
    const seen = new Set<string>();
    for (let t = 0; t < CAVE_TIER_ATS.length; t++) {
      for (let s = 0; s < CAVE_STRIPS_PER_TIER * 5; s++) {
        const egg = eggForStrip(t, s);
        if (egg != null) seen.add(egg.kind);
      }
    }
    for (const kind of CAVE_EGG_KINDS) {
      expect(seen).toContain(kind);
    }
  });

  test("eggForStrip is deterministic, off-path, and neither ubiquitous nor absent", () => {
    for (let t = 0; t < CAVE_TIER_ATS.length; t++) {
      for (let s = 0; s < CAVE_STRIPS_PER_TIER; s++) {
        const a = eggForStrip(t, s);
        expect(JSON.stringify(a)).toBe(JSON.stringify(eggForStrip(t, s)));
        if (a != null) {
          expect(CAVE_PATH_TILES).not.toContain(a.tile);
          expect(CAVE_EGG_KINDS).toContain(a.kind);
        }
      }
    }
    let count = 0;
    for (let t = 0; t < CAVE_TIER_ATS.length; t++) {
      for (let s = 0; s < CAVE_STRIPS_PER_TIER; s++) {
        if (eggForStrip(t, s) != null) count++;
      }
    }
    // The mine has eggs, but most strips are plain rock.
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(CAVE_TIER_ATS.length * CAVE_STRIPS_PER_TIER);
  });

  test("an egg paints pixels inside its (off-path) tile", () => {
    for (let t = 0; t < CAVE_TIER_ATS.length; t++) {
      for (let s = 0; s < CAVE_STRIPS_PER_TIER; s++) {
        const egg = eggForStrip(t, s);
        if (egg == null) continue;
        const grid = buildCaveRow(t, s, TINT);
        const x0 = egg.tile * CAVE_TILE_PX;
        const painted = grid.some((row) =>
          row.slice(x0 + 5, x0 + 19).some((p) => p !== null),
        );
        expect(painted).toBe(true);
      }
    }
  });

  test("eggForStrip with a wide count stays off the widened path", () => {
    for (let t = 0; t < CAVE_TIER_ATS.length; t++) {
      for (let s = 0; s < CAVE_STRIPS_PER_TIER; s++) {
        const count = 54; // the 1296px / 24px strip
        const egg = eggForStrip(t, s, count);
        if (egg == null) continue;
        expect(cavePathTiles(count)).not.toContain(egg.tile);
        const grid = buildCaveRow(t, s, TINT, 1296);
        const x0 = egg.tile * CAVE_TILE_PX;
        const painted = grid.some((row) =>
          row.slice(x0 + 5, x0 + 19).some((p) => p !== null),
        );
        expect(painted).toBe(true);
      }
    }
  });
});

describe("continuous descent (background rework)", () => {
  const topRowAt = (depth: number, y: number) =>
    caveRowStartForDepth(depth) +
    Math.floor(
      (y - caveTranslateForDepth(depth, caveRowStartForDepth(depth))) /
        CAVE_TILE_PX,
    );

  test("rowStart floors the descent into rows; meters-per-row is a whole row", () => {
    expect(CAVE_METERS_PER_ROW).toBe(CAVE_TILE_PX / CAVE_PX_PER_METER);
    expect(CAVE_METERS_PER_ROW % 1).toBe(0);
    expect(caveRowStartForDepth(0)).toBe(0);
    expect(caveRowStartForDepth(3)).toBe(0);
    expect(caveRowStartForDepth(4)).toBe(1);
    expect(caveRowStartForDepth(7)).toBe(1);
    expect(caveRowStartForDepth(8)).toBe(2);
    expect(caveRowStartForDepth(500)).toBe(125);
  });

  test("translate stays within one row of the rowStart top", () => {
    for (const d of [0, 1, 2, 3, 4, 5, 9, 49, 50, 1000, 1234567]) {
      const t = caveTranslateForDepth(d, caveRowStartForDepth(d));
      expect(t).toBeGreaterThanOrEqual(-CAVE_TILE_PX);
      expect(t).toBeLessThanOrEqual(0);
    }
  });

  test("the row visible at a screen line equals floor of the world pixel", () => {
    // Screen line y shows cave row floor((CAVE_PX_PER_METER * depth + y)
    // / CAVE_TILE_PX) — the camera sits exactly at depth's world pixel.
    for (const d of [0, 1, 3, 4, 5, 10, 50, 999]) {
      for (const y of [0, 12, 23, 24, 57, 300]) {
        expect(topRowAt(d, y)).toBe(
          Math.floor((CAVE_PX_PER_METER * d + y) / CAVE_TILE_PX),
        );
      }
    }
  });

  test("content only ever moves up as depth grows (monotone descent)", () => {
    for (let d = 0; d < 400; d++) {
      for (const y of [0, 13, 287, 600]) {
        expect(topRowAt(d + 1, y)).toBeGreaterThanOrEqual(topRowAt(d, y));
      }
    }
  });

  test("a full row of descent re-indexes exactly one strip row (seamless)", () => {
    // Crossing CAVE_METERS_PER_ROW meters: rowStart +1, and the
    // compensation (target + delta) is exactly one row below the new
    // rowStart top — same content the old rows showed, then the slide.
    const delta = CAVE_PX_PER_METER * CAVE_METERS_PER_ROW; // one row
    for (const d of [0, 1, 2, 3, 5, 100]) {
      const before = {
        s: caveRowStartForDepth(d),
        t: caveTranslateForDepth(d, caveRowStartForDepth(d)),
      };
      const d2 = d + CAVE_METERS_PER_ROW;
      const s2 = caveRowStartForDepth(d2);
      const t2 = caveTranslateForDepth(d2, s2);
      expect(s2).toBe(before.s + 1);
      // Continuity: value advanced by the re-indexed row (target + delta)
      // shows the SAME content as the old (rowStart, translate) pair.
      const compensated = t2 + delta;
      expect(compensated).toBe(before.t + 1 * CAVE_TILE_PX);
    }
  });

  test("rows are addressed by absolute depth: strip cycle starts at 0", () => {
    // The strip renders rows rowStart*4, +1, +2, … so the top row's
    // texture cycle position is always 0 (as in the old depth+i model),
    // and the next tier's rock is visible below before the tint flips.
    for (const d of [0, 4, 8, 10, 52, 200]) {
      const s = caveRowStartForDepth(d);
      expect((s * CAVE_METERS_PER_ROW) % CAVE_STRIPS_PER_TIER).toBe(0);
    }
  });

  test("bigint and number inputs agree (depth arrives as bigint)", () => {
    for (const d of [0n, 3n, 4n, 1999n, 123456n]) {
      expect(caveRowStartForDepth(d)).toBe(caveRowStartForDepth(Number(d)));
      expect(caveTranslateForDepth(d, caveRowStartForDepth(d))).toBe(
        caveTranslateForDepth(Number(d), caveRowStartForDepth(Number(d))),
      );
    }
  });
});

describe("caveRowUri", () => {
  beforeEach(() => clearCaveTileCache());

  test("returns cached, valid data URIs", () => {
    const uri = caveRowUri({ depth: 12, tint: "#8fa8b8" });
    expect(uri.startsWith(PREFIX)).toBe(true);
    expect(caveRowUri({ depth: 12, tint: "#8fa8b8" })).toBe(uri);
  });

  test("varies with depth cycle position and tint, repeats within a tier", () => {
    const d0 = caveRowUri({ depth: 12, tint: "#8fa8b8" });
    // 12 and 16 share the strip cycle position (both % 4 === 0).
    expect(caveRowUri({ depth: 16, tint: "#8fa8b8" })).toBe(d0);
    // Next cycle position (different strip) differs.
    expect(caveRowUri({ depth: 13, tint: "#8fa8b8" })).not.toBe(d0);
    // A different theme tint bakes different colors in.
    expect(caveRowUri({ depth: 12, tint: "#c8a8e0" })).not.toBe(d0);
  });

  test("clearCaveTileCache re-encodes from the same source", () => {
    const before = caveRowUri({ depth: 5, tint: "#a0856a" });
    clearCaveTileCache();
    expect(caveRowUri({ depth: 5, tint: "#a0856a" })).toBe(before);
  });

  test("widthPx is part of the cache key and changes the strip", () => {
    const narrow = caveRowUri({ depth: 12, tint: "#8fa8b8" });
    const wide = caveRowUri({ depth: 12, tint: "#8fa8b8", widthPx: 1280 });
    expect(wide).not.toBe(narrow);
    // Same width → same URI (cached).
    expect(caveRowUri({ depth: 12, tint: "#8fa8b8", widthPx: 1280 })).toBe(
      wide,
    );
    // A width below the minimum strips to the default width.
    expect(caveRowUri({ depth: 12, tint: "#8fa8b8", widthPx: 100 })).toBe(
      narrow,
    );
  });
});

describe("foreground cave walls (todo 2026-07-14 #3)", () => {
  const tint = "#a0856a";

  test("caveWallWidthPx: 4px steps, clamped [24, 96]", () => {
    expect(caveWallWidthPx(0)).toBe(24);
    expect(caveWallWidthPx(360)).toBe(24); // 360/28=13 → 12
    expect(caveWallWidthPx(1280)).toBe(44); // 1280/28=46 → 44
    expect(caveWallWidthPx(100000)).toBe(96);
    expect(caveWallWidthPx(NaN)).toBe(24);
    // Every produced width is a multiple of 4 (crisp pixel grid).
    for (const w of [0, 360, 1280, 4000, 100000]) {
      expect(caveWallWidthPx(w) % 4).toBe(0);
    }
  });

  test("buildCaveWall: sized, solid outer band, cut-in inner edge", () => {
    const w = 48;
    // Left wall: outer band = leftmost 12px, the cut opens to the right.
    const grid = buildCaveWall("left", tint, w);
    expect(grid.length).toBe(CAVE_WALL_TILE_H);
    for (let y = 0; y < CAVE_WALL_TILE_H; y++) {
      expect(grid[y].length).toBe(w);
      // maxCut = w-12, so the jagged walk can never eat into the outer
      // 12px band — a hole reaching the screen edge would break the
      // "standing inside the shaft" illusion.
      for (let x = 0; x < 12; x++) expect(grid[y][x]).not.toBeNull();
    }
    // The inner edge is cut in (deterministic seed: row 0 cut >= 1).
    expect(grid[0][w - 1]).toBeNull();
    let clearRows = 0;
    for (let y = 0; y < CAVE_WALL_TILE_H; y++) {
      if (grid[y][w - 1] == null) clearRows++;
    }
    expect(clearRows).toBeGreaterThan(0);
    // Right wall mirrors it: outer band = rightmost 12px, cut opens left.
    const gridR = buildCaveWall("right", tint, w);
    for (let y = 0; y < CAVE_WALL_TILE_H; y++) {
      for (let x = w - 12; x < w; x++) expect(gridR[y][x]).not.toBeNull();
    }
    // Row 0's cut lands at x=10 (edge accent at x===cut); the walk
    // never floors below x=2 for this seed, so column 0 is always clear.
    expect(gridR[0][9]).toBeNull();
    expect(gridR[0][10]).not.toBeNull();
    for (let y = 0; y < CAVE_WALL_TILE_H; y++) expect(gridR[y][0]).toBeNull();
  });

  test("wall strips are deterministic and differ by side/tint/width", () => {
    const left1 = caveWallUri({ tint, side: "left", widthPx: 1280 });
    expect(caveWallUri({ tint, side: "left", widthPx: 1280 })).toBe(left1);
    const right = caveWallUri({ tint, side: "right", widthPx: 1280 });
    expect(right).not.toBe(left1);
    const otherTint = caveWallUri({
      tint: "#8fa8b8",
      side: "left",
      widthPx: 1280,
    });
    expect(otherTint).not.toBe(left1);
    const narrow = caveWallUri({ tint, side: "left", widthPx: 360 });
    expect(narrow).not.toBe(left1);
  });
});
