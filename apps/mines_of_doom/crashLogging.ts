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
import { snapshotCrashContext } from "./crashContext";
import {
  appendCrash,
  crashLogKey,
  parseCrashLog,
  serializeCrash,
  type CrashEntry,
  type CrashSource,
} from "./crashLog";

// Session log: the source of truth while AsyncStorage is unreachable or
// still empty (its entries are folded in on the first successful read).
const memoryLog: CrashEntry[] = [];

// Serializes the read-modify-write so concurrent crashes (or a crash
// arriving mid-write) append instead of clobbering.
let chain: Promise<unknown> = Promise.resolve();

/**
 * Record one crash. Never throws, never rejects: this runs from
 * componentDidCatch and the global error handler, and a throwing crash
 * logger is a bug in disguise.
 */
export function recordCrash(
  error: unknown,
  componentStack?: string | null,
  source: CrashSource = "render",
): void {
  let entry: CrashEntry;
  try {
    // snapshotCrashContext() never throws and is O(ring) — but it sits
    // inside the same containment boundary: a context bug must not lose
    // the crash itself.
    entry = serializeCrash(
      error,
      componentStack,
      undefined,
      source,
      snapshotCrashContext(),
    );
  } catch (e) {
    // Even `String(error)` can throw on hostile objects (toString
    // getters). The global handler passes us raw uncaught values, so the
    // serializer itself must be contained. A crash logger that crashes
    // would hide the very crash it is trying to capture.
    console.warn("Failed to serialize crash", e);
    return;
  }
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

/**
 * Global error capture (plan "Adjust") — the second net behind the
 * `ErrorBoundary`. The unreproducible Android
 * `ReferenceError: Property 'describe' doesn't exist` was suspected to come
 * from an expo-router/native-stack interaction, and those run in native
 * module callbacks / stack-state listeners — OUTSIDE the React render
 * tree, where an error boundary never sees anything. RN 0.76 still exports
 * `ErrorUtils` from the main entry (the earlier note that it was removed
 * was wrong), so we wrap the global handler: record the crash, then hand
 * the error to the PREVIOUS handler so the dev red box and console
 * reporting behave exactly as before — this only adds observability.
 *
 * Web safety: react-native-web has no `ErrorUtils` export, and the import
 * must stay static-export-safe, so the module is required lazily inside a
 * try/catch and the install is a no-op anywhere `ErrorUtils` is missing.
 *
 * Idempotent — safe to call from multiple effects.
 */
export function installGlobalErrorCapture(): void {
  if (globalErrorCaptureInstalled) return;
  globalErrorCaptureInstalled = true;

  // Lazy, guarded: `react-native` resolves to react-native-web on web
  // (which has no ErrorUtils), and a hard top-level import of a missing
  // named export is exactly what the static web export must not risk.
  let rn: { ErrorUtils?: GlobalErrorUtils | null } | undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    rn = require("react-native");
  } catch {
    return;
  }
  const ErrorUtils = rn?.ErrorUtils;
  if (
    typeof ErrorUtils?.setGlobalHandler !== "function" ||
    typeof ErrorUtils.getGlobalHandler !== "function"
  ) {
    return; // web, or an RN build without the global handler
  }

  const original = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error: unknown) => {
    recordCrash(error, null, "global");
    // Preserve prior behaviour (dev red box, console report, ...).
    original(error);
  });
}

let globalErrorCaptureInstalled = false;

type GlobalErrorUtils = {
  getGlobalHandler: () => (error: unknown) => void;
  setGlobalHandler: (handler: (error: unknown) => void) => void;
};

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
