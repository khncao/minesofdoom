import { memo, useState } from "react";
import { Pressable, Text, View } from "react-native";
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
const STEPS: ReadonlyArray<{ icon: string; title: string; body: string }> = [
  {
    icon: "🧮",
    title: "Mine the math",
    body: "Answer the equation at the top to earn minerals. Tapping the cave works too, but it's a slower way to dig.",
  },
  {
    icon: "🔥",
    title: "Keep the combo alive",
    body: "Every correct answer builds your combo — every 10 in a row multiplies your gains by +1. Wrong answers and cave taps break it, so answer fast and don't tap while typing.",
  },
  {
    icon: "👷",
    title: "Hire miners",
    body: "Spend minerals on upgrades and miners below. Miners dig for you automatically — even while the game is closed. Check the 🎯 goals for what's coming next.",
  },
];

const OnboardingOverlay = memo(function OnboardingOverlay({
  onDismiss,
}: {
  onDismiss: () => void;
}) {
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];
  return (
    <View style={styles.onboardingBackdrop}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Skip tutorial"
        onPress={onDismiss}
        // 44×44 tap target: 16px text + 12px vertical / 14px horizontal pad.
        style={styles.onboardingSkip}
      >
        <Text style={styles.onboardingSkipText}>Skip</Text>
      </Pressable>
      <View style={styles.onboardingCard}>
        <Text style={styles.onboardingIcon}>{current.icon}</Text>
        <Text style={styles.onboardingTitle}>{current.title}</Text>
        <Text style={styles.onboardingBody}>{current.body}</Text>
        <View style={styles.onboardingDots}>
          {STEPS.map((_, i) => (
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
          accessibilityLabel={isLast ? "Start mining" : "Next step"}
          onPress={() => (isLast ? onDismiss() : setStep(step + 1))}
          style={styles.onboardingNext}
        >
          <Text style={styles.onboardingNextText}>
            {isLast ? "Start mining! ⛏️" : "Next"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
});

export default OnboardingOverlay;
