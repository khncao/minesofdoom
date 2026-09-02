import { memo } from "react";
import { Pressable, Text } from "react-native";
import { useT } from "src/hooks/useI18n";
import { formatNumber } from "src/utils/format";

/**
 * Daily bonus button (plan §4.2): sits next to the goals panel. 🎁 while a
 * claim is pending, 🌙 after today's claim. The long-press-free design
 * mirrors the other bottom-row icon buttons; the full details are in the
 * accessibilityLabel and the claim toast.
 */
const DailyBonusButton = memo(function DailyBonusButton({
  claimable,
  bonus,
  streak,
  onClaim,
}: {
  claimable: boolean;
  bonus: number;
  streak: number;
  onClaim: () => void;
}) {
  const t = useT();
  const label = claimable
    ? streak > 0
      ? t("a11y.dailyClaimableStreak", {
          bonus: formatNumber(bonus),
          day: streak + 1,
        })
      : t("a11y.dailyClaimable", { bonus: formatNumber(bonus) })
    : t("a11y.dailyClaimed");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={!claimable}
      onPress={onClaim}
      // 44×44 minimum tap target: 30px glyph + 8px padding either side.
      // Matches the BottomModal menu-button metrics (margin 4 / padding 8)
      // so the footer icons are uniform (plan "Adjust").
      style={{ margin: 4, padding: 8 }}
    >
      <Text style={{ fontSize: 30, opacity: claimable ? 1 : 0.5 }}>
        {claimable ? "🎁" : "🌙"}
      </Text>
    </Pressable>
  );
});

export default DailyBonusButton;
