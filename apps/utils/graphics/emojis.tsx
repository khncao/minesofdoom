import { Text } from "react-native";

export const emojis = {
  gem: "💎",
  mineral: "🪨",
};

export const emojiText = (emoji: keyof typeof emojis) => (
  <Text style={{ fontSize: 20, userSelect: "none" }}>{emojis[emoji]}</Text>
);
