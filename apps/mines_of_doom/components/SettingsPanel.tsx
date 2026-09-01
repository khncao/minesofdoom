import { memo, useMemo, type ComponentProps } from "react";
import { Switch, Text, View } from "react-native";
import Button from "apps/components/Button";
import ConfirmableButton from "apps/components/ConfirmableButton";
import IntegerInput from "apps/components/IntegerInput";
import BottomModal from "apps/components/BottomModal";
import Tooltip from "apps/components/Tooltip";
import MuteToggle from "apps/components/MuteToggle";
import { EquationSettings } from "apps/utils/math/equations";
import { SettingsData } from "../game";
import CosmeticsSection from "./CosmeticsSection";
import { styles } from "../styles";

/**
 * How a correct answer pays, per operator (kept in sync with useEquations:
 * gain = answer × clickPower × comboMultiplier, division ×10, subtraction ×2).
 */
const OPERATOR_HELP: Record<
  "multiply" | "add" | "subtract" | "division",
  { symbol: string; note: string }
> = {
  multiply: { symbol: "*", note: "No operator bonus (×1)." },
  add: { symbol: "+", note: "No operator bonus (×1)." },
  subtract: {
    symbol: "-",
    note: "Operator bonus ×2. Answers are always whole & non-negative.",
  },
  division: {
    symbol: "/",
    note: "Operator bonus ×10. Division is always exact.",
  },
};

const GAIN_FORMULA =
  "Minerals mined per correct answer = answer × click power × combo multiplier, plus any operator bonus.";

// Memoized so re-renders from tapping the mine don't re-render the whole
// settings UI (switches, inputs, modal) on every tap.
const SettingsContent = memo(function SettingsContent({
  settingsData,
  onChangeSettingsData,
  equationSettings,
  onChangeEquationSettings,
  showMessage,
  onSave,
  onReset,
  cosmetics,
}: {
  settingsData: SettingsData;
  onChangeSettingsData: (newSettings: SettingsData) => void;
  equationSettings: EquationSettings;
  onChangeEquationSettings: (newSettings: EquationSettings) => void;
  showMessage: string | null;
  onSave: () => void;
  onReset: () => void;
  cosmetics: ComponentProps<typeof CosmeticsSection>;
}) {
  return (
    <View style={{ gap: 2, marginTop: 5 }}>
      <IntegerInput
        label="Autosave interval (seconds): "
        defaultValue={settingsData.autosave}
        onChangeValue={(newVal) =>
          onChangeSettingsData({
            ...settingsData,
            autosave: Math.min(600, Math.max(5, newVal)),
          })
        }
      />
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
        {(Object.keys(OPERATOR_HELP) as Array<keyof typeof OPERATOR_HELP>).map(
          (key) => (
            <View
              key={key}
              style={{ flexDirection: "row", alignItems: "center", gap: 2 }}
            >
              <Tooltip
                label={`${key} equations`}
                content={`${OPERATOR_HELP[key].note} ${GAIN_FORMULA}`}
              >
                <Text style={styles.text}>{OPERATOR_HELP[key].symbol}</Text>
              </Tooltip>
              <Switch
                value={equationSettings[key]}
                onValueChange={(newVal) => {
                  onChangeEquationSettings({
                    ...equationSettings,
                    [key]: newVal,
                  });
                }}
              />
            </View>
          ),
        )}
      </View>
      <View style={styles.flexCenteredRow}>
        <Text style={{ ...styles.text, fontSize: 11, color: "#aaa" }}>
          Long-press an operator to see how it pays
        </Text>
      </View>
      <CosmeticsSection {...cosmetics} />
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

const SettingsPanel = ({
  settingsData,
  onChangeSettingsData,
  equationSettings,
  onChangeEquationSettings,
  showMessage,
  onSave,
  onReset,
  cosmetics,
  mute,
  onMuteChange,
}: {
  settingsData: SettingsData;
  onChangeSettingsData: (newSettings: SettingsData) => void;
  equationSettings: EquationSettings;
  onChangeEquationSettings: (newSettings: EquationSettings) => void;
  showMessage: string | null;
  onSave: () => void;
  onReset: () => void;
  cosmetics: ComponentProps<typeof CosmeticsSection>;
  mute: boolean;
  onMuteChange: (newVal: boolean) => void;
}) => {
  // Stable element so the memoized BottomModal can skip re-rendering on
  // every tap (it only changes when settings or the message actually change).
  const settingsChildren = useMemo(
    () => (
      <SettingsContent
        settingsData={settingsData}
        onChangeSettingsData={onChangeSettingsData}
        equationSettings={equationSettings}
        onChangeEquationSettings={onChangeEquationSettings}
        showMessage={showMessage}
        onSave={onSave}
        onReset={onReset}
        cosmetics={cosmetics}
      />
    ),
    [
      settingsData,
      onChangeSettingsData,
      equationSettings,
      showMessage,
      onChangeEquationSettings,
      onSave,
      onReset,
      cosmetics,
    ],
  );

  return (
    <View
      style={{
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        margin: 10,
      }}
    >
      <BottomModal>{settingsChildren}</BottomModal>
      <MuteToggle init={mute} onToggleChange={onMuteChange} />
    </View>
  );
};

export default SettingsPanel;
