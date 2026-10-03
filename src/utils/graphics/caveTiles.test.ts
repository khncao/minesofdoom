import { DEPTH_TIERS } from "src/mines_of_doom/game";
import {
  buildCaveRockInk,
  buildCaveRow,
  buildCaveWall,
  CAVE_EGG_KINDS,
  CAVE_METERS_PER_ROW,
  CAVE_PATH_TILES,
  CAVE_PX_PER_METER,
  CAVE_ROCK_STYLES,
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
  isRockPixel,
  mixHex,
  pathEdgeColor,
  rockField,
  rockPlaneIndex,
  rockPlaneValue,
  rockShades,
  rockShadeRamp,
  ROCK_CHANCE,
  valueNoise,
} from "./caveTiles";
import type { CaveArtId, PixelGrid } from "./caveTiles";
import { activeCaveArt, DEFAULT_ART_PACK_ID, setActiveArtPack } from "./artPack";
import { paperRockInk, PAPER_SHADOW_OFFSET } from "./caveArt";
import { hashSeed } from "./pixelArt";
import { STRIP_MAX_BLOCK_PX } from "./pixelArt";

const PREFIX = "data:image/png;base64,";

// The rock direction follows the active art pack, so any test that swaps
// the pack has to put it back (the shipped default).
afterEach(() => setActiveArtPack(DEFAULT_ART_PACK_ID));

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

  test("rock shades are not quantized on a 2x2 block lattice (no block pattern)", () => {
    // Regression: the old drawRockTile sampled the field ONCE per 2×2 pixel
    // block, so every 2×2 cell was a single color — a visible block grid
    // (the "patterns in blocks" complaint). Per-pixel sampling + dithering
    // leaves only a handful of uniform cells per tile by chance.
    //
    // Pinned on the CLASSIC direction only: flat regions are the whole point
    // of the paper-cut sheets (their own no-lattice property is asserted in
    // the rock-directions suite below).
    let uniform = 0;
    let cells = 0;
    for (let tier = 0; tier < 5; tier++) {
      const grid = buildCaveRow(tier, tier % 4, "#7a6a8a", undefined, "classic");
      for (let y = 0; y + 2 <= grid.length; y += 2) {
        for (let x = 0; x + 2 <= grid[0].length; x += 2) {
          const a = grid[y][x];
          if (a == null) continue;
          cells++;
          if (
            a === grid[y + 1][x] &&
            a === grid[y][x + 1] &&
            a === grid[y + 1][x + 1]
          ) {
            uniform++;
          }
        }
      }
    }
    expect(cells).toBeGreaterThan(1000);
    expect(uniform / cells).toBeLessThan(0.25);
  });
});

