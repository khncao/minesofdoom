import { memo } from "react";
import { Pressable, Text } from "react-native";
import { formatNumber } from "apps/utils/format";

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
  const label = claimable
    ? `Claim daily bonus: +${formatNumber(bonus)} minerals` +
      (streak > 0 ? `, starts day ${streak + 1} streak` : "")
    : "Daily bonus claimed today. Come back tomorrow for the next bonus.";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={!claimable}
      onPress={onClaim}
      // 44×44 minimum tap target: 30px glyph + 8px padding either side.
      style={{ margin: 10, padding: 8 }}
    >
      <Text style={{ fontSize: 30, opacity: claimable ? 1 : 0.5 }}>
        {claimable ? "🎁" : "🌙"}
      </Text>
    </Pressable>
  );
});

export default DailyBonusButton;
