import React from "react";
import { Linking } from "react-native";
import { T as Text } from "src/mines_of_doom/textScale";
export interface WebsiteLinkProps {
  url?: string;
}

export default function WebsiteLink({ url }: WebsiteLinkProps) {
  return (
    <Text
      onPress={() => {
        if (url) Linking.openURL(url);
      }}
      style={{ fontSize: 30 }}
    >
      🌐
    </Text>
  );
}
