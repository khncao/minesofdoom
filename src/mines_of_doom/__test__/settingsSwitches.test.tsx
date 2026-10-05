/**
 * The Settings view's DISPLAY switches — the ones that apply the moment
 * they are flipped (AsyncStorage-backed preferences owned by MinesOfDoom)
 * rather than waiting for a Save tap.
 *
 * These live here because of a bug they cannot produce on their own. Every
 * view in MenuPanel is built inside a `useMemo` and handed to a `memo()`
 * child, so a prop the dep array forgets is FROZEN: the switch kept
 * rendering the value it was built with while the stored preference moved
 * on. That is exactly the report behind todo "second keypad toggle
 * setting doesn't work" — the flip persisted and the switch snapped
 * straight back, so the control read as dead.
 *
 * Two things make this a real regression test rather than a smoke test:
 *
 *  1. It mounts MenuPanel, not SettingsPanel. The missing dependency lives
 *     in MenuPanel's memo, and mounting the child alone passes even with
 *     the bug in place.
 *  2. Every callback is created ONCE and reused across the re-render, so
 *     the ONLY thing that changes is the boolean prop. With fresh jest.fn()
 *     per render the other deps change identity, the memo recomputes for
 *     the wrong reason, and the test goes green against the broken build.
 */
import { fireEvent, render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import MenuPanel from "../components/MenuPanel";
import { defaultSettingsData, type SaveData } from "../game";
import { defaultEquationSettings } from "src/utils/math/equations";

/**
 * MenuPanel renders only the ACTIVE view (the default is "settings"), so
 * the other views' props are never read — they exist to satisfy the type.
 * Cast once here rather than in every call.
 */
const unused = {} as unknown as SaveData;

const METRICS = {
  frame: { x: 0, y: 0, width: 360, height: 720 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

// One stable set of callbacks for the whole file: their identities must not
// move, or the memo recomputes for the wrong reason (see the header).
const onSecondKeypadChange = jest.fn();
const stableProps = {
  settingsData: defaultSettingsData,
  onChangeSettingsData: jest.fn(),
  equationSettings: defaultEquationSettings,
  onChangeEquationSettings: jest.fn(),
  showMessage: null,
  onSave: jest.fn(),
  onReset: jest.fn(),
  onEraseAllData: jest.fn(),
  onExportSaveCode: jest.fn(() => ""),
  onImportSaveCode: jest.fn(() => false),
  onReplayTutorial: jest.fn(),
  mute: false,
  onMuteChange: jest.fn(),
  onScreenKeypad: true,
  onKeypadChange: jest.fn(),
  onSecondKeypadChange,
  textScale: 1,
  onTextScaleChange: jest.fn(),
  hardModeUnlocked: true,
  stats: unused,
  session: null,
  analytics: unused as never,
  onClearAnalytics: jest.fn(),
  cloudSave: unused as never,
  account: undefined as never,
};

/**
 * BottomModal reads the safe-area insets for its sheet padding (values are
 * irrelevant here — a flat phone frame is enough) and keeps the sheet
 * UNMOUNTED until the toggle is pressed, so every test opens the menu
 * first: the same two taps the player makes.
 */
function menu(secondKeypad: boolean) {
  return (
    <SafeAreaProvider initialMetrics={METRICS}>
      <MenuPanel {...stableProps} secondKeypad={secondKeypad} />
    </SafeAreaProvider>
  );
}

function openMenu(): void {
  fireEvent.press(screen.getByTestId("menu-button"));
}

/** The Switch's own `value` prop — what the player actually sees. */
function switchValue(): boolean | undefined {
  return screen.getByTestId("second-keypad-toggle").props.value;
}

describe("second keypad setting", () => {
  beforeEach(() => onSecondKeypadChange.mockClear());

  test("a flip reaches the memoized Settings view", () => {
    const { rerender } = render(menu(false));
    openMenu();
    expect(switchValue()).toBe(false);

    rerender(menu(true));

    // The half that used to be missing: with `secondKeypad` out of
    // MenuPanel's useMemo dep array the memo bailed out and the switch kept
    // rendering `false` no matter what the caller passed, so it visibly
    // sprang back after every tap.
    expect(switchValue()).toBe(true);
  });

  test("tapping the row asks for the toggle", () => {
    // The row owns the action and the Switch is pointerEvents:"none", so
    // the switch must never fire its own onValueChange (that double-toggle
    // is why the row's handler is the only one wired up).
    render(menu(false));
    openMenu();
    fireEvent.press(screen.getByText("Second keypad: "));
    expect(onSecondKeypadChange).toHaveBeenCalledWith(true);
  });

  test("tapping again asks for it off", () => {
    render(menu(true));
    openMenu();
    fireEvent.press(screen.getByText("Second keypad: "));
    expect(onSecondKeypadChange).toHaveBeenCalledWith(false);
  });
});