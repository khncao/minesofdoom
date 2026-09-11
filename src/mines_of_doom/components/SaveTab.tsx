import { memo, useState } from "react";
import { Switch, Text, TextInput, View } from "react-native";
import Button from "src/components/Button";
import ConfirmableButton from "src/components/ConfirmableButton";
import IntegerInput from "src/components/IntegerInput";
import { useT } from "src/hooks/useI18n";
import { formatAgo, type CloudSaveSettingsProps } from "../hooks/useCloudSave";
import { SettingsData } from "../game";
import { styles } from "../styles";

/**
 * Menu "Save" tab (todo: "reorganize menus with clean reimplementation"):
 * everything about the SAVE DATA — the autosave interval, the manual
 * export/import code, the Save + Reset actions, and the cloud backup
 * section. The gameplay preferences moved to the Settings tab and persist
 * per change; the Save button here saves the game and confirms with a
 * toast.
 */
const SaveTab = memo(function SaveTab({
  settingsData,
  onChangeSettingsData,
  showMessage,
  onSave,
  onReset,
  onEraseAllData,
  onExportSaveCode,
  onImportSaveCode,
  cloudSave,
}: {
  settingsData: SettingsData;
  onChangeSettingsData: (newSettings: SettingsData) => void;
  showMessage: string | null;
  onSave: () => void;
  onReset: () => void;
  /** "Erase all data" (a superset of Reset — see eraseAll.ts): wipes
   *  everything the app persists locally, not just the save. */
  onEraseAllData: () => void;
  /** Plan §4.3: returns the current save as a shareable base64 code. */
  onExportSaveCode: () => string;
  /** Plan §4.3: imports a save code; returns false (and toasts) on failure. */
  onImportSaveCode: (code: string) => boolean;
  /** Cloud-backup section bundle; the section hides itself while the
   *  provider is unavailable ("hidden until configured"). */
  cloudSave: CloudSaveSettingsProps;
}) {
  const [exportedCode, setExportedCode] = useState<string | null>(null);
  const [importCode, setImportCode] = useState("");
  const t = useT();
  return (
    <View style={{ gap: 2, marginTop: 5 }} testID="save-view">
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
      <View style={{ gap: 6, marginTop: 10 }}>
        <Text style={{ ...styles.text, fontWeight: "bold" }}>
          {t("settings.saveCode")}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
          <Button
            title={t("settings.export")}
            onPress={() => setExportedCode(onExportSaveCode())}
          />
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
        <Text style={{ ...styles.text, fontSize: 11, color: "#bbb" }}>
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
      <View style={{ alignSelf: "stretch", marginTop: 8 }} testID="erase-all-data">
        <ConfirmableButton
          title={t("settings.eraseAllData")}
          description={t("settings.eraseAllDataDescription")}
          onPress={onEraseAllData}
        />
      </View>
      <CloudSaveSection cloudSave={cloudSave} />
      <View style={{ alignSelf: "center", margin: 10 }}>
        {showMessage && <Text style={{ ...styles.text }}>{showMessage}</Text>}
      </View>
    </View>
  );
});

/**
 * Cloud backup section (docs/store-integration.md §3):
 * the toggle, the "last sync" status line, and the manual restore.
 * Rendered only while the provider is available (dev-sim in dev builds,
 * the Pocketbase provider once the URL lands — until then the section is
 * absent, same "hidden until configured" rule as the ad/IAP entry
 * points). A dev build labels itself "(simulated)" (transparency
 * guardrail: the in-memory simulation is not a durable backup).
 */
function CloudSaveSection({
  cloudSave,
}: {
  cloudSave: CloudSaveSettingsProps;
}) {
  const t = useT();
  if (!cloudSave.available) return null;
  const { lastSync } = cloudSave;
  const statusText =
    lastSync.state === "failed"
      ? t("settings.cloudLastSyncFailed")
      : lastSync.state === "ok" && lastSync.at != null
        ? t("settings.cloudLastSyncOk", {
            when: formatAgo(lastSync.at, Date.now()),
          })
        : t("settings.cloudNeverSynced");
  return (
    <View style={{ gap: 6, marginTop: 10 }} testID="cloud-save-section">
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Text style={{ ...styles.text, fontWeight: "bold" }}>
          {t("settings.cloudSave")}
          {cloudSave.isDevSim ? t("settings.cloudSim") : ""}
        </Text>
        <Switch
          value={cloudSave.enabled}
          onValueChange={cloudSave.setEnabled}
        />
      </View>
      <Text style={{ ...styles.text, fontSize: 11, color: "#bbb" }}>
        {t("settings.cloudSaveHelp")}
      </Text>
      <Text style={{ ...styles.text, fontSize: 11, color: "#bbb" }}>
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
          button is never a no-op — transparency guardrail). With a live
          account session the DELETE is ACCOUNT scope (the legal
          erasure), so the copy says exactly that. */}
      <ConfirmableButton
        title={t("settings.deleteData")}
        description={
          cloudSave.signedIn
            ? t("settings.deleteDataAccountDescription")
            : t("settings.deleteDataDescription")
        }
        onPress={cloudSave.onDeleteData}
      />
    </View>
  );
}

export default SaveTab;
