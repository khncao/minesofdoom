#!/usr/bin/env node
// Synthesizes the looping cave-ambience music bed (todo: "Music / ambient
// loop", features.md §7 gap). Output is a 16-bit PCM mono WAV next to the
// other audio in public/assets/audio/, required from public/assets/index.ts.
//
// Re-run after tuning a design: `node scripts/generate-ambient-loop.mjs`
// (an optional second argument is an output directory, used by the unit
// test that pins determinism; the asset in public/ is the committed one).
//
// Seamlessness: every component is exactly periodic over the 20 s loop —
// sine partials at integer multiples of 1/DUR Hz, integer-cycle amplitude
// LFOs, a circular (period-preserving) low-pass on the noise bed, and the
// drip events confined to the interior — so the wrap point is continuous
// by construction. A short head/tail fade on top is a redundant
// belt-and-suspenders (drips never land inside it).
import { writeFileSync } from "node:fs";
import path from "node:path";

const SR = 16000;
const DUR = 20; // seconds
const N = SR * DUR; // 320000 samples
const FADE = Math.floor(0.35 * SR); // head/tail fade (samples)
// NOTE: any frequency that is an integer multiple of 1/DUR Hz loops
// seamlessly — the pad partials below (27.5/55/82.4/110) all are.

// --- deterministic RNG (same helper shape as generate-pickaxe-sounds) ---
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

const out = new Float32Array(N);

// --- pad: low cave drone -------------------------------------------------
// Frequencies are integer multiples of FUND (27.5/55/82.4/110 Hz all are),
// LFOs run integer cycles over the loop, phases are free (a phase-shifted
// integer-cycle sine is still periodic).
const PAD = [
  { f: 27.5, amp: 0.5, lfo: 1, depth: 0.3, phase: 0.0 },
  { f: 55.0, amp: 0.35, lfo: 2, depth: 0.35, phase: 1.3 },
  { f: 82.4, amp: 0.22, lfo: 3, depth: 0.4, phase: 4.1 },
  { f: 110.0, amp: 0.12, lfo: 2, depth: 0.4, phase: 2.7 },
];
for (const { f, amp, lfo, depth, phase } of PAD) {
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    const gain =
      amp * (1 - depth + depth * (0.5 + 0.5 * Math.sin(2 * Math.PI * (lfo * t / DUR) + phase)));
    out[i] += gain * Math.sin(2 * Math.PI * f * t);
  }
}

// --- cave air: low-passed noise bed with a slow swell ---------------------
const rng = mulberry32(4242);
const white = new Float32Array(N);
for (let i = 0; i < N; i++) white[i] = rng() * 2 - 1;
// Circular box low-pass (period-preserving): width 65 samples → first null
// at SR/65 ≈ 246 Hz, which reads as "air", not "hiss".
const R = 32;
const noise = new Float32Array(N);
for (let i = 0; i < N; i++) {
  let acc = 0;
  for (let k = -R; k <= R; k++) acc += white[(i + k + N) % N];
  noise[i] = acc / (2 * R + 1);
}
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const gain = 0.05 * (0.6 + 0.4 * Math.sin(2 * Math.PI * (1 * t / DUR) + 2.0));
  out[i] += gain * noise[i];
}

// --- drips: short pitched blips with two cave echoes ----------------------
// Placed in [1.5, 18.5] s so the blip + echoes stay out of the fade zones.
const DRIPS = 5;
for (let d = 0; d < DRIPS; d++) {
  const pos = 1.5 + rng() * (18.5 - 1.5);
  const hits = [
    { at: 0, amp: 0.05, f0: 850, f1: 480, len: 0.35 },
    { at: 0.26, amp: 0.018, f0: 720, f1: 420, len: 0.3 },
    { at: 0.47, amp: 0.007, f0: 640, f1: 380, len: 0.28 },
  ];
  for (const h of hits) {
    const start = Math.floor((pos + h.at) * SR);
    const len = Math.floor(h.len * SR);
    for (let i = 0; i < len; i++) {
      const idx = start + i;
      if (idx < 0 || idx >= N) continue;
      const t = i / SR;
      // exponential frequency glide + exponential decay
      const f = h.f1 + (h.f0 - h.f1) * Math.exp(-t / 0.028);
      const env = Math.exp(-t / 0.045);
      out[idx] += h.amp * env * Math.sin(2 * Math.PI * f * t);
    }
  }
}

// --- normalize (peak 0.55: the bed sits under the SFX at the same volume) ---
let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(out[i]));
if (peak > 0) {
  const g = 0.55 / peak;
  for (let i = 0; i < N; i++) out[i] *= g;
}

// --- head/tail fade (redundant seam insurance) -----------------------------
for (let i = 0; i < FADE; i++) {
  const w = i / FADE;
  out[i] *= w;
  out[N - 1 - i] *= w;
}

function writeWav(filePath, samples) {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + samples.length * 2, 4);
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
  buf.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  writeFileSync(filePath, buf);
}

const outDir = process.argv[2] ?? path.join("public", "assets", "audio");
const file = path.join(outDir, "cave-ambient.wav");
writeWav(file, out);
console.log(`wrote ${file}`);
