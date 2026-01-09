import { Stack } from "expo-router";
import { View, Text } from "react-native";

export default function Index() {
  return (
    <>
      <Stack.Screen />
      <View style={{ backgroundColor: "grey", flex: 1 }}>
        <Text style={{ color: "white", alignSelf: "center" }}>Home</Text>
      </View>
    </>
  );
}
