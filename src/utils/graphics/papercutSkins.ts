/**
 * The PAPERCUT skin line (docs/art-directions.md — papercut is the picked
 * direction).
 *
 * A "skin" is a CHARACTER: a colorway (the same `MinerLook` the live 16×
 * pipeline takes) plus a `SkinShape` — the silhouette switches
 * (headwear / hair / outfit / critter form / cute face). Everything is
 * generated: 32×32 label geometry (`characterArt.minerLabels`) rendered by
 * the papercut renderer (`characterArt.renderDirection("papercut", …)`).
 *
 * The line deliberately mixes shapes rather than recoloring one body: a
 * crew you can tell apart at a glance is the whole point of a cosmetic
 * line, and papercut is the direction where silhouette carries the most.
 * Half the line is the mining-crew side (helmets, caps, critters), half is
 * the cute/pretty side (hair, dresses, bigger eyes) — the same audience the
 * anime draft in art-anime.md was reaching for.
 *
 * Pure data + pure builders, deterministic, no assets, not wired into the
 * app yet: the sheet lives in docs/art-directions/samples/papercut-skins*
 * and is rendered by scripts/generate-papercut-skin-samples.mjs.
 */
import {
 DIRECTION_GRID_SIZE,
 buildPalette,
 minerLabels,
 renderDirection,
} from "./characterArt";
import type { DirectionId, SkinShape } from "./characterArt";
import type { MinerLook, PixelGrid } from "./pixelArt";

/** One character in the line. */
export interface PapercutSkin {
 /** Stable id — the cache key and the sheet's column identity. */
 id: string;
 /** Display name (draft; these strings are not wired into the UI yet). */
 name: string;
 /** What the character IS — the one-line a shop card would show. */
 blurb: string;
 /** Colors: skin/shirt/pants/boots/hat (the in-game look shape). */
 look: MinerLook;
 /** Silhouette switches. */
 shape: SkinShape;
}

/**
 * The line, in sheet order: crew first (what the game already had), then
 * the cute/pretty half. Every id, name and colorway is distinct — the
 * test pins that, because a "skin line" with two identical members is a
 * bug, not a variant.
 */
