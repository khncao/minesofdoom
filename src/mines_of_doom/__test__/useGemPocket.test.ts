/**
 * Hook-level tests for useGemPocket — the 1s spawn/expiry loop around
 * the pure gemPocket.ts logic (which pocketBonus.test.ts covers): the
 * spawn toast, the collect-once guard, the real 30 s window, and the
 * 5-minute post-pocket cooldown. The engine surface is stubbed with
 * plain jest.fn()s, same shape as the other hook tests in this dir.
 */
import { act, renderHook } from "@testing-library/react-native";

jest.mock("src/hooks/useI18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

// Import AFTER the mock declaration (babel hoists the mock itself).
import { useGemPocket } from "../hooks/useGemPocket";

function mount({
  enabled = true,
  clickPower = 5n,
  grantMinerals = jest.fn(),
  displayMessage = jest.fn(),
  onCollected = jest.fn(),
}: {
  enabled?: boolean;
  clickPower?: bigint;
  grantMinerals?: jest.Mock;
  displayMessage?: jest.Mock;
  onCollected?: jest.Mock;
} = {}) {
  const hook = renderHook(() =>
    useGemPocket({
      enabled,
      clickPower,
      grantMinerals,
      displayMessage,
      onCollected,
    }),
  );
  return { hook, grantMinerals, displayMessage, onCollected };
}

beforeAll(() => {
  jest.useFakeTimers();
});
afterAll(() => {
  jest.useRealTimers();
});
afterEach(() => {
  jest.restoreAllMocks();
});

/** A pocket on every roll (roll < 1/120 and a fixed seed). */
function alwaysSpawn() {
  jest.spyOn(Math, "random").mockReturnValue(0);
}

describe("useGemPocket", () => {
  test("a fresh mount has no pocket; collect() is a no-op", () => {
    const { hook, grantMinerals } = mount();
    expect(hook.result.current.pocket).toBeNull();
    act(() => hook.result.current.collect());
    expect(grantMinerals).not.toHaveBeenCalled();
  });

  test("a spawn forms a pocket worth 8 clicks and toasts once", () => {
    const { hook, displayMessage } = mount();
    alwaysSpawn();
    act(() => jest.advanceTimersByTime(1000)); // first 1s check
    expect(hook.result.current.pocket).not.toBeNull();
    expect(hook.result.current.pocket?.bonus).toBe(40); // 5 * 8
    expect(displayMessage).toHaveBeenCalledTimes(1);
    expect(displayMessage).toHaveBeenCalledWith("toast.gemPocket", 3000);
  });

  test("collect() grants the frozen bonus exactly once (fast double-tap)", () => {
    const { hook, grantMinerals, onCollected } = mount();
    alwaysSpawn();
    act(() => jest.advanceTimersByTime(1000));
    act(() => hook.result.current.collect());
    act(() => hook.result.current.collect()); // must be a no-op now
    expect(grantMinerals).toHaveBeenCalledTimes(1);
    expect(grantMinerals).toHaveBeenCalledWith(40n);
    expect(onCollected).toHaveBeenCalledTimes(1);
    expect(onCollected).toHaveBeenCalledWith(40);
    expect(hook.result.current.pocket).toBeNull();
  });

  test("an untouched pocket fades after the real 30 s window, paying nothing", () => {
    const { hook, grantMinerals } = mount();
    alwaysSpawn();
    act(() => jest.advanceTimersByTime(1000));
    act(() => jest.advanceTimersByTime(30_000)); // expiry tick
    expect(hook.result.current.pocket).toBeNull();
    expect(grantMinerals).not.toHaveBeenCalled();
  });

  test("no respawn before the 5-minute cooldown has elapsed", () => {
    const { hook } = mount();
    alwaysSpawn();
    act(() => jest.advanceTimersByTime(1000)); // spawn
    act(() => jest.advanceTimersByTime(30_000)); // expire
    act(() => jest.advanceTimersByTime(120_000)); // still inside cooldown
    expect(hook.result.current.pocket).toBeNull();
  });

  test("the next pocket may form once the cooldown has passed", () => {
    const { hook } = mount();
    alwaysSpawn();
    act(() => jest.advanceTimersByTime(1000)); // spawn at t=1s
    act(() => jest.advanceTimersByTime(30_000)); // expire
    act(() => jest.advanceTimersByTime(300_000)); // out of cooldown
    expect(hook.result.current.pocket).not.toBeNull();
  });

  test("disabled (onboarding up) never spawns, even past the odds", () => {
    const { hook, displayMessage } = mount({ enabled: false });
    alwaysSpawn();
    act(() => jest.advanceTimersByTime(2 * 60_000));
    expect(hook.result.current.pocket).toBeNull();
    expect(displayMessage).not.toHaveBeenCalled();
  });
});
