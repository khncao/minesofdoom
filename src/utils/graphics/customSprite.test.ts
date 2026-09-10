import { deflateSync } from "zlib";
import { crc32 } from "./pixelArt";
import {
    CUSTOM_SPRITE_SIZE,
    pngBytesToGrid,
    pngBytesToRgba,
    rgbaToGrid,
} from "./customSprite";

// ---------------------------------------------------------------------------
// PNG fixture helpers: build real 8-bit PNGs (IHDR + one IDAT + IEND) with
// per-row scanline filters, exactly what a real encoder (libpng, canvas
// toBlob, the web re-encode path) produces.
// ---------------------------------------------------------------------------

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function u32be(n: number): Buffer {
    return Buffer.from([
        (n >>> 24) & 0xff,
        (n >>> 16) & 0xff,
        (n >>> 8) & 0xff,
        n & 0xff,
    ]);
}

function chunk(type: string, data: Buffer): Buffer {
    return Buffer.concat([
        u32be(data.length),
        Buffer.from(type, "ascii"),
        data,
        u32be(
            crc32(
                new Uint8Array(
                    Buffer.concat([Buffer.from(type, "ascii"), data]),
                ),
            ),
        ),
    ]);
}

interface PngOptions {
    width: number;
    height: number;
    bitDepth?: number;
    colorType?: number;
    interlace?: number;
    idat?: Buffer;
    dropIend?: boolean;
    truncateIdat?: boolean;
}

function encodePng({
    width,
    height,
    bitDepth = 8,
    colorType = 6,
    interlace = 0,
    idat,
    dropIend = false,
    truncateIdat = false,
}: PngOptions): Buffer {
    const ihdr = Buffer.concat([
        u32be(width),
        u32be(height),
        Buffer.from([bitDepth, colorType, 0, 0, interlace]),
    ]);
    // Raw scanlines: filter byte 0 (none) per row unless a custom IDAT.
    let raw: Buffer;
    if (idat == null) {
        const bytesPerRow =
            width *
            (colorType === 0 || colorType === 4
                ? 1
                : colorType === 2 || colorType === 3
                  ? 3
                  : 4);
        const alpha = colorType === 4 || colorType === 6;
        raw = Buffer.alloc((bytesPerRow + 1) * height);
        // Deterministic flat fill (row-major across all rows).
        const fill = Buffer.alloc(height * bytesPerRow);
        for (let i = 0; i < fill.length; i++) fill[i] = (i * 37 + 11) % 256;
        for (let y = 0; y < height; y++) {
            raw[y * (bytesPerRow + 1)] = 0; // filter: none
            fill.copy(
                raw,
                y * (bytesPerRow + 1) + 1,
                y * bytesPerRow,
                (y + 1) * bytesPerRow,
            );
        }
        // The alpha channel of RGBA fixtures must be 255 (opaque).
        if (alpha) {
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    raw[y * (bytesPerRow + 1) + 1 + x * 4 + 3] = 255;
                }
            }
        }
    } else {
        raw = idat;
    }
    let idatChunk: Buffer;
    if (idat == null || !truncateIdat) {
        idatChunk = chunk("IDAT", Buffer.from(deflateSync(raw)));
    } else {
        idatChunk = chunk("IDAT", raw.subarray(0, raw.length - 5));
    }
    const parts = [PNG_MAGIC, chunk("IHDR", ihdr), idatChunk];
    if (!dropIend) parts.push(chunk("IEND", Buffer.alloc(0)));
    return Buffer.concat(parts);
}

/** Apply a per-row filter choice to a flat pixel row (the classic PNG
 *  "filter then encode" direction, used to exercise the decoder's
 *  reconstruction of filters 1–4). */
