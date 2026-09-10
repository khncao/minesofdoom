import { memo, useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useT } from "src/hooks/useI18n";
import {
  type EquationSettings,
  OPERATOR_KEYS,
  Ops,
  getOpDisplay,
  type OperatorKey,
  type MultiplySymbol,
} from "src/utils/math/equations";
import { type TranslationKey } from "src/utils/i18n/i18n";
import { styles } from "../styles";

/**
 * First-run onboarding (plan §2.1): a 4-step overlay — the three loop
 * tips (equations, combos, miners) plus a first-time SETUP step (todo:
 * "allow first time setup of operators and other key settings") where the
 * player picks the equation types, the symbol display, and the answer
 * input style BEFORE the first dig. Dismissible at any point via "Skip";
 * dismissal is persisted in AsyncStorage by the parent (`useLocalStorage`),
 * so it never comes back.
 *
 * Deliberately static (no animations) so it works with reduce-motion and
 * needs no timers; the game behind it simply pauses under the backdrop.
 *
 * The setup step reuses the settings panel's i18n keys (settings.opName.*
 * names, the symbol-display label, the keypad label) so the choices made
 * here are recognizable later in the menu. Changes flow straight into the
 * live settings state AND persist per change (useSettings writes each
 * change to AsyncStorage), so a setup choice sticks even if the player
 * never opens the menu again.
 */
const TIP_KEYS = [
  { icon: "🧮", titleKey: "onboarding.1.title", bodyKey: "onboarding.1.body" },
  { icon: "🔥", titleKey: "onboarding.2.title", bodyKey: "onboarding.2.body" },
  { icon: "👷", titleKey: "onboarding.3.title", bodyKey: "onboarding.3.body" },
] as const;

/** The setup step is the step after the tips (index = TIP_KEYS.length). */
const TOTAL_STEPS = TIP_KEYS.length + 1;

/**
 * Glyphs per operator for the setup rows (the settings panel keeps its
 * own copy in OPERATOR_HELP; the two are intentionally separate because
 * settings pairs the glyph with a payout tooltip, setup needs none).
 */
const OP_GLYPHS: Record<OperatorKey, string> = {
  multiply: "*",
  add: "+",
  subtract: "-",
  division: "/",
  percent: "%",
  square: "²",
  missing: "?",
};

/**
 * i18n name per operator (same pattern as SettingsPanel's OP_NAME_KEYS —
 * a literal template key wouldn't type-check against TranslationKey).
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

const OnboardingOverlay = memo(function OnboardingOverlay({
  onDismiss,
  equationSettings,
  onEquationSettingsChange,
  onScreenKeypad,
  onKeypadChange,
}: {
  onDismiss: () => void;
  equationSettings: EquationSettings;
  onEquationSettingsChange: (newSettings: EquationSettings) => void;
  onScreenKeypad: boolean;
  onKeypadChange: (newVal: boolean) => void;
}) {
  const t = useT();
  const [step, setStep] = useState(0);
  // API 35 enforces edge-to-edge, so the overlay draws under the status bar;
  // keep the Skip button clear of it (it was un-tappable on tall-status-bar
  // devices with the old hardcoded top: 12).
  const insets = useSafeAreaInsets();
  const isLast = step === TOTAL_STEPS - 1;
  const current = TIP_KEYS[step] ?? null;

  const dots = (
    <View style={styles.onboardingDots}>
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <View
          key={i}
          style={[
            styles.onboardingDot,
            i === step && styles.onboardingDotActive,
          ]}
        />
      ))}
    </View>
  );
  const nextButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        isLast ? t("onboarding.a11yStart") : t("onboarding.a11yNext")
      }
      testID="onboarding-next"
      onPress={() => {
        if (isLast) {
          onDismiss();
        } else {
          setStep(step + 1);
        }
      }}
      style={styles.onboardingNext}
    >
      <Text style={styles.onboardingNextText}>
        {isLast ? t("onboarding.start") : t("onboarding.next")}
      </Text>
    </Pressable>
  );

  return (
    <View style={styles.onboardingBackdrop} testID="onboarding-overlay">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("onboarding.a11ySkip")}
        testID="onboarding-skip"
        onPress={onDismiss}
        // 44×44 tap target: 16px text + 12px vertical / 14px horizontal pad.
        style={[styles.onboardingSkip, { top: Math.max(12, insets.top + 8) }]}
      >
        <Text style={styles.onboardingSkipText}>{t("onboarding.skip")}</Text>
      </Pressable>
      {current ? (
        <View style={styles.onboardingCard}>
          <Text style={styles.onboardingIcon}>{current.icon}</Text>
          <Text style={styles.onboardingTitle}>{t(current.titleKey)}</Text>
          <Text style={styles.onboardingBody}>{t(current.bodyKey)}</Text>
          {dots}
          {nextButton}
        </View>
      ) : (
        // SETUP STEP — the controls are tall (8 rows) and sit plain in a
        // content-sized card (no ScrollView): Yoga-sized rows in a
        // content-sized card hit-test reliably on Android, while an inner
        // ScrollView mis-measured (collapsed) under the card's height
        // constraints and a full-card ScrollView had a dead hit-test zone
        // across its bottom on Android (the Start tap landed on the
        // backdrop instead of the button).
        <View style={styles.onboardingCard} testID="onboarding-setup">
          <Text style={styles.onboardingTitle}>{t("onboarding.4.title")}</Text>
          <Text style={styles.onboardingBody}>{t("onboarding.4.body")}</Text>
          <SetupControls
            equationSettings={equationSettings}
            onEquationSettingsChange={onEquationSettingsChange}
            onScreenKeypad={onScreenKeypad}
            onKeypadChange={onKeypadChange}
          />
          {dots}
          {nextButton}
        </View>
      )}
    </View>
  );
});

/**
 * The setup step's controls: the seven equation-type toggles (same rows,
 * names and defaults as the settings panel — a player who unticks division
 * here sees it off in Settings later), the × / ÷ symbol display, and the
 * answer-input style (on-screen numpad vs OS keyboard).
 *
 * Every row is a whole-row Pressable with the Switch inside: the Switch
 * swallows taps that land on it (its own onValueChange), and taps on the
 * label fire the row's onPress — one toggle either way. The row is also
 * the e2e anchor (testID), because a bare Switch's testID is not reliably
 * exposed to uiautomator on Android.
 */
