// Types come in through `import type` so this module can also be loaded by
// the Node art-preview scripts, which strip types rather than compile them
// (a value import of a type-only export is a runtime error there).
import type { SkinShape, ToolId } from "src/utils/graphics/characterArt";
import type {
  HatStyle,
  MinerHair,
  MinerLook,
  MinerSpecies,
  PickaxeThemeDef,
} from "src/utils/graphics/pixelArt";
import { hashSeed, mulberry32 } from "src/utils/graphics/pixelArt";

/**
 * Cosmetic content (plan §5.2 / §4.3 cosmetic line, programmatic variant).
 * Everything is buyable in gems; the IAP cosmetic pack is a later currency
 * for the *same* items. Skins/pickaxes are pure pixel recolors of the
 * programmatic sprites — no art assets.
 */

/**
 * An outfit's authored SILHOUETTE — the axes a paid outfit owns, so buying it
 * buys a character and not a palette. `Omit` of the skin line's shape: the
 * tool is never part of a body, and `motes` (the aura) stays with the crew's
 * gem tiers. `crown` IS allowed — the mark over the headwear is how a namesake
 * announces itself (horns for the oni, a plume for the knight, a hood for the
 * night shift), and the player's own slot is exactly where that belongs.
 */
export type OutfitShape = Omit<SkinShape, "tool" | "motes">;

export type OutfitCosmetic = {
  id: string;
  name: string;
  /** 0 = owned from the start, otherwise the gem price. */
  costGems: number;
  /** Cash price tier (see CASH_PRICE_USD). */
  cashTier: CashTier;
  /** Optional one-line flavor/shown in the picker (e.g. homage credit). */
  blurb?: string;
  /**
   * The character's shape, read by the papercut art pack (docs/art-directions.md)
   * and ignored by the classic one. AUTHORED, never rolled: the colors still
   * reroll per player seed, but the body is the item. Absent on the free
   * starter outfit, which is deliberately the plain default miner.
   */
  shape?: OutfitShape;
  /**
   * Body type (plan §4.5): "human" (default) or "animal" (round critter —
   * see buildAnimalBody in pixelArt.ts). Animal outfits must set `fur`.
   */
  species?: MinerSpecies;
  /** Color pools the randomizer draws from for this outfit. */
  shirts: string[];
  pants: string[];
  boots: string[];
  hats: string[];
  hatStyles: HatStyle[];
  /**
   * Fur pool for animal outfits (drives the look's `skin` field); human
   * outfits draw skin from the shared SKIN_TONES pool.
   */
  fur?: string[];
};

/**
 * Swing animation "feel" (plan §5.2 "unique ... animations"): how the
 * equipped pickaxe swings when mining — heavier pickaxes swing slower and
 * bounce harder. Pure animation data, no gameplay effect.
 */
export type PickaxeFeel = {
  /** Swing-rotation duration in ms (lower = snappier). */
  swingMs: number;
  /** Body bounce depth in px on impact. */
  bounceDepth: number;
};

export type PickaxeCosmetic = {
  id: string;
  name: string;
  costGems: number;
  /** Cash price tier (see CASH_PRICE_USD). */
  cashTier: CashTier;
  /**
   * The tool this pickaxe IS — the line's silhouette axis. Eight distinct
   * objects, not eight colors of one crescent: the shape, the swing feel and
   * the strike sound all change together (characterArt.TOOLS draws the
   * silhouette; the classic `pixel` pack falls back to the colorway).
   */
  tool: ToolId;
  /** What the tool is called on its own ("Mattock", "Prism Cutter"). */
  toolName: string;
  /** One-line flavor, shown on the card. */
  blurb: string;
  theme: PickaxeThemeDef;
  /** Unique swing sound, relative to public/assets (required in assets/index).
   *  Synthesized by scripts/generate-pickaxe-sounds.mjs. */
  soundFile: string;
  /** Unique swing animation (plan §5.2 "unique ... animations"). */
  feel: PickaxeFeel;
};

/**
 * CASH PRICE TIERS — how much NEW art an item carries, not what it costs in
 * gems.
 *
 * The cash price of a pack is chosen by what the player actually gets:
 *
 *   1  a recolor of something the player already owns — a palette swap, a
 *      tint ramp, or a shape the line already had
 *   2  a new character or look the line didn't have: a new headwear/hair/
 *      dress silhouette, a new tool shape, a new theme palette
 *   3  a new shape AND something that plays: a critter form, an animated
 *      swing feel, its own strike sound, a faceted/refracting treatment
 *   4  the line's hero items — the most hand-drawn art in the catalog
 *
 * Gem prices are the OTHER axis (how much the item is worth in the
 * economy); they were tuned by the F2P balance test and don't move with
 * this table. Every cosmetic carries its tier explicitly, so a price can't
 * drift when a gem price is rebalanced.
 *
 * ALREADY-SOLD ITEMS KEEP THE PRICE THEY LAUNCHED AT. A Stripe price is
 * immutable, so re-tiering a product on sale would leave the shop showing
 * one amount and the checkout charging another — the exact "misleading
 * price" guardrail 4 rules out. Re-tiering an existing product therefore
 * needs a new Stripe price object (archive the old one) plus a Play price
 * change, in that order, and only then does the tier move. The depth tiers
 * govern new items and any deliberate re-price.
 */
