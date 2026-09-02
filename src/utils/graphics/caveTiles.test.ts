import { DEPTH_TIERS } from "src/mines_of_doom/game";
import {
  buildCaveRow,
  CAVE_STRIPS_PER_TIER,
  CAVE_TIER_ATS,
  caveRowUri,
  caveTierForDepth,
  clearCaveTileCache,
  gemColor,
  mixHex,
  rockShades,
} from "./caveTiles";

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
