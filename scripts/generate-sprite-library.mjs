#!/usr/bin/env node
/**
 * Generate src/mines_of_doom/bundledSprites.ts from the vendored PNGs in
 * public/assets/sprites/ (CC0-licensed, see public/assets/sprites/CREDITS.txt).
 *
 * The generated module is the runtime source of the bundled sprite library:
 * data URIs (base64 PNG) so the skin pipeline stays on plain string URIs
 * (customSkinBodyUri → Miner playerBodyUri → <Image source={{uri}}>) on
 * every platform — no asset-require plumbing, pure + testable.
 *
 * Deterministic: files are sorted by name, the header is fixed, so the
 * output only changes when the art changes.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SPRITE_DIR = path.join(ROOT, "public/assets/sprites");
const OUT = path.join(ROOT, "src/mines_of_doom/bundledSprites.ts");

/**
 * The library metadata (hand-maintained, in the source of truth for the
 * names shown in the shop — the i18n keys; see en.ts "iap.sprite.*").
 * Add a new PNG to public/assets/sprites/ and a row here, then re-run.
 */
const META = {
 "beggar-boy-tin-cup": {
  name: "Tin-cup beggar",
  sourceUrl: "https://freegamesprites.com/en/assets/beggar-boy-tin-cup",
 },
 "cybernetic-arm-technician": {
  name: "Cyber technician",
  sourceUrl: "https://freegamesprites.com/en/assets/cybernetic-arm-technician",
 },
 "deep-mole": {
  name: "Deep mole",
  sourceUrl:
   "original — authored in-repo (scripts/generate-deep-mole-sprite.mjs)",
 },
 "dwarven-mine-worker": {
  name: "Dwarven miner",
  sourceUrl: "https://freegamesprites.com/en/assets/dwarven-mine-worker",
 },
 "goblin-bog-servant": {
  name: "Bog goblin",
  sourceUrl: "https://freegamesprites.com/en/assets/goblin-bog-servant",
 },
 "hangar-mechanic-goggles-greasy": {
  name: "Grease mechanic",
  sourceUrl:
   "https://freegamesprites.com/en/assets/hangar-mechanic-goggles-greasy",
 },
 "lantern-bearer-boy": {
  name: "Lantern bearer",
  sourceUrl: "https://freegamesprites.com/en/assets/lantern-bearer-boy",
 },
 "trapper-bearskin-pelt": {
  name: "Fur trapper",
  sourceUrl: "https://freegamesprites.com/en/assets/trapper-bearskin-pelt",
 },
 "will-o-wisp-spirit": {
  name: "Will-o'-wisp",
  sourceUrl: "https://freegamesprites.com/en/assets/will-o-wisp-spirit",
 },
};

const files = readdirSync(SPRITE_DIR).filter((f) => f.endsWith(".png"));
if (files.length === 0) {
 throw new Error(`no PNGs found in ${SPRITE_DIR}`);
}
const unknown = files
 .map((f) => f.replace(/\.png$/, ""))
 .filter((id) => !META[id]);
if (unknown.length > 0) {
 throw new Error(
  `PNGs without metadata (add a row to META in this script): ${unknown.join(", ")}`,
 );
}

const entries = [...files]
 .sort((a, b) => a.localeCompare(b))
 .map((file) => {
  const id = file.replace(/\.png$/, "");
  const bytes = readFileSync(path.join(SPRITE_DIR, file));
  if (bytes.length < 8 || bytes.readUInt32BE(0) !== 0x89504e47) {
   throw new Error(`${file}: not a PNG`);
  }
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const b64 = Buffer.from(bytes).toString("base64");
  const { name, sourceUrl } = META[id];
  return ` {
  id: ${JSON.stringify(id)},
  name: ${JSON.stringify(name)},
  license: "CC0-1.0",
  sourceUrl: ${JSON.stringify(sourceUrl)},
  width: ${width},
  height: ${height},
  uri: ${JSON.stringify(`data:image/png;base64,${b64}`)},
 },`;
 });

const out = `/**
 * BUNDLED SPRITE LIBRARY — GENERATED FILE, DO NOT EDIT BY HAND.
 *
 * Source: the vendored CC0-licensed PNGs in public/assets/sprites/
 * (attribution + license: public/assets/sprites/CREDITS.txt). Regenerate
 * with: node scripts/generate-sprite-library.mjs
 *
 * The library is the bundled 2D art the custom-skin line offers on top of
 * emoji art and the generated pixel sprites: each entry is a data URI the
 * skin slot carries verbatim (artId → bundledSpriteById → uri), so the
 * runtime path is the same string-URI pipeline as the uploaded-pixel skin
 * (customSkinBodyUri → Miner playerBodyUri → <Image source={{uri}}>).
 */
export interface BundledSprite {
/** Stable id — the value stored in the skin slot (customSkin.artId). */
id: string;
/** English display name (content-namespace "bundledSprite" localizes it). */
name: string;
 /** The license the art was taken under (every entry: CC0 1.0). */
 license: string;
 /** The canonical source page (attribution, CREDITS.txt). */
 sourceUrl: string;
 width: number;
 height: number;
 /** data:image/png;base64 URI — renderable by <Image source={{uri}}>. */
 uri: string;
}

export const BUNDLED_SPRITES: readonly BundledSprite[] = [
${entries.join("\n")}
];

export const BUNDLED_SPRITE_IDS: readonly string[] = BUNDLED_SPRITES.map(
 (s) => s.id,
);

/** null when the id is not in the library (a corrupt/unknown slot value). */
export function bundledSpriteById(id: string): BundledSprite | null {
 for (const s of BUNDLED_SPRITES) {
  if (s.id === id) return s;
 }
 return null;
}
`;

writeFileSync(OUT, out);
console.log(
 `bundledSprites.ts: ${entries.length} sprites, ${(out.length / 1024).toFixed(0)} KB`,
);
