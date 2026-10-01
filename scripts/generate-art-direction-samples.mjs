#!/usr/bin/env node
/**
 * Renders the art-DIRECTION contact sheets (todo: "add more generated art
 * styles ... to potential art assets"; docs/art-directions.md).
 *
 * Unlike the sibling drafts — which re-treat the live 16×16 grids — these
 * sprites are BUILT from scratch at 32×32 (src/utils/graphics/
 * characterArt.ts), so the sheets put a completely different look next to
 * the thing that ships:
 *
 *   docs/art-directions/samples/directions.png       6 cols × 4 subjects
 *   docs/art-directions/samples/directions-looks.png 6 cols × 3 miner looks
 *
 * Columns, left to right (fixed order in both sheets):
 *   flat     — the live 16×16 pixel art at 6× (the baseline)
 *   cartoon  anime  storybook  crayon  papercut — the drafts at 3×
 *
 * Every sprite is drawn at the same 96 px display size, so the sheet
 * compares art direction, not content. Ground is the dark slate the other
 * art sheets use, so light and dark styles judge the same.
 *
 * Re-run after touching characterArt.ts:
 *   node scripts/generate-art-direction-samples.mjs
 *
 * Node 22.18+ runs the src/*.ts files directly (type stripping); the
 * resolve hook exists because the app's convention is extensionless relative
 * imports. The looks/pickaxe themes below are the fixed sample set (the same
 * pools the in-game cosmetics draw from).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { existsSync, statSync } from "node:fs";
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
  DIRECTION_GRID_SIZE,
  DIRECTION_IDS,
  SUBJECT_IDS,
  buildDirectionGrid,
} = await import("../src/utils/graphics/characterArt.ts");
const {
  buildMinerGrid,
  buildPickaxeGrid,
  buildGemGrid,
  buildMineralChunkGrid,
} = await import("../src/utils/graphics/pixelArt.ts");
const {
  blankGrid,
  gridToPngBuffer,
  place,
  scaleGrid,
} = await import("./lib/sampleSheet.mjs");

// --- fixed sample set (one look per sheet column is a different axis, so
// --- here: the same three miner looks every art draft has used) -----------
const MINER_LOOKS = [
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

// Same pickaxe themes as the other art sheets (inlined from cosmetics.ts).
const PICKAXE_THEME = {
  head: "#9aa5b1",
  glow: "#d9e2ec",
  handle: "#8a5a2b",
};

// --- layout ---------------------------------------------------------------
const BG = "#232733"; // dark slate (same ground as the art-styles sheets)
const CELL = 96; // every sprite, every column, at the same display size
const GAP = 12;
const MARGIN = 16;

const COLS = ["flat", ...DIRECTION_IDS];
const ROWS = SUBJECT_IDS;

function sheetWidth(count) {
  return MARGIN * 2 + CELL * count + GAP * (count - 1);
}
function sheetHeight(count) {
  return MARGIN * 2 + CELL * count + GAP * (count - 1);
}

/** The live 16×16 sprite for a subject, upscaled to the display cell. */
function classicGrid(subject, look) {
  switch (subject) {
    case "miner":
      return buildMinerGrid(look);
    case "pickaxe":
      return buildPickaxeGrid(PICKAXE_THEME);
    case "gem":
      return buildGemGrid();
    default:
      return buildMineralChunkGrid();
  }
}

/** One cell: the classic baseline (6×) or a 32×32 draft (3×). */
function cell(subject, col, look, seed) {
  if (col === "flat") return scaleGrid(classicGrid(subject, look), CELL / 16);
  return scaleGrid(
    buildDirectionGrid(col, subject, { miner: look }, seed),
    CELL / DIRECTION_GRID_SIZE,
  );
}

/** Compose a sheet: one row per `rows` entry, one column per direction. */
function compose(cols, rows, pick) {
  const s = blankGrid(sheetWidth(cols.length), sheetHeight(rows.length), BG);
  rows.forEach((subject, r) => {
    cols.forEach((col, c) => {
      place(
        s,
        cell(subject, col, pick(subject, r), r + 1),
        MARGIN + c * (CELL + GAP),
        MARGIN + r * (CELL + GAP),
      );
    });
  });
  return s;
}

// --- render ---------------------------------------------------------------

const outDir = path.join(process.cwd(), "docs", "art-directions", "samples");
mkdirSync(outDir, { recursive: true });

// Sheet 1: one column per direction, one row per subject.
writeFileSync(
  path.join(outDir, "directions.png"),
  gridToPngBuffer(
    compose(COLS, ROWS, () => MINER_LOOKS[0]),
  ),
);
// Sheet 2: the same six columns over three miner looks (palette check).
writeFileSync(
  path.join(outDir, "directions-looks.png"),
  gridToPngBuffer(
    compose(COLS, ["miner", "miner", "miner"], (_subject, r) => MINER_LOOKS[r]),
  ),
);

for (const f of ["directions.png", "directions-looks.png"]) {
  console.log(
    `wrote ${path.relative(process.cwd(), path.join(outDir, f))} ` +
      `(${sheetWidth(COLS.length)}×${
        f === "directions.png" ? sheetHeight(ROWS.length) : sheetHeight(MINER_LOOKS.length)
      })`,
  );
}
console.log(
  `columns: ${COLS.join(", ")} — flat = live 16×16, the rest are 32×32 drafts`,
);