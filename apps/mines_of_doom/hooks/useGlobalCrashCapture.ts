import { useEffect } from "react";
import { installGlobalErrorCapture } from "../crashLogging";

/**
 * Installs the global error handler wrapper (crashLogging.ts) so errors
 * thrown OUTSIDE the React render tree — native-stack listeners, timers,
 * native module callbacks, the suspected class behind the Android
 * `describe` crash — are also recorded in the persisted crash log.
 *
 * No-op on platforms without an `ErrorUtils` global handler (web);
 * idempotent, so mounting it once anywhere in the tree is enough.
 */
export function useGlobalCrashCapture(): void {
  useEffect(() => {
    installGlobalErrorCapture();
  }, []);
}
