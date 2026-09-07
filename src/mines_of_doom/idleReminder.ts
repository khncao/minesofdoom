/**
 * Idle reminder (features.md §7 gap candidate): after the player has not
 * acted (cave taps / answer submits) for IDLE_REMINDER_THRESHOLD_MS, show
 * a single toast reminding that the mine keeps collecting while they're
 * away and the progress autosaves — the idle-genre "come collect" nudge in
 * its simplest honest form: no fake timers, no push notifications, no
 * reward bait (guardrail: simple reminder, no dark patterns). It shows at
 * most ONCE per session (per loaded save), so a second idle stretch is
 * quiet — the reminder is information, not a nag loop.
 */
export const IDLE_REMINDER_THRESHOLD_MS = 60_000;

export type IdleReminderState = {
  /** Epoch ms of the last player action (cave tap / answer submit). */
  lastActivityAt: number;
  /** True once the reminder has already been shown this session. */
  shown: boolean;
};

export function createIdleReminderState(now: number): IdleReminderState {
  return { lastActivityAt: now, shown: false };
}

export function withActivity(
  state: IdleReminderState,
  now: number,
): IdleReminderState {
  return { ...state, lastActivityAt: now };
}

export function withReminderShown(
  state: IdleReminderState,
): IdleReminderState {
  return { ...state, shown: true };
}

/**
 * Pure decision, polled on an interval by hooks/useIdleReminder.ts:
 * show the reminder only while the setting is on, it hasn't been shown
 * this session, and the player has been idle for at least the threshold.
 */
export function shouldShowIdleReminder(
  state: IdleReminderState,
  now: number,
  enabled: boolean,
): boolean {
  if (!enabled || state.shown) return false;
  return now - state.lastActivityAt >= IDLE_REMINDER_THRESHOLD_MS;
}
