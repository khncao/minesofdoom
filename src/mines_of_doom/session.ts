import { SaveData } from "./game";

/**
 * Session stats (todo: statistics detail): the delta between a baseline
 * snapshotted at launch (createSessionBaseline) and the current save.
 *
 * Like goals.ts this is derived, never mutable: the baseline is a plain
 * snapshot of the save's monotonic lifetime counters, and the session
 * values are current − baseline clamped at zero, so a mid-session reset
 * or imported save code (which can replace the whole save) can never
 * render a negative session stat — it just reads 0 until the session
 * out-earns the baseline again.
 *
 * "Seconds" is ACTIVE time only: it comes from SaveData.playSeconds,
 * which the engine advances with its tick loop while the app is running
 * (offline/away time is not play time).
 */

export type SessionBaseline = {
  lifetimeMinerals: bigint;
  lifetimeCorrect: number;
  playSeconds: number;
};

export type SessionStats = {
  mineralsMined: bigint;
  correct: number;
  seconds: number;
};

export function createSessionBaseline(save: SaveData): SessionBaseline {
  return {
    lifetimeMinerals: save.lifetimeMinerals,
    lifetimeCorrect: save.lifetimeCorrect,
    playSeconds: save.playSeconds,
  };
}

export function getSessionStats(
  save: SaveData,
  baseline: SessionBaseline,
): SessionStats {
  const minerals = save.lifetimeMinerals - baseline.lifetimeMinerals;
  return {
    mineralsMined: minerals < 0n ? 0n : minerals,
    correct: Math.max(0, save.lifetimeCorrect - baseline.lifetimeCorrect),
    seconds: Math.max(0, save.playSeconds - baseline.playSeconds),
  };
}
