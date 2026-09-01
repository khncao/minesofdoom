export type SaveData = {
  minerals: number;
  gems: number;
  clickPower: number;
  miners: number;
  minerPower: number;
  startTime: number;
  saveTime: number;
  saveVersion: number;
};

// NOTE: equation settings are persisted separately under equationSettingsKey;
// they must NOT be folded into this object.
export type SettingsData = {
  autosave: number;
};

// TODO: number to bigint
export const saveDataKey = "save";
export const saveVersion = 1;
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
