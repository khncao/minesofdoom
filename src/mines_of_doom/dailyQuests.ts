/**
 * Daily quests (todo: "Add daily quests"; "daily quests and weekly
 * quests should reward gems (1 gem for daily quests, 10 for weekly)").
 *
 * Three small tasks a day, each paying one gem. This is the DAILY sibling
 * of the weekly contract (`weeklyChallenge.ts`) and deliberately reuses its
 * shape: quests are DELTAS on the save's monotonic lifetime metrics, the
 * day's baselines are snapshotted when the day opens, and completion is
 * derived (`current >= target`) rather than a mutable flag — cheat-
 * resistant, and testable without a render.
 *
 * Two guardrails are load-bearing in the design:
 *
 *  - **The rotation is deterministic, from the day key.** Three quests are
 *    drawn out of `DAILY_QUEST_POOL` by a hash of `yyyy-MM-dd`, so the same
 *    day always shows the same three on every render, every relaunch and
 *    every device. That is what lets the CLAIMED list be the only persisted
 *    state: a random draw would have to be stored to stay stable, and a
 *    stored draw is one more thing that can desync from the day.
 *  - **The window is real.** Quests reset at local midnight, exactly like
 *    the daily bonus — no fake scarcity, no countdown pressure (the sheet
 *    states the honest reset time, as the weekly one already did).
 *
 * Like the daily bonus and the weekly contract, the state lives OUTSIDE
 * the save (its own localStorage key): a lost or corrupted quest board must
 * never take the player's progress down with it, and an imported save code
 * must not carry someone else's baselines (deltas simply clamp at zero
 * against a lower imported save).
 *
 * The reward is paid through the engine's additive `grantGems`, so
 * `gemsMinted` lifetime accounting stays exact — the same path the
 * rewarded-ad gem roll and the gem pocket use.
 */
import type { TranslationKey } from "src/utils/i18n/i18n";
import { SaveData } from "./game";
import { getLocalDayKey } from "./dailyBonus";

/** The monotonic lifetime metrics a quest measures a daily delta of. */
export type DailyQuestMetric =
  | "lifetimeMinerals"
  | "lifetimeCorrect"
  | "minersOwnedEver";

export type DailyQuest = {
  id: string;
  metric: DailyQuestMetric;
  /** Delta target on the metric within the day. */
  target: number;
  /**
   * i18n KEY, not a literal: quest text is player-facing, and the weekly
   * contract's hard-coded English labels are the reason this is worth
   * stating out loud (see weeklyChallenge.ts's own note).
   */
  label: TranslationKey;
};

/** Gems each completed quest pays (todo: "1 gem for daily quests"). */
export const DAILY_QUEST_GEMS = 1;

/** How many quests a day offers. */
export const DAILY_QUEST_COUNT = 3;

/**
 * The pool a day draws from. Tuned so that every quest is reachable by a
 * casual free-path player on a normal day (freePath.ts): the answer
 * counts are minutes of play, the mineral counts are well inside a day's
 * passive income once a single miner is hired, and "hire a miner" is the
 * cheapest real decision in the game.
 *
 * Deliberately NOT here: anything that would be an instant fail for a new
 * player (prestige, a high combo, a legendary miner). A quest nobody can
 * finish is a dead row in the sheet, and three dead rows is a sheet that
 * reads as broken — the exact failure the weekly contract's fixed set
 * avoids by only ever asking for things an established player reaches.
 */
export const DAILY_QUEST_POOL: DailyQuest[] = [
  {
    id: "dq-answers-10",
    metric: "lifetimeCorrect",
    target: 10,
    label: "quest.answerTen",
  },
  {
    id: "dq-answers-25",
    metric: "lifetimeCorrect",
    target: 25,
    label: "quest.answerTwentyFive",
  },
  {
    id: "dq-minerals-small",
    metric: "lifetimeMinerals",
    target: 2_000,
    label: "quest.mineSmall",
  },
  {
    id: "dq-minerals-mid",
    metric: "lifetimeMinerals",
    target: 25_000,
    label: "quest.mineMid",
  },
  {
    id: "dq-minerals-big",
    metric: "lifetimeMinerals",
    target: 150_000,
    label: "quest.mineBig",
  },
  {
    id: "dq-hire-miner",
    metric: "minersOwnedEver",
    target: 1,
    label: "quest.hireMiner",
  },
];

export type DailyQuestState = {
  /** Local `yyyy-MM-dd` of the day this board belongs to. */
  dayKey: string;
  /** Metric values snapshotted when the day began (the delta origins). */
  baselines: Record<DailyQuestMetric, number>;
  /** Ids already paid out today — one claim per quest per day. */
  claimed: string[];
};

/** Exact metric value as a number (bigint metrics included — the game
 *  already treats these magnitudes as Number-safe everywhere it displays
 *  or fractions them, see goals.ts). */
export function getQuestMetricValue(
  save: SaveData,
  metric: DailyQuestMetric,
): number {
  return Number(save[metric]);
}

