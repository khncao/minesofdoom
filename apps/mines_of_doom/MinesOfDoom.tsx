import { StatusBar } from "expo-status-bar";
import {
  MutableRefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Pressable,
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
      const elapsedTicks = Math.floor(
        (Date.now() - saveData.saveTime) / msPerTick,
      );
      setGameState({
        ...saveData,
        minerals:
          saveData.minerals +
          saveData.miners * saveData.minerPower * elapsedTicks,
      });
      startTime.current = saveData.startTime;
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

  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Main loop interval
  useEffect(() => {
    if (timeout.current) {
      clearTimeout(timeout.current);
    }
    timeout.current = setTimeout(() => {
      setGameState((n: SaveData) => {
        return {
          ...n,
          minerals: n.minerals + gameState.miners * gameState.minerPower,
        };
      });
      if (gameState.miners > 0) {
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

  const playSound = useCallback(
    (sound: Audio.Sound | null) => {
      if (mute || sound == null) {
        return;
      }
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

  const flashCombo = useCallback(() => {
    comboFlashAnim.setValue(1.6);
    Animated.spring(comboFlashAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [comboFlashAnim]);

  const depth = Math.floor(gameState.minerals / 500);

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
      playSound(pickaxeSoundRef.current);
      playerPickaxeAnimRef.current();
      debrisRef.current?.trigger();
      flashCombo();
      setCombo(combo + 1);
    } else {
      playSound(stoneSoundRef.current);
      setCombo(0);
    }
    setTextInput("");
    setEquation(getRandomEquation(equationSettings));
  };

  const mineralsPerSec = gameState.miners * gameState.minerPower;

  return (
    <Context.Provider value={{ onTick: onTick.current }}>
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
        {
          // Input
        }
        <KeyboardAvoidingView behavior="padding">
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
        {
          // Canvas
        }
        <Pressable
          onPress={() => {
            setGameState((n: SaveData) => {
              return {
                ...n,
                minerals: n.minerals + gameState.clickPower,
              };
            });
            playSound(pickaxeSoundRef.current);
            playerPickaxeAnimRef.current();
            debrisRef.current?.trigger();
            setCombo(0);
          }}
          style={{ ...styles.canvas, paddingTop: 10 }}
        >
          <CaveBackground depth={depth} />
          <View style={{ alignItems: "center" }}>
            <View style={styles.flexCenteredRow}>
              {emojiText("mineral")}
              <Text style={{ ...styles.text, alignSelf: "center" }}>
                {gameState.minerals}
              </Text>
            </View>
            <View style={styles.flexCenteredRow}>
              {emojiText("gem")}
              <Text style={{ ...styles.text, alignSelf: "center" }}>
                {gameState.gems}
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
        </Pressable>
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
          <BottomModal>
            <View style={{ gap: 2, marginTop: 5 }}>
              {/* <IntegerInput
                  label="Autosave interval(secs), 0 to disable: "
                  defaultValue={settingsData.autosave}
                  onChangeValue={(newVal) =>
                    setSettingsData({ ...settingsData, autosave: newVal })
                  }
                /> */}
              <IntegerInput
                label="Max constant value in equations: "
                defaultValue={equationSettings.maxNumber}
                onChangeValue={(newVal) =>
                  setEquationSettings({
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
                    setEquationSettings({
                      ...equationSettings,
                      multiply: newVal,
                    });
                  }}
                />
                <Text style={styles.text}>+</Text>
                <Switch
                  value={equationSettings.add}
                  onValueChange={(newVal) => {
                    setEquationSettings({ ...equationSettings, add: newVal });
                  }}
                />
                <Text style={styles.text}>-</Text>
                <Switch
                  value={equationSettings.subtract}
                  onValueChange={(newVal) => {
                    setEquationSettings({
                      ...equationSettings,
                      subtract: newVal,
                    });
                  }}
                />
                <Text style={styles.text}>/</Text>
                <Switch
                  value={equationSettings.division}
                  onValueChange={(newVal) => {
                    setEquationSettings({
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
                <Button
                  title="Save"
                  onPress={() => {
                    saveGame();
                    setStoredSettingsData(JSON.stringify(settingsData));
                    setEquationSettingsStore(JSON.stringify(equationSettings));
                    displayMessageCallback("Saved", 3000);
                  }}
                />
                <ConfirmableButton
                  title="Reset"
                  description="Will delete current save data and reset to initial state."
                  onPress={() => {
                    AsyncStorage.removeItem(saveDataKey);
                    setGameState(emptySaveData);
                  }}
                />
              </View>
              <View style={{ alignSelf: "center", margin: 10 }}>
                {showMessage && (
                  <Text style={{ ...styles.text }}>{showMessage}</Text>
                )}
              </View>
            </View>
          </BottomModal>
          <MuteToggle
            init={mute}
            onToggleChange={(newVal) => {
              setMute(newVal);
            }}
          />
        </View>

        <StatusBar style="auto" />
      </View>
    </Context.Provider>
  );
}

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
