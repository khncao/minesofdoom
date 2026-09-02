import { useState } from "react";
import { Modal, View, Text } from "react-native";

export interface ConfirmableButtonProps {
  title: string;
  description: string;
  onPress: () => void;
}

export default function ConfirmableButton(props: ConfirmableButtonProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  return (
    <View>
      <Modal
        // animationType="slide"
        visible={isConfirming}
        onRequestClose={() => setIsConfirming(false)}
        transparent={true}
      >
        <View style={styles.modal}>
          <View style={{ margin: 10 }}>
            <Text style={styles.text}>{props.description}</Text>
            <Text style={styles.text}>Are you sure?</Text>
          </View>

          <View style={styles.buttons}>
            <Button
              title="Confirm"
              onPress={() => {
                props.onPress();
                setIsConfirming(false);
              }}
            />
            <Button
              title="Cancel"
              onPress={() => {
                setIsConfirming(false);
              }}
            />
          </View>
        </View>
      </Modal>
      <Button title={props.title} onPress={() => setIsConfirming(true)} />
    </View>
  );
}

import { StyleSheet } from "react-native";
import Button from "./Button";
const styles = StyleSheet.create({
  modal: {
    justifyContent: "flex-end",
    alignContent: "center",
    alignItems: "center",
    backgroundColor: "grey",
    marginTop: "30%",
    margin: "auto",
  },
  buttons: {
    gap: 5,
    margin: 5,
  },
  text: {
    color: "white",
  },
});
