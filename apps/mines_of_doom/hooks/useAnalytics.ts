import { useCallback, useEffect, useRef, useState } from "react";
import { useAsyncStorage } from "@react-native-async-storage/async-storage";
import {
  AnalyticsState,
  analyticsKey,
  recordAdView,
  recordAppOpen,
  recordIapPurchase,
  recordPrestige,
} from "../analytics";

/**
 * Local event logging (guardrail 6 "measure before scaling"). Owns the
 * analytics record end to end: loads it once, folds in this session's app
 * open, and exposes stable record* callbacks for the one-shot milestones
 * (first ad view, IAP purchase, first prestige).
 *
 * NOTE: this deliberately does NOT use the shared useLocalStorage helper —
 * the app-open record must happen AFTER the stored record has been read
 * (useLocalStorage's initial in-memory value is the default, not the stored
 * one, and its setter is write-through: recording against a not-yet-loaded
 * default would clobber the saved history). A direct useAsyncStorage load
 * with a loadedRef gate gives the same cold-start safety useGameEngine
 * uses for the save itself.
 */
export function useAnalytics() {
  const { getItem, setItem } = useAsyncStorage(analyticsKey);
  const setItemRef = useRef(setItem);
  setItemRef.current = setItem;
  const getItemRef = useRef(getItem);
  getItemRef.current = getItem;

  const [state, setState] = useState<AnalyticsState | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  // True once the stored record has been read (or confirmed absent) and
  // this session's open folded in — until then state may be null.
  const [loaded, setLoaded] = useState(false);

  // Load + record this session's open, in one shot, once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let raw: string | null;
      try {
        raw = await getItemRef.current();
      } catch (e) {
        console.warn("Failed to read analytics", e);
        raw = null;
      }
      if (cancelled) return;
      let stored: AnalyticsState | null = null;
      if (raw != null) {
        try {
          stored = JSON.parse(raw) as AnalyticsState;
        } catch (e) {
          // Corrupt record: start fresh (analytics data is disposable by
          // design; the game's save gets a backup, this one doesn't need
          // one).
          console.warn("Corrupt analytics record, starting fresh", e);
        }
      }
      setLoaded(true);
      const updated = recordAppOpen(stored, Date.now());
      setState(updated);
      setItemRef.current(JSON.stringify(updated)).catch((e) =>
        console.warn("Failed to write analytics", e),
      );
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = useCallback((next: AnalyticsState) => {
    stateRef.current = next;
    setState(next);
    setItemRef.current(JSON.stringify(next)).catch((e) =>
      console.warn("Failed to write analytics", e),
    );
  }, []);

  // Stable record* callbacks: each folds into the LATEST state via the ref,
  // so a double invocation (strict mode) stays a no-op for the one-shot
  // first-occurrence markers and only ever re-stamps lastOpenMs-class
  // fields the caller doesn't care about here.
  const onAdView = useCallback(() => {
    const now = Date.now();
    persist(recordAdView(stateRef.current, now));
  }, [persist]);

  const onIapPurchase = useCallback(() => {
    const now = Date.now();
    persist(recordIapPurchase(stateRef.current, now));
  }, [persist]);

  const onPrestige = useCallback(() => {
    const now = Date.now();
    persist(recordPrestige(stateRef.current, now));
  }, [persist]);

  return {
    /** The analytics record (null until the read completes). */
    state,
    loaded,
    onAdView,
    onIapPurchase,
    onPrestige,
  };
}
