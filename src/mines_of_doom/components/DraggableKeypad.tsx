/**
 * A DRAGGABLE on-screen numpad (2026-10-04, drag rewritten 2026-10-05).
 *
 * The plain `NumericKeypad` renders wherever its parent puts it, which is
 * fine in portrait (it lives in the column flow under the cave) but wrong
 * once the player rotates: the landscape layout has the cave centre-screen,
 * so a numpad parked in one corner is both far from the answer box and
 * fightable with a second one. This wrapper makes it a free-floating,
 * draggable panel with a remembered position.
 *
 * Design notes:
 *  - **PanResponder, not a gesture library.** The drag needs nothing but
 *    move events, and PanResponder ships with RN — no new dependency and no
 *    gesture-root/provider wiring (the app has no GestureHandlerRootView).
 *  - **The drag runs on the UI thread.** Each move writes straight into two
 *    `Animated.Value`s that drive a `translateX/translateY` transform — no
 *    React re-render per touch event. The 2026-10-05 bug this fixes: the
 *    original wrote `left`/`top` through `useState` on every move, so each
 *    touch event went JS → prop diff → native layout pass, and on Android
 *    the layout pass could not keep up with the touch rate — the panel
 *    visibly lagged the finger (jitter) and, when the events outpaced the
 *    renders, the last committed position lost to a stale one (the panel
 *    appearing stuck a few pixels short of where the finger let go).
 *    `setState` in a 60–120 Hz touch callback is the classic RN jank
 *    pattern; the transform is the standard cure.
 *  - **The position is stored as a fraction of the viewport, not pixels.**
 *    A pixel offset captured on a 915×412 landscape phone would land in a
 *    corner (or off-screen entirely) on a tablet, on a foldable, or after
 *    a rotation. Fractions survive all of that, which is the whole point of
 *    remembering it.
 *  - **Clamped on read**, so a position saved on a big screen can never
 *    strand the panel off the edge of a small one.
 *  - Persistence is device-local (`useLocalStorage`), never in the save
 *    blob: a shared/imported save must not carry someone's screen layout.
 */
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  PanResponder,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type PanResponderGestureState,
} from "react-native";
import { useLocalStorage } from "src/hooks/useLocalStorage";
import NumericKeypad from "src/components/NumericKeypad";

