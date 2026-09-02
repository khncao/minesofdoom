import {
  MinerLook,
  PickaxeThemeDef,
  HatStyle,
  mulberry32,
  hashSeed,
} from "src/utils/graphics/pixelArt";

/**
 * Cosmetic content (plan §5.2 / §4.3 cosmetic line, programmatic variant).
 * Everything is buyable in gems; the IAP cosmetic pack is a later currency
 * for the *same* items. Skins/pickaxes are pure pixel recolors of the
 * programmatic sprites — no art assets.
 */

export type OutfitCosmetic = {
  id: string;
  name: string;
  /** 0 = owned from the start, otherwise the gem price. */
  costGems: number;
  /** Optional one-line flavor/shown in the picker (e.g. homage credit). */
  blurb?: string;
  /** Color pools the randomizer draws from for this outfit. */
  shirts: string[];
  pants: string[];
  boots: string[];
  hats: string[];
  hatStyles: HatStyle[];
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
  theme: PickaxeThemeDef;
  /** Unique swing sound, relative to public/assets (required in assets/index).
   *  Synthesized by scripts/generate-pickaxe-sounds.mjs. */
  soundFile: string;
  /** Unique swing animation (plan §5.2 "unique ... animations"). */
  feel: PickaxeFeel;
};

/** Shared skin-tone pool (all outfits). */
const SKIN_TONES = [
  "#ffdbb4",
  "#f2c9a0",
  "#e0ac69",
  "#c68642",
  "#8d5524",
];

export const OUTFITS: OutfitCosmetic[] = [
  {
    id: "classic",
    name: "Classic Crew",
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
    costGems: 3,
    shirts: ["#3a4a7a", "#4a3a7a", "#2b3a5c", "#5a4a8a"],
    pants: ["#22283a", "#2a2f45"],
    boots: ["#1a1a24", "#333344"],
    hats: ["#333344", "#444455", "#2b2b3a"],
    hatStyles: ["beanie", "cap", "bandana"],
  },
  {
    id: "goldrush",
    name: "Gold Rush",
    costGems: 5,
    shirts: ["#e8c33d", "#d4a017", "#f0d060", "#c89010"],
    pants: ["#5a4a20", "#6b5a30"],
    boots: ["#4a3524", "#3a2a18"],
    hats: ["#f0d060", "#e8c33d", "#fff3b0"],
    hatStyles: ["cap", "bandana"],
  },
  {
    id: "crystal",
    name: "Crystal Miner",
    costGems: 10,
    shirts: ["#3ac0c0", "#2a90d9", "#7fe0d0", "#40b0e0"],
    pants: ["#2a4a5a", "#1f3a4a"],
    boots: ["#1a2f3a", "#2a3f4a"],
    hats: ["#a0f0f0", "#d0fbff", "#70d8e8"],
    hatStyles: ["helmet", "beanie"],
  },
  {
    id: "magma",
    name: "Lava Worker",
    costGems: 15,
    shirts: ["#d94f30", "#e07020", "#b03020", "#f09030"],
    pants: ["#4a2a1a", "#3a2015"],
    boots: ["#2a1a10", "#3a251a"],
    hats: ["#f09030", "#e8e8e8", "#d94f30"],
    hatStyles: ["helmet", "cap"],
  },
  // Homage line (plan §4.5 / art todo): original palettes that evoke famous
  // game worlds WITHOUT using any of their names, sprites, or assets — an
  // homage, not a copy, so it stays clear of copyright/trademark.
  {
    id: "blocky",
    name: "Blocky Adventurer",
    costGems: 8,
    blurb: "a voxel-sandbox tribute",
    shirts: ["#2f88c4", "#35a0cc", "#2a6a98"],
    pants: ["#3a5aa8", "#2a4a8a"],
    boots: ["#565b6e", "#3a3f4e"],
    hats: ["#2f88c4", "#e8e8e8", "#565b6e"],
    hatStyles: ["cap", "bandana"],
  },
  {
    id: "surface",
    name: "Frontier Explorer",
    costGems: 10,
    blurb: "a surface-to-underground sandbox tribute",
    shirts: ["#4a8a3a", "#6aa84a", "#3a7030"],
    pants: ["#6a4a2a", "#5a3e20"],
    boots: ["#4a3018", "#3a2810"],
    hats: ["#7a5a3a", "#8a6a4a", "#4a8a3a"],
    hatStyles: ["cap", "bandana"],
  },
  {
    id: "knight",
    name: "Ashen Knight",
    costGems: 12,
    blurb: "a dark-fantasy soulslike tribute",
    shirts: ["#8a9099", "#6a707a", "#5a606a"],
    pants: ["#4a4e58", "#3a3e48"],
    boots: ["#33363e", "#262932"],
    hats: ["#7a808a", "#9aa0aa", "#b8703a"],
    hatStyles: ["helmet", "cap"],
  },
  {
    id: "hunter",
    name: "Wandering Hunter",
    costGems: 15,
    blurb: "a gothic hunt tribute",
    shirts: ["#4a5a3a", "#3a4a2a", "#5a4a3a"],
    pants: ["#3a3a2a", "#2e2e22"],
    boots: ["#2a241a", "#1f1a12"],
    hats: ["#5a4a3a", "#4a3a2a", "#6a5a4a"],
    hatStyles: ["bandana", "cap", "beanie"],
  },
  {
    id: "oni",
    name: "Crimson Oni",
    costGems: 18,
    blurb: "a samurai-era vengeance tribute",
    shirts: ["#b03030", "#8a2020", "#c04040"],
    pants: ["#2a2a33", "#1f1f28"],
    boots: ["#1a1a22", "#12121a"],
    hats: ["#d8d0c0", "#b03030", "#4a4a5a"],
    hatStyles: ["bandana", "cap"],
  },
];

