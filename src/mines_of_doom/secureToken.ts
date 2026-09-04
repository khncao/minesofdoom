/**
 * Where the signed-in session token lives (docs/todo.md "Optional
 * login": "The session token goes in secure storage (Keychain/Keystore —
 * never AsyncStorage)").
 *
 * The token is the app's only secret: a stolen token IS the account
 * (the data endpoints accept it as the account target, and GDPR delete
 * with the token erases the account). AsyncStorage is plaintext on the
 * filesystem — a session token there would be a GDPR incident waiting to
 * happen, so it never goes there (the device id in iapDeviceId.ts is the
 * opposite: a KEY, not a secret, which is why AsyncStorage is fine for it).
 *
 * Providers, picked like the store providers (empty/fallback = hidden,
 * never a crash):
 *  - native: `react-native-keychain`'s generic-password store — the OS
 *    Keychain (iOS) / Keystore-backed encrypted store (Android). Autolinked
 *    at build time (no config plugin, so the committed android/ project
 *    picks it up at gradle time — no prebuild needed for this module).
 *  - web (and any future platform without the native module): the
 *    in-memory store — a session dies with the app run. That is the
 *    honest degradation: web has no durable secure store and the other
 *    store integrations are no-ops there by construction, so a
 *    non-persistent session costs nothing.
 *
 * The store is a plain async interface (not a hook): the hook
 * (useAccount.ts) owns the React state, this file owns the persistence.
 */
import { Platform } from "react-native";
import * as Keychain from "react-native-keychain";

/** The Keychain/Keystore service+account pair the token is stored under
 *  (one service, one row — the app's single session). */
export const TOKEN_SERVICE = "com.minus4kelvin.minesofdoom";
export const TOKEN_ACCOUNT = "sessionToken";

export interface TokenStore {
  /** Stable id for logs ("keychain", "memory"). */
  readonly id: string;
  /** The stored token, or null (never signed in / no store entry). */
  getToken(): Promise<string | null>;
  /** Replace the stored token. Resolves true only on success. */
  setToken(token: string): Promise<boolean>;
  /** Delete the stored token (sign out). Resolves true on success OR
   *  "there was nothing to delete" (a missing entry is a success here —
   *  the caller wants the token gone, not an error). */
  clearToken(): Promise<boolean>;
}

/**
 * The in-memory store: a session that dies with the app run. Web uses it
 * by construction (no durable secure store exists there, and the store
 * integrations are no-ops on web anyway); it is also the fallback the
 * keychain store degrades to if a Keychain call throws (a token that
 * can't be secured is a session that stays in memory, never plaintext).
 */
export const memoryTokenStore: TokenStore = {
  id: "memory",
  getToken: async () => memoryToken,
  setToken: async (token) => {
    memoryToken = token;
    return true;
  },
  clearToken: async () => {
    memoryToken = null;
    return true;
  },
};
let memoryToken: string | null = null;

/**
 * The OS secure store. Every call is wrapped so a Keychain failure
 * (rare: lock-timeout races, an emulator without a security service)
 * degrades to the memory store for the current run instead of breaking
 * the sign-in flow — and is logged, because a keychain that throws is
 * something a human should see.
 */
export const keychainTokenStore: TokenStore = {
  id: "keychain",
  async getToken() {
    try {
      // v10 stores ONE username/password pair per service (the username
      // is the account constant, so the service is the unique key).
      const creds = await Keychain.getGenericPassword({ service: TOKEN_SERVICE });
      // `false` = no entry (the SDK's "absent" sentinel).
      return creds && typeof creds.password === "string"
        ? creds.password
        : null;
    } catch (err) {
      console.warn("keychain: getToken failed", err);
      return memoryTokenStore.getToken();
    }
  },
  async setToken(token) {
    try {
      // Resolves `false` on failure, a credentials object on success.
      const ok = await Keychain.setGenericPassword(TOKEN_ACCOUNT, token, {
        service: TOKEN_SERVICE,
      });
      return ok !== false;
    } catch (err) {
      console.warn("keychain: setToken failed", err);
      return memoryTokenStore.setToken(token);
    }
  },
  async clearToken() {
    try {
      // resetGenericPassword resolves true whether or not an entry
      // existed — exactly the "it's gone" contract.
      const ok = await Keychain.resetGenericPassword({
        service: TOKEN_SERVICE,
      });
      return ok === true;
    } catch (err) {
      console.warn("keychain: clearToken failed", err);
      return memoryTokenStore.clearToken();
    }
  },
};

/**
 * The one call the engine uses. Native → the OS secure store; web → the
 * in-memory store (a session dies with the app run — honest, and the
 * store integrations are no-ops there anyway).
 */
export function selectTokenStore(): TokenStore {
  return Platform.OS === "web" ? memoryTokenStore : keychainTokenStore;
}
