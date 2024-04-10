import { StatusBar } from "expo-status-bar";
import {
  MutableRefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { AVPlaybackSource, Audio } from "expo-av";
import AsyncStorage, {
  useAsyncStorage,
} from "@react-native-async-storage/async-storage";
import ModalButton from "./components/ModalButton";
import ConfirmableButton from "./components/ConfirmableButton";
import IntegerInput from "./components/IntegerInput";
import Miner from "./components/Miner";
import { AppContext } from "./AppContext";
import MuteToggle from "./components/MuteToggle";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { pickaxeSound, stoneSound } from "./public/assets";
import Button from "./components/Button";

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
  minNumber: number;
  maxNumber: number;
  multiply: boolean;
  add: boolean;
  subtract: boolean;
  division: boolean;
};

const Ops = {
  mult: "*",
  add: "+",
  sub: "-",
  div: "/",
};

// TODO: number to bigint
const saveDataKey = "save";
const saveVersion = 1;
const settingsDataKey = "settings";
const msPerTick = 1000;
const gemChance = 0.05;
const gemMineralCost = 100000;

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
  minNumber: 0,
  maxNumber: 12,
  multiply: true,
  add: false,
  subtract: false,
  division: false,
};

const mineralIcon = (
  <Text style={{ fontSize: 20, userSelect: "none" }}>🪨</Text>
);
const gemIcon = <Text style={{ fontSize: 20, userSelect: "none" }}>💎</Text>;

function getRandomInt(max: number) {
  return Math.floor(Math.random() * max);
}

function getRandomEquation(prefs: SettingsData) {
  const ops: Array<string> = [
    ...(prefs.multiply ? [Ops.mult] : []),
    ...(prefs.add ? [Ops.add] : []),
    ...(prefs.subtract ? [Ops.sub] : []),
    ...(prefs.division ? [Ops.div] : []),
  ];
  const opIdx = Math.floor(Math.random() * ops.length);
  const op = ops[opIdx];
  const a = getRandomInt(prefs.maxNumber);
  let b = getRandomInt(prefs.maxNumber);
  if (op === Ops.div) {
    b = Math.max(1, b);
  }
  let answer;
  switch (op) {
    case Ops.mult:
      answer = a * b;
      break;
    case Ops.add:
      answer = a + b;
      break;
    case Ops.sub:
      answer = a - b;
      break;
    case Ops.div:
      answer = Math.fround(a / b);
  }
  return { op, a, b, answer };
}

function getClickUpgradeCost(level: number): number {
  return level * level * level * level;
}

function getMinerUpgradeCost(current: number): number {
  return current * current * current * current + 1;
}

function rollGem(comboMultiplier: number) {
  return Math.random() < gemChance * comboMultiplier;
}

const approxeq = (v1: number, v2: number, epsilon = 0.01) =>
  Math.abs(v1 - v2) <= epsilon;

