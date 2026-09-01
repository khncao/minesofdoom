import { StatusBar } from "expo-status-bar";
import {
  MutableRefObject,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  AppState,
  KeyboardAvoidingView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Audio } from "expo-av";
import AsyncStorage, {
  useAsyncStorage,
} from "@react-native-async-storage/async-storage";
import { useLocalStorage } from "apps/hooks/useLocalStorage";
import Miner from "./components/Miner";
import Button from "apps/components/Button";
import ConfirmableButton from "apps/components/ConfirmableButton";
import IntegerInput from "apps/components/IntegerInput";
import BottomModal from "apps/components/BottomModal";
import MuteToggle from "apps/components/MuteToggle";
import DebrisParticles, {
  DebrisParticlesRef,
} from "apps/components/DebrisParticles";
import CaveBackground from "apps/components/CaveBackground";
import { pickaxeSound, stoneSound } from "assets/index";
import {
  EquationSettings,
  getRandomEquation,
  approxeq,
  Ops,
  defaultEquationSettings,
} from "apps/utils/math/equations";
import { emojis, emojiText } from "apps/utils/graphics/emojis";
import { formatNumber } from "apps/utils/format";
import { Context } from "./Context";

type SaveData = {
  minerals: number;
  gems: number;
  clickPower: number;
  miners: number;
  minerPower: number;
  startTime: number;
  saveTime: number;
  saveVersion: number;
  tick: number;
};

type SettingsData = {
  autosave: number;
  equations: EquationSettings;
};

// TODO: number to bigint
const saveDataKey = "save";
const saveVersion = 1;
const settingsDataKey = "settings";
const msPerTick = 1000;
const gemChance = 0.05;
const gemMineralCost = 100000;
const equationSettingsKey = "equationSettings";
// Cap offline earnings at 8 hours of mining
const maxOfflineTicks = 8 * 60 * 60;

const emptySaveData = {
  minerals: 0,
  gems: 0,
  clickPower: 1,
  miners: 0,
  minerPower: 1,
  startTime: Date.now(),
  saveTime: 0,
  saveVersion,
  tick: 0,
};

const defaultSettingsData = {
  autosave: 30,
};

function getClickUpgradeCost(level: number): number {
  return level * level * level * level;
}

function getMinerUpgradeCost(current: number): number {
  return current * current * current * current + 1;
}

function rollGem(comboMultiplier: number) {
  return Math.random() < gemChance * comboMultiplier;
}

