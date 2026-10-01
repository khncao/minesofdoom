#!/usr/bin/env node
/**
 * Renders the PAPERCUT SKIN LINE contact sheets (docs/art-directions.md —
 * papercut is the picked direction).
 *
 * The skin line is a set of CHARACTERS (a MinerLook colorway + a SkinShape
 * silhouette), not recolors of one body: helmets, caps, bandanas, critters,
 * and the cute/pretty half with hair, dresses and big eyes.
 *
 *   docs/art-directions/samples/papercut-skins.png        6×2 grid, dark slate
 *   docs/art-directions/samples/papercut-skins-paper.png  the same grid on the
 *                                                        cream paper the
 *                                                        direction is cut
 *                                                        from — papercut has
 *                                                        to be judged on its
 *                                                        own ground
 *   docs/art-directions/samples/papercut-skins-zoom.png  four of the cute half
 *                                                        at 8×, for the detail
 *
 * Re-run after touching papercutSkins.ts / characterArt.ts:
 *   node scripts/generate-papercut-skin-samples.mjs
 *
 * Node 22.18+ runs the src/*.ts files directly (type stripping); the resolve
 * hook exists because the app's convention is extensionless relative imports.
 */
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { registerHooks } from "node:module";

// --- extensionless relative-import resolution (see header) ---------------
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("./") || specifier.startsWith("../")) {
      const base =
        context.parentURL ??
        pathToFileURL(path.join(process.cwd(), "entry.js")).href;
      const candidate = new URL(specifier, base);
      if (candidate.protocol === "file:") {
        const p = fileURLToPath(candidate);
        for (const ext of ["", ".ts", ".js", ".mjs"]) {
          const f = p + ext;
          if (existsSync(f) && statSync(f).isFile()) {
            return { url: pathToFileURL(f).href, shortCircuit: true };
          }
        }
      }
    }
    return nextResolve(specifier, context);
  },
});

const {
  PAPERCUT_SKINS,
  PAPERCUT_SKIN_GRID_SIZE,
  buildPapercutSkinGrid,
  papercutSkinGroup,
} = await import("../src/utils/graphics/papercutSkins.ts");
const { PAPERCUT_PAPER } = await import(
  "../src/utils/graphics/characterArt.ts"
);
const { blankGrid, gridToPngBuffer, place, scaleGrid } = await import(
  "./lib/sampleSheet.mjs"
);

// --- layout ---------------------------------------------------------------
const SLATE = "#232733"; // same ground as the other art sheets
const GAP = 12;
const MARGIN = 16;

/** The four characters in the zoom sheet (the cutest read at 8×). */
const ZOOM_IDS = ["rose-lantern", "mint-comet", "twin-bells", "sky-bob"];

/** Compose `skins` into a grid of `cols` columns at `k`× scale. */
function sheet(skins, cols, k, bg) {
  const cell = PAPERCUT_SKIN_GRID_SIZE * k;
  const rows = Math.ceil(skins.length / cols);
  const g = blankGrid(
    MARGIN * 2 + cell * cols + GAP * (cols - 1),
    MARGIN * 2 + cell * rows + GAP * (rows - 1),
    bg,
  );
  skins.forEach((skin, i) => {
    place(
      g,
      scaleGrid(buildPapercutSkinGrid(skin), k),
      MARGIN + (i % cols) * (cell + GAP),
      MARGIN + Math.floor(i / cols) * (cell + GAP),
    );
  });
  return g;
}

const outDir = path.join(process.cwd(), "docs", "art-directions", "samples");
mkdirSync(outDir, { recursive: true });

const sheets = [
  // crew first, pretty second — the grid reads as two halves
  ["papercut-skins.png", () => sheet(PAPERCUT_SKINS, 6, 4, SLATE)],
  ["papercut-skins-paper.png", () => sheet(PAPERCUT_SKINS, 6, 4, PAPERCUT_PAPER)],
  [
   "papercut-skins-zoom.png",
   () =>
    sheet(
     ZOOM_IDS.map(
      (id) => PAPERCUT_SKINS.find((s) => s.id === id) ?? PAPERCUT_SKINS[0],
     ),
     4,
     8,
     PAPERCUT_PAPER,
    ),
  ],
];

for (const [name, build] of sheets) {
  const grid = build();
  const file = path.join(outDir, name);
  writeFileSync(file, gridToPngBuffer(grid));
  console.log(
    `wrote ${path.relative(process.cwd(), file)} ` +
      `(${grid[0].length}×${grid.length})`,
  );
}

const pretty = PAPERCUT_SKINS.filter((s) => papercutSkinGroup(s) === "pretty");
console.log(
  `${PAPERCUT_SKINS.length} skins (${pretty.length} in the cute/pretty group): ` +
    PAPERCUT_SKINS.map((s) => s.id).join(", "),
);