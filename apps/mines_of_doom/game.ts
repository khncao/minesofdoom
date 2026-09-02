import {
  DEFAULT_OWNED,
  DEFAULT_OUTFIT,
  DEFAULT_PICKAXE,
  DEFAULT_OWNED_CAVE_THEMES,
  DEFAULT_CAVE_THEME,
  OUTFITS,
  PICKAXES,
  isCaveThemeId,
} from "./cosmetics";
import { Equation, Ops } from "apps/utils/math/equations";

export type SaveData = {
  minerals: number;
  gems: number;
  clickPower: number;
  miners: number;
  minerPower: number;
  // Tier-2 (Deep Shaft) content: fast miners (second miner type, cheaper curve
  // than normal miners, weaker per-miner output) and the first gem upgrade
  // (+1% base gem chance per level).
  fastMiners: number;
  gemChanceLevels: number;
  // Tier-5 (Motherlode) endgame content: legendary miners (third miner type,
  // the premium raw-output sink: highest per-miner output, steepest gem
  // curve). Like every miner type, they are run resources — a sunk shaft
  // resets them.
  legendaryMiners: number;
  // Tier-3 (Magma Frontier) content: prestige. The permanent "new shaft"
  // multiplier banked so far, as a level index into PRESTIGE_LEVELS. Unlike
  // the lifetime stats, this is a banked (not purely derived) value: it only
  // moves up when the player actually sinks a new shaft, which is what makes
  // the reset worth doing (the multiplier is the reward, banked at prestige).
  prestigeLevel: number;
  // Tier-3 gem upgrade lines (also Magma Frontier): each level doubles
  // tap/answer gains, and each level of combo resistance keeps 10% of the
  // combo when a wrong answer or mine tap would normally zero it.
  clickBoostLevels: number;
  comboResistLevels: number;
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
  // Achievement ids whose one-time bonus has already been granted (same
  // derived-completion pattern; see achievements.ts).
  completedAchievements: string[];
  // Programmatic cosmetics: seeded player-sprite look; roster miners derive
  // their variants from this seed. ownedCosmetics = outfit + pickaxe ids.
  playerSeed: number;
  ownedCosmetics: string[];
  selectedOutfit: string;
  selectedPickaxe: string;
  // Tier-4 (Crystal Kingdom) cosmetic line: cave themes (cave background
  // recolors). ownedCaveThemes = theme ids; selectedCaveTheme = the active
  // one. Like every cosmetic, they survive a sunk shaft.
  ownedCaveThemes: string[];
  selectedCaveTheme: string;
};

// NOTE: equation settings are persisted separately under equationSettingsKey;
// they must NOT be folded into this object.
export type SettingsData = {
  autosave: number;
};

