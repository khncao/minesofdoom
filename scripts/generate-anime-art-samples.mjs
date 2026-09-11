#!/usr/bin/env node
/**
 * Renders the draft high-resolution anime art contact sheet (todo:
 * "try completely different art styles/designs with higher resolution and
 * more details"; docs/art-anime.md).
 *
 * Two rows of the SAME three art directions at the SAME display size
 * (96 px each), so the sheet compares art direction, not content:
 *   row 1 — the new 32×32 anime chibi characters (native detail), 3×
 *   row 2 — the classic 16×16 generated sprites upscaled to the same size, 6×
 *
 * Output: docs/art-anime/samples/anime-hires.png (dark slate ground so
 * light and dark sprites judge the same, matching the art-styles sheets).
 *
 * Re-run after touching src/utils/graphics/animeArt.ts / pixelArt.ts:
 *   node scripts/generate-anime-art-samples.mjs
 *
 * Node 22.18+ runs the src/*.ts files directly (type stripping); the resolve
 * hook exists because the app's convention is extensionless relative
 * imports. The looks below are fixed (they are also the tested set in
 * animeArt.test.ts).
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

const { createGrid, hexToRgb, crc32, buildMinerGrid } = await import(
  "../src/utils/graphics/pixelArt.ts"
);
const { buildAnimeCharacterGrid, ANIME_GRID_SIZE } = await import(
  "../src/utils/graphics/animeArt.ts"
);

// The three art directions (same set the test renders). Row 1 is the anime
// look; row 2 pairs each with the classic 16×16 character closest to it.
const PAIRS = [
  {
    anime: {
      skin: "#ffe3c8",
      hair: "#ff9ecd",
      dress: "#b48cff",
      bow: "#ff5f9e",
      hairStyle: "bob",
    },
    classic: {
      skin: "#ffdbb4",
      shirt: "#b48cff",
      pants: "#3b4a6b",
      boots: "#4a3524",
      hat: "#e8c33d",
      hatStyle: "helmet",
    },
  },
  {
    anime: {
      skin: "#f2c9a0",
      hair: "#7ad0e8",
      dress: "#ffd166",
      bow: "#ef476f",
      hairStyle: "long",
    },
    classic: {
      skin: "#f2c9a0",
      shirt: "#e070a0",
      pants: "#3b4a6b",
      boots: "#333333",
      hat: "#6a4a3a",
      hatStyle: "longhair",
    },
  },
  {
    anime: {
      skin: "#ffe3c8",
      hair: "#c3b1ff",
      dress: "#8fe3c0",
      bow: "#7a5fd0",
      hairStyle: "long",
    },
    classic: {
      skin: "#e07020",
      shirt: "#3a4a5a",
      pants: "#c85a18",
      boots: "#3a2a1a",
      hat: "#e8e8e8",
      hatStyle: "bandana",
      species: "animal",
    },
  },
];

const BG = "#232733"; // dark slate (same ground as the art-styles sheets)
const CELL = 96; // display size for every sprite in both rows
const GAP = 16;
const MARGIN = 16;
const ROW_GAP = 24;
const SHEET_W = MARGIN * 2 + CELL * 3 + GAP * 2;
const SHEET_H = MARGIN * 2 + CELL * 2 + ROW_GAP;

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

function place(base, grid, x, y) {
  for (let ry = 0; ry < grid.length; ry++) {
    for (let rx = 0; rx < grid[0].length; rx++) {
      const c = grid[ry][rx];
      if (c != null) base[y + ry][x + rx] = c;
    }
  }
}

function composeSheet() {
  const s = createGrid(SHEET_W, SHEET_H);
  for (let y = 0; y < SHEET_H; y++) {
    for (let x = 0; x < SHEET_W; x++) s[y][x] = BG;
  }
  PAIRS.forEach((pair, i) => {
    const x = MARGIN + i * (CELL + GAP);
    // Row 1: anime 32×32 at 3× = 96 px.
    place(s, scaleGrid(buildAnimeCharacterGrid(pair.anime), 3), x, MARGIN);
    // Row 2: classic 16×16 at 6× = 96 px.
    place(
      s,
      scaleGrid(buildMinerGrid(pair.classic), 6),
      x,
      MARGIN + CELL + ROW_GAP,
    );
  });
  return s;
}

// --- minimal PNG writer (same convention as the sibling sample scripts) ---

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

// --- render ----------------------------------------------------------------

const outDir = path.join(process.cwd(), "docs", "art-anime", "samples");
mkdirSync(outDir, { recursive: true });
const file = path.join(outDir, "anime-hires.png");
writeFileSync(file, gridToPngBuffer(composeSheet()));
console.log(
  `wrote ${path.relative(process.cwd(), file)} (${SHEET_W}×${SHEET_H})`,
);
console.log(
  `anime grid: ${ANIME_GRID_SIZE}×${ANIME_GRID_SIZE} (2× the classic 16×16)`,
);