export type CashTier = 1 | 2 | 3 | 4;

export const CASH_PRICE_USD: Record<CashTier, number> = {
 1: 0.99,
 2: 1.99,
 3: 2.99,
 4: 3.99,
};

/** Display label for a tier (what the shop button and the Stripe catalog
 *  use; the cent amount comes from CASH_PRICE_USD). */
export function cashPriceLabel(tier: CashTier): string {
 return `$${CASH_PRICE_USD[tier].toFixed(2)}`;
}

/** Shared skin-tone pool (all outfits). */
const SKIN_TONES = ["#ffdbb4", "#f2c9a0", "#e0ac69", "#c68642", "#8d5524"];

export const OUTFITS: OutfitCosmetic[] = [
  {
    id: "classic",
    name: "Classic Crew",
    cashTier: 1,
    costGems: 0,
    shirts: ["#e8a33d", "#4a90d9", "#d9534f", "#5cb85c", "#8e6fc0"],
    pants: ["#3b4a6b", "#555b66", "#4a3b2a"],
    boots: ["#4a3524", "#333333"],
    hats: ["#e8c33d", "#f0f0f0", "#e8e8e8", "#d9534f"],
    hatStyles: ["helmet", "beanie", "cap"],
  },
  {
    id: "night",
    name: "Night Shift",
    cashTier: 1,
    costGems: 15,
    shape: { hatStyle: "beanie", beard: true, build: "sturdy", crown: "hood" },
    shirts: ["#3a4a7a", "#4a3a7a", "#2b3a5c", "#5a4a8a"],
    pants: ["#22283a", "#2a2f45"],
    boots: ["#1a1a24", "#333344"],
    hats: ["#333344", "#444455", "#2b2b3a"],
    hatStyles: ["beanie"],
  },
  {
    id: "goldrush",
    name: "Gold Rush",
    cashTier: 1,
    costGems: 25,
    shape: { hatStyle: "helmet", build: "sturdy", prop: "satchel" },
    shirts: ["#e8c33d", "#d4a017", "#f0d060", "#c89010"],
    pants: ["#5a4a20", "#6b5a30"],
    boots: ["#4a3524", "#3a2a18"],
    hats: ["#f0d060", "#e8c33d", "#fff3b0"],
    hatStyles: ["helmet"],
  },
  {
    id: "crystal",
    name: "Crystal Miner",
    cashTier: 2,
    costGems: 40,
    shape: { hatStyle: "beanie", build: "slim", cute: true, crown: "crystal" },
    shirts: ["#3ac0c0", "#2a90d9", "#7fe0d0", "#40b0e0"],
    pants: ["#2a4a5a", "#1f3a4a"],
    boots: ["#1a2f3a", "#2a3f4a"],
    hats: ["#a0f0f0", "#d0fbff", "#70d8e8"],
    hatStyles: ["beanie"],
  },
  {
    id: "magma",
    name: "Lava Worker",
    cashTier: 2,
    costGems: 50,
    shape: { hatStyle: "bandana", beard: true, build: "sturdy" },
    shirts: ["#d94f30", "#e07020", "#b03020", "#f09030"],
    pants: ["#4a2a1a", "#3a2015"],
    boots: ["#2a1a10", "#3a251a"],
    hats: ["#f09030", "#d94f30", "#b03020"],
    hatStyles: ["bandana"],
  },
  // Homage line (plan §4.5 / art todo): original palettes that evoke famous
  // game worlds WITHOUT using any of their names, sprites, or assets — an
  // homage, not a copy, so it stays clear of copyright/trademark.
  {
    id: "blocky",
    name: "Blocky Adventurer",
    cashTier: 1,
    costGems: 30,
    blurb: "a voxel-sandbox tribute",
    shape: { hatStyle: "cap", build: "sturdy", crown: "goggles" },
    shirts: ["#2f88c4", "#35a0cc", "#2a6a98"],
    pants: ["#3a5aa8", "#2a4a8a"],
    boots: ["#565b6e", "#3a3f4e"],
    hats: ["#2f88c4", "#e8e8e8", "#565b6e"],
    hatStyles: ["cap"],
  },
  {
    id: "surface",
    name: "Frontier Explorer",
    cashTier: 2,
    costGems: 40,
    blurb: "a surface-to-underground sandbox tribute",
    shape: { hatStyle: "cap", build: "slim", beard: true },
    shirts: ["#4a8a3a", "#6aa84a", "#3a7030"],
    pants: ["#6a4a2a", "#5a3e20"],
    boots: ["#4a3018", "#3a2810"],
    hats: ["#7a5a3a", "#8a6a4a", "#4a8a3a"],
    hatStyles: ["cap"],
  },
  {
    id: "knight",
    name: "Ashen Knight",
    cashTier: 2,
    costGems: 50,
    blurb: "a dark-fantasy soulslike tribute",
    shape: { hatStyle: "helmet", beard: true, build: "sturdy", crown: "plume" },
    shirts: ["#8a9099", "#6a707a", "#5a606a"],
    pants: ["#4a4e58", "#3a3e48"],
    boots: ["#33363e", "#262932"],
    hats: ["#7a808a", "#9aa0aa", "#5a606a"],
    hatStyles: ["helmet"],
  },
  {
    id: "hunter",
    name: "Wandering Hunter",
    cashTier: 2,
    costGems: 60,
    blurb: "a gothic hunt tribute",
    shape: { hatStyle: "bandana", build: "slim", prop: "satchel" },
    shirts: ["#4a5a3a", "#3a4a2a", "#5a4a3a"],
    pants: ["#3a3a2a", "#2e2e22"],
    boots: ["#2a241a", "#1f1a12"],
    hats: ["#5a4a3a", "#4a3a2a", "#6a5a4a"],
    hatStyles: ["bandana"],
  },
  {
    id: "oni",
    name: "Crimson Oni",
    cashTier: 3,
    costGems: 75,
    blurb: "a samurai-era vengeance tribute",
    shape: { hatStyle: "bandana", build: "sturdy", crown: "horns" },
    shirts: ["#b03030", "#c04040", "#8a2020"],
    pants: ["#2a1a20", "#241a1c"],
    boots: ["#1a1014", "#140c10"],
    hats: ["#b03030", "#8a2020", "#2a1a20"],
    hatStyles: ["bandana"],
  },
  // Critter line (plan §4.5 / art todo): full animal bodies
  // (species: "animal" — round heads, ears, vests, tails; see
  // buildAnimalBody in pixelArt.ts). `fur` drives the look's skin field.
  {
    id: "marmot",
    name: "Burrow Marmot",
    cashTier: 2,
    costGems: 60,
    blurb: "a pocket-sized rodent with a pickaxe bigger than it",
    species: "animal",
    fur: ["#a08058", "#8a6b48", "#b89868"],
    shape: { hatStyle: "beanie", cute: true, prop: "basket" },
    shirts: ["#d94f30", "#e8a33d", "#5cb85c", "#4a90d9"],
    pants: ["#8a6b48", "#a08058", "#7a5c3e"],
    boots: ["#5a4630", "#4a3826"],
    hats: ["#e8c33d", "#d9534f", "#5cb85c", "#4a90d9"],
    hatStyles: ["beanie"],
  },
  {
    id: "fox",
    name: "Fox of the Vein",
    cashTier: 3,
    costGems: 70,
    blurb: "all fire, no smoke — the crew's resident gambler",
    species: "animal",
    fur: ["#e07020", "#c85a18", "#f09040"],
    shape: { hatStyle: "bandana", prop: "satchel" },
    shirts: ["#3a4a5a", "#2b3a5c", "#4a3a7a"],
    pants: ["#c85a18", "#e07020", "#a84810"],
    boots: ["#3a2a1a", "#2e2214"],
    hats: ["#e8e8e8", "#d9534f", "#3a4a5a"],
    hatStyles: ["bandana"],
  },
  {
    id: "otter",
    name: "Otter of the River",
    cashTier: 3,
    costGems: 85,
    blurb: "rivers' finest — hoards shiny things in a nest of pebbles",
    species: "animal",
    fur: ["#7a5a3a", "#6a4e32", "#8a6b4a"],
    shape: { hatStyle: "cap", cute: true },
    shirts: ["#4a90d9", "#3ac0c0", "#5cb85c"],
    pants: ["#6a4e32", "#7a5a3a"],
    boots: ["#3a2f22", "#2e251a"],
    hats: ["#4a90d9", "#e8e8e8", "#e8c33d"],
    hatStyles: ["cap"],
  },
  // Hair line: the "cute girl" ask, done tastefully at 16×16 — long hair
  // (a hat-style, not a hat) and softer palettes, same human body.
  {
    id: "damsel",
    name: "Damsel of the Deep",
    cashTier: 3,
    costGems: 75,
    blurb: "long hair and a floor-length gown — the same unshakeable nerve",
    shape: { hatStyle: "longhair", hair: "long", build: "slim", gown: true, pretty: true },
    shirts: ["#e070a0", "#d9534f", "#8e6fc0", "#e8a33d"],
    pants: ["#3b4a6b", "#555b66"],
    boots: ["#4a3524", "#333333"],
    hats: ["#6a4a3a", "#3a2a20", "#8a5a4a", "#c8a060"],
    hatStyles: ["longhair"],
  },
];

