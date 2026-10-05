import { memo } from "react";
import { Animated, View } from "react-native";
import { T as Text } from "../textScale";
import { useT } from "src/hooks/useI18n";
import { getComboTierProgress } from "../game";
import { styles } from "../styles";

const ComboIndicator = memo(function ComboIndicator({
  combo,
  comboMultiplier,
  flashAnim,
}: {
  combo: number;
  comboMultiplier: number;
  flashAnim: Animated.Value;
}) {
  const t = useT();
  // No box at combo 0 (2026-10-05): the container is a dark rounded bar,
  // and rendering it with an empty readout inside left a blank box under
  // the equation on every idle screen. Nothing to show, nothing to render.
  if (combo <= 0) return null;
  const progress = getComboTierProgress(combo);
  return (
    <View style={styles.comboContainer}>
      <View style={styles.flexCenteredRow}>
        <Animated.Text
          style={[
            styles.comboText,
            { transform: [{ scale: flashAnim }] },
          ]}
        >
          {t("combo.active", { combo })}
        </Animated.Text>
        {comboMultiplier > 1 && (
          <Text style={styles.multiplierText}> ×{comboMultiplier}</Text>
        )}
      </View>
      <View style={styles.comboProgressTrack}>
        <View
          style={[
            styles.comboProgressFill,
            { width: `${progress.fraction * 100}%` },
          ]}
        />
      </View>
      <Text style={styles.comboProgressLabel}>
        {t("combo.untilNext", {
          count: progress.untilNext,
          mult: progress.nextMultiplier,
        })}
      </Text>
    </View>
  );
});

export default ComboIndicator;
