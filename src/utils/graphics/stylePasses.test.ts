/**
 * Draft art-style passes (docs/art-styles.md): pure grid transforms over the
 * base sprite grids. Contracts tested: dimension preservation, input
 * immutability, transparency handling, palette membership, determinism, and
 * that every style still "works" on the real base grids (miners, pickaxes,
 * cave rows).
 */

import {
  applyStyle,
  flatPass,
  monoPass,
  outlinePass,
  retro16Pass,
  STYLE_IDS,
  MONO_COLORS,
  OUTLINE_INK,
  RETRO16_PALETTE,
} from "src/utils/graphics/stylePasses";
import type { PixelGrid } from "src/utils/graphics/stylePasses";
import { buildMinerGrid, buildPickaxeGrid } from "src/utils/graphics/pixelArt";
import { buildCaveRow } from "src/utils/graphics/caveTiles";

const N = null;
// Two REAL retro16 palette members (the pass must snap them onto
// themselves, not onto a different palette entry).
const A = "#d9534f"; // red
const B = "#5cb85c"; // leaf green

/** Checkerboard: A at (0,0), B at (1,0); everything else empty. */
const FIXED: PixelGrid = [
  [A, B, N, N],
  [N, N, N, N],
];

function snapshot(grid: PixelGrid): PixelGrid {
  return grid.map((r) => [...r]);
}

function expectSameDims(src: PixelGrid, out: PixelGrid): void {
  expect(out.length).toBe(src.length);
  for (const row of out) expect(row.length).toBe(src[0].length);
}

function hasColor(grid: PixelGrid, color: string): boolean {
  return grid.some((row) => row.includes(color));
}

// ---------------------------------------------------------------------------
// flat (the baseline)
// ---------------------------------------------------------------------------

describe("flatPass (baseline)", () => {
  it("returns an equal copy, not the same reference", () => {
    const g = snapshot(FIXED);
    const out = flatPass(g);
    expect(out).toEqual(g);
    expect(out).not.toBe(g);
    expect(out[0]).not.toBe(g[0]);
  });
});

// ---------------------------------------------------------------------------
// mono (1-bit dither)
// ---------------------------------------------------------------------------

describe("monoPass (1-bit dither)", () => {
  it("emits only ink, paper, and transparent", () => {
    const out = monoPass(FIXED);
    for (const row of out) {
      for (const px of row) {
        expect(px == null ? true : MONO_COLORS.includes(px)).toBe(true);
      }
    }
  });

  it("preserves transparency and dimensions", () => {
    const out = monoPass(FIXED);
    expectSameDims(FIXED, out);
    expect(out[1][0]).toBeNull();
  });

  it("is deterministic and input-immutative", () => {
    const g = snapshot(FIXED);
    const before = snapshot(g);
    const a = monoPass(g);
    const b = monoPass(g);
    expect(g).toEqual(before);
    expect(a).toEqual(b);
  });

  it("splits both inks on a real miner grid (neither color is empty)", () => {
    const out = monoPass(
      buildMinerGrid({
        skin: "#ffdbb4",
        shirt: "#e8a33d",
        pants: "#3b4a6b",
        boots: "#4a3524",
        hat: "#e8c33d",
        hatStyle: "helmet",
      }),
    );
    expect(hasColor(out, MONO_COLORS[0])).toBe(true);
    expect(hasColor(out, MONO_COLORS[1])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// retro16 (limited palette)
// ---------------------------------------------------------------------------

describe("retro16Pass (16-color console)", () => {
  it("palette has exactly 16 distinct colors", () => {
    expect(RETRO16_PALETTE).toHaveLength(16);
    expect(new Set(RETRO16_PALETTE).size).toBe(16);
  });

  it("snaps every color into the palette, keeps nulls, keeps dims", () => {
    const out = retro16Pass(FIXED);
    expectSameDims(FIXED, out);
    expect(out[1][0]).toBeNull();
    for (const row of out) {
      for (const px of row) {
        if (px != null) expect(RETRO16_PALETTE).toContain(px);
      }
    }
  });

  it("lands palette members exactly on themselves", () => {
    const out = retro16Pass(FIXED);
    expect([out[0][0], out[0][1]]).toEqual([A, B]);
  });

  it("is deterministic and input-immutative", () => {
    const g = snapshot(FIXED);
    const before = snapshot(g);
    const a = retro16Pass(g);
    const b = retro16Pass(g);
    expect(g).toEqual(before);
    expect(a).toEqual(b);
  });
});

// ---------------------------------------------------------------------------
// outline (cel edge)
// ---------------------------------------------------------------------------

describe("outlinePass (cel outline)", () => {
  it("never changes filled pixels", () => {
    const out = outlinePass(FIXED);
    expect(out[0][0]).toBe(A);
    expect(out[0][1]).toBe(B);
  });

  it("inks exactly the empty cells adjacent (8-way) to fill", () => {
    const out = outlinePass(FIXED);
    // Adjacent to (0,0)/(1,0): the whole row 1 under them plus (2,0).
    expect(out[0][2]).toBe(OUTLINE_INK);
    expect(out[1][0]).toBe(OUTLINE_INK);
    expect(out[1][1]).toBe(OUTLINE_INK);
    expect(out[1][2]).toBe(OUTLINE_INK);
    // (3,0)/(3,1) touch no filled cell — row 0 is the last row, col 3 only
    // borders (2,0), which is itself empty.
    expect(out[0][3]).toBeNull();
  });

  it("leaves an all-empty grid untouched (except a copy)", () => {
    const empty: PixelGrid = [
      [N, N, N],
      [N, N, N],
    ];
    const out = outlinePass(empty);
    expect(out).toEqual(empty);
    expect(out).not.toBe(empty);
  });

  it("is deterministic and input-immutative", () => {
    const g = snapshot(FIXED);
    const before = snapshot(g);
    const a = outlinePass(g);
    const b = outlinePass(g);
    expect(g).toEqual(before);
    expect(a).toEqual(b);
  });
});

// ---------------------------------------------------------------------------
// Registry + integration over the real base grids
// ---------------------------------------------------------------------------

describe("applyStyle over the real base grids", () => {
  const miner = buildMinerGrid({
    skin: "#e07020",
    shirt: "#3a4a5a",
    pants: "#c85a18",
    boots: "#3a2a1a",
    hat: "#e8e8e8",
    hatStyle: "bandana",
    species: "animal",
  });
  const pickaxe = buildPickaxeGrid({
    head: "#4a4a5a",
    glow: "#9a7fd0",
    handle: "#2a2233",
  });
  const cave = buildCaveRow(1, 0, "#8fa8b8");

  for (const id of STYLE_IDS) {
    for (const [name, base] of [
      ["miner", miner],
      ["pickaxe", pickaxe],
      ["cave row", cave],
    ] as const) {
      it(`${id} keeps dims and produces a non-degenerate ${name}`, () => {
        const out = applyStyle(id, base);
        expectSameDims(base, out);
        // Some filled cell survived.
        let filled = 0;
        for (const row of out) filled += row.filter((p) => p != null).length;
        expect(filled).toBeGreaterThan(0);
      });
    }
  }
});