export const PICKAXES: PickaxeCosmetic[] = [
  {
    id: "steel",
    name: "Steel",
    cashTier: 1,
    costGems: 0,
    tool: "pickaxe",
    toolName: "Pickaxe",
    blurb: "the shift standard: honest steel, nothing fancy",
    theme: { head: "#9aa5b1", glow: "#d9e2ec", handle: "#8a5a2b" },
    soundFile: "audio/pickaxe-steel.wav",
    feel: { swingMs: 150, bounceDepth: 6 },
  },
  {
    id: "gold",
    name: "Gold",
    cashTier: 1,
    costGems: 25,
    tool: "mattock",
    toolName: "Mattock",
    blurb: "a squared adze — the gem counter's favorite",
    theme: { head: "#e8c33d", glow: "#fff3b0", handle: "#8a5a2b" },
    soundFile: "audio/pickaxe-gold.wav",
    // Heavier metal: slower swing, deeper bounce.
    feel: { swingMs: 190, bounceDepth: 8 },
  },
  {
    // id "frost" (not "crystal") to avoid colliding with the outfit id.
    id: "frost",
    name: "Crystal",
    cashTier: 2,
    costGems: 45,
    tool: "lance",
    toolName: "Lance",
    blurb: "a forked lance that leaves the seam cold",
    theme: { head: "#5ad8e8", glow: "#d0fbff", handle: "#3a2f5a" },
    soundFile: "audio/pickaxe-frost.wav",
    // Light and nimble: the fastest swing, the shallowest bounce.
    feel: { swingMs: 110, bounceDepth: 4 },
  },
  {
    id: "emberbrand",
    name: "Emberbrand",
    cashTier: 3,
    costGems: 60,
    tool: "emberbrand",
    toolName: "Emberbrand",
    blurb: "a burning brand — the rock smokes where it lands",
    theme: { head: "#e8590c", glow: "#ffd54f", handle: "#5a2a12" },
    soundFile: "audio/pickaxe-emberbrand.wav",
    feel: { swingMs: 200, bounceDepth: 7 },
  },
  {
    id: "sledge",
    name: "Cinder Sledge",
    cashTier: 3,
    costGems: 75,
    tool: "sledge",
    toolName: "Sledge",
    blurb: "the biggest head in the crate; it does not need finesse",
    theme: { head: "#8a6a5a", glow: "#ffb08a", handle: "#4a3020" },
    soundFile: "audio/pickaxe-sledge.wav",
    // The heaviest thing a miner can swing: slowest, deepest bounce.
    feel: { swingMs: 260, bounceDepth: 12 },
  },
  {
    id: "lanternhook",
    name: "Lantern Hook",
    cashTier: 3,
    costGems: 85,
    tool: "lanternhook",
    toolName: "Lantern Hook",
    blurb: "hangs its own light on the gallery wall and hooks the rock",
    theme: { head: "#c9a227", glow: "#ffe9a8", handle: "#6a4a22" },
    soundFile: "audio/pickaxe-lanternhook.wav",
    feel: { swingMs: 140, bounceDepth: 5 },
  },
  {
    id: "shadow",
    name: "Shadow",
    cashTier: 3,
    costGems: 90,
    tool: "auger",
    toolName: "Auger",
    blurb: "a spiral bit that eats the seam instead of striking it",
    theme: { head: "#4a4a5a", glow: "#9a7fd0", handle: "#2a2233" },
    soundFile: "audio/pickaxe-shadow.wav",
    // Slow and heavy: deliberate, with a long tail on the bounce.
    feel: { swingMs: 230, bounceDepth: 10 },
  },
  {
    id: "prism",
    name: "Prism Cutter",
    cashTier: 4,
    costGems: 100,
    tool: "prism",
    toolName: "Prism Cutter",
    blurb: "cuts the seam at an angle the light likes",
    theme: { head: "#7fd4e8", glow: "#ffffff", handle: "#4a3f6b" },
    soundFile: "audio/pickaxe-prism.wav",
    feel: { swingMs: 170, bounceDepth: 8 },
  },
];

