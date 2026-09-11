import { IAP_DEVICE_ID_KEY, makeDeviceId } from "../iapDeviceId";

type AsyncStorageObj =
  typeof import("@react-native-async-storage/async-storage")["default"];

/**
 * Fresh copy of the module + its AsyncStorage mock so the single-flight
 * state (memo / in-flight promise) starts empty per scenario — the
 * concurrent-call net (F49.1) needs a clean slate, and both must come
 * from the SAME fresh registry so the storage assertions see the store
 * the app module writes to.
 */
function freshModule(): {
  storage: AsyncStorageObj;
  mod: typeof import("../iapDeviceId");
} {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const storage = require("@react-native-async-storage/async-storage")
    .default as AsyncStorageObj;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require("../iapDeviceId") as typeof import("../iapDeviceId");
  return { storage, mod };
}

describe("device id factory (pure)", () => {
  it("has the dev- prefix and a deterministic length", () => {
    const rand = () => 0.5;
    const id = makeDeviceId(1000000, rand);
    expect(id.startsWith("dev-")).toBe(true);
    // "dev-" + base36 timestamp + 16 random chars.
    expect(id.length).toBe(4 + (1000000).toString(36).length + 16);
  });

  it("never emits 0/o/1/i lookalike chars in the random tail", () => {
    const rand = () => 0.999999; // worst-case index per draw
    const id = makeDeviceId(1, rand);
    // The base36 timestamp prefix can contain digits on purpose — only
    // the random tail is drawn from the lookalike-free alphabet.
    const prefixLen = 4 + (1).toString(36).length;
    for (const ch of id.slice(prefixLen)) {
      expect("01oi").not.toContain(ch);
    }
  });

  it("two draws with different RNGs differ in the tail", () => {
    const a = makeDeviceId(123, () => 0.1);
    const b = makeDeviceId(123, () => 0.9);
    expect(a).not.toBe(b);
  });

  it("the timestamp prefix is stable for the same clock value", () => {
    const prefixLen = 4 + (9876543).toString(36).length;
    const a = makeDeviceId(9876543, () => 0.1);
    const b = makeDeviceId(9876543, () => 0.9);
    expect(a.slice(0, prefixLen)).toBe(b.slice(0, prefixLen));
  });
});

describe("getIapDeviceId (single-flight, F49.1 identity:device-id-fork)", () => {
  it("concurrent fresh-install calls resolve the SAME id (one mint, one write)", async () => {
    const { storage, mod } = freshModule();
    // The mock is async, so these all dispatch getItem before any setItem
    // can land — exactly the first-autosave race (cloud-push +
    // leaderboard-submit in the same commit).
    const [a, b, c] = await Promise.all([
      mod.getIapDeviceId(),
      mod.getIapDeviceId(),
      mod.getIapDeviceId(),
    ]);
    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(a.startsWith("dev-")).toBe(true);
    // The winning id is the persisted one.
    await expect(storage.getItem(IAP_DEVICE_ID_KEY)).resolves.toBe(a);
    // One mint, one write — no fork.
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(storage.setItem).toHaveBeenCalledWith(IAP_DEVICE_ID_KEY, a);
  });

  it("sequential calls after the first are memoized (no re-read, no re-mint)", async () => {
    const { storage, mod } = freshModule();
    const first = await mod.getIapDeviceId();
    const second = await mod.getIapDeviceId();
    expect(second).toBe(first);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    // The memo serves later calls — even after storage loses the key.
    await storage.removeItem(IAP_DEVICE_ID_KEY);
    await expect(mod.getIapDeviceId()).resolves.toBe(first);
  });

  it("an existing stored id is kept (upgrade/migration never re-mints)", async () => {
    const { storage, mod } = freshModule();
    const stored = makeDeviceId(42, () => 0.5);
    await storage.setItem(IAP_DEVICE_ID_KEY, stored);
    const [a, b] = await Promise.all([
      mod.getIapDeviceId(),
      mod.getIapDeviceId(),
    ]);
    expect(a).toBe(stored);
    expect(b).toBe(stored);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
  });
});
