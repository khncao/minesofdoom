import {
  CAVE_ART_IDS,
  CAVE_ART_LABELS,
  PAPER_PLANES,
  PAPER_SHADOW_OFFSET,
  paintPaperRock,
  paperRockInk,
} from "./caveArt";
import type { PaperPixel } from "./caveArt";

const INK = paperRockInk("#7a6a8a");
const [LIGHT, MID, DARK] = INK.planes;

/** Luminance, for "which plane is which" assertions. */
const lum = (hex: string): number =>
  parseInt(hex.slice(1, 3), 16) +
  parseInt(hex.slice(3, 5), 16) +
  parseInt(hex.slice(5, 7), 16);

/** A rock pixel with nothing special around it. */
const solid = (over: Partial<PaperPixel> = {}): PaperPixel => ({
  plane: 1,
  above: 1,
  rock: true,
  rockAt: () => true,
  ...over,
});

describe("the paper stock", () => {
  it("is three planes, lightest to darkest, around the tint", () => {
    expect(PAPER_PLANES).toBe(3);
    expect(INK.planes).toHaveLength(3);
    expect(INK.planes[1]).toBe("#7a6a8a");
    expect(lum(LIGHT)).toBeGreaterThan(lum(MID));
    expect(lum(MID)).toBeGreaterThan(lum(DARK));
    expect(lum(INK.core)).toBeGreaterThan(lum(LIGHT));
    expect(lum(INK.shadow)).toBeLessThan(lum(DARK));
  });

  it("is derived from the tint, not baked", () => {
    const other = paperRockInk("#c85a18");
    expect(other.planes[1]).toBe("#c85a18");
    for (let i = 0; i < 3; i++) {
      expect(other.planes[i]).not.toBe(INK.planes[i]);
    }
    // Pure and total: the same tint always gives the same stock.
    expect(paperRockInk("#7a6a8a")).toEqual(INK);
  });

  it("names both directions", () => {
    expect(CAVE_ART_IDS).toEqual(["classic", "papercut"]);
    expect(CAVE_ART_LABELS.classic.length).toBeGreaterThan(0);
    expect(CAVE_ART_LABELS.papercut.length).toBeGreaterThan(0);
  });
});

describe("paintPaperRock", () => {
  it("paints a flat plane in the middle of a sheet", () => {
    expect(paintPaperRock(INK, 10, 10, solid({ plane: 0, above: 0 }))).toBe(
      LIGHT,
    );
    expect(paintPaperRock(INK, 10, 10, solid({ plane: 1, above: 1 }))).toBe(MID);
    expect(paintPaperRock(INK, 10, 10, solid({ plane: 2, above: 2 }))).toBe(DARK);
  });

  it("lights the cut edge: the first row of rock against open air", () => {
    const openAbove = solid({ rockAt: (x, y) => y < 10 });
    const openLeft = solid({ rockAt: (x) => x >= 10 });
    // Light comes from the top-left, so an open row above or an open column
    // to the left exposes the paper core.
    expect(paintPaperRock(INK, 10, 10, openAbove)).toBe(INK.core);
    expect(paintPaperRock(INK, 10, 10, openLeft)).toBe(INK.core);
    // The other two sides are turned away from the light: no core there.
    expect(
      paintPaperRock(INK, 10, 10, solid({ rockAt: (x, y) => y <= 10 })),
    ).toBe(MID);
    expect(
      paintPaperRock(INK, 10, 10, solid({ rockAt: (x) => x <= 10 })),
    ).toBe(MID);
  });

  it("lights a sheet's lip, but not the underside of an overhang", () => {
    // A darker sheet tucked under a lighter one is exposed to the light:
    // that first row shows the core.
    expect(paintPaperRock(INK, 10, 10, solid({ plane: 2, above: 1 }))).toBe(
      INK.core,
    );
    expect(paintPaperRock(INK, 10, 10, solid({ plane: 1, above: 0 }))).toBe(
      INK.core,
    );
    // The reverse is the overhang's own underside — it stays in the plane's
    // value, which is what makes the stack read as a stack and not as lines.
    expect(paintPaperRock(INK, 10, 10, solid({ plane: 0, above: 1 }))).toBe(
      LIGHT,
    );
    expect(paintPaperRock(INK, 10, 10, solid({ plane: 1, above: 2 }))).toBe(MID);
  });

  it("casts the silhouette's shadow down-right, and nowhere else", () => {
    // A single rock pixel at (10, 10): the shadow is the two-pixel offset
    // copy of it, which is the only mark outside the rock.
    const rockAt = (x: number, y: number): boolean => x === 10 && y === 10;
    const shadows: string[] = [];
    for (let y = 6; y < 16; y++) {
      for (let x = 6; x < 16; x++) {
        const c = paintPaperRock(INK, x, y, solid({ rock: rockAt(x, y), rockAt }));
        if (c != null) shadows.push(`${x},${y}`);
      }
    }
    // The rock pixel itself, plus exactly the 2×2 block down-right of it.
    expect(shadows.sort()).toEqual(
      ["10,10", "11,11", "11,12", "12,11", "12,12"].sort(),
    );
    expect(
      paintPaperRock(INK, 11, 11, solid({ rock: false, rockAt })),
    ).toBe(INK.shadow);
    // Up-left of the silhouette there is nothing: the light is from there.
    expect(
      paintPaperRock(INK, 9, 9, solid({ rock: false, rockAt })),
    ).toBeNull();
    // And an empty cave casts nothing at all.
    expect(
      paintPaperRock(INK, 5, 5, solid({ rock: false, rockAt: () => false })),
    ).toBeNull();
    expect(PAPER_SHADOW_OFFSET).toBe(2);
  });

  it("never paints over a gap with a plane", () => {
    // A gap is either shadow or untouched — it is never rock colored, which
    // is what keeps the shaft and the openings open.
    const rockAt = (x: number, y: number): boolean => x === 10 && y === 10;
    for (let y = 6; y < 16; y++) {
      for (let x = 6; x < 16; x++) {
        if (rockAt(x, y)) continue;
        const c = paintPaperRock(INK, x, y, solid({ rock: false, rockAt }));
        expect(c == null || c === INK.shadow).toBe(true);
      }
    }
  });
});
