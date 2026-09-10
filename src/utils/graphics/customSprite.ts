/**
 * Custom-skin image pipeline (todo: "one time purchase that enables
 * custom skinning"): turn a user-picked image file into a 16×16 PixelGrid
 * the game renders as the miner body or pickaxe sprite.
 *
 * Both platforms funnel into ONE decode path (pngBytesToGrid):
 *  - **native**: the picked file's raw bytes (PNG only — mobile pickers
 *    may return other formats, but only PNG is decodable without a native
 *    image decoder; anything else is rejected and the caller toasts);
 *  - **web**: the picked file (any format — drawImage handles it) is
 *    downscaled onto a 16×16 canvas and re-encoded as PNG (toBlob), so
 *    the SAME decoder runs on every platform.
 *
 * The decoder is pure JS (pako inflate for IDAT + the PNG scanline
 * unfilter) so it runs identically on Hermes, JSC, and Node (tests).
 * Only 8-bit, non-interlaced, color types 0/2/4/6 are accepted —
 * everything else (16-bit depth, palette PNGs, interlaced, trivial
 * alpha) is rejected rather than half-decoded.
 */
import { inflate } from "pako";
import type { PixelGrid, Pixel } from "./pixelArt";

/** The sprite size every custom skin is resampled to (miner/pickaxe
 *  sprites are 16×16 — buildMinerGrid/buildPickaxeGrid). */
export const CUSTOM_SPRITE_SIZE = 16;

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * Decode a user image's PNG bytes into a 16×16 grid (box-averaged,
 * premultiplied) carrying the image's own colors (per-pixel hex — no
 * palette quantization; the sprite IS the player's upload). Returns
 * null (never throws) for anything that is not a decodable PNG: wrong
 * magic, unsupported depth/color type/interlace, truncated chunks, or a
 * corrupt deflate stream — the caller toasts and keeps going.
 */
export function pngBytesToGrid(bytes: Uint8Array): PixelGrid | null {
    const rgba = pngBytesToRgba(bytes);
    if (rgba == null) return null;
    return rgbaToGrid(rgba.data, rgba.width, rgba.height);
}

/**
 * Raw RGBA pixels (e.g. a canvas' getImageData on web, or a test fixture)
 * → 16×16 grid. The box average accumulates premultiplied (r·a, g·a, b·a,
 * a) and divides by the summed alpha, which keeps transparent fringes
 * from baking in black edges. Pixels whose average alpha is < 128 are
 * dropped (null) so the sprite stays transparent where the image was.
 */
export function rgbaToGrid(
    rgba: Uint8Array | Uint8ClampedArray,
    width: number,
    height: number,
): PixelGrid {
    const n = CUSTOM_SPRITE_SIZE;
    const grid: PixelGrid = Array.from({ length: n }, () => {
        const row: Pixel[] = new Array(n);
        for (let i = 0; i < n; i++) row[i] = null;
        return row;
    });
    if (width <= 0 || height <= 0) return grid;
    const sx = width / n;
    const sy = height / n;
    for (let gy = 0; gy < n; gy++) {
        const y0 = Math.floor(gy * sy);
        const y1 = Math.min(
            height,
            Math.max(y0 + 1, Math.floor((gy + 1) * sy)),
        );
        for (let gx = 0; gx < n; gx++) {
            const x0 = Math.floor(gx * sx);
            const x1 = Math.min(
                width,
                Math.max(x0 + 1, Math.floor((gx + 1) * sx)),
            );
            let aSum = 0;
            let ra = 0;
            let ga = 0;
            let ba = 0;
            let count = 0;
            for (let y = y0; y < y1; y++) {
                for (let x = x0; x < x1; x++) {
                    const o = (y * width + x) * 4;
                    const a = rgba[o + 3];
                    aSum += a;
                    ra += rgba[o] * a;
                    ga += rgba[o + 1] * a;
                    ba += rgba[o + 2] * a;
                    count++;
                }
            }
            if (count === 0 || aSum / count < 128) continue; // transparent cell
            grid[gy][gx] =
                "#" + toHex(ra / aSum) + toHex(ga / aSum) + toHex(ba / aSum);
        }
    }
    return grid;
}

function toHex(v: number): string {
    const c = Math.max(0, Math.min(255, Math.round(v)));
    return c.toString(16).padStart(2, "0");
}

// ---------------------------------------------------------------------------
// PNG decode (8-bit, non-interlaced, color types 0/2/4/6)
// ---------------------------------------------------------------------------

type RgbaImage = { data: Uint8Array; width: number; height: number };

/** Parse + inflate + unfilter a PNG into straight RGBA. Returns null for
 *  any malformed/unsupported input (the caller toasts "use a plain PNG"). */