function filterRow(
    src: Buffer,
    width: number,
    height: number,
    channels: number,
    filters: number[],
): Buffer {
    const stride = width * channels;
    const out = Buffer.alloc((stride + 1) * height);
    for (let y = 0; y < height; y++) {
        const f = filters[y % filters.length];
        out[y * (stride + 1)] = f;
        for (let x = 0; x < stride; x++) {
            const v = src[y * stride + x];
            // LEFT predictor is the ORIGINAL left pixel (the encoder
            // filters real image rows, not its own output).
            const a =
                x >= channels
                    ? f >= 1
                        ? src[y * stride + x - channels]
                        : 0
                    : 0;
            const b = y > 0 ? src[(y - 1) * stride + x] : 0;
            const c =
                y > 0 && x >= channels
                    ? src[(y - 1) * stride + x - channels]
                    : 0;
            let d = 0;
            if (f === 1) d = a;
            else if (f === 2) d = b;
            else if (f === 3) d = (a + b) >> 1;
            else if (f === 4) {
                const p = a + b - c;
                const pa = Math.abs(p - a);
                const pb = Math.abs(p - b);
                const pc = Math.abs(p - c);
                d = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
            }
            out[y * (stride + 1) + 1 + x] = (v - d) & 0xff;
        }
    }
    return out;
}

function encodedPng(
    width: number,
    height: number,
    channels: number,
    colorType: number,
    filters: number[],
    opaqueAlpha = false,
): { bytes: Buffer; pixels: Buffer } {
    const pixels = Buffer.alloc(width * height * channels);
    for (let i = 0; i < pixels.length; i++) pixels[i] = (i * 37 + 11) % 256;
    // Optional fully-opaque alpha (last channel), so grid tests can assume
    // every cell survives the transparency threshold.
    if (opaqueAlpha) {
        for (let i = channels - 1; i < pixels.length; i += channels)
            pixels[i] = 255;
    }
    const raw = filterRow(pixels, width, height, channels, filters);
    const bytes = encodePng({
        width,
        height,
        colorType,
        // Pass the UNcompressed scanlines: encodePng owns the single
        // deflateSync, so pre-deflating here would double-compress.
        idat: raw,
    });
    return { bytes, pixels };
}

