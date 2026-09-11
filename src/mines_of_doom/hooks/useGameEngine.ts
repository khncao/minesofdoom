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
  BuyAllPlan,
  SaveData,
  buildSaveData,
  catchUpTicks,
  computeOfflineMinerals,
  computeOfflineTopUpMinerals,
  createEmptySaveData,
  gemMineralCost,
  mulFloats,
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
  activePlaySeconds,
  getMinerPowerUpgradeCost,
  getMinerUpgradeCost,
  getPrestigeLevel,
  getPrestigeMultiplier,
  lifetimeDelta,
  migrateSaveData,
  msPerTick,
  serializeSaveData,
  rollGem,
  saveDataKey,
} from "../game";
import { getAchievementBonus } from "../achievements";
import { getTierBonus } from "../goals";
import {
  getCaveThemeCost,
  getCostGems,
  isOutfitId,
  isPickaxeId,
} from "../cosmetics";
import {
  decodeSaveCode,
  encodeSaveCode,
  parseSaveCodeSettings,
  SaveCodePayload,
  SaveCodeSettings,
} from "../saveCode";
import type { CosmeticLine, CosmeticPurchasePath } from "../analytics";

/**
 * useGameEngine options (positional, back-compat with the two legacy
 * args): `onCosmeticPurchased` fires once per COMPLETED gem buy with the
 * line / item / path / post-spend gem balance (features.md pass-16
 * `cosmetics:analytics` — the IAP grant path fires from the caller's
 * grant effect instead, with path "iap").
 */
export type CosmeticPurchaseEventInput = {
  line: CosmeticLine;
  id: string;
  path: CosmeticPurchasePath;
  gems: number;
};

