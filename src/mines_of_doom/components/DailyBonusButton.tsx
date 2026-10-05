import { memo } from "react";
import { Pressable } from "react-native";
import { T as Text } from "../textScale";
import { useT } from "src/hooks/useI18n";
import { formatNumber } from "src/utils/format";
import { NAV_ICON_SIZE } from "src/components/BottomModal";

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
  freezes,
  onClaim,
}: {
  claimable: boolean;
  bonus: number;
  streak: number;
  /** Streak-freeze stock (pass 19) — a11y label detail only, like the
   *  streak itself: the icon stays a single glyph. */
  freezes: number;
  onClaim: () => void;
}) {
  const t = useT();
  let label = claimable
    ? streak > 0
      ? t("a11y.dailyClaimableStreak", {
          bonus: formatNumber(bonus),
          day: streak + 1,
        })
      : t("a11y.dailyClaimable", { bonus: formatNumber(bonus) })
    : t("a11y.dailyClaimed");
  if (freezes > 0) {
    label += ` · ${t("a11y.streakFreezes", { count: freezes })}`;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={!claimable}
      onPress={onClaim}
      // 44px minimum tap target: padding either side plus the minHeight, so
      // the smaller NAV_ICON_SIZE glyph does not erode it. Same metrics as
      // the BottomModal menu button (margin 4 / padding 6) so the row icons
      // are uniform (plan "Adjust").
      style={{ margin: 4, paddingHorizontal: 6, paddingVertical: 8, minHeight: 44 }}
    >
      <Text style={{ fontSize: NAV_ICON_SIZE, opacity: claimable ? 1 : 0.5 }}>
        {claimable ? "🎁" : "🌙"}
      </Text>
    </Pressable>
  );
});

export default DailyBonusButton;
