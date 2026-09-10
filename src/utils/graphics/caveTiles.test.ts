import { DEPTH_TIERS } from "src/mines_of_doom/game";
import {
  buildCaveRow,
  CAVE_EGG_KINDS,
  CAVE_METERS_PER_ROW,
  CAVE_PATH_TILES,
  CAVE_PX_PER_METER,
  CAVE_STRIPS_PER_TIER,
  CAVE_TILE_PX,
  CAVE_TIER_ATS,
  caveRowStartForDepth,
  caveRowUri,
  caveTierForDepth,
  caveTranslateForDepth,
  clearCaveTileCache,
  eggForStrip,
  gemColor,
  mixHex,
  pathEdgeColor,
  rockShades,
} from "./caveTiles";
import type { PixelGrid } from "./caveTiles";

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

describe("buildCaveRow", () => {
  test("produces a deterministically-sized, deterministic grid", () => {
    const a = buildCaveRow(2, 0, "#9a7fb8");
    const b = buildCaveRow(2, 0, "#9a7fb8");
    expect(a.length).toBe(24);
    expect(a[0].length).toBe(288);
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

  test("strip is within the PNG encoder's single-block size limit", () => {
    // gridToPngDataUri throws above 65535 raw bytes; exercising it here
    // catches a future COLS/width bump before it reaches the render loop.
    expect(() => buildCaveRow(4, 3, "#5ab8b8")).not.toThrow();
    const grid = buildCaveRow(4, 3, "#5ab8b8");
    const raw = grid.length * (1 + grid[0].length * 4);
    expect(raw).toBeLessThanOrEqual(65535);
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

  test("path tiles stay dug out (no rock, gems or eggs) in every strip", () => {
    const x0 = CAVE_PATH_TILES[0] * CAVE_TILE_PX;
    const x1 = (CAVE_PATH_TILES[CAVE_PATH_TILES.length - 1] + 1) * CAVE_TILE_PX;
    for (const grid of allRows()) {
      for (const row of grid) {
        for (let x = x0; x < x1; x++) {
          expect(row[x]).toBeNull();
        }
      }
    }
  });

  test("dark wall edges flank the path in every strip", () => {
    const edge = pathEdgeColor(TINT);
    const leftX =
      (CAVE_PATH_TILES[0] - 1) * CAVE_TILE_PX + CAVE_TILE_PX - 3;
    const rightX =
      (CAVE_PATH_TILES[CAVE_PATH_TILES.length - 1] + 1) * CAVE_TILE_PX;
    for (const grid of allRows()) {
      for (const row of grid) {
        for (const x of [leftX, leftX + 1, leftX + 2, rightX, rightX + 1, rightX + 2]) {
          expect(row[x]).toBe(edge);
        }
      }
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
});

describe("continuous descent (background rework)", () => {
  const topRowAt = (depth: number, y: number) =>
    caveRowStartForDepth(depth) +
    Math.floor(
      (y - caveTranslateForDepth(depth, caveRowStartForDepth(depth))) /
        CAVE_TILE_PX,
    );

  test("rowStart floors the descent into rows; meters-per-row is a whole row",
    () => {
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

  test("the row visible at a screen line equals floor of the world pixel",
    () => {
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
        const before = { s: caveRowStartForDepth(d), t: caveTranslateForDepth(d, caveRowStartForDepth(d)) };
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
});
