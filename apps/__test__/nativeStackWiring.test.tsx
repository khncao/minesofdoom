/**
 * Regression net for the unreproducible Android crash:
 *
 *   ReferenceError: Property 'describe' doesn't exist, js engine: hermes
 *
 * Static analysis (docs/todo.md, "Adjust") points at the expo-router /
 * native-stack interaction: expo-router's root stack is a forked navigator
 * (`expo-router/build/fork/native-stack/createNativeStackNavigator`) that
 * destructures `describe` from `useNavigationBuilder` and passes it — together
 * with `state` / `descriptors` — to `@react-navigation/native-stack`'s
 * `NativeStackView`, which dereferences `describe(route, true)` for preloaded
 * routes. If any of that wiring ever loses the `describe` prop (dependency
 * bump, fork change), Android crashes with exactly the error above.
 *
 * This test renders that exact wiring in Jest. Two things make it a real
 * reproduction attempt, not just a smoke test:
 *
 *  1. The RN jest preset resolves Haste with `platforms: ['android', 'ios',
 *     'native']`, so — like the Android app — it picks
 *     `NativeStackView.native.js` (the native code path), not the plain
 *     `NativeStackView.js` fallback that web builds use (and where the crash
 *     never appeared).
 *  2. The navigator under test is the SAME module expo-router's `<Stack />`
 *     uses on native (see `expo-router/build/layouts/StackClient.js`), only
 *     without manifest-driven route resolution, which is unrelated to the
 *     `describe` wiring.
 *
 * Native screen components (`react-native-screens`) and the safe-area native
 * module don't exist in Jest, so both are mocked with plain pass-throughs; the
 * JS wiring under test is untouched by those mocks.
 */
import type * as React from "react";
import { Text, View } from "react-native";
import {
  NavigationContainer,
  StackRouter,
  useNavigationBuilder,
} from "@react-navigation/native";
import { render } from "@testing-library/react-native";
import {
  createNativeStackNavigator,
} from "expo-router/build/fork/native-stack/createNativeStackNavigator";
import { NativeStackView } from "@react-navigation/native-stack";

type MockProps = { children?: React.ReactNode; [key: string]: unknown };

jest.mock("react-native-screens", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const R = require("react");
  const passthrough = R.forwardRef(
    (props: MockProps, ref: React.ForwardedRef<object>) =>
      R.createElement(R.Fragment, { ref }, props.children),
  );
  return {
    compatibilityFlags: { nativeBackDismissal: true },
    // Screen containers: children pass through so the scenes stay visible.
    ScreenStack: passthrough,
    ScreenStackItem: passthrough,
    ScreenContainer: passthrough,
    ScreenContentContainer: passthrough,
    ScreenContentWrapper: passthrough,
    ScreenFooter: passthrough,
    ScreenStackHeaderBackButtonImage: passthrough,
    ScreenStackHeaderCenterView: passthrough,
    ScreenStackHeaderLeftView: passthrough,
    ScreenStackHeaderRightView: passthrough,
    ScreenStackHeaderSearchBarView: passthrough,
    SearchBar: passthrough,
    enableScreens: () => {},
    disableScreens: () => {},
    isSearchBarAvailableForCurrentPlatform: () => false,
  };
});

jest.mock("react-native-safe-area-context", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const R = require("react");
  const insets = { top: 0, left: 0, right: 0, bottom: 0 };
  return {
    initialWindowMetrics: null,
    // Providing a default value also makes NativeStackView take its
    // "already have insets" branch (plain View instead of the native
    // SafeAreaProvider).
    SafeAreaInsetsContext: R.createContext(insets),
    SafeAreaProvider: (props: MockProps) =>
      R.createElement(R.Fragment, null, props.children),
    useSafeAreaInsets: () => insets,
  };
});

const { Navigator, Screen } = createNativeStackNavigator();

function CaveScreen() {
  return (
    <View testID="cave">
      <Text>mine</Text>
    </View>
  );
}

/**
 * Renders exactly what the forked navigator does (minus the NativeStackView)
 * and records what `useNavigationBuilder` handed back. If a future
 * @react-navigation version drops `describe` from the builder output — the
 * suspected cause of the hermes crash — this fails with a readable assertion
 * instead of an opaque on-device ReferenceError.
 */
let observedDescribe: unknown = "never-observed";
function ProbeScreen() {
  return <View />;
}
function DescribeProbe() {
  const result = useNavigationBuilder(StackRouter, {
    initialRouteName: "index",
    children: (
      <Screen name="index" component={ProbeScreen} />
    ),
  }) as { describe?: unknown };
  observedDescribe = result.describe;
  return null;
}

describe("expo-router native-stack `describe` wiring (plan Adjust)", () => {
  it("exercises the .native.js (Android) NativeStackView, not the web fallback", () => {
    // Self-check: if jest ever resolves the package's NativeStackView export to
    // the non-native NativeStackView.js, the crash we're guarding against
    // (native code path only) is no longer being reproduced here. Loaded via
    // explicit file path because the package's exports map blocks deep
    // specifiers.
    const nativeViewModule =
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require("../../node_modules/@react-navigation/native-stack/lib/module/views/NativeStackView.native.js");
    expect(NativeStackView).toBe(nativeViewModule.NativeStackView);
  });

  it("renders a screen through the Android (.native.js) code path without a ReferenceError", () => {
    const view = render(
      <NavigationContainer>
        <Navigator initialRouteName="index">
          <Screen
            name="index"
            options={{ title: "Mines of Doom" }}
            component={CaveScreen}
          />
        </Navigator>
      </NavigationContainer>,
    );

    // If `describe` were missing from the builder output or the NativeStackView
    // props (the suspected cause of the hermes crash), this render throws
    // before the screen content exists.
    expect(view.getByTestId("cave")).toBeTruthy();
    view.unmount();
  });

  it("keeps `describe` in the navigation-builder output the navigator relies on", () => {
    observedDescribe = "never-observed";
    const view = render(
      <NavigationContainer>
        <DescribeProbe />
      </NavigationContainer>,
    );
    expect(typeof observedDescribe).toBe("function");
    view.unmount();
  });
});
