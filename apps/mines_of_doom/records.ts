import { SaveData } from "./game";
import { GOAL_TIERS, getCompletedTierIds } from "./goals";
import { ACHIEVEMENTS, getCompletedAchievementIds } from "./achievements";
import { formatNumber } from "apps/utils/format";

/**
 * Local "Records" — personal bests (plan §4.3 leaderboard groundwork).
 *
 * The full plan item is a live leaderboard ("depth reached, minerals/sec"),
 * which needs a backend or store cloud feature; this ships the offline-first
 * half: every metric is already a lifetime stat on the save (never reset by
 * spending or prestige), so a record here is genuinely personal-best — the
 * same data a future live leaderboard would submit.
 *
 * Pure and derived, like goals.ts: nothing mutable, stable row order, values
 * formatted for display so the component layer is a dumb list renderer.
 */

export type RecordEntry = {
  id: string;
  icon: string;
  label: string;
  value: string;
};

export function getRecords(save: SaveData): RecordEntry[] {
  return [
    {
      id: "depth",
      icon: "⬇️",
      label: "Deepest depth",
      value: `${formatNumber(save.maxDepth)} m`,
    },
    {
      id: "combo",
      icon: "🔥",
      label: "Longest combo",
      value: formatNumber(save.maxCombo),
    },
    {
      id: "minerals",
      icon: "🪨",
      label: "Minerals mined (all time)",
      value: formatNumber(save.lifetimeMinerals),
    },
    {
      id: "answers",
      icon: "🧮",
      label: "Equations answered",
      value: formatNumber(save.lifetimeCorrect),
    },
    {
      id: "miners",
      icon: "👷",
      label: "Most miners owned",
      value: formatNumber(save.minersOwnedEver),
    },
    {
      id: "gems-minted",
      icon: "💎",
      label: "Gems minted",
      value: formatNumber(save.totalGemsMinted),
    },
    {
      id: "gems-spent",
      icon: "💸",
      label: "Gems spent",
      value: formatNumber(save.totalGemsSpent),
    },
    {
      id: "prestige",
      icon: "⛏️",
      label: "Shafts sunk (prestiges)",
      value: formatNumber(save.totalPrestiges),
    },
    {
      id: "tiers",
      icon: "🎯",
      label: "Goal tiers complete",
      value: `${getCompletedTierIds(save).length}/${GOAL_TIERS.length}`,
    },
    {
      id: "achievements",
      icon: "🏅",
      label: "Achievements earned",
      value: `${getCompletedAchievementIds(save).length}/${ACHIEVEMENTS.length}`,
    },
  ];
}
