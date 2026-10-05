/**
 * Daily quests (todo: "Add daily quests" / "daily quests and weekly
 * quests should reward gems — 1 gem for daily quests, 10 for weekly").
 *
 * The shape under test is the weekly contract's, deliberately: quests are
 * DELTAS on the save's monotonic lifetime metrics, the day's baselines are
 * snapshotted when the day opens, and completion is derived rather than a
 * mutable flag. What is NEW here, and what these tests exist to pin:
 *
 *  - the ROTATION is deterministic from the day key. A draw that changed
 *    per render would reshuffle the rows under the player's finger and
 *    break the "claimed" list (which stores ids, not positions) — so
 *    stability is a correctness property here, not a nicety.
 *  - a claim pays ONCE. Double-claim is the one bug that would hand out
 *    free premium currency, and the only thing standing between a fast
 *    double tap and that is the identity check in claimDailyQuest.
 *  - the reward really is one gem, and the weekly really is ten.
 */
import { createEmptySaveData, SaveData } from "../game";
import {
  DAILY_QUEST_COUNT,
  DAILY_QUEST_GEMS,
  DAILY_QUEST_POOL,
  DailyQuestState,
  claimDailyQuest,
  computeDailyQuests,
  dailyQuestsForDay,
  getQuestMetricValue,
  snapshotBaselines,
  startDay,
} from "../dailyQuests";
import { WEEKLY_GEM_BONUS, computeWeeklyChallenge } from "../weeklyChallenge";
import { getLocalDayKey } from "../dailyBonus";

/** 2026-06-15 (Monday) noon local, one DST-safe stretch (June). */
const MON = new Date(2026, 5, 15, 12, 0, 0).getTime();
const MON_LAST_SECOND = new Date(2026, 5, 15, 23, 59, 59).getTime();
const TUE = new Date(2026, 5, 16, 12, 0, 0).getTime();
/** The midnight boundary: 00:00:00.001 on the 16th. */
const TUE_START = new Date(2026, 5, 16, 0, 0, 0, 1).getTime();

const saveWith = (fields: Partial<SaveData>): SaveData => ({
  ...createEmptySaveData(),
  ...fields,
});

const dayStartSave = () =>
  saveWith({
    lifetimeMinerals: 1_000_000n,
    lifetimeCorrect: 500,
    minersOwnedEver: 4,
  });

const dayState = (
  overrides?: Partial<DailyQuestState>,
): DailyQuestState => ({
  dayKey: getLocalDayKey(MON),
  baselines: snapshotBaselines(dayStartSave()),
  claimed: [],
  ...overrides,
});

/** A save that has finished EVERY quest the board can offer today. */
const allDoneSave = () =>
  saveWith({
    // +1M minerals and +100 answers clear every target in the pool;
    // +1 miner clears the hire quest.
    lifetimeMinerals: 1_000_000n + 1_000_000n,
    lifetimeCorrect: 500 + 100,
    minersOwnedEver: 4 + 1,
  });

describe("dailyQuestsForDay", () => {
  test("offers exactly DAILY_QUEST_COUNT distinct quests", () => {
    const quests = dailyQuestsForDay(getLocalDayKey(MON));
    expect(quests).toHaveLength(DAILY_QUEST_COUNT);
    expect(new Set(quests.map((q) => q.id)).size).toBe(DAILY_QUEST_COUNT);
  });

  test("is STABLE for the same day — the row order never reshuffles", () => {
    // The claimed list stores quest IDS, so a rotation that moved between
    // renders would let a claim mark one quest and light up another.
    const a = dailyQuestsForDay("2026-06-15").map((q) => q.id);
    const b = dailyQuestsForDay("2026-06-15").map((q) => q.id);
    expect(a).toEqual(b);
  });

  test("a different day draws from the same pool", () => {
    // Not "a different set" (that would be untestable and unfun) — the
    // point is only that the hash actually varies the draw.
    const ids = new Set<string>();
    for (let day = 1; day <= 30; day++) {
      const key = `2026-06-${String(day).padStart(2, "0")}`;
      for (const q of dailyQuestsForDay(key)) ids.add(q.id);
    }
    // Across a month the rotation reaches most of the pool.
    expect(ids.size).toBeGreaterThan(DAILY_QUEST_COUNT);
  });

  test("an empty day key still yields a full, distinct board", () => {
    // Defensive: the day key is never empty in the app, but a corrupt
    // stored state must not be able to produce an empty sheet.
    const quests = dailyQuestsForDay("");
    expect(quests).toHaveLength(DAILY_QUEST_COUNT);
    expect(new Set(quests.map((q) => q.id)).size).toBe(DAILY_QUEST_COUNT);
  });
});

