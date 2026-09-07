import { memo, useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";
import IntegerInput from "src/components/IntegerInput";
import Tooltip from "src/components/Tooltip";
import { useI18n } from "src/hooks/useI18n";
import { type TranslationKey } from "src/utils/i18n/i18n";
import {
  EquationSettings,
  OPERATOR_KEYS,
  Ops,
  getOpDisplay,
  type OperatorKey,
  type MultiplySymbol,
} from "src/utils/math/equations";
import { SettingsData, clampSoundVolume } from "../game";
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
 * Menu "Settings" tab (todo: "reorganize menus with clean reimplementation"):
 * the gameplay preferences only — equation difficulty, operator mix,
 * display symbols, hard mode, the tips, and the display/keypad switches.
 * The save-data machinery (autosave interval, save code, the Save/Reset
 * buttons, cloud backup) lives on the Save tab, the account on the
 * Account tab, and the legal/debug tail on the About tab. Memoized so
 * re-renders from tapping the mine don't re-render the settings UI on
 * every tap.
 */
const SettingsContent = memo(function SettingsContent({
  settingsData,
  onChangeSettingsData,
  equationSettings,
  onChangeEquationSettings,
  onScreenKeypad,
  onKeypadChange,
  hardModeUnlocked,
}: {
  settingsData: SettingsData;
  onChangeSettingsData: (newSettings: SettingsData) => void;
  equationSettings: EquationSettings;
  onChangeEquationSettings: (newSettings: EquationSettings) => void;
  /** On-screen keypad (todo: keypad tab view) — an
   *  AsyncStorage-backed display preference owned by MinesOfDoom; the
   *  switch applies immediately (no Save tap), like the mute toggle. */
  onScreenKeypad: boolean;
  onKeypadChange: (newVal: boolean) => void;
  /** Tier-5 (Motherlode) complete → the switch is live, otherwise it
   *  renders locked (visible-but-locked, plan §4.6). */
  hardModeUnlocked: boolean;
}) {
  const { t } = useI18n();
  return (
    <View style={{ gap: 2, marginTop: 5 }} testID="settings-view">
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
          // 7 toggles no longer fit a phone-width row — let them wrap
          // instead of overflowing.
          flexWrap: "wrap",
        }}
      >
        {OPERATOR_KEYS.map((key) => (
            <View
              key={key}
              style={{ flexDirection: "row", alignItems: "center", gap: 2 }}
            >
              {/* Plain name (todo) next to the glyph, so the row reads
                  "division /" instead of a lone symbol. */}
              <Text style={styles.text}>{t(OP_NAME_KEYS[key])}</Text>
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
        <Text style={{ ...styles.text, fontSize: 11, color: "#bbb" }}>
          {t("settings.operatorHelp")}
        </Text>
      </View>
      {/* Symbol display toggle (todo: "Configurable equation display" +
          "alt display for other operations"): the choice now covers
          BOTH the multiplication and division glyphs — "7 * 2" / "7 / 2"
          vs "7 x 2" / "7 ÷ 2" (the persisted field keeps its legacy
          name, multiplySymbol). The previews are literal — they are the
          two possible renderings, not translatable copy. */}
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
                {sym === "asterisk" ? "7 * 2 · 7 / 2" : "7 x 2 · 7 ÷ 2"}
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
              color: hardModeUnlocked ? "#fff" : "#bbb",
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
      {/* Mental math tips (todo): a short teaching section on the
          equation-solving tricks — rendered before the display switches
          so it sits with the equation settings it explains. */}
      <TipsSection />
      <Tooltip label={t("settings.tooltipHaptics")} content={t("settings.hapticsHelp")}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Text style={{ ...styles.text, fontSize: 11 }}>
            {t("settings.haptics")}
          </Text>
          <Switch
            value={settingsData.haptics}
            onValueChange={(newVal) => {
              onChangeSettingsData({
                ...settingsData,
                haptics: newVal,
              });
            }}
          />
        </View>
      </Tooltip>
      {/* Sound volume (todo: sound volume controls, features.md §7 gap): the
          SFX level on top of the menu mute toggle — the toggle still wins,
          this only sets the level when un-muted. Stepped in 10% units, the
          same immediate-apply pattern as the switches around it. */}
      <Tooltip
        label={t("settings.tooltipSoundVolume")}
        content={t("settings.soundVolumeHelp")}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Text style={{ ...styles.text, fontSize: 11, flex: 1 }}>
            {t("settings.soundVolume")}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("a11y.decreaseSoundVolume")}
            onPress={() =>
              onChangeSettingsData({
                ...settingsData,
                soundVolume: clampSoundVolume(settingsData.soundVolume - 10),
              })
            }
            style={{
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 6,
              backgroundColor: "#2a2a2a",
            }}
          >
            <Text style={{ ...styles.text, fontSize: 11 }}>−</Text>
          </Pressable>
          <Text
            style={{ ...styles.text, fontSize: 11, width: 36, textAlign: "center" }}
          >
            {settingsData.soundVolume}%
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("a11y.increaseSoundVolume")}
            onPress={() =>
              onChangeSettingsData({
                ...settingsData,
                soundVolume: clampSoundVolume(settingsData.soundVolume + 10),
              })
            }
            style={{
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 6,
              backgroundColor: "#2a2a2a",
            }}
          >
            <Text style={{ ...styles.text, fontSize: 11 }}>+</Text>
          </Pressable>
        </View>
      </Tooltip>
      <Tooltip
        label={t("settings.tooltipIdleReminder")}
        content={t("settings.idleReminderHelp")}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Text style={{ ...styles.text, fontSize: 11 }}>
            {t("settings.idleReminder")}
          </Text>
          <Switch
            value={settingsData.idleReminder}
            onValueChange={(newVal) => {
              onChangeSettingsData({
                ...settingsData,
                idleReminder: newVal,
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
 * techniques for mental arithmetic", then "Show tips one at a time with
 * auto scrolling"): the eight tips used to stack into a long column that
 * pushed the rest of settings off-screen; now ONE tip is shown at a time.
 * The auto-advance was removed (todo: "disable mental math tip auto
 * scroll") — the card is fully manual: tapping it advances to the next
 * tip, looping back to the first, so a reader can linger on any tip
 * without the content scrolling away out from under them.
 */
function TipsSection() {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const tip = TIPS[index % TIPS.length];

  const nextTip = () => setIndex((i) => (i + 1) % TIPS.length);

  return (
    <View style={{ gap: 6, marginTop: 10 }} testID="tips-section">
      <Text style={{ ...styles.text, fontWeight: "bold" }}>
        {t("settings.tips")}
      </Text>
      <Pressable
        onPress={nextTip}
        accessibilityRole="button"
        accessibilityLabel={t("settings.tip.next")}
        testID="tip-card"
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
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "baseline",
          }}
        >
          <Text style={{ ...styles.text, fontSize: 12, fontWeight: "bold" }}>
            {t(tip.title)}
          </Text>
          <Text style={{ ...styles.text, fontSize: 11, color: "#bbb" }}>
            {index + 1}/{TIPS.length}
          </Text>
        </View>
        <Text style={{ ...styles.text, fontSize: 11, color: "#bbb" }}>
          {t(tip.body)}
        </Text>
      </Pressable>
    </View>
  );
}

export default SettingsContent;
