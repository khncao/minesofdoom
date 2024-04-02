import React, { useState } from "react";
import {
  Modal,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

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
      <MaterialIcons size={30} color="white" name="settings" />
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
            backgroundColor: "darkgrey",
            marginTop: "auto",
            gap: 20,
          }}
        >
          {props.children}
          {toggle}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({});
