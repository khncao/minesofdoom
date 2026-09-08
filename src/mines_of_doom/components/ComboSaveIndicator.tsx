import { memo, useEffect, useState } from "react";
import { Pressable, Text } from "react-native";
import { useT } from "src/hooks/useI18n";
import { formatNumber } from "src/utils/format";
import { styles } from "../styles";

/**
 * Main-screen combo-save pill (todo: "Allow saving combo with rewarded-ad"):
 * the floating "undo" for a combo the player JUST lost — shown in place
 * (under the combo indicator) so the loss and the remedy sit together,
 * with a live countdown on the offer window. The pill IS the "watch" tap
 * (guardrail 2: rewarded, opt-in only — the player taps to save, never the
 * other way round), and it is only rendered while canClaimComboSave holds
 * (provider available + a save in the window + daily caps).
 */
const ComboSaveIndicator = memo(function ComboSaveIndicator({
  combo,
  until,
  claiming,
  onClaim,
  onPrime,
}: {
  /** The pre-loss combo value being offered back. */
  combo: number;
  /** Offer-window expiry (epoch ms). */
  until: number;
  /** True while this kind's ad is mid-"play" (the pill shows "…"). */
  claiming: boolean;
  /** The claim — the same handler the ad panel's row uses. */
  onClaim: () => void;
  /** Pre-tap probe (no-op outside the web Ad Placement provider). */
  onPrime: () => void;
}) {
  const t = useT();
  // Prime the "comboSave" placement on mount: the pill only renders while
  // a save is actually claimable, so the web Ad Placement probe lands
  // before the player can tap it (no-op for other providers).
  useEffect(() => {
    onPrime();
  }, [onPrime]);
  // The window is at most 60s, so a 1s tick is the right cadence (same
  // pattern as AdRewardsPanel's countdown) — and the interval only exists
  // while the pill is mounted.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const secondsLeft = Math.max(0, Math.ceil((until - now) / 1000));
  return (
    <Pressable
      testID="combo-save-indicator"
      accessibilityRole="button"
      accessibilityLabel={
        claiming
          ? t("combo.saveOfferClaiming", { combo: formatNumber(combo) })
          : t("combo.saveOffer", {
              combo: formatNumber(combo),
              time: secondsLeft,
            })
      }
      disabled={claiming}
      onPress={onClaim}
      style={styles.comboSavePill}
    >
      <Text style={styles.comboSavePillText}>
        {claiming
          ? t("combo.saveOfferClaiming", { combo: formatNumber(combo) })
          : t("combo.saveOffer", {
              combo: formatNumber(combo),
              time: secondsLeft,
            })}
      </Text>
    </Pressable>
  );
});

export default ComboSaveIndicator;
