#!/usr/bin/env node
/**
 * Renders the PREMIUM CREW contact sheets (docs/premium-characters.md).
 *
 * The premium crew is the legendary miner type, given a cast: six named
 * characters, each with its own look, a mark worn over the headwear (crown /
 * halo / hood / plume / antlers / crystal spikes) and an aura (a colour plus
 * a mote pattern floating around the body).
 *
 *   docs/premium-characters/samples/premium-crew.png        the cast, 6×1
 *   docs/premium-characters/samples/premium-crew-paper.png  the same on the
 *                                                          cream stock
 *   docs/premium-characters/samples/premium-crew-size.png   every character
 *                                                          at the sizes the
 *                                                          crew column
 *                                                          actually uses
 *                                                          (24/20/16 px)
 *
 * Re-run after touching premiumChars.ts / characterArt.ts:
 *   node scripts/generate-premium-char-samples.mjs
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
  PREMIUM_CHARS,
  PREMIUM_CHAR_GRID_SIZE,
  buildPremiumCharGrid,
} = await import("../src/utils/graphics/premiumChars.ts");
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

/** One row of characters at `k`× on `bg`. */
function line(sprites, k, bg) {
  const cell = PREMIUM_CHAR_GRID_SIZE * k;
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
  "premium-characters",
  "samples",
);
mkdirSync(outDir, { recursive: true });

const sprites = PREMIUM_CHARS.map((c) => buildPremiumCharGrid(c));
const sheets = [
  ["premium-crew.png", () => line(sprites, 4, SLATE)],
  ["premium-crew-paper.png", () => line(sprites, 4, PAPERCUT_PAPER)],
  ["premium-crew-size.png", () => sizeSheet(sprites)],
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
  `cast: ${PREMIUM_CHARS.map((c) => `${c.name} (${c.aura})`).join(", ")}`,
);