export type DraggableKeypadProps = {
  onDigit: (d: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  onSubmit: () => void;
  /** Storage key — one per keypad so their positions are independent. */
  storageKey: string;
  /**
   * Starting corner, used only until the player has moved it (and whenever
   * there is no stored position). `startAsFraction` is a fraction of the
   * viewport so it lands relative, not at a fixed pixel offset.
   */
  defaultX: number;
  defaultY: number;
  /** Opacity of the drag handle affordance, or 0 to hide it. */
  handleOpacity?: number;
  /**
   * Size of the CONTAINING BLOCK, not the viewport.
   *
   * The panel is `position: absolute`, so `left`/`top` are measured from
   * its offset parent — which here is the landscape stage, NOT the window
   * (the header row sits above it). Clamping against the viewport instead
   * let the numpad hang off the bottom of the stage by exactly the header's
   * height. Callers pass the stage's measured size; omitting them falls
   * back to the viewport, which is only correct when the panel's parent
   * really does fill the screen.
   */
  boundsWidth?: number;
  boundsHeight?: number;
};

/** NumericKeypad's own `maxWidth` — the panel needs it as its width. */
const KEYPAD_WIDTH = 320;

/** A stored position plus the panel's size at the time it was dropped. */
type StoredPosition = { x: number; y: number } | null;

const DraggableKeypad = memo(function DraggableKeypad({
  onDigit,
  onBackspace,
  onClear,
  onSubmit,
  storageKey,
  defaultX,
  defaultY,
  handleOpacity = 0.55,
  boundsWidth,
  boundsHeight,
}: DraggableKeypadProps) {
  const { width: winW, height: winH } = useWindowDimensions();
  // The containing block wins when the caller measured it.
  const vw = boundsWidth ?? winW;
  const vh = boundsHeight ?? winH;
  const [stored, setStored] = useLocalStorage<StoredPosition>(
    storageKey,
    null,
  );
  const [size, setSize] = useState({ w: 0, h: 0 });

  // Live position, in pixels, in a REF: it mutates at touch rate while
  // dragging and must not trigger React renders (that was the jitter).
  // The truth is mirrored into two Animated.Values so the native UI
  // thread can move the panel between renders.
  const posRef = useRef({ x: defaultX, y: defaultY });
  const animX = useRef(new Animated.Value(defaultX)).current;
  const animY = useRef(new Animated.Value(defaultY)).current;

  /** Move the panel: ref (logic) + Animated.Values (render) together, so
   *  the two never drift apart. */
  const moveTo = useCallback(
    (x: number, y: number) => {
      posRef.current = { x, y };
      animX.setValue(x);
      animY.setValue(y);
    },
    [animX, animY],
  );

  /** Keep the panel fully on screen: the origin is the panel's top-left, so
   *  clamp against its measured size (falls back to 0 before first layout,
   *  which is harmless — it can only ever pull it back onto the screen). */
  const clamp = useCallback(
    (x: number, y: number) => ({
      x: Math.min(Math.max(x, 0), Math.max(0, vw - size.w)),
      y: Math.min(Math.max(y, 0), Math.max(0, vh - size.h)),
    }),
    [vw, vh, size.w, size.h],
  );

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
    },
    [],
  );

  // Re-clamp whenever the measured size or the viewport changes (rotation,
  // keyboard, a first layout after the size settles).
  //
  // This CANNOT live in onLayout: `clamp` is memoized on `size`, so on the
  // first layout it still closes over {0,0} and cannot clamp at all, and
  // onLayout does not fire again once the size settles (the layout did not
  // change). The panel then stays wherever it was seeded — which is how the
  // numpad ended up hanging off the bottom of a 412px-tall screen.
  useEffect(() => {
    const next = clamp(posRef.current.x, posRef.current.y);
    if (next.x === posRef.current.x && next.y === posRef.current.y) return;
    moveTo(next.x, next.y);
  }, [clamp, size.w, size.h, moveTo]);

  // Where the drag started, in panel coordinates (set on grant, read on
  // every move). A ref, not state: it must not re-render.
  const originRef = useRef({ x: 0, y: 0 });

  const responder = useMemo(
    () =>
      PanResponder.create({
        // Claim the gesture before a tap can turn into a key press.
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_e, g) =>
          Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2,
        // While dragging, never let the child keys take the touch.
        onPanResponderTerminationRequest: () => false,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderGrant: () => {
          originRef.current = { ...posRef.current };
        },
        onPanResponderMove: (_e, g: PanResponderGestureState) => {
          // Write straight into the Animated.Values: no state, no render,
          // no bridge round-trip — the UI thread applies the transform at
          // the display's own refresh rate.
          const next = clamp(
            originRef.current.x + g.dx,
            originRef.current.y + g.dy,
          );
          moveTo(next.x, next.y);
        },
        onPanResponderRelease: () => {
          // Remember as a FRACTION of the viewport so the same drop lands
          // in the same relative spot on a tablet or after a rotation.
          const { x, y } = posRef.current;
          setStored({
            x: vw > 0 ? x / vw : 0,
            y: vh > 0 ? y / vh : 0,
          });
        },
      }),
    [clamp, moveTo, setStored, vw, vh],
  );

  // Adopt a stored position ONCE, when it arrives.
  //
  // useLocalStorage resolves asynchronously, so on the very first render
  // `stored` is still the initial value (null) and the component must fall
  // back to the default corner — which is correct for a fresh install but
  // wrong for a returning one. Seeding a ref on first render therefore
  // silently threw the saved position away every launch: the panel snapped
  // back to its default, which is exactly the "remembers where I left it"
  // promise failing. Watching for the load instead fixes it.
  const adoptedRef = useRef(false);
  useEffect(() => {
    if (adoptedRef.current || stored == null) return;
    adoptedRef.current = true;
    const next = clamp(stored.x * vw, stored.y * vh);
    moveTo(next.x, next.y);
  }, [stored, vw, vh, clamp, moveTo]);

  return (
    <View
      // NO responder handlers here on purpose.
      //
      // The wrapper used to carry `{...responder.panHandlers}` with
      // `onStartShouldSetPanResponder: () => true`. On WEB that happens to
      // work (react-native-web's responder negotiation lets the child
      // Pressable's click through anyway), which is exactly why the local
      // web harness could not catch it — but on NATIVE the parent claims the
      // touch on start and the keys never fire at all. Same code, two
      // platforms, opposite results.
      //
      // So the drag lives on the HANDLE strip only (below): a press that
      // starts there is a drag, and a press that starts on a key is a key.
      // Nothing can intercept the keys on either platform.
      // An explicit WIDTH is load-bearing, not cosmetic. This root is
      // `position: absolute` with only left/top set, so it shrink-wraps to
      // its content — and the numpad's four columns are `flex: 1`, which has
      // no basis to share when the parent has no width. react-native-web
      // resolved that (the keypad drew fine on the web build); Android
      // collapsed every column to 0, so on a real phone the panel rendered
      // as just the drag handle with no keys under it. 320 matches
      // NumericKeypad's own `maxWidth`, so the keys get their natural size.
      //
      // The panel sits at left:0/top:0 and the Animated.View's transform
      // carries the position (see the module note on why the drag must not
      // go through React state).
      //
      // ZERO-SIZED, on purpose. The panel's position lives in the
      // Animated.View's transform (below), so this root's LAYOUT footprint
      // sits at (0,0) while the visible panel lives elsewhere — and in
      // landscape (0,0) is exactly where the equation plate is. Any area on
      // this root would swallow taps on the plate: the answer field stopped
      // being clickable and the web harness's keypad step timed out on its
      // very first click. `box-none` did NOT fix it — react-native-web
      // passes the value straight to CSS, where it is not a legal
      // pointer-events value, so the browser silently kept `auto`.
      // A 0×0 root has no hit area at all; the transformed child below
      // keeps its own (the KEYPAD_WIDTH basis the flex columns need lives
      // THERE, which is also why the width cannot stay on this root).
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: 0,
        height: 0,
        overflow: "visible",
        zIndex: 6,
      }}
      testID={`draggable-keypad-${storageKey}`}
    >
      {/* onLayout lives HERE, not on the 0×0 root: the clamp measures the
          panel's real size, and the root no longer has one. */}
      <Animated.View
        onLayout={onLayout}
        style={{
          width: KEYPAD_WIDTH,
          transform: [{ translateX: animX }, { translateY: animY }],
        }}
      >
        <View
          {...responder.panHandlers}
          style={{
            height: 14,
            marginBottom: 2,
            borderRadius: 7,
            backgroundColor: "#2a2a2a",
            opacity: handleOpacity,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View
            style={{
              width: 34,
              height: 3,
              borderRadius: 2,
              backgroundColor: "#8a8a8a",
            }}
          />
        </View>
        <NumericKeypad
          onDigit={onDigit}
          onBackspace={onBackspace}
          onClear={onClear}
          onSubmit={onSubmit}
        />
      </Animated.View>
    </View>
  );
});

export default DraggableKeypad;