/**
 * Hair styles a bare head can wear in the papercut direction (see
 * `MINER_HAIR_STYLES` usage in rollMinerLook). The classic pixel art has no
 * hair of its own, so the pool lives here with the rest of the look data.
 */
const MINER_HAIR_STYLES: readonly MinerHair[] = [
  "bob",
  "long",
  "ponytail",
  "twin",
  "bun",
];

export const DEFAULT_OUTFIT = "classic";
export const DEFAULT_PICKAXE = "steel";

/** Cosmetic ids owned by every new save. */
export const DEFAULT_OWNED = [DEFAULT_OUTFIT, DEFAULT_PICKAXE];

export function getOutfit(id: string): OutfitCosmetic {
  return OUTFITS.find((o) => o.id === id) ?? OUTFITS[0];
}

export function getPickaxe(id: string): PickaxeCosmetic {
  return PICKAXES.find((p) => p.id === id) ?? PICKAXES[0];
}

/** Swing feel of a pickaxe id (unknown ids fall back to the default). */
export function getPickaxeFeel(id: string): PickaxeFeel {
  return getPickaxe(id).feel;
}

export function isOutfitId(id: string): boolean {
  return OUTFITS.some((o) => o.id === id);
}

export function isPickaxeId(id: string): boolean {
  return PICKAXES.some((p) => p.id === id);
}

/** The skin by id; unknown ids are "no skin" (the rolled look). */
export function getSkin(id: string): SkinCosmetic | undefined {
  return SKINS.find((s) => s.id === id);
}

export function isSkinId(id: string): boolean {
  return SKINS.some((s) => s.id === id);
}

/**
 * Which half of the line a skin belongs to. The pretty half is the group of
 * characters that read as heroines: a gown, or the pretty / cute face. It is
 * deliberately NOT "wears a dress" and NOT "is slim" — a crew member may wear
 * one (Blossom Bun's counterpart Frost Bit runs the ladders in a beanie and
 * trousers), and Deep Survey is a wiry surveyor, not a heroine: the build is
 * a silhouette axis, not a gender test.
 */
export function skinGroup(skin: SkinCosmetic): SkinGroup {
  const s = skin.shape;
  return s.gown === true || s.pretty === true || s.cute === true
    ? "pretty"
    : "crew";
}

