/**
 * Jest manual mock for @react-native-async-storage/async-storage
 * (auto-applied by jest for node modules — the real module's native
 * implementation doesn't exist in the test environment). In-memory
 * stand-in with the same get/setItem surface the app uses, plus a
 * test-friendly useAsyncStorage. State is per test-file run; call
 * `AsyncStorage.clear()` between tests when isolation matters.
 */
const store = new Map<string, string>();

const AsyncStorage = {
  getItem: jest.fn(async (key: string) =>
    store.has(key) ? (store.get(key) as string) : null,
  ),
  setItem: jest.fn(async (key: string, value: string) => {
    store.set(key, value);
  }),
  removeItem: jest.fn(async (key: string) => {
    store.delete(key);
  }),
  clear: jest.fn(async () => {
    store.clear();
  }),
  getAllKeys: jest.fn(async () => Array.from(store.keys())),
};

export function useAsyncStorage(key: string) {
  return {
    getItem: () => AsyncStorage.getItem(key),
    setItem: (value: string | null) =>
      value === null
        ? AsyncStorage.removeItem(key)
        : AsyncStorage.setItem(key, value),
    removeItem: () => AsyncStorage.removeItem(key),
  };
}

export default AsyncStorage;
