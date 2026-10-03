/**
 * THE CREW CAST — every purchasable miner is a CHARACTER, in three lines.
 *
 * Before this, all three crew types in the shaft column rendered the player's
 * own look with a different seed: same body, different palette, at 24px,
 * nine rows deep. That is not what a bought character looks like. Each
 * character here is a package of things that all point the same way:
 *
 *   name   what the crew calls them (shown in the shop's hire button, and on
 *          the per-crew outfit wearer chips for the ordinary line)
 *   look   the in-game `MinerLook` (the same shape the rest of the art uses)
 *   shape  the silhouette axes + the `crown` mark worn OVER the headwear
 *   aura   an accent colour + a `motes` pattern floating around the body
 *
 * The three lines, and how far up the ladder each one is dressed:
 *
 *   normal     4 visible rows, bought with minerals. NAMED FACES ONLY — no
 *              mark, no motes, no light effects. They are your hires in your
 *              company's gear, and the aura language is reserved for the two
 *              gem tiers, so the ladder stays readable: work > speed > power.
 *              Their colours still come from the assigned outfit when the
 *              player has dressed them (the wardrobe rule, below).
 *   fast       2 visible rows, bought with gems in the Deep Shaft. Working
 *              marks (goggles / kerchief / crest / wings) and MOTION motes
 *              (dust / streaks / sparks / swirl) — a rim light, no ground
 *              pool, because they are always on the move.
 *   legendary  1 visible row, the endgame gem sink. Grand marks (crown /
 *              halo / hood / antlers / plume / crystal) with static, precious
 *              motes, plus both light effects: a rim light along the
 *              silhouette and a ground glow.
 *
 * Cast order is HIRE order (`crewCharForIndex`), so the shop can name who
 * walks in next. Pure data + pure builder (papercut direction, via
 * characterArt). The art pack renders them
 * (`artPack.minerSpriteUri(look, { crewId })`); the classic pixel pack
 * ignores the id and draws the plain miner, so a swap back to the old art
 * needs no special case here.
 */
import {
 DIRECTION_GRID_SIZE,
 buildPalette,
 minerLabels,
 renderDirection,
 shapeForLook,
} from "./characterArt";
import { darkenHex, lightenHex, mixHex } from "./detailPass";
import type {
 CrownStyle,
 HairStyle,
 LabelGrid,
 MoteStyle,
 Palette,
 SkinShape,
} from "./characterArt";
import type { MinerHair, MinerLook, PixelGrid } from "./pixelArt";

/** The three purchasable crew lines (see the roster kinds in cosmetics.ts). */
export type CrewLine = "normal" | "fast" | "legendary";

/** The aura families — each one owns a colour, a mote pattern and a mood. */
export const AURA_IDS = [
 "ember",
 "frost",
 "void",
 "gold",
 "bone",
 "crystal",
 // fast line
 "spark",
 "wind",
 "dust",
 "charge",
 // ordinary line: no mark and no motes, but a name and a face
 "brass",
 "moss",
 "clay",
 "chalk",
] as const;
export type AuraId = (typeof AURA_IDS)[number];

/** How far up the purchase ladder a line's light effects go. */
export interface AuraFx {
 /** Accent mix on the top edge of the silhouette (0 = none). */
 rim: number;
 /** Accent mix on the lowest pixel of each column (0 = none). */
 glow: number;
}

/** One crew character. `id` is the cache key and the roster identity. */
export interface CrewChar {
 id: string;
 line: CrewLine;
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
 fx: AuraFx;
}

/** The legendary line: rim light AND a ground pool. */
const PREMIUM_FX: AuraFx = { rim: 0.45, glow: 0.3 };
/** The fast line: rim only — they never stand still long enough to pool. */
const FAST_FX: AuraFx = { rim: 0.35, glow: 0 };
/** The ordinary line: no effects. The mark vocabulary belongs to the gems. */
const PLAIN_FX: AuraFx = { rim: 0, glow: 0 };

/**
 * The ORDINARY crew — mineral hires, one per visible slot
 * (`ROSTER_ASSIGNABLE_SLOTS` is 4, so slots 1..4 are exactly this cast).
 *
 * Four different people: distinct headwear, hair, beards, dresses and faces,
 * with no mark and no aura so the gem tiers keep their glow. Their colours
 * are the player's outfit's (or their own, until an outfit is assigned — the
 * wardrobe rule in `crewLookFor`), which is the whole point of hiring help:
 * they work in the gear you bought for the shift.
 */
