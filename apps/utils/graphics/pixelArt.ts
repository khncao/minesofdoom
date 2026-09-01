/**
 * Programmatic pixel art (plan §4.5, "programmatic generation" variant):
 * sprites are defined as small color grids and encoded to PNG data URIs at
 * runtime — no asset files, no new dependencies, and `<Image>` renders them
 * identically on web/iOS/Android with zero per-frame React work (the same
 * cached image instance is reused by all roster miners of a given variant).
 */

// ---------------------------------------------------------------------------
// Seeded RNG
// ---------------------------------------------------------------------------

/** Small, fast, deterministic PRNG. Same seed => same sequence, everywhere. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic mix used to derive per-miner variant seeds from the player seed. */
export function hashSeed(seed: number, salt: number): number {
  let h = (seed ^ Math.imul(salt + 1, 0x9e3779b9)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return (h ^ (h >>> 16)) >>> 0;
}

// ---------------------------------------------------------------------------
// Pixel grids
// ---------------------------------------------------------------------------

/** Hex color, or null for transparent. */
export type Pixel = string | null;
/** grid[y][x] */
export type PixelGrid = Pixel[][];

export function createGrid(width: number, height: number): PixelGrid {
  return Array.from({ length: height }, () =>
    Array<Pixel>(width).fill(null),
  );
}

function setPixel(grid: PixelGrid, x: number, y: number, color: Pixel): void {
  if (y >= 0 && y < grid.length && x >= 0 && x < grid[0].length) {
    grid[y][x] = color;
  }
}

function hline(grid: PixelGrid, x0: number, x1: number, y: number, color: Pixel): void {
  for (let x = x0; x <= x1; x++) setPixel(grid, x, y, color);
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.startsWith("#") ? hex.slice(1) : hex;
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

// ---------------------------------------------------------------------------
// Minimal PNG encoder (RGBA8, filter 0, single stored deflate block)
// ---------------------------------------------------------------------------

const B64_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** RN/Hermes and web both expose btoa, but not every environment does — keep it dependency-free. */
export function toBase64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : -1;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : -1;
    out += B64_CHARS[b0 >> 2];
    out += B64_CHARS[((b0 & 3) << 4) | (b1 >= 0 ? b1 >> 4 : 0)];
    out += b1 >= 0 ? B64_CHARS[((b1 & 15) << 2) | (b2 >= 0 ? b2 >> 6 : 0)] : "=";
    out += b2 >= 0 ? B64_CHARS[b2 & 63] : "=";
  }
  return out;
}

let crcTable: number[] | null = null;

function getCrcTable(): number[] {
  if (crcTable == null) {
    crcTable = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      crcTable[n] = c >>> 0;
    }
  }
  return crcTable;
}

/** Adler-32 (zlib stream trailer). */
export function adler32(data: Uint8Array): number {
  const MOD = 65521;
  let a = 1;
  let b = 0;
  for (let i = 0; i < data.length; i++) {
    a = (a + data[i]) % MOD;
    b = (b + a) % MOD;
  }
  return ((b << 16) | a) >>> 0;
}

