import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocalStorage } from "src/hooks/useLocalStorage";
import { useI18n } from "src/hooks/useI18n";
import { formatNumber } from "src/utils/format";
import { SaveData } from "../game";
import {
  WEEKLY_BONUS,
  WEEKLY_GOALS,
  WeeklyChallengeState,
  applyWeeklyClaim,
  computeWeeklyChallenge,
  getLocalWeekKey,
  startWeek,
} from "../weeklyChallenge";

export const weeklyChallengeKey = "weeklyChallenge";

/**
 * Weekly contract hook (todo: "weekly challenges"). Mirrors useDailyBonus:
 * the state lives in its own localStorage key (see weeklyChallenge.ts for
 * why it's not in the save), the one-per-week claim is gated on a pure
 * derived check, and the mineral grant flows through the engine's additive
 * path so lifetime stats — the same metrics the contract measures — see it.
 *
 * `save` is the LIVE save object: progress is a delta against the week's
 * baselines, so the hook re-derives it each render and persists the
 * baselines the first time a new week is observed.
 */
export function useWeeklyChallenge({
  save,
  grantMinerals,
  displayMessage,
}: {
  save: SaveData;
  grantMinerals: (minerals: bigint) => void;
  displayMessage: (message: string, timeout: number) => void;
}) {
  const { t } = useI18n();
  const [state, setState] = useLocalStorage<WeeklyChallengeState | null>(
    weeklyChallengeKey,
    null,
  );
  const stateRef = useRef(state);
  stateRef.current = state;
  const saveRef = useRef(save);
  saveRef.current = save;

  // Recheck the local week once a minute, mirroring the daily bonus's
  // midnight tick: this is what lets the baselines roll over in a fully
  // idle session where nothing else re-renders the screen. React bails out
  // when the key is unchanged, so the 60s poll is a no-op re-render most
  // of the time.
  const [weekTick, setWeekTick] = useState(() => getLocalWeekKey(Date.now()));
  useEffect(() => {
    const id = setInterval(
      () => setWeekTick(getLocalWeekKey(Date.now())),
      60000,
    );
    return () => clearInterval(id);
  }, []);

  const info = useMemo(() => {
    // weekTick only re-triggers the memo at the Monday rollover; the claim
    // math itself always uses a fresh Date.now() and the live save.
    void weekTick;
    return computeWeeklyChallenge(save, state, Date.now());
  }, [save, state, weekTick]);

  // Persist the fresh baselines the first render of a new week observes
  // them, so progress is measured from the week's start even across app
  // relaunches (and the old week's `claimed` flag can't carry over).
  useEffect(() => {
    if (!info.rolled) return;
    const current = stateRef.current;
    const weekKey = getLocalWeekKey(Date.now());
    if (current != null && current.weekKey === weekKey) return;
    const next = startWeek(Date.now(), saveRef.current);
    // Publish to the ref synchronously (see useDailyBonus's note): the
    // render-time assignment only lands on the next render.
    stateRef.current = next;
    setState(next);
  }, [info.rolled, setState]);

  const claim = useCallback(() => {
    const now = Date.now();
    const current = stateRef.current;
    const claimInfo = computeWeeklyChallenge(saveRef.current, current, now);
    if (!claimInfo.claimable) return;
    // WEEKLY_BONUS is a fixed, small number — safe to convert to the
    // engine's bigint currency exactly.
    grantMinerals(BigInt(WEEKLY_BONUS));
    const next = applyWeeklyClaim(saveRef.current, current, now);
    stateRef.current = next;
    setState(next);
    displayMessage(
      t("toast.weeklyContract", { bonus: formatNumber(WEEKLY_BONUS) }),
      4000,
    );
  }, [grantMinerals, setState, displayMessage, t]);

  return {
    claimable: info.claimable,
    bonus: info.bonus,
    doneCount: info.doneCount,
    total: WEEKLY_GOALS.length,
    claimed: state?.claimed ?? false,
    /** Per-goal deltas for the status sheet (todo: "weekly contract should
     *  always be clickable and status is known"). */
    progress: info.progress,
    claim,
  };
}
