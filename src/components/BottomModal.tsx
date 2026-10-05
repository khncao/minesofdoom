import React, { memo, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View, type ViewStyle } from "react-native";
import { T as Text } from "src/mines_of_doom/textScale";
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
const AvoidingRoot = (
  Platform.OS === "web" ? View : KeyboardAvoidingView
) as React.ComponentType<AvoidingRootProps>;

/**
 * Glyph size for the top menu row's icon buttons (☰ 🛍️ 🏆 🎬 📜 📁 📅 and
 * BottomModal's own ⚙️ fallback), measured on the live web build at a 360px
 * viewport:
 *
 *   six buttons at fontSize 30 = 320px of buttons + 48px of margins +
 *   20px of row gaps = 388px, against the 338px of inner width the header
 *   row has there — so the last one (🛍️) wrapped onto a second row and the
 *   strip cost ~88px of height it did not need to spend.
 *
 * The row's WORST case is EIGHT entries: the save pill is back in the row
 * (it had left it for the cave dock, then the menu sheet's close row, and
 * the 2026-10-05 navbar pass put it back at the far right), and four of
 * the icons are conditional (🎁 daily bonus, 📅 daily equation, 🏆
 * leaderboard, 🎬 ad rewards — each hidden while its auto-claim/
 * availability flag is on), so a fully populated row is
 * ☰ 🎁 📜 📅 🏆 🎬 🛍️ 💾.
 *
 * Every navbar button is now a FIXED 44×44 box (the standard minimum touch
 * target, see NAV_BUTTON_STYLE) instead of a padding-bound width: the old
 * glyph-advance budget (button width = emoji advance + padding, ~41.5px)
 * varied with the platform emoji font and left the width 2.5px under the
 * 44 standard. Fixed squares make the row predictable: at a 360px viewport
 * the inner width is 360 − 2×6 (headerRow margin) − 2×5 (padding) = 338px,
 * so up to seven 44px buttons + six 4px gaps (332px) fit one row and an
 * eighth (the save pill, ~47px) wraps to a second, centred row — the
 * header row is flexWrap:wrap on purpose, and the fully-populated eight
 * happens only while the daily auto-flags are off AND leaderboard and ad
 * rewards are both available.
 *
 * The glyph itself stays 20: inside a 44px box it needs no padding budget
 * at all, so 22 was never necessary.
 */
export const NAV_ICON_SIZE = 20;

/**
 * Standard navbar button size (2026-10-05): a fixed 44×44 touch target
 * (the HIG/Material minimum), glyph centred, no margin — the row's gap
 * does the spacing. Every top-bar button uses this: the BottomModal
 * toggle (☰ 📜 🏆 🎬 🛍️ …), the standalone 🎁/📅 Pressables and the
 * save pill's box, so the row is uniform on every platform regardless of
 * emoji font metrics.
 */
export const NAV_BUTTON_STYLE = {
  width: 44,
  height: 44,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  margin: 0,
};

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
  /**
   * Fill the whole screen instead of a bottom-anchored sheet: the panel
   * covers the viewport edge-to-edge (no rounded top corners, no dimmed
   * backdrop visible behind it) and reserves the top safe-area inset so
   * the ✕ clear of the status bar. For long multi-view menus where a 90%
   * sheet wastes the top of the screen (todo: "menu modal takes up whole
   * screen").
   */
  fullscreen?: boolean;
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
  fullscreen = false,
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
      // Fixed 44×44 standard touch target (NAV_BUTTON_STYLE) — see the
      // row-budget note at the top of this file.
      style={NAV_BUTTON_STYLE}
    >
      {props.pressable ?? (
        <Text style={{ fontSize: NAV_ICON_SIZE }}>⚙️</Text>
      )}
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
              fullscreen && styles.fullscreenSheet,
              { paddingBottom: Math.max(20, insets.bottom + 12) },
              // Fullscreen covers the status bar, so the ✕ row needs the
              // top inset reserved (zero on web, as before).
              fullscreen && { paddingTop: Math.max(12, insets.top + 8) },
            ]}
          >
            {/* Close row: just the ✕, right-aligned (the save pill's old
                left slot left with the pill's return to the navbar). */}
            <View style={styles.closeRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("a11y.closeSettings")}
                testID={sheetTestID ? `${sheetTestID}-close` : undefined}
                style={styles.closeButton}
                onPress={() => setOpen(false)}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </Pressable>
            </View>
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
  // Fullscreen variant: edge-to-edge panel, no sheet corners; placed after
  // scrollableSheet in the style array so its maxHeight wins.
  fullscreenSheet: {
    top: 0,
    maxHeight: "100%",
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentInner: {
    paddingBottom: 4,
  },
  // The ✕ used to be `alignSelf: "flex-end"` on its own — correct for a
  // lone right-aligned control, wrong for a row (alignSelf would push it
  // to the BOTTOM of the cross axis). The row owns the placement now.
  closeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
  },
  closeButton: {
    padding: 10,
    paddingHorizontal: 16,
  },
  closeButtonText: {
    color: "#ccc",
    fontSize: 20,
  },
});
