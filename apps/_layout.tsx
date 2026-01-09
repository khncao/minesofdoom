import { Link, Stack } from "expo-router";
import { StyleSheet, View } from "react-native";
import DropdownMenu from "apps/components/DropdownMenu";

export default function AppLayout() {
  const menu = (
    <View style={{ marginRight: 20 }}>
      <DropdownMenu>
        <View>
          <Link href={"/"}>Home</Link>
          <Link push={true} href={"mines_of_doom"}>
            Mines of Doom
          </Link>
        </View>
      </DropdownMenu>
    </View>
  );
  return (
    <Stack
      screenOptions={{
        headerStyle: styles.header_container,
        headerTitleAlign: "center",
        headerTitleStyle: { color: "white" },
        headerRight: () => menu,
        title: "🏠",
      }}
    />
  );
}

const styles = StyleSheet.create({
  header_container: {
    backgroundColor: "black",
  },
});
