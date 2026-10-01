#!/usr/bin/env node
/**
 * Renders the CREW CAST contact sheets (docs/crew-characters.md).
 *
 * Every purchasable miner is a character, in three lines (crewChars.ts):
 *
 *   normal     the ordinary mineral hires — named faces, no aura
 *   fast       the gem hires of the Deep Shaft — working marks + motion motes
 *   legendary  the endgame gem line — grand marks + the full aura
 *
 *   docs/crew-characters/samples/crew-normal.png         the ordinary line
 *   docs/crew-characters/samples/crew-fast.png           the fast line
 *   docs/crew-characters/samples/crew-legendary.png      the legendary line
 *   docs/crew-characters/samples/crew-all.png            all three, one sheet
 *   docs/crew-characters/samples/crew-all-paper.png      the same on paper
 *   docs/crew-characters/samples/crew-fast-size.png      the two gem lines at
 *                                                        the crew sizes the
 *                                                        column uses
 *
 * Re-run after touching crewChars.ts / characterArt.ts:
 *   node scripts/generate-crew-char-samples.mjs
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
  CREW_CASTS,
  CREW_CHAR_GRID_SIZE,
  buildCrewCharGrid,
} = await import("../src/utils/graphics/crewChars.ts");
const { PAPERCUT_PAPER } = await import(
  "../src/utils/graphics/characterArt.ts"
);
const { blankGrid, gridToPngBuffer, place, scaleGrid } = await import(
  "./lib/sampleSheet.mjs"
);

const SLATE = "#232733"; // same ground as the other art sheets
const GAP = 12;
const MARGIN = 16;
/** Sizes the crew column actually renders a roster miner at. */
const CREW_SIZES = [24, 20, 16];
/** One row of characters at `k`x, sized to the widest cast in it. */
const ZOOM = 4;

/** One row of characters at `k`x on `bg`. */
function line(sprites, k, bg) {
  const cell = CREW_CHAR_GRID_SIZE * k;
  const g = blankGrid(
    MARGIN * 2 + cell * sprites.length + GAP * (sprites.length - 1),
    cell + MARGIN * 2,
    bg,
  );
  sprites.forEach((sprite, i) => {
    place(g, scaleGrid(sprite, k), MARGIN + i * (cell + GAP), MARGIN);
  });
  return g;
}

/** Every cast stacked as one sheet, one row per line. */
function allLines(casts, k, bg) {
  const cols = Math.max(...casts.map((c) => c.length));
  const cell = CREW_CHAR_GRID_SIZE * k;
  const rowGap = GAP * 2;
  const g = blankGrid(
    MARGIN * 2 + cell * cols + GAP * (cols - 1),
    MARGIN * 2 + (cell + rowGap) * casts.length - rowGap,
    bg,
  );
  casts.forEach((cast, li) => {
    cast.forEach((char, ci) => {
      place(
        g,
        scaleGrid(buildCrewCharGrid(char), k),
        MARGIN + ci * (cell + GAP),
        MARGIN + li * (cell + rowGap),
      );
    });
  });
  return g;
}

/** Box-filter a sprite down to `size` px (what the crew column does). */
function downscale(grid, size) {
  const out = blankGrid(size, size, null);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      const x0 = Math.floor((x * grid[0].length) / size);
      const x1 = Math.floor(((x + 1) * grid[0].length) / size);
      const y0 = Math.floor((y * grid.length) / size);
      const y1 = Math.floor(((y + 1) * grid.length) / size);
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const c = grid[sy][sx];
          if (c == null) continue;
          r += parseInt(c.slice(1, 3), 16);
          g += parseInt(c.slice(3, 5), 16);
          b += parseInt(c.slice(5, 7), 16);
          n++;
        }
      }
      if (n > 0) {
        const hex = (v) =>
          Math.round(v / n)
            .toString(16)
            .padStart(2, "0");
        out[y][x] = `#${hex(r)}${hex(g)}${hex(b)}`;
      }
    }
  }
  return out;
}

/** The size ladder: every character as the crew column actually draws it. */
function sizeSheet(sprites) {
  const zoom = 3; // inspection zoom (the sheet is for judging legibility)
  const cell = CREW_SIZES[0] * zoom;
  const g = blankGrid(
    MARGIN * 2 + cell * CREW_SIZES.length + GAP * (CREW_SIZES.length - 1),
    MARGIN * 2 + cell * sprites.length,
    SLATE,
  );
  sprites.forEach((sprite, row) => {
    CREW_SIZES.forEach((size, col) => {
      const small = downscale(sprite, size);
      place(
        g,
        scaleGrid(small, zoom),
        MARGIN + col * (cell + GAP),
        MARGIN + row * cell,
      );
    });
  });
  return g;
}

const outDir = path.join(
  process.cwd(),
  "docs",
  "crew-characters",
  "samples",
);
mkdirSync(outDir, { recursive: true });

const spritesOf = (line) => line.map((c) => buildCrewCharGrid(c));
const allCasts = [
  CREW_CASTS.normal,
  CREW_CASTS.fast,
  CREW_CASTS.legendary,
];
// The size ladder only makes sense for the two gem lines: those are the
// characters whose mark and aura have to survive the downscale.
const gemSprites = [
  ...spritesOf(CREW_CASTS.fast),
  ...spritesOf(CREW_CASTS.legendary),
];

const sheets = [
  ["crew-normal.png", () => line(spritesOf(CREW_CASTS.normal), ZOOM, SLATE)],
  ["crew-fast.png", () => line(spritesOf(CREW_CASTS.fast), ZOOM, SLATE)],
  [
    "crew-legendary.png",
    () => line(spritesOf(CREW_CASTS.legendary), ZOOM, SLATE),
  ],
  ["crew-all.png", () => allLines(allCasts, ZOOM, SLATE)],
  ["crew-all-paper.png", () => allLines(allCasts, ZOOM, PAPERCUT_PAPER)],
  ["crew-gem-size.png", () => sizeSheet(gemSprites)],
];

for (const [name, build] of sheets) {
  const grid = build();
  const file = path.join(outDir, name);
  writeFileSync(file, gridToPngBuffer(grid));
  console.log(
    `wrote ${path.relative(process.cwd(), file)} (${grid[0].length}×${
      grid.length
    })`,
  );
}

console.log(
  ["normal", "fast", "legendary"]
    .map(
      (line) =>
        `${line}: ${CREW_CASTS[line]
          .map((c) => `${c.name}/${c.aura}`)
          .join(", ")}`,
    )
    .join("\n"),
);