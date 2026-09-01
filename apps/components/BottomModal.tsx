import React, { memo, useState } from "react";
import { Modal, Pressable, StyleSheet, View, Text } from "react-native";

export interface BottomModalProps {
  pressable?: React.ReactNode;
  children?: React.ReactNode;
  accessibilityLabel?: string;
}

function BottomModal(props: BottomModalProps) {
  const [showModal, setShowModal] = useState(false);
  const toggle = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel ?? "Settings"}
      onPress={() => setShowModal(!showModal)}
      style={{ margin: 10 }}
    >
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
      >
        <Pressable style={styles.backdrop} onPress={() => setShowModal(false)} />

        <View style={styles.childrenContainer}>
          <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close settings"
        style={styles.closeButton}
        onPress={() => setShowModal(false)}
      >
            <Text style={styles.closeButtonText}>✕</Text>
          </Pressable>
          {props.children}
        </View>
      </Modal>
    </>
  );
}

export default memo(BottomModal);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  childrenContainer: {
    backgroundColor: "#404040",
    gap: 20,
    paddingBottom: 20,
  },
  closeButton: {
    alignSelf: "flex-end",
    padding: 10,
    paddingHorizontal: 16,
  },
  closeButtonText: {
    color: "#ccc",
    fontSize: 20,
  },
});
