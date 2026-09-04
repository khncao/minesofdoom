import { memo, useState, type ComponentProps } from "react";
import { Pressable, Switch, Text, TextInput, View } from "react-native";
import Button from "src/components/Button";
import ConfirmableButton from "src/components/ConfirmableButton";
import IntegerInput from "src/components/IntegerInput";
import Tooltip from "src/components/Tooltip";
import { useI18n } from "src/hooks/useI18n";
import {
  SUPPORTED_LOCALES,
  type LanguagePref,
  type TranslationKey,
} from "src/utils/i18n/i18n";
import {
  formatAgo,
  type CloudSaveSettingsProps,
} from "../hooks/useCloudSave";
import {
  EquationSettings,
  OPERATOR_KEYS,
  Ops,
  getOpDisplay,
  type OperatorKey,
  type MultiplySymbol,
} from "src/utils/math/equations";
import { AnalyticsState, summarizeAnalytics } from "../analytics";
import { SettingsData } from "../game";
import { formatCrashContext } from "../crashContext";
import { useCrashLog } from "../hooks/useCrashLog";
import CosmeticsSection from "./CosmeticsSection";
import InquiriesButton from "./InquiriesButton";
import LegalSection from "./LegalSection";
import { styles } from "../styles";

/**
 * How a correct answer pays, per equation type (kept in sync with
 * getEquationOpBonus: division ×10, square ×4, percent ×3, missing ×3,
 * subtraction ×2, +/* ×1). The tooltip text is a translation key
 * (settings.op.*).
 */
const OPERATOR_HELP: Record<OperatorKey, { symbol: string; noteKey: TranslationKey }> = {
  multiply: { symbol: "*", noteKey: "settings.op.multiply" },
  add: { symbol: "+", noteKey: "settings.op.add" },
  subtract: {
    symbol: "-",
    noteKey: "settings.op.subtract",
  },
  division: {
    symbol: "/",
    noteKey: "settings.op.division",
  },
  percent: {
    symbol: "%",
    noteKey: "settings.op.percent",
  },
  square: {
    symbol: "²",
    noteKey: "settings.op.square",
  },
  missing: {
    symbol: "?",
    noteKey: "settings.op.missing",
  },
};

/**
 * Human names for the operatorEquations label ("{name} equations") — the
 * raw keys would otherwise render untranslated in every locale.
 */
