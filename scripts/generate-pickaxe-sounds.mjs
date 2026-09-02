#!/usr/bin/env node
// Synthesizes the per-pickaxe swing sounds (plan §5.2 "unique sounds" —
// each pickaxe cosmetic has its own strike/clink, so equipped-pickaxe
// mining taps sound different). Output is 16-bit PCM mono WAV next to the
// other audio in public/assets/audio/, required from public/assets/index.ts.
//
// Re-run after tuning a design: `node scripts/generate-pickaxe-sounds.mjs`
import { writeFileSync } from "node:fs";
import path from "node:path";

const SR = 22050;
const DUR = 0.16; // seconds
const N = Math.floor(SR * DUR);

// Per-pickaxe "material" design:
//   base  — fundamental strike frequency (Hz)
//   parts — [frequencyRatio, amplitude] partials (inharmonic ratios read as
//           "metal"; 2.0/3.0 read as "bell/glass")
//   decay — exponential amplitude decay rate (1/s)
//   noise — amplitude of the first 3ms broadband impact transient
const DESIGNS = {
  steel: {
    base: 620,
    parts: [[1, 1.0], [2.72, 0.45], [5.4, 0.22]],
    decay: 22,
    noise: 0.5,
  },
  gold: {
    base: 470,
    parts: [[1, 1.0], [2.3, 0.5], [4.1, 0.18]],
    decay: 16,
    noise: 0.35,
  },
  frost: {
    base: 880,
    parts: [[1, 1.0], [2.0, 0.55], [3.01, 0.28]],
    decay: 26,
    noise: 0.3,
  },
  shadow: {
    base: 330,
    parts: [[1, 1.0], [1.6, 0.4], [3.0, 0.15]],
    decay: 13,
    noise: 0.55,
  },
};

function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function synthesize(design) {
  const rng = mulberry32(1337);
  const out = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    const env = Math.exp(-design.decay * t);
    let s = 0;
    for (const [ratio, amp] of design.parts) {
      s +=
        amp *
        Math.sin(2 * Math.PI * design.base * ratio * t + (rng() - 0.5) * 0.02);
    }
    // 3ms broadband impact transient at t=0 so the strike has an "attack".
    const noiseSamples = Math.floor(0.003 * SR);
    if (i < noiseSamples) {
      const nEnv = 1 - i / noiseSamples;
      s += design.noise * nEnv * (rng() * 2 - 1);
    }
    out[i] = s * env;
  }
  // Normalize to a consistent loudness (peak ~0.85), leaving headroom.
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  if (peak > 0) {
    const g = 0.85 / peak;
    for (let i = 0; i < N; i++) out[i] *= g;
  }
  return out;
}

function writeWav(filePath, samples) {
  const buf = Buffer.alloc(44 + N * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + N * 2, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16); // fmt chunk size
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits per sample
  buf.write("data", 36);
  buf.writeUInt32LE(N * 2, 40);
  for (let i = 0; i < N; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  writeFileSync(filePath, buf);
}

const outDir = path.join("public", "assets", "audio");
for (const [id, design] of Object.entries(DESIGNS)) {
  const file = path.join(outDir, `pickaxe-${id}.wav`);
  writeWav(file, synthesize(design));
  console.log(`wrote ${file}`);
}
