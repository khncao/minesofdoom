import { memo, useState, type ComponentProps } from "react";
import { Switch, Text, TextInput, View } from "react-native";
import Button from "src/components/Button";
import ConfirmableButton from "src/components/ConfirmableButton";
import IntegerInput from "src/components/IntegerInput";
import Tooltip from "src/components/Tooltip";
import { EquationSettings } from "src/utils/math/equations";
import { AnalyticsState, summarizeAnalytics } from "../analytics";
import { SettingsData } from "../game";
import { formatCrashContext } from "../crashContext";
import { useCrashLog } from "../hooks/useCrashLog";
import CosmeticsSection from "./CosmeticsSection";
import LegalSection from "./LegalSection";
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
  "Minerals mined per correct answer = answer × click power × combo multiplier, plus any operator bonus. Hard-mode equations pay ×2 on top; timed-mode equations pay ×2 more when answered inside the window; an ignited streak pays ×2 more on top of all of it.";

/** Hard-mode switch tooltip (long-press). */
const HARD_MODE_HELP =
  "3-term equations (a ○ b ○ c, left to right) that pay ×2 the normal amount. The extra premium comes from the third term — more arithmetic, bigger answers.";

/** Timed-mode switch tooltip (long-press). */
const TIMED_MODE_HELP =
  "Every equation gets a 10-second window: answer in time and the payout gets ×2 (it stacks with the operator and hard-mode bonuses). When the window runs out the equation counts as a miss — your combo drops exactly like a wrong answer (combo resistance still applies) — and a new one rolls. Stacks with hard mode: a 3-term equation answered in time pays ×4 on top of the operator bonus.";;

/** Streak-mode switch tooltip (long-press). */
const STREAK_MODE_HELP =
  "Answer 5 equations correctly in a row and the streak ignites: every correct answer after that pays ×2 on top of everything else (it stacks with the operator, hard-mode, and timed-mode bonuses). One wrong answer — or a timed-mode timeout — breaks the run and the streak starts over at 0. Unlike your combo, holding the cave does NOT break the streak: the rule is simply no wrong answers.";

