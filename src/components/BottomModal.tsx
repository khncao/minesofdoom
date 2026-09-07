import React, { memo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  Text,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useT } from "src/hooks/useI18n";

// Web has no OS keyboard, so the avoidance root is a plain View there
// (same pattern as AnswerInput's AvoidingView — keeps the web bundle free
// of any KAV behavior and the intent explicit). Native carries the real
// KeyboardAvoidingView.
type AvoidingRootProps = {
  children?: React.ReactNode;
  style?: ViewStyle;
  behavior?: "height" | "padding";
};
const AvoidingRoot = (Platform.OS === "web"
  ? View
  : KeyboardAvoidingView) as React.ComponentType<AvoidingRootProps>;

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
  /** Notified with the new open state whenever the sheet opens/closes
   *  (any of: the toggle, the backdrop, or the hardware back gesture).
   *  Lets a consumer react to the sheet becoming visible (e.g. refresh
   *  leaderboard data on open). */
  onToggle?: (open: boolean) => void;
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
  onToggle,
  ...props
}: BottomModalProps) {
  const [showModal, setShowModal] = useState(false);
  // Edge-to-edge (RN 0.86 / SDK 57): the Modal window draws under the
  // status and nav bars, so the sheet's last rows (the Save button, the
  // save-code fields, the purchase / delete controls) would sit under the
  // nav bar and its ✕ close button could reach under the status bar.
  // Reserve the bottom inset on the sheet; zero on web (no OS bars).
  const insets = useSafeAreaInsets();
  const t = useT();
  const setOpen = (open: boolean) => {
    setShowModal(open);
    onToggle?.(open);
  };
  const toggle = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel ?? t("a11y.settings")}
      testID={testID}
      onPress={() => setOpen(!showModal)}
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
        onRequestClose={() => setOpen(false)}
        transparent={true}
      >
        {/* Keyboard avoidance (todo "keyboard avoiding views"): the sheets
            hold TextInputs (save-code import, account form, leaderboard
            name). A transparent Modal's window is not guaranteed to
            resize with the OS keyboard on every platform (Android
            adjustResize applies to the activity window; the Modal dialog
            window and iOS behave differently), so the bottom-pinned sheet
            can end up UNDER the keyboard. This KAV compensates only for
            the ACTUAL overlap between its frame and the keyboard: when a
            platform has already resized the window, the overlap is zero
            and the KAV adds nothing — so it cannot double-avoid. The
            sheet + backdrop are absolutely inset, which sits inside the
            padding box, so the padding/height shrink lifts the whole
            sheet above the keyboard. */}
        <AvoidingRoot
          style={styles.root}
          behavior={Platform.OS === "android" ? "height" : "padding"}
        >
          {/* Full-viewport backdrop (sibling of the sheet, NOT a spacer):
              every tap outside the sheet closes it. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("a11y.closeSettings")}
            style={styles.backdrop}
            onPress={() => setOpen(false)}
          />
          <View
            testID={sheetTestID}
            style={[
              styles.sheet,
              scrollable && styles.scrollableSheet,
              // Keep the LAST row (Save button, save-code field, purchase
              // / delete controls) clear of the nav bar. Web insets are
              // zero, so the sheet's 20dp padding is the floor. (The top
              // edge needs no inset: the scrollable clamp (90%) and the
              // content-sized sheets already stay out of the status bar,
              // and a bottom-anchored sheet ignores margin-top anyway.)
              { paddingBottom: Math.max(20, insets.bottom + 12) },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("a11y.closeSettings")}
              testID={sheetTestID ? `${sheetTestID}-close` : undefined}
              style={styles.closeButton}
              onPress={() => setOpen(false)}
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
        </AvoidingRoot>
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
  // Opaque sheet pinned to the bottom edge, full width. The paddingBottom
  // floor (20) is overridden by the caller with the safe-inset-aware
  // value (see the sheet style array) — kept here as the web/no-bar case.
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
