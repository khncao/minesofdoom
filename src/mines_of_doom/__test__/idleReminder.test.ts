/**
 * Idle reminder (features.md §7 gap candidate): the pure show/hide
 * decision in idleReminder.ts. The hook (hooks/useIdleReminder.ts) is a
 * thin polling wrapper over these functions and is not tested here.
 */
import {
  IDLE_REMINDER_THRESHOLD_MS,
  createIdleReminderState,
  shouldShowIdleReminder,
  withActivity,
  withReminderShown,
} from "../idleReminder";

const T0 = 1_000_000;

describe("idleReminder (pure)", () => {
  test("fresh state is not idle", () => {
    const s = createIdleReminderState(T0);
    expect(shouldShowIdleReminder(s, T0, true)).toBe(false);
  });

  test("stays silent before the threshold", () => {
    const s = createIdleReminderState(T0);
    expect(
      shouldShowIdleReminder(s, T0 + IDLE_REMINDER_THRESHOLD_MS - 1, true),
    ).toBe(false);
  });

  test("fires exactly at the threshold", () => {
    const s = createIdleReminderState(T0);
    expect(
      shouldShowIdleReminder(s, T0 + IDLE_REMINDER_THRESHOLD_MS, true),
    ).toBe(true);
  });

  test("never shows when the setting is off, even past the threshold", () => {
    const s = createIdleReminderState(T0);
    expect(
      shouldShowIdleReminder(s, T0 + IDLE_REMINDER_THRESHOLD_MS, false),
    ).toBe(false);
  });

  test("shows at most once per session", () => {
    const s = withReminderShown(createIdleReminderState(T0));
    expect(shouldShowIdleReminder(s, T0 + 10 * 60_000, true)).toBe(false);
  });

  test("activity resets the idle window (but not the once-per-session flag)", () => {
    // Idle for 59s, tap, then check the window restarted.
    const tapped = withActivity(createIdleReminderState(T0), T0 + 59_000);
    expect(shouldShowIdleReminder(tapped, T0 + 59_000 + 30_000, true)).toBe(
      false,
    );
    // ...and after another full minute it fires.
    expect(
      shouldShowIdleReminder(tapped, T0 + 59_000 + IDLE_REMINDER_THRESHOLD_MS, true),
    ).toBe(true);
    // ...but never again in this session.
    const shown = withReminderShown(tapped);
    expect(
      shouldShowIdleReminder(shown, T0 + 59_000 + 2 * IDLE_REMINDER_THRESHOLD_MS, true),
    ).toBe(false);
  });

  test("activity before the threshold elapses keeps it silent", () => {
    let s = createIdleReminderState(T0);
    for (const at of [30_000, 55_000, 80_000]) {
      s = withActivity(s, T0 + at);
    }
    expect(shouldShowIdleReminder(s, T0 + 80_000 + 59_000, true)).toBe(false);
  });
});
