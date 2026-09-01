import {
  MinerLook,
  PickaxeThemeDef,
  HatStyle,
  mulberry32,
  hashSeed,
} from "apps/utils/graphics/pixelArt";

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
  /** Color pools the randomizer draws from for this outfit. */
  shirts: string[];
  pants: string[];
  boots: string[];
  hats: string[];
  hatStyles: HatStyle[];
};

export type PickaxeCosmetic = {
  id: string;
  name: string;
  costGems: number;
  theme: PickaxeThemeDef;
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
];

export const PICKAXES: PickaxeCosmetic[] = [
  {
    id: "steel",
    name: "Steel",
    costGems: 0,
    theme: { head: "#9aa5b1", glow: "#d9e2ec", handle: "#8a5a2b" },
  },
  {
    id: "gold",
    name: "Gold",
    costGems: 5,
    theme: { head: "#e8c33d", glow: "#fff3b0", handle: "#8a5a2b" },
  },
  {
    // id "frost" (not "crystal") to avoid colliding with the outfit id.
    id: "frost",
    name: "Crystal",
    costGems: 10,
    theme: { head: "#5ad8e8", glow: "#d0fbff", handle: "#3a2f5a" },
  },
  {
    id: "shadow",
    name: "Shadow",
    costGems: 20,
    theme: { head: "#4a4a5a", glow: "#9a7fd0", handle: "#2a2233" },
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
