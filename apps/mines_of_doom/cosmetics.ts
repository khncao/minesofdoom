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