export default function MinesOfDoom() {
  const startTime = useRef(Date.now());

  const [settingsData, setSettingsData] = useState(defaultSettingsData);
  const [equationSettings, setEquationSettings] = useState(
    defaultEquationSettings,
  );
  const [gameState, setGameState] = useState<SaveData>(emptySaveData);
  const { getItem: getSaveData, setItem: setSaveData } =
    useAsyncStorage(saveDataKey);
  const { getItem: getStoredSettingsData, setItem: setStoredSettingsData } =
    useAsyncStorage(settingsDataKey);
  const {
    getItem: getEquationSettingsStore,
    setItem: setEquationSettingsStore,
  } = useAsyncStorage(equationSettingsKey);

  // currently doesn't mute android touch sounds, but can in the future
  const [mute, setMute] = useLocalStorage<boolean>("mute", false);

  const [combo, setCombo] = useState(0);
  const comboMultiplier = 1 + Math.floor(combo / 10);

  const onTick = useRef<Array<() => void>>([]);
  const [tick, setTick] = useState(0);

  // Stable context value: creating a new object every render would re-render
  // every context consumer (all the Miners) on each tap, bypassing memo.
  const contextValue = useMemo(() => ({ onTick: onTick.current }), []);

  // Load stored data
  useEffect(() => {
    getEquationSettingsStore().then((data) => {
      if (data == null) {
        return;
      }
      const equationSettings: EquationSettings = JSON.parse(data);
      setEquationSettings(equationSettings);
    });
    getStoredSettingsData().then((data) => {
      if (data == null) {
        return;
      }
      const settingsData: SettingsData = JSON.parse(data);
      setSettingsData(settingsData);
      // console.log("loaded settings");
    });
    getSaveData().then((data) => {
      if (data == null) {
        return;
      }
      const saveData: SaveData = JSON.parse(data);
      const elapsedTicks = Math.min(
        Math.floor((Date.now() - saveData.saveTime) / msPerTick),
        maxOfflineTicks,
      );
      const offlineMinerals =
        saveData.miners * saveData.minerPower * elapsedTicks;
      setGameState({
        ...saveData,
        minerals: saveData.minerals + offlineMinerals,
      });
      startTime.current = saveData.startTime;
      if (offlineMinerals > 0) {
        displayMessageCallback(
          `Welcome back! Your miners collected ${formatNumber(offlineMinerals)} ${emojis.mineral} while you were away.`,
          6000,
        );
      }
      // console.log("loaded save");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [showMessage, setShowMessage] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const displayMessageCallback = useCallback(
    (message: string, timeout: number) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => setShowMessage(null), timeout);
      setShowMessage(message);
    },
    [],
  );

  const saveGame = useCallback(() => {
    gameState.saveTime = Date.now();
    const data = JSON.stringify(gameState);
    setSaveData(data);
  }, [gameState, setSaveData]);

  // Keep a ref to the latest saveGame so the AppState listener (registered
  // once) always saves the current state.
  const saveGameRef = useRef(saveGame);
  saveGameRef.current = saveGame;

  // useAsyncStorage returns new function identities every render, so keep
  // refs for stable callbacks passed to the memoized settings UI.
  const setStoredSettingsDataRef = useRef(setStoredSettingsData);
  setStoredSettingsDataRef.current = setStoredSettingsData;
  const setEquationSettingsStoreRef = useRef(setEquationSettingsStore);
  setEquationSettingsStoreRef.current = setEquationSettingsStore;
  const settingsDataRef = useRef(settingsData);
  settingsDataRef.current = settingsData;
  const equationSettingsRef = useRef(equationSettings);
  equationSettingsRef.current = equationSettings;

  // Save when the app goes to the background
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (status) => {
      if (status !== "active") {
        saveGameRef.current();
      }
    });
    return () => subscription.remove();
  }, []);

  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Main loop interval
  useEffect(() => {
    if (timeout.current) {
      clearTimeout(timeout.current);
    }
    timeout.current = setTimeout(() => {
      if (gameState.miners > 0) {
        // Only update state when something actually changes; allocating a new
        // state object every second forced a full re-render even when idle.
        setGameState((n: SaveData) => {
          return {
            ...n,
            minerals: n.minerals + n.miners * n.minerPower,
          };
        });
        onTick.current.forEach((fn) => fn());
      }
      if (tick % 100 === 0) {
        saveGame();
      }
      // console.log(`tick: ${tick}`);
      setTick((old) => old + 1);
    }, msPerTick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  // Audio
  // Sounds are created once and reused. Creating a new Audio.Sound on every
  // click (and storing it in state) forced an extra re-render per click, which
  // combined with the game-state updates pushed renders past the tick budget.
  const pickaxeSoundRef = useRef<Audio.Sound | null>(null);
  const stoneSoundRef = useRef<Audio.Sound | null>(null);

  // Throttle per sound: replaying the same sound is a cancel+restart, so
  // just cap the rate to avoid hammering the audio layer while spamming.
  const lastSoundTimeRef = useRef<Record<string, number>>({});
  const playSound = useCallback(
    (key: string, sound: Audio.Sound | null, minInterval = 0) => {
      if (mute || sound == null) {
        return;
      }
      const now = Date.now();
      if (now - (lastSoundTimeRef.current[key] ?? 0) < minInterval) {
        return;
      }
      lastSoundTimeRef.current[key] = now;
      sound.playAsync();
    },
    [mute],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [pickaxe, stone] = await Promise.all([
        Audio.Sound.createAsync(pickaxeSound),
        Audio.Sound.createAsync(stoneSound),
      ]);
      if (cancelled) {
        pickaxe.sound.unloadAsync();
        stone.sound.unloadAsync();
        return;
      }
      pickaxeSoundRef.current = pickaxe.sound;
      stoneSoundRef.current = stone.sound;
    })();
    return () => {
      cancelled = true;
      pickaxeSoundRef.current?.unloadAsync();
      stoneSoundRef.current?.unloadAsync();
      pickaxeSoundRef.current = null;
      stoneSoundRef.current = null;
    };
  }, []);

  const playerPickaxeAnimRef: MutableRefObject<() => void> = useRef<() => void>(
    () => {},
  );
  const debrisRef = useRef<DebrisParticlesRef>(null);
  const comboFlashAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const shakeAnimSeqRef = useRef<Animated.CompositeAnimation | null>(null);
  const shakeInput = useCallback(() => {
    // Cancel the in-flight shake instead of stacking another sequence.
    shakeAnimSeqRef.current?.stop();
    shakeAnim.setValue(0);
    shakeAnimSeqRef.current = Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 80, useNativeDriver: true }),
    ]);
    shakeAnimSeqRef.current.start();
  }, [shakeAnim]);

  const comboFlashSpringRef = useRef<Animated.CompositeAnimation | null>(null);
  const flashCombo = useCallback(() => {
    comboFlashSpringRef.current?.stop();
    comboFlashAnim.setValue(1.6);
    comboFlashSpringRef.current = Animated.spring(comboFlashAnim, {
      toValue: 1,
      useNativeDriver: true,
    });
    comboFlashSpringRef.current.start();
  }, [comboFlashAnim]);

  const depth = Math.floor(gameState.minerals / 500);

  // Rapid mine taps: accumulate gains in a ref and flush to state at a
  // fixed 20Hz rate, so fast tapping causes a handful of cheap re-renders
  // per second instead of one per tap (50ms display latency is imperceptible
  // for an idle-game counter).
  const TAP_FLUSH_INTERVAL = 50;
  const pendingTapGainRef = useRef(0);
  const tapFlushScheduledRef = useRef(false);
  const lastTapFlushRef = useRef(0);
  const clickPowerRef = useRef(gameState.clickPower);
  clickPowerRef.current = gameState.clickPower;

  const scheduleTapFlush = useCallback(() => {
    if (tapFlushScheduledRef.current) {
      return;
    }
    const flush = () => {
      const now = Date.now();
      if (now - lastTapFlushRef.current < TAP_FLUSH_INTERVAL) {
        // Too soon; keep waiting one more frame.
        requestAnimationFrame(flush);
        return;
      }
      tapFlushScheduledRef.current = false;
      lastTapFlushRef.current = now;
      const gain = pendingTapGainRef.current;
      pendingTapGainRef.current = 0;
      if (gain > 0) {
        setGameState((n: SaveData) => ({
          ...n,
          minerals: n.minerals + gain,
        }));
      }
    };
    tapFlushScheduledRef.current = true;
    requestAnimationFrame(flush);
  }, []);

  const mineTap = useCallback(() => {
    pendingTapGainRef.current += clickPowerRef.current;
    scheduleTapFlush();
    playSound("pickaxe", pickaxeSoundRef.current, 60);
    playerPickaxeAnimRef.current();
    debrisRef.current?.trigger();
    setCombo(0);
  }, [scheduleTapFlush, playSound]);

  const handleMuteChange = useCallback((newVal: boolean) => setMute(newVal), [setMute]);

  // Logic
  const textInputRef = useRef<null | TextInput>(null);
  const [textInput, setTextInput] = useState("");
  const [equation, setEquation] = useState(getRandomEquation(equationSettings));

  const submit = () => {
    let value = -1;
    try {
      value = Number.parseFloat(textInput);
    } catch (e) {
      // console.log(e);
    }

    if (equation.answer != null && approxeq(value, equation.answer)) {
      if (equation.op === Ops.div) {
        value *= 10;
      }
      if (equation.op === Ops.sub) {
        value = Math.abs(value) * 2;
      }
      setGameState((n: SaveData) => {
        return {
          ...n,
          minerals:
            n.minerals +
            Math.max(1, value) * gameState.clickPower * comboMultiplier,
          gems: rollGem(comboMultiplier) ? n.gems + 1 : n.gems,
        };
      });
      playSound("pickaxe", pickaxeSoundRef.current, 60);
      playerPickaxeAnimRef.current();
      debrisRef.current?.trigger();
      flashCombo();
      setCombo(combo + 1);
    } else {
      playSound("stone", stoneSoundRef.current, 150);
      shakeInput();
      if (combo > 0) {
        displayMessageCallback("Combo lost!", 1500);
      }
      setCombo(0);
    }
    setTextInput("");
    setEquation(getRandomEquation(equationSettings));
  };

  const mineralsPerSec = gameState.miners * gameState.minerPower;

  const handleSaveSettings = useCallback(() => {
    saveGameRef.current();
    setStoredSettingsDataRef.current(JSON.stringify(settingsDataRef.current));
    setEquationSettingsStoreRef.current(JSON.stringify(equationSettingsRef.current));
    displayMessageCallback("Saved", 3000);
  }, [displayMessageCallback]);

  const handleReset = useCallback(() => {
    AsyncStorage.removeItem(saveDataKey);
    setGameState(emptySaveData);
  }, []);

  // Stable element so the memoized BottomModal can skip re-rendering on
  // every tap (it only changes when settings or the message actually change).
  const settingsChildren = useMemo(
    () => (
      <SettingsContent
        equationSettings={equationSettings}
        onChangeEquationSettings={setEquationSettings}
        showMessage={showMessage}
        onSave={handleSaveSettings}
        onReset={handleReset}
      />
    ),
    [equationSettings, showMessage, handleSaveSettings, handleReset],
  );

  return (
    <Context.Provider value={contextValue}>
      <View style={styles.container}>
        <View style={styles.depthBanner}>
          <Text style={styles.depthText}>⛏ Depth: {depth}m</Text>
          {mineralsPerSec > 0 && (
            <Text style={styles.depthText}>
              {emojis.mineral} {mineralsPerSec}/s
            </Text>
          )}
        </View>
        <Text style={styles.text}>
          {equation.a} {equation.op} {equation.b}?
        </Text>
        <Text style={styles.pendingGainText}>
          correct: +{formatNumber(gameState.clickPower * comboMultiplier)}{" "}
          {emojis.mineral}
          {equation.op === Ops.div && " ×10"}
          {equation.op === Ops.sub && " ×2"}
        </Text>
        {
          // Input
        }
        <KeyboardAvoidingView behavior="padding">
          <Animated.View
            style={{
              transform: [{ translateX: shakeAnim }],
            }}
          >
            <TextInput
              ref={textInputRef}
              value={textInput}
              onChangeText={setTextInput}
              inputMode="numeric"
              autoFocus={true}
              clearButtonMode="always"
              onSubmitEditing={() => {
                submit();
                textInputRef.current?.clear();
                setTextInput("");
              }}
              selectTextOnFocus={true}
              blurOnSubmit={false}
              clearTextOnFocus={true}
              style={{
                ...styles.text,
                ...styles.textInputBox,
              }}
            />
          </Animated.View>
        </KeyboardAvoidingView>

        <View style={styles.flexCenteredRow}>
          <Animated.Text
            style={[
              styles.comboText,
              { transform: [{ scale: comboFlashAnim }] },
            ]}
          >
            {combo > 0 ? `🔥 ${combo}x combo` : ""}
          </Animated.Text>
          {comboMultiplier > 1 && (
            <Text style={styles.multiplierText}> ×{comboMultiplier}</Text>
          )}
        </View>
        {
          // Purchaseables
        }
        <View style={{ gap: 5, marginTop: 8 }}>
          <Button
            disabled={
              gameState.minerals < getClickUpgradeCost(gameState.clickPower)
            }
            onPress={() => {
              setGameState((n: SaveData) => {
                return {
                  ...n,
                  clickPower: n.clickPower + 1,
                  minerals:
                    n.minerals - getClickUpgradeCost(gameState.clickPower),
                };
              });
            }}
            title={`UPGRADE POWER (-${getClickUpgradeCost(
              gameState.clickPower,
            )} ${emojis.mineral}) (${gameState.clickPower})`}
          />

          <Button
            onPress={() => {
              setGameState((n: SaveData) => {
                return {
                  ...n,
                  miners: n.miners + 1,
                  gems: n.gems - getMinerUpgradeCost(n.miners),
                };
              });
            }}
            disabled={gameState.gems < getMinerUpgradeCost(gameState.miners)}
            title={`BUY A MINER (-${getMinerUpgradeCost(gameState.miners)} ${
              emojis.gem
            }) (${gameState.miners})`}
          />

          <Button
            onPress={() => {
              setGameState((n: SaveData) => {
                return {
                  ...n,
                  minerals: n.minerals - gemMineralCost,
                  gems: n.gems + 1,
                };
              });
            }}
            disabled={gameState.minerals < gemMineralCost}
            title={`BUY A GEM (-${gemMineralCost} ${emojis.mineral})`}
          />
        </View>
        {/*
          Canvas: plain View + responder system instead of Pressable.
          On web, Pressable keeps pressed state in React and re-renders
          twice per tap, which dominated the cost of rapid tapping.
        */}
        <View
          onStartShouldSetResponder={() => true}
          onResponderRelease={mineTap}
          onResponderTerminationRequest={() => false}
          accessibilityRole="button"
          accessibilityLabel="Mine"
          style={{ ...styles.canvas, paddingTop: 10 }}
        >
          <CaveBackground depth={depth} />
          <View style={{ alignItems: "center" }}>
            <View style={styles.flexCenteredRow}>
              {emojiText("mineral")}
              <Text style={{ ...styles.text, alignSelf: "center" }}>
                {formatNumber(gameState.minerals)}
              </Text>
            </View>
            <View style={styles.flexCenteredRow}>
              {emojiText("gem")}
              <Text style={{ ...styles.text, alignSelf: "center" }}>
                {formatNumber(gameState.gems)}
              </Text>
            </View>

            <View style={{ position: "relative", alignItems: "center" }}>
              <Miner
                key={"player"}
                animateRef={playerPickaxeAnimRef}
                isPlayer={true}
              />
              <DebrisParticles ref={debrisRef} />
            </View>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              {[...Array(Math.min(gameState.miners, 50))].map((_, idx) => (
                <Miner key={idx} scale={0.5} reactOnTick={true} />
              ))}
            </View>
          </View>
        </View>
        {
          // Settings
        }
        <View style={{ flex: 4 }} />
        <View
          style={{
            alignSelf: "flex-start",
            flexDirection: "row",
            alignItems: "center",
            margin: 10,
          }}
        >
          <BottomModal>{settingsChildren}</BottomModal>
          <MuteToggle init={mute} onToggleChange={handleMuteChange} />
        </View>

        <StatusBar style="auto" />
      </View>
    </Context.Provider>
  );
}

