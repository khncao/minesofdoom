import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocalStorage } from "src/hooks/useLocalStorage";
import { useI18n } from "src/hooks/useI18n";
import { SaveData } from "../game";
import { getLocalDayKey } from "../dailyBonus";
import {
  DAILY_QUEST_GEMS,
  DailyQuestState,
  claimDailyQuest,
  computeDailyQuests,
  startDay,
} from "../dailyQuests";

export const dailyQuestsKey = "dailyQuests";

/**
 * Daily-quest hook (todo: "Add daily quests"). Mirrors useWeeklyChallenge
 * almost line for line — same localStorage-owns-the-board shape, same
 * derived completion, same additive `grantGems` payout — because the two
 * features are deliberately the same machine at two cadences.
 *
 * `save` is the LIVE save object: progress is a delta against the day's
 * baselines, so the hook re-derives it each render and persists the
 * baselines the first time a new day is observed.
 */
export function useDailyQuests({
  save,
  grantGems,
  displayMessage,
}: {
  save: SaveData;
  grantGems: (gems: number) => void;
  displayMessage: (message: string, timeout: number) => void;
}) {
  const { t } = useI18n();
  const [state, setState] = useLocalStorage<DailyQuestState | null>(
    dailyQuestsKey,
    null,
  );
  const stateRef = useRef(state);
  stateRef.current = state;
  const saveRef = useRef(save);
  saveRef.current = save;

  // Recheck the local day once a minute, mirroring the daily bonus's
  // midnight tick: this is what lets the board roll over in a fully idle
  // session where nothing else re-renders the screen. React bails out when
  // the key is unchanged, so the 60s poll is a no-op re-render most of the
  // time.
  const [dayTick, setDayTick] = useState(() => getLocalDayKey(Date.now()));
  useEffect(() => {
    const id = setInterval(
      () => setDayTick(getLocalDayKey(Date.now())),
      60000,
    );
    return () => clearInterval(id);
  }, []);

  const info = useMemo(() => {
    // dayTick only re-triggers the memo at the midnight rollover; the claim
    // math itself always uses a fresh Date.now() and the live save.
    void dayTick;
    return computeDailyQuests(save, state, Date.now());
  }, [save, state, dayTick]);

  // Persist the fresh baselines the first render of a new day observes them,
  // so progress is measured from midnight even across app relaunches — and
  // so yesterday's `claimed` ids cannot carry over (the dayKey gate means a
  // stale board is never read as today's).
  useEffect(() => {
    if (!info.rolled) return;
    const current = stateRef.current;
    const dayKey = getLocalDayKey(Date.now());
    if (current != null && current.dayKey === dayKey) return;
    const next = startDay(Date.now(), saveRef.current);
    // Publish to the ref synchronously (see useDailyBonus's note): the
    // render-time assignment only lands on the next render.
    stateRef.current = next;
    setState(next);
  }, [info.rolled, setState]);

  const claim = useCallback(
    (questId: string) => {
      const now = Date.now();
      const current = stateRef.current;
      const next = claimDailyQuest(saveRef.current, current, now, questId);
      // The pure function returns the SAME object when the claim is not
      // allowed (not done, already paid, or the board just rolled).
      // Identity is the refusal signal — without it a second tap on an
      // already-paid row would grant another gem for nothing.
      if (next === current) return;
      grantGems(DAILY_QUEST_GEMS);
      stateRef.current = next;
      setState(next);
      displayMessage(
        t("toast.questClaimed", { gems: DAILY_QUEST_GEMS }),
        3000,
      );
    },
    [grantGems, setState, displayMessage, t],
  );

  return {
    quests: info.quests,
    doneCount: info.doneCount,
    total: info.quests.length,
    claimableCount: info.claimableCount,
    gems: info.gems,
    claim,
  };
}