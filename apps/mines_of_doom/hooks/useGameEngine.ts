import { AppState, Platform } from "react-native";
import AsyncStorage, {
  useAsyncStorage,
} from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import { emojis } from "apps/utils/graphics/emojis";
import { formatNumber } from "apps/utils/format";
import {
  CLICK_BOOST_MAX_LEVELS,
  COMBO_RESIST_MAX_LEVELS,
  GEM_CHANCE_MAX_LEVELS,
  PRESTIGE_LEVELS,
  SaveData,
  computeOfflineMinerals,
  createEmptySaveData,
  gemMineralCost,
  getClickBoostCost,
  getClickBoostMultiplier,
  getClickUpgradeCost,
  getComboResistCost,
  getDepth,
  getDepthTier,
  getFastMinerCost,
  getGemChance,
  getLegendaryMinerCost,
  getGemChanceCost,
  getMineralsPerSec,
  getMinerPowerUpgradeCost,
  getMinerUpgradeCost,
  getPrestigeLevel,
  getPrestigeMultiplier,
  lifetimeDelta,
  maxOfflineTicks,
  migrateSaveData,
  msPerTick,
  rollGem,
  saveDataKey,
  saveVersion,
} from "../game";
import { getAchievementBonus } from "../achievements";
import { getTierBonus } from "../goals";
import {
  DEFAULT_OWNED,
  DEFAULT_OUTFIT,
  DEFAULT_PICKAXE,
  DEFAULT_OWNED_CAVE_THEMES,
  DEFAULT_CAVE_THEME,
  OUTFITS,
  PICKAXES,
  getCaveThemeCost,
  getCostGems,
  isCaveThemeId,
  isOutfitId,
  isPickaxeId,
} from "../cosmetics";

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
        fastMiners: Math.max(0, Math.floor(num(migrated.fastMiners, 0))),
        legendaryMiners: Math.max(0, Math.floor(num(migrated.legendaryMiners, 0))),
        gemChanceLevels: Math.min(
          GEM_CHANCE_MAX_LEVELS,
          Math.max(0, Math.floor(num(migrated.gemChanceLevels, 0))),
        ),
        prestigeLevel: Math.min(
          PRESTIGE_LEVELS.length - 1,
          Math.max(0, Math.floor(num(migrated.prestigeLevel, 0))),
        ),
        clickBoostLevels: Math.min(
          CLICK_BOOST_MAX_LEVELS,
          Math.max(0, Math.floor(num(migrated.clickBoostLevels, 0))),
        ),
        comboResistLevels: Math.min(
          COMBO_RESIST_MAX_LEVELS,
          Math.max(0, Math.floor(num(migrated.comboResistLevels, 0))),
        ),
        startTime: num(migrated.startTime, now),
        saveTime: num(migrated.saveTime, now),
        saveVersion: num(migrated.saveVersion, saveVersion),
        lifetimeMinerals: num(migrated.lifetimeMinerals, 0),
        lifetimeCorrect: num(migrated.lifetimeCorrect, 0),
        maxCombo: num(migrated.maxCombo, 0),
        maxDepth: num(migrated.maxDepth, 0),
        minersOwnedEver: num(migrated.minersOwnedEver, 0),
        totalGemsMinted: num(migrated.totalGemsMinted, 0),
        totalGemsSpent: num(migrated.totalGemsSpent, 0),
        totalPrestiges: num(migrated.totalPrestiges, 0),
        completedTiers: Array.isArray(migrated.completedTiers)
          ? migrated.completedTiers.filter((t): t is string =>
              typeof t === "string",
            )
          : [],
        completedAchievements: Array.isArray(migrated.completedAchievements)
          ? migrated.completedAchievements.filter(
              (c): c is string => typeof c === "string",
            )
          : [],
        playerSeed: num(migrated.playerSeed, 12345),
        // Always keep the free defaults owned; drop unknown ids.
        ownedCosmetics: [
          ...new Set([
            ...DEFAULT_OWNED,
            ...(Array.isArray(migrated.ownedCosmetics)
              ? migrated.ownedCosmetics.filter(
                  (c): c is string =>
                    typeof c === "string" &&
                    (isOutfitId(c) || isPickaxeId(c)),
                )
              : []),
          ]),
        ],
        selectedOutfit:
          typeof migrated.selectedOutfit === "string" &&
          OUTFITS.some((o) => o.id === migrated.selectedOutfit)
            ? migrated.selectedOutfit
            : DEFAULT_OUTFIT,
        selectedPickaxe:
          typeof migrated.selectedPickaxe === "string" &&
          PICKAXES.some((p) => p.id === migrated.selectedPickaxe)
            ? migrated.selectedPickaxe
            : DEFAULT_PICKAXE,
        // Always keep the free default cave theme owned; drop unknown ids.
        ownedCaveThemes: [
          ...new Set([
            ...DEFAULT_OWNED_CAVE_THEMES,
            ...(Array.isArray(migrated.ownedCaveThemes)
              ? migrated.ownedCaveThemes.filter(
                  (c): c is string =>
                    typeof c === "string" && isCaveThemeId(c),
                )
              : []),
          ]),
        ],
        selectedCaveTheme:
          typeof migrated.selectedCaveTheme === "string" &&
          isCaveThemeId(migrated.selectedCaveTheme)
            ? migrated.selectedCaveTheme
            : DEFAULT_CAVE_THEME,
      };

      const offlineMinerals = computeOfflineMinerals(
        saveData.miners,
        saveData.minerPower,
        saveData.fastMiners,
        saveData.saveTime,
        now,
        getPrestigeMultiplier(saveData.prestigeLevel),
        saveData.legendaryMiners,
      );

      return finish(
        {
          ...saveData,
          minerals: saveData.minerals + offlineMinerals,
          // Offline earnings count toward lifetime stats too.
          lifetimeMinerals: saveData.lifetimeMinerals + offlineMinerals,
        },
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
      if (
        gameStateRef.current.miners > 0 ||
        gameStateRef.current.fastMiners > 0 ||
        gameStateRef.current.legendaryMiners > 0
      ) {
        // Only update state when something actually changes; allocating a new
        // state object every second forced a full re-render even when idle.
        setGameState((n: SaveData) => {
          // The banked prestige multiplier applies to passive income too, so a
          // new run starts with a stronger crew (the whole point of prestige).
          const income =
            getMineralsPerSec(n.miners, n.minerPower, n.fastMiners, n.legendaryMiners) *
            elapsed *
            getPrestigeMultiplier(n.prestigeLevel);
          if (income <= 0) return n;
          return {
            ...n,
            minerals: n.minerals + income,
            ...lifetimeDelta(n, { minerals: income }),
          };
        });
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
  // `gain` is the effective (depth-tier-bonus-included) tap value.
  const addTapGain = useCallback((gain: number) => {
    if (gain > 0) {
      setGameState((n: SaveData) => ({
        ...n,
        minerals: n.minerals + gain,
        ...lifetimeDelta(n, { minerals: gain }),
      }));
    }
  }, []);

  // Apply the reward for a correct equation answer in one atomic update
  // (mineral gain + gem roll). The gem roll is computed BEFORE the state
  // update (not inside the updater, which React may run twice in dev)
  // and returned so the UI can react to a successful roll (sound, toast,
  // floating text) — the updater itself must stay a pure function of state.
  const applyAnswerReward = useCallback(
    (value: number, comboMultiplier: number, newCombo: number): boolean => {
      // Gem chance includes the purchased upgrade levels (read from the ref
      // so a state update in flight can't change the roll mid-answer).
      const gem = rollGem(
        getGemChance(gameStateRef.current.gemChanceLevels),
        comboMultiplier,
      );
      setGameState((n: SaveData) => {
        // Depth-tier click bonus (authoritative; the UI shows the same value
        // computed from the rendered depth — they only disagree across a
        // tier boundary, by at most one gain event).
        const bonus = getDepthTier(getDepth(n.minerals)).clickBonus;
        const prestige = getPrestigeMultiplier(n.prestigeLevel);
        // Click x2 upgrade (tier 3): doubles tap/answer gains per level.
        const clickBoost = getClickBoostMultiplier(n.clickBoostLevels);
        const gained =
          Math.max(1, value) *
          n.clickPower * comboMultiplier * bonus * prestige * clickBoost;
        return {
          ...n,
          minerals: n.minerals + gained,
          gems: gem ? n.gems + 1 : n.gems,
          ...lifetimeDelta(n, {
            minerals: gained,
            correct: 1,
            combo: newCombo,
            gemsMinted: gem ? 1 : 0,
          }),
        };
      });
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
      const cost = getMinerUpgradeCost(n.miners);
      return {
        ...n,
        miners: n.miners + 1,
        gems: n.gems - cost,
        minersOwnedEver: Math.max(n.minersOwnedEver, n.miners + 1),
        totalGemsSpent: n.totalGemsSpent + cost,
      };
    });
  }, []);

  // Tier-2 unlock: fast miner (second miner type — cheaper gem curve, weaker
  // per-miner output). Affordability-guarded like the other purchases.
  const buyFastMiner = useCallback(() => {
    setGameState((n: SaveData) => {
      const cost = getFastMinerCost(n.fastMiners);
      if (n.gems < cost) return n;
      return {
        ...n,
        fastMiners: n.fastMiners + 1,
        gems: n.gems - cost,
        totalGemsSpent: n.totalGemsSpent + cost,
      };
    });
  }, []);

  // Tier-5 endgame unlock: legendary miner (third miner type — premium gem
  // curve, double the per-miner output of a normal miner). Affordability-
  // guarded like the other purchases; miners are run resources, so a sunk
  // shaft resets the roster (see sinkNewShaft).
  const buyLegendaryMiner = useCallback(() => {
    setGameState((n: SaveData) => {
      const cost = getLegendaryMinerCost(n.legendaryMiners);
      if (n.gems < cost) return n;
      return {
        ...n,
        legendaryMiners: n.legendaryMiners + 1,
        gems: n.gems - cost,
        totalGemsSpent: n.totalGemsSpent + cost,
      };
    });
  }, []);

  // Tier-2 unlock: first gem upgrade — +1% base gem chance per level.
  // Capped; over-cap purchases are no-ops.
  const buyGemChance = useCallback(() => {
    setGameState((n: SaveData) => {
      if (n.gemChanceLevels >= GEM_CHANCE_MAX_LEVELS) return n;
      const cost = getGemChanceCost(n.gemChanceLevels);
      if (n.gems < cost) return n;
      return {
        ...n,
        gemChanceLevels: n.gemChanceLevels + 1,
        gems: n.gems - cost,
        totalGemsSpent: n.totalGemsSpent + cost,
      };
    });
  }, []);

  const buyGem = useCallback(() => {
    setGameState((n: SaveData) => {
      return {
        ...n,
        minerals: n.minerals - gemMineralCost,
        gems: n.gems + 1,
        totalGemsMinted: n.totalGemsMinted + 1,
      };
    });
  }, []);

  // Tier-1 unlock: raise each miner's output (unlocks via goals.ts).
  const upgradeMinerPower = useCallback(() => {
    setGameState((n: SaveData) => {
      const cost = getMinerPowerUpgradeCost(n.minerPower);
      if (n.minerals < cost) return n;
      return {
        ...n,
        minerPower: n.minerPower + 1,
        minerals: n.minerals - cost,
      };
    });
  }, []);

  // Record goal-tier completions and grant their one-time bonuses.
  // Idempotent: tier ids already in completedTiers are ignored, so a
  // double-fired updater (React may run updaters twice in dev) can't pay
  // the bonus twice.
  const completeTiers = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setGameState((n: SaveData) => {
      const fresh = ids.filter((id) => !n.completedTiers.includes(id));
      if (fresh.length === 0) return n;
      return {
        ...n,
        minerals: n.minerals + getTierBonus(fresh),
        lifetimeMinerals: n.lifetimeMinerals + getTierBonus(fresh),
        completedTiers: [...n.completedTiers, ...fresh],
      };
    });
  }, []);

  // Record achievement completions and grant their one-time bonuses.
  // Same idempotent pattern as completeTiers: a double-fired updater
  // (React may run updaters twice in dev) can't pay the bonus twice.
  const completeAchievements = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setGameState((n: SaveData) => {
      const fresh = ids.filter((id) => !n.completedAchievements.includes(id));
      if (fresh.length === 0) return n;
      const bonus = getAchievementBonus(fresh);
      return {
        ...n,
        minerals: n.minerals + bonus,
        lifetimeMinerals: n.lifetimeMinerals + bonus,
        completedAchievements: [...n.completedAchievements, ...fresh],
      };
    });
  }, []);

  // Buy a cosmetic (outfit or pickaxe) with gems; auto-selects it. Unknown
  // ids and unaffordable prices are no-ops (button state may be stale).
  const buyCosmetic = useCallback((id: string) => {
    const cost = getCostGems(id);
    if (cost == null) return;
    setGameState((n: SaveData) => {
      if (n.ownedCosmetics.includes(id) || n.gems < cost) return n;
      return {
        ...n,
        gems: n.gems - cost,
        totalGemsSpent: n.totalGemsSpent + cost,
        ownedCosmetics: [...n.ownedCosmetics, id],
        selectedOutfit: isOutfitId(id) ? id : n.selectedOutfit,
        selectedPickaxe: isPickaxeId(id) ? id : n.selectedPickaxe,
      };
    });
  }, []);

  // Switch to an already-owned cosmetic.
  const selectCosmetic = useCallback((id: string) => {
    setGameState((n: SaveData) => {
      if (!n.ownedCosmetics.includes(id)) return n;
      if (isOutfitId(id) && n.selectedOutfit === id) return n;
      if (isPickaxeId(id) && n.selectedPickaxe === id) return n;
      return {
        ...n,
        selectedOutfit: isOutfitId(id) ? id : n.selectedOutfit,
        selectedPickaxe: isPickaxeId(id) ? id : n.selectedPickaxe,
      };
    });
  }, []);

  // Reroll the player sprite randomizer (roster variants follow, since they
  // derive from the same seed). Seed computed outside the updater so a
  // double-invoked updater can't desync what the UI shows.
  const rerollPlayerSeed = useCallback(() => {
    const seed = Math.floor(Math.random() * 2147483647) || 1;
    setGameState((n: SaveData) => ({ ...n, playerSeed: seed }));
  }, []);

  // Tier-4 unlock: buy a cave theme (cave background recolor) with gems;
  // auto-selects it. Unknown ids and unaffordable prices are no-ops (button
  // state may be stale). Gem spend counts toward totalGemsSpent.
  const buyCaveTheme = useCallback((id: string) => {
    const cost = getCaveThemeCost(id);
    if (cost == null) return;
    setGameState((n: SaveData) => {
      if (n.ownedCaveThemes.includes(id) || n.gems < cost) return n;
      return {
        ...n,
        gems: n.gems - cost,
        totalGemsSpent: n.totalGemsSpent + cost,
        ownedCaveThemes: [...n.ownedCaveThemes, id],
        selectedCaveTheme: id,
      };
    });
  }, []);

  // Switch to an already-owned cave theme.
  const selectCaveTheme = useCallback((id: string) => {
    setGameState((n: SaveData) => {
      if (!n.ownedCaveThemes.includes(id)) return n;
      if (n.selectedCaveTheme === id) return n;
      return { ...n, selectedCaveTheme: id };
    });
  }, []);

  // Tier-3 unlock: second gem upgrade line — each level doubles tap/answer
  // gains. Capped; over-cap purchases are no-ops.
  const buyClickBoost = useCallback(() => {
    setGameState((n: SaveData) => {
      if (n.clickBoostLevels >= CLICK_BOOST_MAX_LEVELS) return n;
      const cost = getClickBoostCost(n.clickBoostLevels);
      if (n.gems < cost) return n;
      return {
        ...n,
        clickBoostLevels: n.clickBoostLevels + 1,
        gems: n.gems - cost,
        totalGemsSpent: n.totalGemsSpent + cost,
      };
    });
  }, []);

  // Tier-3 unlock: third gem upgrade line — keep part of the combo on a
  // wrong answer / mine tap. Capped; over-cap purchases are no-ops.
  const buyComboResist = useCallback(() => {
    setGameState((n: SaveData) => {
      if (n.comboResistLevels >= COMBO_RESIST_MAX_LEVELS) return n;
      const cost = getComboResistCost(n.comboResistLevels);
      if (n.gems < cost) return n;
      return {
        ...n,
        comboResistLevels: n.comboResistLevels + 1,
        gems: n.gems - cost,
        totalGemsSpent: n.totalGemsSpent + cost,
      };
    });
  }, []);

  // Tier-3 unlock (plan §4.1 "New Shaft", §4.6): sink a new shaft — reset the
  // run's mining operation (minerals, all three miner types, click & miner
  // power) in exchange for banking a permanent multiplier based on lifetime
  // minerals. The banked level only ever moves UP toward the level the
  // player's lifetime has unlocked, and the action is a no-op unless there's
  // a strictly higher level to bank — so you can't spam the reset (each real
  // reset costs your run resources, and lifetime never decreases).
  // Gems, gem-chance levels, cosmetics, and every lifetime stat survive.
  const sinkNewShaft = useCallback(() => {
    setGameState((n: SaveData) => {
      const available = getPrestigeLevel(n.lifetimeMinerals);
      if (available <= n.prestigeLevel) return n; // nothing new to bank
      return {
        ...n,
        prestigeLevel: available,
        totalPrestiges: n.totalPrestiges + 1,
        minerals: 0,
        miners: 0,
        fastMiners: 0,
        legendaryMiners: 0,
        clickPower: 1,
        minerPower: 1,
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
    mineralsPerSec:
      getMineralsPerSec(
        gameState.miners,
        gameState.minerPower,
        gameState.fastMiners,
        gameState.legendaryMiners,
      ) * getPrestigeMultiplier(gameState.prestigeLevel),
    saveGame,
    addTapGain,
    applyAnswerReward,
    upgradePower,
    buyMiner,
    buyFastMiner,
    buyLegendaryMiner,
    buyGem,
    buyGemChance,
    buyClickBoost,
    buyComboResist,
    upgradeMinerPower,
    completeTiers,
    completeAchievements,
    buyCosmetic,
    selectCosmetic,
    rerollPlayerSeed,
    buyCaveTheme,
    selectCaveTheme,
    sinkNewShaft,
    resetGame,
  };
}