export const NORMAL_CHARS: readonly CrewChar[] = [
 {
  id: "cog",
  name: "Cog",
  line: "normal",
  aura: "brass",
  blurb: "first through the door every shift, and the last to admit it",
  look: {
   skin: "#e8b98d",
   shirt: "#c8842a",
   pants: "#4a3a26",
   boots: "#33261a",
   hat: "#e0a53c",
   hatStyle: "cap",
  },
  shape: { form: "human", hatStyle: "cap", beard: true, outfit: "trousers" },
  crown: "none",
  motes: "none",
  accent: "#ffcf6b",
  fx: PLAIN_FX,
 },
 {
  id: "pebble",
  name: "Pebble",
  line: "normal",
  aura: "moss",
  blurb: "quiet, quick, and never once late to the winch",
  look: {
   skin: "#f2c9a0",
   shirt: "#6f8f4a",
   pants: "#3d4a2c",
   boots: "#2c3420",
   hat: "#8fae5c",
   hatStyle: "beanie",
  },
  shape: { form: "human", hatStyle: "beanie", outfit: "trousers", cute: true },
  crown: "none",
  motes: "none",
  accent: "#c8e88c",
  fx: PLAIN_FX,
 },
 {
  id: "tally",
  name: "Tally",
  line: "normal",
  aura: "clay",
  blurb: "keeps the books, and the books keep the shift",
  look: {
   skin: "#c98d63",
   shirt: "#a05a4a",
   pants: "#5a3630",
   boots: "#3a2622",
   hat: "#8a4a3a",
   hatStyle: "bandana",
  },
  shape: { form: "human", hatStyle: "bandana", hair: "ponytail", outfit: "dress" },
  crown: "none",
  motes: "none",
  accent: "#f0a48c",
  fx: PLAIN_FX,
 },
 {
  id: "bramble",
  name: "Bramble",
  line: "normal",
  aura: "chalk",
  blurb: "has been down here so long the rock calls them by name",
  look: {
   skin: "#e8d8b8",
   shirt: "#9a9276",
   pants: "#4a4838",
   boots: "#2e2c22",
   hat: "#cfc4a0",
   hatStyle: "longhair",
  },
  shape: { form: "human", hatStyle: "longhair", hair: "long", beard: true },
  crown: "none",
  motes: "none",
  accent: "#f0e8c8",
  fx: PLAIN_FX,
 },
];

/**
 * The FAST crew — gem hires in the Deep Shaft, the two "fast miner" rows.
 *
 * Working marks and motion motes: these are the characters who run the
 * galleries, so nothing about them is static. Cast order is hire order.
 */
export const FAST_CHARS: readonly CrewChar[] = [
 {
  id: "flint",
  name: "Flint",
  line: "fast",
  aura: "spark",
  blurb: "strikes first and hardest, and apologises never",
  look: {
   skin: "#e8b98d",
   shirt: "#d8582a",
   pants: "#3a2a34",
   boots: "#241a20",
   hat: "#a04a18",
   hatStyle: "beanie",
  },
  shape: { form: "human", hatStyle: "beanie", beard: true, outfit: "trousers" },
  crown: "crest",
  motes: "sparks",
  accent: "#ffb03c",
  fx: FAST_FX,
 },
 {
  id: "gale",
  name: "Gale",
  line: "fast",
  aura: "wind",
  blurb: "moves down the shaft like the air got there first",
  look: {
   skin: "#ffe3c8",
   shirt: "#9fd0e8",
   pants: "#33566b",
   boots: "#dff2ff",
   hat: "#5a8fb0",
   hatStyle: "cap",
  },
  shape: { form: "human", hatStyle: "cap", outfit: "trousers" },
  crown: "wings",
  motes: "streaks",
  accent: "#9fe8ff",
  fx: FAST_FX,
 },
 {
  id: "cinder",
  name: "Cinder",
  line: "fast",
  aura: "dust",
  blurb: "kicks up so much dust the winch crew wears masks",
  look: {
   skin: "#c98d63",
   shirt: "#b07a3a",
   pants: "#4a3a1e",
   boots: "#2e2414",
   hat: "#8a5a2a",
   hatStyle: "bandana",
  },
  shape: { form: "human", hatStyle: "bandana", beard: true, outfit: "trousers" },
  crown: "kerchief",
  motes: "dust",
  accent: "#e8b464",
  fx: FAST_FX,
 },
 {
  id: "bolt",
  name: "Bolt",
  line: "fast",
  aura: "charge",
  blurb: "counts the seconds between carts, out loud",
  look: {
   skin: "#f7d9c0",
   shirt: "#5a5ac0",
   pants: "#2b2b55",
   boots: "#1a1a30",
   hat: "#4a4a9a",
   hatStyle: "helmet",
  },
  shape: { form: "human", hatStyle: "helmet", outfit: "trousers" },
  crown: "goggles",
  motes: "swirl",
  accent: "#a8a8ff",
  fx: FAST_FX,
 },
];

