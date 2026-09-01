import { StatusBar } from "expo-status-bar";
import { MutableRefObject, useCallback, useEffect, useMemo, useRef } from "react";
import { Text, View } from "react-native";
import { useLocalStorage } from "apps/hooks/useLocalStorage";
import type { DebrisParticlesRef } from "apps/components/DebrisParticles";
import { Context } from "./Context";
import { styles } from "./styles";
import DepthBanner from "./components/DepthBanner";
import EquationDisplay from "./components/EquationDisplay";
import AnswerInput from "./components/AnswerInput";
import ComboIndicator from "./components/ComboIndicator";
import PurchaseButtons from "./components/PurchaseButtons";
import MiningCanvas from "./components/MiningCanvas";
import SettingsPanel from "./components/SettingsPanel";
import { defaultSettingsData, SettingsData } from "./game";
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
    resetGame,
  } = useGameEngine(displayMessage, () => autosaveSecondsRef.current);
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

  // Floating "+N" on canvas taps (stable so memoized consumers stay stable).
  const handleTapGain = useCallback(
    (gain: number) => floatingTextRef.current?.spawn(`+${formatNumber(gain)}`),
    [],
  );

  // Stable context value: creating a new object every render would re-render
  // every context consumer (all the Miners) on each tap, bypassing memo.
  const contextValue = useMemo(() => ({ onTick: onTick.current }), [onTick]);

  const { mineTap } = useMineTaps({
    clickPower: gameState.clickPower,
    play,
    playerPickaxeAnimRef,
    debrisRef,
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
      const gem = applyAnswerReward(value, comboMultiplier);
      play("pickaxe", 60);
      playerPickaxeAnimRef.current();
      debrisRef.current?.trigger();
      incrementCombo();
      // Floating "+N" showing exactly what this answer was worth.
      const gain =
        Math.max(1, value) * gameState.clickPower * comboMultiplier;
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
        <DepthBanner depth={depth} mineralsPerSec={mineralsPerSec} />
        <EquationDisplay
          equation={equation}
          clickPower={gameState.clickPower}
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
          miners={gameState.miners}
          onUpgradePower={upgradePower}
          onBuyMiner={buyMiner}
          onBuyGem={buyGem}
        />
        <MiningCanvas
          depth={depth}
          minerals={gameState.minerals}
          gems={gameState.gems}
          miners={gameState.miners}
          onTap={mineTap}
          playerPickaxeAnimRef={playerPickaxeAnimRef}
          debrisRef={debrisRef}
          floatingTextRef={floatingTextRef}
        />
        {showMessage && (
          <View style={styles.messageOverlay} pointerEvents="none">
            <Text style={styles.messageText}>{showMessage}</Text>
          </View>
        )}
        <View style={{ flex: 4 }} />
        <SettingsPanel
          settingsData={settingsData}
          onChangeSettingsData={handleSettingsDataChange}
          equationSettings={equationSettings}
          onChangeEquationSettings={setEquationSettings}
          showMessage={showMessage}
          onSave={handleSaveSettings}
          onReset={resetGame}
          mute={mute}
          onMuteChange={handleMuteChange}
        />

        <StatusBar style="auto" />
      </View>
    </Context.Provider>
  );
}
