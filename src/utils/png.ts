/**
 * Minimal 8-bit RGBA PNG encoder (no dependencies beyond pako for the
 * DEFLATE/CRC primitives — pako is the battle-tested JS zlib, so the
 * output is spec-correct without hand-rolled inflate code).
 *
 * Used by the share-badge feature (mines_of_doom/shareBadge.ts) to turn
 * a raw RGBA pixel buffer into a shareable PNG on every platform — the
 * badge pixels are rendered by pure TS, this module is the only byte
 * format involved.
 */
import { deflate, inflate } from "pako";

/** CRC-32 (IEEE 802.3 — the PNG variant: init/xorout 0xFFFFFFFF). */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

/** One 32-bit big-endian value as 4 bytes. */
function be32(n: number): Uint8Array {
  const out = new Uint8Array(4);
  out[0] = (n >>> 24) & 0xff;
  out[1] = (n >>> 16) & 0xff;
  out[2] = (n >>> 8) & 0xff;
  out[3] = n & 0xff;
  return out;
}

/** PNG chunk: 4-byte length, type, data, CRC32 over (type + data). */
function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  out.set(be32(data.length), 0);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  out.set(be32(crc32(out.subarray(4, 8 + data.length)) >>> 0), 8 + data.length);
  return out;
}

/**
 * Encode an RGBA buffer (width*height*4 bytes, row-major) as a PNG file
 * byte string. Filter type 0 (None) is used on every scanline — simple
 * and universally decodable; pako's DEFLATE does the real compression.
 */
export function encodePng(
  width: number,
  height: number,
  rgba: Uint8Array,
): Uint8Array {
  if (width <= 0 || height <= 0) throw new Error("bad dimensions");
  if (rgba.length !== width * height * 4) {
    throw new Error("rgba buffer size does not match dimensions");
  }

  // Raw scanlines, each prefixed with its filter byte (0 = None).
  const raw = new Uint8Array(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0;
    raw.set(
      rgba.subarray(y * width * 4, (y + 1) * width * 4),
      y * (1 + width * 4) + 1,
    );
  }

  const ihdr = new Uint8Array(13);
  ihdr.set(be32(width), 0);
  ihdr.set(be32(height), 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  // 10 = compression (0), 11 = filter (0), 12 = interlace (0): all zero.

  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const idat = chunk("IDAT", deflate(raw));
  const head = chunk("IHDR", ihdr);
  const tail = chunk("IEND", new Uint8Array(0));

  const out = new Uint8Array(
    signature.length + head.length + idat.length + tail.length,
  );
  let off = 0;
  for (const part of [signature, head, idat, tail]) {
    out.set(part, off);
    off += part.length;
  }
  return out;
}

/** Decode helper for the unit tests (pako-based, filter type 0 only). */
export function decodePngForTest(
  png: Uint8Array,
): { width: number; height: number; rgba: Uint8Array } {
  const sig = png.subarray(0, 8);
  const expected = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) if (sig[i] !== expected[i]) throw new Error("bad signature");
  let off = 8;
  let width = 0;
  let height = 0;
  const idat: Uint8Array[] = [];
  while (off < png.length) {
    const len =
      (png[off] << 24) | (png[off + 1] << 16) | (png[off + 2] << 8) | png[off + 3];
    const type = String.fromCharCode(png[off + 4], png[off + 5], png[off + 6], png[off + 7]);
    const data = png.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") {
      width = data[0] << 24 | data[1] << 16 | data[2] << 8 | data[3];
      height = data[4] << 24 | data[5] << 16 | data[6] << 8 | data[7];
      if (data[8] !== 8 || data[9] !== 6) throw new Error("unexpected IHDR format");
    } else if (type === "IDAT") {
      idat.push(data);
    }
    off += 12 + len;
  }
  const joined = new Uint8Array(idat.reduce((n, d) => n + d.length, 0));
  let j = 0;
  for (const d of idat) {
    joined.set(d, j);
    j += d.length;
  }
  const raw = inflate(joined);
  const stride = 1 + width * 4;
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    if (raw[y * stride] !== 0) throw new Error("unsupported filter byte");
    rgba.set(raw.subarray(y * stride + 1, y * stride + 1 + width * 4), y * width * 4);
  }
  return { width, height, rgba };
}
