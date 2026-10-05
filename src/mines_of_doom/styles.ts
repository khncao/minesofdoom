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
  // ---- Landscape / short-viewport layout (2026-10-04) ------------------
  // Play requires the app to stop locking orientation (docs/todo.md), which
  // exposed that the whole game was ONE vertical flex column: header,
  // banner, equation, answer, combo, then the play area (cave + keypad).
  // On a rotated phone (~412px tall) that stack overflows — the keypad's
  // lower rows fall below the fold and the upgrades drawer, which is
  // absolutely positioned inside the play area, is dragged down with it.
  //
  // Landscape is therefore NOT a narrower version of portrait: the cave
  // goes full-bleed and slightly zoomed out, and the depth/equation/answer
  // stack floats CENTRED on top of it, with the numpad(s) floating
  // alongside. Portrait keeps the original column flow untouched.
  //
  // The short-viewport row becomes a plain container (a containing block
  // for the absolutely positioned children) rather than a flex row, so the
  // same three children can be "in the flow" in portrait and "overlaid" in
  // landscape without duplicating the tree.
  hudRow: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    gap: 3,
  },
  hudRowShort: {
    // Not a flex row: the children position themselves absolutely, so this
    // is purely the containing block. `flex: 1` keeps it filling the column
    // the header sits in, and the stretch alignment gives the absolute
    // children the full width to position against.
    alignSelf: "stretch",
    alignItems: "stretch",
    justifyContent: "flex-start",
    gap: 0,
    position: "relative",
  },
  // The equation / answer / combo stack. In portrait this is just the
  // column's own rhythm; in landscape it becomes a floating panel centred
  // on the screen, over the cave.
  hudStack: {
    width: "100%",
    alignItems: "center",
    gap: 3,
  },
  hudStackShort: {
    // Floats over the UPPER part of the cave (todo: "Show equations on top
    // left when in landscape mode"). The `zIndex: 4` lives on
    // `hudTopStackShort` now (the strip that carries this), because zIndex
    // only orders siblings — and the thing that has to beat the full-bleed
    // canvas is the strip, not this row inside it.
    //
    // `pointerEvents: box-none` is on the element in the component so taps
    // still reach the cave around the panel.
    // The box spans the full stage width and centres its children with
    // alignItems. Adding a maxWidth here would NOT cap the content — for an
    // absolutely-positioned element `left:0; right:0` sizes the box from the
    // LEFT edge, so the whole HUD ended up anchored in the left third
    // instead of centred (alignSelf does not reliably centre an absolute
    // box). The panels inside size themselves, so the row stays tight.
    gap: 6,
    // TOP-LEFT corner (todo: "Show equations on top left when in landscape
    // mode").
    //
    // This is NOT absolutely positioned any more: the depth bar, the wallet
    // and this stack are all children of `hudTopStackShort`, one absolute
    // strip pinned to the top of the stage. Two separately-positioned
    // siblings on the same edge meant the stack had to be told how far down
    // to start (a measured height, or a guessed constant), and it could
    // land on the depth bar — on the first frame especially, before any
    // measurement had come back. In a column that cannot happen at any
    // height.
    //
    // LEFT-aligned rather than centred: the left menu rail and the depth bar
    // own the top strip, so the question hangs off the same left edge.
    alignItems: "flex-start",
    marginTop: 0,
  },
  // Two-keypad landscape: the numpads own the bottom-LEFT and bottom-right
  // corners, but the question now lives in the top-left band (todo: "Show
  // equations on top left when in landscape mode") where neither keypad can
  // reach — so both keypad counts share the ONE top-left layout and the
  // re-centring variant is gone with it.
  // Landscape: the menu becomes a vertical rail on the LEFT edge instead of
  // a full-width band across the top. A rotated phone has ~410dp of height
  // and ~910 of width, so a horizontal header row spends the scarce axis to
  // save nothing; a column spends ~56dp of the plentiful one. It is
  // absolutely positioned so it floats over the cave, and the depth banner
  // and the question inset themselves past it (hudTopStackShort's
  // paddingLeft).
  headerRowShort: {
    position: "absolute",
    left: 6,
    top: 6,
    bottom: 6,
    flexDirection: "column",
    flexWrap: "nowrap",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "auto",
    backgroundColor: "rgba(0, 0, 0, 0.32)",
    borderRadius: 14,
    marginHorizontal: 0,
    padding: 4,
    gap: 4,
    zIndex: 5,
  },
  // ---- The top strip: depth bar, wallet, question ------------------
  // Portrait: a plain column, so these three rows are just the next things
  // in the flow (which is what they were before the landscape split).
  hudTopStack: {
    width: "100%",
    gap: 3,
  },
  // Landscape: ONE absolute strip pinned to the top of the stage, holding
  // the depth bar, the wallet and the equation/answer/combo stack in a
  // normal column. They used to be three separately absolutely-positioned
  // siblings on the same edge, which is why the question needed a MEASURED
  // offset to clear the depth bar — and could still land on it on the
  // first frame, before any measurement came back. As one column the
  // overlap is structurally impossible at any bar height.
  //
  // zIndex 4 beats the full-bleed canvas, which is a later sibling of the
  // hudRow in the tree and would otherwise paint over the whole strip (and
  // swallow the taps — the answer input simply stopped being clickable).
  // paddingLeft clears the left menu rail (see headerRowShort).
  hudTopStackShort: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    paddingLeft: 68,
    zIndex: 4,
    gap: 6,
  },
  // The strip's body below the bar: wallet + equation stack. Portrait:
  // a plain column (exactly as before). Landscape: a ROW — the equation
  // sits DIRECTLY under the bar (left) and the wallet keeps its
  // right-aligned corner, so the question no longer waits a wallet-height
  // below the bar (todo: "in landscape have the equation just below depth
  // bar").
  hudBody: {
    gap: 3,
  },
  // row-reverse, not a reordered row: React Native has no flexbox
  // `order`. The wallet renders FIRST in the tree (portrait wants it on
  // top); in a row-reverse the first child lands at the RIGHT end — wallet
  // in its top-right corner, equation on the left, exactly what was asked.
  hudBodyRow: {
    flexDirection: "row-reverse",
    // row-reverse packs from the RIGHT end: the first child (wallet)
    // sits in the right corner and the second (equation stack) would end
    // up beside it. space-between pins them to opposite edges — wallet in
    // its top-right corner, the plate flush under the bar's LEFT edge
    // (todo: "Show equations on top left when in landscape mode").
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  // In the landscape row the stack must size to its content (not span the
  // stage and shove the wallet off) and left-align — the plate then sits
  // flush under the bar's left edge.
  hudStackRow: {
    width: "auto",
    alignItems: "flex-start",
  },
  // In the landscape ROW the cross axis is vertical, so the wallet's own
  // alignSelf: flex-end (portrait: hug the right edge) would bottom it out
  // under the plate. The wrapper cancels that in landscape only — both
  // boxes then share the row's top edge (todo: "have equation box and
  // resources box aligned").
  walletRowAlign: {
    alignSelf: "flex-start",
  },
  // The depth/tier readout's own row. Plain in portrait (it is just the
  // next thing in the column flow); in landscape it is pinned to the TOP of
  // the stage so it stays put while the question/answer stack sits at the
  // bottom — scenery above, the thing you interact with below.
  depthRow: {
    width: "100%",
  },
  // The column cap is tuned for a portrait phone; a rotated one is ~900px
  // wide, and capping the whole game at 640 would waste the space that the
  // overlay layout exists to use.
  contentColumnShort: {
    maxWidth: 1000,
  },
  // Landscape: the cave fills the whole stage and is scaled down slightly
  // so the crew column reads as part of a scene rather than filling the
  // frame (the HUD floats over it).
  landscapeCanvas: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    transform: [{ scale: 0.86 }],
  },
  // The cave in landscape is the middle column of hudRow: full height, and
  // it must be allowed to shrink (flexShrink) because the two side columns
  // have min widths that win the space fight on a narrow landscape phone.
  playAreaShort: {
    minWidth: 0,
    flex: 1,
    margin: 4,
  },  // The numpad column. Sized off the viewport rather than hard-coded so the
  // 4 rows plus the gaps fit the ~412px of height a rotated phone has.
  keypadShort: {
    alignSelf: "center",
    maxHeight: "100%",
  },
  // The keypad's own container. It has `alignSelf: "stretch"` and no
  // intrinsic width (its columns are `flex: 1`), which only worked while it
  // sat in a COLUMN (play area) — stretched to the parent's width. As a
  // child of the landscape ROW it collapsed and the right-hand keys were
  // clipped off the screen edge, so landscape gives it a real width.
  keypadColumn: {
    width: "100%",
    alignSelf: "stretch",
  },
  keypadColumnShort: {
    // Sized to the keys themselves (4 × 56px + gaps + margins); the cap
    // keeps a 7" tablet's landscape from stretching comically wide keys.
    width: 300,
    maxWidth: "36%",
    alignSelf: "stretch",
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
  // Upgrades panel header (todo: upgrades menu as a side hidden overlay
  // on the canvas): the close button row. The panel covers the play area
  // edge to edge and centres its column (see upgradesDrawer /
  // upgradesPanel), so it never sits where the OS keyboard covers the
  // bottom of the screen.
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
    // Semi-transparent fill (todo: "improve visibility of ui … where
    // buttons/text are"): the answer box sits over the cave art, so a
    // dark translucent fill + rounding keeps the input readable on every
    // cave theme. Bumped 0.45 -> 0.62 with the equation plate (2026-10-04):
    // in landscape the box sits low, over busier rock and debris, and the
    // typed digits were the hardest thing on screen to read.
    backgroundColor: "rgba(10, 10, 10, 0.62)",
    borderRadius: 6,
    borderWidth: 1.5,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    // A little more room: the digits are the biggest thing the player
    // reads and 35% more padding costs nothing on a phone.
    paddingVertical: 6,
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
    gap: 8,
    paddingTop: 6,
    paddingHorizontal: 12,
    alignSelf: "stretch",
    justifyContent: "space-between",
    alignItems: "center",
    // Translucent bar (todo: "improve visibility of ui … where
    // buttons/text are"): the depth/rate readout sits over the cave, so
    // it gets a dark box behind it.
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    borderRadius: 8,
    marginHorizontal: 8,
    paddingBottom: 4,
  },
  // The wallet line (todo: "move resource counts mineral and gems to top
  // right, right aligned under upgrades but outside of the bar").
  //
  // A VERTICAL COLUMN of items, right-aligned: minerals on one line, gems
  // on the next. Side by side they read as one long figure that competes
  // with the depth bar right above them; stacked, they are a single column
  // of figures hanging under the upgrades button, and each line stays short
  // enough to not need wrapping.
  //
  // `alignSelf: flex-end` is what puts it in the corner — in portrait the
  // strip is a 100%-wide column, in landscape an absolute box inset by the
  // left menu rail, and in both cases this is the last thing to line up
  // with the bar's right edge.
  //
  // It carries the same translucent backing as the depth bar for the same
  // reason: these two figures sit over the cave art and have to be readable
  // on every theme. Boxed tight (not full width) so the background reads as
  // part of the readout rather than a second bar.
  depthWallet: {
    flexDirection: "column",
    alignItems: "flex-end",
    alignSelf: "flex-end",
    gap: 3,
    // The two most-read numbers in the game — the box has to read at a
    // glance, so it carries a stronger backing than the bar, a hairline
    // warm border to separate it from the cave art, and more air inside.
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    borderWidth: 1,
    borderColor: "rgba(255, 240, 210, 0.22)",
    borderRadius: 10,
    // Extra right padding + a right margin: in landscape the row pins this
    // box to the screen's right edge, and a number flush against the edge
    // reads as clipped (todo: "add right padding to the box").
    paddingLeft: 12,
    paddingRight: 16,
    paddingVertical: 6,
    marginRight: 8,
  },
  depthWalletRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  depthIcon: {
    width: 16,
    height: 16,
  },
  depthIconGlyph: {
    fontSize: 15,
    userSelect: "none",
  },
  // The "+N/s" rate, dimmer than the totals it qualifies so the eye lands
  // on the amounts first.
  depthRateText: {
    color: "#a89a88",
    fontSize: 12,
    userSelect: "none",
  },
  // The wallet's own amount text — brighter and heavier than the bar's
  // muted tier-name text (depthText), because these numbers are the ones
  // the player is actually reading (todo: "improve resource (mineral, gem)
  // visibility").
  walletText: {
    color: "#f2e8d5",
    fontSize: 13,
    fontWeight: "700",
    userSelect: "none",
  },
  depthText: {
    // Shrinkable + wrapping: the tier name is the only unbounded-length
    // text in the bar (the Spanish names are the longest), so this side is
    // the one that wraps instead of overflowing the row.
    flexShrink: 1,
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
  // The ⛏ UPGRADES button, the depth bar's far-right cell (todo: "Move
  // upgrades to same bar as depth (far right)"). Sized for a 12px bar
  // rather than the 36px floating pill it replaces: same radius, same
  // affordance-dot treatment, less vertical and horizontal padding so the
  // bar still fits a 360px phone beside depth + wallet.
  depthUpgradesToggle: {
    backgroundColor: "#3a3a3a",
    opacity: 0.9,
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 8,
    flexShrink: 0,
  },
  depthUpgradesTogglePressed: {
    backgroundColor: "#2c2c2c",
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
  // Drawer backdrop: dims the rest of the stage; a tap closes the drawer.
  //
  // z 8 / z 9, not the z 4 / z 5 this pair used to carry from inside the
  // play area: the modal now overlays the WHOLE stage, so it has to clear
  // the equation/answer stack (z 4) AND the floating numpads (z 6). Only
  // the onboarding overlay (z 100) is meant to sit above it.
  upgradesBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    zIndex: 8,
  },
  // Upgrades panel (todo: "have upgrade modal take up whole screen and be
  // centered"). It used to be a 280px drawer hard against the play area's
  // right edge, which made the purchase list the one surface in the game
  // that neither used the screen's shape nor its centre: the rows were
  // squeezed into a phone-width column with a dead margin on a tablet, and
  // on a 360px phone the sheet's own left edge sat under the edge of the
  // numpad strip that shares the play area.
  //
  // Now it covers the play area edge to edge (the same full-bleed shape
  // MenuPanel's fullscreen BottomModal uses) and CENTRES its content: the
  // outer box is the panel, the inner one is width-capped so a purchase row
  // keeps a readable measure instead of stretching the full width of a
  // tablet. The backdrop (z 4) still shows through the letterbox either
  // side of the centred column, and a tap there still closes the panel.
  upgradesDrawer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#262626",
    zIndex: 9,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  },
  // The centred column inside the full-screen panel.
  upgradesPanel: {
    width: "100%",
    maxWidth: 520,
    // Never taller than the panel itself — the ScrollView below takes the
    // remainder, so a long purchase list scrolls instead of being clipped.
    maxHeight: "100%",
    gap: 6,
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
  // First-run tutorial (plan §2.1): NON-BLOCKING bottom tooltip. The root is
  // a transparent full-screen layer (the component sets pointerEvents
  // "box-none") so taps anywhere outside the card hit the live game; the
  // card docks to the bottom edge (above the safe area, via an inline
  // `bottom` on the card) and only the card itself is interactive.
  onboardingRoot: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  onboardingCard: {
    position: "absolute",
    left: 12,
    right: 12,
    // bottom: set inline (safe-area inset + 8).
    backgroundColor: "rgba(42, 42, 42, 0.96)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#555",
    alignItems: "stretch",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  onboardingHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  onboardingIcon: {
    fontSize: 20,
    userSelect: "none",
  },
  onboardingTitle: {
    ...onboardingText,
    fontSize: 15,
    fontWeight: "bold",
    flex: 1,
  },
  onboardingBody: {
    ...onboardingText,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "left",
    opacity: 0.9,
  },
  onboardingFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
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
    // 44px-tall target: 13px text + 15px vertical pad.
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  onboardingSkipText: {
    ...onboardingText,
    fontSize: 13,
    opacity: 0.7,
  },
  onboardingNext: {
    backgroundColor: "#ffaa44",
    borderRadius: 8,
    // 40px-tall target: 14px text + 13px vertical padding either side.
    paddingVertical: 13,
    paddingHorizontal: 18,
  },
  onboardingNextText: {
    color: "#1f1f1f",
    fontSize: 14,
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