/** Any cosmetic by id (outfits / pickaxes / skins), or undefined if unknown. */
export function getCostGems(id: string): number | undefined {
  if (isOutfitId(id)) return getOutfit(id).costGems;
  if (isPickaxeId(id)) return getPickaxe(id).costGems;
  if (isSkinId(id)) return getSkin(id)?.costGems;
  return undefined;
}

/**
 * Fixed seed for cosmetic PREVIEW thumbnails (shop listings + the
 * settings gem picker): one representative look per outfit, deterministic
 * so the same item reads the same on every screen.
 */
export const COSMETIC_PREVIEW_SEED = 42;

/**
 * Deterministic player look: f(seed, outfit). Rerolling the seed reshuffles
 * the look; switching the outfit reshuffles it again (different palette).
 * Animal outfits draw their fur from `fur` instead of SKIN_TONES.
 *
 * The shape hints appended at the end (hair / outfit / beard / cute / the
 * papercut axes) are read only by the papercut art pack
 * (docs/art-directions.md); the classic pixel pack ignores them. They come
 * AFTER the color picks on purpose — an extra `pick` earlier in the stream
 * would reshuffle every existing save's miner. An outfit that ships a
 * `shape` OVERRIDES the rolled hints outright: the item is a character, and
 * rerolling colors must not reroll who they are.
 */
export function rollMinerLook(seed: number, outfitId: string): MinerLook {
  const outfit = getOutfit(outfitId);
  const rng = mulberry32(seed);
  const pick = <T>(arr: readonly T[]): T =>
    arr[Math.floor(rng() * arr.length) % arr.length];
  const species: MinerSpecies = outfit.species ?? "human";
  const look: MinerLook = {
    skin: pick(species === "animal" ? (outfit.fur ?? SKIN_TONES) : SKIN_TONES),
    shirt: pick(outfit.shirts),
    pants: pick(outfit.pants),
    boots: pick(outfit.boots),
    hat: pick(outfit.hats),
    hatStyle: pick(outfit.hatStyles),
    species,
  };
  // --- papercut silhouette personality (see artPack.shapeForLook) ----------
  const shape = outfit.shape;
  if (shape != null) {
    // An authored character: copy its axes onto the look. NOT rolled, and
    // appended after the color picks, so no existing player's miner moves.
    // `hatStyle` overrides the rolled one too — headwear is the loudest
    // silhouette axis there is, and a character who changes their hat every
    // reroll is a palette again. The hat COLOR still rolls from the pool.
    look.hatStyle = shape.hatStyle ?? look.hatStyle;
    look.hair = shape.hair ?? look.hair;
    look.outfit = shape.outfit ?? "trousers";
    look.beard = shape.beard ?? false;
    look.cute = shape.cute ?? false;
    look.build = shape.build;
    look.gown = shape.gown ?? false;
    look.pretty = shape.pretty ?? false;
    look.prop = shape.prop;
    look.crown = shape.crown;
    return look;
  }
  // Hair only ROLLS on a bare head: authored hair does draw under a hat now
  // (a beanie no longer eats it — the skin line's Sky Bob), and letting the
  // roll do it here would quietly give every saved miner a new silhouette.
  look.hair = look.hatStyle === "longhair" ? pick(MINER_HAIR_STYLES) : undefined;
  look.beard = rng() < 0.3;
  look.outfit = rng() < 0.3 ? "dress" : "trousers";
  look.cute = rng() < 0.35;
  return look;
}

/** Derive a roster miner's variant seed from the player seed + slot index. */
export function rosterSeed(playerSeed: number, index: number): number {
  return hashSeed(playerSeed, index);
}

// ---------------------------------------------------------------------------
// Crew column layout (todo: "have miners line up down the middle vertically
// along the mine background shaft"): the whole crew stacks in ONE vertical
// column down the middle of the cave — the player at the front (bottom),
// hired miners receding up the shaft behind them, each row a little smaller
// (depth perspective). Pure so the layout is unit-testable; MiningCanvas
// just maps the items to <Miner/>s (far-most first, so the nearest ends up
// adjacent to the player). Only the first few slots of each type render — a
// phone-sized column can't stack a 400-strong crew — and that same cap
// (ROSTER_ASSIGNABLE_SLOTS, the normal-crew limit) defines how many hires
// the shop offers per-miner outfit customization for, so every assignable
// slot is always visible.
// ---------------------------------------------------------------------------
export type RosterKind = "normal" | "fast" | "legendary";

export type RosterDisplayItem = {
  kind: RosterKind;
  /** Index within the type (the roster slot key for minerOutfits when
   *  `kind` is "normal"; fast/legendary share the player's look). */
  index: number;
  /** Render scale: shrinks with shaft depth (position in the column). */
  scale: number;
};

/** Max visible crew rows per type (see rosterDisplay). */
export const ROSTER_MAX_PER_TYPE: Record<RosterKind, number> = {
  normal: 4,
  fast: 2,
  legendary: 1,
};

/** The individually-customizable roster slots (the normal-crew cap). */
export const ROSTER_ASSIGNABLE_SLOTS = ROSTER_MAX_PER_TYPE.normal;

/** Base sprite scale per crew type (the front row of each type). */
const ROSTER_BASE_SCALE: Record<RosterKind, number> = {
  normal: 0.5,
  fast: 0.4,
  legendary: 0.55,
};

