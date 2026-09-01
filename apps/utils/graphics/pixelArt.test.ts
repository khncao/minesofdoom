import {
  adler32,
  buildMinerGrid,
  crc32,
  gridToPngDataUri,
  hashSeed,
  minerSpriteUri,
  mulberry32,
  pickaxeSpriteUri,
} from "./pixelArt";

const PREFIX = "data:image/png;base64,";

/** Minimal PNG reader for the stored-block images this module emits. */
function decodePng(dataUri: string) {
  expect(dataUri.startsWith(PREFIX)).toBe(true);
  // Base64-decode without Buffer (web parity): same alphabet as the encoder.
  const b64 = dataUri.slice(PREFIX.length);
  const map: Record<string, number> = {};
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  for (let i = 0; i < alphabet.length; i++) map[alphabet[i]] = i;
  const bytes: number[] = [];
  for (let i = 0; i < b64.length; i += 4) {
    const a = map[b64[i]];
    const b = map[b64[i + 1]];
    const c = b64[i + 2] === "=" ? -1 : map[b64[i + 2]];
    const d = b64[i + 3] === "=" ? -1 : map[b64[i + 3]];
    bytes.push((a << 2) | (b >> 4));
    if (c !== -1) bytes.push(((b & 15) << 4) | (c >> 2));
    if (d !== -1) bytes.push(((c & 3) << 6) | d);
  }
  const buf = new Uint8Array(bytes);

  // Signature
  expect([...buf.subarray(0, 8)]).toEqual([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);

  const chunks: Array<{ type: string; data: Uint8Array }> = [];
  let off = 8;
  while (off < buf.length) {
    const len = buf[off] << 24 | buf[off + 1] << 16 | buf[off + 2] << 8 | buf[off + 3];
    const type = String.fromCharCode(
      buf[off + 4], buf[off + 5], buf[off + 6], buf[off + 7],
    );
    const data = buf.subarray(off + 8, off + 8 + len);
    const crc = buf[off + 8 + len] << 24 | buf[off + 9 + len] << 16 | buf[off + 10 + len] << 8 | buf[off + 11 + len];
    // Independent CRC check: recompute over type + data.
    const crcInput = new Uint8Array([...type.split("").map((c) => c.charCodeAt(0)), ...data]);
    expect(crc32(crcInput)).toBe(crc >>> 0);
    chunks.push({ type, data });
    off += 12 + len;
  }

  expect(chunks.map((c) => c.type)).toEqual(["IHDR", "IDAT", "IEND"]);
  const ihdr = chunks[0].data;
  const width = ihdr[0] << 24 | ihdr[1] << 16 | ihdr[2] << 8 | ihdr[3];
  const height = ihdr[4] << 24 | ihdr[5] << 16 | ihdr[6] << 8 | ihdr[7];
  expect([ihdr[8], ihdr[9], ihdr[10], ihdr[11], ihdr[12]]).toEqual([8, 6, 0, 0, 0]);

  // IDAT: zlib header (0x78 0x01) + one stored block (final, type 00) + ADLER32.
  const idat = chunks[1].data;
  expect([idat[0], idat[1]]).toEqual([0x78, 0x01]);
  expect(idat[2] & 1).toBe(1); // BFINAL
  expect((idat[2] >> 1) & 3).toBe(0); // BTYPE: stored
  const len = idat[3] | (idat[4] << 8);
  const nlen = idat[5] | (idat[6] << 8);
  expect(nlen).toBe((~len & 0xffff) >>> 0);
  const raw = idat.subarray(7, 7 + len);
  const adler =
    (idat[7 + len] << 24) |
    (idat[8 + len] << 16) |
    (idat[9 + len] << 8) |
    idat[10 + len];
  expect(adler32(raw)).toBe(adler >>> 0);
  expect(idat.length).toBe(11 + len);

  expect(height * (1 + width * 4)).toBe(raw.length);
  const px = (x: number, y: number): number[] => {
    const o = y * (1 + 4 * width) + 1 + x * 4;
    return [raw[o], raw[o + 1], raw[o + 2], raw[o + 3]];
  };
  return { width, height, px };
}

describe("PRNG", () => {
  test("mulberry32 is deterministic and in [0, 1)", () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    for (let i = 0; i < 100; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  test("different seeds give different sequences", () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });

  test("hashSeed is deterministic, unsigned 32-bit, salt-sensitive", () => {
    expect(hashSeed(42, 7)).toBe(hashSeed(42, 7));
    const s = hashSeed(42, 7);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(0xffffffff);
    expect(hashSeed(42, 8)).not.toBe(s);
    expect(hashSeed(43, 7)).not.toBe(s);
  });
});

describe("checksums", () => {
  test("crc32 matches the standard test vector", () => {
    // CRC-32 of ASCII "123456789" is 0xCBF43926 (the polynomial's check value).
    const input = new Uint8Array("123456789".split("").map((c) => c.charCodeAt(0)));
    expect(crc32(input)).toBe(0xcbf43926);
  });

  test("adler32 matches the standard test vector", () => {
    // Adler-32 of ASCII "Wikipedia" is 0x11E60398.
    const input = new Uint8Array("Wikipedia".split("").map((c) => c.charCodeAt(0)));
    expect(adler32(input)).toBe(0x11e60398);
  });
});

describe("gridToPngDataUri", () => {
  const look = {
    skin: "#f2c9a0",
    shirt: "#e8a33d",
    pants: "#3b4a6b",
    boots: "#4a3524",
    hat: "#e8c33d",
    hatStyle: "helmet" as const,
  };

  test("encodes a valid, fully-specified PNG with correct pixels", () => {
    const { width, height, px } = decodePng(gridToPngDataUri(buildMinerGrid(look)));
    expect(width).toBe(16);
    expect(height).toBe(16);
    // hat (helmet crown), eye, shirt, transparent corner
    expect(px(6, 0)).toEqual([0xe8, 0xc3, 0x3d, 255]);
    expect(px(6, 4)).toEqual([0x1a, 0x1a, 0x1a, 255]);
    expect(px(7, 9)).toEqual([0xe8, 0xa3, 0x3d, 255]);
    expect(px(0, 0)).toEqual([0, 0, 0, 0]);
  });

  test("small grids also encode", () => {
    const { width, height, px } = decodePng(
      gridToPngDataUri([["#ff0000", null], [null, "#00ff00"]]),
    );
    expect(width).toBe(2);
    expect(height).toBe(2);
    expect(px(0, 0)).toEqual([255, 0, 0, 255]);
    expect(px(1, 1)).toEqual([0, 255, 0, 255]);
  });

  test("rejection of over-large sprites", () => {
    const big = Array.from({ length: 1 }, () =>
      Array.from({ length: 20000 }, () => "#ffffff" as string | null),
    );
    expect(() => gridToPngDataUri(big)).toThrow();
  });
});

describe("sprite URIs", () => {
  const lookA = {
    skin: "#f2c9a0", shirt: "#e8a33d", pants: "#3b4a6b",
    boots: "#4a3524", hat: "#e8c33d", hatStyle: "helmet" as const,
  };
  const lookB = { ...lookA, shirt: "#d9534f" };

  test("minerSpriteUri is cached (same look -> same string)", () => {
    expect(minerSpriteUri(lookA)).toBe(minerSpriteUri(lookA));
    expect(minerSpriteUri(lookA)).not.toBe(minerSpriteUri(lookB));
  });

  test("pickaxeSpriteUri is cached and theme-sensitive", () => {
    const steel = { head: "#9aa5b1", glow: "#d9e2ec", handle: "#8a5a2b" };
    const gold = { head: "#e8c33d", glow: "#fff3b0", handle: "#8a5a2b" };
    expect(pickaxeSpriteUri(steel)).toBe(pickaxeSpriteUri(steel));
    expect(pickaxeSpriteUri(steel)).not.toBe(pickaxeSpriteUri(gold));
    decodePng(pickaxeSpriteUri(steel)); // still a valid PNG
  });

  test("every hat style builds a 16x16 grid with a hat on it", () => {
    for (const hatStyle of ["helmet", "beanie", "cap", "bandana"] as const) {
      const grid = buildMinerGrid({ ...lookA, hatStyle });
      expect(grid.length).toBe(16);
      expect(grid[0].length).toBe(16);
      const hasHat = grid.slice(0, 4).some((row) => row.includes(lookA.hat));
      expect(hasHat).toBe(true);
    }
  });
});
