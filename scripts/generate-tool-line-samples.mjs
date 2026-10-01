#!/usr/bin/env node
/**
 * Renders the PICKAXE LINE contact sheet (docs/tool-line.md) — the eight
 * tools the player can own, one per cosmetic, each its own silhouette.
 *
 *   docs/tool-line/samples/tool-line.png        the line, in shop order
 *   docs/tool-line/samples/tool-line-zoom.png   the four newest at 8×
 *   docs/tool-line/samples/tool-line-swing.png  the same eight at the size the
 *                                               swing animation draws them
 *
 * Re-run after touching cosmetics.ts (PICKAXES) / characterArt.ts (pickaxeLabels):
 *   node scripts/generate-tool-line-samples.mjs
 *
 * Node 22.18+ runs the src/*.ts files directly (type stripping); the resolve
 * hook exists because the app's convention is extensionless relative imports
 * plus bare `src/...` specifiers.
 */
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { registerHooks } from "node:module";

// --- import resolution (see header) --------------------------------------
registerHooks({
  resolve(specifier, context, nextResolve) {
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

const { PICKAXES } = await import("../src/mines_of_doom/cosmetics.ts");
const {
  DIRECTION_GRID_SIZE,
  buildDirectionGrid,
} = await import("../src/utils/graphics/characterArt.ts");
const { blankGrid, gridToPngBuffer, place, scaleGrid } = await import(
  "./lib/sampleSheet.mjs"
);

const SLATE = "#232733"; // same ground as the other art sheets
const GAP = 12;
const MARGIN = 16;

/** The tool sprite for one pickaxe cosmetic. */
function toolGrid(p) {
  return buildDirectionGrid("papercut", "pickaxe", {
    pickaxe: p.theme,
    tool: p.tool,
  });
}

/** One row of tools at `k`× on `bg`. */
function line(picks, k, bg) {
  const cell = DIRECTION_GRID_SIZE * k;
  const g = blankGrid(
    MARGIN * 2 + cell * picks.length + GAP * (picks.length - 1),
    cell + MARGIN * 2,
    bg,
  );
  picks.forEach((p, i) => {
    place(g, scaleGrid(toolGrid(p), k), MARGIN + i * (cell + GAP), MARGIN);
  });
  return g;
}

/**
 * The size the swing animation actually draws a pickaxe at: the player is
 * 44px and the tool is drawn at 36px, then the whole sprite is rotated. At
 * 1:1 a 32px grid downscales, so the sheet renders 44px and shows it 2× —
 * the read that matters is "can you tell the tools apart mid-swing".
 */
const SWING_PX = 44;

function swingSheet(picks) {
  const zoom = 2;
  const cell = SWING_PX * zoom;
  const g = blankGrid(
    MARGIN * 2 + cell * picks.length + GAP * (picks.length - 1),
    cell + MARGIN * 2,
    SLATE,
  );
  picks.forEach((p, i) => {
    const src = toolGrid(p);
    const small = blankGrid(SWING_PX, SWING_PX, null);
    for (let y = 0; y < SWING_PX; y++) {
      for (let x = 0; x < SWING_PX; x++) {
        const x0 = Math.floor((x * DIRECTION_GRID_SIZE) / SWING_PX);
        const x1 = Math.max(
          x0 + 1,
          Math.floor(((x + 1) * DIRECTION_GRID_SIZE) / SWING_PX),
        );
        const y0 = Math.floor((y * DIRECTION_GRID_SIZE) / SWING_PX);
        const y1 = Math.max(
          y0 + 1,
          Math.floor(((y + 1) * DIRECTION_GRID_SIZE) / SWING_PX),
        );
        let r = 0;
        let g = 0;
        let b = 0;
        let n = 0;
        for (let sy = y0; sy < y1; sy++) {
          for (let sx = x0; sx < x1; sx++) {
            const c = src[sy][sx];
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
          small[y][x] = `#${hex(r)}${hex(g)}${hex(b)}`;
        }
      }
    }
    place(
      g,
      scaleGrid(small, zoom),
      MARGIN + i * (cell + GAP),
      MARGIN,
    );
  });
  return g;
}

const outDir = path.join(process.cwd(), "docs", "tool-line", "samples");
mkdirSync(outDir, { recursive: true });

// The four added with the shape axis, in catalog order.
const NEWEST = PICKAXES.filter(
  (p) => p.tool !== "pickaxe" && p.tool !== "mattock" && p.tool !== "lance" && p.tool !== "auger",
);

const sheets = [
  ["tool-line.png", () => line(PICKAXES, 4, SLATE)],
  ["tool-line-zoom.png", () => line(NEWEST, 8, SLATE)],
  ["tool-line-swing.png", () => swingSheet(PICKAXES)],
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
  PICKAXES.map(
    (p) => `${p.name} ${p.costGems}g (${p.toolName})`,
  ).join(", "),
);