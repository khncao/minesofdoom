#!/usr/bin/env node
/**
 * Draw the deep-mole sprite (the library's ninth entry) as a 16×16 pixel
 * grid scaled 8× to the 128×128 PNG the library expects, then regenerate
 * the in-repo data-URI module via generate-sprite-library.mjs.
 *
 * Original art, authored in-repo for this game and dedicated to the public
 * domain (CC0) — see public/assets/sprites/CREDITS.txt. (An earlier draft of
 * this entry used a FreeGameSprites pick, but that asset rotated out of the
 * source catalog before the entry landed, so the sprite was redrawn here
 * rather than vendoring a dead URL.)
 *
 * Deterministic: the grid is literal, the scale is fixed, so the PNG is
 * byte-stable across runs. Re-run after touching the grid below.
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";
const { crc32, hexToRgb } = await import("../src/utils/graphics/pixelArt.ts");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_PNG = path.join(ROOT, "public/assets/sprites/deep-mole.png");

// --- palette ---------------------------------------------------------------
const B = "#8b5a2b"; // body brown
const D = "#5c3a1e"; // dark brown (outline, feet)
const E = "#1c120b"; // eyes
const N = "#d9a066"; // nose
const G = "#9aa0a6"; // pickaxe head
const H = "#b08a5a"; // pickaxe handle

// --- the 16×16 grid (16 columns; the mole with a pickaxe at its right side)
const ART = [
  "................", // y0
  "............GGGG", // y1  pickaxe head
  "...DDDDDDD..H...", // y2
  "..DBBBBBBD..H...", // y3
  ".DBBBBBBBBD.H...", // y4
  ".DBEEBBEEBD.H...", // y5  eyes
  ".DBBNNNNBBBD.H..", // y6  nose
  ".DBBBBBBBBD.H...", // y7
  "..DBBBBBBD..H...", // y8  handle ends
  "..DBBBBBBD......", // y9
  ".DBBBBBBBBD.....", // y10
  ".DBBBBBBBBD.....", // y11
  "..DBBBBBBD......", // y12
  "...DBBBBBD......", // y13
  "....DD..DD......", // y14  feet
  "................", // y15
];

if (ART.length !== 16 || ART.some((row) => row.length !== 16)) {
  throw new Error("the art grid must be exactly 16×16");
}
const CHARS = new Set(["B", "D", "E", "N", "G", "H", "."]);
for (const row of ART) {
  for (const c of row) {
    if (!CHARS.has(c)) throw new Error(`unknown grid char: ${c}`);
  }
}
const MAP = { B, D, E, N, G, H, ".": null };

// --- 8× nearest-neighbor scale to the 128×128 the library expects ---------
const SCALE = 8;
const full = ART.map((row) => row.split("").map((c) => MAP[c]));
const scaled = Array.from({ length: full.length * SCALE }, () =>
  Array.from({ length: full[0].length * SCALE }, () => null),
);
for (let y = 0; y < full.length; y++) {
  for (let x = 0; x < full[0].length; x++) {
    for (let dy = 0; dy < SCALE; dy++) {
      for (let dx = 0; dx < SCALE; dx++) {
        scaled[y * SCALE + dy][x * SCALE + dx] = full[y][x];
      }
    }
  }
}

// --- minimal PNG writer (same pattern as the contact-sheet scripts) --------
function gridToPngBuffer(g) {
  const h = g.length;
  const w = g[0].length;
  const stride = 1 + w * 4;
  const raw = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    raw[y * stride] = 0; // filter: None
    for (let x = 0; x < w; x++) {
      const c = g[y][x];
      const o = y * stride + 1 + x * 4;
      if (c == null) {
        raw.fill(0, o, o + 4);
      } else {
        const [r, gg, b] = hexToRgb(c);
        raw[o] = r;
        raw[o + 1] = gg;
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

const buf = gridToPngBuffer(scaled);
writeFileSync(OUT_PNG, buf);
console.log(`wrote ${path.relative(ROOT, OUT_PNG)} (${buf.length} bytes)`);
