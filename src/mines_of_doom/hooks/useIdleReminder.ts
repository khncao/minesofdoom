import { useCallback, useEffect, useRef } from "react";
import { useI18n } from "src/hooks/useI18n";
import {
  createIdleReminderState,
  shouldShowIdleReminder,
  withActivity,
  withReminderShown,
} from "../idleReminder";

/**
 * Idle reminder (idleReminder.ts): tracks the last player action via
 * markActivity (the main screen wires it into cave taps and answer
 * submits), and while the settings toggle is on, shows the one-per-session
 * reminder toast the first time the idle threshold is crossed.
 *
 * The toast (not a persistent overlay) matches the game's message style
 * and can never cover the screen — pointer-events stay "none" like every
 * other toast, so the reminder is impossible to get stuck on.
 */
export function useIdleReminder({
  enabled,
  displayMessage,
}: {
  enabled: boolean;
  displayMessage: (message: string, timeout: number) => void;
}) {
  const { t } = useI18n();
  const stateRef = useRef(createIdleReminderState(Date.now()));
  const markActivity = useCallback(() => {
    stateRef.current = withActivity(stateRef.current, Date.now());
  }, []);
  // Poll cheaply (5s) instead of a precise timer: the threshold is a
  // minute, a ±5s jitter is invisible, and the interval dies with the
  // component (no background timers — the game is only "idle" while open).
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => {
      const now = Date.now();
      if (shouldShowIdleReminder(stateRef.current, now, enabled)) {
        stateRef.current = withReminderShown(stateRef.current);
        displayMessage(t("toast.idleReminder"), 8000);
      }
    }, 5000);
    return () => clearInterval(id);
  }, [enabled, displayMessage, t]);
  return { markActivity };
}
