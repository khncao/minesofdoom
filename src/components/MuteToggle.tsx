import React, { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { useT } from "src/hooks/useI18n";

export interface MuteToggleProps {
  init: boolean;
  onToggleChange: (newValue: boolean) => void;
}

function MuteToggle({ ...props }: MuteToggleProps) {
  const t = useT();
  const [toggle, setToggle] = useState(props.init);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        toggle ? t("a11y.unmute") : t("a11y.mute")
      }
      onPress={() => {
        setToggle(!toggle);
        props.onToggleChange(!toggle);
      }}
      // 44×44 minimum tap target: 30px glyph + 8px padding either side.
      style={{ padding: 8 }}
    >
      {toggle ? (
        <Text style={styles.iconText}>🔇</Text>
      ) : (
        <Text style={styles.iconText}>🔊</Text>
      )}
    </Pressable>
  );
}

export default React.memo(MuteToggle);

const styles = StyleSheet.create({
  iconText: {
    fontSize: 30,
  },
});
