/**
 * Crash context (plan "Adjust") — the "what was happening" half of the fix
 * for the unreproducible Android Hermes
 * `ReferenceError: Property 'describe' doesn't exist`.
 *
 * A stack trace tells WHERE a crash happened; this module records WHAT the
 * game was doing around it — a bounded in-memory trail of high-level
 * transitions (save loaded, prestige, reset, ad reward, IAP purchase, ...)
 * plus a tiny key/value state snapshot — which `crashLogging.recordCrash`
 * snapshots into every `CrashEntry.context` (see crashLog.ts). When the
 * suspected crash next fires on a device, Settings → "Recent errors (debug)"
 * (and the crash screen itself) shows the session trail right under the
 * stack, so the trace can be read without reproducing the sequence.
 *
 * Conventions mirror crashLog.ts: pure ring/merge logic at the top
 * (unit-tested), a thin module-level store below (one per app session —
 * it dies with the process, by design), and `formatCrashContext` for the
 * copyable on-screen rendering. Everything is defensive: this runs on the
 * crash path, so nothing here may itself throw or churn (no per-tick
 * events — only deliberate transitions).
 */

/** One trail entry: `s` = whole seconds since session start. */
export type CrashContextEvent = {
  s: number;
  label: string;
};

/** Small key/value snapshot (depth, prestiges, platform, ...). */
export type CrashContextState = Record<string, string | number>;

/** One persisted context block (lives inside a `CrashEntry`). */
export type CrashContext = {
  /** Epoch ms when this session's trail started. */
  startedAt: number;
  /** Epoch ms of the snapshot. */
  at: number;
  state: CrashContextState;
  /** Oldest → newest. */
  events: CrashContextEvent[];
};

/** Ring size: enough for a "session story", small enough to stay one tiny
 *  JSON field on a 5-entry crash ring (fraud-meter-sized, not save-sized). */
export const CRASH_CONTEXT_MAX_EVENTS = 12;

export const CRASH_CONTEXT_MAX_STATE_KEYS = 24;

const MAX_LABEL_LENGTH = 40;
const MAX_KEY_LENGTH = 32;
const MAX_VALUE_LENGTH = 60;
const MAX_FORMAT_LENGTH = 1200;

/**
 * Append `label` to the trail (oldest → newest). Consecutive repeats of the
 * SAME label update the last entry's timestamp instead of piling up, and the
 * ring keeps only the newest CRASH_CONTEXT_MAX_EVENTS — the same
 * anti-storm rule appendCrash uses for the crash entries themselves.
 */
export function appendCrashContextEvent(
  events: CrashContextEvent[],
  label: string,
  seconds: number,
): CrashContextEvent[] {
  const clean = label.trim().slice(0, MAX_LABEL_LENGTH);
  if (clean.length === 0) return events;
  const s = Number.isFinite(seconds) && seconds >= 0 ? Math.floor(seconds) : 0;
  const last = events[events.length - 1];
  if (last != null && last.label === clean) {
    return [...events.slice(0, -1), { s, label: clean }];
  }
  return [...events, { s, label: clean }].slice(-CRASH_CONTEXT_MAX_EVENTS);
}

/**
 * Merge `partial` into the state snapshot (later keys win). Keys/values are
 * length-capped and the total key count is bounded to
 * CRASH_CONTEXT_MAX_STATE_KEYS (oldest-inserted dropped first), so an
 * unbounded caller can never balloon the persisted entry.
 */
export function mergeCrashContextState(
  state: CrashContextState,
  partial: CrashContextState,
): CrashContextState {
  const out: CrashContextState = { ...state };
  for (const [rawKey, value] of Object.entries(partial)) {
    const key = rawKey.trim().slice(0, MAX_KEY_LENGTH);
    if (key.length === 0) continue;
    out[key] =
      typeof value === "number"
        ? value
        : String(value).slice(0, MAX_VALUE_LENGTH);
  }
  const keys = Object.keys(out);
  if (keys.length > CRASH_CONTEXT_MAX_STATE_KEYS) {
    const trimmed: CrashContextState = {};
    for (const key of keys.slice(-CRASH_CONTEXT_MAX_STATE_KEYS)) {
      trimmed[key] = out[key];
    }
    return trimmed;
  }
  return out;
}

function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/**
 * Render a context block as compact, selectable text for the crash screen
 * and the settings debug list. `""` for null/undefined (old entries from
 * before context capture — they simply have no block).
 */
export function formatCrashContext(
  ctx: CrashContext | null | undefined,
): string {
  if (ctx == null) return "";
  const lines: string[] = [];
  const sessionMs = Math.max(0, ctx.at - ctx.startedAt);
  lines.push(`session ${formatDuration(sessionMs)}`);
  const stateEntries = Object.entries(ctx.state);
  if (stateEntries.length > 0) {
    lines.push(
      `state: ${stateEntries.map(([k, v]) => `${k} ${v}`).join(" · ")}`,
    );
  }
  if (ctx.events.length > 0) {
    lines.push(
      `events: ${ctx.events.map((e) => `+${e.s}s ${e.label}`).join(" → ")}`,
    );
  }
  return lines.join("\n").slice(0, MAX_FORMAT_LENGTH);
}

// ---------------------------------------------------------------------------
// Session store — one per app process, deliberately NOT persisted on its
// own: it exists to be snapshotted into crash entries at crash time.
// ---------------------------------------------------------------------------

const sessionStartedAt = Date.now();
let storeState: CrashContextState = {};
let storeEvents: CrashContextEvent[] = [];

function sessionSeconds(now: number): number {
  return Math.max(0, (now - sessionStartedAt) / 1000);
}

/** Record a high-level transition (save loaded, prestige, ...). Never
 *  throws. Consecutive repeats of the same label are collapsed. */
export function noteCrashEvent(label: string, now: number = Date.now()): void {
  storeEvents = appendCrashContextEvent(storeEvents, label, sessionSeconds(now));
}

/** Merge new snapshot values (depth, prestiges, platform, ...). */
export function setCrashContextState(partial: CrashContextState): void {
  storeState = mergeCrashContextState(storeState, partial);
}

/**
 * Snapshot the trail for a crash entry. `null` when nothing was recorded
 * (nothing to snapshot — the entry keeps its pre-context shape).
 */
export function snapshotCrashContext(
  now: number = Date.now(),
): CrashContext | null {
  if (storeEvents.length === 0 && Object.keys(storeState).length === 0) {
    return null;
  }
  return {
    startedAt: sessionStartedAt,
    at: now,
    state: { ...storeState },
    events: [...storeEvents],
  };
}
