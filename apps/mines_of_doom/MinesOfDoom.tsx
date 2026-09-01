import { StatusBar } from "expo-status-bar";
import { MutableRefObject, useCallback, useEffect, useMemo, useRef } from "react";
import { Text, View } from "react-native";
import { useLocalStorage } from "apps/hooks/useLocalStorage";
import type { DebrisParticlesRef } from "apps/components/DebrisParticles";
import type { BlockBreakRef } from "apps/components/BlockBreak";
import { Context } from "./Context";
import { styles } from "./styles";
import DepthBanner from "./components/DepthBanner";
import EquationDisplay from "./components/EquationDisplay";
import AnswerInput from "./components/AnswerInput";
import ComboIndicator from "./components/ComboIndicator";
import PurchaseButtons from "./components/PurchaseButtons";
import MiningCanvas from "./components/MiningCanvas";
import SettingsPanel from "./components/SettingsPanel";
import GoalsPanel from "./components/GoalsPanel";
import { defaultSettingsData, getDepthTier, SettingsData } from "./game";
import {
  GOAL_TIERS,
  MINER_POWER_UNLOCK_TIER,
  getCompletedTierIds,
} from "./goals";
import { formatNumber } from "apps/utils/format";
import { emojis } from "apps/utils/graphics/emojis";
import type { FloatingTextRef } from "./components/FloatingTextLayer";
import { useMessages } from "./hooks/useMessages";
import { useGameEngine } from "./hooks/useGameEngine";
import { useSettings } from "./hooks/useSettings";
import { useSounds } from "./hooks/useSounds";
import { useCombo } from "./hooks/useCombo";
import { useShakeInput } from "./hooks/useShakeInput";
import { useMineTaps } from "./hooks/useMineTaps";
import { useEquations } from "./hooks/useEquations";

export default function MinesOfDoom() {
  // currently doesn't mute android touch sounds, but can in the future
  const [mute, setMute] = useLocalStorage<boolean>("mute", false);

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
    saveGame,
    addTapGain,
    applyAnswerReward,
    upgradePower,
    buyMiner,
    buyGem,
    upgradeMinerPower,
    completeTiers,
    buyCosmetic,
    selectCosmetic,
    rerollPlayerSeed,
    resetGame,
  } = useGameEngine(displayMessage, () => autosaveSecondsRef.current);
  const depthTier = getDepthTier(depth);
  // Depth-tier click bonus included: this is the value taps and answers
  // actually pay with (the engine applies the same bonus authoritatively).
  const effectiveClickPower = gameState.clickPower * depthTier.clickBonus;
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
    }),
    [
      gameState.gems,
      gameState.playerSeed,
      gameState.ownedCosmetics,
      gameState.selectedOutfit,
      gameState.selectedPickaxe,
      buyCosmetic,
      selectCosmetic,
      rerollPlayerSeed,
    ],
  );

  useEffect(() => {
    autosaveSecondsRef.current = settingsData.autosave;
  }, [settingsData.autosave]);
  const { play } = useSounds(mute);
  const {
    combo,
    comboMultiplier,
    flashAnim,
    increment: incrementCombo,
    reset: resetCombo,
  } = useCombo();
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
    onResetCombo: resetCombo,
    onGain: handleTapGain,
  });

  const {
    equation,
    textInput,
    setTextInput,
    handleSubmit,
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
      const nextCombo = combo + 1;
      if (Math.floor(nextCombo / 10) > Math.floor(combo / 10)) {
        displayMessage(`Combo x${Math.floor(nextCombo / 10) + 1}!`, 2000);
      }
    },
    onIncorrect: () => {
      play("stone", 150);
      shake();
      if (combo > 0) {
        displayMessage("Combo lost!", 1500);
      }
      resetCombo();
    },
  });

  const handleMuteChange = useCallback((newVal: boolean) => setMute(newVal), [setMute]);

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
        />
        <AnswerInput
          value={textInput}
          onChangeText={setTextInput}
          onSubmit={handleSubmit}
          shakeAnim={shakeAnim}
        />
        <ComboIndicator
          combo={combo}
          comboMultiplier={comboMultiplier}
          flashAnim={flashAnim}
        />
        <PurchaseButtons
          minerals={gameState.minerals}
          gems={gameState.gems}
          clickPower={gameState.clickPower}
          minerPower={gameState.minerPower}
          minerPowerUnlocked={gameState.completedTiers.includes(MINER_POWER_UNLOCK_TIER)}
          miners={gameState.miners}
          onUpgradePower={upgradePower}
          onBuyMiner={buyMiner}
          onBuyGem={buyGem}
          onUpgradeMinerPower={upgradeMinerPower}
        />
        <MiningCanvas
          depth={depth}
          tint={depthTier.tint}
          minerals={gameState.minerals}
          gems={gameState.gems}
          miners={gameState.miners}
          onTap={mineTap}
          playerPickaxeAnimRef={playerPickaxeAnimRef}
          debrisRef={debrisRef}
          blockBreakRef={blockBreakRef}
          floatingTextRef={floatingTextRef}
          playerSeed={gameState.playerSeed}
          outfitId={gameState.selectedOutfit}
          pickaxeId={gameState.selectedPickaxe}
        />
        {showMessage && (
          <View style={styles.messageOverlay} pointerEvents="none">
            <Text style={styles.messageText}>{showMessage}</Text>
          </View>
        )}
        <View style={{ flex: 4 }} />
        <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
          <SettingsPanel
          settingsData={settingsData}
          onChangeSettingsData={handleSettingsDataChange}
          equationSettings={equationSettings}
          onChangeEquationSettings={setEquationSettings}
          showMessage={showMessage}
          onSave={handleSaveSettings}
          onReset={resetGame}
          cosmetics={cosmetics}
          mute={mute}
          onMuteChange={handleMuteChange}
        />
          <GoalsPanel stats={gameState} />
        </View>

        <StatusBar style="auto" />
      </View>
    </Context.Provider>
  );
}
