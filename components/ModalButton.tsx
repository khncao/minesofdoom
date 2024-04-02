import React, { useState } from "react";
import {
  Modal,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
  Text,
} from "react-native";
import WebsiteLink from "./WebsiteLink";

export interface ModalButtonProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle> | undefined;
}

export default function ModalButton(props: ModalButtonProps) {
  const [showSettings, setShowSettings] = useState(false);
  const toggle = (
    <Pressable
      onPress={() => setShowSettings(!showSettings)}
      style={{ margin: 10 }}
    >
      <Text style={{ fontSize: 30 }}>⚙️</Text>
    </Pressable>
  );

  return (
    <View style={props.style}>
      {toggle}

      <Modal
        animationType="slide"
        visible={showSettings}
        onRequestClose={() => setShowSettings(false)}
        transparent={true}
      >
        <Pressable
          onPress={() => {
            setShowSettings(false);
          }}
          style={{ flex: 1 }}
        />

        <View
          style={{
            backgroundColor: "#404040",
            marginTop: "auto",
            gap: 20,
          }}
        >
          {props.children}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            {toggle}
            <WebsiteLink />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({});
