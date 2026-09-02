import { useCallback, useEffect, useState } from "react";
import { clearCrashLog, getCrashEntries } from "../crashLogging";
import type { CrashEntry } from "../crashLog";

/**
 * Debug access to the persisted crash log (crashLogging.ts) for the
 * Settings panel's "Recent errors" section. `null` = not loaded yet;
 * `[]` = loaded, no crashes logged.
 */
export function useCrashLog() {
  const [entries, setEntries] = useState<CrashEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCrashEntries().then((list) => {
      if (!cancelled) setEntries(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const clear = useCallback(() => {
    void clearCrashLog().then(() => setEntries([]));
  }, []);

  return { entries, clear };
}
