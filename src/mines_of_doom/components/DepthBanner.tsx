import { memo } from "react";
import { Text, View } from "react-native";
import { emojis } from "src/utils/graphics/emojis";
import { formatNumber } from "src/utils/format";
import { styles } from "../styles";

const DepthBanner = memo(function DepthBanner({
  depth,
  mineralsPerSec,
  tierName,
  clickBonus,
}: {
  depth: bigint;
  mineralsPerSec: bigint;
  /** Current depth-tier/biome name (DEPTH_TIERS in game.ts). */
  tierName: string;
  /** Depth-tier click multiplier (1 = no bonus yet). */
  clickBonus: number;
}) {
  return (
    <View style={styles.depthBanner} testID="depth-banner">
      <Text style={styles.depthText}>
        ⛏ {formatNumber(depth)}m · {tierName}
        {clickBonus > 1 ? ` (×${clickBonus} ⛏)` : ""}
      </Text>
      {mineralsPerSec > 0n && (
        <Text style={styles.depthText}>
          {emojis.mineral} {formatNumber(mineralsPerSec)}/s
        </Text>
      )}
    </View>
  );
});

export default DepthBanner;