function SetupControls({
  equationSettings,
  onEquationSettingsChange,
  onScreenKeypad,
  onKeypadChange,
}: {
  equationSettings: EquationSettings;
  onEquationSettingsChange: (newSettings: EquationSettings) => void;
  onScreenKeypad: boolean;
  onKeypadChange: (newVal: boolean) => void;
}) {
  const t = useT();
  const setOperator = (key: OperatorKey, val: boolean) =>
    onEquationSettingsChange({ ...equationSettings, [key]: val });
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ ...styles.onboardingBody, fontWeight: "bold" }}>
        {t("onboarding.setup.operators")}
      </Text>
      {OPERATOR_KEYS.map((key) => (
        <Pressable
          key={key}
          accessibilityRole="button"
          accessibilityLabel={t("settings.operatorEquations", {
            name: t(OP_NAME_KEYS[key]),
          })}
          testID={`setup-op-${key}`}
          onPress={() => setOperator(key, !equationSettings[key])}
          style={styles.setupRow}
        >
          <Text style={styles.setupRowLabel}>{t(OP_NAME_KEYS[key])}</Text>
          <Text style={styles.setupRowGlyph}>
            {key === "multiply"
              ? getOpDisplay(Ops.mult, equationSettings.multiplySymbol)
              : OP_GLYPHS[key]}
          </Text>
          <Switch
            value={equationSettings[key]}
            onValueChange={(v) => setOperator(key, v)}
          />
        </Pressable>
      ))}
      <View style={styles.setupRow}>
        <Text style={styles.setupRowLabel}>{t("settings.multiplySymbol")}</Text>
        <View style={{ flexDirection: "row", gap: 4 }}>
          {(["asterisk", "letter"] as const).map((sym: MultiplySymbol) => (
            <Pressable
              key={sym}
              accessibilityRole="button"
              accessibilityLabel={t("settings.multiplySymbol")}
              testID={`setup-symbol-${sym}`}
              onPress={() =>
                onEquationSettingsChange({
                  ...equationSettings,
                  multiplySymbol: sym,
                })
              }
              style={[
                styles.setupChip,
                equationSettings.multiplySymbol === sym &&
                  styles.setupChipActive,
              ]}
            >
              <Text style={styles.setupChipText}>
                {sym === "asterisk" ? "7 * 2 · 7 / 2" : "7 x 2 · 7 ÷ 2"}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("settings.onScreenKeypad")}
        testID="setup-keypad"
        onPress={() => onKeypadChange(!onScreenKeypad)}
        style={styles.setupRow}
      >
        <Text style={styles.setupRowLabel}>{t("settings.onScreenKeypad")}</Text>
        <Switch value={onScreenKeypad} onValueChange={onKeypadChange} />
      </Pressable>
    </View>
  );
}

export default OnboardingOverlay;
