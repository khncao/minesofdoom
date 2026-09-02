declare module "expo-router/build/fork/native-stack/createNativeStackNavigator" {
  export function createNativeStackNavigator(): {
    Navigator: React.ComponentType<
      React.PropsWithChildren<Record<string, unknown>>
    >;
    Screen: React.ComponentType<
      React.PropsWithChildren<Record<string, unknown>>
    >;
  };
}
