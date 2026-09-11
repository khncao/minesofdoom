#!/usr/bin/env node
/**
 * Renders the detailed-art contact sheets for the "more detailed pixel
 * art" draft (todo: "draft improved generated graphics"; docs/art-detail.md).
 *
 * Each sheet is the SAME set of base sprites (characters, pickaxes, gem,
 * mineral chunk, one cave row) — identical sample set to
 * generate-art-style-samples.mjs — run through one detail pass from
 * src/utils/graphics/detailPass.ts, so the sheets compare detail levels,
 * not content:
 *
 *   docs/art-detail/samples/flat.png         — the current in-game look (baseline)
 *   docs/art-detail/samples/detailed.png     — strong top-left bevel
 *   docs/art-detail/samples/detailed-soft.png — soft bevel
 *   docs/art-detail/samples/zoom.png         — the classic miner at 8×: flat vs. detailed vs. soft
 *
 * Re-run after touching detailPass.ts / pixelArt.ts / caveTiles.ts:
 *   node scripts/generate-detailed-art-samples.mjs
 *
 * Node 22.18+ runs the src/*.ts files directly (type stripping). The
 * resolve hook below only exists because the app's convention is
 * extensionless relative imports ("./pixelArt"), which ESM doesn't do on
 * its own. The sample LOOKS are deliberately fixed and inlined (copied from
 * generate-art-style-samples.mjs) so the two draft families stay comparable
 * sprite-for-sprite.
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
        const fp = fileURLToPath(candidate);
        for (const ext of ["", ".ts", ".js", ".mjs"]) {
          const f = fp + ext;
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
const { detailPass, DETAIL_STRONG, DETAIL_SOFT } = await import(
  "../src/utils/graphics/detailPass.ts"
);
const { createGrid, hexToRgb } = await import(
  "../src/utils/graphics/pixelArt.ts"
);

// --- sample set (fixed — IDENTICAL to generate-art-style-samples.mjs) -----
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

const PICKAXE_THEMES = [
  { head: "#9aa5b1", glow: "#d9e2ec", handle: "#8a5a2b" }, // steel
  { head: "#e8c33d", glow: "#fff3b0", handle: "#8a5a2b" }, // gold
  { head: "#5ad8e8", glow: "#d0fbff", handle: "#3a2f5a" }, // crystal
  { head: "#4a4a5a", glow: "#9a7fd0", handle: "#2a2233" }, // shadow
];

const BG = "#232733"; // same neutral dark slate as the art-style sheets
const SHEET_W = 340;
const SHEET_H = 184;

// --- grid helpers (same shape as generate-art-style-samples.mjs) ----------

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

function sheet(w, h) {
  const g = createGrid(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) g[y][x] = BG;
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

/** Compose the identical sample set into one sheet (flat when opts=null). */
function composeSheet(opts) {
  const p = (g) => (opts == null ? g : detailPass(g, opts));
  const s = sheet(SHEET_W, SHEET_H);
  const row1x = 30; // centered: (340 - (4*64 + 3*8)) / 2
  LOOKS.forEach((look, i) => {
    place(s, scaleGrid(p(buildMinerGrid(look)), 4), row1x + i * 72, 12);
  });
  const row2x = 26;
  PICKAXE_THEMES.forEach((theme, i) => {
    place(s, scaleGrid(p(buildPickaxeGrid(theme)), 3), row2x + i * 54, 88);
  });
  place(s, scaleGrid(p(buildGemGrid()), 3), row2x + 4 * 54 - 18 + 6, 88 + 6);
  place(
    s,
    scaleGrid(p(buildMineralChunkGrid()), 3),
    row2x + 4 * 54 + 6,
    88 + 6,
  );
  // One full cave row (336px wide) at 1× — Deep Grotto tint, centered.
  place(s, p(buildCaveRow(1, 0, "#8fa8b8")), (SHEET_W - 336) / 2, 148);
  return s;
}

/** The classic miner at 8×, flat / detailed / detailed-soft, side by side. */
function composeZoom() {
  const s = sheet(440, 152);
  const passList = [null, DETAIL_STRONG, DETAIL_SOFT];
  passList.forEach((opts, i) => {
    const grid = buildMinerGrid(LOOKS[0]);
    const g = opts == null ? grid : detailPass(grid, opts);
    place(s, scaleGrid(g, 8), 12 + i * 144, 12);
  });
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
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x8a]),
    makeChunk("IHDR", ihdr),
    makeChunk("IDAT", idat),
    makeChunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- render the sheets -----------------------------------------------------

const outDir = path.join(process.cwd(), "docs", "art-detail", "samples");
mkdirSync(outDir, { recursive: true });
const sheets = [
  ["flat", null],
  ["detailed", DETAIL_STRONG],
  ["detailed-soft", DETAIL_SOFT],
];
for (const [name, opts] of sheets) {
  const file = path.join(outDir, `${name}.png`);
  writeFileSync(file, gridToPngBuffer(composeSheet(opts)));
  console.log(`wrote ${path.relative(process.cwd(), file)}`);
}
const zoomFile = path.join(outDir, "zoom.png");
writeFileSync(zoomFile, gridToPngBuffer(composeZoom()));
console.log(`wrote ${path.relative(process.cwd(), zoomFile)}`);
console.log(`done — 4 sheets in docs/art-detail/samples/`);
