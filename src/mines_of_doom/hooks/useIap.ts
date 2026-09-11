import { useCallback, useEffect, useRef, useState } from "react";
import { useLocalStorage } from "src/hooks/useLocalStorage";
import { useI18n } from "src/hooks/useI18n";
import {
  IapEntitlements,
  IapProductId,
  IapProvider,
  emptyIapEntitlements,
  getIapPackCosmetic,
  grantIapEntitlement,
  hasIapEntitlement,
  mergeIapEntitlements,
} from "../iaps";

/** AsyncStorage key for the entitlements. Device-local by design — a
 *  shared/imported save must never carry store receipts (see iaps.ts). */
export const iapEntitlementsKey = "iap";

/**
 * In-app purchases (plan §5.2). Owns the purchase lifecycle: entitlement
 * check (pure, in iaps.ts) → provider.purchase → grant the entitlement →
 * record the analytics event. Restore folds the store's round-trip into
 * the stored state additively.
 *
 * The provider is passed in (MinesOfDoom picks noop vs dev-sim per
 * build), so swapping in a real store SDK later touches exactly one line.
 */
export function useIap({
  provider,
  onPurchased,
  displayMessage,
  getSessionToken,
}: {
  provider: IapProvider;
  /** Fired once per validated purchase (analytics first-IAP / counts). */
  onPurchased?: (id: IapProductId) => void;
  displayMessage: (message: string, timeout: number) => void;
  /** Optional login: the live account session token (null when
   *  anonymous), STABLE callback read at call time. Threaded to the
   *  server verify/restore so minted entitlement rows carry the account
   *  tag (a fresh install restores the old device's purchases). */
  getSessionToken?: () => string | null;
}) {
  const { t } = useI18n();
  const [entitlements, setEntitlements, iapPending] =
    useLocalStorage<IapEntitlements>(iapEntitlementsKey, emptyIapEntitlements());
  // The purchase re-checks entitlements against the LATEST state via the
  // ref: setState only lands on the next render, and a fast second tap
  // before that render would otherwise double-fire the store sheet.
  const entitlementsRef = useRef(entitlements);
  entitlementsRef.current = entitlements;
  const getSessionTokenRef = useRef(getSessionToken);
  getSessionTokenRef.current = getSessionToken;
  /** The token threaded into the provider calls (null = anonymous). */
  const token = (): string | null => getSessionTokenRef.current?.() ?? null;
  // One purchase at a time, ever — the in-flight guard lives in a ref
  // (setState only lands on the next render).
  const inFlightRef = useRef(false);
  const [purchasing, setPurchasing] = useState<IapProductId | null>(null);
  const restoringRef = useRef(false);
  const [restoring, setRestoring] = useState(false);

  const available = provider.isAvailable();

  // Launch reconcile (native store providers only): the store keeps
  // non-consumable purchases for the life of the store account, so a
  // completed purchase re-derives on the next launch even if this
  // device's local record (entitlements AND the device id the server
  // rows are keyed by) was wiped. Silent — no toast, no button: the
  // panel has no manual restore, this launch pass is the sync.
  const reconciledRef = useRef(false);
  // The pending flag starts false, flips true when the initial storage
  // load begins (same commit as our first effect run), and flips back
  // when it lands. We must not reconcile until we have SEEN the load
  // begin — the initial false is "not started yet", and merging into
  // the pre-load empty state would clobber entitlements read from disk.
  const loadStartedRef = useRef(false);
  useEffect(() => {
    if (iapPending) loadStartedRef.current = true;
    if (
      !loadStartedRef.current ||
      reconciledRef.current ||
      !available ||
      iapPending ||
      !provider.reconcileStore
    )
      return;
    reconciledRef.current = true;
    let cancelled = false;
    provider
      .reconcileStore(getSessionTokenRef.current?.() ?? null)
      .then((storeOwned) => {
        if (cancelled) return;
        const merged = mergeIapEntitlements(
          entitlementsRef.current,
          storeOwned,
        );
        // merge returns the original reference when nothing changes, so
        // a write (and a render) happens only for a real change.
        if (merged !== entitlementsRef.current) setEntitlements(merged);
      })
      .catch((e) => console.warn("IAP launch reconcile failed", e));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [available, provider, setEntitlements, iapPending]);

  const purchase = useCallback(
    (id: IapProductId) => {
      if (inFlightRef.current) return;
      if (hasIapEntitlement(entitlementsRef.current, id)) return;
      inFlightRef.current = true;
      setPurchasing(id);
      provider
        .purchase(id, token())
        .then((result) => {
          if (result === "purchased") {
            if (provider.grantsLocally) {
              // Native stores confirm the payment inside the page, so
              // the local grant (pending the server verify) is safe.
              setEntitlements(
                grantIapEntitlement(entitlementsRef.current, id),
              );
              onPurchased?.(id);
              const packCosmetic = getIapPackCosmetic(id);
              displayMessage(
                t("toast.iapPackUnlocked", { name: packCosmetic.name }),
                4000,
              );
            }
            // grantsLocally:false (web / Stripe Checkout) — the "purchased"
            // result means "the redirect to Stripe's hosted page has
            // started", NOT "payment confirmed": the player is still on
            // Stripe's page and may cancel. Granting here would hand out
            // free entitlements. The entitlement arrives through
            // restore() after the server mints the row (webhook and/or
            // the return-visit verify, iapProvider.web.ts).
          }
          // "cancelled" (player backed out of the store sheet) and "error"
          // (no store on this platform) stay silent: the button just
          // re-enables, that's the whole story.
        })
        .catch((e) => console.warn("IAP purchase failed", e))
        .finally(() => {
          inFlightRef.current = false;
          setPurchasing(null);
        });
    },
    [provider, onPurchased, displayMessage, setEntitlements, t],
  );

  const restore = useCallback(() => {
    if (restoringRef.current) return;
    restoringRef.current = true;
    setRestoring(true);
    provider
      .restore(token())
      .then(async (restored) => {
        // The server rows are keyed by the device id — after a local wipe
        // the id is fresh and the rows are unreachable. The store's own
        // record is the fallback: it re-mints the server rows under the
        // current id (re-verify inside the provider) while granting here.
        const storeOwned = provider.reconcileStore
          ? await provider
              .reconcileStore(token())
              .catch((e) => {
                console.warn("IAP store reconcile failed", e);
                return {};
              })
          : {};
        const merged = mergeIapEntitlements(
          mergeIapEntitlements(entitlementsRef.current, restored),
          storeOwned,
        );
        // merge returns the original reference when nothing changes, so
        // a write (and a render) happens only for a real change.
        if (merged !== entitlementsRef.current) {
          setEntitlements(merged);
          // A restore that ADDS packs is the web/Stripe confirmation point
          // (grantsLocally:false — the server mint is what the player got
          // paid for): toast the first new pack and fire the analytics
          // event. Merge is additive, so each product fires at most once.
          const fresh = (Object.keys(merged) as IapProductId[]).filter(
            (pid) =>
              merged[pid] === true &&
              entitlementsRef.current[pid] !== true,
          );
          if (fresh.length > 0) {
            // Per-product: recordIapPurchase increments the counter, so a
            // batched restore (e.g. the re-mint after a local wipe) must
            // record EVERY new pack, not just the first — but the toast
            // stays one line (the first pack).
            for (const pid of fresh) onPurchased?.(pid);
            const packCosmetic = getIapPackCosmetic(fresh[0]);
            displayMessage(
              t("toast.iapPackUnlocked", { name: packCosmetic.name }),
              4000,
            );
          }
        }
      })
      .catch((e) => console.warn("IAP restore failed", e))
      .finally(() => {
        restoringRef.current = false;
        setRestoring(false);
      });
  }, [provider, setEntitlements, onPurchased, displayMessage, t]);

  return {
    /** Whether purchase entry points should be shown at all. */
    available,
    /** The full entitlement record. */
    entitlements,
    /** True while a store sheet / simulation is in flight. */
    purchasing,
    /** True while a restore round-trip is in flight. */
    restoring,
    purchase,
    restore,
  };
}
