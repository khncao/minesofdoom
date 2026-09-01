import { SaveData } from "./game";

/**
 * Overarching goal tiers (plan §4.6): a sequential chain of "contract"
 * goals whose completion unlocks new purchaseable content. Design rules:
 *
 * - Goals only unlock access to in-game-currency purchases (never
 *   pay-to-unlock).
 * - Goal progress is permanent: metrics are lifetime stats on the save,
 *   so they survive spending minerals or (later) prestige.
 * - Completion is DERIVED state (`metric value >= target`), never a
 *   mutable flag — cheat-resistant to save corruption and trivially
 *   testable. The save's `completedTiers` only records which
 *   celebrations already fired.
 */

/** Every metric is a direct field on the save, tracked incrementally. */
export type GoalMetric =
  | "lifetimeMinerals"
  | "lifetimeCorrect"
  | "maxCombo"
  | "maxDepth"
  | "minersOwnedEver"
  | "minerPower"
  | "totalGemsMinted"
  | "totalGemsSpent"
  | "totalPrestiges";

export type Goal = {
  id: string;
  metric: GoalMetric;
  target: number;
  label: string;
};

export type GoalTier = {
  id: string;
  name: string;
  /** One-time mineral bonus granted when the tier completes. */
  bonusMinerals: number;
  /** Human-readable description of what the tier unlocks. */
  unlock: string;
  goals: Goal[];
};

/** Tier that unlocks the miner-power upgrade purchase. */
export const MINER_POWER_UNLOCK_TIER = "t1";

/**
 * Tier that unlocks the second miner type (fast miners) and the first gem
 * upgrade (gem chance +1%).
 */
export const FAST_MINER_UNLOCK_TIER = "t2";

/**
 * Tier that unlocks prestige ("New Shaft") — sink a new shaft to bank a
 * permanent multiplier based on lifetime minerals — plus the remaining
 * gem upgrade lines (click ×2, combo resistance).
 */
export const PRESTIGE_UNLOCK_TIER = "t3";

/**
 * The tier chain (flavor from plan §4.6, tuned to the stats the game
 * actually tracks). Tiers are sequential: a tier only completes once every
 * earlier tier is complete.
 */
export const GOAL_TIERS: GoalTier[] = [
  {
    id: "t1",
    name: "Prospector's License",
    bonusMinerals: 5_000,
    unlock: "Miner power upgrades",
    goals: [
      { id: "t1-depth", metric: "maxDepth", target: 10, label: "Reach depth 10m" },
      { id: "t1-answers", metric: "lifetimeCorrect", target: 50, label: "Answer 50 equations correctly" },
      { id: "t1-miner", metric: "minersOwnedEver", target: 1, label: "Own your first miner" },
    ],
  },
  {
    id: "t2",
    name: "Deep Shaft",
    bonusMinerals: 50_000,
    unlock: "Fast miners + gem chance upgrade",
    goals: [
      { id: "t2-depth", metric: "maxDepth", target: 50, label: "Reach depth 50m" },
      { id: "t2-miners", metric: "minersOwnedEver", target: 10, label: "Own 10 miners" },
      { id: "t2-combo", metric: "maxCombo", target: 50, label: "Reach a 50-combo" },
      { id: "t2-gems", metric: "totalGemsSpent", target: 10, label: "Spend 10 gems" },
    ],
  },
  {
    id: "t3",
    name: "Magma Frontier",
    bonusMinerals: 500_000,
    unlock: "Prestige / New Shaft + gem upgrades (click ×2, combo resistance)",
    goals: [
      { id: "t3-depth", metric: "maxDepth", target: 150, label: "Reach depth 150m" },
      { id: "t3-power", metric: "minerPower", target: 11, label: "Upgrade miner power 10 times" },
      { id: "t3-gems", metric: "totalGemsMinted", target: 100, label: "Mint 100 gems" },
      { id: "t3-combo", metric: "maxCombo", target: 100, label: "Reach a 100-combo" },
    ],
  },
  {
    id: "t4",
    name: "Crystal Kingdom",
    bonusMinerals: 5_000_000,
    unlock: "Cave themes (coming soon)",
    goals: [
      { id: "t4-prestige", metric: "totalPrestiges", target: 1, label: "Prestige once" },
      { id: "t4-depth", metric: "maxDepth", target: 500, label: "Reach depth 500m" },
      { id: "t4-answers", metric: "lifetimeCorrect", target: 1000, label: "Answer 1,000 equations correctly" },
    ],
  },
  {
    id: "t5",
    name: "Motherlode",
    bonusMinerals: 50_000_000,
    unlock: "Endgame content (coming soon)",
    goals: [
      { id: "t5-prestige", metric: "totalPrestiges", target: 3, label: "Prestige 3 times" },
      { id: "t5-depth", metric: "maxDepth", target: 1500, label: "Reach depth 1500m" },
      { id: "t5-combo", metric: "maxCombo", target: 500, label: "Reach a 500-combo" },
      { id: "t5-lifetime", metric: "lifetimeMinerals", target: 1_000_000_000, label: "Mine 1B minerals in total" },
    ],
  },
];

/** A goal is met when the tracked lifetime stat has reached its target. */
export function isGoalComplete(save: SaveData, goal: Goal): boolean {
  return save[goal.metric] >= goal.target;
}

export function getGoalProgress(save: SaveData, goal: Goal) {
  const current = save[goal.metric];
  return {
    current,
    target: goal.target,
    fraction: goal.target > 0 ? Math.min(1, current / goal.target) : 1,
  };
}

/**
 * All completed tier ids: the longest prefix of GOAL_TIERS in which every
 * goal is met. Tiers are sequential, so the first unmet tier stops the
 * chain even if later tiers' stats happen to be high enough.
 */
export function getCompletedTierIds(save: SaveData): string[] {
  const done: string[] = [];
  for (const tier of GOAL_TIERS) {
    if (tier.goals.every((g) => isGoalComplete(save, g))) {
      done.push(tier.id);
    } else {
      break;
    }
  }
  return done;
}

export function getGoalTier(id: string): GoalTier | undefined {
  return GOAL_TIERS.find((t) => t.id === id);
}

/** Total one-time bonus for a set of tier ids (unknown ids are ignored). */
export function getTierBonus(ids: string[]): number {
  return ids.reduce(
    (sum, id) => sum + (getGoalTier(id)?.bonusMinerals ?? 0),
    0,
  );
}
