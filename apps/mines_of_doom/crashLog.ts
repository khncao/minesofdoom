/**
 * Crash log (plan "Adjust") — diagnostics for the unreproducible Android
 * Hermes `ReferenceError: Property 'describe' doesn't exist` (suspected
 * expo-router/native-stack interaction).
 *
 * Release builds have no red box, so a render crash there is a silent white
 * screen with no trace to grab. The `ErrorBoundary` (ErrorBoundary.tsx)
 * catches render errors and shows a copyable full stack; this module keeps
 * the pure, unit-tested half: the entry shape and the small persisted ring
 * buffer (AsyncStorage key "crashLog"). Same shape/parse conventions as the
 * save-code and analytics records — defensive on read, small on disk.
 *
 * Each entry also carries an optional `context` (crashContext.ts) — the
 * session event trail + state snapshot taken at crash time, so the trace
 * shows WHAT the game was doing, not just where it died.
 */

import type {
  CrashContext,
  CrashContextEvent,
  CrashContextState,
} from "./crashContext";

/** Which layer caught the crash: the React error boundary, or the global
 *  (ErrorUtils) handler for errors thrown outside the render tree — e.g.
 *  inside a native-stack listener, timers, or native module callbacks. */
export type CrashSource = "render" | "global";

/** One recorded crash. `count` > 1 means the same crash recurred. */
export type CrashEntry = {
  /** Epoch ms of the most recent occurrence. */
  ts: number;
  /** Error name ("Error", "ReferenceError", ...) or "Error". */
  name: string;
  /** One-line message. */
  message: string;
  /** error.stack (truncated), plus the React component stack when present. */
  stack: string;
  /** How many times this exact crash has been logged since it rotated out. */
  count: number;
  /** Which layer caught it (absent in pre-source logs; parses as "render".
   *  Old logs were boundary-only, so that default is correct). */
  source: CrashSource;
  /** Session trail + state snapshot at crash time (absent in pre-context
   *  logs; parses as null). */
  context: CrashContext | null;
};

/** AsyncStorage key for the crash-log ring buffer. */
export const crashLogKey = "crashLog";

/**
 * Ring size: enough to see "what else crashed around the same time", small
 * enough that the record stays one tiny JSON blob (fraud-meter-sized, not
 * save-sized — it's diagnostics, not progress).
 */
export const CRASH_LOG_MAX_ENTRIES = 5;

const MAX_MESSAGE_LENGTH = 300;
const MAX_STACK_LENGTH = 4000;

function truncateStack(stack: string): string {
  if (stack.length <= MAX_STACK_LENGTH) return stack;
  return `${stack.slice(0, MAX_STACK_LENGTH)}…[truncated]`;
}

/**
 * Flatten any thrown value into a log entry. Non-Error throws (strings,
 * objects) still get an entry — a crash that can't be formatted cleanly is
 * exactly the kind of crash we'd otherwise never see.
 */
export function serializeCrash(
  error: unknown,
  componentStack?: string | null,
  ts: number = Date.now(),
  source: CrashSource = "render",
  context: CrashContext | null = null,
): CrashEntry {
  let name = "Error";
  let message = "";
  let stack = "";
  if (error instanceof Error) {
    name = error.name.length > 0 ? error.name : "Error";
    message = error.message;
    stack = error.stack ?? "";
  } else {
    message = String(error);
  }
  if (componentStack != null && componentStack.length > 0) {
    stack = stack.length > 0 ? `${stack}\n${componentStack}` : componentStack;
  }
  return {
    ts,
    name,
    message: message.slice(0, MAX_MESSAGE_LENGTH),
    stack: truncateStack(stack),
    count: 1,
    source,
    context,
  };
}

/**
 * Prepend `entry` to the ring, newest first. Consecutive duplicates of the
 * same crash (same name + message + stack) bump the head's count instead of
 * piling up — a crash storm must not evict the older, different entries.
 */
export function appendCrash(
  entries: CrashEntry[] | null,
  entry: CrashEntry,
): CrashEntry[] {
  const list = entries ?? [];
  const head = list[0];
  if (
    head != null &&
    head.name === entry.name &&
    head.message === entry.message &&
    head.stack === entry.stack
  ) {
    return [
      {
        ...head,
        ts: entry.ts,
        count: head.count + 1,
        // The newest occurrence's trail is the freshest one; fall back to
        // the head's when this occurrence carried none.
        context: entry.context ?? head.context,
      },
      ...list.slice(1),
    ];
  }
  return [entry, ...list].slice(0, CRASH_LOG_MAX_ENTRIES);
}

/** Defensively parse a stored log (same conventions as the other records). */
export function parseCrashLog(raw: string | null): CrashEntry[] {
  if (raw == null) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: CrashEntry[] = [];
  for (const item of parsed) {
    const entry = parseEntry(item);
    if (entry != null) out.push(entry);
    if (out.length >= CRASH_LOG_MAX_ENTRIES) break;
  }
  return out;
}

function parseEntry(value: unknown): CrashEntry | null {
  if (typeof value !== "object" || value == null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.message !== "string") return null;
  return {
    ts: typeof v.ts === "number" && Number.isFinite(v.ts) ? v.ts : Date.now(),
    name: typeof v.name === "string" && v.name.length > 0 ? v.name : "Error",
    message: v.message.slice(0, MAX_MESSAGE_LENGTH),
    stack: truncateStack(typeof v.stack === "string" ? v.stack : ""),
    count:
      typeof v.count === "number" && Number.isFinite(v.count) && v.count >= 1
        ? Math.floor(v.count)
        : 1,
    source: v.source === "global" ? "global" : "render",
    context: parseCrashContext(v.context),
  };
}

/** Defensively rebuild a context block from untrusted JSON (or null). */
function parseCrashContext(value: unknown): CrashContext | null {
  if (typeof value !== "object" || value == null) return null;
  const v = value as Record<string, unknown>;
  if (
    typeof v.startedAt !== "number" ||
    !Number.isFinite(v.startedAt) ||
    typeof v.at !== "number" ||
    !Number.isFinite(v.at)
  ) {
    return null;
  }
  const events: CrashContextEvent[] = [];
  if (Array.isArray(v.events)) {
    for (const item of v.events) {
      if (typeof item !== "object" || item == null) continue;
      const e = item as Record<string, unknown>;
      if (typeof e.label !== "string" || e.label.trim().length === 0) continue;
      events.push({
        s:
          typeof e.s === "number" && Number.isFinite(e.s) && e.s >= 0
            ? Math.floor(e.s)
            : 0,
        label: e.label.slice(0, 40),
      });
      if (events.length >= 12) break;
    }
  }
  const state: CrashContextState = {};
  if (typeof v.state === "object" && v.state != null) {
    for (const [key, raw] of Object.entries(v.state as Record<string, unknown>)) {
      const k = key.trim().slice(0, 32);
      if (k.length === 0) continue;
      if (typeof raw === "number" && Number.isFinite(raw)) {
        state[k] = raw;
      } else if (typeof raw === "string") {
        state[k] = raw.slice(0, 60);
      }
      if (Object.keys(state).length >= 24) break;
    }
  }
  return { startedAt: v.startedAt, at: v.at, state, events };
}
