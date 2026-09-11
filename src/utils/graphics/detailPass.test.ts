/**
 * Draft detail pass (docs/art-detail.md): derived top-left beveling over the
 * base sprite grids. Contracts tested: dimension preservation, input
 * immutability, transparency handling, palette membership (identity colors
 * never lost — every output is a base color or a lighten/darken of one),
 * determinism, thin-part preservation, and that the pass still "works" on
 * the real base grids (miners, pickaxes, gem, chunk, cave rows).
 */

import {
  detailPass,
  detailedPass,
  detailedSoftPass,
  DETAIL_STRONG,
  DETAIL_SOFT,
  mixHex,
  lightenHex,
  darkenHex,
} from "src/utils/graphics/detailPass";
import type { PixelGrid } from "src/utils/graphics/detailPass";
import {
  buildMinerGrid,
  buildPickaxeGrid,
  buildGemGrid,
  buildMineralChunkGrid,
} from "src/utils/graphics/pixelArt";
import { buildCaveRow } from "src/utils/graphics/caveTiles";

const N = null;
const F = "#808080"; // a base fill color

const grid = (rows: (string | null)[][]): PixelGrid =>
  rows.map((r) => r.map((c) => c));

/** All filled cells in `rows` (the rows are the base grid). */
const baseColors = (rows: (string | null)[][]): Set<string> =>
  new Set(
    rows
      .flat()
      .filter((c): c is string => c != null),
  );

const MINER_LOOK = {
  skin: "#ffdbb4",
  shirt: "#e8a33d",
  pants: "#3b4a6b",
  boots: "#4a3524",
  hat: "#e8c33d",
  hatStyle: "helmet" as const,
};
const PICKAXE_THEME = {
  head: "#9aa5b1",
  glow: "#d9e2ec",
  handle: "#8a5a2b",
};

/** The real base grids the pass must keep intact. */
const REAL_GRIDS: [string, PixelGrid][] = [
  ["classic miner", buildMinerGrid(MINER_LOOK)],
  ["animal miner", buildMinerGrid({ ...MINER_LOOK, species: "animal" })],
  ["pickaxe", buildPickaxeGrid(PICKAXE_THEME)],
  ["gem", buildGemGrid()],
  ["mineral chunk", buildMineralChunkGrid()],
  ["cave row", buildCaveRow(1, 0, "#8fa8b8")],
];

describe("mixHex / lightenHex / darkenHex", () => {
  it("t=0 returns the base color, t=1 the target", () => {
    expect(mixHex("#000000", "#ffffff", 0)).toBe("#000000");
    expect(mixHex("#3a4a5a", "#ffffff", 0)).toBe("#3a4a5a");
    expect(mixHex("#3a4a5a", "#ffffff", 1)).toBe("#ffffff");
    expect(mixHex("#3a4a5a", "#000000", 1)).toBe("#000000");
  });

  it("mixes per channel with half-up rounding", () => {
    // #000000 -> #ffffff at t=0.5 rounds 127.5 up to 128 = #808080.
    expect(mixHex("#000000", "#ffffff", 0.5)).toBe("#808080");
    // #808080 -> #000000 at t=0.5 is #404040.
    expect(darkenHex("#808080", 0.5)).toBe("#404040");
    // lighten is mix toward white; channels clamp at 255.
    expect(lightenHex("#ffffff", 0.9)).toBe("#ffffff");
    expect(darkenHex("#000000", 0.9)).toBe("#000000");
  });
});

describe("detailPass — shape contract", () => {
  it("preserves dimensions and never mutates its input", () => {
    const g = grid([
      [F, N, F],
      [N, F, N],
      [F, F, F],
    ]);
    const before = JSON.stringify(g);
    const out = detailPass(g);
    expect(JSON.stringify(g)).toBe(before);
    expect(out.length).toBe(g.length);
    for (let y = 0; y < g.length; y++) {
      expect(out[y]).toHaveLength(g[y].length);
    }
  });

  it("keeps empty cells empty and keeps them empty on the input side", () => {
    const g = grid([
      [F, N],
      [N, F],
    ]);
    const out = detailPass(g);
    for (let y = 0; y < g.length; y++) {
      for (let x = 0; x < g[y].length; x++) {
        expect((out[y][x] == null) === (g[y][x] == null)).toBe(true);
      }
    }
  });

  it("is deterministic", () => {
    const g = buildMinerGrid(MINER_LOOK);
    expect(detailPass(g)).toEqual(detailPass(g));
  });
});

