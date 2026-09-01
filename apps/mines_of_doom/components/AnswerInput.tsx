import { useRef } from "react";
import { Animated, KeyboardAvoidingView, TextInput } from "react-native";
import { styles } from "../styles";

const AnswerInput = ({
  value,
  onChangeText,
  onSubmit,
  shakeAnim,
}: {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  shakeAnim: Animated.Value;
}) => {
  const textInputRef = useRef<null | TextInput>(null);

  return (
    <KeyboardAvoidingView behavior="padding">
      <Animated.View
        style={{
          transform: [{ translateX: shakeAnim }],
        }}
      >
        <TextInput
          ref={textInputRef}
          value={value}
          onChangeText={onChangeText}
          inputMode="numeric"
          autoFocus={true}
          clearButtonMode="always"
          onSubmitEditing={() => {
            onSubmit();
            textInputRef.current?.clear();
          }}
          selectTextOnFocus={true}
          blurOnSubmit={false}
          clearTextOnFocus={true}
          style={{
            ...styles.text,
            ...styles.textInputBox,
          }}
        />
      </Animated.View>
    </KeyboardAvoidingView>
  );
};

export default AnswerInput;
