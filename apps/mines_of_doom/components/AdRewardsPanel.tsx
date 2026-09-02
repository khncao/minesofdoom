import { memo } from "react";
import { Text, View } from "react-native";
import BottomModal from "apps/components/BottomModal";
import Button from "apps/components/Button";
import { formatNumber } from "apps/utils/format";
import { emojis } from "apps/utils/graphics/emojis";
import {
  AdKind,
  AD_GEM_ROLLS_PER_DAY,
  AD_GEM_ROLLS_PER_USE,
  AD_MAX_REWARDS_PER_DAY,
} from "../ads";
import { offlineTopUpTicks } from "../game";
import { styles } from "../styles";

/**
 * Rewarded-ads panel (plan §5.1): the single opt-in entry point for ad
 * rewards. Lives in the footer next to the daily bonus, behind a 🎬
 * button, and is only rendered when an ad provider reports itself
 * available — production builds (no SDK bundled) never show it, and dev
 * builds show the simulation with a clear "development build" banner
 * (transparency guardrail).
 *
 * Copy states plainly what each button does (guardrail 4): a "Watch" tap
 * plays an ad, finishing it grants the reward, closing early grants
 * nothing. No urgency language, no countdowns, no dark patterns.
 */
function AdRewardsPanel({
  isDevSim,
  gemRollsLeft,
  dailyCapLeft,
  offlineDouble,
  offlineTopUp,
  claiming,
  onClaim,
}: {
  /** Provider is the dev simulation (dev builds only). */
  isDevSim: boolean;
  gemRollsLeft: number;
  dailyCapLeft: number;
  offlineDouble: number | null;
  /** Minerals withheld beyond the 8h cap that a completed ad would grant. */
  offlineTopUp: number | null;
  claiming: AdKind | null;
  onClaim: (kind: AdKind) => void;
}) {
  return (
    <BottomModal
      pressable={<Text style={{ fontSize: 30 }}>🎬</Text>}
      accessibilityLabel="Rewarded ads"
      scrollable
    >
      <View style={{ gap: 8, padding: 4 }}>
        <Text style={styles.text}>
          🎬 Rewarded ads — watch a video, get a bonus. Optional, and closing
          early just means no bonus.
        </Text>
        {isDevSim && (
          <Text style={{ ...styles.text, color: "#ffaa44" }}>
            ⚠️ Development build: ads are simulated and nothing is actually
            played.
          </Text>
        )}

        <View style={styles.flexCenteredRow}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.text}>
              💎 Gem rolls — +{AD_GEM_ROLLS_PER_USE} {emojis.gem} per watch
            </Text>
            <Text style={{ ...styles.text, fontSize: 11, opacity: 0.7 }}>
              {gemRollsLeft > 0
                ? `${gemRollsLeft} of ${AD_GEM_ROLLS_PER_DAY} left today`
                : "Back tomorrow."}
            </Text>
          </View>
          <Button
            tone="gem"
            disabled={claiming != null || gemRollsLeft <= 0 || dailyCapLeft <= 0}
            title={claiming === "gemRolls" ? "Playing…" : "Watch"}
            onPress={() => onClaim("gemRolls")}
          />
        </View>

        <View style={styles.flexCenteredRow}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.text}>
              🪨 Double offline earnings
            </Text>
            <Text style={{ ...styles.text, fontSize: 11, opacity: 0.7 }}>
              {offlineDouble != null && offlineDouble > 0
                ? `Doubles your last haul: +${formatNumber(offlineDouble)} ${emojis.mineral}`
                : "No offline haul to double yet."}
            </Text>
          </View>
          <Button
            disabled={
              claiming != null ||
              (offlineDouble ?? 0) <= 0 ||
              dailyCapLeft <= 0
            }
            title={claiming === "offlineDouble" ? "Playing…" : "Watch"}
            onPress={() => onClaim("offlineDouble")}
          />
        </View>

        <View style={styles.flexCenteredRow}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.text}>
              ⏱️ Offline top-up (+{offlineTopUpTicks / 3600}h)
            </Text>
            <Text style={{ ...styles.text, fontSize: 11, opacity: 0.7 }}>
              {offlineTopUp != null && offlineTopUp > 0
                ? `The 8h cap withheld your last haul — ` +
                  `watch to earn the next ${offlineTopUpTicks / 3600}h: ` +
                  `+${formatNumber(offlineTopUp)} ${emojis.mineral}`
                : "Available when an offline haul hits the 8h cap."}
            </Text>
          </View>
          <Button
            disabled={
              claiming != null ||
              (offlineTopUp ?? 0) <= 0 ||
              dailyCapLeft <= 0
            }
            title={claiming === "offlineTopUp" ? "Playing…" : "Watch"}
            onPress={() => onClaim("offlineTopUp")}
          />
        </View>

        <Text style={{ ...styles.text, fontSize: 11, opacity: 0.7 }}>
          Up to {AD_MAX_REWARDS_PER_DAY} rewards a day, all of them.
        </Text>
      </View>
    </BottomModal>
  );
}

export default memo(AdRewardsPanel);
