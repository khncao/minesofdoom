import { memo, useState } from "react";
import { Pressable, Switch, View } from "react-native";
import { T as Text, sanitizeTextScale } from "../textScale";
import IntegerInput from "src/components/IntegerInput";
import Tooltip from "src/components/Tooltip";
import { useI18n } from "src/hooks/useI18n";
import { type TranslationKey } from "src/utils/i18n/i18n";
import {
  EQUATION_NUMBER_LIMITS,
  EquationSettings,
  DRILL_KEYS,
  OPERATOR_KEYS,
  REAL_WORLD_KEYS,
  Ops,
  getOpDisplay,
  type EquationTypeKey,
  type MultiplySymbol,
} from "src/utils/math/equations";
import {
  SettingsData,
  clampSoundVolume,
  clampMusicVolume,
  clampNumberNotation,
} from "../game";
import { formatNumber } from "src/utils/format";
import { styles } from "../styles";

/**
 * Label, glyph and payout note for EVERY toggleable equation type (kept
 * in sync with getOpPayoutMultiplier / getEquationOpBonus in game.ts:
 * division ×10, missing-divisor ×5, square/balance/sequence/time ×4,
 * percent/tip ×3, subtraction/change ×2, +/* ×1). One record for all three
 * groups — Operators, Drills and Real-world math — because the rows render
 * identically and only the grouping differs.
 */
type TypeToggleInfo = {
  /** The plain name shown next to the glyph, and the operatorEquations
   *  tooltip label ("{name} equations"). A literal template key wouldn't
   *  type-check against TranslationKey. */
  name: TranslationKey;
  symbol: string;
  /** settings.op.* — the one-line payout + guarantee note. */
  noteKey: TranslationKey;
};

const TYPE_INFO: Record<EquationTypeKey, TypeToggleInfo> = {
  multiply: { name: "settings.opName.multiply", symbol: "*", noteKey: "settings.op.multiply" },
  add: { name: "settings.opName.add", symbol: "+", noteKey: "settings.op.add" },
  subtract: { name: "settings.opName.subtract", symbol: "-", noteKey: "settings.op.subtract" },
  division: { name: "settings.opName.division", symbol: "/", noteKey: "settings.op.division" },
  percent: { name: "settings.opName.percent", symbol: "%", noteKey: "settings.op.percent" },
  square: { name: "settings.opName.square", symbol: "²", noteKey: "settings.op.square" },
  missing: { name: "settings.opName.missing", symbol: "?", noteKey: "settings.op.missing" },
  missingDivisor: {
    name: "settings.opName.missingDivisor",
    symbol: "?",
    noteKey: "settings.op.missingDivisor",
  },
  balance: { name: "settings.opName.balance", symbol: "?", noteKey: "settings.op.balance" },
  sequence: { name: "settings.opName.sequence", symbol: "…", noteKey: "settings.op.sequence" },
  tip: { name: "settings.opName.tip", symbol: "$", noteKey: "settings.op.tip" },
  change: { name: "settings.opName.change", symbol: "$", noteKey: "settings.op.change" },
  time: { name: "settings.opName.time", symbol: "◷", noteKey: "settings.op.time" },
  discount: {
    name: "settings.opName.discount",
    symbol: "%",
    noteKey: "settings.op.discount",
  },
  splitBill: {
    name: "settings.opName.splitBill",
    symbol: "÷",
    noteKey: "settings.op.splitBill",
  },
  unitPrice: {
    name: "settings.opName.unitPrice",
    symbol: "×",
    noteKey: "settings.op.unitPrice",
  },
};

/**
 * One wrapping row of type toggles. `multiply` is the only type whose
 * glyph follows the player's symbol preference, so it is resolved here
 * rather than stored in TYPE_INFO.
 */
