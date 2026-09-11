/**
 * Draft anime chibi art (docs/art-anime.md): contracts tested — 32×32
 * shape, palette membership (the whole tuning surface), determinism,
 * transparent margins, hair-style difference, and that the real looks
 * used by the sample sheet render with content (no empty sprites).
 */
import {
  ANIME_BOOT,
  ANIME_BLUSH,
  ANIME_GRID_SIZE,
  ANIME_HIGHLIGHT,
  animePalette,
  buildAnimeCharacterGrid,
} from "src/utils/graphics/animeArt";
import type { AnimeLook } from "src/utils/graphics/animeArt";
import type { PixelGrid } from "src/utils/graphics/pixelArt";

// The same three looks scripts/generate-anime-art-samples.mjs renders, so
// the tested set IS the shipped sample set.
const LOOKS: AnimeLook[] = [
  { skin: "#ffe3c8", hair: "#ff9ecd", dress: "#b48cff", bow: "#ff5f9e", hairStyle: "bob" },
  { skin: "#f2c9a0", hair: "#7ad0e8", dress: "#ffd166", bow: "#ef476f", hairStyle: "long" },
  { skin: "#ffe3c8", hair: "#c3b1ff", dress: "#8fe3c0", bow: "#7a5fd0", hairStyle: "long" },
];

function isFilled(grid: PixelGrid): number {
  let n = 0;
  for (const row of grid) for (const c of row) if (c != null) n++;
  return n;
}

function paletteViolations(grid: PixelGrid, palette: string[]): string[] {
  const ok = new Set(palette);
  const bad: string[] = [];
  for (const row of grid)
    for (const c of row) if (c != null && !ok.has(c)) bad.push(c);
  return bad;
}

describe("buildAnimeCharacterGrid", () => {
  it("is exactly 32×32 for every real look", () => {
    for (const look of LOOKS) {
      const g = buildAnimeCharacterGrid(look);
      expect(g).toHaveLength(ANIME_GRID_SIZE);
      for (const row of g) expect(row).toHaveLength(ANIME_GRID_SIZE);
    }
  });

  it("keeps the outer margin transparent", () => {
    for (const look of LOOKS) {
      const g = buildAnimeCharacterGrid(look);
      expect(g[0].every((c) => c == null)).toBe(true);
      expect(g[ANIME_GRID_SIZE - 1].every((c) => c == null)).toBe(true);
      for (const row of g) {
        expect(row[0]).toBeNull();
        expect(row[ANIME_GRID_SIZE - 1]).toBeNull();
      }
    }
  });

  it("every pixel is a member of animePalette(look)", () => {
    for (const look of LOOKS) {
      const g = buildAnimeCharacterGrid(look);
      expect(paletteViolations(g, animePalette(look))).toEqual([]);
    }
  });

  it("palette contains the look's colors and the fixed constants", () => {
    for (const look of LOOKS) {
      const pal = new Set(animePalette(look));
      expect(pal.has(look.skin)).toBe(true);
      expect(pal.has(look.hair)).toBe(true);
      expect(pal.has(look.dress)).toBe(true);
      expect(pal.has(look.bow)).toBe(true);
      for (const fixed of [ANIME_BLUSH, ANIME_HIGHLIGHT, ANIME_BOOT]) {
        expect(pal.has(fixed)).toBe(true);
      }
    }
  });

  it("is deterministic (same look → identical grid)", () => {
    const a = buildAnimeCharacterGrid(LOOKS[1]);
    const b = buildAnimeCharacterGrid(LOOKS[1]);
    expect(b).toEqual(a);
    expect(b).not.toBe(a); // fresh grid, not the same reference
  });

  it("does not mutate the look", () => {
    const look: AnimeLook = { ...LOOKS[0] };
    const before = JSON.stringify(look);
    buildAnimeCharacterGrid(look);
    expect(JSON.stringify(look)).toBe(before);
  });

  it("renders real content (not an empty or near-empty sprite)", () => {
    for (const look of LOOKS) {
      const n = isFilled(buildAnimeCharacterGrid(look));
      // A chibi at 32×32 fills a few hundred pixels; pin a wide band so a
      // palette rename or an accidental fill bug both fail.
      expect(n).toBeGreaterThan(300);
      expect(n).toBeLessThan(1200);
    }
  });

  it("bob and long differ exactly in the side-hair column region", () => {
    const bob = buildAnimeCharacterGrid({ ...LOOKS[0], hairStyle: "bob" });
    const long = buildAnimeCharacterGrid({ ...LOOKS[0], hairStyle: "long" });
    let diffs = 0;
    for (let y = 0; y < ANIME_GRID_SIZE; y++) {
      for (let x = 0; x < ANIME_GRID_SIZE; x++) {
        if (bob[y][x] !== long[y][x]) {
          diffs++;
          // Columns live at x 6..9 / 22..25, y 14..24 — nowhere else.
          const mirrored = x >= 31 - 9 && x <= 31 - 6;
          expect((x >= 6 && x <= 9) || mirrored).toBe(true);
          expect(y).toBeGreaterThanOrEqual(14);
          expect(y).toBeLessThanOrEqual(24);
        }
      }
    }
    expect(diffs).toBeGreaterThan(0);
  });

  it("both hair styles show the fringe tips and the scalloped hem gaps", () => {
    for (const style of ["bob", "long"] as const) {
      const g = buildAnimeCharacterGrid({ ...LOOKS[1], hairStyle: style });
      // Fringe tips (row 10) alternate hair/skin — check one tip + one gap.
      expect(g[10][13]).toBe(LOOKS[1].hair); // tip
      expect(g[10][15]).not.toBe(LOOKS[1].hair); // gap between tips
      // Frill hem (row 27): four lobes with 1px gaps at x 12, 16, 20.
      expect(g[27][10]).toBe(LOOKS[1].dress); // lobe
      expect(g[27][12]).toBeNull(); // gap
      expect(g[27][22]).toBe(LOOKS[1].dress); // lobe
      expect(g[27][20]).toBeNull(); // gap
    }
  });

  it("respects a custom eye color (and defaults when omitted)", () => {
    const custom = buildAnimeCharacterGrid({ ...LOOKS[0], eye: "#123456" });
    expect(custom[15][11]).toBe("#123456");
    const def = buildAnimeCharacterGrid(LOOKS[0]);
    expect(def[15][11]).not.toBe("#123456");
    expect(
      paletteViolations(def, animePalette(LOOKS[0])),
    ).toEqual([]);
  });
});
