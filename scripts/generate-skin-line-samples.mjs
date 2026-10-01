#!/usr/bin/env node
/**
 * Renders the SKIN LINE contact sheets (docs/skin-line.md — the papercut
 * direction is the picked one, and the skin line ships in it).
 *
 * The skin line is a set of CHARACTERS (a MinerLook colorway + a SkinShape
 * silhouette), not recolors of one body: helmets, caps, bandanas, critters,
 * and the cute/pretty half with hair, dresses and big eyes.
 *
 *   docs/skin-line/samples/skin-line.png                 6×2 grid, dark slate
 *   docs/skin-line/samples/skin-line-paper.png          the same grid on the
 *                                                        cream paper the
 *                                                        direction is cut
 *                                                        from — papercut has
 *                                                        to be judged on its
 *                                                        own ground
 *   docs/skin-line/samples/skin-line-player-size.png     the same twelve at the
 *                                                        44px the player's slot
 *                                                        renders at
 *   docs/skin-line/samples/skin-line-zoom.png            four of the cute half
 *                                                        at 8×, for the detail
 *
 * Re-run after touching cosmetics.ts (SKINS) / characterArt.ts:
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
    // Two import conventions to resolve: relative extensionless specifiers,
    // and bare `src/...` ones (the app's tsconfig-paths convention, which
    // the catalog module itself uses) — the latter resolve from the repo
    // root, not from the importing file.
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

const { SKINS, getSkin, skinGroup } = await import(
  "../src/mines_of_doom/cosmetics.ts"
);
const { buildPapercutSkinGrid } = await import(
  "../src/utils/graphics/artPack.ts"
);
const { DIRECTION_GRID_SIZE, PAPERCUT_PAPER } = await import(
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

/** Box-filter a sprite to `size` px — a non-integer scale needs sampling,
 *  not nearest-neighbour (every other row would come back empty). */
function resize(grid, size) {
  const gh = grid.length;
  const gw = grid[0].length;
  if (size % gw === 0) return scaleGrid(grid, size / gw);
  const out = blankGrid(size, size, null);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const x0 = Math.floor((x * gw) / size);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * gw) / size));
      const y0 = Math.floor((y * gh) / size);
      const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * gh) / size));
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
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

/**
 * Compose `skins` into a grid of `cols` columns. `k` is an integer zoom
 * factor, or a fractional size in px when `frac` is set (the player slot).
 */
function sheet(skins, cols, k, bg, frac = false) {
  const cell = frac ? k : DIRECTION_GRID_SIZE * k;
  const rows = Math.ceil(skins.length / cols);
  const g = blankGrid(
    MARGIN * 2 + cell * cols + GAP * (cols - 1),
    MARGIN * 2 + cell * rows + GAP * (rows - 1),
    bg,
  );
  skins.forEach((skin, i) => {
    place(
      g,
      frac
        ? resize(buildPapercutSkinGrid(skin), k)
        : scaleGrid(buildPapercutSkinGrid(skin), k),
      MARGIN + (i % cols) * (cell + GAP),
      MARGIN + Math.floor(i / cols) * (cell + GAP),
    );
  });
  return g;
}

const outDir = path.join(process.cwd(), "docs", "skin-line", "samples");
mkdirSync(outDir, { recursive: true });

// The shop shows the line in catalog order (the crew half first, then the
// pretty half), so the sheet does too — what you see here is what the shop
// cards show.
const sheets = [
  ["skin-line.png", () => sheet(SKINS, 6, 4, SLATE)],
  ["skin-line-paper.png", () => sheet(SKINS, 6, 4, PAPERCUT_PAPER)],
  [
    "skin-line-zoom.png",
    () =>
      sheet(
        ZOOM_IDS.map((id) => getSkin(id) ?? SKINS[0]),
        4,
        8,
        PAPERCUT_PAPER,
      ),
  ],
  // The size the player actually sees: the player's own slot renders at
  // 44px, so this is the read that matters for a skin.
  ["skin-line-player-size.png", () => sheet(SKINS, 6, 44, SLATE, true)],
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

const pretty = SKINS.filter((s) => skinGroup(s) === "pretty");
console.log(
  `${SKINS.length} skins (${pretty.length} in the pretty group): ` +
    SKINS.map((s) => `${s.id} ${s.costGems}g`).join(", "),
);