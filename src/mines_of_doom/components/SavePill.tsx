import { memo, useEffect, useRef } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { useT } from "src/hooks/useI18n";
import { styles } from "../styles";

/**
 * Save affordance (plan §2.1 "settings modal discoverability"): saving is
 * no longer buried in the menu — this footer pill saves immediately, and
 * its amber dot pulses while state has changed since the last successful
 * write (saveDirty from useGameEngine). Autosave still runs in the
 * background; the pill just makes saving a first-class, visible action.
 * The pulse is a 600ms opacity loop (native driver) and is suppressed
 * entirely under the OS reduce-motion preference.
 */
const SavePill = memo(function SavePill({
  dirty,
  reduceMotion,
  onSave,
}: {
  dirty: boolean;
  reduceMotion: boolean;
  onSave: () => void;
}) {
  const t = useT();
  const pulse = useRef(new Animated.Value(1));

  useEffect(() => {
    if (!dirty || reduceMotion) {
      pulse.current.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse.current, {
          toValue: 0.3,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulse.current, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [dirty, reduceMotion]);

  return (
    <Pressable
      testID="save-pill"
      accessibilityRole="button"
      accessibilityLabel={
        dirty ? t("a11y.saveDirty") : t("a11y.save")
      }
      onPress={onSave}
      // Same 8px margin as the footer icon buttons so the row stays
      // uniform (plan "Adjust" footer metrics).
      style={({ pressed }) => ({
        margin: 4,
        marginBottom: 8,
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingVertical: 9,
        paddingHorizontal: 10,
        borderRadius: 14,
        backgroundColor: pressed ? "#3a3a3a" : "#333",
      })}
    >
      <Text style={{ fontSize: 14, userSelect: "none" }}>💾</Text>
      <Text style={{ ...styles.text, fontSize: 12, opacity: 0.9 }}>
        {t("save.pill")}
      </Text>
      {dirty ? (
        <Animated.View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: "#ffaa44",
            opacity: pulse.current,
          }}
        />
      ) : (
        <View
          style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#8fbf8f" }}
        />
      )}
    </Pressable>
  );
});

export default SavePill;
