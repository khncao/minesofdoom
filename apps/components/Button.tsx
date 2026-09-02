import React from "react";
import {
  FlexStyle,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
} from "react-native";

export type ButtonTone = "mineral" | "gem";

export interface ButtonProps {
  disabled?: boolean;
  onPress?: () => void;
  title?: string;
  style?: StyleProp<FlexStyle>;
  /**
   * Currency flavor (plan §2.1 "button hierarchy"): tints the button so
   * purchase rows grouped by currency read at a glance. "mineral" is the
   * default (the historical brown look).
   */
  tone?: ButtonTone;
}

const TONE_COLORS: Record<ButtonTone, { enabled: string; disabled: string }> = {
  mineral: { enabled: "#503121", disabled: "#504e4e" },
  gem: { enabled: "#1f4356", disabled: "#46535c" },
};

export default function Button({
  disabled,
  onPress,
  title,
  style,
  tone = "mineral",
}: ButtonProps) {
  const toneColors = TONE_COLORS[tone];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      onPress={onPress}
    >
      <View
        style={[
          {
            ...styles.container,
            backgroundColor: disabled ? toneColors.disabled : toneColors.enabled,
            justifyContent: "center",
            elevation: 5,
          },
          style,
        ]}
      >
        {title && (
          <Text
            style={{
              ...styles.text,
              ...(disabled ? styles.disabled_text : styles.text_enabled),
            }}
          >
            {title}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Shared shell; colors come from TONE_COLORS above (ButtonTone).
  container: { borderRadius: 5 },
  text: {
    margin: 10,
    alignSelf: "center",
    userSelect: "none",
  },
  text_enabled: {
    color: "white",
  },
  disabled_text: {
    color: "#303030",
  },
});