/** Emoji-art (low-end) switch tooltip (long-press). */
const EMOJI_ART_HELP =
  "Off (default): miners, currency icons, debris and the cave backdrop are procedural pixel sprites. On: plain emoji instead — lighter on low-end devices where PNG decode/render is the bottleneck. Purely visual; gameplay is unchanged.";

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
  analytics,
  onClearAnalytics,
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
  /** Guardrail 6: the local analytics record (null until loaded, or after
   *  the player clears it) — feeds the "Local stats (debug)" section. */
  analytics: AnalyticsState | null;
  /** Data-deletion path for the analytics record (module docs). */
  onClearAnalytics: () => void;
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
      {/* Always available (no tier gate): streak mode is opt-in risk/
          reward — the only cost of a broken streak is losing the premium,
          so it's strictly self-inflicted when off (the default). */}
      <Tooltip label="Streak mode equations" content={STREAK_MODE_HELP}>
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
              color: "#fff",
            }}
          >
            Streak mode (5 in a row for ×2): 
          </Text>
          <Switch
            value={equationSettings.streakMode}
            onValueChange={(newVal) => {
              onChangeEquationSettings({
                ...equationSettings,
                streakMode: newVal,
              });
            }}
          />
        </View>
      </Tooltip>
      {/* Always available (no tier gate): timed mode is opt-in risk/
          reward — the timeout penalty goes through the normal wrong-answer
          path, so it's strictly self-inflicted when off (the default). */}
      <Tooltip label="Timed mode equations" content={TIMED_MODE_HELP}>
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
              color: "#fff",
            }}
          >
            Timed mode (answer in 10s for ×2): 
          </Text>
          <Switch
            value={equationSettings.timedMode}
            onValueChange={(newVal) => {
              onChangeEquationSettings({
                ...equationSettings,
                timedMode: newVal,
              });
            }}
          />
        </View>
      </Tooltip>
      <Tooltip label="Emoji art (low-end mode)" content={EMOJI_ART_HELP}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Text style={{ ...styles.text, fontSize: 11 }}>
            Emoji art (low-end mode):
          </Text>
          <Switch
            value={settingsData.emojiArt}
            onValueChange={(newVal) => {
              onChangeSettingsData({
                ...settingsData,
                emojiArt: newVal,
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
      <AnalyticsSection analytics={analytics} onClear={onClearAnalytics} />
      <CrashLogSection />
      {/* Essential legal notices (todo): privacy policy + terms/disclaimer,
          in-app links at the very bottom of settings. */}
      <LegalSection />
      <View style={{ alignSelf: "center", margin: 10 }}>
        {showMessage && <Text style={{ ...styles.text }}>{showMessage}</Text>}
      </View>
    </View>
  );
});

/**
 * Debug section (guardrail 6 "measure before scaling"): the local
 * analytics record as a selectable, copyable summary — the measurement
 * the UA-spend decision is based on, readable without pulling the app off
 * the device. Rendered only while a record is loaded (the hook is the
 * single writer, so there's no second storage reader to race it); after
 * a Clear the section hides and a fresh record is established next open.
 */
function AnalyticsSection({
  analytics,
  onClear,
}: {
  analytics: AnalyticsState | null;
  onClear: () => void;
}) {
  if (analytics == null) return null;
  return (
    <View style={{ gap: 6, marginTop: 10 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text style={{ ...styles.text, fontWeight: "bold" }}>
          Local stats (debug)
        </Text>
        <Button title="Clear" onPress={onClear} />
      </View>
      <Text
        selectable
        style={{ color: "#d6c48f", fontSize: 10, lineHeight: 14 }}
      >
        {summarizeAnalytics(analytics)}
      </Text>
      <Text style={{ ...styles.text, fontSize: 11, color: "#aaa" }}>
        Stored on this device only — no network, no PII. Clear deletes
        it; a fresh record starts on the next open.
      </Text>
    </View>
  );
}

/**
 * Debug section (plan "Adjust"): the persisted crash log from
 * crashLogging.ts. Rendered only when at least one crash has been
 * recorded, so players who never crash never see it. The stack text is
 * selectable so a full trace can be copied off-device — the whole point
 * while chasing the unreproducible Android `describe` crash (release
 * builds have no red box).
 */
function CrashLogSection() {
  const { entries, clear } = useCrashLog();
  if (entries == null || entries.length === 0) return null;
  return (
    <View style={{ gap: 6, marginTop: 10 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text style={{ ...styles.text, fontWeight: "bold" }}>
          Recent errors (debug)
        </Text>
        <Button title="Clear" onPress={clear} />
      </View>
      {entries.slice(0, 3).map((entry, i) => {
        const contextText = formatCrashContext(entry.context);
        return (
          <View
            key={i}
            style={{
              backgroundColor: "#1f1f1f",
              borderRadius: 6,
              borderWidth: 1,
              borderColor: "#444",
              paddingHorizontal: 10,
              paddingVertical: 6,
              gap: 2,
            }}
          >
            <Text
              style={{ ...styles.text, fontSize: 12 }}
              selectable
            >
              {entry.name}: {entry.message}
              {entry.source === "global" ? " (global)" : ""}
              {entry.count > 1 ? ` (×${entry.count})` : ""}
            </Text>
            <Text style={{ ...styles.text, fontSize: 10, color: "#aaa" }}>
              {new Date(entry.ts).toLocaleString()}
            </Text>
            {entry.stack.length > 0 && (
              <Text
                selectable
                style={{ color: "#9fd69f", fontSize: 9, lineHeight: 13 }}
              >
                {entry.stack}
              </Text>
            )}
            {contextText.length > 0 && (
              <Text
                selectable
                style={{ color: "#d6c48f", fontSize: 9, lineHeight: 13 }}
              >
                {contextText}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

export default SettingsContent;
