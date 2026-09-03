import { StatusBar } from "expo-status-bar";
import { MutableRefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useContent, useI18n } from "src/hooks/useI18n";
import { useLocalStorage } from "src/hooks/useLocalStorage";
import type { DebrisParticlesRef } from "src/components/DebrisParticles";
import type { BlockBreakRef } from "src/components/BlockBreak";
import { Context } from "./Context";
import { getCaveTheme, getThemeTint } from "./cosmetics";
import { styles } from "./styles";
import DepthBanner from "./components/DepthBanner";
import EquationDisplay from "./components/EquationDisplay";
import AnswerInput from "./components/AnswerInput";
import ComboIndicator from "./components/ComboIndicator";
import PurchaseButtons from "./components/PurchaseButtons";
import MiningCanvas from "./components/MiningCanvas";
import MenuPanel from "./components/MenuPanel";
import SavePill from "./components/SavePill";
import OnboardingOverlay from "./components/OnboardingOverlay";
import DailyBonusButton from "./components/DailyBonusButton";
import {
  ALL_PURCHASE_IDS,
  defaultSettingsData,
  saveVersion,
  serializeSaveData,
  getComboMultiplier,
  getComboRetention,
  getDepthTier,
  getDepthTierProgress,
  getPrestigeMultiplier,
  getResistantComboReset,
  getClickBoostMultiplier,
  getVisiblePurchases,
  SettingsData,
  STREAK_MODE_THRESHOLD,
  mulFloats,
} from "./game";
import {
  getAchievement,
  getAchievementBonus,
  getCompletedAchievementIds,
} from "./achievements";
import {
  CAVE_THEME_UNLOCK_TIER,
  FAST_MINER_UNLOCK_TIER,
  GOAL_TIERS,
  HARD_MODE_UNLOCK_TIER,
  LEGENDARY_MINER_UNLOCK_TIER,
  MINER_POWER_UNLOCK_TIER,
  PRESTIGE_UNLOCK_TIER,
  getCompletedTierIds,
} from "./goals";
import { formatNumber } from "src/utils/format";
import { emojis } from "src/utils/graphics/emojis";
import type { FloatingTextRef } from "./components/FloatingTextLayer";
import { useMessages } from "./hooks/useMessages";
import { useGameEngine } from "./hooks/useGameEngine";
import { useSettings } from "./hooks/useSettings";
import { useSounds } from "./hooks/useSounds";
import { useCombo } from "./hooks/useCombo";
import { useShakeInput } from "./hooks/useShakeInput";
import { useMineTaps } from "./hooks/useMineTaps";
import { useAccessibilityReduceMotion } from "./hooks/useAccessibilityReduceMotion";
import { useEquations } from "./hooks/useEquations";
import { noteCrashEvent, setCrashContextState } from "./crashContext";
import { useDailyBonus } from "./hooks/useDailyBonus";
import { useAnalytics } from "./hooks/useAnalytics";
import { useAdRewards } from "./hooks/useAdRewards";
import { useCloudSave, type CloudSaveSettingsProps } from "./hooks/useCloudSave";
import { selectCloudSaveProvider } from "./cloudSave";
import { useLeaderboard } from "./hooks/useLeaderboard";
import { selectLeaderboardProvider } from "./leaderboard";
import LeaderboardPanel from "./components/LeaderboardPanel";
import { selectAdProvider, COMBO_SAVE_WINDOW_MS, type AdKind } from "./ads";
import { useIap } from "./hooks/useIap";
import {
  IapProductId,
  IAP_PRODUCTS,
  hasIapEntitlement,
  iapGrantCosmeticIds,
  selectIapProvider,
} from "./iaps";
import LoadingScreen from "./components/LoadingScreen";
import AdRewardsPanel from "./components/AdRewardsPanel";
import IapPanel from "./components/IapPanel";

