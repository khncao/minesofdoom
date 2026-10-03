#!/usr/bin/env node
/**
 * Renders the OUTFIT line contact sheet (docs/features.md, the shop's
 * Outfits group): every purchasable body the player's own slot can wear,
 * at the size the game draws it.
 *
 *   docs/outfit-line/samples/outfit-line.png       the 13 paid outfits + the free starter
 *   docs/outfit-line/samples/outfit-line-paper.png  the same grid on papercut's cream stock
 *
 * The sheet exists because of a rule that is easy to break and hard to see:
 * an outfit is a CHARACTER, not a palette (docs/skin-line.md makes the same
 * argument for skins). A palette-only change produces a perfectly green test
 * run and a shop full of the same miner, so the sheet is how you notice —
 * "Crystal Miner" and "Otter of the River" are not one body in two colors.
 *
 * Re-run after touching cosmetics.ts / characterArt.ts:
 *   node scripts/generate-outfit-line-samples.mjs
 */
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { registerHooks } from "node:module";

// --- extensionless relative-import resolution (see header) ---------------
registerHooks({
  resolve(specifier, context, nextResolve) {
    // Two conventions to resolve: relative extensionless specifiers, and bare
    // `src/...` ones (the tsconfig-paths convention the catalog uses itself) —
    // the latter resolve from the repo root, not from the importing file.
    const fromRoot = specifier.startsWith("src/");
    const spec = fromRoot ? "./" + specifier : specifier;
    if (spec.startsWith("./") || spec.startsWith("../")) {
      const base = fromRoot
        ? pathToFileURL(path.join(process.cwd(), "entry.js")).href
        : (context.parentURL ??
          pathToFileURL(path.join(process.cwd(), "entry.js")).href);
      const candidate = new URL(spec, base);
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
  OUTFITS,
  COSMETIC_PREVIEW_SEED,
  rollMinerLook,
} = await import("../src/mines_of_doom/cosmetics.ts");
const { buildPapercutMinerGrid } = await import(
  "../src/utils/graphics/artPack.ts"
);
const { DIRECTION_GRID_SIZE, PAPERCUT_PAPER } = await import(
  "../src/utils/graphics/characterArt.ts"
);
const { blankGrid, gridToPngBuffer, place, scaleGrid } = await import(
  "./lib/sampleSheet.mjs"
);

const SLATE = "#232733"; // same ground as the other art sheets
const GAP = 12;
const MARGIN = 16;
/** The player's own slot renders at 44px; the sheet draws the grid 3×. */
const ZOOM = 3;
const CELL = DIRECTION_GRID_SIZE * ZOOM;

/** One row of outfits at `k`× on `bg`, in catalog order. */
function line(k, bg) {
  const g = blankGrid(
    MARGIN * 2 + CELL * OUTFITS.length + GAP * (OUTFITS.length - 1),
    CELL + MARGIN * 2,
    bg,
  );
  OUTFITS.forEach((outfit, i) => {
    place(
      g,
      scaleGrid(
        buildPapercutMinerGrid(
          rollMinerLook(COSMETIC_PREVIEW_SEED, outfit.id),
        ),
        k,
      ),
      MARGIN + i * (CELL + GAP),
      MARGIN,
    );
  });
  return g;
}

const outDir = path.join(process.cwd(), "docs", "outfit-line", "samples");
mkdirSync(outDir, { recursive: true });
for (const [name, bg] of [
  ["outfit-line.png", SLATE],
  ["outfit-line-paper.png", PAPERCUT_PAPER],
]) {
  const grid = line(ZOOM, bg);
  const file = path.join(outDir, name);
  writeFileSync(file, gridToPngBuffer(grid));
  console.log(
    `wrote ${path.relative(process.cwd(), file)} (${grid[0].length}×${grid.length})`,
  );
}

console.log(
  `${OUTFITS.length} outfits (${OUTFITS.filter((o) => o.costGems > 0).length} paid):\n` +
    OUTFITS.map(
      (o) =>
        `  ${o.id.padEnd(10)} ${o.shape ? "character" : "starter "} — ${
          o.shape
            ? Object.entries(o.shape)
                .map(([k, v]) => `${k}=${v}`)
                .join(" ")
            : "the plain default miner"
        }`,
    ).join("\n"),
);
