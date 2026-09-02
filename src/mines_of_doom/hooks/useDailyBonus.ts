import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocalStorage } from "src/hooks/useLocalStorage";
import { useI18n } from "src/hooks/useI18n";
import { formatNumber } from "src/utils/format";
import {
  DailyBonusState,
  applyDailyClaim,
  computeDailyClaim,
  getLocalDayKey,
} from "../dailyBonus";

export const dailyBonusKey = "dailyBonus";

/**
 * Daily bonus / login streak (plan §4.2). State lives in its own
 * localStorage key (see dailyBonus.ts for why it's not in the save).
 * `grantMinerals` is the engine's additive mineral callback (addTapGain):
 * the bonus flows through the same lifetime-stats path as any other gain.
 */
export function useDailyBonus({
  grantMinerals,
  displayMessage,
}: {
  grantMinerals: (minerals: number) => void;
  displayMessage: (message: string, timeout: number) => void;
}) {
  const { t } = useI18n();
  const [state, setState] = useLocalStorage<DailyBonusState | null>(
    dailyBonusKey,
    null,
  );
  const stateRef = useRef(state);
  stateRef.current = state;
  // Recheck the local day once a minute: this is what lets the button roll
  // over at the local midnight in a fully idle (0-miner) session where
  // nothing else re-renders the screen. Only changes state when the day
  // key actually differs, so it's a no-op re-render otherwise.
  const [dayKey, setDayKey] = useState(() => getLocalDayKey(Date.now()));
  useEffect(() => {
    const id = setInterval(
      () => setDayKey(getLocalDayKey(Date.now())),
      60000,
    );
    return () => clearInterval(id);
  }, []);

  const info = useMemo(() => {
    // dayKey is only here to re-trigger this memo at the midnight rollover;
    // the claim math itself always uses a fresh Date.now().
    void dayKey;
    return computeDailyClaim(state, Date.now());
  }, [state, dayKey]);

  const claim = useCallback(() => {
    const now = Date.now();
    const current = stateRef.current;
    const claimInfo = computeDailyClaim(current, now);
    if (!claimInfo.claimable) return;
    grantMinerals(claimInfo.bonus);
    const next = applyDailyClaim(current, now);
    // Publish the new state to the ref synchronously: setState only takes
    // effect on the next render, and a fast second tap before that render
    // would otherwise see the stale "claimable" state and pay the bonus
    // again (the unlimited-claim bug on Android). The render assignment
    // below re-sets the ref to the same value once the state lands.
    stateRef.current = next;
    setState(next);
    displayMessage(
      claimInfo.nextStreak > 1
        ? t("toast.dailyBonusStreak", {
            bonus: formatNumber(claimInfo.bonus),
            streak: claimInfo.nextStreak,
          })
        : t("toast.dailyBonus", {
            bonus: formatNumber(claimInfo.bonus),
          }),
      4000,
    );
  }, [grantMinerals, setState, displayMessage, t]);

  return {
    claimable: info.claimable,
    bonus: info.bonus,
    streak: state?.streak ?? 0,
    claim,
  };
}