// TODO: number to bigint
export const saveDataKey = "save";
export const saveVersion = 9;
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
  // 3 -> 4: achievements (one-off bonus badges, see achievements.ts). Old
  // saves simply haven't completed any yet.
  3: (data) => ({
    ...data,
    saveVersion: 4,
    completedAchievements: Array.isArray(data.completedAchievements)
      ? data.completedAchievements.filter(
          (c): c is string => typeof c === "string",
        )
      : [],
  }),
  // 4 -> 5: fast miners (second miner type) + gem chance upgrade. Old saves
  // own no fast miners yet and haven't bought any gem levels.
  // (kept below the new 5 -> 6 entry; migrations are walked in ascending key
  // order by migrateSaveData, so ordering in this object doesn't matter.)
  4: (data) => {
    const num = (v: unknown, fallback: number) =>
      typeof v === "number" && Number.isFinite(v) ? v : fallback;
    return {
      ...data,
      saveVersion: 5,
      fastMiners: Math.max(0, Math.floor(num(data.fastMiners, 0))),
      gemChanceLevels: Math.min(
        GEM_CHANCE_MAX_LEVELS,
        Math.max(0, Math.floor(num(data.gemChanceLevels, 0))),
      ),
    };
  },
  // 5 -> 6: prestige ("new shaft"). Old saves have never banked a multiplier,
  // so the permanent level starts at 0 (x1). The banked level is clamped so a
  // corrupt save can't mint a multiplier past the highest defined level.
  5: (data) => {
    const num = (v: unknown, fallback: number) =>
      typeof v === "number" && Number.isFinite(v) ? v : fallback;
    return {
      ...data,
      saveVersion: 6,
      prestigeLevel: Math.min(
        PRESTIGE_LEVELS.length - 1,
        Math.max(0, Math.floor(num(data.prestigeLevel, 0))),
      ),
    };
  },
  // 6 -> 7: tier-3 gem upgrade lines (click x2, combo resistance). Old saves
  // haven't bought any levels; clamped like every other level field so a
  // corrupt save can't mint an over-cap upgrade.
  6: (data) => {
    const num = (v: unknown, fallback: number) =>
      typeof v === "number" && Number.isFinite(v) ? v : fallback;
    return {
      ...data,
      saveVersion: 7,
      clickBoostLevels: Math.min(
        CLICK_BOOST_MAX_LEVELS,
        Math.max(0, Math.floor(num(data.clickBoostLevels, 0))),
      ),
      comboResistLevels: Math.min(
        COMBO_RESIST_MAX_LEVELS,
        Math.max(0, Math.floor(num(data.comboResistLevels, 0))),
      ),
    };
  },
  // 8 -> 9: tier-5 endgame content (legendary miners, third miner type). Old
  // saves own no legendary miners yet; clamped like the other roster counts
  // so a corrupt save can't mint a negative crew.
  8: (data) => {
    const num = (v: unknown, fallback: number) =>
      typeof v === "number" && Number.isFinite(v) ? v : fallback;
    return {
      ...data,
      saveVersion: 9,
      legendaryMiners: Math.max(0, Math.floor(num(data.legendaryMiners, 0))),
    };
  },
  // 7 -> 8: tier-4 cosmetic line (cave themes). Old saves own just the free
  // default and haven't changed the cave look; junk ids are dropped and the
  // free default is always kept owned, like every other cosmetic field.
  7: (data) => {
    const owned = [
      ...new Set([
        ...DEFAULT_OWNED_CAVE_THEMES,
        ...(Array.isArray(data.ownedCaveThemes)
          ? data.ownedCaveThemes.filter(
              (c): c is string => typeof c === "string" && isCaveThemeId(c),
            )
          : []),
      ]),
    ];
    return {
      ...data,
      saveVersion: 8,
      ownedCaveThemes: owned,
      selectedCaveTheme:
        typeof data.selectedCaveTheme === "string" &&
        isCaveThemeId(data.selectedCaveTheme)
          ? data.selectedCaveTheme
          : DEFAULT_CAVE_THEME,
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
/**
 * Hard-mode premium (tier-5 "Motherlode", plan §4.2): every correct answer
 * to a 3-term (hard-mode) equation pays ×HARD_MODE_PAYOUT. Applied in
 * getAnswerPayoutMultiplier, keyed off the equation's shape (op2 present) —
 * so a 2-term equation generated before the player toggled hard mode still
 * pays the soft rate, and vice versa.
 */
export const HARD_MODE_PAYOUT = 2;
export const gemChance = 0.05;
/** Base gem chance added per level of the gem chance upgrade. */
export const gemChancePerLevel = 0.01;
/** Gem chance upgrade cap: 5% base + 20 levels = 25%. */
export const GEM_CHANCE_MAX_LEVELS = 20;
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

/**
 * Prestige ("New Shaft", plan §4.1 / tier 3, §4.6). Sinking a new shaft
 * resets the run's mining operation (minerals, miners, fast miners, click &
 * miner power) but banks a permanent multiplier based on lifetime minerals.
 *
 * The multiplier is a stepped, monotonic table keyed by the *lifetime*
 * minerals mined (a stat that never resets), so a banked level can never be
 * lost by spending minerals. It is stepped rather than continuous so that
 * "banking a new level" is a discrete, meaningful event: between two
 * thresholds the available level is fixed, so you can only prestige again
 * once lifetime crosses the next rung — which keeps repeated resets from
 * being spammable.
 */
export type PrestigeLevel = {
  /** Level index (the save's `prestigeLevel`). */
  level: number;
  /** Lifetime minerals required to *bank* this level. */
  at: number;
  /** Permanent multiplier applied to gains & passive income at this level. */
  multiplier: number;
};

export const PRESTIGE_LEVELS: PrestigeLevel[] = [
  { level: 0, at: 0, multiplier: 1 },
  { level: 1, at: 5_000_000, multiplier: 1.5 },
  { level: 2, at: 50_000_000, multiplier: 2 },
  { level: 3, at: 250_000_000, multiplier: 2.5 },
  { level: 4, at: 1_000_000_000, multiplier: 3.5 },
  { level: 5, at: 5_000_000_000, multiplier: 5 },
];

/**
 * The highest prestige level whose lifetime-mineral threshold has been met.
 * This is the level the player could *bank* right now; the banked level on
 * the save only ever moves up toward it (see sinkNewShaft in the engine).
 */
export function getPrestigeLevel(lifetimeMinerals: number): number {
  let level = 0;
  for (const p of PRESTIGE_LEVELS) {
    if (lifetimeMinerals >= p.at) level = p.level;
  }
  return level;
}

/** Permanent multiplier for a banked prestige level (clamped to the table). */
export function getPrestigeMultiplier(prestigeLevel: number): number {
  const idx = Math.min(
    Math.max(0, Math.floor(prestigeLevel)),
    PRESTIGE_LEVELS.length - 1,
  );
  return PRESTIGE_LEVELS[idx].multiplier;
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
    fastMiners: 0,
    gemChanceLevels: 0,
    legendaryMiners: 0,
    prestigeLevel: 0,
    clickBoostLevels: 0,
    comboResistLevels: 0,
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
    completedAchievements: [],
    playerSeed: Math.floor(Math.random() * 2147483647) || 1,
    ownedCosmetics: [...DEFAULT_OWNED],
    selectedOutfit: DEFAULT_OUTFIT,
    selectedPickaxe: DEFAULT_PICKAXE,
    ownedCaveThemes: [...DEFAULT_OWNED_CAVE_THEMES],
    selectedCaveTheme: DEFAULT_CAVE_THEME,
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

/** Gem cost of the next fast miner (second miner type, tier-2 unlock). */
export function getFastMinerCost(current: number): number {
  return Math.max(1, Math.ceil((current + 1) ** 4 / 8));
}

/**
 * Mineral output per second of a single fast miner: weaker than a normal
 * miner (minerPower) at every power level, with miner-power upgrades
 * applying to both types.
 */
export function getFastMinerOutput(minerPower: number): number {
  return Math.max(1, Math.floor(minerPower / 2));
}

/**
 * Gem cost of the next legendary miner (third miner type, tier-5 endgame
 * unlock). The premium curve: the same quartic family as the other types,
 * 2x the normal-miner curve — the endgame raw-output sink, not a bargain.
 */
export function getLegendaryMinerCost(current: number): number {
  return Math.max(1, Math.ceil(2 * (current + 1) ** 4));
}

/**
 * Mineral output per second of a single legendary miner: exactly double a
 * normal miner, with miner-power upgrades applying to all three types.
 * Fast miners stay the gem-efficiency play; legendaries trade the premium
 * gem cost for raw income.
 */
export function getLegendaryMinerOutput(minerPower: number): number {
  return 2 * minerPower;
}

/** Total passive minerals/sec across all three miner types. */
export function getMineralsPerSec(
  miners: number,
  minerPower: number,
  fastMiners: number,
  legendaryMiners: number = 0,
): number {
  return (
    miners * minerPower +
    fastMiners * getFastMinerOutput(minerPower) +
    legendaryMiners * getLegendaryMinerOutput(minerPower)
  );
}

/** Mineral cost of raising miner power from `current` to current + 1. */
export function getMinerPowerUpgradeCost(current: number): number {
  return 1000 * current * current;
}

export function rollGem(chance: number, comboMultiplier: number): boolean {
  return Math.random() < chance * comboMultiplier;
}

/** Effective base gem chance at the given upgrade level (capped). */
export function getGemChance(level: number): number {
  return gemChance +
    Math.min(Math.max(0, Math.floor(level)), GEM_CHANCE_MAX_LEVELS) *
      gemChancePerLevel;
}

/** Gem cost of raising gem chance from `level` to level + 1. */
export function getGemChanceCost(level: number): number {
  return 10 * (level + 1) * (level + 1);
}

// Tier-3 gem upgrade line: click power. Each level doubles tap/answer
// gains (passive income is unaffected — this is an investment in the
// player's own pickaxe, not in the crew).
/** Max levels of the click x2 upgrade: x1, x2, x4, x8, x16. */
export const CLICK_BOOST_MAX_LEVELS = 4;

/** Tap/answer gain multiplier at the given level (2^level, clamped). */
export function getClickBoostMultiplier(level: number): number {
  return 2 **
    Math.min(Math.max(0, Math.floor(level)), CLICK_BOOST_MAX_LEVELS);
}

/** Gem cost of raising the click multiplier from `level` to level + 1. */
export function getClickBoostCost(level: number): number {
  return 25 * (level + 1) * (level + 1);
}

// Tier-3 gem upgrade line: combo resistance. A wrong answer or mine tap
// normally zeroes the combo; each level keeps 10% of it instead (floored).
/** Max levels: 0% / 10% / ... / 50% of the combo survives a loss. */
export const COMBO_RESIST_MAX_LEVELS = 5;
/** Fraction of the combo kept per resistance level. */
export const comboResistRetentionPerLevel = 0.1;

/** Fraction of the combo kept on a loss at the given level (capped). */
export function getComboRetention(level: number): number {
  return Math.min(
    comboResistRetentionPerLevel *
      Math.min(
        Math.max(0, Math.floor(level)),
        COMBO_RESIST_MAX_LEVELS,
      ),
    comboResistRetentionPerLevel * COMBO_RESIST_MAX_LEVELS,
  );
}

/**
 * The combo value after a loss (wrong answer or mine tap) at the given
 * resistance level: the floored retained fraction. Level 0 zeroes it
 * (today's behavior); the result is always in [0, combo].
 */
export function getResistantComboReset(combo: number, level: number): number {
  return Math.min(
    combo,
    Math.max(0, Math.floor(combo * getComboRetention(level))),
  );
}

/** Gem cost of raising combo resistance from `level` to level + 1. */
export function getComboResistCost(level: number): number {
  return 20 * (level + 1) * (level + 1);
}

/**
 * Payout multiplier for a correct answer, folded onto the raw answer value
 * before it reaches applyAnswerReward. Operator bonus (÷ ×10, − ×2, like
 * the pre-hard-mode behavior) × the hard-mode premium when the equation has
 * a second term. useEquations applies this; EquationDisplay folds the same
 * number into the pending-gain readout so the UI and the reward agree.
 */
export function getAnswerPayoutMultiplier(equation: Equation): number {
  const opBonus =
    equation.op === Ops.div ? 10 : equation.op === Ops.sub ? 2 : 1;
  return opBonus * (equation.op2 !== undefined ? HARD_MODE_PAYOUT : 1);
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
  fastMiners: number,
  saveTime: number,
  now: number,
  multiplier = 1,
  legendaryMiners: number = 0,
): number {
  if (saveTime <= 0 || now <= saveTime) {
    return 0;
  }
  const elapsedTicks = Math.min(
    Math.max(0, Math.floor((now - saveTime) / msPerTick)),
    maxOfflineTicks,
  );
  return (
    getMineralsPerSec(miners, minerPower, fastMiners, legendaryMiners) *
    elapsedTicks *
    multiplier
  );
}
