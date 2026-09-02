import { memo } from "react";
import { Animated, Text, View } from "react-native";
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
          {combo > 0 ? `🔥 ${combo}x combo` : ""}
        </Animated.Text>
        {comboMultiplier > 1 && (
          <Text style={styles.multiplierText}> ×{comboMultiplier}</Text>
        )}
      </View>
      {combo > 0 && (
        <>
          <View style={styles.comboProgressTrack}>
            <View
              style={[
                styles.comboProgressFill,
                { width: `${progress.fraction * 100}%` },
              ]}
            />
          </View>
          <Text style={styles.comboProgressLabel}>
            {progress.untilNext} more → ×{progress.nextMultiplier}
          </Text>
        </>
      )}
    </View>
  );
});

export default ComboIndicator;
