import { memo } from "react";
import { Linking, Pressable, Text } from "react-native";
import { useT } from "src/hooks/useI18n";

/**
 * Inquiries button: opens the player's mail app addressed to the developer.
 * A plain `mailto:` link — no SDK, works on web and native (guardrail 5
 * keeps the web build free/SDK-less; a mail link is neither).
 */
const INQUIRIES_EMAIL = "minus4kelvin@gmail.com";

const InquiriesButton = memo(function InquiriesButton() {
  const t = useT();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("a11y.inquiries")}
      onPress={() =>
        Linking.openURL(
          `mailto:${INQUIRIES_EMAIL}?subject=${encodeURIComponent(
            t("inquiries.subject"),
          )}`,
        )
      }
      // 44×44 minimum tap target: 30px glyph + 8px padding either side.
      // Matches the other bottom-row icon buttons (margin 4 / padding 8).
      style={{ margin: 4, padding: 8 }}
    >
      <Text style={{ fontSize: 30 }}>✉️</Text>
    </Pressable>
  );
});

export default InquiriesButton;
