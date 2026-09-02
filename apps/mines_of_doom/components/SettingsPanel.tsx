import { memo, useState, type ComponentProps } from "react";
import { Switch, Text, TextInput, View } from "react-native";
import Button from "apps/components/Button";
import ConfirmableButton from "apps/components/ConfirmableButton";
import IntegerInput from "apps/components/IntegerInput";
import Tooltip from "apps/components/Tooltip";
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
  "Minerals mined per correct answer = answer × click power × combo multiplier, plus any operator bonus. Hard-mode equations pay ×2 on top.";

/** Hard-mode switch tooltip (long-press). */
const HARD_MODE_HELP =
  "3-term equations (a ○ b ○ c, left to right) that pay ×2 the normal amount. The extra premium comes from the third term — more arithmetic, bigger answers.";

/** Show-all-purchases switch tooltip (long-press). */
const SHOW_ALL_PURCHASES_HELP =
  "Off (default): each upgrade button appears only once you've ever had enough minerals or gems to buy its first level — the screen stays uncluttered as the shop grows. The three core buttons (upgrade power, buy a miner, buy a gem) are always visible. On: every upgrade button is shown at all times, locked or not.";

/**
 * The settings view (plan "Adjust"): rendered inside the footer menu sheet
 * (MenuPanel) rather than behind its own button. Memoized so re-renders
 * from tapping the mine don't re-render the settings UI on every tap.
 */
const SettingsContent = memo(function SettingsContent({
  settingsData,
  onChangeSettingsData,
  equationSettings,
  onChangeEquationSettings,
  showMessage,
  onSave,
  onReset,
  onExportSaveCode,
  onImportSaveCode,
  cosmetics,
  hardModeUnlocked,
}: {
  settingsData: SettingsData;
  onChangeSettingsData: (newSettings: SettingsData) => void;
  equationSettings: EquationSettings;
  onChangeEquationSettings: (newSettings: EquationSettings) => void;
  showMessage: string | null;
  onSave: () => void;
  onReset: () => void;
  /** Plan §4.3: returns the current save as a shareable base64 code. */
  onExportSaveCode: () => string;
  /** Plan §4.3: imports a save code; returns false (and toasts) on failure. */
  onImportSaveCode: (code: string) => boolean;
  cosmetics: ComponentProps<typeof CosmeticsSection>;
  /** Tier-5 (Motherlode) complete → the switch is live, otherwise it
   *  renders locked (visible-but-locked, plan §4.6). */
  hardModeUnlocked: boolean;
}) {
  const [exportedCode, setExportedCode] = useState<string | null>(null);
  const [importCode, setImportCode] = useState("");
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
      <Tooltip label="Hard mode equations" content={HARD_MODE_HELP}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Text
            style={{
              ...styles.text,
              fontSize: 11,
              color: hardModeUnlocked ? "#fff" : "#aaa",
            }}
          >
            {hardModeUnlocked
              ? "Hard mode (3-term ×2): "
              : "🔒 Hard mode (Motherlode): "}
          </Text>
          <Switch
            value={equationSettings.hardMode}
            disabled={!hardModeUnlocked}
            onValueChange={(newVal) => {
              onChangeEquationSettings({
                ...equationSettings,
                hardMode: newVal,
              });
            }}
          />
        </View>
      </Tooltip>
      <Tooltip
        label="Always show all upgrade buttons"
        content={SHOW_ALL_PURCHASES_HELP}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Text style={{ ...styles.text, fontSize: 11 }}>
            Always show all upgrade buttons:
          </Text>
          <Switch
            value={settingsData.showAllPurchases}
            onValueChange={(newVal) => {
              onChangeSettingsData({
                ...settingsData,
                showAllPurchases: newVal,
              });
            }}
          />
        </View>
      </Tooltip>
      <CosmeticsSection {...cosmetics} />
      <View style={{ gap: 6, marginTop: 10 }}>
        <Text style={{ ...styles.text, fontWeight: "bold" }}>
          Save code (backup / share)
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
          <Button title="Export code" onPress={() => setExportedCode(onExportSaveCode())} />
          <Button
            title="Import code"
            disabled={importCode.trim().length === 0}
            onPress={() => {
              // Toasts (valid/invalid) come from the handler; on success
              // clear the field so it can't be re-imported by accident.
              if (onImportSaveCode(importCode)) setImportCode("");
            }}
          />
        </View>
        {exportedCode != null && (
          // Kept editable (with a no-op onChange) so the user can
          // long-press to select + copy; the value can't actually change.
          <TextInput
            value={exportedCode}
            onChangeText={() => {}}
            multiline
            numberOfLines={3}
            style={styles.saveCodeInput}
            accessibilityLabel="Your save code — select to copy"
          />
        )}
        <TextInput
          value={importCode}
          onChangeText={setImportCode}
          multiline
          numberOfLines={3}
          placeholder="Paste a save code to import it"
          placeholderTextColor="#999"
          style={styles.saveCodeInput}
        />
        <Text style={{ ...styles.text, fontSize: 11, color: "#aaa" }}>
          Export gives you a code to copy and share; importing a code
          replaces your current save with the one in the code.
        </Text>
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

export default SettingsContent;