/** Scale shrink per row as the crew recedes up the shaft. */
const ROSTER_SHRINK = 0.9;

/**
 * The visible crew column: the nearest (normal) hires first, then fast,
 * then legendary (the farthest), each following row smaller. Counts are
 * clamped to ROSTER_MAX_PER_TYPE per type and stay in hire order, so the
 * shop's per-miner slots (0..ROSTER_ASSIGNABLE_SLOTS-1) always line up
 * with what's on screen.
 */
export function rosterDisplay(
  normal: number,
  fast: number,
  legendary: number,
): RosterDisplayItem[] {
  const items: RosterDisplayItem[] = [];
  const counts: Record<RosterKind, number> = {
    normal: Math.max(0, Math.floor(normal)),
    fast: Math.max(0, Math.floor(fast)),
    legendary: Math.max(0, Math.floor(legendary)),
  };
  let depthPos = 0; // 0 = nearest to the player
  const kinds: RosterKind[] = ["normal", "fast", "legendary"];
  for (const kind of kinds) {
    const count = counts[kind];
    for (let i = 0; i < Math.min(count, ROSTER_MAX_PER_TYPE[kind]); i++) {
      items.push({
        kind,
        index: i,
        scale: ROSTER_BASE_SCALE[kind] * Math.pow(ROSTER_SHRINK, depthPos),
      });
      depthPos++;
    }
  }
  return items;
}

// ---------------------------------------------------------------------------
// Cave themes (plan §4.3 / §5.2 cosmetic line, §4.6 tier-4 "Crystal Kingdom"
// unlock): a named recolor of the cave background. Purely visual — no
// gameplay effect. Each theme is a palette of one tint per depth tier
// (index-aligned with DEPTH_TIERS in game.ts), so the cave still shifts with
// depth; the theme just moves the whole palette. The default theme's palette
// is exactly DEPTH_TIERS' tints, so it reproduces the original look and a
// fresh save (or one who never opens the section) sees no change.
// ---------------------------------------------------------------------------
export type CaveTheme = {
  id: string;
  name: string;
  /** 0 = owned from the start, otherwise the gem price. */
  costGems: number;
  /** Cash price tier (see CASH_PRICE_USD). */
  cashTier: CashTier;
  /** Optional one-line flavor/shown in the picker (e.g. homage credit). */
  blurb?: string;
  /** One tint per depth tier (index-aligned with DEPTH_TIERS). */
  tints: string[];
};

/**
 * Default (free) cave background tints — mirrors DEPTH_TIERS in game.ts,
 * one tint per tier. A unit test pins this against DEPTH_TIERS so the two
 * can't drift apart.
 */
export const DEFAULT_CAVE_TINTS: string[] = [
  "#a0856a", // 0 Surface Caverns
  "#8fa8b8", // 1 Deep Grotto
  "#9a7fb8", // 2 Crystal Depths
  "#b8705a", // 3 Magma Frontier
  "#5ab8b8", // 4 Crystal Kingdom
];

/**
 * A SKIN is a whole CHARACTER for the player's own slot: a fixed `MinerLook`
 * (one colorway, no reroll) plus the papercut `shape` axes (headwear, hair,
 * dress, critter form, cute face). Unlike an outfit — which is a palette the
 * player rerolls against — a skin is drawn as authored, which is why the
 * line is a set of characters instead of colorways.
 *
 * The line (docs/skin-line.md) is half the mining crew, half the cute/pretty
 * side, and every member is a distinct silhouette in a distinct palette:
 * `skins.test.ts` pins that, because a "skin line" with two identical
 * members is a bug, not a variant.
 */
export type SkinCosmetic = {
  id: string;
  name: string;
  /** Gem price. Unlike the other lines there is no free default: "no
   *  skin" is the player's own rolled look (selectedSkin ""), not an item. */
  costGems: number;
  /** Cash price tier (see CASH_PRICE_USD). */
  cashTier: CashTier;
  /** One-line flavor, shown on the card. */
  blurb: string;
  /** The character's colors (the same `MinerLook` the live line takes). */
  look: MinerLook;
  /** The silhouette axes (papercut; the classic pack reads colors only). */
  shape: SkinShape;
};

/** Which half of the line a skin belongs to — the shop's card sort. */
export type SkinGroup = "crew" | "pretty";

