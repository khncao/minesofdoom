import { memo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useT } from "src/hooks/useI18n";
import { styles } from "../styles";

/**
 * First-run onboarding (plan §2.1): a 3-step overlay that explains the core
 * loop — equations, combos, miners — before the player gets lost. Dismissable
 * at any point via the buttons or "Skip"; dismissal is persisted in
 * AsyncStorage by the parent (`useLocalStorage`), so it never comes back.
 *
 * Deliberately static (no animations) so it works with reduce-motion and
 * needs no timers; the game behind it simply pauses under the backdrop.
 */
const STEP_KEYS = [
  { icon: "🧮", titleKey: "onboarding.1.title", bodyKey: "onboarding.1.body" },
  { icon: "🔥", titleKey: "onboarding.2.title", bodyKey: "onboarding.2.body" },
  { icon: "👷", titleKey: "onboarding.3.title", bodyKey: "onboarding.3.body" },
] as const;

const OnboardingOverlay = memo(function OnboardingOverlay({
  onDismiss,
}: {
  onDismiss: () => void;
}) {
  const t = useT();
  const [step, setStep] = useState(0);
  const isLast = step === STEP_KEYS.length - 1;
  const current = STEP_KEYS[step];
  return (
    <View style={styles.onboardingBackdrop} testID="onboarding-overlay">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("onboarding.a11ySkip")}
        testID="onboarding-skip"
        onPress={onDismiss}
        // 44×44 tap target: 16px text + 12px vertical / 14px horizontal pad.
        style={styles.onboardingSkip}
      >
        <Text style={styles.onboardingSkipText}>{t("onboarding.skip")}</Text>
      </Pressable>
      <View style={styles.onboardingCard}>
        <Text style={styles.onboardingIcon}>{current.icon}</Text>
        <Text style={styles.onboardingTitle}>{t(current.titleKey)}</Text>
        <Text style={styles.onboardingBody}>{t(current.bodyKey)}</Text>
        <View style={styles.onboardingDots}>
          {STEP_KEYS.map((_, i) => (
            <View
              key={i}
              style={[
                styles.onboardingDot,
                i === step && styles.onboardingDotActive,
              ]}
            />
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            isLast ? t("onboarding.a11yStart") : t("onboarding.a11yNext")
          }
          onPress={() => (isLast ? onDismiss() : setStep(step + 1))}
          style={styles.onboardingNext}
        >
          <Text style={styles.onboardingNextText}>
            {isLast ? t("onboarding.start") : t("onboarding.next")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
});

export default OnboardingOverlay;