export default function MinesOfDoom() {
  // currently doesn't mute android touch sounds, but can in the future
  const [mute, setMute] = useLocalStorage<boolean>("mute", false);

  // On-screen keypad (plan §2.1): HIDDEN for now (plan "Adjust",
  // 2026-09-02) — the stored `onScreenKeypad` value and the NumericKeypad
  // wiring stay for revival; AnswerInput receives a literal false and no
  // longer renders its toggle.

  // First-run onboarding (plan §2.1): shown until dismissed; the flag
  // persists in AsyncStorage so a skip/finish never resurfaces. The
  // loading flag hides the overlay until the stored value has been read,
  // so returning players don't flash it for a frame on cold start.
  const [onboardingDone, setOnboardingDone, onboardingLoading] =
    useLocalStorage<boolean>("onboardingDone", false);

  // Purchase section collapsed state (plan "Adjust"): the upgrade list can
  // be hidden entirely to give the cave canvas the whole mid-screen. Like
  // `mute`, it's a plain display preference persisted in AsyncStorage.
  const [hidePurchases, setHidePurchases] = useLocalStorage<boolean>(
    "hidePurchases",
    false,
  );

  const { showMessage, displayMessage } = useMessages();
  // Autosave cadence (seconds) read by the game loop; kept in a ref so the
  // loop always sees the value without re-subscribing, and updated once
  // settings have loaded below.
  const autosaveSecondsRef = useRef(defaultSettingsData.autosave);
  const {
    gameState,
    onTick,
    depth,
    mineralsPerSec,
    isLoaded,
    saveGame,
    saveDirty,
    addTapGain,
    applyAnswerReward,
    grantGems,
    offlineDouble,
    claimOfflineDouble,
    offlineTopUp,
    claimOfflineTopUp,
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
    saveLoadFailed,
    restoreFromBlob,
  } = useGameEngine(displayMessage, () => autosaveSecondsRef.current);
  // Language: useI18n persists the player's choice ("auto" | locale) and
  // drives the live locale store, so every useT() consumer re-renders on a
  // change. The picker itself lives in Settings.
  const { t } = useI18n();
  const content = useContent();
  const depthTier = getDepthTier(depth);
  // Tier-4 cave theme recolors the depth tint (the natural theme's palette
  // is exactly the depth tint, so it's the unchanged look by default).
  const caveTint = getThemeTint(
    getCaveTheme(gameState.selectedCaveTheme),
    depthTier.id,
  );
  // Depth-tier click bonus + banked prestige multiplier + the tier-3 click
  // x2 upgrade included: this is the value taps and answers actually pay
  // with (the engine applies the same multipliers authoritatively), so
  // pending-gain / floating text agree.
  // Integer factors first (click power × click-x2 boost), then the float
  // multipliers through mulFloats — exactly what the engine's
  // applyAnswerReward pays, so pending-gain / floating text agree.
  const effectiveClickPower = mulFloats(
    BigInt(gameState.clickPower) * BigInt(getClickBoostMultiplier(gameState.clickBoostLevels)),
    [depthTier.clickBonus, getPrestigeMultiplier(gameState.prestigeLevel)],
  );
  const {
    settingsData,
    setSettingsData,
    equationSettings,
    setEquationSettings,
    handleSaveSettings,
  } = useSettings({ saveGame, displayMessage });

  // Stable so the memoized SettingsPanel doesn't re-render every tick.
  const handleSettingsDataChange = useCallback(
    (newSettings: SettingsData) => setSettingsData(newSettings),
    [setSettingsData],
  );

  // Purchase-button visibility (plan "Adjust"): by default only the core
  // buttons + anything the lifetime economy has ever reached (a sunk shaft
  // can't hide buttons again); the settings toggle forces the full list.
  const minerPowerUnlocked = gameState.completedTiers.includes(
    MINER_POWER_UNLOCK_TIER,
  );
  const fastMinerUnlocked = gameState.completedTiers.includes(
    FAST_MINER_UNLOCK_TIER,
  );
  const legendaryMinerUnlocked = gameState.completedTiers.includes(
    LEGENDARY_MINER_UNLOCK_TIER,
  );
  const prestigeUnlocked = gameState.completedTiers.includes(
    PRESTIGE_UNLOCK_TIER,
  );
  const lifetimeMinerals = gameState.lifetimeMinerals;
  const totalGemsMinted = gameState.totalGemsMinted;
  const visiblePurchases = useMemo(
    () =>
      settingsData.showAllPurchases
        ? new Set(ALL_PURCHASE_IDS)
        : getVisiblePurchases(
            { lifetimeMinerals, totalGemsMinted },
            {
              minerPowerUnlocked,
              fastMinerUnlocked,
              legendaryMinerUnlocked,
              prestigeUnlocked,
            },
          ),
    [
      settingsData.showAllPurchases,
      lifetimeMinerals,
      totalGemsMinted,
      minerPowerUnlocked,
      fastMinerUnlocked,
      legendaryMinerUnlocked,
      prestigeUnlocked,
    ],
  );

  // Cosmetics prop bundle: only changes on buy/select/reroll/gem-change,
  // never on the per-second tick (memo keeps the settings panel quiet).
  const cosmetics = useMemo(
    () => ({
      gems: gameState.gems,
      playerSeed: gameState.playerSeed,
      ownedCosmetics: gameState.ownedCosmetics,
      selectedOutfit: gameState.selectedOutfit,
      selectedPickaxe: gameState.selectedPickaxe,
      onBuy: buyCosmetic,
      onSelect: selectCosmetic,
      onReroll: rerollPlayerSeed,
      caveThemesUnlocked: gameState.completedTiers.includes(
        CAVE_THEME_UNLOCK_TIER,
      ),
      ownedCaveThemes: gameState.ownedCaveThemes,
      selectedCaveTheme: gameState.selectedCaveTheme,
      onBuyCaveTheme: buyCaveTheme,
      onSelectCaveTheme: selectCaveTheme,
    }),
    [
      gameState.gems,
      gameState.playerSeed,
      gameState.ownedCosmetics,
      gameState.selectedOutfit,
      gameState.selectedPickaxe,
      gameState.completedTiers,
      gameState.ownedCaveThemes,
      gameState.selectedCaveTheme,
      buyCosmetic,
      selectCosmetic,
      rerollPlayerSeed,
      buyCaveTheme,
      selectCaveTheme,
    ],
  );

  useEffect(() => {
    autosaveSecondsRef.current = settingsData.autosave;
  }, [settingsData.autosave]);

  // Cloud save (docs/store-integration-plan.md §Cloud save): a device-
  // scoped backup of the serialized save on the Pocketbase deployment.
  // The provider is picked once (dev builds run the labeled in-memory
  // simulation; native production runs the real provider once the
  // Pocketbase URL lands; entry points — the settings section — are
  // hidden on the no-op, same rule as the ad/IAP entry points).
  const cloudProvider = useMemo(() => selectCloudSaveProvider(__DEV__), []);
  // Snapshot source: the latest state read from a ref so getCloudSnapshot
  // stays stable while always serializing the current save (the engine's
  // own saveGame does the same ref dance). updatedAt is the push time —
  // the server's last-write-wins key is the client clock by design.
  const cloudStateRef = useRef(gameState);
  cloudStateRef.current = gameState;
  const getCloudSnapshot = useCallback(
    () => ({
      blob: serializeSaveData({
        ...cloudStateRef.current,
        saveTime: Date.now(),
      }),
      saveVersion,
      updatedAt: Date.now(),
    }),
    [],
  );
  const cloudSave = useCloudSave({
    provider: cloudProvider,
    getSnapshot: getCloudSnapshot,
    restore: restoreFromBlob,
    isLoaded,
    saveLoadFailed,
    displayMessage,
    t,
  });
  // Destructure the stable members: effect/callback deps reference the
  // bindings directly (exhaustive-deps happy without re-running on the
  // handle object's per-render identity).
  const {
    requestPush: cloudRequestPush,
    restoreFromCloud: cloudRestoreFromCloud,
    deleteMyData: cloudDeleteMyData,
  } = cloudSave;
  // GDPR "delete my data" (plan §Backend): the ConfirmableButton in the
  // settings section holds the plain wording; this is the crash-trail +
  // the hook call (which toasts the outcome).
  const handleDeleteData = useCallback(() => {
    noteCrashEvent("delete my data");
    void cloudDeleteMyData();
  }, [cloudDeleteMyData]);
  // Leaderboard (docs/store-integration-plan.md §Leaderboard): the top-10
  // max-depth scoreboard on the same Pocketbase deployment as the cloud
  // save. Same provider-selection rules (dev builds run the labeled
  // in-memory row; native production gets the real provider once the
  // Pocketbase URL lands; the trophy button stays hidden on the no-op —
  // the same "hidden until configured" rule as the ad/IAP/cloud entry
  // points). Only DERIVED lifetime stats leave the device (maxDepth is
  // the save's lifetime max — monotonic by construction).
  const leaderboardProvider = useMemo(
    () => selectLeaderboardProvider(__DEV__),
    [],
  );
  const leaderboardStateRef = useRef(gameState);
  leaderboardStateRef.current = gameState;
  const getLeaderboardStats = useCallback(
    () => ({
      bestDepth: Number(leaderboardStateRef.current.maxDepth),
      maxCombo: leaderboardStateRef.current.maxCombo,
      lifetimeMinerals: Number(leaderboardStateRef.current.lifetimeMinerals),
      achievementIds: leaderboardStateRef.current.completedAchievements,
    }),
    [],
  );
  const leaderboard = useLeaderboard({
    provider: leaderboardProvider,
    getStats: getLeaderboardStats,
  });
  const { requestSubmit: leaderboardRequestSubmit } = leaderboard;

  // Push cadence (plan §Cloud save): every local save that lands — the
  // dirty→clean transition, autosave and manual save alike — requests a
  // push; the hook applies the 5-minute gate (and the toggle). The
  // prestige push below bypasses the cadence: it's the run boundary.
  const prevSaveDirtyRef = useRef(false);
  useEffect(() => {
    const wasDirty = prevSaveDirtyRef.current;
    prevSaveDirtyRef.current = saveDirty;
    if (isLoaded && wasDirty && !saveDirty) {
      cloudRequestPush("autosave");
      // Leaderboard submit piggybacks the same network turn (plan
      // §Leaderboard: same 5-minute cadence, fire-and-forget).
      leaderboardRequestSubmit();
    }
  }, [saveDirty, isLoaded, cloudRequestPush, leaderboardRequestSubmit]);
  // Settings bundle for the menu's cloud-backup section (memo keeps the
  // memoized MenuPanel/SettingsPanel quiet; lastSync moves at most once
  // per push — 5 minutes apart).
  const handleCloudRestore = useCallback(() => {
    noteCrashEvent("cloud restore");
    void cloudRestoreFromCloud();
  }, [cloudRestoreFromCloud]);
  const cloudSaveSettings = useMemo<CloudSaveSettingsProps>(
    () => ({
      available: cloudProvider.isAvailable(),
      isDevSim: cloudProvider.id === "dev-sim",
      enabled: cloudSave.enabled,
      setEnabled: cloudSave.setEnabled,
      lastSync: cloudSave.lastSync,
      onRestore: handleCloudRestore,
      onDeleteData: handleDeleteData,
    }),
    [
      cloudProvider,
      cloudSave.enabled,
      cloudSave.lastSync,
      cloudSave.setEnabled,
      handleCloudRestore,
      handleDeleteData,
    ],
  );

  // The "pickaxe" sound is the equipped pickaxe's unique swing sound
  // (falls back to the generic one for unknown ids, see useSounds).
  const { play } = useSounds(mute, gameState.selectedPickaxe);
  const reduceMotion = useAccessibilityReduceMotion();
  const {
    combo,
    comboMultiplier,
    flashAnim,
    increment: incrementCombo,
    reset: resetCombo,
    restore: restoreCombo,
  } = useCombo(reduceMotion);
  // Combo resistance (tier-3 gem upgrade): the fraction of the combo a
  // wrong answer / mine tap keeps. Ref so the stable tap-reset callback
  // below always sees the current level without re-subscribing.
  const comboResistRatioRef = useRef(0);
  comboResistRatioRef.current = getComboRetention(gameState.comboResistLevels);
  // Rewarded-ad combo save (todo: "Allow saving combo with rewarded-ad"):
  // when a loss happens (wrong answer or mine tap), the pre-loss value is
  // restorable for COMBO_SAVE_WINDOW_MS via a completed ad — an "undo" for
  // the loss that just happened. Memory-only: it dies with the process, and
  // it never travels in the save.
  const [comboSave, setComboSave] = useState<{
    combo: number;
    until: number;
  } | null>(null);
  // Refs so the stable callbacks below (the tap reset, the ad claim) always
  // see the latest value without re-subscribing on every combo change.
  const comboRef = useRef(combo);
  comboRef.current = combo;
  const comboSaveRef = useRef(comboSave);
  comboSaveRef.current = comboSave;
  const noteComboLoss = useCallback((preLossCombo: number) => {
    if (preLossCombo <= 0) return;
    setComboSave({ combo: preLossCombo, until: Date.now() + COMBO_SAVE_WINDOW_MS });
  }, []);
  const handleComboReset = useCallback(() => {
    noteComboLoss(comboRef.current);
    resetCombo(comboResistRatioRef.current);
  }, [noteComboLoss, resetCombo]);

  // Called by the ad hook after a completed comboSave ad: restore the saved
  // value (or the current combo if the player already rebuilt past it) and
  // clear the offer. No-ops if the offer is gone.
  const claimComboSave = useCallback(() => {
    const saved = comboSaveRef.current;
    if (saved == null) return;
    comboSaveRef.current = null;
    setComboSave(null);
    restoreCombo(Math.max(comboRef.current, saved.combo));
  }, [restoreCombo]);
  const { shakeAnim, shake } = useShakeInput();

  const playerPickaxeAnimRef: MutableRefObject<() => void> = useRef<() => void>(
    () => {},
  );
  const debrisRef = useRef<DebrisParticlesRef>(null);
  const blockBreakRef = useRef<BlockBreakRef>(null);
  const floatingTextRef = useRef<FloatingTextRef>(null);

  // Milestone toasts when depth crosses a 10m boundary (depth itself changes
  // every 500 minerals, so every-1m would be spam).
  const prevDepthRef = useRef(depth);
  useEffect(() => {
    const prev = prevDepthRef.current;
    prevDepthRef.current = depth;
    if (depth > prev && depth % 10n === 0n) {
      displayMessage(t("toast.depth", { depth: formatNumber(depth) }), 3000);
    }
  }, [depth, displayMessage, t]);

  // Biome toast when a new depth tier (see DEPTH_TIERS in game.ts) is entered.
  const prevTierRef = useRef(depthTier.id);
  useEffect(() => {
    const prev = prevTierRef.current;
    prevTierRef.current = depthTier.id;
    if (depthTier.id > prev) {
      displayMessage(
        t("toast.enteredTier", {
          tier: content("depthTier", String(depthTier.id), {
            title: depthTier.name,
          }).title,
          bonus: depthTier.clickBonus,
        }),
        3000,
      );
    }
  }, [depthTier, displayMessage, t, content]);

  // Goal tier completions (plan §4.6): completion is derived from lifetime
  // stats, the save's completedTiers only records fired celebrations. The
  // updater in completeTiers is idempotent (double-fires in dev can't pay
  // the bonus twice).
  useEffect(() => {
    const newly = getCompletedTierIds(gameState).filter(
      (id) => !gameState.completedTiers.includes(id),
    );
    if (newly.length === 0) return;
    completeTiers(newly);
    for (const tier of GOAL_TIERS.filter((t) => newly.includes(t.id))) {
      const tierText = content("goalTier", tier.id, {
        title: tier.name,
        detail: tier.unlock,
      });
      displayMessage(
        t("toast.tierComplete", {
          tier: tierText.title,
          bonus: formatNumber(tier.bonusMinerals),
          unlock: tierText.detail ?? tier.unlock,
        }),
        6000,
      );
    }
  }, [gameState, completeTiers, displayMessage, t, content]);

  // Achievements (plan §4.1): one-off bonus badges, kept distinct from the
  // goal tier gates above. Same derived-completion + idempotent-updater
  // pattern; multiple first-completions in one render collapse into one
  // toast so a save load can't spam the message overlay.
  useEffect(() => {
    const newly = getCompletedAchievementIds(gameState).filter(
      (id) => !gameState.completedAchievements.includes(id),
    );
    if (newly.length === 0) return;
    completeAchievements(newly);
    const names = newly
      .map((id) => {
        const a = getAchievement(id);
        return a
          ? content("achievement", a.id, { title: a.label }).title
          : id;
      })
      .slice(0, 3);
    const extra = newly.length - names.length;
    const label =
      extra > 0 ? `${names.join(" · ")} +${extra} more` : names.join(" · ");
    displayMessage(
      t("toast.achievement", {
        label,
        bonus: formatNumber(getAchievementBonus(newly)),
      }),
      6000,
    );
  }, [gameState, completeAchievements, displayMessage, t, content]);

  // Floating "+N" on canvas taps (stable so memoized consumers stay stable).
  const handleTapGain = useCallback(
    (gain: bigint) => floatingTextRef.current?.spawn(`+${formatNumber(gain)}`),
    [],
  );

  // Stable context value: creating a new object every render would re-render
  // every context consumer (all the Miners) on each tap, bypassing memo.
  const contextValue = useMemo(() => ({ onTick: onTick.current }), [onTick]);

  const { mineTap } = useMineTaps({
    clickPower: effectiveClickPower,
    play,
    playerPickaxeAnimRef,
    debrisRef,
    blockBreakRef,
    addTapGain,
    onResetCombo: handleComboReset,
    onGain: handleTapGain,
  });

  const {
    equation,
    textInput,
    setTextInput,
    handleSubmit,
    timeLeftMs,
    streak,
  } = useEquations({
    equationSettings,
    onCorrect: (value) => {
      const gem = applyAnswerReward(value, comboMultiplier, combo + 1);
      play("pickaxe", 60);
      playerPickaxeAnimRef.current();
      debrisRef.current?.trigger();
      blockBreakRef.current?.trigger();
      incrementCombo();
      // Floating "+N" showing exactly what this answer was worth.
      const gain =
        BigInt(Math.max(1, value)) *
        BigInt(comboMultiplier) *
        effectiveClickPower;
      floatingTextRef.current?.spawn(
        `+${formatNumber(gain)} ${emojis.mineral}`,
        "#8fbf8f",
      );
      if (gem) {
        floatingTextRef.current?.spawn(`+1 ${emojis.gem}`, "#7fd4ff");
        displayMessage(t("toast.vein"), 3000);
      }
      // Combo tier-up: the multiplier just stepped up.
      const nextMult = getComboMultiplier(combo + 1);
      if (nextMult > comboMultiplier) {
        displayMessage(t("toast.comboUp", { mult: nextMult }), 2000);
      }
      // Streak ignition (plan §4.2): this answer just reached the
      // threshold — from the NEXT answer on, each one pays ×2 more.
      if (
        equationSettings.streakMode &&
        streak === STREAK_MODE_THRESHOLD - 1
      ) {
        displayMessage(t("toast.streakIgnited"), 2500);
      }
    },
    onIncorrect: () => {
      play("stone", 150);
      shake();
      // Combo resistance (tier-3 gem upgrade): part of the combo survives.
      const retention = getComboRetention(gameState.comboResistLevels);
      noteComboLoss(combo);
      if (combo > 0) {
        const kept = getResistantComboReset(combo, gameState.comboResistLevels);
        displayMessage(
          kept > 0
            ? t("toast.comboDropped", { combo: kept })
            : t("toast.comboLost"),
          1500,
        );
      }
      resetCombo(retention);
    },
  });

  const handleMuteChange = useCallback((newVal: boolean) => setMute(newVal), [setMute]);

  // Crash-context tracing (plan "Adjust"): the unreproducible Android
  // `describe` crash is diagnosed from its next occurrence, and a stack
  // alone doesn't say WHAT the game was doing. This records a bounded
  // trail of high-level transitions (never per-tick / per-answer — those
  // would evict the interesting events) plus a small state snapshot into
  // crashContext.ts, which recordCrash snapshots into every crash entry.
  useEffect(() => {
    noteCrashEvent("app start");
    setCrashContextState({ platform: Platform.OS, dev: __DEV__ ? "yes" : "no" });
  }, []);

  useEffect(() => {
    if (isLoaded) noteCrashEvent("save loaded");
  }, [isLoaded]);

  useEffect(() => {
    setCrashContextState({
      // Number() is fine for a diagnostic: a huge depth only loses float
      // precision in the crash log, never in the game.
      depth: Number(depth),
      prestiges: gameState.totalPrestiges,
      gems: gameState.gems,
    });
  }, [depth, gameState.totalPrestiges, gameState.gems]);

  const prevEquationModesRef = useRef<string | null>(null);
  useEffect(() => {
    const modes =
      [
        equationSettings.hardMode && "hard",
        equationSettings.timedMode && "timed",
        equationSettings.streakMode && "streak",
      ]
        .filter(Boolean)
        .join("+") || "normal";
    const prev = prevEquationModesRef.current;
    prevEquationModesRef.current = modes;
    if (prev != null && prev !== modes) {
      noteCrashEvent(`equations: ${modes}`);
    }
  }, [equationSettings, t]);

  // Footer save pill (plan §2.1): saves immediately (autosave continues in
  // the background) and confirms with a toast so the tap has feedback.
  const handleSaveNow = useCallback(() => {
    noteCrashEvent("manual save");
    saveGame();
    displayMessage(t("toast.saved"), 3000);
  }, [saveGame, displayMessage, t]);

  // Save-code export/import (plan §4.3): the engine handles the state;
  // this layer only adds the toasts. The imported save persists via the
  // normal autosave / background-save path (saving immediately here would
  // serialize the pre-import state, since the state ref updates on render).
  const handleImportSaveCode = useCallback(
    (code: string): boolean => {
      if (!importSaveCode(code)) {
        displayMessage(t("toast.invalidSaveCode"), 3000);
        return false;
      }
      displayMessage(t("toast.saveImported"), 3000);
      noteCrashEvent("save imported");
      return true;
    },
    [importSaveCode, displayMessage, t],
  );

  // Daily bonus / login streak (plan §4.2): minerals flow through the
  // same additive path as tap gains (lifetime stats included).
  const dailyBonus = useDailyBonus({
    grantMinerals: addTapGain,
    displayMessage,
  });
  const dailyClaim = dailyBonus.claim;
  const handleDailyClaim = useCallback(() => {
    noteCrashEvent("daily bonus claimed");
    dailyClaim();
  }, [dailyClaim]);

  // Local event logging (guardrail 5, "measure before scaling"): the
  // app-open record happens inside the hook (after its stored record has
  // loaded); the milestones are fired from the effects below. The hook is
  // the single owner of the record — Settings only displays it.
  const {
    state: analytics,
    onPrestige,
    onAdView: onFirstAdView,
    onIapPurchase: onFirstIap,
    clear: onClearAnalytics,
  } = useAnalytics();

  // Rewarded ads (plan §5.1): the provider is picked in ads.ts behind the
  // documented swap point (selectAdProvider — see its docs): dev builds run
  // a clearly labeled simulation; production runs the real AdMob provider
  // once storeConfig.adMob is filled in (docs/store-integration.md §1) and
  // the no-op (entry points hidden) until then; web is always the no-op
  // (no web ad integration yet — adProvider.web.ts).
  const adProvider = selectAdProvider(__DEV__);
  const adRewards = useAdRewards({
    provider: adProvider,
    grantGems,
    offlineDouble,
    claimOfflineDouble,
    offlineTopUp,
    claimOfflineTopUp,
    comboSave: comboSave?.combo ?? null,
    claimComboSave,
    displayMessage,
    onAdView: onFirstAdView,
  });

  // Let an expired combo save go (the panel's countdown and the claim guard
  // the same `until`, so a save can at worst be restored a tick late, never
  // resurrected long after the window). Skipped while the comboSave ad is
  // mid-play: the player tapped "Watch" on this offer, so it must survive
  // the ad even if the window runs out during it.
  const comboSaveClaiming = adRewards.claiming === "comboSave";
  useEffect(() => {
    if (comboSave == null || comboSaveClaiming) return;
    const id = setInterval(() => {
      if (Date.now() >= (comboSaveRef.current?.until ?? 0)) {
        setComboSave(null);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [comboSave, comboSaveClaiming]);

  // In-app purchases (plan §5.2): dev builds run a clearly labeled
  // simulation; native production runs the real expo-iap → Pocketbase
  // provider once storeConfig.pocketbaseUrl is filled in (docs/
  // store-integration.md §1) and the no-op (entry points hidden) until
  // then; web is the no-op until the Stripe web path is built. Entitlements
  // are device-local and never travel in the save; the first validated
  // purchase feeds the analytics record. The provider selection itself is
  // the documented one-line swap point (selectIapProvider — see its docs).

  const iapProvider = selectIapProvider(__DEV__);
  const iap = useIap({
    provider: iapProvider,
    onPurchased: onFirstIap,
    displayMessage,
  });

  // Cosmetic IAP packs (plan §5.2): a validated purchase (or a restore /
  // a re-load on this device) permanently joins each owned pack's
  // cosmetic to the CURRENT save's owned lists, at no gem cost — the
  // engine grant is idempotent, and re-running it after a save import or
  // reset re-grants (the pack belongs to the player, not to one save).
  // The owned-list refs (not per-tick fields) are the effect deps: they
  // change on buy/import/reset/load, never on the 1s tick.
  useEffect(() => {
    const { cosmetics, caveThemes } = iapGrantCosmeticIds(iap.entitlements);
    if (cosmetics.length > 0 || caveThemes.length > 0) {
      grantIapCosmetics(cosmetics, caveThemes);
    }
  }, [
    iap.entitlements,
    grantIapCosmetics,
    gameState.ownedCosmetics,
    gameState.ownedCaveThemes,
  ]);

  // IapPanel "Owned" states: entitled pack ids (device-local) and the
  // cosmetic ids the current save already owns from any source (gems or a
  // pack). Both are ref-stable across ticks, so the memoized panel's
  // props only churn on real ownership changes.
  const iapOwnedPackIds = useMemo(
    () =>
      (Object.keys(IAP_PRODUCTS) as IapProductId[]).filter((id) =>
        hasIapEntitlement(iap.entitlements, id),
      ),
    [iap.entitlements],
  );
  const saveOwnedCosmeticIds = useMemo(
    () => [...gameState.ownedCosmetics, ...gameState.ownedCaveThemes],
    [gameState.ownedCosmetics, gameState.ownedCaveThemes],
  );

  // Free-path progress (guardrail 5): every prestige sunk live in this
  // session (the record keeps both the count and the first-prestige day).
  // The ref starts null so a loaded save that already has prestiges isn't
  // miscounted on the first effect run.
  const prevPrestigesRef = useRef<number | null>(null);
  useEffect(() => {
    const prev = prevPrestigesRef.current;
    prevPrestigesRef.current = gameState.totalPrestiges;
    if (prev !== null && gameState.totalPrestiges > prev) {
      noteCrashEvent("prestige");
      onPrestige();
      // Prestige is the run boundary: push the backup immediately, no
      // 5-minute cadence (plan §Cloud save "Push"); the leaderboard row
      // (lifetime maxes) refreshes with it, cadence-gated in the hook.
      cloudRequestPush("prestige");
      leaderboardRequestSubmit();
    }
  }, [gameState.totalPrestiges, onPrestige, cloudRequestPush, leaderboardRequestSubmit]);

  // Crash-context trails for the monetization actions (dev-sim or store,
  // same paths).
  const adClaim = adRewards.claim;
  const handleAdClaim = useCallback((kind: AdKind) => {
    noteCrashEvent(`ad reward: ${kind}`);
    adClaim(kind);
  }, [adClaim]);
  const iapPurchase = iap.purchase;
  const iapRestore = iap.restore;
  const handleIapPurchase = useCallback((id: IapProductId) => {
    noteCrashEvent(`iap purchase: ${id}`);
    iapPurchase(id);
  }, [iapPurchase]);
  const handleIapRestore = useCallback(() => {
    noteCrashEvent("iap restore");
    iapRestore();
  }, [iapRestore]);
  const handleReset = useCallback(() => {
    noteCrashEvent("reset");
    resetGame();
  }, [resetGame]);

  // Cold start (plan §4.4): hold the screen on a loading state until the
  // stored save is loaded, instead of flashing the zeroed state first.
  // All hooks above have already run, so an early return is safe here.
  if (!isLoaded) {
    return <LoadingScreen reduceMotion={reduceMotion} />;
  }

  return (
    <Context.Provider value={contextValue}>
      <View style={styles.container}>
        <DepthBanner
          depth={depth}
          mineralsPerSec={mineralsPerSec}
          tierName={content("depthTier", String(depthTier.id), {
            title: depthTier.name,
          }).title}
          clickBonus={depthTier.clickBonus}
        />
        <EquationDisplay
          equation={equation}
          clickPower={effectiveClickPower}
          comboMultiplier={comboMultiplier}
          timeLeftMs={timeLeftMs}
          streak={equationSettings.streakMode ? streak : null}
          multiplySymbol={equationSettings.multiplySymbol}
        />
        <AnswerInput
          value={textInput}
          setTextInput={setTextInput}
          onSubmit={handleSubmit}
          shakeAnim={shakeAnim}
          useKeypad={false}
        />
        <ComboIndicator
          combo={combo}
          comboMultiplier={comboMultiplier}
          flashAnim={flashAnim}
        />
        {/* Plan "Adjust" — canvas always visible: the cave sits ABOVE the
            purchase section, which is height-capped, scrollable, and
            collapsible, so no unlock count can ever push the canvas off. */}
        <MiningCanvas
          depth={depth}
          depthProgress={getDepthTierProgress(gameState.lifetimeMinerals)}
          tint={caveTint}
          minerals={gameState.minerals}
          gems={gameState.gems}
          miners={gameState.miners}
          fastMiners={gameState.fastMiners}
          legendaryMiners={gameState.legendaryMiners}
          onTap={mineTap}
          playerPickaxeAnimRef={playerPickaxeAnimRef}
          debrisRef={debrisRef}
          blockBreakRef={blockBreakRef}
          floatingTextRef={floatingTextRef}
          playerSeed={gameState.playerSeed}
          outfitId={gameState.selectedOutfit}
          pickaxeId={gameState.selectedPickaxe}
          reduceMotion={reduceMotion}
          emojiArt={settingsData.emojiArt}
        />
        <View style={styles.purchasesSection}>
          <View style={styles.purchasesHeader}>
            <Pressable
              testID="purchases-toggle"
              accessibilityRole="button"
              accessibilityLabel={
                hidePurchases
                  ? t("main.a11yShowUpgrades")
                  : t("main.a11yHideUpgrades")
              }
              onPress={() => setHidePurchases(!hidePurchases)}
              style={styles.purchasesToggle}
            >
              <Text style={styles.purchasesToggleText}>
                {hidePurchases ? "▼ " : "▲ "}
                {t("main.upgrades")}
              </Text>
            </Pressable>
          </View>
          {!hidePurchases && (
            <ScrollView style={styles.purchasesScroll}>
              <PurchaseButtons
                visible={visiblePurchases}
                minerals={gameState.minerals}
                gems={gameState.gems}
                clickPower={gameState.clickPower}
                minerPower={gameState.minerPower}
                minerPowerUnlocked={gameState.completedTiers.includes(MINER_POWER_UNLOCK_TIER)}
                miners={gameState.miners}
                fastMiners={gameState.fastMiners}
                legendaryMiners={gameState.legendaryMiners}
                gemChanceLevels={gameState.gemChanceLevels}
                fastMinerUnlocked={gameState.completedTiers.includes(FAST_MINER_UNLOCK_TIER)}
                legendaryMinerUnlocked={gameState.completedTiers.includes(LEGENDARY_MINER_UNLOCK_TIER)}
                prestigeLevel={gameState.prestigeLevel}
                lifetimeMinerals={gameState.lifetimeMinerals}
                prestigeUnlocked={gameState.completedTiers.includes(PRESTIGE_UNLOCK_TIER)}
                clickBoostLevels={gameState.clickBoostLevels}
                comboResistLevels={gameState.comboResistLevels}
                onUpgradePower={upgradePower}
                onBuyMiner={buyMiner}
                onBuyFastMiner={buyFastMiner}
                onBuyLegendaryMiner={buyLegendaryMiner}
                onBuyGem={buyGem}
                onBuyGemChance={buyGemChance}
                onBuyClickBoost={buyClickBoost}
                onBuyComboResist={buyComboResist}
                onUpgradeMinerPower={upgradeMinerPower}
                onSinkNewShaft={sinkNewShaft}
              />
            </ScrollView>
          )}
        </View>
        {showMessage && (
          <View style={styles.messageOverlay} pointerEvents="none">
            <Text style={styles.messageText}>{showMessage}</Text>
          </View>
        )}
        {!onboardingLoading && onboardingDone !== true && (
          <OnboardingOverlay onDismiss={() => setOnboardingDone(true)} />
        )}
        {/* Plan "Adjust": the footer is one menu button (settings + goals
            live inside it) plus the daily bonus; the freed space goes to
            the cave canvas (its flex absorbs the removed spacer). */}
        <View style={styles.footerRow}>
          <SavePill
            dirty={saveDirty}
            reduceMotion={reduceMotion}
            onSave={handleSaveNow}
          />
          <MenuPanel
            settingsData={settingsData}
            onChangeSettingsData={handleSettingsDataChange}
            equationSettings={equationSettings}
            onChangeEquationSettings={setEquationSettings}
            showMessage={showMessage}
            onSave={handleSaveSettings}
            onReset={handleReset}
            onExportSaveCode={exportSaveCode}
            onImportSaveCode={handleImportSaveCode}
            cosmetics={cosmetics}
            mute={mute}
            onMuteChange={handleMuteChange}
            hardModeUnlocked={gameState.completedTiers.includes(
              HARD_MODE_UNLOCK_TIER,
            )}
            stats={gameState}
            analytics={analytics}
            onClearAnalytics={onClearAnalytics}
            cloudSave={cloudSaveSettings}
          />
          <DailyBonusButton
            claimable={dailyBonus.claimable}
            bonus={dailyBonus.bonus}
            streak={dailyBonus.streak}
            onClaim={handleDailyClaim}
          />
          {/* The trophy renders only while the provider is available
              (plan §Leaderboard "Availability gate"): hidden until the
              Pocketbase URL is configured, same rule as the ad/IAP
              entry points. */}
          {leaderboard.available && (
            <LeaderboardPanel
              handle={leaderboard}
              isDevSim={leaderboardProvider.id === "dev-sim"}
            />
          )}
          {adRewards.available && !iap.removeAds && (
            <AdRewardsPanel
              isDevSim={adProvider.id === "dev-sim"}
              gemRollsLeft={adRewards.gemRollsLeft}
              comboSave={comboSave?.combo ?? null}
              comboSaveUntil={comboSave?.until ?? null}
              dailyCapLeft={adRewards.dailyCapLeft}
              offlineDouble={offlineDouble}
              offlineTopUp={offlineTopUp}
              claiming={adRewards.claiming}
              onClaim={handleAdClaim}
            />
          )}
          {/* Remove Ads owned hides this panel too (plan §5.1: it
              permanently disables even the opt-in entry points). */}
          {iap.available && !iap.removeAds && (
            <IapPanel
              isDevSim={iapProvider.id === "dev-sim"}
              purchasing={iap.purchasing}
              restoring={iap.restoring}
              ownedPackIds={iapOwnedPackIds}
              saveOwnedCosmeticIds={saveOwnedCosmeticIds}
              onPurchase={handleIapPurchase}
              onRestore={handleIapRestore}
            />
          )}
        </View>

        <StatusBar style="auto" />
      </View>
    </Context.Provider>
  );
}