/**
 * The cast, in HIRE order: the first legendary miner a player buys is Ember,
 * the second Rime, and so on (`crewCharForIndex`). The line is long enough
 * that a maxed crew wraps (rosterDisplay caps the visible legendary rows
 * well below the line), and every character is distinct in silhouette,
 * palette and mote pattern.
 */
export const LEGENDARY_CHARS: readonly CrewChar[] = [
 {
  id: "ember",
  name: "Ember",
  line: "legendary",
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
  fx: PREMIUM_FX,
 },
 {
  id: "rime",
  name: "Rime",
  line: "legendary",
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
  fx: PREMIUM_FX,
 },
 {
  id: "vesper",
  name: "Vesper",
  line: "legendary",
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
  fx: PREMIUM_FX,
 },
 {
  id: "gilded",
  name: "Gilded",
  line: "legendary",
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
  fx: PREMIUM_FX,
 },
 {
  id: "marrow",
  name: "Marrow",
  line: "legendary",
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
  fx: PREMIUM_FX,
 },
 {
  id: "quartz",
  name: "Quartz",
  line: "legendary",
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
  fx: PREMIUM_FX,
 },
];

/** Every cast, by line. */
export const CREW_CASTS: Record<CrewLine, readonly CrewChar[]> = {
 normal: NORMAL_CHARS,
 fast: FAST_CHARS,
 legendary: LEGENDARY_CHARS,
};

/** Every character in the game, cast-flat. */
export const ALL_CREW_CHARS: readonly CrewChar[] = [
 ...NORMAL_CHARS,
 ...FAST_CHARS,
 ...LEGENDARY_CHARS,
];

export const CREW_CHAR_IDS: readonly string[] = ALL_CREW_CHARS.map((c) => c.id);

export function crewCharById(id: string): CrewChar | undefined {
 return ALL_CREW_CHARS.find((c) => c.id === id);
}

/**
 * Which character a given hire is, per line. Hire order, wrapping past the
 * end of a line so a maxed crew keeps naming characters.
 */
export function crewCharForIndex(
 line: CrewLine,
 index: number,
): CrewChar {
 const cast = CREW_CASTS[line];
 const n = cast.length;
 const i = ((Math.floor(index) % n) + n) % n;
 return cast[i];
}

/**
 * The character's palette: the papercut grade of their look, with the aura
 * colour pushed into the slots that read as "energy" (the aura mark itself,
 * the helmet lamp and the pickaxe glint) so the character and their tool
 * share one signature colour.
 */
function crewPalette(char: CrewChar, look: MinerLook): Palette {
 return {
  ...buildPalette("papercut", "miner", { miner: look }),
  aura: char.accent,
  lamp: char.accent,
  bladeShine: lightenHex(char.accent, 0.25),
 };
}

/**
 * THE WARDROBE RULE: a character's FACE is theirs, their clothes are the
 * player's.
 *
 * `rolled` is the look the game built for the row (`rollMinerLook(seed,
 * outfitId)` — the outfit the player assigned that crew slot, or the player's
 * own outfit when the slot is undressed). When an outfit is assigned, its
 * colours and headwear win and the character keeps their face (hair, beard,
 * dress, expression) — so dressing a hire changes their gear without turning
 * them back into a seeded look. With `own` (nothing assigned), the character
 * wears their own palette instead.
 */
