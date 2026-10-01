/**
 * The crew cast (all three purchasable miner lines): the contracts that keep
 * fourteen named characters from collapsing into "one body in fourteen
 * colors" — unique ids and names, one aura/mark/mote each WITHIN a line, a
 * distinct silhouette per character, the wardrobe rule for the ordinary
 * line, and sprites that actually carry the aura (the accent lands on the
 * mark and the motes, and the light effects never paint over transparent
 * pixels).
 */
import {
  ALL_CREW_CHARS,
  AURA_IDS,
  CREW_CHAR_GRID_SIZE,
  CREW_CHAR_IDS,
  CREW_CASTS,
  FAST_CHARS,
  LEGENDARY_CHARS,
  NORMAL_CHARS,
  applyAura,
  buildCrewCharGrid,
  crewAccent,
  crewAccentDark,
  crewCharById,
  crewCharForIndex,
  crewLookFor,
} from "src/utils/graphics/crewChars";
import {
  buildPalette,
  minerLabels,
  renderDirection,
} from "src/utils/graphics/characterArt";
import { hexToRgb } from "src/utils/graphics/pixelArt";
import type { CrewLine } from "src/utils/graphics/crewChars";
import type { PixelGrid } from "src/utils/graphics/pixelArt";

/** Every cast, as pairs — the per-line contracts below iterate this. */
const LINES: readonly [CrewLine, typeof NORMAL_CHARS][] = [
 ["normal", NORMAL_CHARS],
 ["fast", FAST_CHARS],
 ["legendary", LEGENDARY_CHARS],
];

/** The lines whose characters wear a mark (the ordinary crew do not). */
const MARKED_LINES = LINES.filter(([, cast]) =>
 cast.some((c) => c.crown !== "none"),
);

