#!/usr/bin/env node
/**
 * Generate src/mines_of_doom/skinSamples.ts — the sample content for the
 * custom-skin line (docs/todo.md "add a few sample sprites and sounds to
 * custom skin iap and test uploading").
 *
 * Two kinds of samples, both shaped EXACTLY like what an upload stores,
 * so tapping a sample fills the same save slot with the same values
 * (setPickaxeGrid / setAudio, whose normalizers re-validate anyway):
 *  - PICKAXE grids: 16×16 (buildPickaxeGrid from pixelArt.ts — the same
 *    procedural crescent the game draws), in the in-game pickaxe
 *    palettes (cosmetics.ts), each with a precomputed PNG data-URI
 *    preview so the shop thumbnail needs no per-render encoding.
 *  - SOUNDS: short synthesized 16-bit PCM WAV data URIs (the same strike
 *    synthesis design as scripts/generate-pickaxe-sounds.mjs), each well
 *    under the 3 s / 300 KB slot caps.
 *
 * Deterministic: fixed palettes/designs/seed, so the module is
 * byte-stable across runs. Re-run after tuning a sample:
 *   node scripts/generate-skin-samples.mjs
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildPickaxeGrid,
  gridToPngDataUri,
} from "../src/utils/graphics/pixelArt.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "src", "mines_of_doom", "skinSamples.ts");

// --- pickaxe samples (the in-game palettes, cosmetics.ts) --------------------
const PICKAXE_SAMPLES = [
  {
    id: "pickaxe-gold",
    name: "Gold pickaxe",
    theme: { head: "#e8c33d", glow: "#fff3b0", handle: "#8a5a2b" },
  },
  {
    id: "pickaxe-frost",
    name: "Crystal pickaxe",
    theme: { head: "#5ad8e8", glow: "#d0fbff", handle: "#3a2f5a" },
  },
  {
    id: "pickaxe-shadow",
    name: "Shadow pickaxe",
    theme: { head: "#4a4a5a", glow: "#9a7fd0", handle: "#2a2233" },
  },
];

// --- sound samples (strike synthesis like generate-pickaxe-sounds.mjs) -------
const SR = 16000;
const SOUND_SAMPLES = [
  {
    id: "sound-bell",
    name: "Bell clink",
    glyph: "\uD83D\uDD14", // 🔔
    design: {
      base: 523.25, // C5 — a bell's partials read inharmonic
      parts: [
        [1, 1.0],
        [2.42, 0.4],
        [3.93, 0.18],
        [5.8, 0.07],
      ],
      decay: 9,
      noise: 0.5,
      dur: 1.15,
    },
  },
  {
    id: "sound-chime",
    name: "Crystal chime",
    glyph: "\uD83D\uDD2E", // 🔮
    design: {
      base: 660,
      parts: [
        [1, 1.0],
        [2.0, 0.5],
        [3.01, 0.24],
      ],
      decay: 12,
      noise: 0.3,
      dur: 1.0,
    },
  },
  {
    id: "sound-thud",
    name: "Cave thud",
    glyph: "\uD83E\uDEA8", // 🪨
    design: {
      base: 150,
      parts: [
        [1, 1.0],
        [1.38, 0.35],
      ],
      decay: 14,
      noise: 0.7,
      dur: 0.9,
    },
  },
];

// --- synthesis -----------------------------------------------------------------
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
  const n = Math.floor(SR * design.dur);
  const rng = mulberry32(1337);
  const out = new Float32Array(n);
  const noiseSamples = Math.floor(0.003 * SR);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = Math.exp(-design.decay * t);
    let s = 0;
    for (const [ratio, amp] of design.parts) {
      s +=
        amp *
        Math.sin(2 * Math.PI * design.base * ratio * t + (rng() - 0.5) * 0.02);
    }
    if (i < noiseSamples) {
      const nEnv = 1 - i / noiseSamples;
      s += design.noise * nEnv * (rng() * 2 - 1);
    }
    out[i] = s * env;
  }
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  if (peak > 0) {
    const g = 0.85 / peak;
    for (let i = 0; i < n; i++) out[i] *= g;
  }
  return out;
}

function wavDataUri(samples) {
  const n = samples.length * 2;
  const buf = Buffer.alloc(44 + n);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n, 40);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  return `data:audio/wav;base64,${buf.toString("base64")}`;
}

// --- module emission ------------------------------------------------------------
function cellSrc(px) {
  return px === null ? "null" : JSON.stringify(px);
}

function gridSrc(grid) {
  const rows = grid.map((row) => `  [${row.map(cellSrc).join(", ")}]`);
  return `[\n${rows.join(",\n")}\n]`;
}

const out = [];

out.push(`/**
 * CUSTOM-SKIN SAMPLE CONTENT — GENERATED FILE, DO NOT EDIT BY HAND.
 *
 * Source: scripts/generate-skin-samples.mjs (regenerate with
 * \`node scripts/generate-skin-samples.mjs\`).
 *
 * A small ready-made set for the custom-skin line's two upload-only
 * slots (docs/todo.md "add a few sample sprites and sounds to custom
 * skin iap and test uploading"): a few 16×16 PICKAXE grids (the exact
 * shape a PNG upload decodes to) and a few short SWING SOUNDS (WAV data
 * URIs, the exact shape an upload stores) — tap-to-equip in the
 * IapPanel skin row, no files needed. Samples reuse the in-game pickaxe
 * palettes (cosmetics.ts) and the in-repo strike synthesis
 * (scripts/generate-pickaxe-sounds.mjs), so a sample is a faithful
 * preview of the slot it fills — and a working demo when a player has no
 * uploads of their own.
 */