export function pngBytesToRgba(bytes: Uint8Array): RgbaImage | null {
    if (!isPng(bytes)) return null;
    let width = 0;
    let height = 0;
    const idat: number[] = [];
    let sawIhdr = false;
    let off = PNG_MAGIC.length;
    while (off + 8 <= bytes.length) {
        const len = readU32be(bytes, off);
        const type = String.fromCharCode(
            bytes[off + 4],
            bytes[off + 5],
            bytes[off + 6],
            bytes[off + 7],
        );
        const dataStart = off + 8;
        const dataEnd = dataStart + len;
        if (dataEnd > bytes.length) return null; // truncated chunk
        if (type === "IHDR") {
            if (sawIhdr || len < 13) return null;
            sawIhdr = true;
            width = readU32be(bytes, dataStart);
            height = readU32be(bytes, dataStart + 4);
            const bitDepth = bytes[dataStart + 8];
            const colorType = bytes[dataStart + 9];
            const interlace = bytes[dataStart + 12];
            if (
                width <= 0 ||
                height <= 0 ||
                bitDepth !== 8 ||
                interlace !== 0 ||
                !isSupportedColorType(colorType)
            ) {
                return null;
            }
        } else if (type === "IDAT") {
            for (let i = dataStart; i < dataEnd; i++) idat.push(bytes[i]);
        } else if (type === "IEND") {
            break;
        }
        // Ancillary chunks (gAMA, tEXt, …) are skipped.
        off = dataEnd + 4; // +4: the chunk's own CRC
    }
    if (!sawIhdr || idat.length === 0) return null;
    let raw: Uint8Array;
    try {
        raw = inflate(new Uint8Array(idat));
    } catch {
        return null; // corrupt / non-deflate IDAT
    }
    return unfilterToRgba(raw, width, height);
}

function isPng(bytes: Uint8Array): boolean {
    if (bytes.length < PNG_MAGIC.length) return false;
    return PNG_MAGIC.every((b, i) => bytes[i] === b);
}

function isSupportedColorType(colorType: number): boolean {
    // 0 gray, 2 RGB, 4 gray+alpha, 6 RGBA. Palette (3) and trivial alpha (5)
    // are rejected on purpose — palette expansion needs PLTE and trivial
    // alpha is not a real skin source.
    return (
        colorType === 0 || colorType === 2 || colorType === 4 || colorType === 6
    );
}

/**
 * PNG scanline unfilter (filters 0–4) at the BYTE level into a flat
 * channel buffer, then a second pass expands the channels to straight
 * RGBA. Returns null when the raw data can't cover the declared size.
 *
 * The unfilter is the classic sequential PNG reconstruction: each row is
 * rebuilt from the LEFT (same row) and the UP / UP-LEFT (PREVIOUS row)
 * bytes, and both predictor sources must be RECONSTRUCTED values — the
 * previous row is read back from the output buffer, never from the raw
 * (still-filtered) input, or every row filtered 2/3/4 against a filtered
 * row above would come out corrupted.
 */
function unfilterToRgba(
    raw: Uint8Array,
    width: number,
    height: number,
): RgbaImage | null {
    // The total raw length must be (width*channels + 1) * height for some
    // channels in {1,2,3,4} (the filter byte prefixes every row). We do
    // not carry the IHDR color type through: only these four channel
    // counts are legal for the accepted types, so the row length pins it.
    let channels = -1;
    for (const c of [1, 2, 3, 4]) {
        if (raw.length === (width * c + 1) * height) {
            channels = c;
            break;
        }
    }
    if (channels < 0) return null;
    const stride = width * channels;
    const buf = new Uint8Array(width * height * channels);
    for (let y = 0; y < height; y++) {
        const filter = raw[y * (stride + 1)];
        const rowStart = y * (stride + 1) + 1;
        if (filter > 4) return null;
        for (let x = 0; x < stride; x++) {
            const v = raw[rowStart + x];
            const a = x >= channels ? buf[y * stride + x - channels] : 0; // left (reconstructed)
            const b = y > 0 ? buf[(y - 1) * stride + x] : 0; // up (reconstructed)
            const c =
                y > 0 && x >= channels
                    ? buf[(y - 1) * stride + x - channels]
                    : 0; // up-left (reconstructed)
            let d = 0;
            if (filter === 1) d = a;
            else if (filter === 2) d = b;
            else if (filter === 3) d = (a + b) >> 1;
            else if (filter === 4) d = paeth(a, b, c);
            buf[y * stride + x] = (v + d) & 0xff;
        }
    }
    const out = new Uint8Array(width * height * 4);
    for (let i = 0; i < width * height; i++) {
        const o = i * channels;
        const p = i * 4;
        if (channels === 1) {
            out[p] = buf[o];
            out[p + 1] = buf[o];
            out[p + 2] = buf[o];
            out[p + 3] = 255;
        } else if (channels === 2) {
            out[p] = buf[o];
            out[p + 1] = buf[o];
            out[p + 2] = buf[o];
            out[p + 3] = buf[o + 1];
        } else if (channels === 3) {
            out[p] = buf[o];
            out[p + 1] = buf[o + 1];
            out[p + 2] = buf[o + 2];
            out[p + 3] = 255;
        } else {
            out[p] = buf[o];
            out[p + 1] = buf[o + 1];
            out[p + 2] = buf[o + 2];
            out[p + 3] = buf[o + 3];
        }
    }
    return { data: out, width, height };
}

function readU32be(bytes: Uint8Array, off: number): number {
    return (
        ((bytes[off] << 24) |
            ((bytes[off + 1] & 0xff) << 16) |
            ((bytes[off + 2] & 0xff) << 8) |
            (bytes[off + 3] & 0xff)) >>>
        0
    );
}

/** PNG Paeth predictor. */
function paeth(a: number, b: number, c: number): number {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    if (pb <= pc) return b;
    return c;
}
