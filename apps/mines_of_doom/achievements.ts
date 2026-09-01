import { SaveData } from "./game";
import type { GoalMetric } from "./goals";

/**
 * Achievements (plan §4.1): one-off bonus badges, deliberately kept distinct
 * from the goal tier gates in goals.ts — they never unlock content, they
 * just celebrate a milestone with a small mineral bonus ("the minerals are
 * the confetti", §4.6).
 *
 * Same design rules as the goal tiers: completion is DERIVED state from
 * lifetime stats on the save (never a mutable flag), so it survives
 * spending, is cheat-resistant to save corruption, and is trivially
 * testable. The save's `completedAchievements` only records which
 * celebrations already fired (the one-time bonus must not pay twice).
 *
 * Unlike the tier chain, achievements are independent: there is no
 * sequencing — any achievement completes as soon as its metric is met.
 */

export type Achievement = {
  id: string;
  icon: string;
  label: string;
  metric: GoalMetric;
  target: number;
  /** One-time mineral bonus granted when the achievement first completes. */
  bonusMinerals: number;
};

export const ACHIEVEMENTS: Achievement[] = [
  // Miners
  { id: "miner-1", icon: "👷", label: "First Hire", metric: "minersOwnedEver", target: 1, bonusMinerals: 500 },
  { id: "miner-5", icon: "👷‍♂️", label: "Crew of Five", metric: "minersOwnedEver", target: 5, bonusMinerals: 2_500 },
  { id: "miner-10", icon: "🚧", label: "Foreman", metric: "minersOwnedEver", target: 10, bonusMinerals: 5_000 },
  { id: "miner-25", icon: "🏗️", label: "Site Boss", metric: "minersOwnedEver", target: 25, bonusMinerals: 25_000 },
  // Gems minted
  { id: "gem-1", icon: "💎", label: "Struck a Vein", metric: "totalGemsMinted", target: 1, bonusMinerals: 2_500 },
  { id: "gem-10", icon: "💎", label: "Gem Hoarder", metric: "totalGemsMinted", target: 10, bonusMinerals: 10_000 },
  { id: "gem-50", icon: "💎", label: "Diamond Hands", metric: "totalGemsMinted", target: 50, bonusMinerals: 50_000 },
  { id: "gem-100", icon: "💎", label: "Vault Keeper", metric: "totalGemsMinted", target: 100, bonusMinerals: 100_000 },
  // Combos
  { id: "combo-25", icon: "🔥", label: "On a Roll", metric: "maxCombo", target: 25, bonusMinerals: 1_000 },
  { id: "combo-100", icon: "🔥", label: "Century Streak", metric: "maxCombo", target: 100, bonusMinerals: 25_000 },
  { id: "combo-250", icon: "🌋", label: "Unstoppable", metric: "maxCombo", target: 250, bonusMinerals: 100_000 },
  // Depth
  { id: "depth-10", icon: "⛏️", label: "Dirt Digger", metric: "maxDepth", target: 10, bonusMinerals: 1_000 },
  { id: "depth-50", icon: "⛏️", label: "Shaft Diver", metric: "maxDepth", target: 50, bonusMinerals: 10_000 },
  { id: "depth-150", icon: "⛏️", label: "Magma Diver", metric: "maxDepth", target: 150, bonusMinerals: 50_000 },
  { id: "depth-500", icon: "⛏️", label: "Crystal Diver", metric: "maxDepth", target: 500, bonusMinerals: 250_000 },
  // Correct answers
  { id: "answers-100", icon: "🧮", label: "Math Apprentice", metric: "lifetimeCorrect", target: 100, bonusMinerals: 2_500 },
  { id: "answers-1000", icon: "🧮", label: "Math Master", metric: "lifetimeCorrect", target: 1000, bonusMinerals: 25_000 },
  // Lifetime minerals
  { id: "mine-1m", icon: "🪨", label: "Millionaire", metric: "lifetimeMinerals", target: 1_000_000, bonusMinerals: 25_000 },
  { id: "mine-1b", icon: "🪨", label: "Billion Club", metric: "lifetimeMinerals", target: 1_000_000_000, bonusMinerals: 500_000 },
];

export function getAchievement(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

/** An achievement is met when the tracked lifetime stat reaches its target. */
export function isAchievementComplete(
  save: SaveData,
  achievement: Achievement,
): boolean {
  return save[achievement.metric] >= achievement.target;
}

export function getAchievementProgress(
  save: SaveData,
  achievement: Achievement,
) {
  const current = save[achievement.metric];
  return {
    current,
    target: achievement.target,
    fraction:
      achievement.target > 0 ? Math.min(1, current / achievement.target) : 1,
  };
}

/**
 * All completed achievement ids. Achievements are independent (no tier
 * sequencing): every met achievement counts, in any order.
 */
export function getCompletedAchievementIds(save: SaveData): string[] {
  return ACHIEVEMENTS.filter((a) => isAchievementComplete(save, a)).map(
    (a) => a.id,
  );
}

/** Total one-time bonus for a set of achievement ids (unknown ids ignored). */
export function getAchievementBonus(ids: string[]): number {
  return ids.reduce(
    (sum, id) => sum + (getAchievement(id)?.bonusMinerals ?? 0),
    0,
  );
}
