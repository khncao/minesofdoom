import {
  useAsyncStorage,
} from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  EquationSettings,
  defaultEquationSettings,
} from "apps/utils/math/equations";
import {
  SettingsData,
  defaultSettingsData,
  equationSettingsKey,
  settingsDataKey,
} from "../game";

export function useSettings({
  saveGame,
  displayMessage,
}: {
  saveGame: () => void;
  displayMessage: (message: string, timeout: number) => void;
}) {
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
          if (parsed != null && typeof parsed === "object") {
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
          if (parsed != null && typeof parsed === "object") {
            setSettingsData({ ...defaultSettingsData, ...parsed });
          }
        } catch (e) {
          console.warn("Corrupt settings, using defaults", e);
        }
      })
      .catch((e) => console.warn("Failed to read settings", e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const handleSaveSettings = useCallback(() => {
    saveGameRef.current();
    setStoredSettingsDataRef.current(JSON.stringify(settingsDataRef.current));
    setEquationSettingsStoreRef.current(
      JSON.stringify(equationSettingsRef.current),
    );
    displayMessage("Saved", 3000);
  }, [displayMessage]);

  return {
    settingsData,
    setSettingsData,
    equationSettings,
    setEquationSettings,
    handleSaveSettings,
  };
}
