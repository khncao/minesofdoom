/**
 * A DRAGGABLE on-screen numpad (2026-10-04).
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
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
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

  // Stored positions are FRACTIONS of the viewport; the live position is in
  // pixels. Seed from the stored fraction on first render (viewport units
  // are known at that point), then the drag handler owns the value — it
  // changes every frame, so it lives in a ref and is mirrored into state
  // only to re-lay-out the View. Re-deriving from `stored` on every render
  // would fight the drag.
  const initialPos = useRef<{ x: number; y: number } | null>(null);
  if (initialPos.current === null) {
    initialPos.current =
      stored == null
        ? { x: defaultX, y: defaultY }
        : { x: stored.x * vw, y: stored.y * vh };
  }
  const posRef = useRef({ ...initialPos.current });
  const originRef = useRef({ x: 0, y: 0 });
  const [pos, setPos] = useState(posRef.current);

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

  // Re-clamp whenever the measured size or the viewport changes.
  //
  // This CANNOT live in onLayout: `clamp` is memoized on `size`, so on the
  // first layout it still closes over {0,0} and cannot clamp at all, and
  // onLayout does not fire again once the size settles (the layout did not
  // change). The panel then stays wherever it was seeded — which is how the
  // numpad ended up hanging off the bottom of a 412px-tall screen.
  useEffect(() => {
    const next = clamp(posRef.current.x, posRef.current.y);
    if (next.x === posRef.current.x && next.y === posRef.current.y) return;
    posRef.current = next;
    setPos(next);
  }, [clamp, size.w, size.h]);

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
          const next = clamp(
            originRef.current.x + g.dx,
            originRef.current.y + g.dy,
          );
          posRef.current = next;
          setPos(next);
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
    [clamp, setStored, vw, vh],
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
    posRef.current = next;
    setPos(next);
  }, [stored, vw, vh, clamp]);

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
      style={{
        position: "absolute",
        left: pos.x,
        top: pos.y,
        width: KEYPAD_WIDTH,
        zIndex: 6,
      }}
      onLayout={onLayout}
      testID={`draggable-keypad-${storageKey}`}
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
    </View>
  );
});

export default DraggableKeypad;