export const SKINS: readonly SkinCosmetic[] = [
  // --- the crew half ---------------------------------------------------
  {
    id: "lantern-crew",
    name: "Lantern Crew",
    cashTier: 1,
    costGems: 25,
    blurb: "the shift's hard-hat standard, lamp on the brim",
    look: {
      skin: "#ffdbb4",
      shirt: "#4a90d9",
      pants: "#3b4a6b",
      boots: "#4a3524",
      hat: "#e8c33d",
      hatStyle: "helmet",
    },
    // Wiry where the Foreman is broad: the shift's standard is the lean one,
    // and it is the second thing that tells the two hard-hat men apart
    // (the first is the beard).
    shape: { form: "human", hatStyle: "helmet", build: "slim" },
  },
  {
    id: "frost-bit",
    name: "Frost Bit",
    cashTier: 1,
    costGems: 25,
    blurb: "red beanie, green wool, still swinging the pick",
    look: {
      skin: "#f2c9a0",
      shirt: "#57a94f",
      pants: "#2f3b4a",
      boots: "#333333",
      hat: "#e8443a",
      hatStyle: "beanie",
    },
    shape: { form: "human", hatStyle: "beanie", build: "sturdy" },
  },
  {
    id: "deep-survey",
    name: "Deep Survey",
    cashTier: 2,
    costGems: 40,
    blurb: "visor cap and a beard; has mapped every gallery twice",
    look: {
      skin: "#8d5524",
      shirt: "#f0f0f0",
      pants: "#7a5230",
      boots: "#3a2a1a",
      hat: "#3f8fd0",
      hatStyle: "cap",
    },
    // The survey satchel is the whole point of him: the only crew member
    // who carries anything, so he is the only one with a bag in his outline.
    shape: {
      form: "human",
      hatStyle: "cap",
      beard: true,
      build: "slim",
      prop: "satchel",
    },
  },
  {
    id: "shift-foreman",
    name: "Shift Foreman",
    cashTier: 2,
    costGems: 40,
    blurb: "white hard hat, red shirt, runs the whole seam",
    look: {
      skin: "#e07020",
      shirt: "#d9534f",
      pants: "#3b4a6b",
      boots: "#4a3524",
      hat: "#e8e8e8",
      hatStyle: "helmet",
    },
    // Broad on purpose: the foreman is the one who could lift the crate.
    shape: {
      form: "human",
      hatStyle: "helmet",
      beard: true,
      build: "sturdy",
    },
  },
  {
    id: "fox-crew",
    name: "Fox Crew",
    cashTier: 3,
    costGems: 60,
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
    cashTier: 3,
    costGems: 60,
    blurb: "green beanie, permanently unbothered",
    look: {
      skin: "#a08058",
      shirt: "#d94f30",
      pants: "#8a6b48",
      boots: "#5a4630",
      hat: "#57a94f",
      hatStyle: "beanie",
    },
    shape: { form: "critter", hatStyle: "beanie", prop: "none" },
  },
  // --- the pretty half -------------------------------------------------
  // Every one of the six is its own silhouette: a gown, a braid, a bob, twin
  // tails, trousers and a waved fall, across two builds and two faces. The
  // line's rule is that a pretty character is a CHARACTER — the dress was
  // never going to carry six of them on its own.
  {
    id: "rose-lantern",
    name: "Rose Lantern",
    cashTier: 3,
    costGems: 75,
    blurb: "long pink hair, a floor-length gown, and the lamp basket",
    look: {
      skin: "#ffe3c8",
      shirt: "#b48cff",
      pants: "#8d6bb0",
      boots: "#e8a0c8",
      hat: "#ff9ecd",
      hatStyle: "longhair",
    },
    // THE DAMSEL. A slim build, the pretty face, a bare-shouldered gown with
    // no boots under it, and the lamp basket she was carrying when the crew
    // found her. Three axes nobody else in the line uses at once.
    shape: {
      form: "human",
      hatStyle: "longhair",
      hair: "long",
      gown: true,
      pretty: true,
      prop: "basket",
    },
  },
  {
    id: "mint-comet",
    name: "Mint Comet",
    cashTier: 3,
    costGems: 75,
    blurb: "mint braid and a short dress; names every equation before it lands",
    look: {
      skin: "#f2c9a0",
      shirt: "#8fe3c0",
      pants: "#57a94f",
      boots: "#2f7a55",
      hat: "#7ad0e8",
      hatStyle: "longhair",
    },
    // Slim and pretty, but in a SHORT dress with a braid over one shoulder —
    // the runner of the line, next to the damsel's floor-length gown.
    shape: {
      form: "human",
      hatStyle: "longhair",
      hair: "braid",
      outfit: "dress",
      pretty: true,
    },
  },
  {
    id: "sky-bob",
    name: "Sky Bob",
    cashTier: 3,
    costGems: 85,
    blurb: "sky-blue bob under a little orange beanie",
    look: {
      skin: "#ffe3c8",
      shirt: "#bdeeff",
      pants: "#4a90d9",
      boots: "#3b4a6b",
      hat: "#f2913a",
      hatStyle: "beanie",
    },
    // The one pretty character who keeps a hat on: a bob under a beanie is a
    // different outline from every bare head in the line.
    shape: {
      form: "human",
      hatStyle: "beanie",
      hair: "bob",
      outfit: "dress",
      build: "slim",
      cute: true,
    },
  },
  {
    id: "twin-bells",
    name: "Twin Bells",
    cashTier: 4,
    costGems: 85,
    blurb: "twin tails, yellow dress, loudest lamp on the crew",
    look: {
      skin: "#f2c9a0",
      shirt: "#ffd166",
      pants: "#e8a33d",
      boots: "#8a5a2b",
      hat: "#ef476f",
      hatStyle: "longhair",
    },
    // Broad shoulders with twin tails: the one pretty character who is
    // built like a crew member, which is what makes the pair of them read.
    shape: {
      form: "human",
      hatStyle: "longhair",
      hair: "twin",
      outfit: "dress",
      build: "sturdy",
      cute: true,
    },
  },
  {
    id: "blossom-bun",
    name: "Blossom Bun",
    cashTier: 4,
    costGems: 100,
    blurb: "top knot, rose blouse and trousers; runs the gem counters",
    look: {
      skin: "#ffe3c8",
      shirt: "#ff9ecd",
      pants: "#e07ba5",
      boots: "#c05f8a",
      hat: "#e8443a",
      hatStyle: "longhair",
    },
    // Trousers, not a dress: she is the one who runs the numbers, and the
    // legs are the read. The only pretty-group character in pants.
    shape: {
      form: "human",
      hatStyle: "longhair",
      hair: "bun",
      outfit: "trousers",
      build: "slim",
      cute: true,
    },
  },
  {
    id: "ember-sunrise",
    name: "Ember Sunrise",
    cashTier: 4,
    costGems: 100,
    blurb: "ginger waves to the waist, amber dress; first up the ladder",
    look: {
      skin: "#f7d9c0",
      shirt: "#e8703a",
      pants: "#b4552a",
      boots: "#6a3a22",
      hat: "#e07020",
      hatStyle: "longhair",
    },
    // The big waved fall and the broad shoulders: she used to share a
    // silhouette with Rose Lantern, which made the pair one character in
    // two palettes. Waves + sturdy + pretty face is hers alone now.
    shape: {
      form: "human",
      hatStyle: "longhair",
      hair: "waves",
      outfit: "dress",
      build: "sturdy",
      pretty: true,
    },
  },
];

