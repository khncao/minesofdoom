import { memo, useEffect, useState } from "react";
import { Pressable, Switch, View } from "react-native";
import { T as Text } from "../textScale";
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
 * First-run tutorial (plan §2.1): a NON-BLOCKING bottom tooltip — a compact
 * card docked to the bottom edge, no dimmed backdrop, the root is
 * `pointerEvents="box-none"` so every tap that misses the card lands on the
 * live game. The player can dig, buy and type answers while the tips are up;
 * the tooltip just sits there until Next/Skip.
 *
 * The flow is still 4 steps: the three loop tips (equations, combos, miners)
 * plus a first-time SETUP step (todo: "allow first time setup of operators and
 * other key settings") where the player picks the equation types, the symbol
 * display, and the answer input style. The setup step reuses the settings
 * panel's i18n keys (settings.opName.* names, the symbol-display label, the
 * keypad label) and persists each change straight into the live settings
 * (useSettings writes to AsyncStorage), so a setup choice sticks even if the
 * player never opens the menu again.
 *
 * Dismissal (final "Start" or Skip) is persisted by the parent
 * (`useLocalStorage`), so it never comes back. Deliberately static (no
 * animations) so it works with reduce-motion and needs no timers.
 *
 * The setup step's controls are a plain stack of whole-row Pressables (no
 * ScrollView): Yoga-sized rows in a content-sized card hit-test reliably on
 * Android, while an inner ScrollView mis-measured (collapsed) under the
 * card's height constraints (see the old full-screen card's notes).
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
  onStep,
  equationSettings,
  onEquationSettingsChange,
  onScreenKeypad,
  onKeypadChange,
}: {
  /** First-run dismissal. `completed` = the tour ran to the final "Start"
   * (as opposed to bailing via Skip) — the FTUE funnel's completion flag. */
  onDismiss: (completed: boolean) => void;
  /** FTUE funnel: fired whenever the visible step index changes (the
   * analytics fold stamps first sightings, re-fires are no-ops). */
  onStep?: (step: number) => void;
  equationSettings: EquationSettings;
  onEquationSettingsChange: (newSettings: EquationSettings) => void;
  onScreenKeypad: boolean;
  onKeypadChange: (newVal: boolean) => void;
}) {
  const t = useT();
  const [step, setStep] = useState(0);
  // The FTUE funnel seam: every visible step is reported; the parent's
  // analytics fold keeps the stamps one-shot per index. Step 0 fires on
  // mount (first-run players only — a replay re-fires harmlessly).
  useEffect(() => {
    onStep?.(step);
  }, [step, onStep]);
  // API 35 enforces edge-to-edge: dock the card above the gesture/nav
  // area, and keep the whole thing clear of the safe area.
  const insets = useSafeAreaInsets();
  const isLast = step === TOTAL_STEPS - 1;
  const current = TIP_KEYS[step] ?? null;
  const isSetup = !current;

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
          // Reaching the final "Start" IS completing the tour.
          onDismiss(true);
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
  const skipButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("onboarding.a11ySkip")}
      testID="onboarding-skip"
      onPress={() => onDismiss(false)}
      // 44px-tall tap target: 13px text + 15px vertical pad.
      style={styles.onboardingSkip}
      hitSlop={6}
    >
      <Text style={styles.onboardingSkipText}>{t("onboarding.skip")}</Text>
    </Pressable>
  );

  return (
    // box-none: the transparent full-screen root never eats a tap — only the
    // card itself is interactive, the game stays fully playable underneath.
    <View
      style={styles.onboardingRoot}
      pointerEvents="box-none"
      testID="onboarding-overlay"
    >
      <View
        style={[styles.onboardingCard, { bottom: insets.bottom + 8 }]}
        testID={isSetup ? "onboarding-setup" : undefined}
      >
        <View style={styles.onboardingHeader}>
          <Text style={styles.onboardingIcon}>
            {current ? current.icon : "⚙️"}
          </Text>
          <Text style={styles.onboardingTitle}>
            {current
              ? t(current.titleKey)
              : t("onboarding.4.title")}
          </Text>
          {skipButton}
        </View>
        <Text style={styles.onboardingBody}>
          {current ? t(current.bodyKey) : t("onboarding.4.body")}
        </Text>
        {isSetup && (
          <SetupControls
            equationSettings={equationSettings}
            onEquationSettingsChange={onEquationSettingsChange}
            onScreenKeypad={onScreenKeypad}
            onKeypadChange={onKeypadChange}
          />
        )}
        <View style={styles.onboardingFooter}>
          {dots}
          {nextButton}
        </View>
      </View>
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