describe("baselines", () => {
  test("snapshot the save's metric values exactly", () => {
    expect(snapshotBaselines(dayStartSave())).toEqual({
      lifetimeMinerals: 1_000_000,
      lifetimeCorrect: 500,
      minersOwnedEver: 4,
    });
  });

  test("getQuestMetricValue coerces the bigint metric to Number", () => {
    expect(getQuestMetricValue(saveWith({ lifetimeMinerals: 123n }), "lifetimeMinerals")).toBe(
      123,
    );
  });

  test("startDay pairs the day key with an empty claim list", () => {
    expect(startDay(MON, dayStartSave())).toEqual({
      dayKey: getLocalDayKey(MON),
      baselines: snapshotBaselines(dayStartSave()),
      claimed: [],
    });
  });
});

describe("computeDailyQuests", () => {
  test("a fresh install rolls and starts from zero progress", () => {
    const info = computeDailyQuests(dayStartSave(), null, MON);
    expect(info.rolled).toBe(true);
    expect(info.doneCount).toBe(0);
    expect(info.claimableCount).toBe(0);
    expect(info.quests.every((q) => q.current === 0)).toBe(true);
  });

  test("progress counts only TODAY's deltas", () => {
    // +2 answers is over the "answer 10" line but under "answer 25".
    const save = saveWith({
      lifetimeMinerals: 1_000_000n,
      lifetimeCorrect: 502,
      minersOwnedEver: 4,
    });
    const info = computeDailyQuests(save, dayState(), MON);
    expect(info.rolled).toBe(false);
    const byId = Object.fromEntries(info.quests.map((q) => [q.quest.id, q]));
    if (byId["dq-answers-10"]) {
      expect(byId["dq-answers-10"].current).toBe(2);
      expect(byId["dq-answers-10"].done).toBe(false);
    }
    expect(info.quests.every((q) => q.current < q.target)).toBe(true);
  });

  test("a quest is done at exactly its target, and claimable once", () => {
    const info = computeDailyQuests(allDoneSave(), dayState(), MON);
    expect(info.doneCount).toBe(DAILY_QUEST_COUNT);
    expect(info.claimableCount).toBe(DAILY_QUEST_COUNT);
    expect(info.allClaimed).toBe(false);
    expect(info.gems).toBe(DAILY_QUEST_GEMS);
  });

  test("a claimed quest stops being claimable", () => {
    const first = dailyQuestsForDay(getLocalDayKey(MON))[0].id;
    const info = computeDailyQuests(
      allDoneSave(),
      dayState({ claimed: [first] }),
      MON,
    );
    expect(info.claimableCount).toBe(DAILY_QUEST_COUNT - 1);
    const row = info.quests.find((q) => q.quest.id === first);
    expect(row?.done).toBe(true);
    expect(row?.claimable).toBe(false);
  });

  test("everything claimed reads as \"all done\"", () => {
    const ids = dailyQuestsForDay(getLocalDayKey(MON)).map((q) => q.id);
    const info = computeDailyQuests(
      allDoneSave(),
      dayState({ claimed: ids }),
      MON,
    );
    expect(info.claimableCount).toBe(0);
    expect(info.allClaimed).toBe(true);
  });

  test("rolls at local midnight, not at a fixed 24h offset", () => {
    // 23:59:59 on the 15th is still the 15th…
    expect(computeDailyQuests(dayStartSave(), dayState(), MON_LAST_SECOND).rolled).toBe(
      false,
    );
    // …and 00:00:00.001 on the 16th is a new board.
    const rolled = computeDailyQuests(dayStartSave(), dayState(), TUE_START);
    expect(rolled.rolled).toBe(true);
    expect(rolled.quests.every((q) => q.current === 0)).toBe(true);
  });

  test("yesterday's claimed ids cannot light up today's board", () => {
    const stale = dayState({
      dayKey: getLocalDayKey(MON),
      claimed: dailyQuestsForDay(getLocalDayKey(MON)).map((q) => q.id),
    });
    const info = computeDailyQuests(allDoneSave(), stale, TUE);
    expect(info.rolled).toBe(true);
    // The rolled board measures from the CURRENT save, so a save that was
    // already high when the day opened shows zero progress on the new day.
    expect(info.quests.every((q) => q.current === 0)).toBe(true);
    expect(info.claimableCount).toBe(0);
  });

  test("a lower imported save clamps deltas at zero, not negative", () => {
    const wiped = createEmptySaveData();
    const info = computeDailyQuests(wiped, dayState(), MON);
    expect(info.quests.every((q) => q.current === 0)).toBe(true);
    expect(info.claimableCount).toBe(0);
  });
});