/** "No skin" — the player's own rolled look (selectedSkin is ""). */
export const DEFAULT_SKIN = "";

export const CAVE_THEMES: CaveTheme[] = [
  {
    id: "natural",
    name: "Natural",
    cashTier: 1,
    costGems: 0,
    tints: DEFAULT_CAVE_TINTS,
  },
  {
    id: "amethyst",
    name: "Amethyst Cavern",
    cashTier: 1,
    costGems: 25,
    tints: ["#c8a8e0", "#b090d8", "#9a7fc8", "#b88fe0", "#d8c0f0"],
  },
  {
    id: "verdant",
    name: "Verdant Hollow",
    cashTier: 2,
    costGems: 35,
    tints: ["#a8c890", "#90b878", "#78a860", "#8fc85a", "#a8e878"],
  },
  {
    id: "solar",
    name: "Solar Vein",
    cashTier: 2,
    costGems: 55,
    tints: ["#e8d8a8", "#e8c878", "#e8b050", "#e89838", "#f0d060"],
  },
  {
    id: "void",
    name: "Void Depths",
    cashTier: 3,
    costGems: 75,
    tints: ["#6a7a9a", "#5a6a8a", "#4a5a7a", "#5a4a7a", "#7a6aaa"],
  },
  // Homage line (plan §4.5 / art todo): palettes that evoke famous game
  // worlds via color alone — no names, sprites, or assets, so it's an
  // homage, not a copy (see the matching outfit line above).
  {
    id: "voxel",
    name: "Blockfall Mines",
    cashTier: 3,
    costGems: 90,
    blurb: "dirt, grass & glowing ore — a voxel tribute",
    tints: ["#8a6b45", "#5f7a3e", "#6e7686", "#3e7a8a", "#2a4a5a"],
  },
  {
    id: "wilds",
    name: "Wilds Below",
    cashTier: 4,
    costGems: 110,
    blurb: "from the grassy surface to hellstone — a sandbox tribute",
    tints: ["#5f8a3e", "#8a6b45", "#5a6478", "#7a4a5e", "#33262e"],
  },
  {
    id: "ashen",
    name: "Ashen Depths",
    cashTier: 4,
    costGems: 130,
    blurb: "fog, grey stone & a single ember — a dark-fantasy tribute",
    tints: ["#8a8f9a", "#6a7080", "#525868", "#6a4434", "#23262e"],
  },
  {
    id: "gothic",
    name: "Fog & Lantern",
    cashTier: 4,
    costGems: 150,
    blurb:
      "moonlit fog, lantern glow, one drop of blood — a gothic hunt tribute",
    tints: ["#5a6a58", "#4a5a68", "#3a4a58", "#582828", "#1f2230"],
  },
  {
    id: "cherry",
    name: "Cherry & Indigo",
    cashTier: 4,
    costGems: 170,
    blurb:
      "blossom over indigo night, gold at the bottom — a samurai-era tribute",
    tints: ["#c890a4", "#8a6a94", "#5a5a88", "#3a3a64", "#a89052"],
  },
];

export const DEFAULT_CAVE_THEME = "natural";
/** Cave theme ids owned by every new save. */
export const DEFAULT_OWNED_CAVE_THEMES = [DEFAULT_CAVE_THEME];

export function getCaveTheme(id: string): CaveTheme {
  return CAVE_THEMES.find((t) => t.id === id) ?? CAVE_THEMES[0];
}

export function isCaveThemeId(id: string): boolean {
  return CAVE_THEMES.some((t) => t.id === id);
}

/** Gem price of a cave theme (undefined for unknown ids). */
export function getCaveThemeCost(id: string): number | undefined {
  if (!isCaveThemeId(id)) return undefined;
  return getCaveTheme(id).costGems;
}

/**
 * The cave background tint at a depth tier for the given theme (clamped, so
 * a bad tier index can't go out of range).
 */
export function getThemeTint(theme: CaveTheme, tierId: number): string {
  const idx = Math.min(Math.max(0, Math.floor(tierId)), theme.tints.length - 1);
  return theme.tints[idx];
}