describe("pngBytesToRgba", () => {
    it("round-trips an 8-bit RGBA PNG with every scanline filter mixed", () => {
        // Filters cycled per row: none, sub, up, average, paeth — the
        // up/average/paeth rows reconstruct against the RECONSTRUCTED row
        // above, which the decoder must read from its own output.
        const { bytes, pixels } = encodedPng(7, 9, 4, 6, [0, 1, 2, 3, 4]);
        const rgba = pngBytesToRgba(new Uint8Array(bytes));
        expect(rgba).not.toBeNull();
        expect(rgba!.width).toBe(7);
        expect(rgba!.height).toBe(9);
        for (let i = 0; i < pixels.length; i++) {
            expect(rgba!.data[i]).toBe(pixels[i]);
        }
    });

    it("decodes gray, gray+alpha, and RGB color types into straight RGBA", () => {
        const gray = encodedPng(4, 4, 1, 0, [0, 1, 2, 3, 4]);
        const g = pngBytesToRgba(new Uint8Array(gray.bytes))!;
        expect(g.data[0]).toBe(gray.pixels[0]);
        expect(g.data[1]).toBe(gray.pixels[0]);
        expect(g.data[3]).toBe(255);

        const ga = encodedPng(4, 4, 2, 4, [0, 1, 2, 3, 4]);
        const gg = pngBytesToRgba(new Uint8Array(ga.bytes))!;
        expect(gg.data[3]).toBe(ga.pixels[1]); // alpha is the 2nd channel

        const rgb = encodedPng(4, 4, 3, 2, [0, 1, 2, 3, 4]);
        const r = pngBytesToRgba(new Uint8Array(rgb.bytes))!;
        expect(r.data[1]).toBe(rgb.pixels[1]);
        expect(r.data[3]).toBe(255);
    });

    it("splits IDAT bytes across multiple IDAT chunks", () => {
        const { pixels } = encodedPng(5, 5, 4, 6, [0, 2, 4]);
        const ihdr = Buffer.concat([
            u32be(5),
            u32be(5),
            Buffer.from([8, 6, 0, 0, 0]),
        ]);
        const raw = Buffer.alloc((5 * 4 + 1) * 5);
        for (let y = 0; y < 5; y++) {
            raw[y * 21] = 0;
            pixels.copy(raw, y * 21 + 1, y * 20, (y + 1) * 20);
        }
        const full = Buffer.from(deflateSync(raw));
        const mid = Math.ceil(full.length / 2);
        const bytes = Buffer.concat([
            PNG_MAGIC,
            chunk("IHDR", ihdr),
            chunk("IDAT", full.subarray(0, mid)),
            chunk("IDAT", full.subarray(mid)),
            chunk("IEND", Buffer.alloc(0)),
        ]);
        const rgba = pngBytesToRgba(new Uint8Array(bytes));
        expect(rgba).not.toBeNull();
        for (let i = 0; i < pixels.length; i++) {
            expect(rgba!.data[i]).toBe(pixels[i]);
        }
    });

    it("rejects non-PNG, 16-bit, palette, interlaced, truncated, and corrupt inputs", () => {
        // Not a PNG at all (JPEG-ish magic).
        expect(
            pngBytesToRgba(
                new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 1]),
            ),
        ).toBeNull();
        // 16-bit depth.
        expect(
            pngBytesToRgba(
                new Uint8Array(
                    encodePng({
                        width: 2,
                        height: 2,
                        bitDepth: 16,
                        colorType: 2,
                        idat: Buffer.from(
                            deflateSync(Buffer.alloc((2 * 3 + 1) * 2)),
                        ),
                    }),
                ),
            ),
        ).toBeNull();
        // Palette PNG (color type 3) — needs PLTE, rejected on purpose.
        expect(
            pngBytesToRgba(
                new Uint8Array(
                    encodePng({
                        width: 2,
                        height: 2,
                        colorType: 3,
                        idat: Buffer.from(
                            deflateSync(Buffer.alloc((2 + 1) * 2)),
                        ),
                    }),
                ),
            ),
        ).toBeNull();
        // Interlaced.
        expect(
            pngBytesToRgba(
                new Uint8Array(
                    encodePng({
                        width: 2,
                        height: 2,
                        interlace: 1,
                        idat: Buffer.from(
                            deflateSync(Buffer.alloc((2 * 4 + 1) * 2)),
                        ),
                    }),
                ),
            ),
        ).toBeNull();
        // Truncated IDAT (declared chunk runs past EOF).
        const truncated = encodePng({
            width: 2,
            height: 2,
            colorType: 2,
            idat: Buffer.from(deflateSync(Buffer.alloc((2 * 3 + 1) * 2))),
        });
        expect(
            pngBytesToRgba(
                new Uint8Array(truncated.subarray(0, truncated.length - 10)),
            ),
        ).toBeNull();
        // Corrupt deflate stream: a valid zlib header (0x78 0x9c) followed by
        // an impossible stored block, so pako's auto-detect (zlib OR raw) has
        // nothing it can inflate.
        const corrupt = encodePng({
            width: 2,
            height: 2,
            colorType: 6,
            idat: Buffer.from([0x78, 0x9c, 0xff, 0xff, 0xff, 0xff, 0xff]),
        });
        expect(pngBytesToRgba(new Uint8Array(corrupt))).toBeNull();
    });
});

