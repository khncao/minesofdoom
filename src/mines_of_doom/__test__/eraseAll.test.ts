/**
 * Tests for eraseAllAppStorage (the "Erase all data" wipe — see
 * eraseAll.ts). AsyncStorage in the jest-expo environment is an
 * in-memory store, so we seed a realistic mix of the app's persisted
 * keys and assert the wipe leaves nothing.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { eraseAllAppStorage } from "../eraseAll";

describe("eraseAllAppStorage", () => {
  it("removes every persisted key and reports the count", async () => {
    // The keys the real app persists (save/settings/equationSettings from
    // game.ts, adRewards, analytics, plus a couple of useLocalStorage
    // prefs) — spread over separate setItem calls to mirror real usage.
    const seeded: [string, string][] = [
      ["save", "{}"],
      ["settings", "{}"],
      ["equationSettings", "{}"],
      ["adRewards", "{}"],
      ["analytics", "{}"],
      ["mute", "false"],
      ["onScreenKeypad", "true"],
      ["onboardingDone", "true"],
    ];
    for (const [key, value] of seeded) {
      await AsyncStorage.setItem(key, value);
    }

    const removed = await eraseAllAppStorage();

    expect(removed).toBeGreaterThanOrEqual(seeded.length);
    for (const [key] of seeded) {
      expect(await AsyncStorage.getItem(key)).toBeNull();
    }
    expect([...(await AsyncStorage.getAllKeys())]).toEqual([]);
  });

  it("is idempotent (a second erase removes nothing)", async () => {
    await AsyncStorage.setItem("save", "{}");
    await eraseAllAppStorage();
    expect(await eraseAllAppStorage()).toBe(0);
  });
});
