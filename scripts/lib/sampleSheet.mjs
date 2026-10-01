/**
 * Shared helpers for the art draft contact-sheet scripts (scripts/
 * generate-*-samples.mjs). Dependency-free on purpose: the sheets are a
 * dev-only artifact, so this stays plain JS with no import of the app's
 * TypeScript (the generators reach src/utils/graphics/* through their own
 * type-stripping resolve hook).
 *
 * Grids follow the app's convention: grid[y][x] is a "#rrggbb" string or
 * null for transparent.
 */
import zlib from "node:zlib";

/** A new grid filled with `fill` (null by default). */
export function blankGrid(width, height, fill = null) {
  return Array.from({ length: height }, () =>
    Array.from({ length: width }, () => fill),
  );
}

/** Nearest-neighbor upscale by an integer factor. */
export function scaleGrid(grid, k) {
  const h = grid.length * k;
  const w = grid[0].length * k;
  const out = blankGrid(w, h);
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

/** Composite `grid` onto `base` at (x, y); null pixels stay transparent. */
export function place(base, grid, x, y) {
  for (let ry = 0; ry < grid.length; ry++) {
    for (let rx = 0; rx < grid[0].length; rx++) {
      const c = grid[ry][rx];
      if (c != null && c !== "") base[y + ry][x + rx] = c;
    }
  }
}

function crc32(bytes) {
  let c = ~0;
  for (let i = 0; i < bytes.length; i++) {
    c ^= bytes[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function hexToRgb(hex) {
  const h = hex.startsWith("#") ? hex.slice(1) : hex;
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/**
 * Encode a grid as a PNG buffer (RGBA8, filter 0, zlib deflate — real
 * compression, unlike the app's capped single-stored-block encoder).
 */
export function gridToPngBuffer(grid) {
  const h = grid.length;
  const w = grid[0].length;
  const stride = 1 + w * 4;
  const raw = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    raw[y * stride] = 0; // filter: None
    for (let x = 0; x < w; x++) {
      const o = y * stride + 1 + x * 4;
      const c = grid[y][x];
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
      u32(crc32(Buffer.concat([Buffer.from(type, "ascii"), data]))),
    ]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    makeChunk("IHDR", ihdr),
    makeChunk("IDAT", idat),
    makeChunk("IEND", Buffer.alloc(0)),
  ]);
}

