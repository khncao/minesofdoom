#!/usr/bin/env node
/**
 * Renders the draft art-style contact sheets for the art-style decision
 * (todo: "draft a few different generated art styles"; docs/art-styles.md).
 *
 * Each sheet is the SAME set of base sprites (characters, pickaxes, gem,
 * mineral chunk, one cave row) run through one style pass from
 * src/utils/graphics/stylePasses.ts, so the files are directly comparable:
 *
 *   docs/art-styles/samples/flat.png      — the current in-game look (baseline)
 *   docs/art-styles/samples/mono.png      — 1-bit dithered woodcut
 *   docs/art-styles/samples/retro16.png   — 16-color console palette
 *   docs/art-styles/samples/outline.png   — cartoon cel edge
 *
 * Re-run after touching stylePasses.ts / pixelArt.ts / caveTiles.ts:
 *   node scripts/generate-art-style-samples.mjs
 *
 * Node 22.18+ runs the src/*.ts files directly (type stripping). The
 * resolve hook below only exists because the app's convention is
 * extensionless relative imports ("./pixelArt"), which ESM doesn't do on
 * its own. The sample LOOKS are deliberately fixed and inlined (copied from
 * the pools in cosmetics.ts) — cosmetics.ts itself can't be imported here
 * because it name-imports type-only symbols without `import type`, which
 * type stripping can't erase.
 */
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
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

const { crc32 } = await import("../src/utils/graphics/pixelArt.ts");
const {
  buildMinerGrid,
  buildPickaxeGrid,
  buildGemGrid,
  buildMineralChunkGrid,
} = await import("../src/utils/graphics/pixelArt.ts");
const { buildCaveRow } = await import("../src/utils/graphics/caveTiles.ts");
const { applyStyle, STYLE_IDS } = await import(
  "../src/utils/graphics/stylePasses.ts"
);
const { createGrid, hexToRgb } = await import(
  "../src/utils/graphics/pixelArt.ts"
);

// --- sample set (fixed, representative — pools in cosmetics.ts) -----------
// Two humans + two critters so every body type is visible, one look each
// from the hat/hair + homage + critter lines.
const LOOKS = [
  {
    skin: "#ffdbb4",
    shirt: "#e8a33d",
    pants: "#3b4a6b",
    boots: "#4a3524",
    hat: "#e8c33d",
    hatStyle: "helmet",
  }, // classic human, hard hat
  {
    skin: "#f2c9a0",
    shirt: "#e070a0",
    pants: "#3b4a6b",
    boots: "#333333",
    hat: "#6a4a3a",
    hatStyle: "longhair",
  }, // hair line (longhair)
  {
    skin: "#e07020",
    shirt: "#3a4a5a",
    pants: "#c85a18",
    boots: "#3a2a1a",
    hat: "#e8e8e8",
    hatStyle: "bandana",
    species: "animal",
  }, // fox critter
  {
    skin: "#a08058",
    shirt: "#d94f30",
    pants: "#8a6b48",
    boots: "#5a4630",
    hat: "#e8c33d",
    hatStyle: "beanie",
    species: "animal",
  }, // marmot critter
];

// Same themes as PICKAXES in cosmetics.ts (inlined — see header).
const PICKAXE_THEMES = [
  { head: "#9aa5b1", glow: "#d9e2ec", handle: "#8a5a2b" }, // steel
  { head: "#e8c33d", glow: "#fff3b0", handle: "#8a5a2b" }, // gold
  { head: "#5ad8e8", glow: "#d0fbff", handle: "#3a2f5a" }, // crystal
  { head: "#4a4a5a", glow: "#9a7fd0", handle: "#2a2233" }, // shadow
];

const BG = "#232733"; // neutral dark slate: judges light and dark styles alike
const SHEET_W = 340;
const SHEET_H = 184;

// --- grid helpers ----------------------------------------------------------

