import { memo, useMemo } from "react";
import { Switch, Text, View } from "react-native";
import Button from "apps/components/Button";
import ConfirmableButton from "apps/components/ConfirmableButton";
import IntegerInput from "apps/components/IntegerInput";
import BottomModal from "apps/components/BottomModal";
import MuteToggle from "apps/components/MuteToggle";
import { EquationSettings } from "apps/utils/math/equations";
import { SettingsData } from "../game";
import { styles } from "../styles";

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
}: {
  settingsData: SettingsData;
  onChangeSettingsData: (newSettings: SettingsData) => void;
  equationSettings: EquationSettings;
  onChangeEquationSettings: (newSettings: EquationSettings) => void;
  showMessage: string | null;
  onSave: () => void;
  onReset: () => void;
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

const SettingsPanel = ({
  settingsData,
  onChangeSettingsData,
  equationSettings,
  onChangeEquationSettings,
  showMessage,
  onSave,
  onReset,
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
