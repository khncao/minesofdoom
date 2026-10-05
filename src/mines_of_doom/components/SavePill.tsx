import { memo, useEffect, useRef } from "react";
import { Animated, Pressable, View } from "react-native";
import { T as Text } from "../textScale";
import { useT } from "src/hooks/useI18n";

/**
 * Save affordance (plan §2.1 "settings modal discoverability"): saving is
 * no longer buried in the menu — this button saves immediately, and its
 * status dot pulses amber while state has changed since the last
 * successful write (saveDirty from useGameEngine), green when clean.
 *
 * It lives in the **top navbar, far right** (2026-10-05: the navbar pass
 * moved it back — every navbar button is now a fixed 44×44 box, so the
 * pill no longer breaks the row's budget the way its old padding-bound
 * width did; at worst it wraps to a second centred row, which the header
 * already allows). Before that it sat on the menu sheet's close row, far
 * left opposite the ✕ (todo: "Move save button inside menu"), and before
 * that beside the upgrades button in a floating dock over the cave's
 * bottom-right corner, which went away when the upgrades button moved up
 * into the depth bar.
 *
 * Autosave still runs in the background; the button just makes saving a
 * first-class, visible action. The pulse is a 600ms opacity loop (native
 * driver) and is suppressed entirely under the OS reduce-motion preference.
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
      // Icon + status dot. 44px tall to match the navbar's standard touch
      // size (NAV_BUTTON_STYLE); width stays content-bound (~48px) so the
      // 💾 + status dot keep their room.
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        height: 44,
        paddingHorizontal: 10,
        borderRadius: 10,
        opacity: 0.9,
        backgroundColor: pressed ? "#2c2c2c" : "#3a3a3a",
      })}
    >
      <Text style={{ fontSize: 16, userSelect: "none" }}>💾</Text>
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
