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
  testID,
}: {
  title: string;
  onPress: () => void;
  onLongPress?: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  highlighted?: boolean;
  testID?: string;
}) => (
  <Pressable
    testID={testID}
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
 *
 * Layout: the grid is built as FOUR KEY COLUMNS (not rows) so the keys
 * are MAIN-axis flex items of a column. That makes the 56px keys able to
 * flex-shrink toward the 44px minimum tap target when the screen is too
 * short for the full strip — a bottom-row of keys clipped off the screen
 * is an untappable input (todo: inputs near the screen edges). Natural
 * height is unchanged (4 × 56 + 3 gaps); short screens yield key height,
 * never a cut-off row.
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
      testID={`keypad-digit-${d}`}
      accessibilityLabel={t("a11y.digit", { d })}
      onPress={() => onDigit(d)}
    />
  );
  return (
    <View testID="keypad" style={styles.keypad}>
      <View style={styles.keyColumn}>
        {digit("7")}
        {digit("4")}
        {digit("1")}
        {digit("0")}
      </View>
      <View style={styles.keyColumn}>
        {digit("8")}
        {digit("5")}
        {digit("2")}
        {digit("0")}
      </View>
      <View style={styles.keyColumn}>
        {digit("9")}
        {digit("6")}
        {digit("3")}
        {digit("0")}
      </View>
      <View style={styles.keyColumn}>
        <Key
          title="⌫"
          testID="keypad-backspace"
          accessibilityLabel={t("a11y.backspace")}
          accessibilityHint={t("a11y.holdToClear")}
          onPress={onBackspace}
          onLongPress={onClear}
        />
        <Key
          title="C"
          testID="keypad-clear"
          accessibilityLabel={t("a11y.clearAnswer")}
          onPress={onClear}
        />
        <Key
          title="="
          testID="keypad-submit"
          accessibilityLabel={t("a11y.submitAnswer")}
          highlighted
          onPress={onSubmit}
        />
        {digit("0")}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  keypad: {
    flexDirection: "row",
    gap: 6,
    alignSelf: "stretch",
    maxWidth: 320,
    marginHorizontal: 8,
    // The strip sits at the bottom edge of the screen (todo: inputs near
    // the edges): on a short screen the game column overflows and this
    // strip flex-shrinks (keys → 44px floor) instead of its bottom row
    // being clipped under the screen edge.
    flexShrink: 1,
  },
  keyColumn: {
    // flex: 1 = equal horizontal width (the old row's key flex); the
    // column's height follows the keypad (stretch), which is what lets
    // the keys inside shrink vertically.
    flex: 1,
    gap: 6,
  },
  key: {
    // 56px tap target — deliberately larger than the 44px minimum (plan
    // §2.2) for a comfortable thumb reach on the numpad — shrinking to
    // the 44px floor on short screens (see the keypad flexShrink).
    height: 56,
    minHeight: 44,
    flexShrink: 1,
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
