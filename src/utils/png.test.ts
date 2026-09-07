/**
 * PNG encoder tests (utils/png.ts): round-trip via the in-repo test
 * decoder, an INDEPENDENT inflate with Node's zlib (a different
 * DEFLATE implementation than pako — catches pako misuse), and the
 * binary layout (signature, chunk types, CRC).
 */
import * as nodeZlib from "zlib";
import { decodePngForTest, encodePng } from "./png";

/** Minimal chunk walk: returns { ihdr, idat, iend } raw chunk payloads. */
function walkChunks(
  png: Uint8Array,
): { ihdr: Uint8Array; idat: Uint8Array[]; iendSeen: boolean } {
  expect(Array.from(png.subarray(0, 8))).toEqual([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  let off = 8;
  const out = { ihdr: undefined as unknown as Uint8Array, idat: [] as Uint8Array[], iendSeen: false };
  while (off < png.length) {
    const len =
      (png[off] << 24) | (png[off + 1] << 16) | (png[off + 2] << 8) | png[off + 3];
    const type = String.fromCharCode(png[off + 4], png[off + 5], png[off + 6], png[off + 7]);
    const data = png.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") out.ihdr = data;
    else if (type === "IDAT") out.idat.push(data);
    else if (type === "IEND") out.iendSeen = true;
    off += 12 + len;
  }
  return out;
}

describe("encodePng", () => {
  it("round-trips a gradient image through the test decoder", () => {
    const w = 7;
    const h = 5;
    const rgba = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        rgba[i] = x * 37;
        rgba[i + 1] = y * 50;
        rgba[i + 2] = (x * y) % 256;
        rgba[i + 3] = 255;
      }
    }
    const png = encodePng(w, h, rgba);
    const decoded = decodePngForTest(png);
    expect(decoded.width).toBe(w);
    expect(decoded.height).toBe(h);
    expect(Array.from(decoded.rgba)).toEqual(Array.from(rgba));
  });

  it("writes a valid layout: signature, IHDR fields, IDAT, IEND", () => {
    const png = encodePng(2, 2, new Uint8Array(2 * 2 * 4));
    const { ihdr, idat, iendSeen } = walkChunks(png);
    expect(ihdr.length).toBe(13);
    expect(ihdr[0] << 24 | ihdr[1] << 16 | ihdr[2] << 8 | ihdr[3]).toBe(2);
    expect(ihdr[4] << 24 | ihdr[5] << 16 | ihdr[6] << 8 | ihdr[7]).toBe(2);
    expect(ihdr[8]).toBe(8); // bit depth
    expect(ihdr[9]).toBe(6); // color type RGBA
    expect(idat.length).toBeGreaterThan(0);
    expect(iendSeen).toBe(true);
  });

  it("IDAT inflates (with Node's zlib, NOT pako) to filter-prefixed scanlines", () => {
    const w = 4;
    const h = 3;
    const rgba = new Uint8Array(w * h * 4).map((_, i) => i);
    const png = encodePng(w, h, rgba);
    const { idat } = walkChunks(png);
    const joined = new Uint8Array(idat.reduce((n, d) => n + d.length, 0));
    let j = 0;
    for (const d of idat) {
      joined.set(d, j);
      j += d.length;
    }
    const raw = nodeZlib.inflateSync(Buffer.from(joined));
    const stride = 1 + w * 4;
    for (let y = 0; y < h; y++) {
      expect(raw[y * stride]).toBe(0); // filter type None
      for (let x = 0; x < w; x++) {
        for (let c = 0; c < 4; c++) {
          expect(raw[y * stride + 1 + x * 4 + c]).toBe(rgba[y * w * 4 + x * 4 + c]);
        }
      }
    }
  });

  it("is deterministic and small for flat colors", () => {
    const flat = new Uint8Array(100 * 60 * 4).fill(255);
    flat[0] = 10;
    flat[1] = 20;
    flat[2] = 30;
    flat[3] = 255;
    const a = encodePng(100, 60, flat);
    const b = encodePng(100, 60, flat);
    expect(Array.from(a)).toEqual(Array.from(b));
    expect(a.length).toBeLessThan(5000);
  });

  it("rejects bad sizes and mismatched buffers", () => {
    expect(() => encodePng(0, 1, new Uint8Array(4))).toThrow();
    expect(() => encodePng(2, 2, new Uint8Array(3))).toThrow();
  });
});