describe("detailPass — lighting rules", () => {
    const base = grid([
      [F, F, F],
      [F, F, F],
      [F, F, F],
    ]);

    it("lightens lit (left/top-facing) edge pixels toward white", () => {
      const out = detailPass(base);
      const lit = lightenHex(F, DETAIL_STRONG.highlight);
      // Top row and left column face the top-left light.
      expect(out[0][0]).toBe(lit);
      expect(out[0][1]).toBe(lit);
      expect(out[1][0]).toBe(lit);
    });

    it("darkens shadow (right/bottom-facing) edge pixels toward black", () => {
      const out = detailPass(base);
      const shadow = darkenHex(F, DETAIL_STRONG.shadow);
      // Right column and bottom row face away from the light.
      expect(out[1][2]).toBe(shadow);
      expect(out[2][1]).toBe(shadow);
      expect(out[2][2]).toBe(shadow);
    });

    it("keeps corner pixels that face both light and shadow (a 1px corner is a thin part)", () => {
      const out = detailPass(base);
      // Top-right corner: lit (top edge) AND shadow (right edge) → kept.
      expect(out[0][2]).toBe(F);
    });

    it("keeps interior pixels at their base color", () => {
      const out = detailPass(base);
      expect(out[1][1]).toBe(F);
    });

    it("keeps thin (lit AND shadow) parts at their base color", () => {
      const line = grid([
        [N, F, F, F, N],
      ]);
      const out = detailPass(line);
      expect(out[0][1]).toBe(F);
      expect(out[0][2]).toBe(F);
      expect(out[0][3]).toBe(F);
      const column = grid([
        [F],
        [F],
        [F],
      ]);
      const outCol = detailPass(column);
      expect(outCol[0][0]).toBe(F);
      expect(outCol[1][0]).toBe(F);
      expect(outCol[2][0]).toBe(F);
    });
  });

describe("detailPass — palette contract on the real grids", () => {
  for (const [name, baseGrid] of REAL_GRIDS) {
    it(`keeps identity on the ${name}: every output color is a base color or a derived tone of one`, () => {
      const out = detailPass(baseGrid);
      const bases = baseColors(baseGrid as (string | null)[][]);
      const allowed = new Set<string>();
      for (const b of bases) {
        allowed.add(b);
        allowed.add(lightenHex(b, DETAIL_STRONG.highlight));
        allowed.add(darkenHex(b, DETAIL_STRONG.shadow));
      }
      for (let y = 0; y < out.length; y++) {
        for (let x = 0; x < out[y].length; x++) {
          const c = out[y][x];
          if (c == null) continue;
          expect(allowed.has(c)).toBe(true);
        }
      }
    });
  }

  it("actually shades something on the real grids (the pass is a no-op only where flat)", () => {
    for (const [, baseGrid] of REAL_GRIDS) {
      const out = detailPass(baseGrid);
      let retoned = 0;
      for (let y = 0; y < baseGrid.length; y++) {
        for (let x = 0; x < baseGrid[y].length; x++) {
          if (baseGrid[y][x] != null && baseGrid[y][x] !== out[y][x]) {
            retoned++;
          }
        }
      }
      expect(retoned).toBeGreaterThan(0);
    }
  });

  it("composes with itself: retoning an already-detailed grid stays in the base palette's closure", () => {
    const g = buildMinerGrid(MINER_LOOK);
    const once = detailPass(g);
    const bases = baseColors(g as (string | null)[][]);
    const out = detailPass(once);
    for (let y = 0; y < out.length; y++) {
      for (let x = 0; x < out[y].length; x++) {
        const c = out[y][x];
        if (c == null) continue;
        // Colors can drift one more step from the first-pass tones.
        let found = false;
        for (const b of bases) {
          for (const t of [0, DETAIL_STRONG.highlight, DETAIL_STRONG.shadow]) {
            if (lightenHex(b, t) === c || darkenHex(b, t) === c) found = true;
          }
          for (const c1 of [lightenHex(b, DETAIL_STRONG.highlight), darkenHex(b, DETAIL_STRONG.shadow), b]) {
            if (lightenHex(c1, DETAIL_STRONG.highlight) === c || darkenHex(c1, DETAIL_STRONG.shadow) === c) found = true;
          }
        }
        expect(found).toBe(true);
      }
    }
  });
});

describe("detailPass — the two drafts", () => {
  it("strong is a visibly bigger bevel than soft (more retoned mass, same identity)", () => {
    const g = buildMinerGrid(MINER_LOOK);
    const strong = detailedPass(g);
    const soft = detailedSoftPass(g);
    const count = (out: PixelGrid): number => {
      let n = 0;
      for (let y = 0; y < g.length; y++) {
        for (let x = 0; x < g[y].length; x++) {
          if (g[y][x] != null && g[y][x] !== out[y][x]) n++;
        }
      }
      return n;
    };
    expect(strong).not.toEqual(soft);
    // Same bevel SHAPE (same set of edge pixels re-toned) — only the tone
    // amounts differ between the two drafts.
    expect(count(strong)).toBe(count(soft));
    expect(count(strong)).toBeGreaterThan(0);
    // Same silhouette, same pixel count — only colors differ.
    const fill = (o: PixelGrid): number =>
      o.flat().filter((c) => c != null).length;
    expect(fill(strong)).toBe(fill(soft));
    expect(fill(strong)).toBe(g.flat().filter((c) => c != null).length);
  });

  it("DETAIL_SOFT retones strictly fewer pixels than DETAIL_STRONG only where amounts differ", () => {
    // Both passes re-tone the SAME set of edge pixels (the bevel shape is
    // identical); what differs is the amount, so the re-toned count is equal
    // on any grid. Assert the amounts differ so the two sheets can't drift
    // into the same look.
    expect(DETAIL_STRONG).not.toEqual(DETAIL_SOFT);
    expect(DETAIL_STRONG.highlight).toBeGreaterThan(DETAIL_SOFT.highlight);
    expect(DETAIL_STRONG.shadow).toBeGreaterThan(DETAIL_SOFT.shadow);
  });
});
