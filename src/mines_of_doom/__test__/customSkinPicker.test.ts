/**
 * Tests for the NATIVE custom-skin pickers (customSkinPicker.ts) —
 * expo-file-system's document picker is mocked at the module boundary
 * (no real OS picker in jest), and the files carry REAL fixture bytes:
 * a genuine PNG (built here with pako, the same encoder shape the
 * customSprite fixtures use) and genuine 16-bit PCM WAV byte strings,
 * so the whole decode funnel (pick → bytes → grid / WAV data URI) runs
 * on production code, not a mock.
 */
import { deflate } from "pako";
import * as EFS from "expo-file-system";

jest.mock("expo-file-system", () => {
  const state: { next: unknown } = { next: null };
  return {
    File: { pickFileAsync: jest.fn(async () => state.next) },
    __testState: state,
  };
});

// The mock's control handle (set the next pickFileAsync result per test).
const fs = EFS as typeof EFS & { __testState: { next: unknown } };

import { pickCustomSkinAudio, pickCustomSkinImage } from "../customSkinPicker";
import { CUSTOM_SKIN_MAX_PICK_BYTES } from "../customSkin";

/** File-shaped pick result: what File.pickFileAsync resolves on. */
function pickedFile(bytes: Uint8Array) {
  return {
    canceled: false,
    result: {
      size: bytes.length,
      arrayBuffer: async () => bytes.buffer.slice(0),
    },
  };
}

// ---------------------------------------------------------------------------
// PNG fixture (8-bit RGBA, non-interlaced, filter 0 — no unfilter needed)
// ---------------------------------------------------------------------------

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c ^= bytes[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (c ^ 0xffffffff) >>> 0;
}

function encodePng(width: number, height: number, rgba: Uint8Array): Buffer {
  // Row bytes with a filter-type byte (0) prefixed per scanline.
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0;
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4;
      const dst = y * (1 + width * 4) + 1 + x * 4;
      for (let c = 0; c < 4; c++) raw[dst + c] = rgba[src + c];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const magic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const chunks: Buffer[] = [];
  const withChunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const out = Buffer.alloc(4 + body.length + 4);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body), 4 + body.length);
    chunks.push(out);
  };
  withChunk("IHDR", ihdr);
  withChunk("IDAT", Buffer.from(deflate(raw)));
  withChunk("IEND", Buffer.alloc(0));
  return Buffer.concat([magic, ...chunks]);
}

// ---------------------------------------------------------------------------
// WAV fixture (16-bit PCM)
// ---------------------------------------------------------------------------

function encodeWav(i16: Int16Array, sampleRate: number): Buffer {
  const nBytes = i16.length * 2;
  const buf = Buffer.alloc(44 + nBytes);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + nBytes, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(nBytes, 40);
  for (let i = 0; i < i16.length; i++) buf.writeInt16LE(i16[i], 44 + i * 2);
  return buf;
}

describe("native pickCustomSkinImage", () => {
  beforeEach(() => {
    fs.__testState.next = null;
  });

  it("maps a cancelled pick to the cancelled result", async () => {
    fs.__testState.next = { canceled: true, result: null };
    await expect(pickCustomSkinImage()).resolves.toEqual({
      kind: "cancelled",
    });
  });

  it("decodes a picked PNG to a 16×16 grid", async () => {
    // A 4×2 red/green source: cover-fit onto 16×16, each 8×8 block is a
    // solid color — the grid must carry the player's own two colors.
    const w = 4;
    const h = 2;
    const rgba = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4;
        rgba[o] = 255;
        rgba[o + 1] = 0;
        rgba[o + 2] = 0;
        rgba[o + 3] = 255;
        if (x > 1) {
          rgba[o] = 0;
          rgba[o + 1] = 255;
          rgba[o + 2] = 0;
        }
      }
    }
    fs.__testState.next = pickedFile(new Uint8Array(encodePng(w, h, rgba)));
    const res = await pickCustomSkinImage();
    expect(res.kind).toBe("image");
    if (res.kind !== "image") return;
    expect(res.grid.length).toBe(16);
    const topRow = res.grid[0];
    expect(Array.isArray(topRow) && topRow.length).toBe(16);
    if (topRow == null) return;
    const left = topRow[0];
    const right = topRow[15];
    if (left == null || right == null) return; // the boxes are opaque
    expect(left).toMatch(/^#[0-9a-f]{6}$/i);
    expect(right).toMatch(/^#[0-9a-f]{6}$/i);
    // Box-averaged solid blocks keep their colors (±rounding).
    expect(left.toUpperCase()).toBe("#FF0000");
    expect(right.toUpperCase()).toBe("#00FF00");
  });

  it("rejects a file that is not a decodable PNG", async () => {
    fs.__testState.next = pickedFile(
      new Uint8Array(Buffer.from("not a png at all, just text bytes")),
    );
    await expect(pickCustomSkinImage()).resolves.toEqual({
      kind: "invalid",
      error: "decode",
    });
  });

  it("rejects an over-cap file before decoding", async () => {
    const huge = new Uint8Array(CUSTOM_SKIN_MAX_PICK_BYTES + 1);
    fs.__testState.next = pickedFile(huge);
    await expect(pickCustomSkinImage()).resolves.toEqual({
      kind: "invalid",
      error: "too-large",
    });
  });
});

describe("native pickCustomSkinAudio", () => {
  beforeEach(() => {
    fs.__testState.next = null;
  });

  it("maps a cancelled pick to the cancelled result", async () => {
    fs.__testState.next = { canceled: true, result: null };
    await expect(pickCustomSkinAudio()).resolves.toEqual({
      kind: "cancelled",
    });
  });

  it("parses a short 16-bit PCM WAV into the save's data URI", async () => {
    const rate = 8000;
    const count = rate; // 1 s — inside the 3 s swing cap
    const pcm = new Int16Array(count);
    for (let i = 0; i < count; i++) {
      pcm[i] = Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 0x4000);
    }
    fs.__testState.next = pickedFile(new Uint8Array(encodeWav(pcm, rate)));
    const res = await pickCustomSkinAudio();
    expect(res.kind).toBe("audio");
    if (res.kind !== "audio") return;
    expect(res.uri.startsWith("data:audio/wav;base64,")).toBe(true);
    expect(res.uri.length).toBeLessThan(300_000);
  });

  it("rejects a clip over the 3 s swing cap", async () => {
    const rate = 8000;
    const pcm = new Int16Array(rate * 10); // 10 s of silence
    fs.__testState.next = pickedFile(new Uint8Array(encodeWav(pcm, rate)));
    await expect(pickCustomSkinAudio()).resolves.toEqual({
      kind: "invalid",
      error: "decode-or-too-long",
    });
  });

  it("rejects audio bytes that are not a plain WAV (mp3 stands in)", async () => {
    // 0xFF sync bytes — the mp3 header shape, definitely not RIFF/WAVE.
    const mp3ish = new Uint8Array(64).fill(0xff);
    fs.__testState.next = pickedFile(mp3ish);
    await expect(pickCustomSkinAudio()).resolves.toEqual({
      kind: "invalid",
      error: "decode-or-too-long",
    });
  });

  it("rejects an over-cap file before decoding", async () => {
    const huge = new Uint8Array(CUSTOM_SKIN_MAX_PICK_BYTES + 1);
    fs.__testState.next = pickedFile(huge);
    await expect(pickCustomSkinAudio()).resolves.toEqual({
      kind: "invalid",
      error: "too-large",
    });
  });
});
