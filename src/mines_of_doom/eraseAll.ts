/**
 * "Erase all data" (Settings → Save → "Erase all data"): wipes EVERYTHING
 * the app persists locally — a deliberate superset of Reset, which only
 * clears the game save.
 *
 * How it works: the @react-native-async-storage module namespaces every
 * key per app (AsyncStorage.getAllKeys() returns only THIS app's keys on
 * every platform), so erasing "everything local" is getAllKeys() +
 * multiRemove — no key registry to keep in sync when a future feature
 * adds a new persisted key. (clear() would do the same in one call;
 * the explicit loop keeps the removed count for the caller.) The one exception is the web account session
 * token: secureToken.ts writes it to plain window.localStorage under a
 * bare key (not through AsyncStorage), so it is removed explicitly on
 * web.
 *
 * Scope honesty (transparency guardrail — the button copy says the same):
 * this erases LOCAL data only. A cloud save on the developer's server is
 * NOT touched and can still be restored after an erase; deleting the
 * server-side copy is the separate GDPR "delete my data" action in the
 * cloud section.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { WEB_TOKEN_KEY } from "./secureToken";

/**
 * Remove every key this app has persisted. Returns the number of
 * AsyncStorage keys removed. Callers should reset their live in-memory
 * state to defaults BEFORE calling this on native (a native app has no
 * page reload, so the in-memory values are what a next autosave would
 * rewrite); on web a location.reload() afterwards guarantees a clean
 * boot regardless.
 */
export async function eraseAllAppStorage(): Promise<number> {
 const keys = await AsyncStorage.getAllKeys();
 // removeItem per key rather than multiRemove: the key count is tiny
 // (~10) and the per-key form is what every AsyncStorage implementation
 // (and the jest mock) guarantees.
 for (const key of keys) {
  await AsyncStorage.removeItem(key);
 }
 if (Platform.OS === "web" && typeof window !== "undefined") {
  // The session token is the only key outside the AsyncStorage
  // namespace (see module docs); the rest of the web session state
  // (the in-memory account hook) dies with the reload.
  window.localStorage.removeItem(WEB_TOKEN_KEY);
 }
 return keys.length;
}