export const PICKAXES: PickaxeCosmetic[] = [
  {
    id: "steel",
    name: "Steel",
    costGems: 0,
    theme: { head: "#9aa5b1", glow: "#d9e2ec", handle: "#8a5a2b" },
    soundFile: "audio/pickaxe-steel.wav",
    feel: { swingMs: 150, bounceDepth: 6 },
  },
  {
    id: "gold",
    name: "Gold",
    costGems: 5,
    theme: { head: "#e8c33d", glow: "#fff3b0", handle: "#8a5a2b" },
    soundFile: "audio/pickaxe-gold.wav",
    // Heavier metal: slower swing, deeper bounce.
    feel: { swingMs: 190, bounceDepth: 8 },
  },
  {
    // id "frost" (not "crystal") to avoid colliding with the outfit id.
    id: "frost",
    name: "Crystal",
    costGems: 10,
    theme: { head: "#5ad8e8", glow: "#d0fbff", handle: "#3a2f5a" },
    soundFile: "audio/pickaxe-frost.wav",
    // Light and nimble: the fastest swing, the shallowest bounce.
    feel: { swingMs: 110, bounceDepth: 4 },
  },
  {
    id: "shadow",
    name: "Shadow",
    costGems: 20,
    theme: { head: "#4a4a5a", glow: "#9a7fd0", handle: "#2a2233" },
    soundFile: "audio/pickaxe-shadow.wav",
    // Slow and heavy: the biggest, most deliberate swing.
    feel: { swingMs: 230, bounceDepth: 10 },
  },
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

/** Any cosmetic by id (both lists), or undefined for unknown ids. */
export function getCostGems(id: string): number | undefined {
  if (isOutfitId(id)) return getOutfit(id).costGems;
  if (isPickaxeId(id)) return getPickaxe(id).costGems;
  return undefined;
}

/**
 * Deterministic player look: f(seed, outfit). Rerolling the seed reshuffles
 * the look; switching the outfit reshuffles it again (different palette).
 */
export function rollMinerLook(seed: number, outfitId: string): MinerLook {
  const outfit = getOutfit(outfitId);
  const rng = mulberry32(seed);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length) % arr.length];
  return {
    skin: pick(SKIN_TONES),
    shirt: pick(outfit.shirts),
    pants: pick(outfit.pants),
    boots: pick(outfit.boots),
    hat: pick(outfit.hats),
    hatStyle: pick(outfit.hatStyles),
  };
}

/** Derive a roster miner's variant seed from the player seed + slot index. */
export function rosterSeed(playerSeed: number, index: number): number {
  return hashSeed(playerSeed, index);
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

export const CAVE_THEMES: CaveTheme[] = [
  {
    id: "natural",
    name: "Natural",
    costGems: 0,
    tints: DEFAULT_CAVE_TINTS,
  },
  {
    id: "amethyst",
    name: "Amethyst Cavern",
    costGems: 5,
    tints: ["#c8a8e0", "#b090d8", "#9a7fc8", "#b88fe0", "#d8c0f0"],
  },
  {
    id: "verdant",
    name: "Verdant Hollow",
    costGems: 8,
    tints: ["#a8c890", "#90b878", "#78a860", "#8fc85a", "#a8e878"],
  },
  {
    id: "solar",
    name: "Solar Vein",
    costGems: 12,
    tints: ["#e8d8a8", "#e8c878", "#e8b050", "#e89838", "#f0d060"],
  },
  {
    id: "void",
    name: "Void Depths",
    costGems: 20,
    tints: ["#6a7a9a", "#5a6a8a", "#4a5a7a", "#5a4a7a", "#7a6aaa"],
  },
  // Homage line (plan §4.5 / art todo): palettes that evoke famous game
  // worlds via color alone — no names, sprites, or assets, so it's an
  // homage, not a copy (see the matching outfit line above).
  {
    id: "voxel",
    name: "Blockfall Mines",
    costGems: 25,
    blurb: "dirt, grass & glowing ore — a voxel tribute",
    tints: ["#8a6b45", "#5f7a3e", "#6e7686", "#3e7a8a", "#2a4a5a"],
  },
  {
    id: "wilds",
    name: "Wilds Below",
    costGems: 30,
    blurb: "from the grassy surface to hellstone — a sandbox tribute",
    tints: ["#5f8a3e", "#8a6b45", "#5a6478", "#7a4a5e", "#33262e"],
  },
  {
    id: "ashen",
    name: "Ashen Depths",
    costGems: 35,
    blurb: "fog, grey stone & a single ember — a dark-fantasy tribute",
    tints: ["#8a8f9a", "#6a7080", "#525868", "#6a4434", "#23262e"],
  },
  {
    id: "gothic",
    name: "Fog & Lantern",
    costGems: 40,
    blurb: "moonlit fog, lantern glow, one drop of blood — a gothic hunt tribute",
    tints: ["#5a6a58", "#4a5a68", "#3a4a58", "#582828", "#1f2230"],
  },
  {
    id: "cherry",
    name: "Cherry & Indigo",
    costGems: 45,
    blurb: "blossom over indigo night, gold at the bottom — a samurai-era tribute",
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
  const idx = Math.min(
    Math.max(0, Math.floor(tierId)),
    theme.tints.length - 1,
  );
  return theme.tints[idx];
}
