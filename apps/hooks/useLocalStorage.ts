import { useAsyncStorage } from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";

export function useLocalStorage<T>(
  key: string,
  init: T,
): [T, (newVal: T) => void, boolean] {
  const [value, setValue] = useState<T>(init);
  const [pending, setPending] = useState(false);
  const { getItem, setItem } = useAsyncStorage(key);
  // useAsyncStorage returns new function identities every render; keep a ref
  // so the setter below can be stable.
  const setItemRef = useRef(setItem);
  setItemRef.current = setItem;

  // useAsyncStorage returns new function identities every render, so
  // depending on getItem directly would re-run this effect (and its
  // setPending state updates) on every render, causing a render loop.
  const getItemRef = useRef(getItem);
  getItemRef.current = getItem;

  useEffect(() => {
    setPending(true);
    getItemRef.current().then((val) => {
      if (val != null) {
        setValue(JSON.parse(val) as T);
      }
    });
    return () => setPending(false);
  }, []);

  const setter = useCallback(
    (newVal: T) => {
      setPending(true);
      setItemRef.current(JSON.stringify(newVal)).then(() => setPending(false));
    },
    [],
  );
  return [value, setter, pending];
}
