/**
 * The premium crew (legendary miners): the contracts that keep six named
 * characters from collapsing into "one body in six colors" — unique ids and
 * names, one aura/crown/mote each, a distinct silhouette per character, and
 * sprites that actually carry the aura (the accent lands on the crown and
 * the motes, and the rim light never paints over transparent pixels).
 */
import {
  AURA_IDS,
  PREMIUM_CHAR_GRID_SIZE,
  PREMIUM_CHAR_IDS,
  PREMIUM_CHARS,
  applyAura,
  buildPremiumCharGrid,
  premiumAccent,
  premiumAccentDark,
  premiumCharById,
  premiumCharForIndex,
} from "src/utils/graphics/premiumChars";
import {
  buildPalette,
  minerLabels,
  renderDirection,
} from "src/utils/graphics/characterArt";
import { hexToRgb } from "src/utils/graphics/pixelArt";
import type { PixelGrid } from "src/utils/graphics/pixelArt";

function filled(grid: PixelGrid): number {
  let n = 0;
  for (const row of grid) for (const c of row) if (c != null) n++;
  return n;
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

describe("the cast", () => {
  it("has a full line of uniquely named characters", () => {
    expect(PREMIUM_CHARS.length).toBeGreaterThanOrEqual(6);
    for (const key of ["id", "name", "blurb", "aura"] as const) {
      const seen = new Set<string>();
      for (const char of PREMIUM_CHARS) {
        expect(seen.has(char[key])).toBe(false);
        seen.add(char[key]);
      }
    }
    for (const id of PREMIUM_CHAR_IDS) expect(id).toMatch(/^[a-z]+$/);
  });

  it("covers every aura exactly once, and no two share one", () => {
    const auras = PREMIUM_CHARS.map((c) => c.aura);
    expect(new Set(auras).size).toBe(auras.length);
    expect(new Set(auras)).toEqual(new Set(AURA_IDS));
  });

  it("gives every character its own mark, aura colour and mote pattern", () => {
    // A shared mark or a shared mote pattern is what makes a "line" read as
    // one character recolored.
    for (const key of ["crown", "motes", "accent"] as const) {
      const seen = new Set(PREMIUM_CHARS.map((c) => c[key]));
      expect(seen.size).toBe(PREMIUM_CHARS.length);
    }
    // At least one non-crown mark (a crown on everyone would defeat it).
    expect(PREMIUM_CHARS.filter((c) => c.crown !== "crown").length).toBeGreaterThanOrEqual(2);
    for (const char of PREMIUM_CHARS) {
      expect(char.accent).toMatch(/^#[0-9a-f]{6}$/);
      for (const slot of [
       "skin",
       "shirt",
       "pants",
       "boots",
       "hat",
      ] as const) {
        expect(char.look[slot]).toMatch(/^#[0-9a-f]{6}$/);
      }
      // The crew draws its own pickaxe: no character may bake the tool in.
      expect(char.shape.tool).toBeUndefined();
    }
  });

  it("looks characters up by id and by hire order", () => {
    expect(premiumCharById(PREMIUM_CHAR_IDS[0])?.id).toBe(PREMIUM_CHAR_IDS[0]);
    expect(premiumCharById("nope")).toBeUndefined();
    for (let i = 0; i < PREMIUM_CHARS.length * 2; i++) {
      expect(premiumCharForIndex(i).id).toBe(
        PREMIUM_CHARS[i % PREMIUM_CHARS.length].id,
      );
    }
    // Wraps in both directions (a reset save restarts the line).
    expect(premiumCharForIndex(-1).id).toBe(
      PREMIUM_CHARS[PREMIUM_CHARS.length - 1].id,
    );
  });

  it("derives accent helpers from the character's own aura", () => {
    const ember = PREMIUM_CHARS[0];
    expect(premiumAccent(ember.id)).toBe(ember.accent);
    expect(premiumAccent("nope")).toBe("#ffffff");
    expect(luminance(premiumAccentDark(ember.id))).toBeLessThan(
      luminance(ember.accent),
    );
  });
});

describe("buildPremiumCharGrid", () => {
  it("renders every character at 32×32 with real content", () => {
    for (const char of PREMIUM_CHARS) {
      const g = buildPremiumCharGrid(char);
      expect(g).toHaveLength(PREMIUM_CHAR_GRID_SIZE);
      for (const row of g) {
        expect(row).toHaveLength(PREMIUM_CHAR_GRID_SIZE);
        for (const c of row) {
          expect(c === null || /^#[0-9a-f]{6}$/.test(c as string)).toBe(true);
        }
      }
      expect(filled(g)).toBeGreaterThan(200);
      expect(filled(g)).toBeLessThan(PREMIUM_CHAR_GRID_SIZE ** 2 - 40);
    }
  });

  it("is deterministic and does not mutate the character", () => {
    for (const char of PREMIUM_CHARS) {
      const before = JSON.stringify(char);
      const a = buildPremiumCharGrid(char);
      const b = buildPremiumCharGrid(char);
      expect(b).toEqual(a);
      expect(b).not.toBe(a);
      expect(JSON.stringify(char)).toBe(before);
    }
  });

  it("gives every character a different sprite and a different silhouette", () => {
    const grids = PREMIUM_CHARS.map((c) => buildPremiumCharGrid(c));
    for (let i = 0; i < grids.length; i++) {
      for (let j = i + 1; j < grids.length; j++) {
        let same = 0;
        for (let y = 0; y < PREMIUM_CHAR_GRID_SIZE; y++) {
          for (let x = 0; x < PREMIUM_CHAR_GRID_SIZE; x++) {
            if (grids[i][y][x] === grids[j][y][x]) same++;
          }
        }
        expect(same / PREMIUM_CHAR_GRID_SIZE ** 2).toBeLessThan(0.93);
        // …and the GEOMETRY differs too, not just the palette.
        const si = minerLabels({
          ...PREMIUM_CHARS[i].shape,
          crown: PREMIUM_CHARS[i].crown,
          motes: PREMIUM_CHARS[i].motes,
          tool: false,
        });
        const sj = minerLabels({
          ...PREMIUM_CHARS[j].shape,
          crown: PREMIUM_CHARS[j].crown,
          motes: PREMIUM_CHARS[j].motes,
          tool: false,
        });
        let sameLabels = 0;
        for (let y = 0; y < si.length; y++) {
          for (let x = 0; x < si[y].length; x++) {
            if (si[y][x] === sj[y][x]) sameLabels++;
          }
        }
        // 1.0 would mean "the same body in a different palette" — the
        // exact thing this line exists to stop.
        expect(sameLabels / si.length / si[0].length).toBeLessThan(0.97);
      }
    }
  });

  it("stamps the crown and motes in the character's exact accent", () => {
    for (const char of PREMIUM_CHARS) {
      const labels = minerLabels({
        ...char.shape,
        crown: char.crown,
        motes: char.motes,
        tool: false,
      });
      const g = buildPremiumCharGrid(char);
      let auraPixels = 0;
      for (let y = 0; y < labels.length; y++) {
        for (let x = 0; x < labels[y].length; x++) {
          if (labels[y][x] !== "aura") continue;
          expect(g[y][x]).toBe(char.accent);
          auraPixels++;
        }
      }
      // The motes are always stamped; a mark over the head adds more. The
      // mark itself is the thing that identifies them at crew size, so it is
      // pinned separately in the geometry test below.
      expect(auraPixels).toBeGreaterThanOrEqual(4);
    }
  });

  it("no character carries their tool (the crew draws the swinging pickaxe)", () => {
    // Checked on the GEOMETRY, not the pixels: the tool would be blade +
    // handle + shine materials, and the aura motes legitimately float in
    // the space where the blade used to be.
    for (const char of PREMIUM_CHARS) {
      const labels = minerLabels({
        ...char.shape,
        crown: char.crown,
        motes: char.motes,
        tool: false,
      });
      const used = new Set(
        labels.flat().filter((m): m is NonNullable<typeof m> => m != null),
      );
      expect(used.has("blade")).toBe(false);
      expect(used.has("handle")).toBe(false);
      expect(used.has("bladeShine")).toBe(false);
    }
  });

  it("every character's head mark changes the sprite", () => {
    // The mark is what identifies a character in a 24px crew row, so it has
    // to be VISIBLE, not just present in the data: rendering the same
    // character with and without their mark must move real pixels. (A hood
    // is the interesting case — it is drawn in the same material as the
    // headgear it covers, so only the rendered sprite proves it landed.)
    for (const char of PREMIUM_CHARS) {
      const shape = { ...char.shape, tool: false };
      const marked = renderDirection(
        "papercut",
        minerLabels({ ...shape, crown: char.crown, motes: char.motes }),
        buildPalette("papercut", "miner", { miner: char.look }),
      );
      const bare = renderDirection(
        "papercut",
        minerLabels({ ...shape, crown: "none" }),
        buildPalette("papercut", "miner", { miner: char.look }),
      );
      let diff = 0;
      for (let y = 0; y < marked.length; y++) {
        for (let x = 0; x < marked[y].length; x++) {
          if (marked[y][x] !== bare[y][x]) diff++;
        }
      }
      expect(diff).toBeGreaterThan(15);
    }
  });

  it("every character ends up with a lit top edge (the premium read)", () => {
    for (const char of PREMIUM_CHARS) {
      const g = buildPremiumCharGrid(char);
      // At least one silhouette pixel is lit from above — i.e. its row above
      // is empty — and lit pixels are measurably brighter than the darkest
      // interior pixel. Weak per-pixel, strong in aggregate: this is what
      // makes a 24px crew row read as special rather than as a recolor.
      let lit = 0;
      let brightest = 0;
      let darkest = 1;
      for (let y = 1; y < g.length; y++) {
        for (let x = 0; x < g[y].length; x++) {
          const c = g[y][x];
          if (c == null) continue;
          const l = luminance(c);
          brightest = Math.max(brightest, l);
          darkest = Math.min(darkest, l);
          if (g[y - 1][x] == null) lit++;
        }
      }
      expect(lit).toBeGreaterThan(15);
      expect(brightest - darkest).toBeGreaterThan(0.3);
    }
  });
});

describe("applyAura", () => {
  it("rimes the top edge, glows the bottom, and leaves the middle alone", () => {
    // A synthetic slab: only the first and last rows may change.
    const base = "#4a4a55";
    const grid: PixelGrid = [
      [null, null, null],
      [base, base, base],
      [base, base, base],
      [base, base, base],
      [base, base, base],
      [null, null, null],
    ];
    const out = applyAura(grid, "#ffffff");
    const l = (c: string | null): number => (c == null ? -1 : luminance(c));
    // Top row is lit, bottom row glows, the middle is untouched.
    expect(l(out[1][0])).toBeGreaterThan(l(out[2][0]));
    expect(l(out[4][0])).toBeGreaterThan(l(out[2][0]));
    expect(out[2][0]).toBe(base);
    expect(out[3][0]).toBe(base);
    // Light falls from above: the rim moves further toward the accent than
    // the ground glow does.
    expect(l(out[1][0]) - l(out[2][0])).toBeGreaterThan(
      l(out[4][0]) - l(out[2][0]),
    );
  });

  it("never paints a transparent pixel and is a pure transform", () => {
    const char = PREMIUM_CHARS[0];
    const g = buildPremiumCharGrid(char);
    const before = g.map((r) => [...r]);
    const out = applyAura(g, char.accent);
    expect(out).not.toBe(g);
    for (let y = 0; y < g.length; y++) {
      for (let x = 0; x < g[y].length; x++) {
        if (before[y][x] == null) expect(out[y][x]).toBeNull();
      }
    }
    expect(g).toEqual(before); // input untouched
  });
});
