import { memo, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import BottomModal from "apps/components/BottomModal";
import MuteToggle from "apps/components/MuteToggle";
import { EquationSettings } from "apps/utils/math/equations";
import type { ComponentProps } from "react";
import SettingsContent from "./SettingsPanel";
import GoalsContent from "./GoalsPanel";
import CosmeticsSection from "./CosmeticsSection";
import { SaveData, SettingsData } from "../game";
import { styles } from "../styles";

type MenuView = "settings" | "goals";

/**
 * Footer menu (plan "Adjust"): one menu button replaces the old footer row
 * of settings + goals buttons. The sheet holds the mute toggle and a
 * settings/goals view switcher; the daily bonus button deliberately stays
 * outside on the footer so it's always one tap away.
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
}) {
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
    ],
  );
  const goalsChildren = useMemo(() => <GoalsContent stats={stats} />, [stats]);

  return (
    <BottomModal
      pressable={<Text style={{ fontSize: 30 }}>☰</Text>}
      accessibilityLabel="Menu"
      scrollable
    >
      <View style={{ gap: 4 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 2,
          }}
        >
          <MuteToggle init={mute} onToggleChange={onMuteChange} />
          <MenuNavButton
            label="⚙️ Settings"
            active={view === "settings"}
            onPress={() => setView("settings")}
          />
          <MenuNavButton
            label="🎯 Goals"
            active={view === "goals"}
            onPress={() => setView("goals")}
          />
        </View>
        {view === "settings" ? settingsChildren : goalsChildren}
      </View>
    </BottomModal>
  );
}

/** Settings/goals view switcher (also the only "back" affordance needed —
 *  both views are reachable at all times, so there's no dead end). */
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
        paddingHorizontal: 10,
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
