#!/usr/bin/env node
/**
 * Renders the CAVE rock-direction contact sheets
 * (docs/cave-art.md; the "cave art in the new style" todo).
 *
 * The cave is its own strip pipeline, so this sheet is made of assembled
 * STRIPS rather than of one sprite per subject: several row strips stacked
 * into one cave wall, the way CaveBackground lays them out, with the two
 * foreground wall bands at the screen edges.
 *
 *   docs/cave-art/samples/cave-directions.png    classic | papercut, 2 themes
 *   docs/cave-art/samples/cave-zoom.png          papercut, 6× on the rock alone
 *
 * Papercut has to be judged on cave-dark ground (on slate the planes and the
 * lit cut edges have nothing to sit on), so the sheet's ground is the same
 * dark wash the game puts behind the rows.
 *
 * Re-run after touching caveArt.ts / caveTiles.ts:
 *   node scripts/generate-cave-art-samples.mjs
 *
 * Node 22.18+ runs the src/*.ts files directly (type stripping); the
 * resolve hook exists because the app's convention is extensionless relative
 * imports.
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
  CAVE_ART_IDS,
  CAVE_TILE_PX,
  CAVE_WALL_TILE_H,
  buildCaveRow,
  buildCaveWall,
} = await import("../src/utils/graphics/caveTiles.ts");
const { paperRockInk } = await import("../src/utils/graphics/caveArt.ts");
const { mixHex } = await import("../src/utils/graphics/caveTiles.ts");
const {
  blankGrid,
  gridToPngBuffer,
  place,
  scaleGrid,
} = await import("./lib/sampleSheet.mjs");

// --- the fixed sample set -------------------------------------------------
// Two of the game's cave themes (cosmetics.ts) so the sheet shows the tint
// doing the work, and two tiers each so the plane field is a different cut.
const THEMES = [
  { tint: "#a0856a", tier: 0 }, // the default rock
  { tint: "#5a6a9a", tier: 3 }, // a deep, colder band
];
/** Rows stacked per panel (the panel is a window of the cave wall). */
const ROWS = 7;
const SCALE = 2;
const WALL_W = 32;
const GAP = 14;
const MARGIN = 16;

const panelW = (CAVE_TILE_PX * 14 + WALL_W * 2) * SCALE;
const panelH = CAVE_TILE_PX * ROWS * SCALE;

/** One panel: the cave as CaveBackground lays it out (wash, rows, walls). */
function panel(art, tint, tier) {
  const wash = mixHex(tint, "#000000", 0.55);
  const out = blankGrid(panelW, panelH, wash);
  for (let i = 0; i < ROWS; i++) {
    place(
      out,
      scaleGrid(buildCaveRow(tier, i * 3 + 2, tint, undefined, art), SCALE),
      WALL_W * SCALE,
      i * CAVE_TILE_PX * SCALE,
    );
  }
  // The two foreground walls, at the edges of the window.
  place(out, scaleGrid(buildCaveWall("left", tint, WALL_W, 1, art), SCALE), 0, 0);
  place(
    out,
    scaleGrid(buildCaveWall("right", tint, WALL_W, 1, art), SCALE),
    panelW - WALL_W * SCALE,
    panelH - CAVE_WALL_TILE_H * SCALE,
  );
  return out;
}

/** Grid `inner` centered on a 1px slate frame (the sheet's ground). */
function framed(inner) {
  const out = blankGrid(inner[0].length + 2, inner.length + 2, "#232733");
  place(out, inner, 1, 1);
  return out;
}

/** The same rock body, 6×, with the direction's own palette as a caption. */
function zoom(art, tint, tier) {
  const rows = [];
  for (let i = 0; i < 3; i++) {
    rows.push(buildCaveRow(tier, i * 5 + 1, tint, undefined, art));
  }
  const w = rows[0][0].length;
  const flat = blankGrid(w, CAVE_TILE_PX * rows.length);
  rows.forEach((r, i) => {
    for (let y = 0; y < CAVE_TILE_PX; y++) {
      for (let x = 0; x < w; x++) flat[i * CAVE_TILE_PX + y][x] = r[y][x];
    }
  });
  return scaleGrid(flat, 6);
}

// --- render ---------------------------------------------------------------
const outDir = path.join(process.cwd(), "docs", "cave-art", "samples");
mkdirSync(outDir, { recursive: true });

// Sheet 1: one column per direction, one row per theme.
const sheet = blankGrid(
  MARGIN * 2 + panelW * CAVE_ART_IDS.length + GAP * (CAVE_ART_IDS.length - 1),
  MARGIN * 2 + panelH * THEMES.length + GAP * (THEMES.length - 1),
  "#232733",
);
THEMES.forEach((theme, r) => {
  CAVE_ART_IDS.forEach((art, c) => {
    place(
      sheet,
      panel(art, theme.tint, theme.tier),
      MARGIN + c * (panelW + GAP),
      MARGIN + r * (panelH + GAP),
    );
  });
});
writeFileSync(path.join(outDir, "cave-directions.png"), gridToPngBuffer(sheet));

// Sheet 2: the rock alone, 6× — the read that decides the direction.
const zoomGrid = zoom("papercut", THEMES[0].tint, THEMES[0].tier);
writeFileSync(
  path.join(outDir, "cave-zoom.png"),
  gridToPngBuffer(framed(zoomGrid)),
);

const ink = paperRockInk(THEMES[0].tint);
console.log(`wrote docs/cave-art/samples/cave-directions.png (${sheet[0].length}×${sheet.length})`);
console.log(`wrote docs/cave-art/samples/cave-zoom.png (${zoomGrid[0].length}×${zoomGrid.length})`);
console.log(`columns: ${CAVE_ART_IDS.join(", ")}`);
console.log(`papercut stock for ${THEMES[0].tint}:`, ink);
