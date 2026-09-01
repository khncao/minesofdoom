import {
  DEFAULT_OWNED,
  DEFAULT_OUTFIT,
  DEFAULT_PICKAXE,
  OUTFITS,
  PICKAXES,
} from "./cosmetics";

export type SaveData = {
  minerals: number;
  gems: number;
  clickPower: number;
  miners: number;
  minerPower: number;
  startTime: number;
  saveTime: number;
  saveVersion: number;
  // Lifetime stats — never decrease, drive goal tiers/achievements/prestige
  // (see goals.ts). Tracked incrementally in the state updaters, not by
  // scanning history.
  lifetimeMinerals: number;
  lifetimeCorrect: number;
  maxCombo: number;
  maxDepth: number;
  minersOwnedEver: number;
  totalGemsMinted: number;
  totalGemsSpent: number;
  totalPrestiges: number;
  // Goal tier ids whose completion celebration has already fired (the
  // completion itself is derived from lifetime stats in goals.ts).
  completedTiers: string[];
  // Programmatic cosmetics: seeded player-sprite look; roster miners derive
  // their variants from this seed. ownedCosmetics = outfit + pickaxe ids.
  playerSeed: number;
  ownedCosmetics: string[];
  selectedOutfit: string;
  selectedPickaxe: string;
};

// NOTE: equation settings are persisted separately under equationSettingsKey;
// they must NOT be folded into this object.
export type SettingsData = {
  autosave: number;
};

// TODO: number to bigint
export const saveDataKey = "save";
export const saveVersion = 3;
export const settingsDataKey = "settings";
export const equationSettingsKey = "equationSettings";

/**
 * Version-keyed save migrations. migrations[v] upgrades a save serialized
 * at version v to version v + 1. New save changes bump saveVersion and add
 * an entry here; legacy saves without a saveVersion are treated as version 0.
 */
const migrations: Record<
  number,
  (data: Record<string, unknown>) => Record<string, unknown>
> = {
  // 0 (no version field) -> 1: field names are unchanged; the permissive
  // loader in useGameEngine fills in any missing fields with defaults.
  0: (data) => ({ ...data, saveVersion: 1 }),
  // 1 -> 2: add lifetime stats + completedTiers. Pre-existing progress is
  // folded in as best we can (everything already mined counts toward
  // lifetime minerals, current roster toward miners-owned-ever).
  1: (data) => {
    const num = (v: unknown, fallback: number) =>
      typeof v === "number" && Number.isFinite(v) ? v : fallback;
    const minerals = num(data.minerals, 0);
    const gems = num(data.gems, 0);
    const miners = num(data.miners, 0);
    return {
      ...data,
      saveVersion: 2,
      lifetimeMinerals: minerals,
      lifetimeCorrect: 0,
      maxCombo: 0,
      maxDepth: getDepth(minerals),
      minersOwnedEver: miners,
      totalGemsMinted: gems, // approximation: existing gems were minted
      totalGemsSpent: 0,
      totalPrestiges: 0,
      completedTiers: Array.isArray(data.completedTiers)
        ? data.completedTiers.filter((t): t is string => typeof t === "string")
        : [],
    };
  },
  // 2 -> 3: programmatic cosmetics (seeded player look, owned + selected
  // outfit/pickaxe). Old saves get a deterministic seed from their
  // timestamps and the free defaults.
  2: (data) => {
    const num = (v: unknown, fallback: number) =>
      typeof v === "number" && Number.isFinite(v) ? v : fallback;
    // v2 saves never had selection fields, so "selected" defaults to the
    // first owned entry in catalog order.
    const owned = [
      ...new Set([
        ...DEFAULT_OWNED,
        ...(Array.isArray(data.ownedCosmetics)
          ? data.ownedCosmetics.filter(
              (c): c is string => typeof c === "string",
            )
          : []),
      ]),
    ];
    return {
      ...data,
      saveVersion: 3,
      playerSeed:
        num(
          data.playerSeed,
          ((num(data.startTime, 0) + num(data.saveTime, 0)) % 2147483647) ||
            12345,
        ),
      ownedCosmetics: owned,
      selectedOutfit:
        OUTFITS.find((o) => owned.includes(o.id))?.id ?? DEFAULT_OUTFIT,
      selectedPickaxe:
        PICKAXES.find((p) => owned.includes(p.id))?.id ?? DEFAULT_PICKAXE,
    };
  },
};

/** Walk a parsed save through every migration up to the current version. */
export function migrateSaveData(parsed: Record<string, unknown>): Record<
  string,
  unknown
> {
  let version =
    typeof parsed.saveVersion === "number" && Number.isFinite(parsed.saveVersion)
      ? Math.floor(parsed.saveVersion)
      : 0;
  let data = parsed;
  while (version < saveVersion) {
    const migrate = migrations[version];
    if (migrate == null) {
      console.warn(`No save migration for version ${version}, skipping`);
      break;
    }
    data = migrate(data);
    version++;
  }
  return data;
}
export const msPerTick = 1000;
export const gemChance = 0.05;
export const gemMineralCost = 100000;
// Cap offline earnings at 8 hours of mining
export const maxOfflineTicks = 8 * 60 * 60;
// Minerals per depth meter
export const mineralsPerDepth = 500;

