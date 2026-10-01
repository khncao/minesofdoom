/**
 * The PREMIUM CREW (legendary miners) — the endgame raw-output type, given
 * a cast instead of a colourway.
 *
 * Before this, every legendary row in the crew column rendered the player's
 * own look with a different seed: same body, different palette, at 24px,
 * nine rows deep. That is not a "premium" read. Each character here is a
 * package of four things that all point the same way:
 *
 *   name   what the crew calls them (shown in the shop's hire button)
 *   look   the in-game `MinerLook` (the same shape the rest of the art uses)
 *   shape  the silhouette axes + a `crown` mark worn OVER the headwear
 *   aura   an accent colour + a `motes` pattern floating around the body
 *
 * The crown and the motes are the "unique art style" part: a circlet, a
 * halo, a hood, antlers or crystal spikes change the silhouette, and embers /
 * frost / void / gold / bone / crystal motes are different mark-making, not
 * one dot pattern in six colours. On top of that `applyAura` adds the two
 * effects that sell "premium" at crew size: a rim light in the aura colour
 * along the top-left of the silhouette, and a soft ground glow under the
 * feet.
 *
 * Pure data + pure builder (papercut direction, via characterArt). The art
 * pack renders them (`artPack.minerSpriteUri(look, { premiumId })`); the
 * classic pixel pack ignores the id and draws the plain miner, so a swap back
 * to the old art needs no special case here.
 */
import {
 DIRECTION_GRID_SIZE,
 buildPalette,
 minerLabels,
 renderDirection,
} from "./characterArt";
import { darkenHex, lightenHex, mixHex } from "./detailPass";
import type {
  CrownStyle,
  LabelGrid,
  MoteStyle,
  Palette,
  SkinShape,
} from "./characterArt";
import type { MinerLook, PixelGrid } from "./pixelArt";

/** The aura families — each one owns a colour, a mote pattern and a mood. */
export const AURA_IDS = [
 "ember",
 "frost",
 "void",
 "gold",
 "bone",
 "crystal",
] as const;
export type AuraId = (typeof AURA_IDS)[number];

/** One premium character. `id` is the cache key and the roster identity. */
export interface PremiumChar {
 id: string;
 name: string;
 aura: AuraId;
 /** One line the shop would show under the name. */
 blurb: string;
 look: MinerLook;
 shape: SkinShape;
 /** The crown mark + the aura colour are the character's signature. */
 crown: CrownStyle;
 motes: MoteStyle;
 accent: string;
}

/**
 * The cast, in HIRE order: the first legendary miner a player buys is Ember,
 * the second Rime, and so on (`premiumCharForIndex`). The line is long
 * enough that a maxed crew wraps (rosterDisplay caps the visible legendary
 * rows well below the line), and every character is distinct in silhouette,
 * palette and mote pattern.
 */
export const PREMIUM_CHARS: readonly PremiumChar[] = [
 {
  id: "ember",
  name: "Ember",
  aura: "ember",
  blurb: "the forge-heart: the rock sweats heat where she swings",
  look: {
   skin: "#f2c9a0",
   shirt: "#b0341c",
   pants: "#3a2028",
   boots: "#2a1a18",
   hat: "#e8590c",
   hatStyle: "helmet",
  },
  shape: { form: "human", hatStyle: "helmet", beard: true, outfit: "trousers" },
  crown: "crown",
  motes: "embers",
  accent: "#ffb454",
 },
 {
  id: "rime",
  name: "Rime",
  aura: "frost",
  blurb: "keeps the shift's water from ever freezing over",
  look: {
   skin: "#ffe3c8",
   shirt: "#7fd4ff",
   pants: "#2e5f80",
   boots: "#dff2ff",
   hat: "#e8f6ff",
   hatStyle: "beanie",
  },
  shape: { form: "human", hatStyle: "beanie", outfit: "dress" },
  crown: "halo",
  motes: "frost",
  accent: "#bff0ff",
 },
 {
  id: "vesper",
  name: "Vesper",
  aura: "void",
  blurb: "works the seam after the lamps go out",
  look: {
   skin: "#d8c0e8",
   shirt: "#2b1f4a",
   pants: "#171029",
   boots: "#0f0a1c",
   hat: "#3a2a6a",
   hatStyle: "beanie",
  },
  shape: { form: "human", hatStyle: "beanie", outfit: "trousers" },
  crown: "hood",
  motes: "void",
  accent: "#a06bff",
 },
 {
  id: "gilded",
  name: "Gilded",
  aura: "gold",
  blurb: "counts every gem twice — once for the math, once for luck",
  look: {
   skin: "#f7d9c0",
   shirt: "#e8c33d",
   pants: "#8a5a12",
   boots: "#5a3a0a",
   hat: "#fff3b0",
   hatStyle: "cap",
  },
  shape: { form: "human", hatStyle: "cap", beard: true, outfit: "trousers" },
  crown: "plume",
  motes: "gold",
  accent: "#fff0a8",
 },
 {
  id: "marrow",
  name: "Marrow",
  aura: "bone",
  blurb: "reads the rock like a page, and says what is coming",
  look: {
   skin: "#e8e0cc",
   shirt: "#4a5c3a",
   pants: "#2f3a26",
   boots: "#d8cfb4",
   hat: "#7d8a5a",
   hatStyle: "longhair",
  },
  shape: { form: "human", hatStyle: "longhair", hair: "long", outfit: "trousers" },
  crown: "antlers",
  motes: "bone",
  accent: "#e8e4c8",
 },
 {
  id: "quartz",
  name: "Quartz",
  aura: "crystal",
  blurb: "the seam sings to her and she sings back",
  look: {
   skin: "#ffe3c8",
   shirt: "#3ac0c0",
   pants: "#7d3ab0",
   boots: "#2a2a4a",
   hat: "#b48cff",
   hatStyle: "helmet",
  },
  shape: { form: "human", hatStyle: "helmet", hair: "ponytail", outfit: "dress" },
  crown: "crystal",
  motes: "crystal",
  accent: "#8ff0ff",
 },
];

