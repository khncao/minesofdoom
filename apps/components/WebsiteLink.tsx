import React from "react";
import { Linking, StyleSheet, Text } from "react-native";

const urls = {};

export interface WebsiteLinkProps {
  url?: string;
}

export default function WebsiteLink({ url, ...props }: WebsiteLinkProps) {
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

const styles = StyleSheet.create({});
