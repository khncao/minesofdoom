import {
  DEFAULT_OWNED,
  DEFAULT_OUTFIT,
  DEFAULT_PICKAXE,
  DEFAULT_OWNED_CAVE_THEMES,
  DEFAULT_CAVE_THEME,
  OUTFITS,
  PICKAXES,
  isCaveThemeId,
  isOutfitId,
  isPickaxeId,
} from "./cosmetics";
import { Equation, Ops } from "src/utils/math/equations";
import type { NumberNotation } from "src/utils/format";

/**
 * Save data model — the persisted game state.
 *
 * `minerals`, `lifetimeMinerals` and `maxDepth` are `bigint`: minerals grow
 * unbounded (an idle game must never cap the counter) and a number would
 * lose integer precision past 2^53. Everything else is plain JSON; the
 * bigint fields travel as decimal strings (see `serializeSaveData` /
 * `buildSaveData`), so the save still round-trips through AsyncStorage /
 * JSON.parse without adapters.
 */
export type SaveData = {
  minerals: bigint;
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
  lifetimeMinerals: bigint;
  lifetimeCorrect: number;
  maxCombo: number;
  maxDepth: bigint;
  minersOwnedEver: number;
  totalGemsMinted: number;
  totalGemsSpent: number;
  totalPrestiges: number;
  // Lifetime ACTIVE time in the mine, whole seconds (todo: statistics
  // detail). Counted by the engine's tick loop while the app is running
  // (foreground/active time only — offline earnings and away time never
  // count), flushed into state at save time. Display stat for the records
  // panel; never gates progression.
  playSeconds: number;
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
  /**
   * Show every purchase button at all times (default off). Off, the
   * non-core buttons stay hidden until the player's lifetime economy has
   * reached the base cost of the first purchase (getVisiblePurchases).
   */
  showAllPurchases: boolean;
  /**
   * Low-end fallback (plan §4.5): render plain emoji instead of the
   * procedural pixel-sprite PNGs (miners, currency icons, debris, cave
   * strips) for devices where image decode/render is the bottleneck.
   */
  emojiArt: boolean;
  /**
   * Haptic feedback (on by default): tap ticks on mining, a beat on
   * correct answers, a thud on wrong ones, a double-tap on achievements
   * and purchases (see haptics.ts / hooks/useHaptics.ts). Off on
   * platforms without haptics hardware anyway.
   */
  haptics: boolean;
  /**
   * Reduce effects (OFF by default): the manual accessibility kill switch
   * for the decorative juice — debris bursts, the combo flash, the
   * gem-pocket pulse, the miners' bobbing, the save-pill pulse. OR'd with
   * the OS-level prefers-reduced-motion preference in hooks/
   * useAccessibilityReduceMotion.ts, so it covers the platforms where the
   * OS setting can't reach the game (React Native has no iOS/Android
   * reduce-motion API yet) and gives everyone a manual off. Old settings
   * never carry the field — the settings merge supplies the default (no
   * migration).
   */
  reduceEffects: boolean;
  /**
   * Idle reminder (on by default): after a minute without a cave tap or
   * answer, a single one-per-session toast reminds the player that the
   * mine keeps collecting while away and progress autosaves (see
   * idleReminder.ts / hooks/useIdleReminder.ts). No reward, no timer —
   * a plain information nudge.
   */
  idleReminder: boolean;
  /**
   * Cave ambience music (on by default): a soft looping ambient bed under
   * the SFX at the INDEPENDENT musicVolume level (no longer a fraction of
   * the SFX level — the pass-3 accessibility fix) and follows the menu
   * mute toggle (see hooks/useSounds.ts). Off: SFX only.
   */
  music: boolean;
  /**
   * SFX volume in percent (0–100, default 100): the level of every
   * in-game sound, on top of the menu mute toggle (which still wins —
   * a muted player never hears anything). Stepped in 10% units from
   * the settings panel and clamped by clampSoundVolume on the way in
   * (see useSounds.ts).
   */
  soundVolume: number;
  /**
   * Music volume in percent (0–100, default 50): the level of the cave-
   * ambience bed, independent of the SFX level since the pass-3
   * accessibility fix (previously locked to half the SFX level). The
   * default 50 keeps the old default experience for a 100% SFX player.
   * Stepped in 10% units from the settings panel and clamped by
   * clampMusicVolume on the way in (see useSounds.ts).
   */
  musicVolume: number;
  /**
   * Number notation (default "compact"): how big numbers are written
   * everywhere (pass-8 "the number notation is a fixed ladder" item — the
   * genre guide's cozy-vs-clinical choice as a plain preference toggle).
   * "compact" is the original suffix ladder (1.2k, 3.4M); "plain" writes
   * full numbers with thousand separators (1,234,567). Cycled from the
   * settings row and pushed to the live store in utils/format
   * (setNumberNotation), which formatNumber's default argument reads —
   * no call site threads it. Clamped by clampNumberNotation on the way
   * in; old settings get the default through the settings merge (no
   * migration).
   */
  notation: NumberNotation;
};