// ---------------------------------------------------------------------------
// The rock directions (caveArt.ts). One geometry — the per-pixel silhouette
// and the object layout, untouched — and two ways of marking it: the classic
// dithered shade ramp, and the shipped paper-cut planes.
// ---------------------------------------------------------------------------
describe("rock directions", () => {
  const TINT = "#7a6a8a";

  /** Every color the rock body itself is painted in, per direction — the
   *  style in isolation, with none of the objects (crystals, ore, eggs)
   *  that a built strip composites on top of it. `open` asks for the gap
   *  palette instead: rock on the left half of the window, air on the
   *  right, so the cast shadow has something to fall on. */
  const rockPalette = (
    art: CaveArtId,
    open = false,
    n = 512,
  ): Set<string> => {
    const ink = buildCaveRockInk(TINT, art);
    const ctx = {
      shadeSeed: 0x5eed,
      planeSeed: 0x9a9e,
      rockAt: (x: number) => (open ? x < n / 2 : true),
    };
    const out = new Set<string>();
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const c = CAVE_ROCK_STYLES[art].paint(ink, x, y, !open, ctx);
        if (c != null) out.add(c);
      }
    }
    return out;
  };

  test("each direction paints only its own palette", () => {
    // The classic rock is the 10-step ramp and nothing else. The paper-cut
    // rock is three flat planes plus the lit cut core on the rock side and
    // the cast shadow on the gap side — five colors, and none of the ramp.
    const ramp = rockShadeRamp(TINT);
    expect([...rockPalette("classic")].sort()).toEqual([...ramp].sort());
    expect([...rockPalette("classic", true)]).toEqual([]);
    const paper = paperRockInk(TINT);
    expect([...rockPalette("papercut")].sort()).toEqual(
      [...paper.planes, paper.core].sort(),
    );
    expect([...rockPalette("papercut", true)].sort()).toEqual(
      [paper.shadow].sort(),
    );
    // The two directions are not the same art, and neither leaks the
    // other's rock colors (the rule every other draft here follows).
    for (const color of rockPalette("papercut")) {
      expect(ramp).not.toContain(color);
    }
    expect(JSON.stringify(buildCaveRow(2, 3, TINT, undefined, "classic"))).not.toBe(
      JSON.stringify(buildCaveRow(2, 3, TINT, undefined, "papercut")),
    );
  });

  test("the paper-cut planes are all used, in the calibrated shares", () => {
    // PLANE_EDGES is calibrated for roughly a quarter / a half / a quarter.
    // Census the plane colors over a wide sample of rock pixels (the
    // silhouette, not the whole grid) so the ratio is about the planes and
    // not about how much of each strip happens to be open.
    const paper = paperRockInk(TINT);
    const plane = new Map<string, number>();
    for (let tier = 0; tier < 5; tier++) {
      const seed = hashSeed(tier * 7919, 0x9a9e);
      for (let y = 0; y < 400; y++) {
        for (let x = 0; x < 400; x += 2) {
          if (!isRockPixel(x, y, tier)) continue;
          const i = rockPlaneIndex(rockPlaneValue(x, y, seed));
          plane.set(paper.planes[i], (plane.get(paper.planes[i]) ?? 0) + 1);
        }
      }
    }
    let total = 0;
    const shares: number[] = [];
    for (let i = 0; i < paper.planes.length; i++) {
      const n = plane.get(paper.planes[i]) ?? 0;
      total += n;
      shares.push(n);
    }
    expect(total).toBeGreaterThan(1000);
    // No dead plane, no plane that takes the wall over.
    for (const n of shares) {
      expect(n / total).toBeGreaterThan(0.1);
      expect(n / total).toBeLessThan(0.6);
    }
    // The mid plane carries the wall: the darkest and lightest are accents.
    expect(shares[1]).toBeGreaterThan(shares[0]);
    expect(shares[1]).toBeGreaterThan(shares[2]);
  });

  test("papercut is flat, but its planes do NOT sit on a lattice", () => {
    // The classic direction's job is to avoid flat cells; the paper-cut
    // direction's job is to be flat. What it must NOT do is reproduce the
    // block pattern the classic ramp was fixed for: a quantized field pins
    // every cut edge to a pixel lattice, and THAT is what reads as a
    // pattern. So assert both halves — genuinely flat, genuinely wandering.
    let uniform = 0;
    let cells = 0;
    // Cut-edge positions by pixel parity: [odd, even]. A field quantized on
    // a 2px lattice puts essentially every edge on one of the two.
    const xParity = [0, 0];
    const yParity = [0, 0];
    for (let tier = 0; tier < 5; tier++) {
      const grid = buildCaveRow(tier, tier % 4, TINT, undefined, "papercut");
      for (let y = 0; y + 2 <= grid.length; y += 2) {
        for (let x = 0; x + 2 <= grid[0].length; x += 2) {
          const a = grid[y][x];
          if (a == null) continue;
          cells++;
          if (
            a === grid[y + 1][x] &&
            a === grid[y][x + 1] &&
            a === grid[y + 1][x + 1]
          ) {
            uniform++;
          }
        }
      }
      for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[0].length - 1; x++) {
          if (grid[y][x] != null && grid[y][x] !== grid[y][x + 1]) {
            xParity[x % 2]++;
          }
        }
      }
      for (let y = 0; y < grid.length - 1; y++) {
        for (let x = 0; x < grid[0].length; x++) {
          if (grid[y][x] != null && grid[y][x] !== grid[y + 1][x]) {
            yParity[y % 2]++;
          }
        }
      }
      // Cut edges down one column, in the open rock of the strip.
    }
    // The sheets are big (that is the style), so the spacing between two cut
    // edges is measured on the FIELD down a long column rather than inside a
    // 24px strip, which is often entirely within one sheet: a metronome
    // would still show up here, as a spread of ~0.
    const gaps: number[] = [];
    for (let tier = 0; tier < 5; tier++) {
      const seed = hashSeed(tier * 7919, 0x9a9e);
      for (const x of [24, 96, 168, 240, 312]) {
        let last = -1;
        for (let y = 0; y < 600; y++) {
          const i = rockPlaneIndex(rockPlaneValue(x, y, seed));
          if (last >= 0 && i !== last) gaps.push(y - last);
          last = i;
        }
      }
    }
    expect(gaps.length).toBeGreaterThan(20);
    // Flat: the sheets really are flat (that is the style).
    expect(cells).toBeGreaterThan(1000);
    expect(uniform / cells).toBeGreaterThan(0.5);
    // Wandering: hundreds of cut edges, split roughly evenly across the two
    // parities — a lattice would put them all on one.
    const xEdges = xParity[0] + xParity[1];
    const yEdges = yParity[0] + yParity[1];
    expect(xEdges).toBeGreaterThan(200);
    expect(yEdges).toBeGreaterThan(200);
    for (const share of [xParity[0] / xEdges, xParity[1] / xEdges,
      yParity[0] / yEdges, yParity[1] / yEdges]) {
      expect(share).toBeGreaterThan(0.3);
      expect(share).toBeLessThan(0.7);
    }
    // …and at no fixed pitch: real spread, not a metronome.
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const sd = Math.sqrt(
      gaps.reduce((s, g) => s + (g - mean) ** 2, 0) / gaps.length,
    );
    expect(sd / mean).toBeGreaterThan(0.2);
  });

  test("the paper-cut sheets continue across row strips and tile boundaries", () => {
    // The load-bearing cave property (see the classic banding test): a cut
    // edge never lands on a strip seam, because the plane field is sampled
    // at the global pixel the world has there. This is even sharper than the
    // ramp's test — the planes are FLAT, so a reseed or a per-row decision
    // would show up as a hard 100% mismatch here rather than a soft one.
    for (const tier of [0, 2, 4]) {
      let both = 0;
      let same = 0;
      for (let row = 0; row < 8; row++) {
        const a = buildCaveRow(tier, row, TINT, undefined, "papercut");
        const b = buildCaveRow(tier, row + 1, TINT, undefined, "papercut");
        for (let x = 0; x < a[0].length; x++) {
          const pa = a[CAVE_TILE_PX - 1][x];
          const pb = b[0][x];
          if (pa == null || pb == null) continue;
          both++;
          if (pa === pb) same++;
        }
      }
      expect(both).toBeGreaterThan(400);
      expect(same / both).toBeGreaterThan(0.9);
    }
  });

  test("the lit cut edge and the cast shadow both appear, only where they should", () => {
    // The two marks that make a sheet read as a sheet. The core is painted on
    // a cut edge (the first row of rock against open air) and on a sheet's
    // own lip (the row that tucks under a lighter sheet), so it is always
    // rock — never a gap, never the shaft; the shadow is always a gap, and
    // always within PAPER_SHADOW_OFFSET of the rock that threw it (light
    // comes from the top-left, as in the character sheets).
    const paper = paperRockInk(TINT);
    let core = 0;
    let coreOnACutEdge = 0;
    let shadow = 0;
    for (let tier = 0; tier < 5; tier++) {
      for (let row = 0; row < 3; row++) {
        const grid = buildCaveRow(tier, row * 5 + 2, TINT, undefined, "papercut");
        for (let y = 0; y < CAVE_TILE_PX; y++) {
          for (let x = 0; x < grid[0].length; x++) {
            const c = grid[y][x];
            if (c === paper.core) {
              core++;
              expect(c).not.toBe(paper.shadow);
              const onCutEdge =
                (y > 0 && grid[y - 1][x] == null) ||
                (x > 0 && grid[y][x - 1] == null);
              if (onCutEdge) coreOnACutEdge++;
            } else if (c === paper.shadow) {
              shadow++;
              // A shadow in the first two rows was thrown by rock in the
              // strip ABOVE (the offset reads the global pixel, which is the
              // whole point), so this grid has nothing to show for it.
              if (y < PAPER_SHADOW_OFFSET) continue;
              let near = false;
              for (let dy = 1; dy <= PAPER_SHADOW_OFFSET && !near; dy++) {
                for (let dx = 1; dx <= PAPER_SHADOW_OFFSET && !near; dx++) {
                  const sx = x - dx;
                  const sy = y - dy;
                  if (sx < 0) continue;
                  const p = grid[sy][sx];
                  if (p != null && p !== paper.shadow) near = true;
                }
              }
              expect(near).toBe(true);
            }
          }
        }
      }
    }
    // Both marks really are on screen (a renderer that quietly painted
    // neither would still pass the property assertions above).
    expect(core).toBeGreaterThan(500);
    expect(coreOnACutEdge).toBeGreaterThan(200);
    expect(shadow).toBeGreaterThan(200);
  });

  test("the direction follows the art pack, and the caches stay apart", () => {
    // One setActiveArtPack brings back the classic cave with the classic
    // characters; and because the direction is in the cache key, a live swap
    // can never serve the other one's rock.
    setActiveArtPack("pixel");
    expect(activeCaveArt()).toBe("classic");
    const classicRow = buildCaveRow(2, 5, TINT);
    const classicUri = caveRowUri({ depth: 20, tint: TINT });
    const classicWall = buildCaveWall("left", TINT, 48, 2);
    setActiveArtPack("papercut");
    expect(activeCaveArt()).toBe("papercut");
    expect(JSON.stringify(buildCaveRow(2, 5, TINT))).toBe(
      JSON.stringify(buildCaveRow(2, 5, TINT, undefined, "papercut")),
    );
    expect(JSON.stringify(buildCaveWall("left", TINT, 48, 2))).toBe(
      JSON.stringify(buildCaveWall("left", TINT, 48, 2, "papercut")),
    );
    // Different art → different rock, in both cache layers.
    expect(caveRowUri({ depth: 20, tint: TINT })).not.toBe(classicUri);
    expect(
      caveWallUri({ tint: TINT, side: "left", widthPx: 48, band: 2 }),
    ).not.toBe(
      caveWallUri({ tint: TINT, side: "left", widthPx: 48, band: 2, art: "classic" }),
    );
    // …and the explicit art argument wins over the active pack, so the
    // contact sheet can render either one.
    expect(caveRowUri({ depth: 20, tint: TINT, art: "classic" })).toBe(
      classicUri,
    );
    expect(JSON.stringify(buildCaveRow(2, 5, TINT))).not.toBe(
      JSON.stringify(classicRow),
    );
    expect(JSON.stringify(buildCaveWall("left", TINT, 48, 2))).not.toBe(
      JSON.stringify(classicWall),
    );
  });

  test("an unknown direction falls back to the classic rock", () => {
    // The packs are the only source of a direction, so this is a guard, not
    // a feature: it keeps a bad id from painting `undefined` into a strip.
    const bogus = buildCaveRow(1, 0, TINT, undefined, "nope" as CaveArtId);
    expect(JSON.stringify(bogus)).toBe(
      JSON.stringify(buildCaveRow(1, 0, TINT, undefined, "classic")),
    );
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

  test("rock body is continuous across row strips (no per-row banding)", () => {
    // The shade field is sampled at GLOBAL pixel y with a per-tier seed,
    // so the bottom of row r and the top of row r+1 continue the same rock
    // body. (The old per-row seed + per-row bottom fade reset every 24px
    // and read as a repeating dark stripe at every row boundary.)
    //
    // The seam pair must be no coarser than a typical pair ANYWHERE inside a
    // row — comparing against an interior control (rather than a fixed
    // ratio) is what makes this a banding test: a row-local reseed or fade
    // would make the seam far worse than the interior, and that is what
    // fails here.
    for (const tier of [0, 2]) {
      let both = 0;
      let same = 0;
      let innerBoth = 0;
      let innerSame = 0;
      for (let row = 0; row < 8; row++) {
        const a = buildCaveRow(tier, row, "#8fa8b8");
        const b = buildCaveRow(tier, row + 1, "#8fa8b8");
        for (let x = 0; x < a[0].length; x++) {
          const pa = a[CAVE_TILE_PX - 1][x];
          const pb = b[0][x];
          if (pa != null && pb != null) {
            both++;
            if (pa === pb) same++;
          }
          // Interior control: a vertically adjacent pair in the middle of
          // this same row, away from any strip boundary.
          const qa = a[10][x];
          const qb = a[11][x];
          if (qa != null && qb != null) {
            innerBoth++;
            if (qa === qb) innerSame++;
          }
        }
      }
      expect(both).toBeGreaterThan(400);
      expect(innerBoth).toBeGreaterThan(400);
      // The seam is within a shade step of the interior (see the note above).
      expect(same / both).toBeGreaterThan(innerSame / innerBoth - 0.08);
    }
  });

  test("the rock silhouette crosses tile and row boundaries (no 24px lattice)", () => {
    // The layout used to be decided once per 24px TILE, so every rock mass
    // was a staircase of tile-sized steps and a mass was chopped wherever it
    // crossed a row boundary. Now the rock is per pixel: a healthy share of
    // tiles must be MIXED (both rock and gap), and the rock must continue
    // across the row seam rather than ending at it.
    let mixedTiles = 0;
    let totalTiles = 0;
    let seamRockContinues = 0;
    let seamRockTotal = 0;
    for (let tier = 0; tier < 5; tier++) {
      for (let row = 20; row < 24; row++) {
        const a = buildCaveRow(tier, row, "#7a6a8a");
        const b = buildCaveRow(tier, row + 1, "#7a6a8a");
        const count = a[0].length / CAVE_TILE_PX;
        const [pa, pb] = cavePathTiles(count);
        for (let tile = 0; tile < count; tile++) {
          if (tile === pa || tile === pb) continue;
          let opaque = 0;
          let total = 0;
          for (let y = 0; y < CAVE_TILE_PX; y++) {
            for (let x = tile * CAVE_TILE_PX; x < (tile + 1) * CAVE_TILE_PX; x++) {
              total++;
              if (a[y][x] != null) opaque++;
            }
          }
          totalTiles++;
          if (opaque > 0.08 * total && opaque < 0.92 * total) mixedTiles++;
        }
        // Rock at the bottom row of `a` continues into the top row of `b`
        // wherever `b` also has rock (and vice versa) — a chopped mass
        // would show far more mismatch than this.
        for (let x = 0; x < a[0].length; x++) {
          const top = a[CAVE_TILE_PX - 1][x] != null;
          const cont = b[0][x] != null;
          if (top || cont) {
            seamRockTotal++;
            if (top && cont) seamRockContinues++;
          }
        }
      }
    }
    expect(totalTiles).toBeGreaterThan(200);
    // Measured ≈0.41 of tiles straddle the rock/gap contour; the old
    // tile-decided layout was 0.00 by construction (every tile was all rock
    // or all gap). 0.3 leaves headroom while still failing the old code.
    expect(mixedTiles / totalTiles).toBeGreaterThan(0.3);
    // …and the two rows agree about being rock far more often than not.
    expect(seamRockContinues / seamRockTotal).toBeGreaterThan(0.75);
  });

  test("gap layout keeps rock density near target (coherent, not a die roll)", () => {
    // A full rock tile is (nearly) all opaque; an empty tile is null except
    // the thin path-edge stripes on the shaft-flanking tiles. A tile with
    // <50% opaque pixels is therefore a gap tile, and the rock share across
    // all strips must stay near ROCK_CHANCE (0.62) — pins the GAP_LEVEL
    // calibration so the cave neither fills in nor dissolves.
    let rockTiles = 0;
    let totalTiles = 0;
    for (let tier = 0; tier < 5; tier++) {
      for (let strip = 0; strip < 4; strip++) {
        const grid = buildCaveRow(tier, strip, "#7a6a8a");
        const count = grid[0].length / CAVE_TILE_PX;
        const [pa, pb] = cavePathTiles(count);
        for (let tile = 0; tile < count; tile++) {
          if (tile === pa || tile === pb) continue;
          totalTiles++;
          let opaque = 0;
          for (let y = 0; y < CAVE_TILE_PX; y++) {
            for (
              let x = tile * CAVE_TILE_PX;
              x < (tile + 1) * CAVE_TILE_PX;
              x++
            ) {
              if (grid[y][x] != null) opaque++;
            }
          }
          if (opaque > 0.5 * CAVE_TILE_PX * CAVE_TILE_PX) rockTiles++;
        }
      }
    }
    expect(totalTiles).toBeGreaterThan(200);
    expect(rockTiles / totalTiles).toBeGreaterThan(ROCK_CHANCE - 0.2);
    expect(rockTiles / totalTiles).toBeLessThan(ROCK_CHANCE + 0.2);
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

  test("rows are absolute — no repeating texture cycle", () => {
    const d12 = caveRowUri({ depth: 12, tint: "#8fa8b8" });
    // Depths within the same 4 m row share one (absolute, unique-per-row)
    // texture — the strip slides within it; the old design's 4-row texture
    // CYCLE is gone, so rows one apart differ.
    expect(caveRowUri({ depth: 13, tint: "#8fa8b8" })).toBe(d12);
    expect(caveRowUri({ depth: 15, tint: "#8fa8b8" })).toBe(d12);
    expect(caveRowUri({ depth: 16, tint: "#8fa8b8" })).not.toBe(d12);
    expect(caveRowUri({ depth: 17, tint: "#8fa8b8" })).not.toBe(d12);
    expect(caveRowUri({ depth: 20, tint: "#8fa8b8" })).not.toBe(d12);
    // A different theme tint bakes different colors in.
    expect(caveRowUri({ depth: 12, tint: "#c8a8e0" })).not.toBe(d12);
  });

  test("rolling cache evicts old rows but re-encodes them identically", () => {
    const shallow = caveRowUri({ depth: 5, tint: "#8fa8b8" });
    // Descend far enough that the shallow row is outside the rolling span
    // (ROW_CACHE_SPAN = 96 rows = 384 m): the insert evicts it…
    caveRowUri({ depth: 500, tint: "#8fa8b8" });
    // …and a re-fetch re-encodes the SAME pixels from the same seed.
    expect(caveRowUri({ depth: 5, tint: "#8fa8b8" })).toBe(shallow);
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

  test("wall bands are unique per band and continue one rock body", () => {
    // The wall used to be ONE strip repeated every CAVE_WALL_TILE_H — the
    // most obvious repeat on screen. Bands are addressed by absolute depth
    // now, so every band is its own texture…
    const a = buildCaveWall("left", tint, 48, 0);
    const b = buildCaveWall("left", tint, 48, 1);
    expect(b).not.toEqual(a);
    expect(buildCaveWall("left", tint, 48, 7)).not.toEqual(a);
    // …and because the rock field is sampled at GLOBAL y, band 1's first
    // row continues band 0's last row (no seam line at the boundary).
    // Compare the seam against an interior control: a per-band reseed would
    // make the boundary far coarser than any pair inside a band, and that is
    // what fails. Aggregated over many bands — one 12px seam is too small a
    // sample for an exact-shade match ratio.
    const solid = Array.from({ length: 12 }, (_, i) => i); // outer band
    let seamSame = 0;
    let seamBoth = 0;
    let innerSame = 0;
    let innerBoth = 0;
    for (let band = 0; band < 20; band++) {
      const cur = buildCaveWall("left", tint, 48, band);
      const nextBand = buildCaveWall("left", tint, 48, band + 1);
      for (const x of solid) {
        const seamPair = [cur[CAVE_WALL_TILE_H - 1][x], nextBand[0][x]];
        if (seamPair[0] != null && seamPair[1] != null) {
          seamBoth++;
          if (seamPair[0] === seamPair[1]) seamSame++;
        }
        const innerPair = [cur[60][x], cur[61][x]];
        if (innerPair[0] != null && innerPair[1] != null) {
          innerBoth++;
          if (innerPair[0] === innerPair[1]) innerSame++;
        }
      }
    }
    expect(seamBoth).toBeGreaterThan(150);
    expect(innerBoth).toBeGreaterThan(150);
    expect(seamSame / seamBoth).toBeGreaterThan(innerSame / innerBoth - 0.12);
  });

  test("the wall edge profile varies down the wall instead of repeating", () => {
    // Not just the rock: the jagged inner cut must wander. Measure how far
    // each row's cut sits from the wall's mean — a constant cut (or a strip
    // that repeats every band) would collapse this spread.
    const spread = (band: number): number => {
      const grid = buildCaveWall("left", tint, 48, band);
      const cuts: number[] = [];
      for (let y = 0; y < CAVE_WALL_TILE_H; y += 3) {
        let cut = 0;
        for (let x = 47; x >= 0 && grid[y][x] == null; x--) cut++;
        cuts.push(cut);
      }
      const mean = cuts.reduce((s, c) => s + c, 0) / cuts.length;
      return Math.sqrt(
        cuts.reduce((s, c) => s + (c - mean) ** 2, 0) / cuts.length,
      );
    };
    for (const band of [0, 1, 5, 9]) {
      expect(spread(band)).toBeGreaterThan(1);
    }
  });

  test("caveWallUri is band-keyed and rolls its cache", () => {
    clearCaveTileCache();
    const first = caveWallUri({ tint, side: "left", widthPx: 48, band: 0 });
    expect(caveWallUri({ tint, side: "left", widthPx: 48, band: 0 })).toBe(first);
    const second = caveWallUri({ tint, side: "left", widthPx: 48, band: 1 });
    expect(second).not.toBe(first);
    // Re-encoding a band after eviction reproduces it byte for byte.
    for (let band = 0; band < 40; band++) {
      caveWallUri({ tint, side: "left", widthPx: 48, band });
    }
    expect(caveWallUri({ tint, side: "left", widthPx: 48, band: 0 })).toBe(first);
    // A band id is part of the key: band 5 ≠ band 5 on the other side.
    expect(
      caveWallUri({ tint, side: "right", widthPx: 48, band: 5 }),
    ).not.toBe(caveWallUri({ tint, side: "left", widthPx: 48, band: 5 }));
    clearCaveTileCache();
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