export function crewLookFor(
 char: CrewChar,
 rolled: MinerLook,
 own: boolean,
): MinerLook {
 const base = own ? char.look : rolled;
 return {
  ...base,
  hair: gameHair(char.shape.hair),
  beard: char.shape.beard ?? false,
  outfit: char.shape.outfit ?? "trousers",
  cute: char.shape.cute ?? false,
 };
}

/**
 * The hair styles the GAME model knows. `SkinShape.hair` is deliberately
 * wider (the cut-paper-only `braid` and `waves` are authored per skin), and a
 * crew character's hair travels back through a `MinerLook` — so anything the
 * classic 16×16 pipeline has never heard of is dropped here rather than
 * widening the look type (and the save data with it).
 */
function gameHair(style: HairStyle | undefined): MinerHair | undefined {
 switch (style) {
  case "bob":
  case "long":
  case "ponytail":
  case "twin":
  case "bun":
   return style;
  default:
   return undefined;
 }
}

/**
 * The two "premium" light effects, applied AFTER the direction renderer:
 *
 *  - a RIM LIGHT along the TOP edge: every opaque pixel whose pixel above is
 *    empty is mixed toward the aura colour, so the character's crown, hair
 *    and shoulders catch their own light. Top-only on purpose — rimming the
 *    left edge as well outlines the whole sprite and swallows the art;
 *  - a GROUND GLOW: the lowest opaque pixel of each column is mixed toward
 *    the aura colour, so the character sits on a pool of their own light
 *    instead of floating on the cave.
 *
 * Strengths come from the character's own `fx` (a zero on either side skips
 * that pass). Pure, and never touches a transparent pixel.
 */
export function applyAura(
 grid: PixelGrid,
 accent: string,
 fx: AuraFx = PREMIUM_FX,
): PixelGrid {
 const h = grid.length;
 const w = grid[0].length;
 const out = grid.map((row) => [...row]);
 if (fx.rim <= 0 && fx.glow <= 0) return out;
 // Lowest opaque pixel per column, for the ground glow.
 const lowest = new Array<number>(w).fill(-1);
 if (fx.glow > 0) {
  for (let x = 0; x < w; x++) {
   for (let y = h - 1; y >= 0; y--) {
    if (out[y][x] != null) {
     lowest[x] = y;
     break;
    }
   }
  }
 }
 for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
   const c = out[y][x];
   if (c == null) continue;
   const litFromAbove = y === 0 || out[y - 1][x] == null;
   if (litFromAbove && fx.rim > 0) {
    out[y][x] = mixHex(c, accent, fx.rim);
   } else if (lowest[x] === y && fx.glow > 0) {
    out[y][x] = mixHex(c, accent, fx.glow);
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

/**
 * Render one crew character (papercut direction + their aura).
 *
 * `look` overrides the character's own colours — the wardrobe rule. The
 * ordinary crew wear the outfit the player assigned them, keeping their own
 * face; the gem tiers ignore it and are drawn whole (their look is part of
 * the character, and there is no per-crew outfit assignment for them).
 */
export function buildCrewCharGrid(
 char: CrewChar,
 look: MinerLook = char.look,
): PixelGrid {
 // The face is ALWAYS the character's (the wardrobe rule, applied
 // idempotently — callers that already merged it get the same look back).
 const worn = crewLookFor(char, look, false);
 const palette = crewPalette(char, worn);
 // The look owns the headwear (so an assigned outfit can change the hat);
 // the character owns everything above it: crown, motes, and their face.
 const labels = minerLabels({
  ...shapeForLook(worn),
  crown: char.crown,
  motes: char.motes,
 });
 const grid = applyAura(
  renderDirection("papercut", labels, palette),
  char.accent,
  char.fx,
 );
 stampAura(labels, grid, char.accent);
 return grid;
}

/** Grid size of a crew sprite (re-exported so callers need one import). */
export const CREW_CHAR_GRID_SIZE = DIRECTION_GRID_SIZE;

/** Accent colour of a character, for shop UI (the sprite's aura colour). */
export function crewAccent(id: string): string {
 return crewCharById(id)?.accent ?? "#ffffff";
}

/** A darker accent, for text/shadow tints derived from the aura colour. */
export function crewAccentDark(id: string): string {
 return darkenHex(crewAccent(id), 0.35);
}