import type { CustomSkinGrid } from "./customSkin";

export interface SkinSamplePickaxe {
  /** Stable id — the value the IapPanel picker passes back. */
  id: string;
  /** English display name (content-namespace "skinSample" localizes it). */
  name: string;
  /** The 16×16 grid setPickaxeGrid stores (normalization-valid by construction). */
  grid: CustomSkinGrid;
  /** data:image/png;base64 preview — renderable by <Image source={{uri}}>. */
  uri: string;
}

export interface SkinSampleSound {
  /** Stable id — the value the IapPanel picker passes back. */
  id: string;
  /** English display name (content-namespace "skinSample" localizes it). */
  name: string;
  /** A single glyph the shop button shows (no per-sound art assets). */
  glyph: string;
  /** The data:audio/wav;base64 URI setAudio stores (normalization-valid). */
  uri: string;
}

export const SKIN_SAMPLE_PICKAXES: readonly SkinSamplePickaxe[] = [`);

for (const s of PICKAXE_SAMPLES) {
  out.push(` {
  id: "${s.id}",
  name: ${JSON.stringify(s.name)},
  grid: ${gridSrc(buildPickaxeGrid(s.theme))},
  uri: ${JSON.stringify(gridToPngDataUri(buildPickaxeGrid(s.theme)))},
 },`);
}

out.push(`];

export const SKIN_SAMPLE_SOUNDS: readonly SkinSampleSound[] = [`);

for (const s of SOUND_SAMPLES) {
  out.push(` {
  id: "${s.id}",
  name: ${JSON.stringify(s.name)},
  glyph: ${JSON.stringify(s.glyph)},
  uri: ${JSON.stringify(wavDataUri(synthesize(s.design)))},
 },`);
}

out.push(`];

/** null when the id is not a sample (a future library change). */
export function skinSamplePickaxeById(id: string): SkinSamplePickaxe | null {
 for (const s of SKIN_SAMPLE_PICKAXES) {
  if (s.id === id) return s;
 }
 return null;
}

/** null when the id is not a sample (a future library change). */
export function skinSampleSoundById(id: string): SkinSampleSound | null {
 for (const s of SKIN_SAMPLE_SOUNDS) {
  if (s.id === id) return s;
 }
 return null;
}
`);

writeFileSync(OUT, out.join("\n"), "utf8");
console.log(`wrote ${path.relative(process.cwd(), OUT)}`);
for (const s of PICKAXE_SAMPLES) console.log(`  pickaxe sample: ${s.id}`);
for (const s of SOUND_SAMPLES)
  console.log(`  sound sample: ${s.id} (${s.design.dur}s)`);
