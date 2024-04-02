import React, { Dispatch, SetStateAction } from "react";
import { Button, Keyboard, StyleSheet, View } from "react-native";

export interface NumericKeypadProps {
  setText: Dispatch<SetStateAction<string>>;
  submit: () => void;
}

// 1 2 3
// 4 5 6
// 7 8 9
// x 0 >
export default function NumericKeypad(props: NumericKeypadProps) {
  function NumericButton(input: { value: number }) {
    return (
      <View style={styles.button}>
        <Button
          onPress={() => props.setText((old) => old + input.value.toString())}
          title={input.value.toString()}
        />
      </View>
    );
  }

  return (
    <View>
      <View style={styles.column}>
        <View style={styles.row}>
          <NumericButton value={1} />
          <NumericButton value={2} />
          <NumericButton value={3} />
        </View>
        <View style={styles.row}>
          <NumericButton value={4} />
          <NumericButton value={5} />
          <NumericButton value={6} />
        </View>
        <View style={styles.row}>
          <NumericButton value={7} />
          <NumericButton value={8} />
          <NumericButton value={9} />
        </View>
        <View style={styles.row}>
          <View style={styles.button}>
            <Button title="C" onPress={() => props.setText("")} />
          </View>
          <NumericButton value={0} />
          <View style={styles.button}>
            <Button title="OK" onPress={() => props.submit()} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 3,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  button: {
    height: 50,
    width: 40,
    // marginHorizontal: 5,
    alignSelf: "stretch",
    justifyContent: "space-evenly",
    alignContent: "stretch",
    alignItems: "stretch",
  },
});
