import { AppState, Platform } from "react-native";
import AsyncStorage, {
  useAsyncStorage,
} from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "src/hooks/useI18n";
import { formatNumber } from "src/utils/format";
import {
  CLICK_BOOST_MAX_LEVELS,
  COMBO_RESIST_MAX_LEVELS,
  GEM_CHANCE_MAX_LEVELS,
  SaveData,
  buildSaveData,
  computeOfflineMinerals,
  computeOfflineTopUpMinerals,
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
} from "../game";
import { getAchievementBonus } from "../achievements";
import { getTierBonus } from "../goals";
import { getCaveThemeCost, getCostGems, isOutfitId, isPickaxeId } from "../cosmetics";
import { decodeSaveCode, encodeSaveCode } from "../saveCode";

export function useGameEngine(
  displayMessage: (message: string, timeout: number) => void,
  getAutosaveSeconds?: () => number,
) {
  const startTime = useRef(Date.now());
  const [gameState, setGameState] = useState<SaveData>(createEmptySaveData);
  const { t } = useI18n();
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
  // Stale-save flag (plan §2.1 "save affordance"): true whenever state
  // has changed since the last successful write. This is accurate, not
  // aspirational — with miners running the state changes every tick, so
  // the indicator stays "stale" until the next autosave/manual save.
  const [saveDirty, setSaveDirty] = useState(false);
  // True once the stored save has been read + migrated (or confirmed
  // absent). MinesOfDoom renders a loading state until this flips, so a
  // slow AsyncStorage cold start doesn't flash the zeroed game state.
  const [isLoaded, setIsLoaded] = useState(false);
  // "Watch to double offline earnings" (plan §5.1): when a load produces a
  // positive offline haul, the EXTRA half a rewarded ad would grant is held
  // here as a one-shot offer — consumed by claimOfflineDouble, or replaced
  // by the next load's haul. Ref + state: the ref lets the stable claim
  // callback consume it synchronously (a fast second tap can't pay twice),
  // the state drives the UI offer.
  const offlineDoubleRef = useRef<number | null>(null);
  const [offlineDouble, setOfflineDouble] = useState<number | null>(null);
  // "Instant offline top-up" (plan §5.1): when the away time hit the 8h cap,
  // the minerals WITHHELD beyond it (themselves capped at +2h) are held as
  // a one-shot offer a completed ad can unlock — same ref+state pattern as
  // offlineDouble (ref for synchronous one-shot claiming, state for UI).
  const offlineTopUpRef = useRef<number | null>(null);
  const [offlineTopUp, setOfflineTopUp] = useState<number | null>(null);

  // Mark dirty on any state change after load. setSaveDirty(true) is a
  // no-op re-render when the flag is already true (React bails out).
  useEffect(() => {
    if (loadedRef.current) setSaveDirty(true);
  }, [gameState]);

  // Load stored data. Every step is defensive: a throw here used to become an
  // unhandled promise rejection and leave the game stuck on the empty state.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const finish = (
        data: SaveData | null,
        offlineMinerals: number,
        offlineTopUp: number,
      ) => {
        loadedRef.current = true;
        if (cancelled) return;
        setIsLoaded(true);
        if (data == null) return;
        setGameState(data);
        startTime.current = data.startTime;
        if (offlineMinerals > 0) {
          offlineDoubleRef.current = offlineMinerals;
          setOfflineDouble(offlineMinerals);
          displayMessage(
            t("toast.welcomeBack", {
              count: formatNumber(offlineMinerals),
            }),
            6000,
          );
        }
        if (offlineTopUp > 0) {
          offlineTopUpRef.current = offlineTopUp;
          setOfflineTopUp(offlineTopUp);
        }
      };

      let raw: string | null;
      try {
        raw = await getSaveData();
      } catch (e) {
        console.warn("Failed to read save data", e);
        return finish(null, 0, 0);
      }
      if (raw == null) {
        return finish(null, 0, 0);
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
        return finish(null, 0, 0);
      }
      if (parsed == null || typeof parsed !== "object") {
        return finish(null, 0, 0);
      }

      // Run versioned migrations, then build the save defensively (see
      // buildSaveData in game.ts; shared with the save-code importer so
      // both entry points validate identically).
      const migrated = migrateSaveData(parsed as Record<string, unknown>);
      const now = Date.now();
      const saveData = buildSaveData(migrated, now);

      const offlineMinerals = computeOfflineMinerals(
        saveData.miners,
        saveData.minerPower,
        saveData.fastMiners,
        saveData.saveTime,
        now,
        getPrestigeMultiplier(saveData.prestigeLevel),
        saveData.legendaryMiners,
      );
      const offlineTopUp = computeOfflineTopUpMinerals(
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
        offlineTopUp,
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
    setSaveData(data)
      .then(() => setSaveDirty(false))
      .catch((e) => {
        // A failed write (quota, storage full, ...) would otherwise silently
        // lose everything since the last successful save.
        console.warn("Failed to save game", e);
        displayMessage(t("toast.saveFailed"), 4000);
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

  // Grant gems outside the mineral economy (plan §5.1: rewarded-ad gem
  // rolls). Flows through the same lifetime-stats path as other gem
  // mints, so lifetime gem accounting stays exact.
  const grantGems = useCallback((count: number) => {
    const n = Math.max(0, Math.floor(count));
    if (n <= 0) return;
    setGameState((s: SaveData) => ({
      ...s,
      gems: s.gems + n,
      ...lifetimeDelta(s, { gemsMinted: n }),
    }));
  }, []);

  // Consume the pending "watch to double" offer (see offlineDoubleRef):
  // grants the extra half of the last offline haul — the base amount was
  // already paid at load — and clears the offer. No-op when nothing is
  // pending (offer already claimed, or no offline haul to double).
  const claimOfflineDouble = useCallback(() => {
    const pending = offlineDoubleRef.current;
    if (pending == null || pending <= 0) return;
    offlineDoubleRef.current = null;
    setOfflineDouble(null);
    setGameState((s: SaveData) => ({
      ...s,
      minerals: s.minerals + pending,
      ...lifetimeDelta(s, { minerals: pending }),
    }));
  }, []);

  // Consume the pending "+2h offline top-up" offer (see offlineTopUpRef):
  // grants the minerals withheld beyond the 8h cap — the base haul was
  // already paid at load — and clears the offer. No-op when nothing is
  // pending (offer already claimed, or the haul never hit the cap).
  const claimOfflineTopUp = useCallback(() => {
    const pending = offlineTopUpRef.current;
    if (pending == null || pending <= 0) return;
    offlineTopUpRef.current = null;
    setOfflineTopUp(null);
    setGameState((s: SaveData) => ({
      ...s,
      minerals: s.minerals + pending,
      ...lifetimeDelta(s, { minerals: pending }),
    }));
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

  // IAP cosmetic packs (plan §5.2): the store validated the purchase, so
  // the granted cosmetics join the save's owned lists at no gem cost and
  // without touching the selection. Idempotent — re-grants (load, restore,
  // save import, reset) are no-ops for ids the save already owns.
  const grantIapCosmetics = useCallback(
    (cosmeticIds: string[], caveThemeIds: string[]) => {
      if (cosmeticIds.length === 0 && caveThemeIds.length === 0) return;
      setGameState((n: SaveData) => {
        const freshCosmetics = cosmeticIds.filter(
          (id) => !n.ownedCosmetics.includes(id),
        );
        const freshThemes = caveThemeIds.filter(
          (id) => !n.ownedCaveThemes.includes(id),
        );
        if (freshCosmetics.length === 0 && freshThemes.length === 0) {
          return n;
        }
        return {
          ...n,
          ownedCosmetics: [...n.ownedCosmetics, ...freshCosmetics],
          ownedCaveThemes: [...n.ownedCaveThemes, ...freshThemes],
        };
      });
    },
    [],
  );

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

  // Shareable save code (plan §4.3): the whole save serialized to a
  // base64 string. Export reads the latest state from the ref so the
  // callback stays stable; import validates through the same defensive
  // builder the storage loader uses, and pays out the imported save's
  // offline earnings up front (like a cold load would on next launch).
  const exportSaveCode = useCallback((): string => {
    return encodeSaveCode(gameStateRef.current);
  }, []);

  const importSaveCode = useCallback((code: string): boolean => {
    if (!loadedRef.current) return false;
    const now = Date.now();
    const decoded = decodeSaveCode(code, now);
    if (decoded == null) return false;
    const offline = computeOfflineMinerals(
      decoded.miners,
      decoded.minerPower,
      decoded.fastMiners,
      decoded.saveTime,
      now,
      getPrestigeMultiplier(decoded.prestigeLevel),
      decoded.legendaryMiners,
    );
    const topUp = computeOfflineTopUpMinerals(
      decoded.miners,
      decoded.minerPower,
      decoded.fastMiners,
      decoded.saveTime,
      now,
      getPrestigeMultiplier(decoded.prestigeLevel),
      decoded.legendaryMiners,
    );
    setGameState({
      ...decoded,
      minerals: decoded.minerals + offline,
      lifetimeMinerals: decoded.lifetimeMinerals + offline,
    });
    if (topUp > 0) {
      offlineTopUpRef.current = topUp;
      setOfflineTopUp(topUp);
    }
    return true;
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
    isLoaded,
    mineralsPerSec:
      getMineralsPerSec(
        gameState.miners,
        gameState.minerPower,
        gameState.fastMiners,
        gameState.legendaryMiners,
      ) * getPrestigeMultiplier(gameState.prestigeLevel),
    saveGame,
    saveDirty,
    addTapGain,
    grantGems,
    offlineDouble,
    claimOfflineDouble,
    offlineTopUp,
    claimOfflineTopUp,
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
    grantIapCosmetics,
    sinkNewShaft,
    resetGame,
    exportSaveCode,
    importSaveCode,
  };
}
