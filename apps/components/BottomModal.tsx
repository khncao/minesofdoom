import React, { memo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  Text,
} from "react-native";

export interface BottomModalProps {
  pressable?: React.ReactNode;
  children?: React.ReactNode;
  accessibilityLabel?: string;
  /**
   * Wrap the children in a ScrollView and clamp the sheet to 90% of the
   * viewport height. For long content (goals/achievements progress
   * tracker) that would otherwise overflow the screen on small devices
   * with no way to reach the bottom.
   */
  scrollable?: boolean;
}

function BottomModal({ scrollable = false, ...props }: BottomModalProps) {
  const [showModal, setShowModal] = useState(false);
  const toggle = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel ?? "Settings"}
      onPress={() => setShowModal(!showModal)}
      // 44×44 minimum tap target: 30px glyph + 8px padding either side.
      style={{ margin: 10, padding: 8 }}
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

        <View
          style={[
            styles.childrenContainer,
            scrollable && styles.scrollableContainer,
          ]}
        >
          <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close settings"
        style={styles.closeButton}
        onPress={() => setShowModal(false)}
      >
            <Text style={styles.closeButtonText}>✕</Text>
          </Pressable>
          {scrollable ? (
            <ScrollView
              style={styles.scrollContent}
              contentContainerStyle={styles.scrollContentInner}
            >
              {props.children}
            </ScrollView>
          ) : (
            props.children
          )}
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
  scrollableContainer: {
    // Clamp to the viewport so long content scrolls instead of overflowing.
    maxHeight: "90%",
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentInner: {
    paddingBottom: 4,
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
