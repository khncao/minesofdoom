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
 * without ever summoning the OS keyboard. Standard numpad layout:
 *   7 8 9 ⌫
 *   4 5 6 C
 *   1 2 3 =
 *   0 0 0 0
 * ⌫ deletes one digit; C (or holding ⌫) clears the whole answer.
 */
const NumericKeypad = memo(function NumericKeypad({
  onDigit,
  onBackspace,
  onClear,
  onSubmit,
}: NumericKeypadProps) {
  const t = useT();
  const digit = (d: string) => (
    <Key
      title={d}
      accessibilityLabel={t("a11y.digit", { d })}
      onPress={() => onDigit(d)}
    />
  );
  return (
    <View style={styles.keypad}>
      <View style={styles.keyRow}>
        {digit("7")}
        {digit("8")}
        {digit("9")}
        <Key
          title="⌫"
          accessibilityLabel={t("a11y.backspace")}
          accessibilityHint={t("a11y.holdToClear")}
          onPress={onBackspace}
          onLongPress={onClear}
        />
      </View>
      <View style={styles.keyRow}>
        {digit("4")}
        {digit("5")}
        {digit("6")}
        <Key
          title="C"
          accessibilityLabel={t("a11y.clearAnswer")}
          onPress={onClear}
        />
      </View>
      <View style={styles.keyRow}>
        {digit("1")}
        {digit("2")}
        {digit("3")}
        <Key
          title="="
          accessibilityLabel={t("a11y.submitAnswer")}
          highlighted
          onPress={onSubmit}
        />
      </View>
      <View style={styles.keyRow}>{digit("0")}</View>
    </View>
  );
});

const styles = StyleSheet.create({
  keypad: {
    gap: 6,
    alignSelf: "stretch",
    maxWidth: 320,
    marginHorizontal: 8,
  },
  keyRow: {
    flexDirection: "row",
    gap: 6,
  },
  key: {
    flex: 1,
    // 56px tap target — deliberately larger than the 44px minimum (plan §2.2)
    // for a comfortable thumb reach on the numpad.
    height: 56,
    borderRadius: 8,
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
    fontSize: 22,
    userSelect: "none",
  },
  keyTextHighlighted: {
    color: "#1f1f1f",
    fontWeight: "bold",
  },
});

export default NumericKeypad;