export const saveDataKey = "save";
export const saveVersion = 11;
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
      playerSeed: num(
        data.playerSeed,
        (num(data.startTime, 0) + num(data.saveTime, 0)) % 2147483647 || 12345,
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
  // 9 -> 10: minerals / lifetimeMinerals / maxDepth become bigint. The stored
  // VALUES are unchanged (numbers here, strings once serialized post-10);
  // buildSaveData parses them to bigint, so the migration is a no-op.
  9: (data) => ({ ...data, saveVersion: 10 }),
  // 10 -> 11: lifetime active time (playSeconds). Old saves have no clock to
  // recover — they start at 0, so the counter measures time from the update
  // forward (honest: it never back-fills away time as play time).
  10: (data) => {
    const num = (v: unknown, fallback: number) =>
      typeof v === "number" && Number.isFinite(v) ? v : fallback;
    return {
      ...data,
      saveVersion: 11,
      playSeconds: Math.max(0, Math.floor(num(data.playSeconds, 0))),
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

/**
 * Build a current-version SaveData from a migrated parsed record, field by
 * field (no blind spread) so fields removed in updates are dropped on the
 * next save instead of lingering forever, and non-finite numbers can't
 * poison the loop with NaN. Fallbacks mirror createEmptySaveData so older
 * saves missing newer fields still load correctly. Used by the engine's
 * loader and by the save-code importer (saveCode.ts), so the two entry
 * points can't drift apart in how they validate a save.
 */
export function buildSaveData(
  migrated: Record<string, unknown>,
  now: number,
): SaveData {
  const num = (v: unknown, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) ? v : fallback;
  // The bigint mineral counters: v10 serializes them as decimal strings, but
  // a pre-v10 number (or a bigint, in-memory) is accepted the same way.
  // Precision on a legacy numeric save was already number-precision — the
  // value is what the player last saw, nothing can be recovered.
  const mineral = (v: unknown, fallback: bigint): bigint => {
    if (typeof v === "bigint") return v < 0n ? 0n : v;
    if (typeof v === "string") {
      try {
        const n = BigInt(v);
        return n < 0n ? 0n : n;
      } catch {
        return fallback;
      }
    }
    if (typeof v === "number" && Number.isFinite(v) && v > 0) {
      return BigInt(Math.floor(v));
    }
    return fallback;
  };
  return {
    minerals: mineral(migrated.minerals, 0n),
    gems: num(migrated.gems, 0),
    clickPower: num(migrated.clickPower, 1),
    miners: num(migrated.miners, 0),
    minerPower: num(migrated.minerPower, 1),
    fastMiners: Math.max(0, Math.floor(num(migrated.fastMiners, 0))),
    legendaryMiners: Math.max(0, Math.floor(num(migrated.legendaryMiners, 0))),
    gemChanceLevels: Math.min(
      GEM_CHANCE_MAX_LEVELS,
      Math.max(0, Math.floor(num(migrated.gemChanceLevels, 0))),
    ),
    prestigeLevel: Math.min(
      PRESTIGE_LEVELS.length - 1,
      Math.max(0, Math.floor(num(migrated.prestigeLevel, 0))),
    ),
    clickBoostLevels: Math.min(
      CLICK_BOOST_MAX_LEVELS,
      Math.max(0, Math.floor(num(migrated.clickBoostLevels, 0))),
    ),
    comboResistLevels: Math.min(
      COMBO_RESIST_MAX_LEVELS,
      Math.max(0, Math.floor(num(migrated.comboResistLevels, 0))),
    ),
    startTime: num(migrated.startTime, now),
    saveTime: num(migrated.saveTime, now),
    saveVersion: num(migrated.saveVersion, saveVersion),
    lifetimeMinerals: mineral(migrated.lifetimeMinerals, 0n),
    lifetimeCorrect: num(migrated.lifetimeCorrect, 0),
    maxCombo: num(migrated.maxCombo, 0),
    maxDepth: mineral(migrated.maxDepth, 0n),
    minersOwnedEver: num(migrated.minersOwnedEver, 0),
    totalGemsMinted: num(migrated.totalGemsMinted, 0),
    totalGemsSpent: num(migrated.totalGemsSpent, 0),
    totalPrestiges: num(migrated.totalPrestiges, 0),
    playSeconds: Math.max(0, Math.floor(num(migrated.playSeconds, 0))),
    completedTiers: Array.isArray(migrated.completedTiers)
      ? migrated.completedTiers.filter(
          (t): t is string => typeof t === "string",
        )
      : [],
    completedAchievements: Array.isArray(migrated.completedAchievements)
      ? migrated.completedAchievements.filter(
          (c): c is string => typeof c === "string",
        )
      : [],
    playerSeed: num(migrated.playerSeed, 12345),
    // Always keep the free defaults owned; drop unknown ids.
    ownedCosmetics: [
      ...new Set([
        ...DEFAULT_OWNED,
        ...(Array.isArray(migrated.ownedCosmetics)
          ? migrated.ownedCosmetics.filter(
              (c): c is string =>
                typeof c === "string" && (isOutfitId(c) || isPickaxeId(c)),
            )
          : []),
      ]),
    ],
    selectedOutfit:
      typeof migrated.selectedOutfit === "string" &&
      OUTFITS.some((o) => o.id === migrated.selectedOutfit)
        ? migrated.selectedOutfit
        : DEFAULT_OUTFIT,
    selectedPickaxe:
      typeof migrated.selectedPickaxe === "string" &&
      PICKAXES.some((p) => p.id === migrated.selectedPickaxe)
        ? migrated.selectedPickaxe
        : DEFAULT_PICKAXE,
    // Always keep the free default cave theme owned; drop unknown ids.
    ownedCaveThemes: [
      ...new Set([
        ...DEFAULT_OWNED_CAVE_THEMES,
        ...(Array.isArray(migrated.ownedCaveThemes)
          ? migrated.ownedCaveThemes.filter(
              (c): c is string => typeof c === "string" && isCaveThemeId(c),
            )
          : []),
      ]),
    ],
    selectedCaveTheme:
      typeof migrated.selectedCaveTheme === "string" &&
      isCaveThemeId(migrated.selectedCaveTheme)
        ? migrated.selectedCaveTheme
        : DEFAULT_CAVE_THEME,
  };
}

// ---------------------------------------------------------------------------
// Exact float scaling (the bridge between the bigint mineral counters and
// the float multipliers: prestige, depth-tier click bonus).
//
// Every multiplier in the game is an exact multiple of 0.01, so scale-100
// integer arithmetic is lossless for one factor; two factors compose at
// scale 10,000, still exact. The final division rounds half-up — minerals
// are an idle counter, never a currency ledger, so a half mineral is worth
// the determinism.
// ---------------------------------------------------------------------------
export const FLOAT_SCALE = 100n;

/**
 * Multiply a bigint by a list of float multipliers exactly (see above):
 * `mulFloats(60n, [1.5]) === 90n`, `mulFloats(1n, [1.1, 1.5]) === 2n`.
 */
export function mulFloats(value: bigint, floats: readonly number[]): bigint {
  if (value <= 0n) return 0n;
  let num = 1n;
  let den = 1n;
  for (const f of floats) {
    num *= BigInt(Math.round(f * 100));
    den *= FLOAT_SCALE;
  }
  return (value * num + den / 2n) / den;
}

/**
 * JSON-safe stringify for the save: bigint fields travel as decimal strings
 * (plain JSON.stringify throws on bigint). Shared by the AsyncStorage save
 * and the save-code encoder so both serializations stay identical.
 */
export function serializeSaveData(data: SaveData): string {
  return JSON.stringify(data, (_k, v) =>
    typeof v === "bigint" ? v.toString() : v,
  );
}

/** Walk a parsed save through every migration up to the current version. */
export function migrateSaveData(
  parsed: Record<string, unknown>,
): Record<string, unknown> {
  let version =
    typeof parsed.saveVersion === "number" &&
    Number.isFinite(parsed.saveVersion)
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
/**
 * Extra ticks of offline earnings a rewarded ad can unlock (plan §5.1
 * "instant offline top-up — once offline progress hits the cap, watching
 * extends it by +2h"). Only meaningful when the away time exceeded
 * maxOfflineTicks; beyond that the top-up itself caps at these 2h.
 */
export const offlineTopUpTicks = 2 * 60 * 60;
/**
 * Ticks of ACTIVE play time a single tick-loop fire may book into
 * SaveData.playSeconds. The tick loop reports the REAL elapsed time since
 * the previous fire: in the foreground that is ~1 tick (0 or 2 with timer
 * jitter), but the first fire after a background gap reports the whole
 * absence at once (up to maxOfflineTicks). Paying that mineral catch-up is
 * the feature; booking it as active play time would inflate playSeconds
 * (documented as foreground/active time only — offline earnings and away
 * time never count). The mineral path keeps using the full elapsed; the
 * play-time path is capped here instead.
 */
export const LIVE_PLAY_TICK_CAP = 2;
/**
 * How many seconds of active play time one tick-loop fire contributes:
 * zero while the app is not active (backgrounded app / hidden tab),
 * otherwise the whole-tick elapsed clamped to LIVE_PLAY_TICK_CAP so a
 * catch-up fire never books away time as play time.
 */
export function activePlaySeconds(
  elapsedTicks: number,
  isActive: boolean,
): number {
  if (!isActive) return 0;
  const whole =
    typeof elapsedTicks === "number" && Number.isFinite(elapsedTicks)
      ? Math.max(0, Math.floor(elapsedTicks))
      : 0;
  return Math.min(whole, LIVE_PLAY_TICK_CAP);
}
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
export function getDepthTier(depth: number | bigint): DepthTier {
  const d = BigInt(depth);
  let tier = DEPTH_TIERS[0];
  for (const t of DEPTH_TIERS) {
    if (d >= BigInt(t.at)) tier = t;
  }
  return tier;
}

/**
 * Virtual span (in depth units) the progress bar covers inside the FINAL
 * tier, which has no next threshold. Matches the widest real tier span
 * (150→500) so the cave keeps scrolling at a familiar pace until it caps.
 */
export const FINAL_TIER_PROGRESS_SPAN = 350;

/**
 * Progress toward the next depth tier, 0..1, linear in depth.
 *
 * General tier-progress helper (e.g. a depth-banner progress line).
 * The cave background's descent itself runs on ABSOLUTE depth — the rock
 * slides proportionally to every meter mined (`caveTiles.ts`
 * `caveRowStartForDepth` / `caveTranslateForDepth`), not on this.
 * The final tier advances across a fixed virtual span and caps at 1.
 *
 * Takes LIFETIME mined minerals (not the balance): spending minerals must
 * never regress depth (depth is lifetime-mining based, so it only ever
 * advances).
 */
export function getDepthTierProgress(
  lifetimeMinerals: number | bigint,
): number {
  const depth = getDepth(lifetimeMinerals);
  const tier = getDepthTier(depth);
  const next = DEPTH_TIERS[tier.id + 1];
  const span = next
    ? BigInt(next.at - tier.at)
    : BigInt(FINAL_TIER_PROGRESS_SPAN);
  const into = depth - BigInt(tier.at);
  if (span <= 0n) return 1;
  const clamped = into < 0n ? 0n : into > span ? span : into;
  return Number(clamped) / Number(span);
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
export function getPrestigeLevel(lifetimeMinerals: number | bigint): number {
  const lifetime = BigInt(lifetimeMinerals);
  let level = 0;
  for (const p of PRESTIGE_LEVELS) {
    if (lifetime >= BigInt(p.at)) level = p.level;
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
    minerals: 0n,
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
    lifetimeMinerals: 0n,
    lifetimeCorrect: 0,
    maxCombo: 0,
    maxDepth: 0n,
    minersOwnedEver: 0,
    totalGemsMinted: 0,
    totalGemsSpent: 0,
    totalPrestiges: 0,
    playSeconds: 0,
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
 * Stats only ever increase; maxDepth is re-derived from post-gain LIFETIME
 * minerals (the depth's source, see getDepth) so it can never go backwards
 * when a purchase later spends the balance down.
 */
export function lifetimeDelta(
  n: SaveData,
  d: {
    minerals?: number | bigint;
    correct?: number;
    combo?: number;
    newMiners?: number;
    gemsMinted?: number;
  },
): Partial<SaveData> {
  const gained = d.minerals == null ? 0n : BigInt(d.minerals);
  const newMaxDepth = getDepth(n.lifetimeMinerals + gained);
  return {
    lifetimeMinerals: n.lifetimeMinerals + gained,
    lifetimeCorrect: n.lifetimeCorrect + (d.correct ?? 0),
    maxCombo: Math.max(n.maxCombo, d.combo ?? 0),
    maxDepth: n.maxDepth > newMaxDepth ? n.maxDepth : newMaxDepth,
    minersOwnedEver:
      d.newMiners != null
        ? Math.max(n.minersOwnedEver, d.newMiners)
        : n.minersOwnedEver,
    totalGemsMinted: n.totalGemsMinted + (d.gemsMinted ?? 0),
  };
}

export const defaultSettingsData = {
  autosave: 30,
  showAllPurchases: false,
  emojiArt: false,
  haptics: true,
  reduceEffects: false,
  idleReminder: true,
  music: true,
  soundVolume: 100,
  musicVolume: 50,
  notation: "compact" as NumberNotation,
};

/**
 * Clamp a parsed/persisted SFX volume to the 0–100 percent range. Old
 * saves (pre-soundVolume) never carry the field — the settings merge
 * ({ ...defaultSettingsData, ...parsed }) supplies the 100 default — so
 * this guards the UI step and any hand-edited save code: junk values
 * fall back to the default instead of NaN-ing the audio layer.
 */
export function clampSoundVolume(volume: unknown): number {
  const n = typeof volume === "number" ? volume : NaN;
  if (!Number.isFinite(n)) {
    return defaultSettingsData.soundVolume;
  }
  return Math.min(100, Math.max(0, Math.round(n)));
}

/**
 * Clamp a parsed/persisted music volume to the 0–100 percent range. Old
 * settings (pre-musicVolume) never carry the field — the settings merge
 * ({ ...defaultSettingsData, ...parsed }) supplies the 50 default, which
 * keeps the former half-level law's default experience (a 100% SFX player
 * heard the bed at 0.5) — so this guards the UI step and hand-edited
 * values: junk values fall back to the default instead of NaN-ing the
 * audio layer.
 */
export function clampMusicVolume(volume: unknown): number {
  const n = typeof volume === "number" ? volume : NaN;
  if (!Number.isFinite(n)) {
    return defaultSettingsData.musicVolume;
  }
  return Math.min(100, Math.max(0, Math.round(n)));
}

/**
 * The ambient music bed's level, from the INDEPENDENT music-volume setting
 * (settings.musicVolume), on expo-audio's 0.0–1.0 scale. The pass-3
 * accessibility fix dropped the old "half the SFX level" law so the bed
 * can be heard with the SFX muted-quiet and vice versa; the menu mute
 * toggle still pauses it outright. Pure so the level law is
 * unit-testable next to clampSoundVolume.
 */
export function musicLevel(musicVolume: unknown): number {
  return clampMusicVolume(musicVolume) / 100;
}

/**
 * Clamp a parsed/persisted notation mode to the two known values. Old
 * settings (pre-notation) never carry the field — the settings merge
 * ({ ...defaultSettingsData, ...parsed }) supplies the "compact" default,
 * which is the game's original notation — so this guards hand-edited or
 * hand-written save values: anything that isn't exactly "plain" falls
 * back to the default instead of rendering a bogus mode.
 */
export function clampNumberNotation(value: unknown): NumberNotation {
  return value === "plain" ? "plain" : defaultSettingsData.notation;
}

/** Every purchase button id (see PurchaseId). */
export type PurchaseId =
  | "power"
  | "miner"
  | "gem"
  | "minerPower"
  | "fastMiner"
  | "legendaryMiner"
  | "gemChance"
  | "clickBoost"
  | "comboResist"
  | "prestige";

export const ALL_PURCHASE_IDS: readonly PurchaseId[] = [
  "power",
  "miner",
  "gem",
  "minerPower",
  "fastMiner",
  "legendaryMiner",
  "gemChance",
  "clickBoost",
  "comboResist",
  "prestige",
];

/**
 * Buttons that are always visible regardless of visibility state: the core
 * loop (upgrade pick, buy a miner, buy a gem) is the onboarding surface and
 * must never disappear.
 */
export const ALWAYS_VISIBLE_PURCHASES: readonly PurchaseId[] = [
  "power",
  "miner",
  "gem",
];

/** Goal-tier unlock flags that force a button visible even pre-purchase. */
export type PurchaseUnlocks = {
  minerPowerUnlocked: boolean;
  fastMinerUnlocked: boolean;
  legendaryMinerUnlocked: boolean;
  prestigeUnlocked: boolean;
};

/**
 * Which purchase buttons to show (plan "Adjust": hide the wall of buttons).
 * A non-core button appears once the player has EVER been able to afford its
 * first purchase — measured with lifetime stats, so visibility can only ever
 * turn on (no flicker as minerals come and go, and a sunk shaft doesn't hide
 * buttons again). Goal-tier unlocks also reveal the matching button, since
 * the tier bonus is the natural moment to meet the purchase. Lifetime gems
 * proxy "ever held" via totalGemsMinted (current gems can never exceed the
 * lifetime-minted count, so a button never appears before it could be bought).
 */
export function getVisiblePurchases(
  lifetime: Pick<SaveData, "lifetimeMinerals" | "totalGemsMinted">,
  unlocks: PurchaseUnlocks,
): ReadonlySet<PurchaseId> {
  const visible = new Set<PurchaseId>(ALWAYS_VISIBLE_PURCHASES);
  const { lifetimeMinerals, totalGemsMinted } = lifetime;
  if (
    unlocks.minerPowerUnlocked ||
    lifetimeMinerals >= BigInt(getMinerPowerUpgradeCost(1))
  ) {
    visible.add("minerPower");
  }
  if (unlocks.fastMinerUnlocked || totalGemsMinted >= getFastMinerCost(0)) {
    visible.add("fastMiner");
  }
  if (
    unlocks.legendaryMinerUnlocked ||
    totalGemsMinted >= getLegendaryMinerCost(0)
  ) {
    visible.add("legendaryMiner");
  }
  if (unlocks.fastMinerUnlocked || totalGemsMinted >= getGemChanceCost(0)) {
    visible.add("gemChance");
  }
  if (unlocks.prestigeUnlocked || totalGemsMinted >= getClickBoostCost(0)) {
    visible.add("clickBoost");
  }
  if (unlocks.prestigeUnlocked || totalGemsMinted >= getComboResistCost(0)) {
    visible.add("comboResist");
  }
  if (
    unlocks.prestigeUnlocked ||
    lifetimeMinerals >= BigInt(PRESTIGE_LEVELS[1].at)
  ) {
    visible.add("prestige");
  }
  return visible;
}

/**
 * Snapshot of everything that decides whether a purchase button is enabled
 * (mirrors the disabled flags in PurchaseButtons.tsx). Kept as a plain
 * object so the pure check is testable without the React tree.
 */
export type PurchaseAffordability = {
  minerals: bigint;
  gems: number;
  clickPower: number;
  minerPower: number;
  miners: number;
  fastMiners: number;
  legendaryMiners: number;
  gemChanceLevels: number;
  clickBoostLevels: number;
  comboResistLevels: number;
  prestigeLevel: number;
  lifetimeMinerals: bigint;
  minerPowerUnlocked: boolean;
  fastMinerUnlocked: boolean;
  legendaryMinerUnlocked: boolean;
  prestigeUnlocked: boolean;
};

/**
 * "Something you can buy right now" check for the indicator dot on the
 * floating upgrades button (todo: "add indicator on upgrades button when
 * something is purchaseable"). A purchase counts only if it is currently
 * visible AND passes the same check as its button's disabled flag — a dot
 * pointing at a row that isn't rendered (or still locked) would be noise.
 */
export function hasAffordablePurchase(
  visible: ReadonlySet<PurchaseId>,
  s: PurchaseAffordability,
): boolean {
  if (s.minerals >= BigInt(getClickUpgradeCost(s.clickPower))) return true;
  if (
    visible.has("minerPower") &&
    s.minerPowerUnlocked &&
    s.minerals >= BigInt(getMinerPowerUpgradeCost(s.minerPower))
  ) {
    return true;
  }
  if (s.minerals >= BigInt(gemMineralCost)) return true;
  if (s.gems >= getMinerUpgradeCost(s.miners)) return true;
  if (
    visible.has("fastMiner") &&
    s.fastMinerUnlocked &&
    s.gems >= getFastMinerCost(s.fastMiners)
  ) {
    return true;
  }
  if (
    visible.has("legendaryMiner") &&
    s.legendaryMinerUnlocked &&
    s.gems >= getLegendaryMinerCost(s.legendaryMiners)
  ) {
    return true;
  }
  if (
    visible.has("gemChance") &&
    s.fastMinerUnlocked &&
    s.gemChanceLevels < GEM_CHANCE_MAX_LEVELS &&
    s.gems >= getGemChanceCost(s.gemChanceLevels)
  ) {
    return true;
  }
  if (
    visible.has("clickBoost") &&
    s.prestigeUnlocked &&
    s.clickBoostLevels < CLICK_BOOST_MAX_LEVELS &&
    s.gems >= getClickBoostCost(s.clickBoostLevels)
  ) {
    return true;
  }
  if (
    visible.has("comboResist") &&
    s.prestigeUnlocked &&
    s.comboResistLevels < COMBO_RESIST_MAX_LEVELS &&
    s.gems >= getComboResistCost(s.comboResistLevels)
  ) {
    return true;
  }
  if (
    visible.has("prestige") &&
    s.prestigeUnlocked &&
    getPrestigeLevel(s.lifetimeMinerals) > s.prestigeLevel
  ) {
    return true;
  }
  return false;
}

/**
 * How many levels the buy-all action can buy in one call, per currency.
 * (todo: "buy all mineral upgrades" / "buy all gem upgrades").
 */
export type BuyAllPlan = {
  clickPower: number;
  minerPower: number;
  miners: number;
  fastMiners: number;
  legendaryMiners: number;
  gemChance: number;
  clickBoost: number;
  comboResist: number;
  totalLevels: number;
  /**
   * Sum of every bought level's cost, in the plan's currency. Float
   * (display only) — the engine re-derives exact per-level costs when it
   * applies the plan, so this can never overstate what is spent.
   */
  totalCost: number;
};

/**
 * Max size of one cheapest-line batch inside computeBuyAll. Batches keep the
 * per-level greedy cheap on huge endgame budgets (a batch is a
 * binary-searched run of levels on a single line); the cap only bounds the
 * worst case — a capped batch simply ends the round and the loop re-evaluates.
 */
const BUY_ALL_MAX_BATCH = 2 ** 22;
/**
 * Defensive bound on computeBuyAll rounds (a round = one cheapest-line
 * batch). Rounds are bounded by how often the cheapest affordable line
 * switches plus one, not by level counts — this cap only guards against
 * pathological cost-curve oscillation.
 */
const BUY_ALL_MAX_ROUNDS = 1000;

/**
 * Float sum of `count` levels of `cost` starting at `fromLevel` (inclusive).
 * Approximate by design — used only to size batches; affordability is
 * re-checked per level with exact (BigInt / integer) arithmetic wherever the
 * plan is applied.
 */
function buyAllCumulativeCost(
  cost: (level: number) => number,
  fromLevel: number,
  count: number,
): number {
  let sum = 0;
  for (let i = 0; i < count; i++) {
    sum += cost(fromLevel + i);
    if (!Number.isFinite(sum)) break;
  }
  return sum;
}

/**
 * "Buy all" for one currency group (todo: "add buy all mineral upgrades
 * button and buy all gem upgrades button"): the per-line level counts a
 * greedy per-level purchase would buy — repeatedly buy the single cheapest
 * next level among the eligible lines until nothing else is affordable —
 * plus the total cost in that currency.
 *
 * Rules, mirroring the individual buttons' disabled flags (so buy-all only
 * ever buys what its group could buy by hand):
 *  - minerals group: click-power upgrade always; miner-power upgrade once
 *    unlocked; "buy a gem" is a currency conversion, NOT an upgrade, and is
 *    deliberately excluded (buy-all must never drain the wallet to gems);
 *  - gems group: all three miner types, gem chance, click ×2 and combo
 *    resistance — each behind its goal-tier unlock, the capped lines behind
 *    their caps;
 *  - `visible` (when given) hides lines whose button isn't rendered, same
 *    as the row visibility rules; locked/unaffordable lines are skipped.
 *
 * The greedy is batched for speed on endgame budgets: each round buys a
 * run of levels on the cheapest line (binary-searched, valid while every
 * level in the run stays strictly cheaper than the next-cheapest rival and
 * fits the budget), then re-evaluates — which is exactly the per-level
 * greedy, just without re-scanning level by level.
 */
export function computeBuyAll(
  currency: "minerals" | "gems",
  s: PurchaseAffordability,
  visible?: ReadonlySet<PurchaseId>,
): BuyAllPlan {
  const plan: BuyAllPlan = {
    clickPower: 0,
    minerPower: 0,
    miners: 0,
    fastMiners: 0,
    legendaryMiners: 0,
    gemChance: 0,
    clickBoost: 0,
    comboResist: 0,
    totalLevels: 0,
    totalCost: 0,
  };
  type LineKey =
    | "clickPower"
    | "minerPower"
    | "miners"
    | "fastMiners"
    | "legendaryMiners"
    | "gemChance"
    | "clickBoost"
    | "comboResist";
  type Line = {
    key: LineKey;
    id: PurchaseId;
    level: number;
    max: number | null;
    cost: (level: number) => number;
  };
  const lines: Line[] =
    currency === "minerals"
      ? [
          {
            key: "clickPower",
            id: "power",
            level: s.clickPower,
            max: null,
            cost: getClickUpgradeCost,
          },
          {
            key: "minerPower",
            id: "minerPower",
            level: s.minerPower,
            max: null,
            cost: getMinerPowerUpgradeCost,
          },
        ]
      : [
          {
            key: "miners",
            id: "miner",
            level: s.miners,
            max: null,
            cost: getMinerUpgradeCost,
          },
          {
            key: "fastMiners",
            id: "fastMiner",
            level: s.fastMiners,
            max: null,
            cost: getFastMinerCost,
          },
          {
            key: "legendaryMiners",
            id: "legendaryMiner",
            level: s.legendaryMiners,
            max: null,
            cost: getLegendaryMinerCost,
          },
          {
            key: "gemChance",
            id: "gemChance",
            level: s.gemChanceLevels,
            max: GEM_CHANCE_MAX_LEVELS,
            cost: getGemChanceCost,
          },
          {
            key: "clickBoost",
            id: "clickBoost",
            level: s.clickBoostLevels,
            max: CLICK_BOOST_MAX_LEVELS,
            cost: getClickBoostCost,
          },
          {
            key: "comboResist",
            id: "comboResist",
            level: s.comboResistLevels,
            max: COMBO_RESIST_MAX_LEVELS,
            cost: getComboResistCost,
          },
        ];
  // Same gating as the buttons' disabled flags (see PurchaseButtons.tsx
  // and hasAffordablePurchase): visibility first, then the goal-tier unlock.
  const eligible = (line: Line): boolean => {
    if (visible != null && !visible.has(line.id)) return false;
    switch (line.id) {
      case "power":
      case "miner":
        return true;
      case "minerPower":
        return s.minerPowerUnlocked;
      case "fastMiner":
      case "gemChance":
        return s.fastMinerUnlocked;
      case "legendaryMiner":
        return s.legendaryMinerUnlocked;
      case "clickBoost":
      case "comboResist":
        return s.prestigeUnlocked;
      default:
        // Exhaustive over PurchaseId — a new purchase id without a gate
        // here would silently be un-buyable via buy-all; fail loud.
        return false;
    }
  };
  let budget =
    currency === "minerals" ? s.minerals : BigInt(Math.max(0, s.gems));
  for (let round = 0; round < BUY_ALL_MAX_ROUNDS; round++) {
    // Every eligible, not-maxed line whose next level the budget can cover,
    // cheapest first (ties keep the fixed line order — the deterministic
    // pick a repeated hand-tap would make is arbitrary anyway).
    const affordable = lines
      .filter((line) => {
        const next = line.cost(line.level);
        return (
          eligible(line) &&
          (line.max == null || line.level < line.max) &&
          Number.isFinite(next) &&
          budget >= BigInt(next)
        );
      })
      .map((line) => ({ line, next: line.cost(line.level) }))
      .sort(
        (a, b) =>
          a.next - b.next || lines.indexOf(a.line) - lines.indexOf(b.line),
      );
    if (affordable.length === 0) break;
    const best = affordable[0].line;
    // The batch may grow while every level in it stays strictly cheaper
    // than the next-cheapest rival's next cost (once it isn't, the rival is
    // due its pick — re-evaluate) and while the float cumulative fits the
    // budget (the engine's exact per-level application is the authority).
    const rivalNext =
      affordable.length > 1 ? affordable[1].next : Number.POSITIVE_INFINITY;
    const valid = (count: number): boolean => {
      if (best.max != null && best.level + count > best.max) return false;
      // count === 1 is always valid (the line is affordable and, on a tie,
      // the greedy still buys one level and re-evaluates).
      if (count > 1 && best.cost(best.level + count - 1) >= rivalNext) {
        return false;
      }
      const sum = buyAllCumulativeCost(best.cost, best.level, count);
      return Number.isFinite(sum) && BigInt(Math.floor(sum)) <= budget;
    };
    // Binary-search the largest valid batch: double hi while valid (the
    // geometric series keeps the total work ~2x the final batch), then
    // split the last [hi, 2hi] gap.
    let hi = 1;
    while (hi < BUY_ALL_MAX_BATCH && valid(hi << 1)) {
      hi <<= 1;
    }
    // Invariant at the split: valid(hi) and, if hi < cap, valid(2hi) false —
    // so the answer is in [hi, 2hi); when hi hit the cap it is exactly hi.
    let answer = hi;
    if (hi < BUY_ALL_MAX_BATCH) {
      let a = hi;
      let b = (hi << 1) + 1; // exclusive-ish; valid(b) false (b = 2hi)
      while (a + 1 < b) {
        const mid = (a + b) >> 1;
        if (valid(mid)) a = mid;
        else b = mid;
      }
      answer = a;
    }
    const sum = buyAllCumulativeCost(best.cost, best.level, answer);
    plan[best.key] += answer;
    best.level += answer;
    plan.totalLevels += answer;
    plan.totalCost += sum;
    budget -= BigInt(Math.floor(sum));
  }
  return plan;
}

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
  return (
    gemChance +
    Math.min(Math.max(0, Math.floor(level)), GEM_CHANCE_MAX_LEVELS) *
      gemChancePerLevel
  );
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
  return 2 ** Math.min(Math.max(0, Math.floor(level)), CLICK_BOOST_MAX_LEVELS);
}

/** Gem cost of raising the click multiplier from `level` to level + 1. */
export function getClickBoostCost(level: number): number {
  return 25 * (level + 1) * (level + 1);
}

// Combo multiplier: every COMBO_TIER_SIZE correct answers in a row raises
// the multiplier by 1 (1 + floor(combo / 10)).
/** Correct answers per combo multiplier tier. */
export const COMBO_TIER_SIZE = 10;

/** Combo multiplier for the given combo counter. */
export function getComboMultiplier(combo: number): number {
  return 1 + Math.floor(combo / COMBO_TIER_SIZE);
}

/**
 * Progress within the current combo tier, for the ComboIndicator progress
 * bar: `fraction` in [0, 1), `untilNext` correct answers until the
 * multiplier steps up, `nextMultiplier` once it does.
 */
export function getComboTierProgress(combo: number): {
  fraction: number;
  untilNext: number;
  nextMultiplier: number;
} {
  const untilNext = COMBO_TIER_SIZE - (combo % COMBO_TIER_SIZE);
  return {
    fraction: 1 - untilNext / COMBO_TIER_SIZE,
    untilNext,
    nextMultiplier: getComboMultiplier(combo) + 1,
  };
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
      Math.min(Math.max(0, Math.floor(level)), COMBO_RESIST_MAX_LEVELS),
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
 * Operator premium, per op symbol. Division stays the top scorer (×10);
 * the soft-mode-only extras (todo: "More types of simple mental
 * arithmetics for all ages") sit in between: squares ×4 (a whole new
 * fact table) and percentages ×3 (sight 10/25/50%); − ×2 as before.
 */
export function getOpPayoutMultiplier(op: string): number {
  switch (op) {
    case Ops.div:
      return 10;
    case Ops.sq:
      return 4;
    case Ops.pct:
      return 3;
    case Ops.sub:
      return 2;
    default:
      return 1;
  }
}

/**
 * The operator-side premium for a WHOLE equation: missing-number
 * equations ("a + ? = b" / "a * ? = b") pay a flat ×3 — the underlying
 * op is always + or × (no bonus on its own), the premium is for working
 * the op backwards.
 */
export function getEquationOpBonus(equation: Equation): number {
  return equation.missing ? 3 : getOpPayoutMultiplier(equation.op);
}

/**
 * Payout multiplier for a correct answer, folded onto the raw answer value
 * before it reaches applyAnswerReward. Operator bonus (÷ ×10, ² ×4, % ×3,
 * missing ×3, − ×2) × the hard-mode premium when the equation has a second
 * term. useEquations applies this; EquationDisplay folds the same number
 * into the pending-gain readout so the UI and the reward agree.
 */
export function getAnswerPayoutMultiplier(equation: Equation): number {
  const opBonus = getEquationOpBonus(equation);
  return opBonus * (equation.op2 !== undefined ? HARD_MODE_PAYOUT : 1);
}

/**
 * The EXACT minerals a correct answer to this equation will earn — the
 * pending-gain readout's number (pass-15 audit finding (1),
 * `math:pending-gain`). Mirrors applyAnswerReward's integer core: the
 * premium-folded answer value (floored at 1 exactly like the reward
 * does — degenerate zero-answer equations pay the same floor) × the
 * EFFECTIVE click power × the combo multiplier. The float tail (depth-tier
 * click bonus, prestige) already rides inside the caller's effective click
 * power via mulFloats, exactly as applyAnswerReward applies it, so the
 * readout agrees with the floating "+N" on solve digit for digit.
 */
export function getPendingAnswerGain(
  equation: Equation,
  clickPower: bigint,
  comboMultiplier: number,
): bigint {
  const value = Math.max(
    1,
    equation.answer * getAnswerPayoutMultiplier(equation),
  );
  return BigInt(value) * clickPower * BigInt(comboMultiplier);
}

/**
 * Depth (meters) for a given amount of LIFETIME-mined minerals — NOT the
 * current balance. The cave keeps descending as the player mines in total;
 * spending minerals never lifts it back up, and a sunk shaft doesn't raise
 * it either (todo: "Depth and screen scrolling should be based on lifetime
 * mining").
 */
export function getDepth(lifetimeMinerals: number | bigint): bigint {
  const lifetime = BigInt(lifetimeMinerals);
  return lifetime / BigInt(mineralsPerDepth);
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
): bigint {
  if (saveTime <= 0 || now <= saveTime) {
    return 0n;
  }
  const elapsedTicks = Math.min(
    Math.max(0, Math.floor((now - saveTime) / msPerTick)),
    maxOfflineTicks,
  );
  const base =
    BigInt(getMineralsPerSec(miners, minerPower, fastMiners, legendaryMiners)) *
    BigInt(elapsedTicks);
  return mulFloats(base, [multiplier]);
}

/**
 * Pure offline-top-up calculation (plan §5.1): the EXTRA minerals a
 * completed ad would grant — the away-time beyond the 8h cap, itself
 * capped at offlineTopUpTicks. Zero when the haul never hit the cap
 * (nothing was withheld), so callers only hold a pending offer when the
 * return is > 0.
 */
export function computeOfflineTopUpMinerals(
  miners: number,
  minerPower: number,
  fastMiners: number,
  saveTime: number,
  now: number,
  multiplier = 1,
  legendaryMiners: number = 0,
): bigint {
  if (saveTime <= 0 || now <= saveTime) {
    return 0n;
  }
  const elapsedTicks = Math.floor((now - saveTime) / msPerTick);
  if (elapsedTicks <= maxOfflineTicks) {
    return 0n; // no cap was hit — nothing to top up
  }
  const extraTicks = Math.min(
    offlineTopUpTicks,
    elapsedTicks - maxOfflineTicks,
  );
  const base =
    BigInt(getMineralsPerSec(miners, minerPower, fastMiners, legendaryMiners)) *
    BigInt(extraTicks);
  return mulFloats(base, [multiplier]);
}
