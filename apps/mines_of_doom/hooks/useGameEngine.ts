import { AppState, Platform } from "react-native";
import AsyncStorage, {
  useAsyncStorage,
} from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import { emojis } from "apps/utils/graphics/emojis";
import { formatNumber } from "apps/utils/format";
import {
  SaveData,
  computeOfflineMinerals,
  createEmptySaveData,
  gemMineralCost,
  getClickUpgradeCost,
  getDepth,
  getMinerUpgradeCost,
  maxOfflineTicks,
  migrateSaveData,
  msPerTick,
  rollGem,
  saveDataKey,
  saveVersion,
} from "../game";

export function useGameEngine(
  displayMessage: (message: string, timeout: number) => void,
  getAutosaveSeconds?: () => number,
) {
  const startTime = useRef(Date.now());
  const [gameState, setGameState] = useState<SaveData>(createEmptySaveData);
  const { getItem: getSaveData, setItem: setSaveData } =
    useAsyncStorage(saveDataKey);
  // Gates saving until the stored save has finished loading, so an early
  // background/autosave event can't overwrite the real save with the empty
  // initial state (async storage can be slow on mobile cold start).
  const loadedRef = useRef(false);
  // Ref to the latest state so saveGame can be stable and always save the
  // current values (also avoids mutating the state object directly).
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;
  // Miners with reactOnTick register callbacks here; the main loop below
  // invokes them once per tick.
  const onTick = useRef<Array<() => void>>([]);
  // Total ticks elapsed since launch, used for autosave cadence.
  const tickCountRef = useRef(0);
  const lastSaveTickRef = useRef(0);

  // Load stored data. Every step is defensive: a throw here used to become an
  // unhandled promise rejection and leave the game stuck on the empty state.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const finish = (data: SaveData | null, offlineMinerals: number) => {
        loadedRef.current = true;
        if (cancelled) return;
        if (data == null) return;
        setGameState(data);
        startTime.current = data.startTime;
        if (offlineMinerals > 0) {
          displayMessage(
            `Welcome back! Your miners collected ${formatNumber(offlineMinerals)} ${emojis.mineral} while you were away.`,
            6000,
          );
        }
      };

      let raw: string | null;
      try {
        raw = await getSaveData();
      } catch (e) {
        console.warn("Failed to read save data", e);
        return finish(null, 0);
      }
      if (raw == null) {
        return finish(null, 0);
      }

      let parsed: Partial<SaveData>;
      try {
        parsed = JSON.parse(raw) as Partial<SaveData>;
      } catch (e) {
        // Corrupt/partial save (interrupted write, bad migration, ...): keep
        // a backup copy of the raw data instead of destroying it, then start
        // fresh so the game still boots.
        console.warn("Corrupt save data, starting fresh", e);
        try {
          await AsyncStorage.setItem(saveDataKey + ".corrupt", raw);
        } catch (e) {
          console.warn("Failed to back up corrupt save", e);
        }
        return finish(null, 0);
      }
      if (parsed == null || typeof parsed !== "object") {
        return finish(null, 0);
      }

      // Run versioned migrations first, then build the save field by field
      // (no blind spread) so fields removed in updates (e.g. the old "tick")
      // are dropped on the next save instead of lingering forever, and reject
      // non-finite numbers so a bad save can't poison the loop with NaN.
      // Fallbacks mirror createEmptySaveData so older saves missing newer
      // fields still load correctly.
      const migrated = migrateSaveData(parsed as Record<string, unknown>);
      const num = (v: unknown, fallback: number) =>
        typeof v === "number" && Number.isFinite(v) ? v : fallback;
      const now = Date.now();
      const saveData: SaveData = {
        minerals: num(migrated.minerals, 0),
        gems: num(migrated.gems, 0),
        clickPower: num(migrated.clickPower, 1),
        miners: num(migrated.miners, 0),
        minerPower: num(migrated.minerPower, 1),
        startTime: num(migrated.startTime, now),
        saveTime: num(migrated.saveTime, now),
        saveVersion: num(migrated.saveVersion, saveVersion),
      };

      const offlineMinerals = computeOfflineMinerals(
        saveData.miners,
        saveData.minerPower,
        saveData.saveTime,
        now,
      );

      return finish(
        { ...saveData, minerals: saveData.minerals + offlineMinerals },
        offlineMinerals,
      );
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveGame = useCallback(() => {
    if (!loadedRef.current) return;
    const data = JSON.stringify({
      ...gameStateRef.current,
      saveTime: Date.now(),
    });
    setSaveData(data).catch((e) => {
      // A failed write (quota, storage full, ...) would otherwise silently
      // lose everything since the last successful save.
      console.warn("Failed to save game", e);
      displayMessage("Warning: failed to save your game.", 4000);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setSaveData]);

  // Keep a ref to the latest saveGame so the AppState listener (registered
  // once) always saves the current state.
  const saveGameRef = useRef(saveGame);
  saveGameRef.current = saveGame;

  // Save when the app goes to the background
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (status) => {
      if (status !== "active") {
        saveGameRef.current();
      }
    });
    return () => subscription.remove();
  }, []);

  // On web, closing the tab may not fire AppState "backgrounded"; pagehide
  // (and pagehide-with-persistence for bfcache) is the reliable signal.
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const onHide = () => saveGameRef.current();
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, []);

  // Main game loop. setInterval + timestamps instead of a chained setTimeout:
  // the chain drifted and, on web, froze while the tab was backgrounded with
  // no catch-up. Here each fire computes how many whole ticks actually
  // elapsed (Date.now diff), so backgrounded time is banked and paid out as
  // one mineral update + one animation tick on resume (capped at
  // maxOfflineTicks to bound catch-up after long sleeps).
  useEffect(() => {
    let last = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.min(
        Math.max(0, Math.floor((now - last) / msPerTick)),
        maxOfflineTicks,
      );
      last = now;
      if (elapsed < 1) {
        return;
      }
      tickCountRef.current += elapsed;
      if (gameStateRef.current.miners > 0) {
        // Only update state when something actually changes; allocating a new
        // state object every second forced a full re-render even when idle.
        setGameState((n: SaveData) =>
          n.miners > 0
            ? {
                ...n,
                minerals: n.minerals + n.miners * n.minerPower * elapsed,
              }
            : n,
        );
        // One animation tick per fire (not per caught-up tick) so resuming a
        // backgrounded tab doesn't spam the miners with pickaxe swings.
        onTick.current.forEach((fn) => fn());
      }
      // Autosave cadence comes from settings (default 30s); clamp so a bad
      // stored value can't disable autosaving or hammer storage.
      const autosave = getAutosaveSeconds ? getAutosaveSeconds() : 30;
      const interval = Number.isFinite(autosave)
        ? Math.min(600, Math.max(5, Math.floor(autosave)))
        : 30;
      if (tickCountRef.current - lastSaveTickRef.current >= interval) {
        lastSaveTickRef.current = tickCountRef.current;
        saveGame();
      }
    }, msPerTick);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Add a batch of minerals earned by rapid tapping (see useMineTaps).
  const addTapGain = useCallback((gain: number) => {
    if (gain > 0) {
      setGameState((n: SaveData) => ({
        ...n,
        minerals: n.minerals + gain,
      }));
    }
  }, []);

  // Apply the reward for a correct equation answer in one atomic update
  // (mineral gain + gem roll). The gem roll is computed BEFORE the state
  // update (not inside the updater, which React may run twice in dev)
  // and returned so the UI can react to a successful roll (sound, toast,
  // floating text) — the updater itself must stay a pure function of state.
  const applyAnswerReward = useCallback(
    (value: number, comboMultiplier: number): boolean => {
      const gem = rollGem(comboMultiplier);
      setGameState((n: SaveData) => ({
        ...n,
        minerals:
          n.minerals + Math.max(1, value) * n.clickPower * comboMultiplier,
        gems: gem ? n.gems + 1 : n.gems,
      }));
      return gem;
    },
    [],
  );

  const upgradePower = useCallback(() => {
    setGameState((n: SaveData) => {
      return {
        ...n,
        clickPower: n.clickPower + 1,
        minerals: n.minerals - getClickUpgradeCost(n.clickPower),
      };
    });
  }, []);

  const buyMiner = useCallback(() => {
    setGameState((n: SaveData) => {
      return {
        ...n,
        miners: n.miners + 1,
        gems: n.gems - getMinerUpgradeCost(n.miners),
      };
    });
  }, []);

  const buyGem = useCallback(() => {
    setGameState((n: SaveData) => {
      return {
        ...n,
        minerals: n.minerals - gemMineralCost,
        gems: n.gems + 1,
      };
    });
  }, []);

  const resetGame = useCallback(() => {
    setGameState(createEmptySaveData());
    // Clear async first; the next periodic save rewrites a fresh state, so
    // even if removal fails the stored save converges to the reset state.
    AsyncStorage.removeItem(saveDataKey).catch((e) => {
      console.warn("Failed to remove save data", e);
    });
  }, []);

  return {
    gameState,
    onTick,
    depth: getDepth(gameState.minerals),
    mineralsPerSec: gameState.miners * gameState.minerPower,
    saveGame,
    addTapGain,
    applyAnswerReward,
    upgradePower,
    buyMiner,
    buyGem,
    resetGame,
  };
}