export const PREMIUM_CHAR_IDS: readonly string[] = PREMIUM_CHARS.map(
 (c) => c.id,
);

export function premiumCharById(id: string): PremiumChar | undefined {
 return PREMIUM_CHARS.find((c) => c.id === id);
}

/**
 * Which character a given legendary hire is. Hire order, wrapping past the
 * end of the line so a maxed crew keeps naming characters.
 */
export function premiumCharForIndex(index: number): PremiumChar {
 const n = PREMIUM_CHARS.length;
 const i = ((Math.floor(index) % n) + n) % n;
 return PREMIUM_CHARS[i];
}

/**
 * The character's palette: the papercut grade of their look, with the aura
 * colour pushed into the slots that read as "energy" (the aura mark itself,
 * the helmet lamp and the pickaxe glint) so the character and their tool
 * share one signature colour.
 */
function premiumPalette(char: PremiumChar): Palette {
 return {
  ...buildPalette("papercut", "miner", { miner: char.look }),
  aura: char.accent,
  lamp: char.accent,
  bladeShine: lightenHex(char.accent, 0.25),
 };
}

/**
 * The two "premium" light effects, applied AFTER the direction renderer:
 *
 *  - a RIM LIGHT along the TOP edge: every opaque pixel whose pixel above is
 *    empty is mixed toward the aura colour, so the character's crown, hair
 *    and shoulders catch their own light. Top-only on purpose — rimming the
 *    left edge as well outlines the whole sprite and swallows the art;
 *  - a GROUND GLOW: the lowest opaque pixel of each column is mixed toward
 *    the aura colour (weaker than the rim), so the character sits on a pool
 *    of their own light instead of floating on the cave.
 *
 * Pure, and never touches a transparent pixel.
 */
export function applyAura(grid: PixelGrid, accent: string): PixelGrid {
 const h = grid.length;
 const w = grid[0].length;
 const out = grid.map((row) => [...row]);
 // Lowest opaque pixel per column, for the ground glow.
 const lowest = new Array<number>(w).fill(-1);
 for (let x = 0; x < w; x++) {
  for (let y = h - 1; y >= 0; y--) {
   if (out[y][x] != null) {
    lowest[x] = y;
    break;
   }
  }
 }
 for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
   const c = out[y][x];
   if (c == null) continue;
   const litFromAbove = y === 0 || out[y - 1][x] == null;
   if (litFromAbove) {
    out[y][x] = mixHex(c, accent, 0.45);
   } else if (lowest[x] === y) {
    out[y][x] = mixHex(c, accent, 0.3);
   }
  }
 }
 return out;
}

/**
 * Re-stamp the `aura` material with the character's exact accent AFTER the
 * direction renderer. The renderer treats the aura like any other material
 * and lightens its value planes, which desaturates the signature color; the
 * crown and the motes have to land as pure aura or they read as "some
 * highlight" instead of "this character's light".
 */
function stampAura(
 labels: LabelGrid,
 grid: PixelGrid,
 accent: string,
): void {
 for (let y = 0; y < labels.length; y++) {
  for (let x = 0; x < labels[y].length; x++) {
   if (labels[y][x] === "aura" && grid[y][x] != null) grid[y][x] = accent;
  }
 }
}

/** Render one premium character (papercut direction + their aura). */
export function buildPremiumCharGrid(char: PremiumChar): PixelGrid {
 const labels = minerLabels({
  ...char.shape,
  crown: char.crown,
  motes: char.motes,
  // The crew draws its own pickaxe as a rotating sprite.
  tool: false,
 });
 const grid = applyAura(
  renderDirection("papercut", labels, premiumPalette(char)),
  char.accent,
 );
 stampAura(labels, grid, char.accent);
 return grid;
}

/** Grid size of a premium sprite (re-exported so callers need one import). */
export const PREMIUM_CHAR_GRID_SIZE = DIRECTION_GRID_SIZE;

/** Accent colour of a character, for shop UI (the sprite's aura colour). */
export function premiumAccent(id: string): string {
 return premiumCharById(id)?.accent ?? "#ffffff";
}

/** A darker accent, for text/shadow tints derived from the aura colour. */
export function premiumAccentDark(id: string): string {
 return darkenHex(premiumAccent(id), 0.35);
}