/**
 * Depth tiers / biomes (plan §4.1): each tier gets a cave background tint,
 * a name shown in the depth banner, and a click-gain bonus so depth makes
 * the player strictly stronger the deeper they go.
 */
export type DepthTier = {
  id: number;
  name: string;
  /** Minimum depth (meters) to enter this tier. */
  at: number;
  /** Cave background tint. */
  tint: string;
  /** Multiplier applied to tap/answer gains (passive income is unaffected). */
  clickBonus: number;
};

export const DEPTH_TIERS: DepthTier[] = [
  { id: 0, name: "Surface Caverns", at: 0, tint: "#a0856a", clickBonus: 1 },
  { id: 1, name: "Deep Grotto", at: 10, tint: "#8fa8b8", clickBonus: 1.1 },
  { id: 2, name: "Crystal Depths", at: 50, tint: "#9a7fb8", clickBonus: 1.25 },
  { id: 3, name: "Magma Frontier", at: 150, tint: "#b8705a", clickBonus: 1.5 },
  { id: 4, name: "Crystal Kingdom", at: 500, tint: "#5ab8b8", clickBonus: 2 },
];

/** Highest tier whose minimum depth has been reached. */
export function getDepthTier(depth: number): DepthTier {
  let tier = DEPTH_TIERS[0];
  for (const t of DEPTH_TIERS) {
    if (depth >= t.at) tier = t;
  }
  return tier;
}

// Factory instead of a shared constant: consumers (e.g. saveGame) may modify
// the object, and a shared mutable default would leak changes across resets.
export function createEmptySaveData(): SaveData {
  return {
    minerals: 0,
    gems: 0,
    clickPower: 1,
    miners: 0,
    minerPower: 1,
    startTime: Date.now(),
    saveTime: 0,
    saveVersion,
    lifetimeMinerals: 0,
    lifetimeCorrect: 0,
    maxCombo: 0,
    maxDepth: 0,
    minersOwnedEver: 0,
    totalGemsMinted: 0,
    totalGemsSpent: 0,
    totalPrestiges: 0,
    completedTiers: [],
    playerSeed: Math.floor(Math.random() * 2147483647) || 1,
    ownedCosmetics: [...DEFAULT_OWNED],
    selectedOutfit: DEFAULT_OUTFIT,
    selectedPickaxe: DEFAULT_PICKAXE,
  };
}

/**
 * Lifetime-stat deltas for a gain event, spread into a state update:
 * `{ ...n, minerals, ...lifetimeDelta(n, { minerals: gained, ... }) }`.
 * Stats only ever increase; maxDepth is re-derived from post-gain minerals
 * so it can't go backwards when a purchase later spends them down.
 */
export function lifetimeDelta(
  n: SaveData,
  d: {
    minerals?: number;
    correct?: number;
    combo?: number;
    newMiners?: number;
    gemsMinted?: number;
  },
): Partial<SaveData> {
  return {
    lifetimeMinerals: n.lifetimeMinerals + (d.minerals ?? 0),
    lifetimeCorrect: n.lifetimeCorrect + (d.correct ?? 0),
    maxCombo: Math.max(n.maxCombo, d.combo ?? 0),
    maxDepth: Math.max(n.maxDepth, getDepth(n.minerals + (d.minerals ?? 0))),
    minersOwnedEver:
      d.newMiners != null
        ? Math.max(n.minersOwnedEver, d.newMiners)
        : n.minersOwnedEver,
    totalGemsMinted: n.totalGemsMinted + (d.gemsMinted ?? 0),
  };
}

export const defaultSettingsData = {
  autosave: 30,
};

export function getClickUpgradeCost(level: number): number {
  return level * level * level * level;
}

export function getMinerUpgradeCost(current: number): number {
  return current * current * current * current + 1;
}

/** Mineral cost of raising miner power from `current` to current + 1. */
export function getMinerPowerUpgradeCost(current: number): number {
  return 1000 * current * current;
}

export function rollGem(comboMultiplier: number): boolean {
  return Math.random() < gemChance * comboMultiplier;
}

export function getDepth(minerals: number): number {
  return Math.floor(minerals / mineralsPerDepth);
}

/**
 * Pure offline-earnings calculation (extracted from the loader so it can be
 * unit-tested without AsyncStorage): miners × minerPower per tick, for the
 * elapsed time since the last save, capped at maxOfflineTicks.
 */
export function computeOfflineMinerals(
  miners: number,
  minerPower: number,
  saveTime: number,
  now: number,
): number {
  if (miners <= 0 || saveTime <= 0 || now <= saveTime) {
    return 0;
  }
  const elapsedTicks = Math.min(
    Math.max(0, Math.floor((now - saveTime) / msPerTick)),
    maxOfflineTicks,
  );
  return miners * minerPower * elapsedTicks;
}
