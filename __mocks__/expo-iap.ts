/**
 * Jest manual mock for `expo-iap` (auto-applied by jest for node modules —
 * the real module resolves native TurboModules that don't exist in the
 * test environment). Unit tests never exercise the SDK itself: the
 * integration in src/mines_of_doom/iapProvider.ts is tested through the
 * pure selection rules (iaps.test.ts), the config rules
 * (storeConfig.test.ts), and on-device flows (runbook §3).
 *
 * Shape mirrors the API surface iapProvider.ts imports.
 */
export const ErrorCode = {
  UserCancelled: "user-cancelled",
  Interrupted: "interrupted",
  AlreadyOwned: "already-owned",
  Unknown: "unknown",
} as const;

export const initConnection = jest.fn(async () => undefined);
export const requestPurchase = jest.fn(async () => undefined);
export const finishTransaction = jest.fn(async () => undefined);
export const getAvailablePurchases = jest.fn(async () => []);
export const restorePurchases = jest.fn(async () => []);
export const purchaseUpdatedListener = jest.fn(() => ({ remove: jest.fn() }));
export const purchaseErrorListener = jest.fn(() => ({ remove: jest.fn() }));
