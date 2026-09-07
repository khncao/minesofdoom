import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocalStorage } from "src/hooks/useLocalStorage";
import { useI18n } from "src/hooks/useI18n";
import { formatNumber } from "src/utils/format";
import {
  DailyEquationState,
  computeDailyEquationStatus,
  markDailyEquationSolved,
} from "../dailyEquation";
import { getLocalDayKey } from "../dailyBonus";

export const dailyEquationKey = "dailyEquation";

/**
 * Equation-of-the-day glue (todo "daily equation"): owns the persisted
 * solved-day (its own localStorage key, see dailyEquation.ts for why it's
 * not in the save) and re-derives today's status. `markSolved` is
 * idempotent — a second call on the same day is a no-op pay-wise, because
 * the caller only invokes it when the displayed equation is today's and
 * the status still says unsolved.
 */
export function useDailyEquation({
  displayMessage,
}: {
  displayMessage: (message: string, timeout: number) => void;
}) {
  const { t } = useI18n();
  const [state, setState] = useLocalStorage<DailyEquationState | null>(
    dailyEquationKey,
    null,
  );
  // Re-derive at the local midnight rollover exactly like useDailyBonus:
  // only the dayKey state changes, so the memo below recomputes once per
  // day in an idle session.
  const [dayKey, setDayKey] = useState(() => getLocalDayKey(Date.now()));
  useEffect(() => {
    const id = setInterval(
      () => setDayKey(getLocalDayKey(Date.now())),
      60000,
    );
    return () => clearInterval(id);
  }, []);

  const status = useMemo(
    () => computeDailyEquationStatus(state, Date.now()),
    // dayKey only re-triggers this memo at the midnight rollover; the
    // status math itself always uses a fresh Date.now().
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, dayKey],
  );

  const markSolved = useCallback(() => {
    setState(markDailyEquationSolved(state, Date.now()));
    displayMessage(
      t("toast.dailyEquation", { bonus: formatNumber(status.bonus) }),
      6000,
    );
  }, [setState, state, displayMessage, t, status.bonus]);

  return {
    dayKey: status.dayKey,
    equation: status.equation,
    solved: status.solved,
    bonus: status.bonus,
    markSolved,
  };
}
