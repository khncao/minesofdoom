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
    let cancelled = false;
    setPending(true);
    getItemRef.current()
      .then((val) => {
        if (cancelled) return;
        if (val != null) {
          try {
            setValue(JSON.parse(val) as T);
          } catch (e) {
            // Corrupt value: fall back to the initial value rather than
            // crashing the whole screen on mount.
            console.warn(`Corrupt value for "${key}", using default`, e);
          }
        }
      })
      .catch((e) => console.warn(`Failed to read "${key}"`, e))
      .finally(() => {
        if (!cancelled) setPending(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setter = useCallback(
    (newVal: T) => {
      setPending(true);
      setItemRef.current(JSON.stringify(newVal))
        .catch((e) => console.warn(`Failed to write "${key}"`, e))
        .finally(() => setPending(false));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  return [value, setter, pending];
}
