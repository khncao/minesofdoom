import React, { memo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  Text,
} from "react-native";
import { useT } from "src/hooks/useI18n";

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
  /** testID forwarded to the toggle button (e2e anchors). */
  testID?: string;
  /** testID forwarded to the sheet itself (e2e anchors). */
  sheetTestID?: string;
}

/**
 * A bottom sheet: an opaque panel anchored to the bottom of the screen
 * over a dimmed backdrop; tapping the backdrop or the ✕ closes it.
 *
 * Layout is deliberately all-absolute (backdrop fills the root, the sheet
 * is pinned to the bottom edge) instead of a flex stack. The old flex
 * stack (`backdrop flex:1` + content-sized sheet, with the scrollable
 * variant putting a `flex:1` ScrollView inside the content-sized sheet)
 * resolved differently per platform — on at least one configuration the
 * sheet height collapsed or overflowed, which is the reported "settings
 * not displaying" bug. Absolute positioning pins both layers to the
 * viewport on web, iOS, and Android alike.
 */
function BottomModal({
  scrollable = false,
  testID,
  sheetTestID,
  ...props
}: BottomModalProps) {
  const [showModal, setShowModal] = useState(false);
  const t = useT();
  const toggle = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel ?? t("a11y.settings")}
      testID={testID}
      onPress={() => setShowModal(!showModal)}
      // 44×44 minimum tap target: 30px glyph + 8px padding either side.
      // Tight margins keep the footer compact (plan "Adjust"); the tap
      // target size is set by the padding, not the margin.
      style={{ margin: 4, padding: 8 }}
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
        <View style={styles.root}>
          {/* Full-viewport backdrop (sibling of the sheet, NOT a spacer):
              every tap outside the sheet closes it. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("a11y.closeSettings")}
            style={styles.backdrop}
            onPress={() => setShowModal(false)}
          />
          <View
            testID={sheetTestID}
            style={[
              styles.sheet,
              scrollable && styles.scrollableSheet,
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("a11y.closeSettings")}
              testID={sheetTestID ? `${sheetTestID}-close` : undefined}
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
        </View>
      </Modal>
    </>
  );
}

export default memo(BottomModal);

const styles = StyleSheet.create({
  // The Modal's content is not guaranteed to be a full-viewport flex
  // container on every platform, so fill it explicitly.
  root: {
    flex: 1,
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  // Opaque sheet pinned to the bottom edge, full width.
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#404040",
    gap: 20,
    paddingBottom: 20,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  scrollableSheet: {
    // Clamp to the viewport so long content scrolls instead of
    // overflowing; the ScrollView inside then has a bounded height to
    // flex into.
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
