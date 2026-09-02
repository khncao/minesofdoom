import { StatusBar } from "expo-status-bar";
import { MutableRefObject, useCallback, useEffect, useMemo, useRef } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
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
import InquiriesButton from "./components/InquiriesButton";
import {
  ALL_PURCHASE_IDS,
  defaultSettingsData,
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
import { selectAdProvider, type AdKind } from "./ads";
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
  } = useGameEngine(displayMessage, () => autosaveSecondsRef.current);
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
  const effectiveClickPower =
    gameState.clickPower *
    depthTier.clickBonus *
    getPrestigeMultiplier(gameState.prestigeLevel) *
    getClickBoostMultiplier(gameState.clickBoostLevels);
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
  } = useCombo(reduceMotion);
  // Combo resistance (tier-3 gem upgrade): the fraction of the combo a
  // wrong answer / mine tap keeps. Ref so the stable tap-reset callback
  // below always sees the current level without re-subscribing.
  const comboResistRatioRef = useRef(0);
  comboResistRatioRef.current = getComboRetention(gameState.comboResistLevels);
  const handleComboReset = useCallback(() => {
    resetCombo(comboResistRatioRef.current);
  }, [resetCombo]);
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
    if (depth > prev && depth % 10 === 0) {
      displayMessage(`Depth ${depth}m — deeper into the cave!`, 3000);
    }
  }, [depth, displayMessage]);

  // Biome toast when a new depth tier (see DEPTH_TIERS in game.ts) is entered.
  const prevTierRef = useRef(depthTier.id);
  useEffect(() => {
    const prev = prevTierRef.current;
    prevTierRef.current = depthTier.id;
    if (depthTier.id > prev) {
      displayMessage(
        `Entered ${depthTier.name}! Click power ×${depthTier.clickBonus}`, 3000,
      );
    }
  }, [depthTier, displayMessage]);

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
      displayMessage(
        `🏆 ${tier.name} complete! +${formatNumber(tier.bonusMinerals)} ${emojis.mineral} — unlocks: ${tier.unlock}`,
        6000,
      );
    }
  }, [gameState, completeTiers, displayMessage]);

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
      .map((id) => getAchievement(id)?.label ?? id)
      .slice(0, 3);
    const extra = newly.length - names.length;
    const label =
      extra > 0 ? `${names.join(" · ")} +${extra} more` : names.join(" · ");
    displayMessage(
      `🏅 ${label}! +${formatNumber(getAchievementBonus(newly))} ${emojis.mineral}`,
      6000,
    );
  }, [gameState, completeAchievements, displayMessage]);

  // Floating "+N" on canvas taps (stable so memoized consumers stay stable).
  const handleTapGain = useCallback(
    (gain: number) => floatingTextRef.current?.spawn(`+${formatNumber(gain)}`),
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
        Math.max(1, value) * effectiveClickPower * comboMultiplier;
      floatingTextRef.current?.spawn(
        `+${formatNumber(gain)} ${emojis.mineral}`,
        "#8fbf8f",
      );
      if (gem) {
        floatingTextRef.current?.spawn(`+1 ${emojis.gem}`, "#7fd4ff");
        displayMessage(`You struck a vein! +1 ${emojis.gem}`, 3000);
      }
      // Combo tier-up: the multiplier just stepped up.
      const nextMult = getComboMultiplier(combo + 1);
      if (nextMult > comboMultiplier) {
        displayMessage(`Combo x${nextMult}!`, 2000);
      }
      // Streak ignition (plan §4.2): this answer just reached the
      // threshold — from the NEXT answer on, each one pays ×2 more.
      if (
        equationSettings.streakMode &&
        streak === STREAK_MODE_THRESHOLD - 1
      ) {
        displayMessage("🔥 Streak ignited — ×2 per answer!", 2500);
      }
    },
    onIncorrect: () => {
      play("stone", 150);
      shake();
      // Combo resistance (tier-3 gem upgrade): part of the combo survives.
      const retention = getComboRetention(gameState.comboResistLevels);
      if (combo > 0) {
        const kept = getResistantComboReset(combo, gameState.comboResistLevels);
        displayMessage(
          kept > 0 ? `Combo dropped to ${kept}!` : "Combo lost!",
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
      depth,
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
  }, [equationSettings]);

  // Footer save pill (plan §2.1): saves immediately (autosave continues in
  // the background) and confirms with a toast so the tap has feedback.
  const handleSaveNow = useCallback(() => {
    noteCrashEvent("manual save");
    saveGame();
    displayMessage("Game saved", 3000);
  }, [saveGame, displayMessage]);

  // Save-code export/import (plan §4.3): the engine handles the state;
  // this layer only adds the toasts. The imported save persists via the
  // normal autosave / background-save path (saving immediately here would
  // serialize the pre-import state, since the state ref updates on render).
  const handleImportSaveCode = useCallback(
    (code: string): boolean => {
      if (!importSaveCode(code)) {
        displayMessage("Invalid save code.", 3000);
        return false;
      }
      displayMessage("Save imported!", 3000);
      noteCrashEvent("save imported");
      return true;
    },
    [importSaveCode, displayMessage],
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

  // Local event logging (guardrail 6, "measure before scaling"): the
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

  // Rewarded ads (plan §5.1): production builds run the no-op provider,
  // whose entry points stay hidden (no ad SDK is bundled; web remains 100%
  // free). Dev builds run a clearly labeled simulation so the full flow —
  // watch → reward → daily caps — can be exercised before the real SDK
  // integration swaps in behind the same interface.
  // The provider selection itself is the documented one-line swap point
  // (selectAdProvider — see its docs; real SDK swap is docs/store-integration.md).
  const adProvider = selectAdProvider(__DEV__);
  const adRewards = useAdRewards({
    provider: adProvider,
    grantGems,
    offlineDouble,
    claimOfflineDouble,
    offlineTopUp,
    claimOfflineTopUp,
    displayMessage,
    onAdView: onFirstAdView,
  });

  // In-app purchases (plan §5.2): production builds run the no-op provider
  // (no store SDK bundled — web stays 100% free, guardrail 5), so the
  // purchase entry points stay hidden until a real store integration
  // swaps in behind the same interface. Dev builds run a clearly labeled
  // simulation. Entitlements are device-local and never travel in the
  // save; the first validated purchase feeds the analytics record.
  // The provider selection itself is the documented one-line swap point
  // (selectIapProvider — see its docs; real store SDK swap is
  // docs/store-integration.md).
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

  // Free-path progress (guardrail 6): every prestige sunk live in this
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
    }
  }, [gameState.totalPrestiges, onPrestige]);

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
          tierName={depthTier.name}
          clickBonus={depthTier.clickBonus}
        />
        <EquationDisplay
          equation={equation}
          clickPower={effectiveClickPower}
          comboMultiplier={comboMultiplier}
          timeLeftMs={timeLeftMs}
          streak={equationSettings.streakMode ? streak : null}
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
          depthProgress={getDepthTierProgress(gameState.minerals)}
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
                hidePurchases ? "Show upgrades" : "Hide upgrades"
              }
              onPress={() => setHidePurchases(!hidePurchases)}
              style={styles.purchasesToggle}
            >
              <Text style={styles.purchasesToggleText}>
                {hidePurchases ? "▼ UPGRADES" : "▲ UPGRADES"}
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
          />
          <InquiriesButton />
          <DailyBonusButton
            claimable={dailyBonus.claimable}
            bonus={dailyBonus.bonus}
            streak={dailyBonus.streak}
            onClaim={handleDailyClaim}
          />
          {adRewards.available && !iap.removeAds && (
            <AdRewardsPanel
              isDevSim={adProvider.id === "dev-sim"}
              gemRollsLeft={adRewards.gemRollsLeft}
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
