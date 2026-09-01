import { memo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

/**
 * Long-press tooltip: wraps any touchable content and shows a small bubble
 * above it while pressed. Works with touch (long-press) and mouse (hold).
 * Also exposes the content as an `accessibilityHint` for screen readers,
 * so the info is available without a pointer.
 */
const Tooltip = memo(function Tooltip({
  content,
  label,
  children,
}: {
  content: string;
  label?: string;
  children: React.ReactNode;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.anchor}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={content}
        delayLongPress={150}
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
