import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useT } from "src/hooks/useI18n";

export interface NumericKeypadProps {
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  onSubmit: () => void;
}

const Key = ({
  title,
  onPress,
  onLongPress,
  accessibilityLabel,
  accessibilityHint,
  highlighted = false,
}: {
  title: string;
  onPress: () => void;
  onLongPress?: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  highlighted?: boolean;
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel}
    accessibilityHint={accessibilityHint}
    style={({ pressed }) => [
      styles.key,
      highlighted ? styles.keyHighlighted : null,
      pressed ? styles.keyPressed : null,
    ]}
    onPress={onPress}
    onLongPress={onLongPress}
  >
    <Text
      style={[styles.keyText, highlighted ? styles.keyTextHighlighted : null]}
    >
      {title}
    </Text>
  </Pressable>
);

/**
 * On-screen numeric keypad (plan §2.1): lets the player type answers
 * without ever summoning the OS keyboard. Grid:
 *   1 2 3 / 4 5 6 / 7 8 9 / ⌫ 0 =
 * ⌫ deletes one digit; holding it clears the whole answer.
 */
const NumericKeypad = memo(function NumericKeypad({
  onDigit,
  onBackspace,
  onClear,
  onSubmit,
}: NumericKeypadProps) {
  const t = useT();
  return (
    <View style={styles.keypad}>
      {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
        <Key
          key={d}
          title={d}
          accessibilityLabel={t("a11y.digit", { d })}
          onPress={() => onDigit(d)}
        />
      ))}
      <Key
        title="⌫"
        accessibilityLabel={t("a11y.backspace")}
        accessibilityHint={t("a11y.holdToClear")}
        onPress={onBackspace}
        onLongPress={onClear}
      />
      <Key
        title="0"
        accessibilityLabel={t("a11y.digit", { d: "0" })}
        onPress={() => onDigit("0")}
      />
      <Key
        title="="
        accessibilityLabel={t("a11y.submitAnswer")}
        highlighted
        onPress={onSubmit}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  keypad: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    alignSelf: "stretch",
    maxWidth: 300,
    marginHorizontal: 8,
  },
  key: {
    flex: 1,
    // 44px tap target (plan §2.2).
    height: 44,
    borderRadius: 6,
    backgroundColor: "#503121",
    alignItems: "center",
    justifyContent: "center",
  },
  keyPressed: {
    opacity: 0.65,
  },
  keyHighlighted: {
    backgroundColor: "#ffaa44",
  },
  keyText: {
    color: "#fff",
    fontSize: 18,
    userSelect: "none",
  },
  keyTextHighlighted: {
    color: "#1f1f1f",
    fontWeight: "bold",
  },
});

export default NumericKeypad;
