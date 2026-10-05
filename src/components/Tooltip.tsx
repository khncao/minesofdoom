import { memo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { T as Text } from "src/mines_of_doom/textScale";
/**
 * Long-press tooltip: wraps any touchable content and shows a small bubble
 * above it while pressed. Works with touch (long-press) and mouse (hold).
 * Also exposes the content as an `accessibilityHint` for screen readers,
 * so the info is available without a pointer.
 *
 * `onPress` (optional, 2026-10-04): forwarding the row's own action to the
 * wrapper Pressable makes the WHOLE row a target instead of only the control
 * inside it. It also makes the press reliable — see `delayLongPress` below.
 */
const Tooltip = memo(function Tooltip({
  content,
  label,
  onPress,
  children,
}: {
  content: string;
  label?: string;
  /** Optional action for a short tap. Omit for purely decorative labels. */
  onPress?: () => void;
  children: React.ReactNode;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.anchor}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={content}
        // 150ms was short enough that an ordinary tap (~80-120ms) could land
        // past it and be swallowed as a long-press — which is why the keypad
        // switches in Settings felt like they "sometimes" ignored a tap. A
        // real long press is 400ms+; a normal one never reaches it.
        delayLongPress={400}
        onPress={onPress}
        onLongPress={() => setVisible(true)}
        onPressOut={() => setVisible(false)}
      >
        {children}
      </Pressable>
      {visible && (
        <View style={styles.bubble} pointerEvents="none">
          <Text style={styles.text}>{content}</Text>
        </View>
      )}
    </View>
  );
});

export default Tooltip;

const styles = StyleSheet.create({
  anchor: {
    position: "relative",
    alignItems: "center",
    alignSelf: "stretch",
  },
  bubble: {
    position: "absolute",
    bottom: "100%",
    left: "50%",
    transform: [{ translateX: -70 }],
    marginBottom: 6,
    width: 140,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
    zIndex: 1000,
  },
  text: {
    color: "#fff",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 16,
  },
});
