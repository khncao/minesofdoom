import { Animated } from "react-native";
import { clockPhase, getSharedClock, stopSharedClock } from "./animationClock";

describe("shared animation clock (§4.5)", () => {
  afterAll(() => {
    // The clock is a fire-and-forget app-lifetime singleton; stop it so the
    // frame driver doesn't outlive the jest environment.
    stopSharedClock();
  });

  test("getSharedClock is a singleton (one loop drives every miner)", () => {
    const a = getSharedClock();
    const b = getSharedClock();
    expect(a).toBe(b);
    expect(a).toBeInstanceOf(Animated.Value);
  });

  test("clockPhase is deterministic, in [0, 1), salt-sensitive", () => {
    expect(clockPhase(42, 17)).toBe(clockPhase(42, 17));
    const p = clockPhase(42, 17);
    expect(p).toBeGreaterThanOrEqual(0);
    expect(p).toBeLessThan(1);
    expect(clockPhase(42, 18)).not.toBe(p); // salt-sensitive
    expect(clockPhase(43, 17)).not.toBe(p); // seed-sensitive
  });
});
