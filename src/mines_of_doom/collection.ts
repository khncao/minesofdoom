import { SaveData } from "./game";
import { CAVE_THEMES, OUTFITS, PICKAXES } from "./cosmetics";
import { ACHIEVEMENTS, isAchievementComplete } from "./achievements";

/**
 * Cosmetic compendium / collection (features.md §7 candidate, landed
 * iteration 23): the DERIVED view of "everything in the catalog, owned
 * vs. not" — pickaxes, outfits, cave themes and achievement badges in one
 * place. Pure function over the save, in the same derived-state spirit as
 * records.ts / goals.ts: nothing new is stored, the compendium can never
 * drift from the save, and the panel component is a dumb renderer of
 * getCollection(save).
 *
 * Ownership sources are the save's own cosmetic fields (the engine gem
 * buys AND the IAP grants both land there — the IAP entitlement record
 * is a purchase record, not an ownership source, so a device without
 * the store still shows the same collection). Achievement "ownership"
 * is completion: derived from lifetime stats exactly like the Goals
 * panel, so it survives spending and is cheat-resistant.
 */

/** The compendium's four lines, in display order. */
export const COLLECTION_KINDS = [
  "pickaxe",
  "outfit",
  "caveTheme",
  "achievement",
] as const;
export type CollectionKind = (typeof COLLECTION_KINDS)[number];

/** One catalog line. Cosmetics carry equipped; achievements completed. */
export type CollectionEntry =
  | {
      kind: "pickaxe" | "outfit" | "caveTheme";
      id: string;
      owned: boolean;
      /** This item is the one currently equipped on the player. */
      equipped: boolean;
    }
  | {
      kind: "achievement";
      id: string;
      /** Completion is DERIVED from lifetime stats (achievements.ts). */
      completed: boolean;
    };

export type CollectionGroup = {
  kind: CollectionKind;
  /** Catalog size for the line (PICKAXES.length, ACHIEVEMENTS.length…). */
  total: number;
  /** Owned (cosmetics) / completed (achievements) count. */
  owned: number;
  entries: CollectionEntry[];
};

export type Collection = {
  groups: CollectionGroup[];
  totalItems: number;
  totalOwned: number;
};

export function getCollection(save: SaveData): Collection {
  const ownedPickaxes = PICKAXES.map((p) => ({
    id: p.id,
    owned: save.ownedCosmetics.includes(p.id),
    equipped: save.selectedPickaxe === p.id,
  }));
  const ownedOutfits = OUTFITS.map((o) => ({
    id: o.id,
    owned: save.ownedCosmetics.includes(o.id),
    equipped: save.selectedOutfit === o.id,
  }));
  const ownedThemes = CAVE_THEMES.map((t) => ({
    id: t.id,
    owned: save.ownedCaveThemes.includes(t.id),
    equipped: save.selectedCaveTheme === t.id,
  }));
  const doneAchievements = ACHIEVEMENTS.map((a) => ({
    id: a.id,
    completed: isAchievementComplete(save, a),
  }));

  const groups: CollectionGroup[] = [
    {
      kind: "pickaxe",
      total: PICKAXES.length,
      owned: ownedPickaxes.filter((e) => e.owned).length,
      entries: ownedPickaxes.map((e) => ({ kind: "pickaxe", ...e })),
    },
    {
      kind: "outfit",
      total: OUTFITS.length,
      owned: ownedOutfits.filter((e) => e.owned).length,
      entries: ownedOutfits.map((e) => ({ kind: "outfit", ...e })),
    },
    {
      kind: "caveTheme",
      total: CAVE_THEMES.length,
      owned: ownedThemes.filter((e) => e.owned).length,
      entries: ownedThemes.map((e) => ({ kind: "caveTheme", ...e })),
    },
    {
      kind: "achievement",
      total: ACHIEVEMENTS.length,
      owned: doneAchievements.filter((e) => e.completed).length,
      entries: doneAchievements.map((e) => ({ kind: "achievement", ...e })),
    },
  ];

  return {
    groups,
    totalItems: groups.reduce((sum, g) => sum + g.total, 0),
    totalOwned: groups.reduce((sum, g) => sum + g.owned, 0),
  };
}