export function crc32(data: Uint8Array): number {
  const table = getCrcTable();
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    c = table[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function u32be(n: number): number[] {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
}

function concatBytes(...arrs: Array<number[] | Uint8Array>): Uint8Array {
  let total = 0;
  for (const a of arrs) total += a.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrs) {
    out.set(a as ArrayLike<number>, off);
    off += a.length;
  }
  return out;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = Array.from(type, (ch) => ch.charCodeAt(0));
  const crc = crc32(
    concatBytes(new Uint8Array(typeBytes), data),
  );
  return concatBytes(u32be(data.length), typeBytes, data, u32be(crc));
}

/**
 * Encode a grid as `data:image/png;base64,...`. The image data is a single
 * *stored* (uncompressed) deflate block — fine at this size (~1.1KB raw for
 * 16×16 RGBA) and keeps the encoder free of any zlib dependency.
 */
export function gridToPngDataUri(grid: PixelGrid): string {
  const height = grid.length;
  const width = grid[0].length;

  const ihdr = new Uint8Array([
    ...u32be(width),
    ...u32be(height),
    8, // bit depth
    6, // color type: RGBA
    0, // compression
    0, // filter
    0, // interlace
  ]);

  const raw: number[] = [];
  for (const row of grid) {
    raw.push(0); // filter byte: None
    for (const px of row) {
      if (px == null) {
        raw.push(0, 0, 0, 0);
      } else {
        const [r, g, b] = hexToRgb(px);
        raw.push(r, g, b, 255);
      }
    }
  }
  const rawBytes = new Uint8Array(raw);
  if (rawBytes.length > 65535) {
    throw new Error("Sprite too large for a single stored deflate block");
  }

  // Stored deflate block: BFINAL=1, BTYPE=00, then LEN and NLEN (~LEN) little-endian.
  const len = rawBytes.length;
  const nlen = (~len) & 0xffff;
  const adler = adler32(rawBytes);
  const idat = concatBytes(
    [0x78, 0x01, 0x01, len & 0xff, (len >> 8) & 0xff, nlen & 0xff, (nlen >> 8) & 0xff],
    rawBytes,
    u32be(adler),
  );

  const png = concatBytes(
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", new Uint8Array(0)),
  );
  return `data:image/png;base64,${toBase64(png)}`;
}

// ---------------------------------------------------------------------------
// Miner sprite
// ---------------------------------------------------------------------------

export type HatStyle = "helmet" | "beanie" | "cap" | "bandana";

export type MinerLook = {
  skin: string;
  shirt: string;
  pants: string;
  boots: string;
  hat: string;
  hatStyle: HatStyle;
};

const EYES = "#1a1a1a";
const BELT = "#2b2b2b";

/**
 * 16×16 front-facing miner. Layout (body centered on x 4..11):
 * rows 0-2 hat (style-dependent), 3-6 face, 7-10 torso (+ arms at x3/x12),
 * 11 belt, 12-13 legs, 14 boots.
 */
export function buildMinerGrid(look: MinerLook): PixelGrid {
  const g = createGrid(16, 16);
  const { skin, shirt, pants, boots, hat, hatStyle } = look;

  // Face / head
  hline(g, 5, 10, 3, skin);
  hline(g, 5, 10, 4, skin);
  setPixel(g, 6, 4, EYES);
  setPixel(g, 9, 4, EYES);
  hline(g, 5, 10, 5, skin);
  hline(g, 5, 10, 6, skin);

  // Torso
  hline(g, 5, 10, 7, shirt);
  hline(g, 4, 11, 8, shirt);
  hline(g, 4, 11, 9, shirt);
  hline(g, 4, 11, 10, shirt);
  // Arms / hands
  setPixel(g, 3, 9, skin);
  setPixel(g, 3, 10, skin);
  setPixel(g, 12, 9, skin);
  setPixel(g, 12, 10, skin);
  // Belt
  hline(g, 4, 11, 11, BELT);
  // Legs + boots
  hline(g, 5, 6, 12, pants);
  hline(g, 9, 10, 12, pants);
  hline(g, 5, 6, 13, pants);
  hline(g, 9, 10, 13, pants);
  hline(g, 4, 6, 14, boots);
  hline(g, 9, 11, 14, boots);

  // Hat (style-dependent crown + brim)
  switch (hatStyle) {
    case "helmet":
      hline(g, 6, 9, 0, hat);
      hline(g, 4, 11, 1, hat);
      hline(g, 3, 12, 2, hat); // wide brim
      break;
    case "beanie":
      hline(g, 6, 9, 0, hat);
      hline(g, 5, 10, 1, hat);
      hline(g, 4, 11, 2, hat); // cuff, no brim
      break;
    case "cap":
      hline(g, 6, 9, 0, hat);
      setPixel(g, 8, 0, "#ffffff"); // button
      hline(g, 5, 10, 1, hat);
      hline(g, 3, 12, 2, hat); // brim
      break;
    case "bandana":
      hline(g, 5, 10, 1, hat);
      hline(g, 4, 11, 2, hat);
      setPixel(g, 12, 2, hat); // knot
      setPixel(g, 13, 3, hat);
      break;
  }
  return g;
}

// ---------------------------------------------------------------------------
// Pickaxe sprite
// ---------------------------------------------------------------------------

export type PickaxeThemeDef = {
  /** Head (blade) color. */
  head: string;
  /** Center glint on the head. */
  glow: string;
  /** Handle color. */
  handle: string;
};

/**
 * 16×16 pickaxe: crescent head across the top rows, handle trailing down to
 * the bottom-left. Rotated by the Miner's swing animation (as before).
 */
export function buildPickaxeGrid(theme: PickaxeThemeDef): PixelGrid {
  const g = createGrid(16, 16);
  const { head, glow, handle } = theme;

  // Crescent head (opens downward)
  hline(g, 7, 8, 0, head);
  hline(g, 6, 10, 1, head);
  hline(g, 5, 11, 2, head);
  hline(g, 4, 12, 3, head);
  setPixel(g, 3, 4, head); // left tip
  setPixel(g, 12, 4, head); // right tip
  setPixel(g, 8, 1, glow);
  setPixel(g, 7, 2, glow);

  // Handle (diagonal, from under the head to bottom-left)
  for (const [x, y] of [
    [8, 5],
    [7, 6],
    [7, 7],
    [6, 8],
    [5, 9],
    [4, 10],
    [4, 11],
    [3, 12],
    [3, 13],
  ] as const) {
    setPixel(g, x, y, handle);
  }
  return g;
}

// ---------------------------------------------------------------------------
// Caching
// ---------------------------------------------------------------------------

// Data URIs are the <Image> source identity; caching keeps all miners of a
// variant sharing one string (and one decoded image).
const minerCache = new Map<string, string>();
const pickaxeCache = new Map<string, string>();

export function minerSpriteUri(look: MinerLook): string {
  const key = JSON.stringify(look);
  let uri = minerCache.get(key);
  if (uri == null) {
    uri = gridToPngDataUri(buildMinerGrid(look));
    minerCache.set(key, uri);
  }
  return uri;
}

export function pickaxeSpriteUri(theme: PickaxeThemeDef): string {
  const key = JSON.stringify(theme);
  let uri = pickaxeCache.get(key);
  if (uri == null) {
    uri = gridToPngDataUri(buildPickaxeGrid(theme));
    pickaxeCache.set(key, uri);
  }
  return uri;
}
