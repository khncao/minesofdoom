import MinesOfDoom from "apps/mines_of_doom/MinesOfDoom";
import { Stack } from "expo-router";

export default function Index() {
  return (
    <>
      <Stack.Screen options={{ title: "🤳Idle Click🖱️Mines⛏️of Doom😃" }} />
      <MinesOfDoom />
    </>
  );
}