export default function App() {
  const startTime = useRef(Date.now());

  const [settingsData, setSettingsData] = useState(defaultSettingsData);
  const [gameState, setGameState] = useState<SaveData>(emptySaveData);
  const { getItem: getSaveData, setItem: setSaveData } =
    useAsyncStorage(saveDataKey);
  const { getItem: getStoredSettingsData, setItem: setStoredSettingsData } =
    useAsyncStorage(settingsDataKey);

  // currently doesn't mute android touch sounds, but can in the future
  const [mute, setMute] = useLocalStorage<boolean>("mute", false);

  const [combo, setCombo] = useState(0);
  const comboMultiplier = 1 + Math.floor(combo / 10);

  const onTick = useRef<Array<() => void>>([]);
  const [tick, setTick] = useState(0);

  // Load stored data
  useEffect(() => {
    getStoredSettingsData().then((data) => {
      if (data == null) {
        return;
      }
      const settingsData: SettingsData = JSON.parse(data);
      setSettingsData(settingsData);
      console.log("loaded settings");
    });
    getSaveData().then((data) => {
      if (data == null) {
        return;
      }
      const saveData: SaveData = JSON.parse(data);
      const elapsedTicks = Math.floor(
        (Date.now() - saveData.saveTime) / msPerTick
      );
      setGameState({
        ...saveData,
        minerals:
          saveData.minerals +
          saveData.miners * saveData.minerPower * elapsedTicks,
      });
      startTime.current = saveData.startTime;
      console.log("loaded save");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [showMessage, setShowMessage] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const displayMessageCallback = useCallback(
    (message: string, timeout: number) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => setShowMessage(null), timeout);
      setShowMessage(message);
    },
    []
  );

  const saveGame = useCallback(() => {
    gameState.saveTime = Date.now();
    const data = JSON.stringify(gameState);
    // console.log(data);
    setSaveData(data);
  }, [gameState, setSaveData]);

  const timeout = useRef<NodeJS.Timeout>();

  // Main loop interval
  useEffect(() => {
    clearTimeout(timeout.current);
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
      if (tick % 10 === 0) {
        saveGame();
      }
      console.log(`tick: ${tick}`);
      setTick((old) => old + 1);
    }, msPerTick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  // Audio
  const [sound, setSound] = useState<Audio.Sound>();
  async function playSound(audio: AVPlaybackSource) {
    if (mute) {
      return;
    }
    const { sound } = await Audio.Sound.createAsync(audio);
    setSound(sound);

    await sound.playAsync();
  }
  useEffect(() => {
    return sound
      ? () => {
          sound.unloadAsync();
        }
      : undefined;
  }, [sound]);

  const playerPickaxeAnimRef: MutableRefObject<() => void> = useRef<() => void>(
    () => {}
  );

  // Logic
  const textInputRef = useRef<null | TextInput>(null);
  const [textInput, setTextInput] = useState("");
  const [equation, setEquation] = useState(getRandomEquation(settingsData));

  const submit = () => {
    let value = -1;
    try {
      value = Number.parseFloat(textInput);
    } catch (e) {
      console.log(e);
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
      playSound(pickaxeSound);
      playerPickaxeAnimRef.current();
      setCombo(combo + 1);
      console.log("submit hit");
    } else {
      playSound(stoneSound);
      setCombo(0);
      console.log("submit miss");
    }
    setTextInput("");
    setEquation(getRandomEquation(settingsData));
  };

  return (
    <AppContext.Provider value={{ onTick: onTick.current }}>
      <View style={styles.container}>
        <Text style={styles.text}>
          {equation.a} {equation.op} {equation.b}?
        </Text>

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
              textAlign: "center",
              borderColor: "white",
              borderWidth: 1,
            }}
          />
        </KeyboardAvoidingView>

        <Text style={styles.text}>Combo: {combo}</Text>
        <Text style={styles.text}>Multplier: x{comboMultiplier}</Text>

        {
          // Purchaseables
        }
        <View style={{ gap: 5, flex: 1, marginTop: 8 }}>
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
              gameState.clickPower
            )} 🪨) (${gameState.clickPower})`}
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
            title={`BUY A MINER (-${getMinerUpgradeCost(
              gameState.miners
            )} 💎) (${gameState.miners})`}
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
            title={`BUY A GEM (-${gemMineralCost} 🪨)`}
          />
        </View>

        <Pressable
          onPress={() => {
            setGameState((n: SaveData) => {
              return {
                ...n,
                minerals: n.minerals + gameState.clickPower,
              };
            });
            playSound(pickaxeSound);
            playerPickaxeAnimRef.current();
            setCombo(0);
            console.log("click");
          }}
          style={{ ...styles.canvas, paddingTop: 10 }}
        >
          <View>
            <View style={{ flexDirection: "row", justifyContent: "center" }}>
              {mineralIcon}
              <Text style={{ ...styles.text, alignSelf: "center" }}>
                {gameState.minerals}
              </Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "center" }}>
              {gemIcon}
              <Text style={{ ...styles.text, alignSelf: "center" }}>
                {gameState.gems}
              </Text>
            </View>

            <Miner key={"player"} animateRef={playerPickaxeAnimRef} />
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
        <View
          style={{
            flexDirection: "row",
            alignSelf: "stretch",
            justifyContent: "space-between",
          }}
        >
          <View
            style={{
              alignSelf: "flex-start",
              flexDirection: "row",
              alignItems: "center",
              margin: 10,
            }}
          >
            <ModalButton style={{ alignSelf: "flex-start" }}>
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
                  defaultValue={settingsData.maxNumber}
                  onChangeValue={(newVal) =>
                    setSettingsData({ ...settingsData, maxNumber: newVal })
                  }
                />
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    justifyContent: "center",
                  }}
                >
                  <Text style={styles.text}>*</Text>
                  <Switch
                    value={settingsData.multiply}
                    onValueChange={(newVal) => {
                      setSettingsData({ ...settingsData, multiply: newVal });
                    }}
                  />
                  <Text style={styles.text}>+</Text>
                  <Switch
                    value={settingsData.add}
                    onValueChange={(newVal) => {
                      setSettingsData({ ...settingsData, add: newVal });
                    }}
                  />
                  <Text style={styles.text}>-</Text>
                  <Switch
                    value={settingsData.subtract}
                    onValueChange={(newVal) => {
                      setSettingsData({ ...settingsData, subtract: newVal });
                    }}
                  />
                  <Text style={styles.text}>/</Text>
                  <Switch
                    value={settingsData.division}
                    onValueChange={(newVal) => {
                      setSettingsData({ ...settingsData, division: newVal });
                    }}
                  />
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    justifyContent: "center",
                    marginTop: 10,
                  }}
                >
                  <Button
                    title="Save"
                    onPress={() => {
                      saveGame();
                      setStoredSettingsData(JSON.stringify(settingsData));
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
            </ModalButton>
            <MuteToggle
              init={mute}
              onToggleChange={(newVal) => {
                setMute(newVal);
              }}
            />
          </View>
        </View>

        <StatusBar style="auto" />
      </View>
    </AppContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#2f2f2f",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  footer_container: {
    flex: 1 / 3,
    alignItems: "center",
    justifyContent: "flex-end",
    alignContent: "flex-end",
    gap: 4,
  },
  canvas: {
    // flex: 1,
    minWidth: "98%",
    backgroundColor: "#2f1f1f",
  },
  flex_row: {},
  text: {
    color: "#fff",
    userSelect: "none",
  },
});
