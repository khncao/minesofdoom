import { useCallback, useRef, useState } from "react";
import { useLocalStorage } from "apps/hooks/useLocalStorage";
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
}: {
  provider: IapProvider;
  /** Fired once per validated purchase (analytics first-IAP / counts). */
  onPurchased?: (id: IapProductId) => void;
  displayMessage: (message: string, timeout: number) => void;
}) {
  const [entitlements, setEntitlements] = useLocalStorage<IapEntitlements>(
    iapEntitlementsKey,
    emptyIapEntitlements(),
  );
  // The purchase re-checks entitlements against the LATEST state via the
  // ref: setState only lands on the next render, and a fast second tap
  // before that render would otherwise double-fire the store sheet.
  const entitlementsRef = useRef(entitlements);
  entitlementsRef.current = entitlements;
  // One purchase at a time, ever — the in-flight guard lives in a ref
  // (setState only lands on the next render).
  const inFlightRef = useRef(false);
  const [purchasing, setPurchasing] = useState<IapProductId | null>(null);
  const restoringRef = useRef(false);
  const [restoring, setRestoring] = useState(false);

  const available = provider.isAvailable();

  const purchase = useCallback(
    (id: IapProductId) => {
      if (inFlightRef.current) return;
      if (hasIapEntitlement(entitlementsRef.current, id)) return;
      inFlightRef.current = true;
      setPurchasing(id);
      provider
        .purchase(id)
        .then((result) => {
          if (result === "purchased") {
            setEntitlements(
              grantIapEntitlement(entitlementsRef.current, id),
            );
            onPurchased?.(id);
            const packCosmetic = getIapPackCosmetic(id);
            displayMessage(
              id === "removeAds"
                ? "Ads removed — thanks for supporting the game!"
                : packCosmetic
                  ? `Unlocked ${packCosmetic.name} — find it in Cosmetics!`
                  : "Purchase complete!",
              4000,
            );
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
    [provider, onPurchased, displayMessage, setEntitlements],
  );

  const restore = useCallback(() => {
    if (restoringRef.current) return;
    restoringRef.current = true;
    setRestoring(true);
    provider
      .restore()
      .then((restored) => {
        const merged = mergeIapEntitlements(
          entitlementsRef.current,
          restored,
        );
        // merge returns the original reference when nothing changes, so
        // a write (and a render) happens only for a real change.
        if (merged !== entitlementsRef.current) {
          setEntitlements(merged);
        }
      })
      .catch((e) => console.warn("IAP restore failed", e))
      .finally(() => {
        restoringRef.current = false;
        setRestoring(false);
      });
  }, [provider, setEntitlements]);

  return {
    /** Whether purchase entry points should be shown at all. */
    available,
    /** The full entitlement record. */
    entitlements,
    /** Remove Ads owned ⇒ all ad entry points hide permanently. */
    removeAds: hasIapEntitlement(entitlements, "removeAds"),
    /** True while a store sheet / simulation is in flight. */
    purchasing,
    /** True while a restore round-trip is in flight. */
    restoring,
    purchase,
    restore,
  };
}
