import { Slot } from "expo-router";
import { StyleSheet, View, Text } from "react-native";

export default function AppLayout() {
  return (
    <>
      <View
        style={{
          backgroundColor: "black",
          width: "100%",
          alignItems: "center",
        }}
      >
        <Text style={{ ...styles.text, fontSize: 20 }}>
          🤳Idle Click🖱️Mines⛏️of Doom😃
        </Text>
      </View>
      <Slot />
    </>
  );
}

const styles = StyleSheet.create({
  text: {
    color: "#fff",
  },
});