/** FNV-1a over the day key: a stable integer for a given calendar day. */
function hashDayKey(dayKey: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < dayKey.length; i++) {
    hash ^= dayKey.charCodeAt(i);
    // 16777619 (the FNV prime), kept in 32-bit range with Math.imul so the
    // result does not drift with float precision.
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * The quests a given day offers: DAILY_QUEST_COUNT distinct entries drawn
 * from the pool by a hash of `dayKey`.
 *
 * Distinctness matters — showing the same quest twice would pay it twice
 * per day for one action — so each pick removes the chosen entry from the
 * candidate list before the next draw. The walk is deterministic, so the
 * same day always yields the same set in the same ORDER (the order is
 * fixed for the day, which stops the rows reshuffling under a re-render).
 */
export function dailyQuestsForDay(dayKey: string): DailyQuest[] {
  const remaining = [...DAILY_QUEST_POOL];
  const picked: DailyQuest[] = [];
  let seed = hashDayKey(dayKey);
  while (picked.length < DAILY_QUEST_COUNT && remaining.length > 0) {
    // One draw per step rather than a modulo of a fixed stride: a stride
    // can land on the same index twice in a row once items are removed.
    const index = seed % remaining.length;
    picked.push(remaining[index]);
    remaining.splice(index, 1);
    seed = Math.imul(seed ^ picked.length, 0x9e3779b1) >>> 0;
  }
  return picked;
}

/** The baselines a day beginning `now` starts from. */
export function snapshotBaselines(
  save: SaveData,
): Record<DailyQuestMetric, number> {
  return {
    lifetimeMinerals: getQuestMetricValue(save, "lifetimeMinerals"),
    lifetimeCorrect: getQuestMetricValue(save, "lifetimeCorrect"),
    minersOwnedEver: getQuestMetricValue(save, "minersOwnedEver"),
  };
}

/** The state for a day beginning `now`. */
export function startDay(now: number, save: SaveData): DailyQuestState {
  return {
    dayKey: getLocalDayKey(now),
    baselines: snapshotBaselines(save),
    claimed: [],
  };
}

export type DailyQuestProgress = {
  quest: DailyQuest;
  /** Today's delta on the quest's metric (clamped at 0). */
  current: number;
  target: number;
  done: boolean;
  /** done AND not already paid out today. */
  claimable: boolean;
};

export type DailyQuestsInfo = {
  /** True when `state` is null or belongs to an earlier day (the hook
   *  persists the fresh snapshot; callers can treat progress as 0-based). */
  rolled: boolean;
  dayKey: string;
  quests: DailyQuestProgress[];
  doneCount: number;
  /** How many quests are waiting to be paid out right now. */
  claimableCount: number;
  /** Every offered quest is done (the sheet's "that's all today"). */
  allClaimed: boolean;
  /** Gems a single claim pays. */
  gems: number;
};

/**
 * What today's board looks like, without mutating anything: per-quest
 * deltas against the day's baselines, which ones are paid, and how many
 * are waiting.
 */
export function computeDailyQuests(
  save: SaveData,
  state: DailyQuestState | null,
  now: number,
): DailyQuestsInfo {
  const dayKey = getLocalDayKey(now);
  const rolled = state == null || state.dayKey !== dayKey;
  // While rolled the progress is measured against the CURRENT save, so it
  // reads zero for everything the player has not done yet today — the
  // same "start from here" the weekly contract uses.
  const baselines = rolled ? snapshotBaselines(save) : state.baselines;
  const claimed = rolled ? [] : state.claimed;
  const quests = dailyQuestsForDay(dayKey).map((quest) => {
    const current = Math.max(
      0,
      getQuestMetricValue(save, quest.metric) - baselines[quest.metric],
    );
    const done = current >= quest.target;
    return {
      quest,
      current,
      target: quest.target,
      done,
      claimable: done && !claimed.includes(quest.id),
    };
  });
  const doneCount = quests.filter((q) => q.done).length;
  const claimableCount = quests.filter((q) => q.claimable).length;
  return {
    rolled,
    dayKey,
    quests,
    doneCount,
    claimableCount,
    allClaimed: claimableCount === 0,
    gems: DAILY_QUEST_GEMS,
  };
}

/**
 * The persisted state after claiming `questId`.
 *
 * Defensive in the same way as `applyWeeklyClaim`: a quest that is not
 * actually finished (or already paid) returns the existing state UNTOUCHED,
 * so a double-tap can never double-pay, and a claim against a rolled board
 * never fabricates one.
 */
export function claimDailyQuest(
  save: SaveData,
  state: DailyQuestState | null,
  now: number,
  questId: string,
): DailyQuestState {
  const info = computeDailyQuests(save, state, now);
  const target = info.quests.find((q) => q.quest.id === questId);
  if (state == null || state.dayKey !== info.dayKey || !target?.claimable) {
    return state ?? startDay(now, save);
  }
  return { ...state, claimed: [...state.claimed, questId] };
}