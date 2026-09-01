import { memo } from "react";
import { Text, View } from "react-native";
import { emojis } from "apps/utils/graphics/emojis";
import { formatNumber } from "apps/utils/format";
import { styles } from "../styles";

const DepthBanner = memo(function DepthBanner({
  depth,
  mineralsPerSec,
}: {
  depth: number;
  mineralsPerSec: number;
}) {
  return (
    <View style={styles.depthBanner}>
      <Text style={styles.depthText}>⛏ Depth: {depth}m</Text>
      {mineralsPerSec > 0 && (
        <Text style={styles.depthText}>
          {emojis.mineral} {formatNumber(mineralsPerSec)}/s
        </Text>
      )}
    </View>
  );
});

export default DepthBanner;