const OP_NAME_KEYS: Record<OperatorKey, TranslationKey> = {
  multiply: "settings.opName.multiply",
  add: "settings.opName.add",
  subtract: "settings.opName.subtract",
  division: "settings.opName.division",
  percent: "settings.opName.percent",
  square: "settings.opName.square",
  missing: "settings.opName.missing",
};

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
  onScreenKeypad,
  onKeypadChange,
  hardModeUnlocked,
  analytics,
  onClearAnalytics,
  cloudSave,
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
  /** On-screen keypad (todo: keypad tab view) — an
   *  AsyncStorage-backed display preference owned by MinesOfDoom; the
   *  switch applies immediately (no Save tap), like the mute toggle. */
  onScreenKeypad: boolean;
  onKeypadChange: (newVal: boolean) => void;
  /** Tier-5 (Motherlode) complete → the switch is live, otherwise it
   *  renders locked (visible-but-locked, plan §4.6). */
  hardModeUnlocked: boolean;
  /** Guardrail 6: the local analytics record (null until loaded, or after
   *  the player clears it) — feeds the "Local stats (debug)" section. */
  analytics: AnalyticsState | null;
  /** Data-deletion path for the analytics record (module docs). */
  onClearAnalytics: () => void;
  /** Cloud-backup section (plan §Cloud save); the section itself renders
   *  only while its `available` flag is set (the "hidden until
   *  configured" rule lives in the hook's provider). */
  cloudSave: CloudSaveSettingsProps;
}) {
  const [exportedCode, setExportedCode] = useState<string | null>(null);
  const [importCode, setImportCode] = useState("");
  // Language picker (todo: "Add localizations"): the persisted preference
  // lives in useI18n (NOT in SettingsData — changing it must not wait for a
  // Save tap); the chips show each language in its own name.
  const { language, setLanguage, t } = useI18n();
  const languagePrefs: readonly LanguagePref[] = ["auto", "en", "es"];
  return (
    <View style={{ gap: 2, marginTop: 5 }} testID="settings-view">
      <View style={styles.flexCenteredRow}>
        <Text style={{ ...styles.text, fontSize: 11 }}>
          {t("settings.language")}
        </Text>
        <View style={{ flexDirection: "row", gap: 4 }}>
          {languagePrefs.map((pref) => (
            <Pressable
              key={pref}
              accessibilityRole="button"
              onPress={() => setLanguage(pref)}
              style={{
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 6,
                backgroundColor:
                  language === pref ? "#555" : "#2a2a2a",
              }}
            >
              <Text style={{ ...styles.text, fontSize: 11 }}>
                {pref === "auto"
                  ? t("lang.auto")
                  : SUPPORTED_LOCALES[pref].nativeLabel}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <IntegerInput
        label={t("settings.autosave")}
        defaultValue={settingsData.autosave}
        onChangeValue={(newVal) =>
          onChangeSettingsData({
            ...settingsData,
            autosave: Math.min(600, Math.max(5, newVal)),
          })
        }
      />
      <IntegerInput
        label={t("settings.maxNumber")}
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
          // 7 toggles (iteration 11) no longer fit a phone-width row —
          // let them wrap instead of overflowing.
          flexWrap: "wrap",
        }}
      >
        {OPERATOR_KEYS.map((key) => (
            <View
              key={key}
              style={{ flexDirection: "row", alignItems: "center", gap: 2 }}
            >
              <Tooltip
                label={t("settings.operatorEquations", {
                  name: t(OP_NAME_KEYS[key]),
                })}
                content={`${t(OPERATOR_HELP[key].noteKey)} ${t("settings.gainFormula")}`}
              >
                <Text style={styles.text}>
                  {key === "multiply"
                    ? getOpDisplay(Ops.mult, equationSettings.multiplySymbol)
                    : OPERATOR_HELP[key].symbol}
                </Text>
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
          {t("settings.operatorHelp")}
        </Text>
      </View>
      {/* Multiply-symbol display toggle (todo: "Configurable equation
          display"): "7 * 2" vs "7 x 2". The previews are literal — they
          are the two possible renderings, not translatable copy. */}
      <View style={{ ...styles.flexCenteredRow, gap: 4 }}>
        <Text style={{ ...styles.text, fontSize: 11 }}>
          {t("settings.multiplySymbol")}
        </Text>
        <View style={{ flexDirection: "row", gap: 4 }}>
          {(["asterisk", "letter"] as const).map((sym: MultiplySymbol) => (
            <Pressable
              key={sym}
              accessibilityRole="button"
              onPress={() =>
                onChangeEquationSettings({
                  ...equationSettings,
                  multiplySymbol: sym,
                })
              }
              style={{
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 6,
                backgroundColor:
                  equationSettings.multiplySymbol === sym
                    ? "#555"
                    : "#2a2a2a",
              }}
            >
              <Text style={{ ...styles.text, fontSize: 11 }}>
                {sym === "asterisk" ? "7 * 2" : "7 x 2"}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <Tooltip label={t("settings.tooltipHard")} content={t("settings.hardModeHelp")}>
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
              ? t("settings.hardMode")
              : t("settings.hardModeLocked")}
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
      <Tooltip label={t("settings.tooltipStreak")} content={t("settings.streakModeHelp")}>
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
            {t("settings.streakMode")}
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
      {/* Mental math tips (todo): a short teaching section on the
          equation-solving tricks — rendered before the cosmetics/shop
          sections so it sits with the equation settings it explains. */}
      <TipsSection />
      {/* Always available (no tier gate): timed mode is opt-in risk/
          reward — the timeout penalty goes through the normal wrong-answer
          path, so it's strictly self-inflicted when off (the default). */}
      <Tooltip label={t("settings.tooltipTimed")} content={t("settings.timedModeHelp")}>
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
            {t("settings.timedMode")}
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
      <Tooltip label={t("settings.tooltipEmojiArt")} content={t("settings.emojiArtHelp")}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Text style={{ ...styles.text, fontSize: 11 }}>
            {t("settings.emojiArt")}
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
        label={t("settings.tooltipShowAll")}
        content={t("settings.showAllPurchasesHelp")}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Text style={{ ...styles.text, fontSize: 11 }}>
            {t("settings.showAllPurchases")}
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
      {/* On-screen keypad (todo: keypad tab view): overrides the native
          keypad when on — the answer box becomes read-only and the
          3-column keypad appears as a tab beside the upgrades list. */}
      <Tooltip
        label={t("settings.onScreenKeypad")}
        content={t("settings.onScreenKeypadHelp")}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Text style={{ ...styles.text, fontSize: 11 }}>
            {t("settings.onScreenKeypad")}
          </Text>
          <Switch
            value={onScreenKeypad}
            onValueChange={onKeypadChange}
          />
        </View>
      </Tooltip>
      <CosmeticsSection {...cosmetics} />
      <View style={{ gap: 6, marginTop: 10 }}>
        <Text style={{ ...styles.text, fontWeight: "bold" }}>
          {t("settings.saveCode")}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
          <Button title={t("settings.export")} onPress={() => setExportedCode(onExportSaveCode())} />
          <Button
            title={t("settings.import")}
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
            accessibilityLabel={t("settings.a11ySaveCode")}
          />
        )}
        <TextInput
          value={importCode}
          onChangeText={setImportCode}
          multiline
          numberOfLines={3}
          placeholder={t("settings.importPlaceholder")}
          placeholderTextColor="#999"
          style={styles.saveCodeInput}
        />
        <Text style={{ ...styles.text, fontSize: 11, color: "#aaa" }}>
          {t("settings.saveCodeHelp")}
        </Text>
      </View>
      <View
        style={{
          ...styles.flexCenteredRow,
          gap: 4,
          marginTop: 10,
        }}
      >
        <Button title={t("settings.saveButton")} onPress={onSave} />
        <ConfirmableButton
          title={t("settings.resetButton")}
          description={t("settings.resetDescription")}
          onPress={onReset}
        />
      </View>
      <CloudSaveSection cloudSave={cloudSave} />
      <AnalyticsSection analytics={analytics} onClear={onClearAnalytics} />
      <CrashLogSection />
      {/* Essential legal notices (todo): privacy policy + terms/disclaimer,
          in-app links at the very bottom of settings. */}
      <LegalSection />
      {/* Mailing link lives inside settings (todo) instead of the footer: it
          is a rarely-used action, and the footer is the always-visible row. */}
      <View style={styles.flexCenteredRow}>
        <InquiriesButton />
      </View>
      <View style={{ alignSelf: "center", margin: 10 }}>
        {showMessage && <Text style={{ ...styles.text }}>{showMessage}</Text>}
      </View>
    </View>
  );
});

/**
 * The eight tips, in display order (title + body are separate keys so
 * the title can be bolded in the UI without parsing a template).
 */
const TIPS: readonly { title: TranslationKey; body: TranslationKey }[] = [
  { title: "settings.tip.add.title", body: "settings.tip.add.body" },
  { title: "settings.tip.five.title", body: "settings.tip.five.body" },
  { title: "settings.tip.nine.title", body: "settings.tip.nine.body" },
  { title: "settings.tip.dblhalve.title", body: "settings.tip.dblhalve.body" },
  { title: "settings.tip.percent.title", body: "settings.tip.percent.body" },
  { title: "settings.tip.square.title", body: "settings.tip.square.body" },
  {
    title: "settings.tip.missing.title",
    body: "settings.tip.missing.body",
  },
  {
    title: "settings.tip.division.title",
    body: "settings.tip.division.body",
  },
];

/**
 * Mental math tips (todo: "Add a tips section in settings menu teaching
 * techniques for mental arithmetic"). Pure presentation over i18n keys —
 * no state, so it memoizes trivially by being a top-level component.
 */
function TipsSection() {
  const { t } = useI18n();
  return (
    <View style={{ gap: 6, marginTop: 10 }} testID="tips-section">
      <Text style={{ ...styles.text, fontWeight: "bold" }}>
        {t("settings.tips")}
      </Text>
      {TIPS.map((tip) => (
        <View
          key={tip.title}
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
          <Text style={{ ...styles.text, fontSize: 12, fontWeight: "bold" }}>
            {t(tip.title)}
          </Text>
          <Text style={{ ...styles.text, fontSize: 11, color: "#aaa" }}>
            {t(tip.body)}
          </Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Cloud backup section (docs/store-integration.md §3):
 * the toggle, the "last sync" status line, and the manual restore.
 * Rendered only while the provider is available (dev-sim in dev builds,
 * the Pocketbase provider once the URL lands — until then the section is
 * absent, same "hidden until configured" rule as the ad/IAP entry
 * points). A dev build labels itself "(simulated)" (transparency
 * guardrail: the in-memory simulation is not a durable backup).
 */
function CloudSaveSection({ cloudSave }: { cloudSave: CloudSaveSettingsProps }) {
  const { t } = useI18n();
  if (!cloudSave.available) return null;
  const { lastSync } = cloudSave;
  const statusText =
    lastSync.state === "failed"
      ? t("settings.cloudLastSyncFailed")
      : lastSync.state === "ok" && lastSync.at != null
        ? t("settings.cloudLastSyncOk", { when: formatAgo(lastSync.at, Date.now()) })
        : t("settings.cloudNeverSynced");
  return (
    <View style={{ gap: 6, marginTop: 10 }} testID="cloud-save-section">
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
      >
        <Text style={{ ...styles.text, fontWeight: "bold" }}>
          {t("settings.cloudSave")}
          {cloudSave.isDevSim ? t("settings.cloudSim") : ""}
        </Text>
        <Switch value={cloudSave.enabled} onValueChange={cloudSave.setEnabled} />
      </View>
      <Text style={{ ...styles.text, fontSize: 11, color: "#aaa" }}>
        {t("settings.cloudSaveHelp")}
      </Text>
      <Text style={{ ...styles.text, fontSize: 11, color: "#aaa" }}>
        {statusText}
      </Text>
      <ConfirmableButton
        title={t("settings.cloudRestore")}
        description={t("settings.cloudRestoreDescription")}
        onPress={cloudSave.onRestore}
      />
      {/* GDPR "delete my data" (plan §Backend): a real, reachable button
          with plain wording about what it does and doesn't remove (the
          section renders only while the provider is available, so the
          button is never a no-op — transparency guardrail). */}
      <ConfirmableButton
        title={t("settings.deleteData")}
        description={t("settings.deleteDataDescription")}
        onPress={cloudSave.onDeleteData}
      />
    </View>
  );
}

/**
 * Debug section (guardrail 5 "measure before scaling"): the local
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
  const { t } = useI18n();
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
          {t("settings.analytics")}
        </Text>
        <Button title={t("settings.clear")} onPress={onClear} />
      </View>
      <Text
        selectable
        style={{ color: "#d6c48f", fontSize: 10, lineHeight: 14 }}
      >
        {summarizeAnalytics(analytics)}
      </Text>
      <Text style={{ ...styles.text, fontSize: 11, color: "#aaa" }}>
        {t("settings.analyticsNote")}
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
  const { t } = useI18n();
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
          {t("settings.crash")}
        </Text>
        <Button title={t("settings.clear")} onPress={clear} />
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
