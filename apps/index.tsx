import MinesOfDoom from "apps/mines_of_doom/MinesOfDoom";
import ErrorBoundary from "apps/mines_of_doom/components/ErrorBoundary";
import { Stack } from "expo-router";

export default function Index() {
  return (
    <>
      <Stack.Screen options={{ title: "🤳Idle Click🖱️Mines⛏️of Doom😃" }} />
      {/* Crash screen + persisted log: release builds have no red box,
          so without this a render crash on Android was a silent white
          screen (see the "Adjust" item in docs/todo.md). */}
      <ErrorBoundary>
        <MinesOfDoom />
      </ErrorBoundary>
    </>
  );
}
