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
 */
export async function getIapDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(IAP_DEVICE_ID_KEY);
  if (typeof existing === "string" && existing.length > 0) return existing;
  const id = makeDeviceId(Date.now());
  await AsyncStorage.setItem(IAP_DEVICE_ID_KEY, id);
  return id;
}
