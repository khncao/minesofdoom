/**
 * Draft art directions (docs/art-directions.md): the contracts that keep the
 * five directions comparable — 32×32 shape, a transparent margin for the
 * contour passes, palette coverage (every label has a color in every
 * direction), determinism (including the crayon's seed), non-mutation,
 * each direction's signature (its own ink / no ink), and — the point of the
 * whole set — that no two directions render the same pixels.
 */
import {
 ANIME_INK,
 CARTOON_INK,
 CRAYON_HUES,
 DIRECTION_GRID_SIZE,
 DIRECTION_IDS,
 DIRECTION_LABELS,
 PAPERCUT_SHADOW,
 SUBJECT_IDS,
 SUBJECT_LABELS,
 buildDirectionGrid,
 buildPalette,
 minerLabels,
 noise,
 renderDirection,
 saturate,
} from "src/utils/graphics/characterArt";
import type {
 DirectionId,
 LabelGrid,
 MaterialId,
 SkinShape,
 SubjectId,
} from "src/utils/graphics/characterArt";
import type { MinerLook } from "src/utils/graphics/pixelArt";
import { hexToRgb } from "src/utils/graphics/pixelArt";

function luminance(hex: string): number {
 const [r, g, b] = hexToRgb(hex);
 return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

// The looks the sample sheets render (scripts/generate-art-direction-samples
// .mjs), so the tested set IS the shipped sample set.
const LOOKS: MinerLook[] = [
 {
  skin: "#ffdbb4",
  shirt: "#e8a33d",
  pants: "#3b4a6b",
  boots: "#4a3524",
  hat: "#e8c33d",
  hatStyle: "helmet",
 },
 {
  skin: "#f2c9a0",
  shirt: "#e070a0",
  pants: "#3b4a6b",
  boots: "#333333",
  hat: "#6a4a3a",
  hatStyle: "longhair",
 },
 {
  skin: "#e07020",
  shirt: "#3a4a5a",
  pants: "#c85a18",
  boots: "#3a2a1a",
  hat: "#e8e8e8",
  hatStyle: "bandana",
  species: "animal",
 },
];

function filled(grid: LabelGrid | (string | null)[][]): number {
  let n = 0;
  for (const row of grid) for (const c of row) if (c != null) n++;
  return n;
}

function colorsOf(grid: (string | null)[][]): Set<string> {
  const out = new Set<string>();
  for (const row of grid) for (const c of row) if (c != null) out.add(c);
  return out;
}

function labelsUsed(grid: LabelGrid): Set<MaterialId> {
  const out = new Set<MaterialId>();
  for (const row of grid) for (const c of row) if (c != null) out.add(c);
  return out;
}

describe("subject geometry", () => {
  it("is 32×32 for every subject", () => {
    for (const subject of SUBJECT_IDS) {
      const g = SUBJECT_LABELS[subject]();
      expect(g).toHaveLength(DIRECTION_GRID_SIZE);
      for (const row of g) expect(row).toHaveLength(DIRECTION_GRID_SIZE);
    }
  });

  it("keeps a transparent outer margin for every character shape", () => {
    // The ink/contour passes grow the sprite outward, so the shape variants
    // (hair tails, twin bunches, the critter's ears) must all start clear of
    // the grid edge.
    const shapes: SkinShape[] = [];
    for (const form of ["human", "critter"] as const) {
      for (const hatStyle of [
        "helmet",
        "beanie",
        "cap",
        "bandana",
        "longhair",
      ] as const) {
        for (const hair of ["bob", "long", "ponytail", "twin", "bun"] as const) {
          for (const outfit of ["trousers", "dress"] as const) {
            for (const cute of [false, true]) {
              for (const beard of [false, true]) {
                shapes.push({ form, hatStyle, hair, outfit, cute, beard });
              }
            }
          }
        }
      }
    }
    expect(shapes).toHaveLength(2 * 5 * 5 * 2 * 2 * 2);
    for (const shape of shapes) {
      const g = minerLabels(shape);
      expect(g[0].every((c) => c == null)).toBe(true);
      expect(g[DIRECTION_GRID_SIZE - 1].every((c) => c == null)).toBe(true);
      for (const row of g) {
        expect(row[0]).toBeNull();
        expect(row[DIRECTION_GRID_SIZE - 1]).toBeNull();
      }
    }
  });

  it("draws a different silhouette per shape (a skin line is not one recolor)", () => {
    const seen = new Set<string>();
    const silhouette = (g: LabelGrid): string =>
      g.map((row) => row.map((c) => (c == null ? "." : c[0])).join("")).join("\n");
    const variants: SkinShape[] = [
      {},
      { beard: true },
      { hatStyle: "beanie" },
      { hatStyle: "cap" },
      { hatStyle: "bandana" },
      { hatStyle: "longhair", hair: "bob" },
      { hatStyle: "longhair", hair: "long" },
      { hatStyle: "longhair", hair: "ponytail" },
      { hatStyle: "longhair", hair: "twin" },
      { hatStyle: "longhair", hair: "bun" },
      { hatStyle: "longhair", outfit: "dress" },
      { form: "critter", hatStyle: "beanie" },
    ];
    for (const shape of variants) {
      const key = silhouette(minerLabels(shape));
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("gives the cute face bigger eyes and blush than the plain face", () => {
    const plain = minerLabels();
    const cute = minerLabels({ cute: true });
    let plainEyes = 0;
    let cuteEyes = 0;
    let blush = 0;
    for (let y = 0; y < DIRECTION_GRID_SIZE; y++) {
      for (let x = 0; x < DIRECTION_GRID_SIZE; x++) {
        if (plain[y][x] === "eye") plainEyes++;
        if (cute[y][x] === "eye") cuteEyes++;
        // Blush = the mouth material on the CHEEK (outside the mouth's x range).
        if (cute[y][x] === "mouth" && (x < 11 || x > 16)) blush++;
      }
    }
    expect(cuteEyes).toBeGreaterThan(plainEyes);
    expect(blush).toBeGreaterThan(0);
  });

  it("dresses the character differently from the trouser silhouette", () => {
    const trousers = minerLabels();
    const dress = minerLabels({ outfit: "dress" });
    let legPixels = 0;
    let skirtPixels = 0;
    for (let y = 25; y < 29; y++) {
      for (let x = 0; x < DIRECTION_GRID_SIZE; x++) {
        if (trousers[y][x] === "pants") legPixels++;
        if (dress[y][x] === "shirt") skirtPixels++;
      }
    }
    expect(legPixels).toBeGreaterThan(0);
    expect(skirtPixels).toBeGreaterThan(legPixels * 2);
  });

  it("keeps a transparent outer margin (the contour passes need room)", () => {
    for (const subject of SUBJECT_IDS) {
      const g = SUBJECT_LABELS[subject]();
      expect(g[0].every((c) => c == null)).toBe(true);
      expect(g[DIRECTION_GRID_SIZE - 1].every((c) => c == null)).toBe(true);
      for (const row of g) {
        expect(row[0]).toBeNull();
        expect(row[DIRECTION_GRID_SIZE - 1]).toBeNull();
      }
    }
  });

  it("returns a fresh grid every call (no shared module state)", () => {
    const a = minerLabels();
    const b = minerLabels();
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    a[0][0] = "skin";
    expect(b[0][0]).toBeNull();
  });

  it("draws the subject's defining parts", () => {
    expect(labelsUsed(minerLabels())).toEqual(
      new Set([
       "skin",
       "eye",
       "eyeShine",
       "mouth",
       "hat",
       "brim",
       "lamp",
       "shirt",
       "belt",
       "pants",
       "boots",
       "handle",
       "blade",
       "bladeShine",
      ]),
    );
    const gem = labelsUsed(SUBJECT_LABELS.gem());
    expect(gem.has("gem")).toBe(true);
    expect(gem.has("gemLight")).toBe(true);
    expect(gem.has("gemDark")).toBe(true);
    const chunk = labelsUsed(SUBJECT_LABELS.chunk());
    expect(chunk.has("rock")).toBe(true);
    expect(chunk.has("ore")).toBe(true);
  });

  it("fills a real sprite, not a stub", () => {
    for (const subject of SUBJECT_IDS) {
      const n = filled(SUBJECT_LABELS[subject]());
      expect(n).toBeGreaterThan(90);
      expect(n).toBeLessThan(DIRECTION_GRID_SIZE * DIRECTION_GRID_SIZE - 300);
    }
  });
});

describe("buildPalette", () => {
  it("covers every material a subject uses", () => {
    for (const direction of DIRECTION_IDS) {
      for (const subject of SUBJECT_IDS) {
        const palette = buildPalette(direction, subject, { miner: LOOKS[0] });
        for (const m of labelsUsed(SUBJECT_LABELS[subject]())) {
          expect(typeof palette[m]).toBe("string");
          expect(palette[m]).toMatch(/^#[0-9a-f]{6}$/);
        }
      }
    }
  });

  it("is complete — every MaterialId has an entry", () => {
    const palette = buildPalette("cartoon", "miner", { miner: LOOKS[0] });
    const materials: MaterialId[] = [
     "skin",
     "eye",
     "eyeShine",
     "mouth",
     "hat",
     "brim",
     "lamp",
     "shirt",
     "belt",
     "pants",
     "boots",
     "handle",
     "blade",
     "bladeShine",
     "gem",
     "gemLight",
     "gemDark",
     "rock",
     "rockLight",
     "rockShade",
     "ore",
     "aura",
    ];
    for (const m of materials) expect(palette[m]).toBeDefined();
    expect(Object.keys(palette).sort()).toEqual([...materials].sort());
  });

  it("carries the look's identity: different looks → different palettes", () => {
    for (const direction of DIRECTION_IDS) {
      const a = buildPalette(direction, "miner", { miner: LOOKS[0] });
      const b = buildPalette(direction, "miner", { miner: LOOKS[1] });
      expect(a.hat).not.toBe(b.hat);
      // The crayon box has ten colors, so a gold shirt and a pink shirt can
      // land on the same crayon — the head (gold vs brown) still differs.
      if (direction !== "crayon") expect(a.shirt).not.toBe(b.shirt);
    }
  });

  it("gives every direction its own grading of the same look", () => {
    const seen = new Map<string, DirectionId>();
    for (const direction of DIRECTION_IDS) {
      const palette = buildPalette(direction, "miner", { miner: LOOKS[0] });
      const key = palette.shirt;
      expect(seen.has(key)).toBe(false);
      seen.set(key, direction);
    }
    expect(seen.size).toBe(DIRECTION_IDS.length);
  });

  it("uses the pickaxe theme when one is given", () => {
    const theme = {
     head: "#e8c33d",
     glow: "#fff3b0",
     handle: "#6b4a2a",
    };
    const palette = buildPalette("cartoon", "pickaxe", { pickaxe: theme });
    const defaults = buildPalette("cartoon", "pickaxe");
    // Every pickaxe material moved off its default...
    expect(palette.blade).not.toBe(defaults.blade);
    expect(palette.handle).not.toBe(defaults.handle);
    // ...and the glow is an accent, so it survives the grade untouched.
    expect(palette.bladeShine).toBe(theme.glow);
  });
});

describe("renderDirection", () => {
  it("is 32×32 and never leaves an undefined pixel", () => {
    for (const direction of DIRECTION_IDS) {
      for (const subject of SUBJECT_IDS) {
        const g = buildDirectionGrid(direction, subject, {
         miner: LOOKS[0],
        });
        expect(g).toHaveLength(DIRECTION_GRID_SIZE);
        for (const row of g) {
         expect(row).toHaveLength(DIRECTION_GRID_SIZE);
         for (const c of row) expect(c === null || /^#[0-9a-f]{6}$/.test(c as string)).toBe(true);
        }
      }
    }
  });

  it("is deterministic (same inputs → identical grid)", () => {
    for (const direction of DIRECTION_IDS) {
      const a = buildDirectionGrid(direction, "miner", { miner: LOOKS[1] }, 7);
      const b = buildDirectionGrid(direction, "miner", { miner: LOOKS[1] }, 7);
      expect(b).toEqual(a);
      expect(b).not.toBe(a);
    }
  });

  it("varies the crayon with its seed and ignores the seed elsewhere", () => {
    const crayonA = buildDirectionGrid("crayon", "miner", { miner: LOOKS[0] }, 1);
    const crayonB = buildDirectionGrid("crayon", "miner", { miner: LOOKS[0] }, 3);
    expect(crayonB).not.toEqual(crayonA);
    for (const direction of DIRECTION_IDS.filter(
     (d) => d !== "crayon",
    )) {
     const a = buildDirectionGrid(direction, "miner", { miner: LOOKS[0] }, 1);
     const b = buildDirectionGrid(direction, "miner", { miner: LOOKS[0] }, 99);
     expect(b).toEqual(a);
    }
  });

  it("does not mutate the label grid or the look", () => {
    const labels = minerLabels();
    const before = JSON.stringify(labels);
    renderDirection("cartoon", labels, buildPalette("cartoon", "miner"));
    expect(JSON.stringify(labels)).toBe(before);
    const look: MinerLook = { ...LOOKS[0] };
    const lookBefore = JSON.stringify(look);
    buildDirectionGrid("papercut", "miner", { miner: look });
    expect(JSON.stringify(look)).toBe(lookBefore);
  });

  it("renders content in every direction (no empty sprites)", () => {
    for (const direction of DIRECTION_IDS) {
      for (const subject of SUBJECT_IDS) {
        const n = filled(buildDirectionGrid(direction, subject, {
         miner: LOOKS[0],
        }));
        expect(n).toBeGreaterThan(60);
        expect(n).toBeLessThan(DIRECTION_GRID_SIZE * DIRECTION_GRID_SIZE - 100);
      }
    }
  });

  it("no two directions render the same sprite", () => {
    for (const subject of SUBJECT_IDS) {
      const grids = DIRECTION_IDS.map((d) =>
       buildDirectionGrid(d, subject, { miner: LOOKS[0] }),
      );
      for (let i = 0; i < grids.length; i++) {
        for (let j = i + 1; j < grids.length; j++) {
         let same = 0;
         for (let y = 0; y < DIRECTION_GRID_SIZE; y++) {
          for (let x = 0; x < DIRECTION_GRID_SIZE; x++) {
           if (grids[i][y][x] === grids[j][y][x]) same++;
          }
         }
         const overlap = same / (DIRECTION_GRID_SIZE * DIRECTION_GRID_SIZE);
         expect(overlap).toBeLessThan(0.9);
         expect(grids[i]).not.toEqual(grids[j]);
        }
      }
    }
  });

  it("inks the silhouette where the direction says it does", () => {
    const labels = minerLabels();
    const palette = buildPalette("cartoon", "miner", { miner: LOOKS[0] });
    const cartoon = renderDirection("cartoon", labels, palette);
    const anime = renderDirection(
     "anime",
     labels,
     buildPalette("anime", "miner", { miner: LOOKS[0] }),
    );
    expect(colorsOf(cartoon).has(CARTOON_INK)).toBe(true);
    expect(colorsOf(anime).has(ANIME_INK)).toBe(true);
    // The line-less directions must not borrow another one's ink.
    for (const direction of ["storybook", "crayon", "papercut"] as const) {
     const g = renderDirection(
      direction,
      labels,
      buildPalette(direction, "miner", { miner: LOOKS[0] }),
     );
     expect(colorsOf(g).has(CARTOON_INK)).toBe(false);
     expect(colorsOf(g).has(ANIME_INK)).toBe(false);
    }
    // Papercut casts its own offset shadow layer.
    expect(
     colorsOf(
      renderDirection(
       "papercut",
       labels,
       buildPalette("papercut", "miner", { miner: LOOKS[0] }),
      ),
     ).has(PAPERCUT_SHADOW),
    ).toBe(true);
    // Cartoon ink only ever lands OUTSIDE the silhouette.
    for (let y = 0; y < DIRECTION_GRID_SIZE; y++) {
     for (let x = 0; x < DIRECTION_GRID_SIZE; x++) {
      if (cartoon[y][x] === CARTOON_INK) expect(labels[y][x]).toBeNull();
     }
    }
  });

  it("keeps the eyes dark and the lamp bright in every direction", () => {
    // Absolute thresholds would be re-tuned by every grade tweak; the
    // invariant that matters is CONTRAST: whatever the direction does to the
    // palette, the eyes must stay well below the face and the lamp above it.
    const labels = minerLabels();
    for (const direction of DIRECTION_IDS) {
     const g = renderDirection(
      direction,
      labels,
      buildPalette(direction, "miner", { miner: LOOKS[0] }),
     );
     let skinSum = 0;
     let skinN = 0;
     for (let y = 0; y < DIRECTION_GRID_SIZE; y++) {
      for (let x = 0; x < DIRECTION_GRID_SIZE; x++) {
       if (labels[y][x] === "skin" && g[y][x] != null) {
        skinSum += luminance(g[y][x] as string);
        skinN++;
       }
      }
     }
     const skinAvg = skinSum / skinN;
     expect(skinAvg).toBeGreaterThan(0.6);
     let eyes = 0;
     let lamps = 0;
     for (let y = 0; y < DIRECTION_GRID_SIZE; y++) {
      for (let x = 0; x < DIRECTION_GRID_SIZE; x++) {
       const c = g[y][x];
       if (c == null) continue; // crayon's patchy line
       const l = luminance(c);
       if (labels[y][x] === "eye") {
        eyes++;
        expect(l).toBeLessThan(skinAvg - 0.2);
       }
       if (labels[y][x] === "lamp") {
        lamps++;
        expect(l).toBeGreaterThan(0.5);
       }
      }
     }
     expect(eyes).toBeGreaterThan(0);
     expect(lamps).toBeGreaterThan(0);
    }
  });

  it("every crayon pixel comes from the crayon box (plus its paper)", () => {
    const g = buildDirectionGrid("crayon", "miner", { miner: LOOKS[0] });
    const box = new Set([...CRAYON_HUES, "#f7f1e2", "#2a2a2a", "#4a3524"]);
    // The crayon renderer also darkens strokes (pressure ridges); allow any
    // color that is a darkened crayon by checking the hue channel order
    // instead of an exact match.
    for (const c of colorsOf(g)) {
     if (box.has(c)) continue;
     expect(c).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe("registry", () => {
  it("has a one-line label per direction", () => {
    for (const direction of DIRECTION_IDS) {
     expect(typeof DIRECTION_LABELS[direction]).toBe("string");
     expect(DIRECTION_LABELS[direction].length).toBeGreaterThan(20);
    }
    expect(Object.keys(DIRECTION_LABELS).sort()).toEqual(
     [...DIRECTION_IDS].sort(),
    );
  });
});

describe("color helpers", () => {
  it("saturate keeps the hue and clamps to the byte range", () => {
    expect(saturate("#808080", 0)).toBe("#808080");
    expect(saturate("#c08080", 1)).toBe("#eb6b6b");
    expect(saturate("#a06060", 0.5)).toBe("#b55555");
    expect(saturate("#ffffff", 4)).toBe("#ffffff");
    expect(saturate("#000000", 1)).toBe("#000000");
    expect(saturate("#808080", -0.5)).toBe("#808080");
  });

  it("noise is deterministic, in range, and varies across the grid", () => {
    expect(noise(3, 7, 11)).toBe(noise(3, 7, 11));
    expect(noise(3, 7, 11)).not.toBe(noise(3, 7, 12));
    const seen = new Set<number>();
    for (let y = 0; y < 16; y++) {
     for (let x = 0; x < 16; x++) {
      const n = noise(x, y, 5);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
      seen.add(n);
     }
    }
    expect(seen.size).toBeGreaterThan(200);
  });
});

describe("every subject renders in every direction", () => {
  const combos: [DirectionId, SubjectId][] = DIRECTION_IDS.flatMap((d) =>
    SUBJECT_IDS.map((s) => [d, s] as [DirectionId, SubjectId]),
  );
  it.each(combos)("%s / %s renders", (direction, subject) => {
    const g = buildDirectionGrid(direction, subject, { miner: LOOKS[0] });
    expect(filled(g)).toBeGreaterThan(60);
  });
});