// Memoized so re-renders from tapping the mine don't re-render the whole
// settings UI (switches, inputs, modal) on every tap.
const SettingsContent = memo(function SettingsContent({
  equationSettings,
  onChangeEquationSettings,
  showMessage,
  onSave,
  onReset,
}: {
  equationSettings: EquationSettings;
  onChangeEquationSettings: (newSettings: EquationSettings) => void;
  showMessage: string | null;
  onSave: () => void;
  onReset: () => void; }) {
  return (
    <View style={{ gap: 2, marginTop: 5 }}>
      <IntegerInput
        label="Max constant value in equations: "
        defaultValue={equationSettings.maxNumber}
        onChangeValue={(newVal) =>
          onChangeEquationSettings({
            ...equationSettings,
            maxNumber: newVal,
          })
        }
      />
      <View
        style={{
          ...styles.flexCenteredRow,
          gap: 4,
        }}
      >
        <Text style={styles.text}>*</Text>
        <Switch
          value={equationSettings.multiply}
          onValueChange={(newVal) => {
            onChangeEquationSettings({
              ...equationSettings,
              multiply: newVal,
            });
          }}
        />
        <Text style={styles.text}>+</Text>
        <Switch
          value={equationSettings.add}
          onValueChange={(newVal) => {
            onChangeEquationSettings({ ...equationSettings, add: newVal });
          }}
        />
        <Text style={styles.text}>-</Text>
        <Switch
          value={equationSettings.subtract}
          onValueChange={(newVal) => {
            onChangeEquationSettings({
              ...equationSettings,
              subtract: newVal,
            });
          }}
        />
        <Text style={styles.text}>/</Text>
        <Switch
          value={equationSettings.division}
          onValueChange={(newVal) => {
            onChangeEquationSettings({
              ...equationSettings,
              division: newVal,
            });
          }}
        />
      </View>
      <View
        style={{
          ...styles.flexCenteredRow,
          gap: 4,
          marginTop: 10,
        }}
      >
        <Button title="Save" onPress={onSave} />
        <ConfirmableButton
          title="Reset"
          description="Will delete current save data and reset to initial state."
          onPress={onReset}
        />
      </View>
      <View style={{ alignSelf: "center", margin: 10 }}>
        {showMessage && <Text style={{ ...styles.text }}>{showMessage}</Text>}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#2f2f2f",
    alignItems: "center",
    gap: 3,
    flex: 4,
  },
  canvas: {
    flex: 3,
    minWidth: "98%",
    backgroundColor: "#2f1f1f",
    margin: 4,
    overflow: "hidden",
  },
  text: {
    color: "#fff",
    userSelect: "none",
  },
  textInputBox: {
    textAlign: "center",
    borderColor: "white",
    borderWidth: 1,
  },
  flexCenteredRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  depthBanner: {
    flexDirection: "row",
    gap: 16,
    paddingTop: 6,
    paddingHorizontal: 12,
    alignSelf: "stretch",
    justifyContent: "space-between",
  },
  depthText: {
    color: "#b0a090",
    fontSize: 12,
    userSelect: "none",
  },
  pendingGainText: {
    color: "#8fbf8f",
    fontSize: 12,
    userSelect: "none",
  },
  comboText: {
    color: "#ffaa44",
    fontSize: 16,
    fontWeight: "bold",
    userSelect: "none",
  },
  multiplierText: {
    color: "#ff6644",
    fontSize: 16,
    fontWeight: "bold",
    userSelect: "none",
  },
});
