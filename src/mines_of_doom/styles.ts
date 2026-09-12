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
  // Tablet/wide-screen fix (todo): the app is portrait-only, but
  // portrait tablets are still ~1.7× phone width. The game column caps
  // there and centers (the container's alignItems: "center" does the
  // centering once the width is clamped); the canvas's flex still gives
  // it all the vertical room. Full-bleed overlays (toasts, onboarding)
  // deliberately stay OUTSIDE this column, so dim backdrops cover the
  // whole screen, not just the column.
  contentColumn: {
    flex: 1,
    width: "100%",
    maxWidth: 640,
    // The column's children keep the container's vertical rhythm (the gap
    // moves with the content); alignItems: "center" mirrors the container.
    alignItems: "center",
    gap: 3,
  },
  // Play area (todo: upgrades panel on top of keypad): canvas + keypad
  // strip together, position:relative so the upgrades drawer + backdrop
  // can anchor to the WHOLE area — the drawer overlays the keypad strip
  // instead of stopping at the canvas edge.
  playArea: {
    flex: 1,
    minWidth: "98%",
    margin: 4,
    position: "relative",
  },
  // Canvas wrapper (todo: upgrades side overlay): flex:3 fills the play
  // area above the keypad strip (flex-shrinkable keys, see NumericKeypad).
  canvasWrap: {
    flex: 3,
    // Floor so the cave is never squeezed out of existence on short
    // screens (plan "Adjust" — canvas always visible).
    minHeight: 140,
  },
  // Full-bleed cave on wide screens (todo: "add max width for all content
  // containers ... background canvas should still cover whole screen"): the
  // game column caps at 640px, but the cave stretches across the full
  // viewport width behind the capped content. Web-only — on native the
  // column never reaches the cap (phones are narrower than 640) and
  // "100vw" isn't a native length, so the base style stands alone there.
  // (RN's DimensionValue type predates viewport units; RN web passes
  // string lengths through to the DOM untouched — react-native-web's
  // dangerousStyleValue copies non-numeric style values verbatim — and
  // this style is only applied on web anyway, so native never sees it.)
  canvasFullBleed: {
    // SAFETY: "100vw" is a valid CSS length; RN web passes string style
    // values through to the DOM untouched (dangerousStyleValue), and this
    // style is applied on web only, so the number-typed slot never holds
    // it at runtime.
    width: "100vw" as unknown as number,
    alignSelf: "center",
  },
  canvas: {
    flex: 1,
    // Transparent: the full-screen cave background (CaveBackground at the
    // screen root, todo 2026-07-14 #3) shows through. The old solid
    // #2f1f1f is gone — the cave wash is the background now.
    overflow: "hidden",
  },
  // Upgrades drawer header (todo: upgrades menu as a side hidden overlay
  // on the canvas): the close button row. The drawer itself anchors to
  // the play area's right edge (canvas + keypad), so it never sits where
  // the OS keyboard covers the bottom of the screen.
  purchasesHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 4,
  },
  // Drawer tab buttons + the top-row upgrades toggle share these pill
  // metrics.
  purchasesToggle: {
    backgroundColor: "#3a3a3a",
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 14,
  },
  purchasesToggleText: {
    color: "#bbb",
    fontSize: 11,
    fontWeight: "bold",
    userSelect: "none",
  },
  purchasesTabs: {
    flexDirection: "row",
    gap: 4,
  },
  purchasesTabActive: {
    backgroundColor: "#555",
  },
  purchasesTabActiveText: {
    color: "#fff",
  },
  purchasesScroll: {
    flexGrow: 1,
  },
  text: {
    color: "#fff",
    userSelect: "none",
  },
  textInputBox: {
    textAlign: "center",
    borderColor: "white",
    borderWidth: 1,
    // Semi-transparent fill (todo: "improve visibility of ui … where
    // buttons/text are"): the answer box sits over the cave art, so a
    // dark translucent fill + rounding keeps the input readable on every
    // cave theme.
    backgroundColor: "rgba(10, 10, 10, 0.45)",
    borderRadius: 6,
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
    // Translucent bar (todo: "improve visibility of ui … where
    // buttons/text are"): the depth/rate readout sits over the cave, so
    // it gets a dark box behind it.
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    borderRadius: 8,
    marginHorizontal: 8,
    paddingBottom: 4,
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
    // Translucent bar (todo: "improve visibility of ui … where
    // buttons/text are"): the combo readout sits over the cave, so it
    // gets a dark box behind it.
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginHorizontal: 8,
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
    color: "#bbb",
    fontSize: 11,
    userSelect: "none",
  },
  // Combo-save pill (todo: "Allow saving combo with rewarded-ad"): sits
  // under the combo indicator while a lost combo is still saveable — the
  // combo palette (amber) so it reads as "the combo thing you just lost".
  comboSavePill: {
    alignSelf: "center",
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: "rgba(84, 54, 12, 0.92)",
    borderWidth: 1,
    borderColor: "#ffaa44",
  },
  comboSavePillText: {
    color: "#ffe08a",
    fontSize: 12,
    fontWeight: "bold",
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
  // Top menu row (todo): save + upgrades + settings/goals/records +
  // daily bonus + the leaderboard/ads/IAP entry points moved UP from the
  // old footer, so nothing the player needs is behind the OS keyboard.
  // It wraps on narrow screens; the canvas minHeight below it keeps the
  // cave visible even when everything is shown. The whole row sits on a
  // translucent bar (todo: "improve visibility of ui … where
  // buttons/text are") so every entry point reads over the cave art.
  headerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "stretch",
    paddingTop: 2,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    borderRadius: 12,
    marginHorizontal: 6,
    padding: 5,
    gap: 4,
  },
  // The "hold to mine" hint pill (todo: "improve visibility of ui …"):
  // the small caption under the crew column gets a translucent backdrop
  // so it reads on any cave theme.
  hintPill: {
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginTop: 4,
  },
  // The ⚒ UPGRADES button in the top menu row: opens the side drawer
  // over the canvas (hidden by default — the canvas has the room).
  // Floating upgrades button (todo: floating over the canvas): the
  // bottom-right corner of the cave, BELOW the drawer backdrop (z 4) so
  // an open drawer dims it out rather than the button covering rows.
  upgradesToggleFloat: {
    position: "absolute",
    right: 10,
    bottom: 10,
    zIndex: 3,
    backgroundColor: "#3a3a3a",
    opacity: 0.9,
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  upgradesAffordableDot: {
    position: "absolute",
    top: -5,
    right: -5,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: "#ffaa44",
    borderWidth: 2,
    borderColor: "#1f1f1f",
  },
  upgradesToggleText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
    userSelect: "none",
  },
  // Drawer backdrop: dims the rest of the canvas; a tap closes the
  // drawer (sibling-of-drawer, both inside the canvas wrapper).
  upgradesBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    zIndex: 4,
  },
  upgradesDrawer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    // Wide enough for the purchase-button rows, capped so it never
    // covers the whole canvas on a phone.
    width: 280,
    maxWidth: "82%",
    backgroundColor: "#303030",
    borderLeftWidth: 1,
    borderLeftColor: "#555",
    zIndex: 5,
    gap: 6,
    padding: 8,
  },
  upgradesDrawerClose: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: "#3a3a3a",
  },
  upgradesDrawerCloseText: {
    color: "#ccc",
    fontSize: 14,
    userSelect: "none",
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
  // First-time setup step (the last onboarding step): whole-row toggle
  // rows inside the centered card. The row is the Pressable (and the e2e
  // anchor); the Switch rides at the right edge and swallows its own
  // taps, so label-taps and switch-taps each produce exactly one toggle.
  setupRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    // 44px-tall touch target for the whole row.
    minHeight: 44,
    justifyContent: "space-between",
  },
  setupRowLabel: {
    ...onboardingText,
    fontSize: 13,
    flex: 1,
  },
  setupRowGlyph: {
    ...onboardingText,
    fontSize: 14,
    fontWeight: "bold",
    width: 18,
    textAlign: "center",
  },
  // Symbol-display chips (the two literal previews, "7 * 2 · 7 / 2" /
  // "7 x 2 · 7 ÷ 2") — same look as the settings panel's toggle.
  setupChip: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#2a2a2a",
  },
  setupChipActive: {
    backgroundColor: "#555",
  },
  setupChipText: {
    ...onboardingText,
    fontSize: 11,
  },
  // Cosmetic shop grid (todo: "implement cosmetic shop with grid view cards
  // and larger previews"): one card per pack, wrapping 3 across on phone-to-
  // tablet widths. Previews are 2–3× the old list thumbs; the card is a
  // semi-transparent chip so the cave behind a scrollable sheet stays dimmed
  // and separated (todo: "improve visibility of ui with semi-transparent
  // boxes … where buttons/text are").
  shopCard: {
    flexBasis: "30%",
    flexGrow: 1,
    minWidth: 96,
    backgroundColor: "rgba(20, 20, 20, 0.55)",
    borderWidth: 1,
    borderColor: "rgba(140, 140, 140, 0.35)",
    borderRadius: 10,
    padding: 6,
    gap: 4,
    alignItems: "center",
    alignSelf: "flex-start",
  },
  shopCardPreview: {
    height: 62,
    width: "100%",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  // Outfit bodies are ~square; pickaxes are slim — 48px vs 44px reads
  // similarly on the card.
  shopOutfitPreview: {
    width: 50,
    height: 50,
  },
  shopPickaxePreview: {
    width: 44,
    height: 44,
  },
  shopCardTitle: {
    color: "#fff",
    fontSize: 11,
    textAlign: "center",
    minHeight: 28,
    userSelect: "none",
  },
});