function filled(grid: PixelGrid): number {
  let n = 0;
  for (const row of grid) for (const c of row) if (c != null) n++;
  return n;
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** Labels for a character, the way the builder draws them. */
function labelsOf(char: (typeof ALL_CREW_CHARS)[number]) {
  return minerLabels({
    ...char.shape,
    crown: char.crown,
    motes: char.motes,
    // The crew draws its own pickaxe as a rotating sprite.
    tool: false,
  });
}

describe("the cast", () => {
  it("has a full line of uniquely named characters in each of the three", () => {
    for (const [line, cast] of LINES) {
      expect(cast.length).toBeGreaterThanOrEqual(4);
      for (const key of ["id", "name", "blurb", "aura"] as const) {
        const seen = new Set(cast.map((c) => c[key]));
        expect(`${line}/${key} distinct: ${seen.size}`).toBe(
          `${line}/${key} distinct: ${cast.length}`,
        );
      }
      for (const id of cast.map((c) => c.id)) expect(id).toMatch(/^[a-z]+$/);
    }
  });

  it("covers every aura exactly once, across the whole cast", () => {
    const auras = ALL_CREW_CHARS.map((c) => c.aura);
    expect(new Set(auras).size).toBe(auras.length);
    expect(new Set(auras)).toEqual(new Set(AURA_IDS));
  });

  it("gives every marked character its own mark, aura colour and motes", () => {
    // A shared mark or a shared mote pattern is what makes a "line" read as
    // one character recolored.
    for (const [line, cast] of MARKED_LINES) {
      for (const key of ["crown", "motes", "accent"] as const) {
        const seen = new Set(cast.map((c) => c[key]));
        expect(`${line}/${key}:${seen.size}`).toBe(
          `${line}/${key}:${cast.length}`,
        );
      }
    }
    // At least one non-crown mark (a crown on everyone would defeat it).
    expect(
      LEGENDARY_CHARS.filter((c) => c.crown !== "crown").length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("keeps the two gem lines from sharing a silhouette or a mote style", () => {
    // The fast crew's whole identity is "a working mark plus motion motes",
    // so the legendary marks and mote patterns must not reappear there.
    const fastMarks = new Set(FAST_CHARS.map((c) => c.crown));
    const fastMotes = new Set(FAST_CHARS.map((c) => c.motes));
    for (const char of LEGENDARY_CHARS) {
      expect(fastMarks.has(char.crown)).toBe(false);
      expect(fastMotes.has(char.motes)).toBe(false);
    }
  });

  it("holds the purchase ladder: ordinary = no mark, no light effects", () => {
    for (const char of NORMAL_CHARS) {
      expect(char.crown).toBe("none");
      expect(char.motes).toBe("none");
      expect(char.fx).toEqual({ rim: 0, glow: 0 });
    }
    // The fast crew get a rim but never a ground pool; the legendary line
    // gets both.
    for (const char of FAST_CHARS) {
      expect(char.fx.rim).toBeGreaterThan(0);
      expect(char.fx.glow).toBe(0);
    }
    for (const char of LEGENDARY_CHARS) {
      expect(char.fx.rim).toBeGreaterThan(0);
      expect(char.fx.glow).toBeGreaterThan(0);
    }
  });

  it("has valid palettes and never bakes the pickaxe into a body", () => {
    for (const char of ALL_CREW_CHARS) {
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
      expect(char.shape.tool).toBeUndefined();
      // The look and the shape must agree on the headwear, or the sprite
      // would draw a hat the palette never colored.
      expect(char.shape.hatStyle).toBe(char.look.hatStyle);
    }
  });

  it("looks characters up by id and by hire order, per line", () => {
    for (const [line, cast] of LINES) {
      expect(crewCharById(cast[0].id)?.id).toBe(cast[0].id);
      for (let i = 0; i < cast.length * 2; i++) {
        expect(crewCharForIndex(line, i).id).toBe(
          cast[i % cast.length].id,
        );
      }
      // Wraps in both directions (a reset save restarts the line).
      expect(crewCharForIndex(line, -1).id).toBe(
        cast[cast.length - 1].id,
      );
      // A character id never leaks across lines.
      for (const char of cast) {
        expect(crewCharById(char.id)?.line).toBe(line);
      }
    }
    expect(crewCharById("nope")).toBeUndefined();
    expect(CREW_CHAR_IDS.length).toBe(ALL_CREW_CHARS.length);
    expect(Object.keys(CREW_CASTS).sort()).toEqual([
      "fast",
      "legendary",
      "normal",
    ]);
  });

  it("derives accent helpers from the character's own aura", () => {
    for (const char of ALL_CREW_CHARS) {
      expect(crewAccent(char.id)).toBe(char.accent);
      expect(luminance(crewAccentDark(char.id))).toBeLessThan(
        luminance(char.accent),
      );
    }
    expect(crewAccent("nope")).toBe("#ffffff");
  });
});

describe("crewLookFor (the wardrobe rule)", () => {
  const cog = NORMAL_CHARS[0];

  it("keeps the character's face when an outfit is assigned", () => {
    const assigned = {
      skin: "#8a5a3a",
      shirt: "#00ff00",
      pants: "#0000ff",
      boots: "#111111",
      hat: "#ff00ff",
      hatStyle: "helmet" as const,
      beard: false,
      cute: false,
      outfit: "trousers" as const,
    };
    const out = crewLookFor(cog, assigned, false);
    // The outfit owns the clothes and the headwear…
    expect(out.shirt).toBe("#00ff00");
    expect(out.hat).toBe("#ff00ff");
    expect(out.hatStyle).toBe("helmet");
    // …the character keeps their own face.
    expect(out.beard).toBe(cog.shape.beard);
    expect(out.outfit).toBe(cog.shape.outfit);
    expect(out.cute).toBe(cog.shape.cute ?? false);
    expect(out.hair).toBe(cog.shape.hair);
  });

  it("falls back to the character's own palette when nothing is assigned", () => {
    const out = crewLookFor(
      cog,
      { ...cog.look, shirt: "#00ff00" },
      true,
    );
    expect(out.shirt).toBe(cog.look.shirt);
    expect(out.hatStyle).toBe(cog.look.hatStyle);
  });

  it("changes the sprite when an outfit is worn, and only then", () => {
    const bare = buildCrewCharGrid(cog);
    const dressed = buildCrewCharGrid(
      cog,
      crewLookFor(
        cog,
        { ...cog.look, shirt: "#00ff00", pants: "#0000ff" },
        false,
      ),
    );
    let diff = 0;
    for (let y = 0; y < bare.length; y++) {
      for (let x = 0; x < bare[y].length; x++) {
        if (bare[y][x] !== dressed[y][x]) diff++;
      }
    }
    expect(diff).toBeGreaterThan(20);
    expect(buildCrewCharGrid(cog, crewLookFor(cog, cog.look, true))).toEqual(
      bare,
    );
  });
});

describe("buildCrewCharGrid", () => {
  it("renders every character at 32×32 with real content", () => {
    for (const char of ALL_CREW_CHARS) {
      const g = buildCrewCharGrid(char);
      expect(g).toHaveLength(CREW_CHAR_GRID_SIZE);
      for (const row of g) {
        expect(row).toHaveLength(CREW_CHAR_GRID_SIZE);
        for (const c of row) {
          expect(c === null || /^#[0-9a-f]{6}$/.test(c as string)).toBe(true);
        }
      }
      expect(filled(g)).toBeGreaterThan(200);
      expect(filled(g)).toBeLessThan(CREW_CHAR_GRID_SIZE ** 2 - 40);
    }
  });

  it("is deterministic and does not mutate the character", () => {
    for (const char of ALL_CREW_CHARS) {
      const before = JSON.stringify(char);
      const a = buildCrewCharGrid(char);
      const b = buildCrewCharGrid(char);
      expect(b).toEqual(a);
      expect(b).not.toBe(a);
      expect(JSON.stringify(char)).toBe(before);
    }
  });

  it("gives every character a different sprite and a different face", () => {
    // Within a line the faces must differ; across lines a shared face is
    // only allowed if the sprite still reads differently (the gem lines get
    // marks and light on top).
    for (const [, cast] of LINES) {
      const grids = cast.map((c) => buildCrewCharGrid(c));
      for (let i = 0; i < grids.length; i++) {
        for (let j = i + 1; j < grids.length; j++) {
          let same = 0;
          for (let y = 0; y < CREW_CHAR_GRID_SIZE; y++) {
            for (let x = 0; x < CREW_CHAR_GRID_SIZE; x++) {
              if (grids[i][y][x] === grids[j][y][x]) same++;
            }
          }
          expect(same / CREW_CHAR_GRID_SIZE ** 2).toBeLessThan(0.93);
          // …and the GEOMETRY differs too, not just the palette.
          const si = labelsOf(cast[i]);
          const sj = labelsOf(cast[j]);
          let sameLabels = 0;
          for (let y = 0; y < si.length; y++) {
            for (let x = 0; x < si[y].length; x++) {
              if (si[y][x] === sj[y][x]) sameLabels++;
            }
          }
          // 1.0 would mean "the same body in a different palette" — the
          // exact thing this cast exists to stop.
          expect(sameLabels / si.length / si[0].length).toBeLessThan(0.97);
        }
      }
    }
  });

  it("stamps the mark and motes in the character's exact accent", () => {
    for (const char of MARKED_LINES.flatMap(([, cast]) => cast)) {
      const labels = labelsOf(char);
      const g = buildCrewCharGrid(char);
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

  it("stamps no aura at all for the ordinary line", () => {
    // They have no mark and no motes, so no pixel may land in the accent —
    // that is what keeps the aura language reserved for the gem tiers.
    for (const char of NORMAL_CHARS) {
      const g = buildCrewCharGrid(char);
      for (let y = 0; y < g.length; y++) {
        for (let x = 0; x < g[y].length; x++) {
          expect(g[y][x]).not.toBe(char.accent);
        }
      }
    }
  });

  it("no character carries their tool (the crew draws the swinging pickaxe)", () => {
    // Checked on the GEOMETRY, not the pixels: the tool would be blade +
    // handle + shine materials, and the aura motes legitimately float in
    // the space where the blade used to be.
    for (const char of ALL_CREW_CHARS) {
      const labels = labelsOf(char);
      const used = new Set(
        labels.flat().filter((m): m is NonNullable<typeof m> => m != null),
      );
      expect(used.has("blade")).toBe(false);
      expect(used.has("handle")).toBe(false);
      expect(used.has("bladeShine")).toBe(false);
    }
  });

  it("every marked character's head mark changes the sprite", () => {
    // The mark is what identifies a character in a 24px crew row, so it has
    // to be VISIBLE, not just present in the data: rendering the same
    // character with and without their mark must move real pixels. (A hood
    // is the interesting case — it is drawn in the same material as the
    // headgear it covers, so only the rendered sprite proves it landed.)
    for (const char of MARKED_LINES.flatMap(([, cast]) => cast)) {
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

  it("every mote pattern floats clear of the body", () => {
    // A mote ON the character is just a misplaced pixel. The body never
    // reaches the outermost columns, so every character's mote pattern has
    // to put several marks out there — that is what makes the aura read as
    // "around them" rather than "on them".
    for (const char of MARKED_LINES.flatMap(([, cast]) => cast)) {
      const labels = labelsOf(char);
      let clear = 0;
      for (let y = 0; y < labels.length; y++) {
        for (let x = 0; x < labels[y].length; x++) {
          if (labels[y][x] === "aura" && (x < 4 || x > 23)) clear++;
        }
      }
      expect(`${char.id} clear motes: ${clear}`).not.toBe(
        `${char.id} clear motes: 0`,
      );
      expect(clear).toBeGreaterThanOrEqual(4);
    }
  });

  it("every marked character ends up with a lit top edge", () => {
    // The gem lines' read: at least one silhouette pixel is lit from above
    // (its row above is empty) and the lit pixels are measurably brighter
    // than the darkest interior pixel. Weak per-pixel, strong in aggregate.
    for (const char of MARKED_LINES.flatMap(([, cast]) => cast)) {
      const g = buildCrewCharGrid(char);
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

  it("leaves the ordinary line unlit", () => {
    // The mirror of the premium read: with fx at zero the sprite must be
    // exactly the plain direction render, or the ladder has blurred.
    for (const char of NORMAL_CHARS) {
      const plain = renderDirection(
        "papercut",
        minerLabels({ ...char.shape, tool: false }),
        buildPalette("papercut", "miner", { miner: char.look }),
      );
      expect(buildCrewCharGrid(char)).toEqual(plain);
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

  it("is a no-op for a character with no effects", () => {
    // The ordinary line's contract: no rim, no glow, not one pixel moved.
    const out = applyAura(
      [
        [null, null],
        ["#4a4a55", "#4a4a55"],
        ["#4a4a55", "#4a4a55"],
      ],
      "#ffffff",
      { rim: 0, glow: 0 },
    );
    expect(out[1][0]).toBe("#4a4a55");
    expect(out[2][1]).toBe("#4a4a55");
  });

  it("glowing alone (the fast crew's rim without a pool)", () => {
    const base = "#4a4a55";
    const grid: PixelGrid = [
      [base, base],
      [base, base],
      [base, base],
    ];
    const out = applyAura(grid, "#ffffff", { rim: 0.4, glow: 0 });
    expect(out[0][0]).not.toBe(base);
    expect(out[2][0]).toBe(base); // no ground glow
  });

  it("never paints a transparent pixel and is a pure transform", () => {
    const char = LEGENDARY_CHARS[0];
    const g = buildCrewCharGrid(char);
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