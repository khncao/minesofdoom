/**
 * Hook-level tests for useSettings — the settings-persistence contract
 * (F55.2). The hook's documented race guard is the load-vs-update shield:
 * a change made during the session (settingsTouchedRef) must survive the
 * lazy AsyncStorage load resolving *after* it (a stale read clobbering a
 * fresh write is the classic "settings reverted on next launch" bug).
 *
 * - fresh start → exact defaults (both settings objects)
 * - stored values JSON-round-trip in; a PARTIAL stored save merges over
 *   defaults (forward-compat: old saves + new fields)
 * - corrupt stored JSON → defaults win, no crash
 * - updateSettingsData: functional composition, immediate state update,
 *   per-change persistence (the full object is written, not a patch)
 * - a failed setItem must not throw into the caller (console.warn path —
 *   a persistence failure must never interrupt the player's input)
 * - handleSaveSettings: saves the game, rewrites both stores, toasts
 *
 * AsyncStorage is mocked at the module level (shared in-memory store,
 * same pattern as the other hook tests). useI18n runs real — the i18n core
 * is pinned to English, so the toast key is exercised, not faked.
 */
import { act, renderHook } from "@testing-library/react-native";
import { useSettings } from "../hooks/useSettings";
import {
  defaultSettingsData,
  equationSettingsKey,
  settingsDataKey,
  SettingsData,
} from "../game";
import {
  EquationSettings,
  defaultEquationSettings,
} from "src/utils/math/equations";

const mockStore = new Map<string, string>();
let mockRejectSetItem = false;
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  useAsyncStorage: (key: string) => ({
    getItem: async () => mockStore.get(key) ?? null,
    setItem: async (v: string) => {
      if (mockRejectSetItem) {
        throw new Error("disk full");
      }
      mockStore.set(key, v);
    },
  }),
}));

type UseSettingsTest = {
  /** Live result — read `.result.current` at assertion time. */
  result: { current: ReturnType<typeof useSettings> };
  saveGame: jest.Mock;
  displayMessage: jest.Mock;
};

const renderSettingsTest = (): UseSettingsTest => {
  const saveGame = jest.fn();
  const displayMessage = jest.fn();
  const r = renderHook(() => useSettings({ saveGame, displayMessage }));
  return {
    result: {
      get current() {
        return r.result.current;
      },
    },
    saveGame,
    displayMessage,
  };
};

/** Flush microtasks so the mount-time load effects' promises settle. */
const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe("useSettings", () => {
  beforeEach(() => {
    mockStore.clear();
    mockRejectSetItem = false;
    jest.clearAllMocks();
  });

  it("returns the exact defaults on a fresh start", async () => {
    const { result } = renderSettingsTest();
    expect(result.current.settingsData).toEqual(defaultSettingsData);
    expect(result.current.equationSettings).toEqual(defaultEquationSettings);
    await flush();
    expect(result.current.settingsData).toEqual(defaultSettingsData);
    expect(result.current.equationSettings).toEqual(defaultEquationSettings);
  });

  it("loads stored settings after the lazy load resolves", async () => {
    const storedSettings: SettingsData = {
      ...defaultSettingsData,
      music: false,
      notation: "compact",
    };
    const storedEquations: EquationSettings = {
      ...defaultEquationSettings,
      maxNumber: 99,
    };
    mockStore.set(settingsDataKey, JSON.stringify(storedSettings));
    mockStore.set(equationSettingsKey, JSON.stringify(storedEquations));

    const { result } = renderSettingsTest();
    // Initial paint is the default; stored values land after the load.
    expect(result.current.settingsData).toEqual(defaultSettingsData);
    await flush();
    expect(result.current.settingsData).toEqual(storedSettings);
    expect(result.current.equationSettings).toEqual(storedEquations);
  });

  it("merges a partial stored save over defaults (forward-compat)", async () => {
    // A pre-upgrade save without the newer fields: every field must be
    // present in the result, stored fields winning.
    mockStore.set(settingsDataKey, JSON.stringify({ music: false }));
    const { result } = renderSettingsTest();
    await flush();
    expect(result.current.settingsData).toEqual({
      ...defaultSettingsData,
      music: false,
    });
  });

  it("ignores corrupt stored JSON (defaults win, no crash)", async () => {
    mockStore.set(settingsDataKey, "{not json");
    const { result } = renderSettingsTest();
    await flush();
    expect(result.current.settingsData).toEqual(defaultSettingsData);
  });

  it("updateSettingsData: functional composition + immediate state", async () => {
    const { result } = renderSettingsTest();
    await flush();
    const start = result.current.settingsData.music;
    // Two composes: the second must see the first's result (a
    // stale-closure update would land back at the default here).
    act(() => {
      result.current.updateSettingsData((s: SettingsData) => ({
        ...s,
        music: !s.music,
      }));
    });
    act(() => {
      result.current.updateSettingsData((s: SettingsData) => ({
        ...s,
        music: !s.music,
      }));
    });
    expect(result.current.settingsData.music).toBe(start);
  });

  it("persists the full object per change (not a patch)", async () => {
    const { result } = renderSettingsTest();
    await flush();
    act(() => {
      result.current.updateSettingsData((s: SettingsData) => ({
        ...s,
        music: false,
      }));
    });
    const persisted = JSON.parse(
      mockStore.get(settingsDataKey) ?? "{}",
    ) as Partial<SettingsData>;
    expect(persisted).toEqual({ ...defaultSettingsData, music: false });
  });

  it("a session update shields the lazy load from clobbering it", async () => {
    // The race: a stale read starts at mount, the player flips a switch
    // before it resolves, the read lands AFTER the write. The write is
    // the more recent value — the load must skip, not overwrite.
    mockStore.set(
      settingsDataKey,
      JSON.stringify({ ...defaultSettingsData, music: true }),
    );
    const { result } = renderSettingsTest();
    // Update BEFORE the load resolves.
    act(() => {
      result.current.updateSettingsData((s: SettingsData) => ({
        ...s,
        music: false,
      }));
    });
    await flush();
    expect(result.current.settingsData.music).toBe(false);
  });

  it("survives a failed persistence write (fire-and-forget)", async () => {
    const { result } = renderSettingsTest();
    await flush();
    mockRejectSetItem = true;
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    // Must not throw into the caller.
    act(() => {
      result.current.updateSettingsData((s: SettingsData) => ({
        ...s,
        music: false,
      }));
    });
    expect(result.current.settingsData.music).toBe(false);
    // Flush so the rejected setItem promise settles and the hook's
    // .catch fires its console.warn.
    await flush();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("handleSaveSettings saves the game, rewrites both stores, toasts", async () => {
    const test = renderSettingsTest();
    await flush();
    act(() => {
      test.result.current.updateSettingsData((s: SettingsData) => ({
        ...s,
        music: false,
      }));
    });
    act(() => {
      test.result.current.handleSaveSettings();
    });
    expect(test.saveGame).toHaveBeenCalledTimes(1);
    expect(JSON.parse(mockStore.get(settingsDataKey) ?? "{}")).toEqual({
      ...defaultSettingsData,
      music: false,
    });
    expect(JSON.parse(mockStore.get(equationSettingsKey) ?? "{}")).toEqual(
      defaultEquationSettings,
    );
    expect(test.displayMessage).toHaveBeenCalledTimes(1);
    expect(test.displayMessage.mock.calls[0][1]).toBe(3000);
    expect(String(test.displayMessage.mock.calls[0][0]).length).toBeGreaterThan(
      0,
    );
  });
});
