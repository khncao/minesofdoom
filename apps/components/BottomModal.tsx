import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, View, Text } from "react-native";

export interface BottomModalProps {
  pressable?: React.ReactNode;
  children?: React.ReactNode;
}

export default function BottomModal(props: BottomModalProps) {
  const [showModal, setShowModal] = useState(false);
  const toggle = (
    <Pressable onPress={() => setShowModal(!showModal)} style={{ margin: 10 }}>
      {props.pressable ?? <Text style={{ fontSize: 30 }}>⚙️</Text>}
    </Pressable>
  );

  return (
    <>
      {toggle}

      <Modal
        animationType="slide"
        visible={showModal}
        onRequestClose={() => setShowModal(false)}
        transparent={true}
        onPointerUp={() => setShowModal(false)}
      >
        <Pressable
          onPress={() => {
            setShowModal(false);
          }}
        />

        <View style={styles.childrenContainer}>{props.children}</View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  childrenContainer: {
    backgroundColor: "#404040",
    marginTop: "auto",
    gap: 20,
  },
});
