/**
 * Crash-log persistence (plan "Adjust"). Thin bridge between the pure
 * ring-buffer logic in crashLog.ts and AsyncStorage, plus the in-memory
 * fallback that keeps the log visible in-session if storage is unavailable
 * (e.g. a storage failure must never turn a crash screen into ANOTHER
 * crash).
 *
 * Deliberately does NOT go through useLocalStorage: the log is
 * fire-and-forget diagnostics written from an error boundary's
 * componentDidCatch, where no React component owns a write-through setter,
 * and read-modify-write must be serialized (chainRef) so two fast crashes
 * don't clobber each other.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  appendCrash,
  crashLogKey,
  parseCrashLog,
  serializeCrash,
  type CrashEntry,
} from "./crashLog";

// Session log: the source of truth while AsyncStorage is unreachable or
// still empty (its entries are folded in on the first successful read).
const memoryLog: CrashEntry[] = [];

// Serializes the read-modify-write so concurrent crashes (or a crash
// arriving mid-write) append instead of clobbering.
let chain: Promise<unknown> = Promise.resolve();

/**
 * Record one crash. Never throws, never rejects: this runs from
 * componentDidCatch, and a throwing crash logger is a bug in disguise.
 */
export function recordCrash(
  error: unknown,
  componentStack?: string | null,
): void {
  const entry = serializeCrash(error, componentStack);
  const next = appendCrash(memoryLog, entry);
  memoryLog.length = 0;
  memoryLog.push(...next);
  chain = chain.then(() =>
    AsyncStorage.getItem(crashLogKey).then(
      (raw) =>
        AsyncStorage.setItem(
          crashLogKey,
          JSON.stringify(appendCrash(parseCrashLog(raw), entry)),
        ),
    ),
  ).catch((e) => {
    console.warn("Failed to persist crash log", e);
  });
}

/** The persisted log (falling back to the in-memory session log). */
export function getCrashEntries(): Promise<CrashEntry[]> {
  return AsyncStorage.getItem(crashLogKey)
    .then((raw) => {
      const parsed = parseCrashLog(raw);
      if (parsed.length > 0) return parsed;
      // Storage empty/unreadable: still show what happened this session.
      return parseCrashLog(JSON.stringify(memoryLog));
    })
    .catch((e) => {
      console.warn("Failed to read crash log", e);
      return parseCrashLog(JSON.stringify(memoryLog));
    });
}

export function clearCrashLog(): Promise<void> {
  memoryLog.length = 0;
  return AsyncStorage.removeItem(crashLogKey).catch((e) => {
    console.warn("Failed to clear crash log", e);
  });
}