function scaleGrid(grid, k) {
  const h = grid.length * k;
  const w = grid[0].length * k;
  const out = createGrid(w, h);
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      const c = grid[y][x];
      for (let dy = 0; dy < k; dy++) {
        for (let dx = 0; dx < k; dx++) {
          out[y * k + dy][x * k + dx] = c;
        }
      }
    }
  }
  return out;
}

function sheet() {
  const g = createGrid(SHEET_W, SHEET_H);
  for (let y = 0; y < SHEET_H; y++) {
    for (let x = 0; x < SHEET_W; x++) g[y][x] = BG;
  }
  return g;
}

function place(base, grid, x, y) {
  for (let ry = 0; ry < grid.length; ry++) {
    for (let rx = 0; rx < grid[0].length; rx++) {
      const c = grid[ry][rx];
      if (c != null) base[y + ry][x + rx] = c;
    }
  }
}

/** Compose the identical sample set into one sheet. */
function composeSheet(styleId) {
  const pass = (g) => applyStyle(styleId, g);
  const s = sheet();
  const row1x = 30; // centered: (340 - (4*64 + 3*8)) / 2
  LOOKS.forEach((look, i) => {
    place(s, scaleGrid(pass(buildMinerGrid(look)), 4), row1x + i * 72, 12);
  });
  // Row 2: pickaxes 3× (48px), gem + chunk 3× (36px), gaps 6 — width 288.
  const row2x = 26;
  PICKAXE_THEMES.forEach((theme, i) => {
    place(s, scaleGrid(pass(buildPickaxeGrid(theme)), 3), row2x + i * 54, 88);
  });
  place(s, scaleGrid(pass(buildGemGrid()), 3), row2x + 4 * 54 - 18 + 6, 88 + 6);
  place(
    s,
    scaleGrid(pass(buildMineralChunkGrid()), 3),
    row2x + 4 * 54 + 6,
    88 + 6,
  );
  // Row 3: one full cave row (288px wide) at 1× — Deep Grotto tint.
  place(s, pass(buildCaveRow(1, 0, "#8fa8b8")), 26, 148);
  return s;
}

// --- minimal PNG writer (zlib deflate; the in-app encoder is capped at a
// --- single stored block, too small for contact sheets) ---------------------

function gridToPngBuffer(grid) {
  const h = grid.length;
  const w = grid[0].length;
  const stride = 1 + w * 4;
  const raw = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    raw[y * stride] = 0; // filter: None
    for (let x = 0; x < w; x++) {
      const c = grid[y][x];
      const o = y * stride + 1 + x * 4;
      if (c == null) {
        raw.fill(0, o, o + 4);
      } else {
        const [r, g, b] = hexToRgb(c);
        raw[o] = r;
        raw[o + 1] = g;
        raw[o + 2] = b;
        raw[o + 3] = 255;
      }
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const idat = zlib.deflateSync(raw);
  const u32 = (n) => {
    const b = Buffer.alloc(4);
    b.writeUInt32BE(n);
    return b;
  };
  const makeChunk = (type, data) =>
    Buffer.concat([
      u32(data.length),
      Buffer.from(type, "ascii"),
      data,
      u32(
        crc32(
          new Uint8Array(Buffer.concat([Buffer.from(type, "ascii"), data])),
        ),
      ),
    ]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    makeChunk("IHDR", ihdr),
    makeChunk("IDAT", idat),
    makeChunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- render all styles -----------------------------------------------------

const outDir = path.join(process.cwd(), "docs", "art-styles", "samples");
mkdirSync(outDir, { recursive: true });
for (const id of STYLE_IDS) {
  const file = path.join(outDir, `${id}.png`);
  writeFileSync(file, gridToPngBuffer(composeSheet(id)));
  console.log(`wrote ${path.relative(process.cwd(), file)}`);
}
console.log(`done — ${STYLE_IDS.length} sheets in docs/art-styles/samples/`);
