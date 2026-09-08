import { memo, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import BottomModal from "src/components/BottomModal";
import { useT } from "src/hooks/useI18n";
import MuteToggle from "src/components/MuteToggle";
import { EquationSettings } from "src/utils/math/equations";
import { AnalyticsState } from "../analytics";
import type { CloudSaveSettingsProps } from "../hooks/useCloudSave";
import SettingsContent from "./SettingsPanel";
import SaveTab from "./SaveTab";
import AccountTab, { type AccountSettingsProps } from "./AccountTab";
import AboutTab from "./AboutTab";
import GoalsContent from "./GoalsPanel";
import RecordsContent from "./RecordsPanel";
import { SaveData, SettingsData } from "../game";
import { SessionStats } from "../session";
import { styles } from "../styles";

type MenuView =
  | "settings"
  | "save"
  | "account"
  | "goals"
  | "records"
  | "about";

/**
 * Footer menu (plan "Adjust", reorganized for the todo
 * "reorganize menus with clean reimplementation"): one menu button opens
 * a sheet with six short views — Settings (gameplay preferences),
 * Save (autosave, save code, Save/Reset, cloud backup), Account
 * (optional login), Goals, Records, and About (legal, inquiries,
 * debug). There is no Shop view here: the cosmetics shop (gem AND
 * one-time cash buys, plus equipping/reroll) is the standalone 🛍️
 * IapPanel on the footer (todo: "move gem shop cosmetics to one time
 * purchase shop with gem and cash buy options"). Each view stays a few screens tall instead of the old single
 * settings scroll that mixed gameplay, save-data, account and legal
 * content; the mute toggle stays above the switcher and the daily
 * bonus button deliberately stays outside on the footer so it's always
 * one tap away.
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
  mute,
  onMuteChange,
  onScreenKeypad,
  onKeypadChange,
  hardModeUnlocked,
  stats,
  session,
  analytics,
  onClearAnalytics,
  cloudSave,
  account,
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
  mute: boolean;
  onMuteChange: (newVal: boolean) => void;
  /** On-screen keypad setting (todo: keypad tab view): an
   *  AsyncStorage-backed display preference, so it applies immediately —
   *  unlike the SettingsData switches, which wait for the Save tap. */
  onScreenKeypad: boolean;
  onKeypadChange: (newVal: boolean) => void;
  hardModeUnlocked: boolean;
  /** Lifetime save data — feeds the goals/records views' derived progress. */
  stats: SaveData;
  /** This-session stats (delta vs. the launch baseline); null until the
   *  save has loaded (the records view hides its session block). */
  session: SessionStats | null;
  /** Guardrail 6: the local analytics record for the About-tab debug
   *  section (single owner is MinesOfDoom's useAnalytics; this is a
   *  read-through, not a second storage reader). */
  analytics: AnalyticsState | null;
  /** Data-deletion path for the analytics record. */
  onClearAnalytics: () => void;
  /** Cloud-backup settings bundle (see useCloudSave); the section hides
   *  itself while the provider is unavailable. */
  cloudSave: CloudSaveSettingsProps;
  /** Optional-account settings bundle (see AccountSettingsProps); the
   *  section hides itself while the provider is unavailable. */
  account: AccountSettingsProps;
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
        onScreenKeypad={onScreenKeypad}
        onKeypadChange={onKeypadChange}
        hardModeUnlocked={hardModeUnlocked}
      />
    ),
    [
      settingsData,
      onChangeSettingsData,
      equationSettings,
      onChangeEquationSettings,
      onScreenKeypad,
      onKeypadChange,
      hardModeUnlocked,
    ],
  );
  const saveChildren = useMemo(
    () => (
      <SaveTab
        settingsData={settingsData}
        onChangeSettingsData={onChangeSettingsData}
        showMessage={showMessage}
        onSave={onSave}
        onReset={onReset}
        onExportSaveCode={onExportSaveCode}
        onImportSaveCode={onImportSaveCode}
        cloudSave={cloudSave}
      />
    ),
    [
      settingsData,
      onChangeSettingsData,
      showMessage,
      onSave,
      onReset,
      onExportSaveCode,
      onImportSaveCode,
      cloudSave,
    ],
  );
  const accountChildren = useMemo(
    () => <AccountTab account={account} />,
    [account],
  );
  const goalsChildren = useMemo(() => <GoalsContent stats={stats} />, [stats]);
  const recordsChildren = useMemo(
    () => <RecordsContent stats={stats} session={session} />,
    [stats, session],
  );
  const aboutChildren = useMemo(
    () => (
      <AboutTab analytics={analytics} onClearAnalytics={onClearAnalytics} />
    ),
    [analytics, onClearAnalytics],
  );

  return (
    <BottomModal
      pressable={<Text style={{ fontSize: 30 }}>☰</Text>}
      accessibilityLabel={t("main.a11yMenu")}
      scrollable
      // The six views are a few screens tall each — a 90% bottom sheet
      // wastes the top of the screen, so the menu fills it (todo:
      // "menu modal takes up whole screen").
      fullscreen
      testID="menu-button"
      sheetTestID="menu-sheet"
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
            testID="menu-tab-settings"
          />
          <MenuNavButton
            label={t("menu.save")}
            active={view === "save"}
            onPress={() => setView("save")}
            testID="menu-tab-save"
          />
          <MenuNavButton
            label={t("menu.account")}
            active={view === "account"}
            onPress={() => setView("account")}
            testID="menu-tab-account"
          />
          <MenuNavButton
            label={t("menu.goals")}
            active={view === "goals"}
            onPress={() => setView("goals")}
            testID="menu-tab-goals"
          />
          <MenuNavButton
            label={t("menu.records")}
            active={view === "records"}
            onPress={() => setView("records")}
            testID="menu-tab-records"
          />
          <MenuNavButton
            label={t("menu.about")}
            active={view === "about"}
            onPress={() => setView("about")}
            testID="menu-tab-about"
          />
        </View>
        {view === "settings"
          ? settingsChildren
          : view === "save"
            ? saveChildren
            : view === "account"
              ? accountChildren
              : view === "goals"
                ? goalsChildren
                : view === "records"
                  ? recordsChildren
                  : aboutChildren}
      </View>
    </BottomModal>
  );
}

/** Settings/save/account/goals/records/about view switcher (also the
 *  only "back" affordance needed — every view is reachable at all
 *  times, so there's no dead end). */
function MenuNavButton({
  label,
  active,
  onPress,
  testID,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      testID={testID}
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