export function useGameEngine(
  displayMessage: (message: string, timeout: number) => void,
  getAutosaveSeconds?: () => number,
  onCosmeticPurchased?: (ev: CosmeticPurchaseEventInput) => void,
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
  // Lifetime ACTIVE play-time clock, whole seconds (todo: statistics
  // detail). Authoritative copy of SaveData.playSeconds while the app
  // runs: the tick loop advances it once per fired interval while the app
  // is active, and only for live ticks (activePlaySeconds) — a catch-up
  // fire after a background gap pays the mineral catch-up but never books
  // away time as play time (docs/features.md pass 17, offline:active-
  // clock). saveGame flushes it into state + the serialized save. Kept
  // out of state between saves so a no-miner idle session doesn't re-
  // render the tree once a second.
  const playSecondsRef = useRef(0);
  // Whether the app is foregrounded/visible RIGHT NOW: gates the play-time
  // clock (above) so backgrounded-app / hidden-tab ticks book zero. The
  // interval keeps firing in both cases (mineral catch-up still banks), so
  // the clock needs its own liveness signal. Lazy init: on web a tab can
  // mount hidden (restored tab group), on native cold start is active.
  const activeRef = useRef(
    Platform.OS === "web" && typeof document !== "undefined"
      ? document.visibilityState === "visible"
      : true,
  );
  // Stale-save flag (plan §2.1 "save affordance"): true whenever state
  // has changed since the last successful write. This is accurate, not
  // aspirational — with miners running the state changes every tick, so
  // the indicator stays "stale" until the next autosave/manual save.
  const [saveDirty, setSaveDirty] = useState(false);
  // True once the stored save has been read + migrated (or confirmed
  // absent). MinesOfDoom renders a loading state until this flips, so a
  // slow AsyncStorage cold start doesn't flash the zeroed game state.
  const [isLoaded, setIsLoaded] = useState(false);
  // True when a stored save EXISTS but couldn't be loaded (storage read
  // error, unparseable JSON, non-object). Drives the cloud-save launch-
  // recovery path (docs/store-integration.md §3): a fresh
  // install (no stored save) must NOT be restored over from the cloud.
  const [saveLoadFailed, setSaveLoadFailed] = useState(false);
  // "Watch to double offline earnings" (plan §5.1): when a load produces a
  // positive offline haul, the EXTRA half a rewarded ad would grant is held
  // here as a one-shot offer — consumed by claimOfflineDouble, or replaced
  // by the next load's haul. Ref + state: the ref lets the stable claim
  // callback consume it synchronously (a fast second tap can't pay twice),
  // the state drives the UI offer.
  const offlineDoubleRef = useRef<bigint | null>(null);
  const [offlineDouble, setOfflineDouble] = useState<bigint | null>(null);
  // "Instant offline top-up" (plan §5.1): when the away time hit the 8h cap,
  // the minerals WITHHELD beyond it (themselves capped at +2h) are held as
  // a one-shot offer a completed ad can unlock — same ref+state pattern as
  // offlineDouble (ref for synchronous one-shot claiming, state for UI).
  const offlineTopUpRef = useRef<bigint | null>(null);
  const [offlineTopUp, setOfflineTopUp] = useState<bigint | null>(null);

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
        offlineMinerals: bigint,
        offlineTopUp: bigint,
      ) => {
        loadedRef.current = true;
        if (cancelled) return;
        setIsLoaded(true);
        if (data == null) return;
        setGameState(data);
        startTime.current = data.startTime;
        playSecondsRef.current = data.playSeconds;
        if (offlineMinerals > 0n) {
          offlineDoubleRef.current = offlineMinerals;
          setOfflineDouble(offlineMinerals);
          displayMessage(
            t("toast.welcomeBack", {
              count: formatNumber(offlineMinerals),
            }),
            6000,
          );
        }
        if (offlineTopUp > 0n) {
          offlineTopUpRef.current = offlineTopUp;
          setOfflineTopUp(offlineTopUp);
        }
      };

      let raw: string | null;
      try {
        raw = await getSaveData();
      } catch (e) {
        console.warn("Failed to read save data", e);
        // The read itself failed — a save probably exists but is unreadable;
        // flag it so the cloud-recovery path gets a chance.
        setSaveLoadFailed(true);
        return finish(null, 0n, 0n);
      }
      if (raw == null) {
        return finish(null, 0n, 0n);
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
        setSaveLoadFailed(true);
        return finish(null, 0n, 0n);
      }
      if (parsed == null || typeof parsed !== "object") {
        setSaveLoadFailed(true);
        return finish(null, 0n, 0n);
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
    // Flush the play-time clock into state (bails out when already current)
    // and serialize it explicitly, so every save path (autosave, background,
    // pagehide, manual, cloud) persists the clock as of NOW even though the
    // state copy in the ref may not have re-rendered with the flush yet.
    const playSeconds = playSecondsRef.current;
    setGameState((n: SaveData) =>
      n.playSeconds === playSeconds ? n : { ...n, playSeconds },
    );
    const data = serializeSaveData({
      ...gameStateRef.current,
      saveTime: Date.now(),
      playSeconds,
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

  // Track app activity for the play-time clock (activeRef): AppState covers
  // native; web gets a direct visibilitychange listener as belt-and-braces
  // (expo's AppState maps it too, but not every web environment fires it
  // for tab switching).
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (status) => {
      activeRef.current = status === "active";
    });
    let onVisibility: (() => void) | null = null;
    if (Platform.OS === "web") {
      onVisibility = () => {
        activeRef.current = document.visibilityState === "visible";
      };
      document.addEventListener("visibilitychange", onVisibility);
    }
    return () => {
      subscription.remove();
      if (onVisibility != null) {
        document.removeEventListener("visibilitychange", onVisibility);
      }
    };
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
      const elapsed = catchUpTicks(last, now);
      last = now;
      if (elapsed < 1) {
        return;
      }
      tickCountRef.current += elapsed;
      // Active play time only: a catch-up fire after a background gap
      // reports the whole absence as `elapsed`, so the clock takes the
      // capped live-tick contribution, never the raw elapsed.
      playSecondsRef.current += activePlaySeconds(elapsed, activeRef.current);
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
          const income = mulFloats(
            BigInt(
              getMineralsPerSec(
                n.miners,
                n.minerPower,
                n.fastMiners,
                n.legendaryMiners,
              ),
            ) * BigInt(elapsed),
            [getPrestigeMultiplier(n.prestigeLevel)],
          );
          if (income <= 0n) return n;
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
  const addTapGain = useCallback((gain: bigint) => {
    if (gain > 0n) {
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
    if (pending == null || pending <= 0n) return;
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
    if (pending == null || pending <= 0n) return;
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
        // tier boundary, by at most one gain event). Depth is lifetime-mining
        // based, not balance based, so spending can't pull the bonus back
        // down mid-answer.
        const bonus = getDepthTier(getDepth(n.lifetimeMinerals)).clickBonus;
        const prestige = getPrestigeMultiplier(n.prestigeLevel);
        // Click x2 upgrade (tier 3): doubles tap/answer gains per level.
        const clickBoost = getClickBoostMultiplier(n.clickBoostLevels);
        // Integer factors first (exact), then the float multipliers through
        // mulFloats (see game.ts): value × click power × combo × boost ×
        // depth bonus × prestige.
        const gained = mulFloats(
          BigInt(Math.max(1, value)) *
            BigInt(n.clickPower) *
            BigInt(comboMultiplier) *
            BigInt(clickBoost),
          [bonus, prestige],
        );
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
        minerals: n.minerals - BigInt(getClickUpgradeCost(n.clickPower)),
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
        minerals: n.minerals - BigInt(gemMineralCost),
        gems: n.gems + 1,
        totalGemsMinted: n.totalGemsMinted + 1,
      };
    });
  }, []);

  // Tier-1 unlock: raise each miner's output (unlocks via goals.ts).
  const upgradeMinerPower = useCallback(() => {
    setGameState((n: SaveData) => {
      const cost = getMinerPowerUpgradeCost(n.minerPower);
      if (n.minerals < BigInt(cost)) return n;
      return {
        ...n,
        minerPower: n.minerPower + 1,
        minerals: n.minerals - BigInt(cost),
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
      const bonus = BigInt(getTierBonus(fresh));
      return {
        ...n,
        minerals: n.minerals + bonus,
        lifetimeMinerals: n.lifetimeMinerals + bonus,
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
      const bonus = BigInt(getAchievementBonus(fresh));
      return {
        ...n,
        minerals: n.minerals + bonus,
        lifetimeMinerals: n.lifetimeMinerals + bonus,
        completedAchievements: [...n.completedAchievements, ...fresh],
      };
    });
  }, []);

  // The analytics callback is read through a ref so buyCosmetic /
  // buyCaveTheme stay referentially stable (the caller's callback is
  // stable by contract, but the ref keeps the engine's deps at []).
  const onCosmeticPurchasedRef = useRef(onCosmeticPurchased);
  onCosmeticPurchasedRef.current = onCosmeticPurchased;

  // Buy a cosmetic (outfit or pickaxe) with gems; auto-selects it. Unknown
  // ids and unaffordable prices are no-ops (button state may be stale).
  const buyCosmetic = useCallback((id: string) => {
    const cost = getCostGems(id);
    if (cost == null) return;
    // Mirror of the updater's guard against the last-rendered state:
    // gems only ever RISE outside a buy and ownership is never removed,
    // so if this check passes the updater below will too — the analytics
    // event is only fired when the buy actually lands.
    const cur = gameStateRef.current;
    const willBuy = !cur.ownedCosmetics.includes(id) && cur.gems >= cost;
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
    if (willBuy) {
      onCosmeticPurchasedRef.current?.({
        line: isOutfitId(id) ? "outfit" : "pickaxe",
        id,
        path: "gems",
        gems: cur.gems - cost,
      });
    }
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
    // Mirror guard, same soundness argument as buyCosmetic.
    const cur = gameStateRef.current;
    const willBuy = !cur.ownedCaveThemes.includes(id) && cur.gems >= cost;
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
    if (willBuy) {
      onCosmeticPurchasedRef.current?.({
        line: "theme",
        id,
        path: "gems",
        gems: cur.gems - cost,
      });
    }
  }, []);

  // Custom-skin gem buy (todo: "Custom skinning" — one-time
  // 250-gem unlock, the priciest line): spends the gems and reports
  // success so the caller — the device-local skin slot in useCustomSkin,
  // which the engine deliberately does not own — can unlock. Mirror-
  // guarded like the other buys; the updater re-checks the balance
  // against the live state (fast taps).
  const buyCustomSkin = useCallback((cost: number): boolean => {
    if (gameStateRef.current.gems < cost) {
      return false;
    }
    setGameState((n: SaveData) =>
      n.gems < cost
        ? n
        : {
            ...n,
            gems: n.gems - cost,
            totalGemsSpent: n.totalGemsSpent + cost,
          },
    );
    return true;
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

  // "Buy all" for the mineral-upgrade lines (todo: "add buy all mineral
  // upgrades button"): applies a BuyAllPlan computed by computeBuyAll.
  // Every level is re-checked against the LIVE state per level, so a stale
  // or over-stated plan can never overpay — it simply stops where money
  // runs out. The counts are what the UI's label promised, so the total
  // spent always matches the cost the player tapped.
  const buyAllMinerals = useCallback((plan: BuyAllPlan) => {
    setGameState((n: SaveData) => {
      let minerals = n.minerals;
      let clickPower = n.clickPower;
      for (let i = 0; i < plan.clickPower; i++) {
        const cost = getClickUpgradeCost(clickPower);
        if (!Number.isFinite(cost) || minerals < BigInt(cost)) break;
        minerals -= BigInt(cost);
        clickPower += 1;
      }
      let minerPower = n.minerPower;
      for (let i = 0; i < plan.minerPower; i++) {
        const cost = getMinerPowerUpgradeCost(minerPower);
        if (!Number.isFinite(cost) || minerals < BigInt(cost)) break;
        minerals -= BigInt(cost);
        minerPower += 1;
      }
      if (clickPower === n.clickPower && minerPower === n.minerPower) {
        return n;
      }
      return { ...n, minerals, clickPower, minerPower };
    });
  }, []);

  // "Buy all" for the gem-upgrade lines (todo: "add buy all gem upgrades
  // button") — same per-level re-check as buyAllMinerals.
  const buyAllGems = useCallback((plan: BuyAllPlan) => {
    setGameState((n: SaveData) => {
      let gems = n.gems;
      let spent = 0;
      let miners = n.miners;
      for (let i = 0; i < plan.miners; i++) {
        const cost = getMinerUpgradeCost(miners);
        if (!Number.isFinite(cost) || gems < cost) break;
        gems -= cost;
        spent += cost;
        miners += 1;
      }
      let fastMiners = n.fastMiners;
      for (let i = 0; i < plan.fastMiners; i++) {
        const cost = getFastMinerCost(fastMiners);
        if (!Number.isFinite(cost) || gems < cost) break;
        gems -= cost;
        spent += cost;
        fastMiners += 1;
      }
      let legendaryMiners = n.legendaryMiners;
      for (let i = 0; i < plan.legendaryMiners; i++) {
        const cost = getLegendaryMinerCost(legendaryMiners);
        if (!Number.isFinite(cost) || gems < cost) break;
        gems -= cost;
        spent += cost;
        legendaryMiners += 1;
      }
      let gemChanceLevels = n.gemChanceLevels;
      for (let i = 0; i < plan.gemChance; i++) {
        if (gemChanceLevels >= GEM_CHANCE_MAX_LEVELS) break;
        const cost = getGemChanceCost(gemChanceLevels);
        if (!Number.isFinite(cost) || gems < cost) break;
        gems -= cost;
        spent += cost;
        gemChanceLevels += 1;
      }
      let clickBoostLevels = n.clickBoostLevels;
      for (let i = 0; i < plan.clickBoost; i++) {
        if (clickBoostLevels >= CLICK_BOOST_MAX_LEVELS) break;
        const cost = getClickBoostCost(clickBoostLevels);
        if (!Number.isFinite(cost) || gems < cost) break;
        gems -= cost;
        spent += cost;
        clickBoostLevels += 1;
      }
      let comboResistLevels = n.comboResistLevels;
      for (let i = 0; i < plan.comboResist; i++) {
        if (comboResistLevels >= COMBO_RESIST_MAX_LEVELS) break;
        const cost = getComboResistCost(comboResistLevels);
        if (!Number.isFinite(cost) || gems < cost) break;
        gems -= cost;
        spent += cost;
        comboResistLevels += 1;
      }
      if (spent === 0) return n;
      return {
        ...n,
        gems,
        totalGemsSpent: n.totalGemsSpent + spent,
        miners,
        minersOwnedEver: Math.max(n.minersOwnedEver, miners),
        fastMiners,
        legendaryMiners,
        gemChanceLevels,
        clickBoostLevels,
        comboResistLevels,
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
        minerals: 0n,
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
  // The optional settings ride-along args (settings portability): the
  // caller (MinesOfDoom) threads the live settings stores in; the engine
  // itself stays settings-agnostic.
  const exportSaveCode = useCallback(
    (
      settings?: Partial<SaveCodeSettings["settings"]>,
      equationSettings?: Partial<SaveCodeSettings["equationSettings"]>,
      onboardingDone?: boolean,
    ): string =>
      encodeSaveCode(
        gameStateRef.current,
        settings,
        equationSettings,
        onboardingDone,
      ),
    [],
  );

  // Returns the decoded payload (game save + optional settings ride-along)
  // or null; falsy = rejected, so `if (!importSaveCode(code))` still reads.
  const importSaveCode = useCallback((code: string): SaveCodePayload | null => {
    if (!loadedRef.current) return null;
    const now = Date.now();
    const decoded = decodeSaveCode(code, now);
    if (decoded == null) return null;
    const { settings, equationSettings, onboardingDone, ...save } = decoded;
    void settings;
    void equationSettings;
    void onboardingDone; // ride-along for the caller (MinesOfDoom)
    const offline = computeOfflineMinerals(
      save.miners,
      save.minerPower,
      save.fastMiners,
      save.saveTime,
      now,
      getPrestigeMultiplier(save.prestigeLevel),
      save.legendaryMiners,
    );
    const topUp = computeOfflineTopUpMinerals(
      save.miners,
      save.minerPower,
      save.fastMiners,
      save.saveTime,
      now,
      getPrestigeMultiplier(save.prestigeLevel),
      save.legendaryMiners,
    );
    setGameState({
      ...save,
      minerals: save.minerals + offline,
      lifetimeMinerals: save.lifetimeMinerals + offline,
    });
    playSecondsRef.current = save.playSeconds;
    // An import replaces the whole run: the previous session's offers are
    // stale from this moment on. Clear the double (an import never re-
    // offers it — the base haul is already paid above) and replace the
    // top-up with the imported save's, which is none when it didn't hit
    // the 8h cap.
    offlineDoubleRef.current = null;
    setOfflineDouble(null);
    if (topUp > 0n) {
      offlineTopUpRef.current = topUp;
      setOfflineTopUp(topUp);
    } else {
      offlineTopUpRef.current = null;
      setOfflineTopUp(null);
    }
    return decoded;
  }, []);

  // Cloud-backup restore (docs/store-integration.md §3):
  // import a raw serialized save blob (the cloud store's `blob` field) and
  // a save code's JSON through the SAME defensive pipeline the storage
  // loader uses — JSON parse, versioned migration, clamping build, then
  // the imported save's offline earnings paid up front. Returns false for
  // an unparseable blob so the caller can toast a failure; the caller
  // (useCloudSave) is the only consumer. `onSettings` receives the
  // validated settings ride-along (settings portability) when the blob
  // carries one, so the settings owner (MinesOfDoom) can apply it without
  // the engine touching the settings stores.
  const restoreFromBlob = useCallback(
    (
      blob: string,
      onSettings?: (settings: SaveCodeSettings) => void,
    ): boolean => {
      if (!loadedRef.current) return false;
      let parsed: unknown;
      try {
        parsed = JSON.parse(blob);
      } catch {
        return false;
      }
      if (
        parsed == null ||
        typeof parsed !== "object" ||
        Array.isArray(parsed)
      ) {
        return false;
      }
      const now = Date.now();
      const data = buildSaveData(
        migrateSaveData(parsed as Record<string, unknown>),
        now,
      );
      const rideAlong = parseSaveCodeSettings(
        parsed as Record<string, unknown>,
      );
      if (
        onSettings != null &&
        (rideAlong.settings != null || rideAlong.equationSettings != null)
      ) {
        onSettings(rideAlong);
      }
      const offline = computeOfflineMinerals(
        data.miners,
        data.minerPower,
        data.fastMiners,
        data.saveTime,
        now,
        getPrestigeMultiplier(data.prestigeLevel),
        data.legendaryMiners,
      );
      const topUp = computeOfflineTopUpMinerals(
        data.miners,
        data.minerPower,
        data.fastMiners,
        data.saveTime,
        now,
        getPrestigeMultiplier(data.prestigeLevel),
        data.legendaryMiners,
      );
      setGameState({
        ...data,
        minerals: data.minerals + offline,
        lifetimeMinerals: data.lifetimeMinerals + offline,
      });
      playSecondsRef.current = data.playSeconds;
      // Same stale-offer hygiene as importSaveCode: a restore replaces the
      // whole run, so the previous session's offers are stale from this
      // moment on.
      offlineDoubleRef.current = null;
      setOfflineDouble(null);
      if (topUp > 0n) {
        offlineTopUpRef.current = topUp;
        setOfflineTopUp(topUp);
      } else {
        offlineTopUpRef.current = null;
        setOfflineTopUp(null);
      }
      return true;
    },
    [],
  );

  const resetGame = useCallback(() => {
    setGameState(createEmptySaveData());
    playSecondsRef.current = 0;
    // The reset replaces the whole run, so the pending ad offers computed
    // from the discarded run's offline haul must go with it — otherwise the
    // panel keeps showing them and a claim would pay the stale haul against
    // the fresh save.
    offlineDoubleRef.current = null;
    offlineTopUpRef.current = null;
    setOfflineDouble(null);
    setOfflineTopUp(null);
    // Clear async first; the next periodic save rewrites a fresh state, so
    // even if removal fails the stored save converges to the reset state.
    AsyncStorage.removeItem(saveDataKey).catch((e) => {
      console.warn("Failed to remove save data", e);
    });
  }, []);

  return {
    gameState,
    onTick,
    // Lifetime-mining based (see getDepth): the cave only ever descends —
    // spending minerals never scrolls it back up.
    depth: getDepth(gameState.lifetimeMinerals),
    isLoaded,
    saveLoadFailed,
    restoreFromBlob,
    mineralsPerSec: mulFloats(
      BigInt(
        getMineralsPerSec(
          gameState.miners,
          gameState.minerPower,
          gameState.fastMiners,
          gameState.legendaryMiners,
        ),
      ),
      [getPrestigeMultiplier(gameState.prestigeLevel)],
    ),
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
    buyAllMinerals,
    buyAllGems,
    upgradeMinerPower,
    completeTiers,
    completeAchievements,
    buyCosmetic,
    selectCosmetic,
    rerollPlayerSeed,
    buyCaveTheme,
    buyCustomSkin,
    selectCaveTheme,
    grantIapCosmetics,
    sinkNewShaft,
    resetGame,
    exportSaveCode,
    importSaveCode,
  };
}
