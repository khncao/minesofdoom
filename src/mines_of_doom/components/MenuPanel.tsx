import { memo, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import BottomModal from "src/components/BottomModal";
import { useT } from "src/hooks/useI18n";
import MuteToggle from "src/components/MuteToggle";
import { EquationSettings } from "src/utils/math/equations";
import { AnalyticsState } from "../analytics";
import type { ComponentProps } from "react";
import SettingsContent from "./SettingsPanel";
import GoalsContent from "./GoalsPanel";
import RecordsContent from "./RecordsPanel";
import CosmeticsSection from "./CosmeticsSection";
import { SaveData, SettingsData } from "../game";
import { styles } from "../styles";

type MenuView = "settings" | "goals" | "records";

/**
 * Footer menu (plan "Adjust"): one menu button replaces the old footer row
 * of settings + goals buttons. The sheet holds the mute toggle and a
 * settings/goals/records view switcher; the daily bonus button deliberately
 * stays outside on the footer so it's always one tap away.
 */
function MenuPanel({
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
  mute,
  onMuteChange,
  hardModeUnlocked,
  stats,
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
  onExportSaveCode: () => string;
  onImportSaveCode: (code: string) => boolean;
  cosmetics: ComponentProps<typeof CosmeticsSection>;
  mute: boolean;
  onMuteChange: (newVal: boolean) => void;
  hardModeUnlocked: boolean;
  /** Lifetime save data — feeds the goals view's derived progress. */
  stats: SaveData;
  /** Guardrail 6: the local analytics record for the settings debug
   *  section (single owner is MinesOfDoom's useAnalytics; this is a
   *  read-through, not a second storage reader). */
  analytics: AnalyticsState | null;
  /** Data-deletion path for the analytics record. */
  onClearAnalytics: () => void;
}) {
  const t = useT();
  const [view, setView] = useState<MenuView>("settings");

  // Stable elements so the memoized views skip re-rendering when only
  // unrelated state changed (mirrors the old SettingsPanel pattern).
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
        onExportSaveCode={onExportSaveCode}
        onImportSaveCode={onImportSaveCode}
        cosmetics={cosmetics}
        hardModeUnlocked={hardModeUnlocked}
        analytics={analytics}
        onClearAnalytics={onClearAnalytics}
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
      onExportSaveCode,
      onImportSaveCode,
      cosmetics,
      hardModeUnlocked,
      analytics,
      onClearAnalytics,
    ],
  );
  const goalsChildren = useMemo(() => <GoalsContent stats={stats} />, [stats]);
  const recordsChildren = useMemo(
    () => <RecordsContent stats={stats} />,
    [stats],
  );

  return (
    <BottomModal
      pressable={<Text style={{ fontSize: 30 }}>☰</Text>}
      accessibilityLabel={t("main.a11yMenu")}
      scrollable
    >
      <View style={{ gap: 4 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 2,
          }}
        >
          <MuteToggle init={mute} onToggleChange={onMuteChange} />
          <MenuNavButton
            label={t("menu.settings")}
            active={view === "settings"}
            onPress={() => setView("settings")}
          />
          <MenuNavButton
            label={t("menu.goals")}
            active={view === "goals"}
            onPress={() => setView("goals")}
          />
          <MenuNavButton
            label={t("menu.records")}
            active={view === "records"}
            onPress={() => setView("records")}
          />
        </View>
        {view === "settings" ? (
          settingsChildren
        ) : view === "goals" ? (
          goalsChildren
        ) : (
          recordsChildren
        )}
      </View>
    </BottomModal>
  );
}

/** Settings/goals/records view switcher (also the only "back" affordance
 *  needed — every view is reachable at all times, so there's no dead end). */
function MenuNavButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      // 44px-tall target: 14px text + 12px vertical padding either side.
      style={{
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderRadius: 6,
        backgroundColor: active ? "#555" : "#333",
      }}
    >
      <Text
        style={{
          ...styles.text,
          fontSize: 14,
          fontWeight: "bold",
          opacity: active ? 1 : 0.6,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default memo(MenuPanel);
