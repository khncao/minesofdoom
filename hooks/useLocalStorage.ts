import { useAsyncStorage } from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

export function useLocalStorage<T>(
  key: string,
  init: T
): [T, (newVal: T) => void, boolean] {
  const [value, setValue] = useState<T>(init);
  const [pending, setPending] = useState(false);
  const { getItem, setItem } = useAsyncStorage(key);

  useEffect(() => {
    setPending(true);
    getItem().then((val) => {
      if (val != null) {
        setValue(JSON.parse(val) as T);
      }
    });
    return () => setPending(false);
  }, [getItem]);

  const setter = (newVal: T) => {
    setPending(true);
    setItem(JSON.stringify(newVal)).then(() => setPending(false));
  };
  return [value, setter, pending];
}