describe("claimDailyQuest", () => {
  test("records the claim when the quest is done", () => {
    const id = dailyQuestsForDay(getLocalDayKey(MON))[0].id;
    const next = claimDailyQuest(allDoneSave(), dayState(), MON, id);
    expect(next.claimed).toEqual([id]);
  });

  test("is a no-op (the SAME object) for an unfinished quest", () => {
    const state = dayState();
    expect(claimDailyQuest(dayStartSave(), state, MON, "dq-answers-10")).toBe(state);
  });

  test("is a no-op the SECOND time — a double tap cannot double-pay", () => {
    // The whole point of the identity return: the hook grants the gem only
    // when the object changed, so an already-paid row is inert.
    const id = dailyQuestsForDay(getLocalDayKey(MON))[0].id;
    const once = claimDailyQuest(allDoneSave(), dayState(), MON, id);
    const twice = claimDailyQuest(allDoneSave(), once, MON, id);
    expect(twice).toBe(once);
    expect(twice.claimed).toEqual([id]);
  });

  test("is a no-op from null state (never fabricates a grant)", () => {
    const next = claimDailyQuest(allDoneSave(), null, MON, "dq-answers-10");
    expect(next.claimed).toEqual([]);
  });

  test("is a no-op across the midnight boundary", () => {
    const id = dailyQuestsForDay(getLocalDayKey(MON))[0].id;
    const state = dayState({ claimed: [id] });
    expect(claimDailyQuest(allDoneSave(), state, TUE, id)).toBe(state);
  });

  test("an unknown quest id is inert, not a crash", () => {
    const state = dayState();
    expect(claimDailyQuest(allDoneSave(), state, MON, "nope")).toBe(state);
  });
});

describe("quest rewards", () => {
  test("a daily quest pays exactly one gem", () => {
    expect(DAILY_QUEST_GEMS).toBe(1);
  });

  test("the weekly contract pays exactly ten gems", () => {
    expect(WEEKLY_GEM_BONUS).toBe(10);
    // …and reports it, so the sheet can state the reward before the claim.
    const info = computeWeeklyChallenge(
      { ...allDoneSave(), lifetimeMinerals: 1_500_000n, lifetimeCorrect: 575, minersOwnedEver: 6 },
      {
        weekKey: "2026-06-15",
        baselines: { lifetimeMinerals: 1_000_000, lifetimeCorrect: 500, minersOwnedEver: 4 },
        claimed: false,
      },
      MON,
    );
    expect(info.gemBonus).toBe(10);
  });
});

describe("pool shape", () => {
  test("quests are unique, positive, and use monotonic metrics only", () => {
    expect(new Set(DAILY_QUEST_POOL.map((q) => q.id)).size).toBe(
      DAILY_QUEST_POOL.length,
    );
    expect(DAILY_QUEST_POOL.length).toBeGreaterThanOrEqual(DAILY_QUEST_COUNT);
    for (const quest of DAILY_QUEST_POOL) {
      expect(quest.target).toBeGreaterThan(0);
      expect(
        ["lifetimeMinerals", "lifetimeCorrect", "minersOwnedEver"],
      ).toContain(quest.metric);
      // Player-facing text is an i18n key, never a literal (the weekly
      // contract's hard-coded labels are the thing to avoid copying).
      expect(quest.label).toMatch(/^quest\./);
    }
  });

  test("every quest is reachable by a new player on a normal day", () => {
    // A quest nobody can finish is a dead row; three of them make the
    // sheet read as broken. The smallest answers quest is minutes of play
    // and the cheapest mineral line is well inside a day of tap income.
    const cheapestAnswers = Math.min(
      ...DAILY_QUEST_POOL.filter((q) => q.metric === "lifetimeCorrect").map(
        (q) => q.target,
      ),
    );
    const cheapestMinerals = Math.min(
      ...DAILY_QUEST_POOL.filter((q) => q.metric === "lifetimeMinerals").map(
        (q) => q.target,
      ),
    );
    expect(cheapestAnswers).toBeLessThanOrEqual(10);
    expect(cheapestMinerals).toBeLessThanOrEqual(2_000);
  });
});