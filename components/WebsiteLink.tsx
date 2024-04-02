import React from "react";
import { Linking, StyleSheet, Text } from "react-native";

const urls = {
  m4k: "https://minus4kelvin.com/",
};

export interface WebsiteLinkProps {
  url?: string;
}

export default function WebsiteLink({
  url = urls["m4k"],
  ...props
}: WebsiteLinkProps) {
  return (
    <Text
      onPress={() => {
        Linking.openURL(url);
      }}
      style={{ fontSize: 30 }}
    >
      🌐
    </Text>
  );
}

const styles = StyleSheet.create({});
