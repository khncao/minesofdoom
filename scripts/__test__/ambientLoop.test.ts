/**
 * Ambient-loop asset nets (todo: "Music / ambient loop"):
 *  - the committed WAV is EXACTLY what the generator produces (re-running
 *    `node scripts/generate-ambient-loop.mjs` can't silently drift the
 *    shipped asset) and the generator is deterministic (two runs in temp
 *    dirs are byte-identical);
 *  - the WAV is a sane 16-bit mono 16 kHz ~20 s file with the bed actually
 *    in it (nonzero RMS) and headroom (peak < 1);
 *  - the loop seam is continuous: both ends are faded to (near) silence,
 *    so the wrap can't click.
 */
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const SCRIPT = path.join(__dirname, "..", "generate-ambient-loop.mjs");
const COMMITTED = path.join(
  __dirname,
  "..",
  "..",
  "public",
  "assets",
  "audio",
  "cave-ambient.wav",
);

function parseWav(buf: Buffer): { sampleRate: number; samples: number[] } {
  const check = (tag: string, off: number): void => {
    expect(buf.toString("ascii", off, off + 4)).toBe(tag);
  };
  check("RIFF", 0);
  check("WAVE", 8);
  check("fmt ", 12);
  expect(buf.readUInt32LE(16)).toBe(16); // fmt chunk size
  expect(buf.readUInt16LE(20)).toBe(1); // PCM
  expect(buf.readUInt16LE(22)).toBe(1); // mono
  const sampleRate = buf.readUInt32LE(24);
  expect(buf.readUInt16LE(34)).toBe(16); // 16-bit
  check("data", 36);
  const dataBytes = buf.readUInt32LE(40);
  expect(dataBytes % 2).toBe(0);
  const samples: number[] = [];
  for (let i = 0; i < dataBytes; i += 2) {
    samples.push(buf.readInt16LE(44 + i) / 32768);
  }
  return { sampleRate, samples };
}

function generateInto(dir: string): Buffer {
  fs.mkdirSync(dir, { recursive: true });
  execFileSync(process.execPath, [SCRIPT, dir], { stdio: "pipe" });
  return fs.readFileSync(path.join(dir, "cave-ambient.wav"));
}

describe("generate-ambient-loop.mjs", () => {
  test("is deterministic (two runs → byte-identical output)", () => {
    const dirA = fs.mkdtempSync(path.join(os.tmpdir(), "mdo-amb-a-"));
    const dirB = fs.mkdtempSync(path.join(os.tmpdir(), "mdo-amb-b-"));
    try {
      expect(generateInto(dirA).equals(generateInto(dirB))).toBe(true);
    } finally {
      fs.rmSync(dirA, { recursive: true, force: true });
      fs.rmSync(dirB, { recursive: true, force: true });
    }
  });

  test("the committed asset is exactly the generator's output", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mdo-amb-pin-"));
    try {
      expect(generateInto(dir).equals(fs.readFileSync(COMMITTED))).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("cave-ambient.wav", () => {
  let sampleRate: number;
  let samples: number[];
  beforeAll(() => {
    ({ sampleRate, samples } = parseWav(fs.readFileSync(COMMITTED)));
  });

  test("is a 16-bit mono 16 kHz ~20 s file", () => {
    expect(sampleRate).toBe(16000);
    const seconds = samples.length / sampleRate;
    expect(seconds).toBeGreaterThan(19.9);
    expect(seconds).toBeLessThan(20.1);
  });

  test("has headroom (peak < 1) and real content (mid-section RMS > 0)", () => {
    let peak = 0;
    for (const s of samples) peak = Math.max(peak, Math.abs(s));
    expect(peak).toBeLessThan(1);
    // the middle half of the loop (drips + pad) must not be silence
    const mid = samples.slice(
      samples.length >> 2,
      (samples.length * 3) >> 2,
    );
    const rms = Math.sqrt(mid.reduce((acc, s) => acc + s * s, 0) / mid.length);
    expect(rms).toBeGreaterThan(0.01);
  });

  test("loops without a click (the seam meets, ends are faded)", () => {
    // both ends are faded, so the wrap lands on (near) silence
    expect(Math.abs(samples[0])).toBeLessThan(0.01);
    expect(Math.abs(samples[samples.length - 1])).toBeLessThan(0.01);
    const rmsOf = (a: number, b: number): number => {
      let acc = 0;
      for (let i = a; i < b; i++) acc += samples[i] * samples[i];
      return Math.sqrt(acc / (b - a));
    };
    const q = samples.length >> 2;
    const middle = rmsOf(q, 2 * q);
    const fade = Math.floor(0.35 * sampleRate);
    expect(rmsOf(0, fade)).toBeLessThan(middle);
    expect(rmsOf(samples.length - fade, samples.length)).toBeLessThan(middle);
  });
});
