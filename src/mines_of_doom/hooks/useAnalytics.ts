import { useCallback, useEffect, useRef, useState } from "react";
import { useAsyncStorage } from "@react-native-async-storage/async-storage";
import {
  AnalyticsState,
  analyticsKey,
  parseAnalytics,
  recordAdOutcome,
  recordAdView,
  recordAppOpen,
  recordCosmeticPurchase,
  recordIapPurchase,
  recordPrestige,
  recordTierMilestone,
  type CosmeticPurchasePath,
  type CosmeticLine,
} from "../analytics";
import type { AdKind, AdResult } from "../ads";
import type { IapProductId } from "../iaps";

/**
 * Local event logging (guardrail 5 "measure before scaling"). Owns the
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
  const { getItem, setItem, removeItem } = useAsyncStorage(analyticsKey);
  const setItemRef = useRef(setItem);
  setItemRef.current = setItem;
  const getItemRef = useRef(getItem);
  getItemRef.current = getItem;
  const removeItemRef = useRef(removeItem);
  removeItemRef.current = removeItem;

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
      // parseAnalytics doubles as the corrupt-record guard (returns null)
      // and the forward-compat migration for pre-`prestiges` records.
      const stored = parseAnalytics(raw);
      setLoaded(true);
      const updated = recordAppOpen(stored, Date.now());
      setState(updated);
      setItemRef
        .current(JSON.stringify(updated))
        .catch((e) => console.warn("Failed to write analytics", e));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = useCallback((next: AnalyticsState) => {
    stateRef.current = next;
    setState(next);
    setItemRef
      .current(JSON.stringify(next))
      .catch((e) => console.warn("Failed to write analytics", e));
  }, []);

  // Stable record* callbacks: each folds into the LATEST state via the ref,
  // so a double invocation (strict mode) stays a no-op for the one-shot
  // first-occurrence markers and only ever re-stamps lastOpenMs-class
  // fields the caller doesn't care about here.
  const onAdView = useCallback((kind: AdKind) => {
    const now = Date.now();
    persist(recordAdView(stateRef.current, now, kind));
  }, [persist]);

  /**
   * A rewarded ad attempt settled (F26.4): the claim lifecycle fires it
   * with the provider's result. Only the first attempt's outcome is
   * stamped — the fold is idempotent like every other first-\* marker.
   */
  const onAdOutcome = useCallback((outcome: AdResult) => {
    persist(recordAdOutcome(stateRef.current, Date.now(), outcome));
  }, [persist]);

  /**
   * A pack was purchased (the IAP hook fires it per product id, both at
   * purchase time and on restore — each product fires at most once, merge
   * is additive). The id goes into the per-purchase log so the per-
   * product counts are measurable on-device (F26.3).
   */
  const onIapPurchase = useCallback((productId?: IapProductId) => {
    const now = Date.now();
    persist(recordIapPurchase(stateRef.current, now, productId));
  }, [persist]);

  const onPrestige = useCallback(() => {
    const now = Date.now();
    persist(recordPrestige(stateRef.current, now));
  }, [persist]);

  /**
   * A goal tier completed (pass 23): idempotent per tier (the stamps map
   * is additive, never re-stamped), data-driven by the tier id — the
   * gate moment "reached the Motherlode" and friends. Fired by the
   * goal-completion effect in MinesOfDoom.tsx.
   */
  const onTierMilestone = useCallback(
    (tierId: string) => {
      persist(recordTierMilestone(stateRef.current, tierId, Date.now()));
    },
    [persist],
  );

  /**
   * A cosmetic was bought (features.md pass-16 `cosmetics:analytics`):
   * the per-purchase line — which line, which item, gems vs pack path,
   * gem balance at the moment. Fired by the engine gem buys ("gems")
   * and by the IAP grant effect ("iap").
   */
  const onCosmeticPurchase = useCallback(
    (ev: {
      line: CosmeticLine;
      id: string;
      path: CosmeticPurchasePath;
      gems: number;
    }) => {
      persist(recordCosmeticPurchase(stateRef.current, ev, Date.now()));
    },
    [persist],
  );

  // Data-deletion path (module docs: deletion is a removeItem). The next
  // app open re-establishes a fresh record — that's the semantics of
  // "delete my data", not "hide my data".
  const clear = useCallback(() => {
    stateRef.current = null;
    setState(null);
    removeItemRef
      .current()
      .catch((e: unknown) => console.warn("Failed to clear analytics", e));
  }, []);

  return {
    /** The analytics record (null until the read completes, or after clear). */
    state,
    loaded,
    onAdView,
    onAdOutcome,
    onIapPurchase,
    onPrestige,
    onTierMilestone,
    onCosmeticPurchase,
    clear,
  };
}
