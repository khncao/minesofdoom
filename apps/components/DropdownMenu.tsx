import React, { ReactNode, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Modal,
  ViewStyle,
  TextStyle,
} from "react-native";

export interface DropdownMenuProps {
  pressable?: ReactNode;
  children?: ReactNode;
  position?: "top" | "bottom";
  listViewStyle?: ViewStyle;
  listTextStyle?: TextStyle;
}

export default function DropdownMenu({
  position = "bottom",
  ...props
}: DropdownMenuProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [pressableLayout, setPressableLayout] = useState({
    x: 0,
    y: 0,
    height: 0,
    width: 0,
  });
  const yPos =
    pressableLayout.y + (position === "bottom" ? pressableLayout.height : 0);
  const xPos = pressableLayout.x;

  return (
    <>
      <Pressable
        onLayout={(ev) => {
          setPressableLayout(ev.nativeEvent.layout);
        }}
        onPress={() => setShowDropdown(true)}
        style={{
          alignSelf: "center",
          minWidth: 30,
          minHeight: 30,
          alignItems: "center",
        }}
      >
        {props.pressable ?? (
          <Text style={[{ color: "white", fontSize: 24 }, props.listTextStyle]}>
            ☰
          </Text>
        )}
      </Pressable>
      <Modal
        transparent={true}
        onPointerUp={() => setShowDropdown(false)}
        visible={showDropdown}
      >
        {/* TODO: avoid viewport cropping */}
        <View
          style={[
            {
              transform: [{ translateX: xPos }, { translateY: yPos }],
            },
            styles.childrenContainer,
            props.listViewStyle,
          ]}
        >
          {props.children}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  childrenContainer: {
    backgroundColor: "white",
    height: "auto",
    width: "auto",
    margin: 4,
  },
});
