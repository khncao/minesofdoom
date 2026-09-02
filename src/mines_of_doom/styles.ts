import { StyleSheet } from "react-native";

// Shared onboarding text base (can't reference `styles` inside its own
// StyleSheet.create call, so the spread lives here).
const onboardingText = { color: "#fff", userSelect: "none" as const };

export const styles = StyleSheet.create({
  container: {
    backgroundColor: "#2f2f2f",
    alignItems: "center",
    gap: 3,
    flex: 4,
  },
  canvas: {
    flex: 3,
    minWidth: "98%",
    backgroundColor: "#2f1f1f",
    margin: 4,
    overflow: "hidden",
  },
  text: {
    color: "#fff",
    userSelect: "none",
  },
  textInputBox: {
    textAlign: "center",
    borderColor: "white",
    borderWidth: 1,
  },
  // Save-code fields (plan §4.3): small monospace-ish boxes. The exported
  // code must stay user-selectable (long-press to copy), unlike the rest
  // of the UI's userSelect: "none" text.
  saveCodeInput: {
    flex: 1,
    textAlign: "center",
    borderColor: "#555",
    borderWidth: 1,
    borderRadius: 5,
    minHeight: 56,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 11,
    color: "#8fbf8f",
    userSelect: "auto",
  },
  flexCenteredRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  depthBanner: {
    flexDirection: "row",
    gap: 16,
    paddingTop: 6,
    paddingHorizontal: 12,
    alignSelf: "stretch",
    justifyContent: "space-between",
  },
  depthText: {
    color: "#b0a090",
    fontSize: 12,
    userSelect: "none",
  },
  pendingGainText: {
    color: "#8fbf8f",
    fontSize: 12,
    userSelect: "none",
  },
  comboText: {
    color: "#ffaa44",
    fontSize: 16,
    fontWeight: "bold",
    userSelect: "none",
  },
  multiplierText: {
    color: "#ff6644",
    fontSize: 16,
    fontWeight: "bold",
    userSelect: "none",
  },
  comboContainer: {
    alignItems: "center",
    gap: 1,
  },
  comboProgressTrack: {
    alignSelf: "stretch",
    height: 4,
    maxWidth: 120,
    backgroundColor: "#1f1f1f",
    borderRadius: 2,
    overflow: "hidden",
  },
  comboProgressFill: {
    height: 4,
    backgroundColor: "#ffaa44",
  },
  comboProgressLabel: {
    color: "#aaa",
    fontSize: 10,
    userSelect: "none",
  },
  messageOverlay: {
    position: "absolute",
    top: "38%",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
  },
  messageText: {
    color: "#ffe08a",
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    fontSize: 14,
    fontWeight: "bold",
    userSelect: "none",
  },
  // Footer row (plan "Adjust"): uniform 46px-tall icon buttons (each
  // BottomModal/DailyBonusButton is 30px glyph + 8px padding), bottom-
  // aligned so the cave canvas keeps as much vertical space as possible.
  footerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    alignSelf: "stretch",
    paddingTop: 2,
  },
  // First-run onboarding (plan §2.1): full-screen dimmed backdrop above
  // everything (including toasts), centered card, top-right skip button.
  onboardingBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
    zIndex: 100,
  },
  onboardingCard: {
    backgroundColor: "#3a3a3a",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#555",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 20,
    width: "100%",
    maxWidth: 360,
  },
  onboardingIcon: {
    fontSize: 40,
    userSelect: "none",
  },
  onboardingTitle: {
    ...onboardingText,
    fontSize: 18,
    fontWeight: "bold",
  },
  onboardingBody: {
    ...onboardingText,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    opacity: 0.9,
  },
  onboardingDots: {
    flexDirection: "row",
    gap: 6,
  },
  onboardingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#666",
  },
  onboardingDotActive: {
    backgroundColor: "#ffaa44",
  },
  onboardingSkip: {
    position: "absolute",
    top: 12,
    right: 12,
    // 44×44 tap target: 16px text + 12px vertical / 14px horizontal pad.
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  onboardingSkipText: {
    ...onboardingText,
    fontSize: 16,
    opacity: 0.7,
  },
  onboardingNext: {
    backgroundColor: "#ffaa44",
    borderRadius: 8,
    // 44px-tall target: 16px text + 12px vertical padding either side.
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  onboardingNextText: {
    color: "#1f1f1f",
    fontSize: 16,
    fontWeight: "bold",
    userSelect: "none",
  },
});
