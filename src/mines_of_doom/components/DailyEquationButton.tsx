import { memo } from "react";
import { Pressable, Text } from "react-native";
import { useT } from "src/hooks/useI18n";
import { formatNumber } from "src/utils/format";

/**
 * Equation-of-the-day button (todo "daily equation"): sits next to the
 * daily bonus in the header row. 📅 while today's equation is unsolved,
 * dimmed once it's solved — same 44×44 footer-icon metrics as the other
 * row buttons. The long-press-free design mirrors DailyBonusButton; the
 * details live in the accessibilityLabel and the start toast.
 */
const DailyEquationButton = memo(function DailyEquationButton({
  solved,
  bonus,
  onStart,
}: {
  solved: boolean;
  bonus: number;
  onStart: () => void;
}) {
  const t = useT();
  const label = solved
    ? t("a11y.dailyEquationSolved")
    : t("a11y.dailyEquationPending", { bonus: formatNumber(bonus) });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={solved}
      onPress={onStart}
      // 44×44 minimum tap target: 30px glyph + 8px padding either side.
      // Matches DailyBonusButton / BottomModal menu-button metrics.
      style={{ margin: 4, padding: 8 }}
    >
      <Text style={{ fontSize: 30, opacity: solved ? 0.5 : 1 }}>📅</Text>
    </Pressable>
  );
});

export default DailyEquationButton;
