import React from "react";
import { Linking, Text } from "react-native";

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
