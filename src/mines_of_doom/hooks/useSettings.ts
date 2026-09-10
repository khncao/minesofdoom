import { useAsyncStorage } from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "src/hooks/useI18n";
import {
  EquationSettings,
  defaultEquationSettings,
} from "src/utils/math/equations";
import {
  SettingsData,
  defaultSettingsData,
  equationSettingsKey,
  settingsDataKey,
} from "../game";

type Updater<T> = T | ((prev: T) => T);

export function useSettings({
  saveGame,
  displayMessage,
}: {
  saveGame: () => void;
  displayMessage: (message: string, timeout: number) => void;
}) {
  const { t } = useI18n();
  const [settingsData, setSettingsData] = useState(defaultSettingsData);
  const [equationSettings, setEquationSettings] = useState(
    defaultEquationSettings,
  );
  const { getItem: getStoredSettingsData, setItem: setStoredSettingsData } =
    useAsyncStorage(settingsDataKey);
  const {
    getItem: getEquationSettingsStore,
    setItem: setEquationSettingsStore,
  } = useAsyncStorage(equationSettingsKey);

  // useAsyncStorage returns new function identities every render, so keep
  // refs for stable callbacks passed to the memoized settings UI.
  const saveGameRef = useRef(saveGame);
  saveGameRef.current = saveGame;
  const setStoredSettingsDataRef = useRef(setStoredSettingsData);
  setStoredSettingsDataRef.current = setStoredSettingsData;
  const setEquationSettingsStoreRef = useRef(setEquationSettingsStore);
  setEquationSettingsStoreRef.current = setEquationSettingsStore;
  const settingsDataRef = useRef(settingsData);
  settingsDataRef.current = settingsData;
  const equationSettingsRef = useRef(equationSettings);
  equationSettingsRef.current = equationSettings;

  // Per-change persistence: the moment the player flips a switch the new
  // value is written to AsyncStorage, so closing the app before ever
  // tapping Save (a different tab) can no longer revert the change on the
  // next launch. A change made during this session also shields the async
  // load below from clobbering it (the load's read started before our
  // write; our write is the more recent value).
  const settingsTouchedRef = useRef(false);
  const equationTouchedRef = useRef(false);

  // Load stored settings. Merging over defaults keeps things working if a
  // future update adds new fields (old saves just get the new defaults).
  useEffect(() => {
    getEquationSettingsStore()
      .then((data) => {
        if (data == null) {
          return;
        }
        try {
          const parsed: Partial<EquationSettings> = JSON.parse(data);
          if (
            parsed != null &&
            typeof parsed === "object" &&
            !equationTouchedRef.current
          ) {
            setEquationSettings({ ...defaultEquationSettings, ...parsed });
          }
        } catch (e) {
          console.warn("Corrupt equation settings, using defaults", e);
        }
      })
      .catch((e) => console.warn("Failed to read equation settings", e));
    getStoredSettingsData()
      .then((data) => {
        if (data == null) {
          return;
        }
        try {
          const parsed: Partial<SettingsData> = JSON.parse(data);
          if (
            parsed != null &&
            typeof parsed === "object" &&
            !settingsTouchedRef.current
          ) {
            setSettingsData({ ...defaultSettingsData, ...parsed });
          }
        } catch (e) {
          console.warn("Corrupt settings, using defaults", e);
        }
      })
      .catch((e) => console.warn("Failed to read settings", e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateSettingsData = useCallback((next: Updater<SettingsData>) => {
    const value =
      typeof next === "function" ? next(settingsDataRef.current) : next;
    settingsTouchedRef.current = true;
    settingsDataRef.current = value;
    setSettingsData(value);
    setStoredSettingsDataRef
      .current(JSON.stringify(value))
      .catch((e) => console.warn("Failed to save settings", e));
  }, []);

  const updateEquationSettings = useCallback(
    (next: Updater<EquationSettings>) => {
      const value =
        typeof next === "function" ? next(equationSettingsRef.current) : next;
      equationTouchedRef.current = true;
      equationSettingsRef.current = value;
      setEquationSettings(value);
      setEquationSettingsStoreRef
        .current(JSON.stringify(value))
        .catch((e) => console.warn("Failed to save equation settings", e));
    },
    [],
  );

  // The explicit Save button: settings are already persisted per change,
  // so this saves the game (with the settings included via the caller) and
  // confirms with a toast.
  const handleSaveSettings = useCallback(() => {
    saveGameRef.current();
    setStoredSettingsDataRef.current(JSON.stringify(settingsDataRef.current));
    setEquationSettingsStoreRef.current(
      JSON.stringify(equationSettingsRef.current),
    );
    displayMessage(t("toast.settingsSaved"), 3000);
  }, [displayMessage, t]);

  return {
    settingsData,
    updateSettingsData,
    equationSettings,
    updateEquationSettings,
    handleSaveSettings,
  };
}