describe("rgbaToGrid", () => {
    it("box-averages a 32×32 RGBA image into a 16×16 grid", () => {
        // Each 2×2 cell maps to exactly one grid cell.
        const n = CUSTOM_SPRITE_SIZE;
        const rgba = new Uint8Array(32 * 32 * 4);
        for (let gy = 0; gy < n; gy++) {
            for (let gx = 0; gx < n; gx++) {
                const r = (gy * 17) % 256;
                const g = (gx * 13) % 256;
                const b = (gy + gx) % 256;
                for (let dy = 0; dy < 2; dy++) {
                    for (let dx = 0; dx < 2; dx++) {
                        const o = ((gy * 2 + dy) * 32 + (gx * 2 + dx)) * 4;
                        rgba[o] = r;
                        rgba[o + 1] = g;
                        rgba[o + 2] = b;
                        rgba[o + 3] = 255;
                    }
                }
            }
        }
        const grid = rgbaToGrid(rgba, 32, 32);
        expect(grid).toHaveLength(n);
        for (let gy = 0; gy < n; gy++) {
            for (let gx = 0; gx < n; gx++) {
                expect(grid[gy][gx]).toBe(
                    "#" +
                        ((gy * 17) % 256).toString(16).padStart(2, "0") +
                        ((gx * 13) % 256).toString(16).padStart(2, "0") +
                        ((gy + gx) % 256).toString(16).padStart(2, "0"),
                );
            }
        }
    });

    it("drops cells whose average alpha is below the threshold (transparent stays transparent)", () => {
        const rgba = new Uint8Array(16 * 16 * 4);
        // Left half opaque red, right half fully transparent.
        for (let y = 0; y < 16; y++) {
            for (let x = 0; x < 16; x++) {
                const o = (y * 16 + x) * 4;
                rgba[o] = 255;
                if (x < 8) rgba[o + 3] = 255; // opaque left half only
            }
        }
        const grid = rgbaToGrid(rgba, 16, 16);
        for (let y = 0; y < 16; y++) {
            for (let x = 0; x < 16; x++) {
                expect(grid[y][x]).toBe(x < 8 ? "#ff0000" : null);
            }
        }
    });

    it("keeps opaque color when averaging with transparent fringe (premultiplied)", () => {
        // 1×1 input: one fully opaque red pixel. The upscale is trivially
        // the same color; nothing bakes black into the edge.
        const rgba = new Uint8Array([255, 0, 0, 255]);
        const grid = rgbaToGrid(rgba, 1, 1);
        expect(grid[0][0]).toBe("#ff0000");
    });

    it("returns an all-null grid for empty input", () => {
        const grid = rgbaToGrid(new Uint8Array(0), 0, 0);
        expect(grid).toHaveLength(CUSTOM_SPRITE_SIZE);
        expect(grid.every((row) => row.every((p) => p === null))).toBe(true);
    });
});

describe("pngBytesToGrid", () => {
    it("decodes a 16×16 PNG straight into the grid", () => {
        const { bytes } = encodedPng(16, 16, 4, 6, [0, 1, 2, 3, 4], true);
        const grid = pngBytesToGrid(new Uint8Array(bytes));
        expect(grid).not.toBeNull();
        expect(grid).toHaveLength(16);
        // Every cell was opaque → every cell got a color.
        expect(grid!.every((row) => row.every((p) => p !== null))).toBe(true);
    });

    it("scales a 4×4 PNG up to 16×16 (each source pixel covers 4×4 cells)", () => {
        const rgba = Buffer.alloc(4 * 4 * 4);
        const colors = [
            [255, 0, 0, 255],
            [0, 255, 0, 255],
            [0, 0, 255, 255],
            [255, 255, 0, 255],
        ];
        for (let i = 0; i < 16; i++) {
            colors[i % 4].forEach((v, c) => (rgba[i * 4 + c] = v));
        }
        const { bytes } = (() => {
            const ihdr = Buffer.concat([
                u32be(4),
                u32be(4),
                Buffer.from([8, 6, 0, 0, 0]),
            ]);
            const raw = Buffer.alloc((4 * 4 + 1) * 4);
            for (let y = 0; y < 4; y++) {
                raw[y * 17] = 0;
                rgba.copy(raw, y * 17 + 1, y * 16, (y + 1) * 16);
            }
            return {
                bytes: Buffer.concat([
                    PNG_MAGIC,
                    chunk("IHDR", ihdr),
                    chunk("IDAT", Buffer.from(deflateSync(raw))),
                    chunk("IEND", Buffer.alloc(0)),
                ]),
            };
        })();
        const grid = pngBytesToGrid(new Uint8Array(bytes));
        expect(grid).not.toBeNull();
        // Top-left 4×4 block = red, etc.
        expect(grid![0][0]).toBe("#ff0000");
        expect(grid![0][3]).toBe("#ff0000");
        expect(grid![0][4]).toBe("#00ff00");
        expect(grid![15][15]).toBe("#ffff00");
    });

    it("returns null (never throws) for non-PNG bytes", () => {
        expect(pngBytesToGrid(new Uint8Array([0, 1, 2, 3]))).toBeNull();
    });
});