function TypeToggleGroup({
  titleKey,
  keys,
  equationSettings,
  onChangeEquationSettings,
}: {
  /** A small caption above the row (the top group passes undefined — it
   *  is the one the player finds first, so it needs no heading). */
  titleKey?: TranslationKey;
  keys: readonly EquationTypeKey[];
  equationSettings: EquationSettings;
  onChangeEquationSettings: (newSettings: EquationSettings) => void;
}) {
  const { t } = useI18n();
  return (
    <View style={{ gap: 2 }}>
      {titleKey !== undefined && (
        <View style={styles.flexCenteredRow}>
          <Text style={{ ...styles.text, fontSize: 11, color: "#bbb" }}>
            {t(titleKey)}
          </Text>
        </View>
      )}
      <View style={{ ...styles.flexCenteredRow, gap: 4, flexWrap: "wrap" }}>
        {keys.map((key) => {
          const info = TYPE_INFO[key];
          return (
            <View
              key={key}
              style={{ flexDirection: "row", alignItems: "center", gap: 2 }}
            >
              {/* Plain name (todo) next to the glyph, so the row reads
                    "division /" instead of a lone symbol. */}
              <Text style={styles.text}>{t(info.name)}</Text>
              <Tooltip
                label={t("settings.operatorEquations", { name: t(info.name) })}
                content={`${t(info.noteKey)} ${t("settings.gainFormula")}`}
              >
                <Text style={styles.text}>
                  {key === "multiply"
                    ? getOpDisplay(Ops.mult, equationSettings.multiplySymbol)
                    : info.symbol}
                </Text>
              </Tooltip>
              <Switch
                value={equationSettings[key]}
                onValueChange={(newVal) => {
                  onChangeEquationSettings({ ...equationSettings, [key]: newVal });
                }}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

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
  secondKeypad,
  onSecondKeypadChange,
  hardModeUnlocked,
  textScale,
  onTextScaleChange,
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
  /** A SECOND numpad (2026-10-04) — off by default, draggable, and
   *  available in BOTH orientations (see the note on `secondKeypad` in
   *  MinesOfDoom: it was landscape-only, which made this switch a no-op in
   *  portrait). */
  secondKeypad: boolean;
  onSecondKeypadChange: (newVal: boolean) => void;
  /** Tier-5 (Motherlode) complete → the switch is live, otherwise it
   *  renders locked (visible-but-locked, plan §4.6). */
  hardModeUnlocked: boolean;
  /** UI text scale in percent (100 = default); see textScale.tsx. */
  textScale: number;
  onTextScaleChange: (dir: -1 | 1) => void;
}) {
  const { t } = useI18n();
  return (
    <View style={{ gap: 2, marginTop: 5 }} testID="settings-view">
      <IntegerInput
        label={t("settings.maxNumber")}
        defaultValue={equationSettings.maxNumber}
        min={EQUATION_NUMBER_LIMITS.min}
        max={EQUATION_NUMBER_LIMITS.max}
        onChangeValue={(newVal) =>
          onChangeEquationSettings({
            ...equationSettings,
            maxNumber: newVal,
          })
        }
      />
      {/* The three toggle groups (todo: "More types of simple mental
          arithmetics for all ages"). They live outside OPERATOR_KEYS as
          separate lists because that one is also the first-run setup step's
          row list, and ten 44px rows overflow the non-scrolling onboarding
          card — so Drills and Real-world math get their own labelled groups
          here instead of six more tour rows. All six are off by default and
          soft-mode only. */}
      <TypeToggleGroup
        keys={OPERATOR_KEYS}
        equationSettings={equationSettings}
        onChangeEquationSettings={onChangeEquationSettings}
      />
      <View style={styles.flexCenteredRow}>
        <Text style={{ ...styles.text, fontSize: 11, color: "#bbb" }}>
          {t("settings.operatorHelp")}
        </Text>
      </View>
      <TypeToggleGroup
        titleKey="settings.drills"
        keys={DRILL_KEYS}
        equationSettings={equationSettings}
        onChangeEquationSettings={onChangeEquationSettings}
      />
      <TypeToggleGroup
        titleKey="settings.realWorld"
        keys={REAL_WORLD_KEYS}
        equationSettings={equationSettings}
        onChangeEquationSettings={onChangeEquationSettings}
      />
      {/* The money drills are the only ones that answer in cents, so the
          decimal key is worth calling out where the player turns them on. */}
      {(equationSettings.tip ||
        equationSettings.discount ||
        equationSettings.splitBill ||
        equationSettings.unitPrice) && (
        <View style={styles.flexCenteredRow}>
          <Text style={{ ...styles.text, fontSize: 11, color: "#bbb" }}>
            {t("settings.moneyNote")}
          </Text>
        </View>
      )}
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
                  equationSettings.multiplySymbol === sym ? "#555" : "#2a2a2a",
              }}
            >
              <Text style={{ ...styles.text, fontSize: 11 }}>
                {sym === "asterisk" ? "7 * 2 · 7 / 2" : "7 x 2 · 7 ÷ 2"}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <Tooltip
        label={t("settings.tooltipHard")}
        content={t("settings.hardModeHelp")}
      >
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
      <Tooltip
        label={t("settings.tooltipHaptics")}
        content={t("settings.hapticsHelp")}
      >
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
      {/* Reduce effects (features.md §7 pass-3 accessibility): the manual
          kill switch for the decorative juice — OR'd with the web OS
          reduce-motion preference inside the hook, so it is the only
          signal on native, where RN has no reduce-motion API. */}
      <Tooltip
        label={t("settings.tooltipReduceEffects")}
        content={t("settings.reduceEffectsHelp")}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Text style={{ ...styles.text, fontSize: 11 }}>
            {t("settings.reduceEffects")}
          </Text>
          <Switch
            value={settingsData.reduceEffects}
            onValueChange={(newVal) => {
              onChangeSettingsData({
                ...settingsData,
                reduceEffects: newVal,
              });
            }}
          />
        </View>
      </Tooltip>
      {/* UI text size (Tier 1 #2 of gap-ranking.md): a global text scale
          for small screens — NOT an OS font-accessibility proxy (the
          native OS font setting is a different, independent lever), so
          the row is honest about what it does. Applies immediately,
          like the keypad row above (AsyncStorage preference). */}
      <Tooltip
        label={t("settings.tooltipTextSize")}
        content={t("settings.textSizeHelp")}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Text style={{ ...styles.text, fontSize: 11 }}>
            {t("settings.textSize")}
          </Text>
          <View style={{ flex: 1 }} />
          <Pressable
            testID="text-size-minus"
            onPress={() => onTextScaleChange(-1)}
            style={{
              minWidth: 28,
              paddingVertical: 3,
              paddingHorizontal: 8,
              borderRadius: 4,
              backgroundColor: "#2b2b2b",
            }}
          >
            <Text style={{ ...styles.text, fontSize: 13, color: "#fff" }}>
              −
            </Text>
          </Pressable>
          <Text style={{ ...styles.text, fontSize: 11 }}>
            {Math.round(sanitizeTextScale(textScale) * 100)}%
          </Text>
          <Pressable
            testID="text-size-plus"
            onPress={() => onTextScaleChange(1)}
            style={{
              minWidth: 28,
              paddingVertical: 3,
              paddingHorizontal: 8,
              borderRadius: 4,
              backgroundColor: "#2b2b2b",
            }}
          >
            <Text style={{ ...styles.text, fontSize: 13, color: "#fff" }}>
              +
            </Text>
          </Pressable>
        </View>
      </Tooltip>
      {/* Cave ambience (todo: "Music / ambient loop", features.md §7 gap):
          the looping music-bed toggle — its level is the independent
          musicVolume setting below (musicLevel) and the menu mute toggle
          still wins; this just switches the bed on/off. */}
      <Tooltip
        label={t("settings.tooltipMusic")}
        content={t("settings.musicHelp")}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Text style={{ ...styles.text, fontSize: 11 }}>
            {t("settings.music")}
          </Text>
          <Switch
            value={settingsData.music}
            onValueChange={(newVal) => {
              onChangeSettingsData({
                ...settingsData,
                music: newVal,
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
            style={{
              ...styles.text,
              fontSize: 11,
              width: 36,
              textAlign: "center",
            }}
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
      {/* Music volume (todo: independent music volume, features.md §7
          pass-3 accessibility item): the cave-ambience bed's level, now
          independent of the SFX level (was half-level by law). Same
          immediate-apply, 10%-step pattern as the SFX row above. */}
      <Tooltip
        label={t("settings.tooltipMusicVolume")}
        content={t("settings.musicVolumeHelp")}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Text style={{ ...styles.text, fontSize: 11, flex: 1 }}>
            {t("settings.musicVolume")}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("a11y.decreaseMusicVolume")}
            onPress={() =>
              onChangeSettingsData({
                ...settingsData,
                musicVolume: clampMusicVolume(settingsData.musicVolume - 10),
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
            style={{
              ...styles.text,
              fontSize: 11,
              width: 36,
              textAlign: "center",
            }}
          >
            {settingsData.musicVolume}%
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("a11y.increaseMusicVolume")}
            onPress={() =>
              onChangeSettingsData({
                ...settingsData,
                musicVolume: clampMusicVolume(settingsData.musicVolume + 10),
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
      {/* Number notation (todo: "the number notation is a fixed ladder",
          features.md §7 pass-8 item): how big numbers are written
          everywhere — the genre guide's cozy-vs-clinical choice as a
          plain preference toggle (guardrail 4). Tapping the sample
          cycles compact (1.23M) ↔ plain (1,234,567); the sample is the
          SAME value rendered in the current mode, so the row previews
          both modes in place. Immediate-apply, like the volume rows
          above — MinesOfDoom's sync effect pushes the live store and
          every counter re-renders in place. */}
      <Tooltip
        label={t("settings.tooltipNotation")}
        content={t("settings.notationHelp")}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Text style={{ ...styles.text, fontSize: 11, flex: 1 }}>
            {t("settings.notation")}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("a11y.cycleNumberNotation")}
            onPress={() =>
              onChangeSettingsData({
                ...settingsData,
                notation: clampNumberNotation(
                  settingsData.notation === "compact" ? "plain" : "compact",
                ),
              })
            }
            style={{
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 6,
              backgroundColor: "#2a2a2a",
            }}
          >
            <Text style={{ ...styles.text, fontSize: 11 }}>
              {formatNumber(1234567, settingsData.notation)}
            </Text>
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
      {/* Share anonymous usage stats (todo #1, OFF by default): a reduced
          local-analytics record (day keys/booleans/counters) is uploaded
          at most once per local day and stored as one row per device;
          the GDPR delete erases it. Guardrail 5 — measure before scaling. */}
      <Tooltip
        label={t("settings.tooltipAnalyticsShare")}
        content={t("settings.analyticsShareHelp")}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Text style={{ ...styles.text, fontSize: 11 }}>
            {t("settings.analyticsShare")}
          </Text>
          <Switch
            value={settingsData.analyticsShare}
            onValueChange={(newVal) => {
              onChangeSettingsData({
                ...settingsData,
                analyticsShare: newVal,
              });
            }}
          />
        </View>
      </Tooltip>
      {/* Auto equation of the day (todo: daily question pops up by itself):
          on (default) the daily equation starts itself while unsolved and
          the 📅 icon stays out of the top row; off, the icon returns as the
          manual entry point (see the auto-start effect in MinesOfDoom). */}
      <Tooltip
        label={t("settings.tooltipAutoDailyEquation")}
        content={t("settings.autoDailyEquationHelp")}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Text style={{ ...styles.text, fontSize: 11 }}>
            {t("settings.autoDailyEquation")}
          </Text>
          <Switch
            value={settingsData.autoDailyEquation}
            onValueChange={(newVal) => {
              onChangeSettingsData({
                ...settingsData,
                autoDailyEquation: newVal,
              });
            }}
          />
        </View>
      </Tooltip>
      {/* Auto daily bonus (todo: idle reward without the icon): on
          (default) the streak bonus claims itself when claimable and the
          🎁 icon stays out of the top row; off, the icon returns and the
          player taps it (see the auto-claim effect in MinesOfDoom). */}
      <Tooltip
        label={t("settings.tooltipAutoDailyBonus")}
        content={t("settings.autoDailyBonusHelp")}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Text style={{ ...styles.text, fontSize: 11 }}>
            {t("settings.autoDailyBonus")}
          </Text>
          <Switch
            value={settingsData.autoDailyBonus}
            onValueChange={(newVal) => {
              onChangeSettingsData({
                ...settingsData,
                autoDailyBonus: newVal,
              });
            }}
          />
        </View>
      </Tooltip>
      <Tooltip
        label={t("settings.tooltipEmojiArt")}
        content={t("settings.emojiArtHelp")}
      >
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
        onPress={() => onKeypadChange(!onScreenKeypad)}
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
          {/* The row (Tooltip onPress) owns the action; letting the Switch
              fire too would toggle twice and look like nothing happened. */}
          <Switch
            value={onScreenKeypad}
            onValueChange={() => undefined}
            pointerEvents="none"
          />
        </View>
      </Tooltip>
      {/* The second numpad — off by default; see the note on
          `secondKeypad` in MinesOfDoom. */}
      <Tooltip
        label={t("settings.secondKeypad")}
        content={t("settings.secondKeypadHelp")}
        onPress={() => onSecondKeypadChange(!secondKeypad)}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Text style={{ ...styles.text, fontSize: 11, flexShrink: 1 }}>
            {t("settings.secondKeypad")}
          </Text>
          <Switch
            value={secondKeypad}
            onValueChange={() => undefined}
            pointerEvents="none"
            testID="second-keypad-toggle"
            accessibilityLabel={t("settings.secondKeypad")}
          />
        </View>
      </Tooltip>
    </View>
  );
});

/**
 * The seventeen tips, in display order (title + body are separate keys so
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
  // The three drills' strategies (Settings ▸ Drills turns them on).
  {
    title: "settings.tip.missingDivisor.title",
    body: "settings.tip.missingDivisor.body",
  },
  {
    title: "settings.tip.balance.title",
    body: "settings.tip.balance.body",
  },
  {
    title: "settings.tip.sequence.title",
    body: "settings.tip.sequence.body",
  },
  // The real-world strategies (Settings ▸ Real-world math turns them on).
  {
    title: "settings.tip.realTip.title",
    body: "settings.tip.realTip.body",
  },
  {
    title: "settings.tip.change.title",
    body: "settings.tip.change.body",
  },
  {
    title: "settings.tip.time.title",
    body: "settings.tip.time.body",
  },
  // The money strategies — the only drills whose answers are in cents.
  {
    title: "settings.tip.discount.title",
    body: "settings.tip.discount.body",
  },
  {
    title: "settings.tip.splitBill.title",
    body: "settings.tip.splitBill.body",
  },
  {
    title: "settings.tip.unitPrice.title",
    body: "settings.tip.unitPrice.body",
  },
];

/**
 * Mental math tips (todo: "Add a tips section in settings menu teaching
 * techniques for mental arithmetic", then "Show tips one at a time with
 * auto scrolling"): the seventeen tips used to stack into a long column that
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