export const PAPERCUT_SKINS: readonly PapercutSkin[] = [
 {
  id: "lantern-crew",
  name: "Lantern Crew",
  blurb: "the shift's hard-hat standard, lamp on the brim",
  look: {
   skin: "#ffdbb4",
   shirt: "#4a90d9",
   pants: "#3b4a6b",
   boots: "#4a3524",
   hat: "#e8c33d",
   hatStyle: "helmet",
  },
  shape: { form: "human", hatStyle: "helmet" },
 },
 {
  id: "frost-bit",
  name: "Frost Bit",
  blurb: "red beanie, green wool, still swinging the pick",
  look: {
   skin: "#f2c9a0",
   shirt: "#57a94f",
   pants: "#2f3b4a",
   boots: "#333333",
   hat: "#e8443a",
   hatStyle: "beanie",
  },
  shape: { form: "human", hatStyle: "beanie" },
 },
 {
  id: "deep-survey",
  name: "Deep Survey",
  blurb: "visor cap and a beard; has mapped every gallery twice",
  look: {
   skin: "#8d5524",
   shirt: "#f0f0f0",
   pants: "#7a5230",
   boots: "#3a2a1a",
   hat: "#3f8fd0",
   hatStyle: "cap",
  },
  shape: { form: "human", hatStyle: "cap", beard: true },
 },
 {
  id: "shift-foreman",
  name: "Shift Foreman",
  blurb: "white hard hat, red shirt, runs the whole seam",
  look: {
   skin: "#e07020",
   shirt: "#d9534f",
   pants: "#3b4a6b",
   boots: "#4a3524",
   hat: "#e8e8e8",
   hatStyle: "helmet",
  },
  shape: { form: "human", hatStyle: "helmet", beard: true },
 },
 {
  id: "fox-crew",
  name: "Fox Crew",
  blurb: "red bandana, and always the first down the ladder",
  look: {
   skin: "#e07020",
   shirt: "#3a4a5a",
   pants: "#c85a18",
   boots: "#3a2a1a",
   hat: "#e8443a",
   hatStyle: "bandana",
  },
  shape: { form: "critter", hatStyle: "bandana", cute: true },
 },
 {
  id: "marmot-crew",
  name: "Marmot Crew",
  blurb: "green beanie, permanently unbothered",
  look: {
   skin: "#a08058",
   shirt: "#d94f30",
   pants: "#8a6b48",
   boots: "#5a4630",
   hat: "#57a94f",
   hatStyle: "beanie",
  },
  shape: { form: "critter", hatStyle: "beanie" },
 },
 {
  id: "rose-lantern",
  name: "Rose Lantern",
  blurb: "long pink hair, lilac dress — carries the lamp basket",
  look: {
   skin: "#ffe3c8",
   shirt: "#b48cff",
   pants: "#8d6bb0",
   boots: "#e8a0c8",
   hat: "#ff9ecd",
   hatStyle: "longhair",
  },
  shape: { form: "human", hatStyle: "longhair", hair: "long", outfit: "dress", cute: true },
 },
 {
  id: "mint-comet",
  name: "Mint Comet",
  blurb: "mint ponytail; names every equation before it lands",
  look: {
   skin: "#f2c9a0",
   shirt: "#8fe3c0",
   pants: "#57a94f",
   boots: "#2f7a55",
   hat: "#7ad0e8",
   hatStyle: "longhair",
  },
  shape: {
   form: "human",
   hatStyle: "longhair",
   hair: "ponytail",
   outfit: "dress",
   cute: true,
  },
 },
 {
  id: "sky-bob",
  name: "Sky Bob",
  blurb: "sky-blue bob under a little orange beanie",
  look: {
   skin: "#ffe3c8",
   shirt: "#bdeeff",
   pants: "#4a90d9",
   boots: "#3b4a6b",
   hat: "#f2913a",
   hatStyle: "beanie",
  },
  shape: { form: "human", hatStyle: "beanie", hair: "bob", outfit: "dress", cute: true },
 },
 {
  id: "twin-bells",
  name: "Twin Bells",
  blurb: "twin tails, yellow dress, loudest lamp on the crew",
  look: {
   skin: "#f2c9a0",
   shirt: "#ffd166",
   pants: "#e8a33d",
   boots: "#8a5a2b",
   hat: "#ef476f",
   hatStyle: "longhair",
  },
  shape: { form: "human", hatStyle: "longhair", hair: "twin", outfit: "dress", cute: true },
 },
 {
  id: "blossom-bun",
  name: "Blossom Bun",
  blurb: "top knot, rose dress; runs the gem counters",
  look: {
   skin: "#ffe3c8",
   shirt: "#ff9ecd",
   pants: "#e07ba5",
   boots: "#c05f8a",
   hat: "#e8443a",
   hatStyle: "longhair",
  },
  shape: { form: "human", hatStyle: "longhair", hair: "bun", outfit: "dress", cute: true },
 },
 {
  id: "ember-sunrise",
  name: "Ember Sunrise",
  blurb: "ginger hair to the waist, amber dress, first up the ladder",
  look: {
   skin: "#f7d9c0",
   shirt: "#e8703a",
   pants: "#b4552a",
   boots: "#6a3a22",
   hat: "#e07020",
   hatStyle: "longhair",
  },
  shape: {
   form: "human",
   hatStyle: "longhair",
   hair: "long",
   outfit: "dress",
   cute: true,
  },
 },
];

/** The cute/pretty half of the line (the shop grouping it would sort into). */
export const PAPERCUT_SKIN_GROUPS = ["crew", "pretty"] as const;
export type PapercutSkinGroup = (typeof PAPERCUT_SKIN_GROUPS)[number];

/** Which half a skin belongs to: dress + cute face = the pretty group. */
export function papercutSkinGroup(skin: PapercutSkin): PapercutSkinGroup {
 return skin.shape.outfit === "dress" || skin.shape.cute === true
  ? "pretty"
  : "crew";
}

export const PAPERCUT_SKIN_IDS: readonly string[] = PAPERCUT_SKINS.map(
 (s) => s.id,
);

/** One skin by id (the cache-key lookup). */
export function papercutSkinById(id: string): PapercutSkin | undefined {
 return PAPERCUT_SKINS.find((s) => s.id === id);
}

/**
 * Render one skin: shape → label geometry → graded palette → the papercut
 * renderer. `direction` defaults to the picked one; the parameter exists so
 * the sheet script can show the same character in another direction for
 * comparison.
 */
export function buildPapercutSkinGrid(
 skin: PapercutSkin,
 opts: { direction?: DirectionId; seed?: number } = {},
): PixelGrid {
 const direction = opts.direction ?? "papercut";
 return renderDirection(
  direction,
  minerLabels(skin.shape),
  buildPalette(direction, "miner", { miner: skin.look }),
  opts.seed ?? 1,
 );
}

/** The skin grid size (re-exported so callers need one import, not two). */
export const PAPERCUT_SKIN_GRID_SIZE = DIRECTION_GRID_SIZE;