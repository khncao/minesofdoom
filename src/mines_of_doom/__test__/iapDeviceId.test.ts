import { makeDeviceId } from "../iapDeviceId";

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
