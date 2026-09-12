import { memo } from "react";
import { Pressable } from "react-native";
import { T as Text } from "../textScale";
import { useT } from "src/hooks/useI18n";
import { formatNumber } from "src/utils/format";

/**
 * Weekly contract button (todo: "weekly challenges"): sits next to the
 * daily bonus in the top menu row. 📜 while any goal is still open, dimmed
 * while in progress, bright while the claim is pending. The
 * long-press-free design mirrors the other header-row icon buttons; the
 * done-count detail lives in the accessibilityLabel and the claim toast.
 */
const WeeklyContractButton = memo(function WeeklyContractButton({
  claimable,
  claimed,
  bonus,
  done,
  total,
  onClaim,
}: {
  claimable: boolean;
  claimed: boolean;
  bonus: number;
  done: number;
  total: number;
  onClaim: () => void;
}) {
  const t = useT();
  const label = claimable
    ? t("a11y.weeklyClaimable", { bonus: formatNumber(bonus) })
    : claimed
      ? t("a11y.weeklyClaimed")
      : t("a11y.weeklyProgress", { done, total });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={!claimable}
      onPress={onClaim}
      // 44×44 minimum tap target: 30px glyph + 8px padding either side.
      // Matches the BottomModal menu-button metrics (margin 4 / padding 8)
      // so the header icons are uniform (plan "Adjust").
      style={{ margin: 4, padding: 8 }}
    >
      <Text style={{ fontSize: 30, opacity: claimable ? 1 : 0.5 }}>
        📜
      </Text>
    </Pressable>
  );
});

export default WeeklyContractButton;
