import { memo } from "react";
import { Animated, Text, View } from "react-native";
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
  return (
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
  );
});

export default ComboIndicator;
