/**
 * Device-scoped identity for the IAP/Pocketbase round-trip
 * (docs/pocketbase-plan.md, "Client (repo changes)" step 1).
 *
 * The game has no login: the entitlement record on the server is keyed by a
 * stable per-device UUID. It is a KEY, not a secret — no signing is involved
 * (the store tokens prove ownership). Persisted in AsyncStorage under its
 * own key, like the `iap` / `adRewards` keys (it must NOT live inside a
 * save file: a shared/imported save must never carry the device identity).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

export const IAP_DEVICE_ID_KEY = "iapDeviceId";

/** Base36 alphabet without 0/o/1/i lookalikes. */
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/**
 * Pure id factory (injectable clock + RNG so it is unit-testable):
 * a timestamp prefix (debuggability, roughly sortable) + 16 random chars
 * (uniqueness). Not a spec-grade UUIDv4 on purpose — no crypto dependency
 * for what is a storage key, and v4-style ids are what the plan means by
 * "a UUID persisted in AsyncStorage".
 */
export function makeDeviceId(
  now: number,
  rand: () => number = Math.random,
): string {
  let tail = "";
  for (let i = 0; i < 16; i++) {
    tail += ALPHABET[Math.floor(rand() * ALPHABET.length)];
  }
  return `dev-${now.toString(36)}${tail}`;
}

/**
 * Load the device id, creating and persisting one on first launch. Uses
 * the plain AsyncStorage object API (not the useLocalStorage hook): this
 * is a module consumed by the IAP provider, not a component.
 *
 * The read-generate-write is memoized + single-flight (F49.1,
 * `identity:device-id-fork`): all six server-facing modules call this per
 * round-trip, so on a fresh install the first autosave can fire
 * cloud-push AND leaderboard-submit in the same commit. Without the
 * memo, both `getItem`s would land before either `setItem`, each would
 * mint its own id, and the losing id's first cloud backup row would be
 * keyed by a device id the app never uses again. Sharing one in-flight
 * promise (same class as the crashLog persistence chain) guarantees every
 * concurrent caller resolves the SAME id.
 */
let memoId: string | null = null;
let inFlight: Promise<string> | null = null;

export function getIapDeviceId(): Promise<string> {
  if (memoId !== null) return Promise.resolve(memoId);
  if (inFlight !== null) return inFlight;
  inFlight = AsyncStorage.getItem(IAP_DEVICE_ID_KEY)
    .then((existing) => {
      if (typeof existing === "string" && existing.length > 0) {
        memoId = existing;
        return existing;
      }
      const id = makeDeviceId(Date.now());
      return AsyncStorage.setItem(IAP_DEVICE_ID_KEY, id).then(() => {
        memoId = id;
        return id;
      });
    })
    .finally(() => {
      // Reset the single-flight slot so a failed first read retries on the
      // next call; a successful one is a no-op (memoId already set).
      inFlight = null;
    });
  return inFlight;
}
