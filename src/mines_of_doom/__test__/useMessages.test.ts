/**
 * Hook-level tests for useMessages — the single-slot toast state machine
 * shared by all game messaging (21 call sites): display, expiry after the
 * caller's timeout, and replace-with-reset when a new message arrives
 * before the old one expires (a late expiry of the first message must not
 * wipe out the second). No mocks needed: the hook is a pure state machine
 * over setTimeout.
 */
import { act, renderHook } from "@testing-library/react-native";
import { useMessages } from "../hooks/useMessages";

describe("useMessages", () => {
  beforeAll(() => {
    jest.useFakeTimers();
  });
  afterAll(() => {
    jest.useRealTimers();
  });

  it("starts with no message", () => {
    const { result } = renderHook(() => useMessages());
    expect(result.current.showMessage).toBeNull();
  });

  it("shows a message until its timeout, then clears it", () => {
    const { result } = renderHook(() => useMessages());
    act(() => {
      result.current.displayMessage("Daily bonus!", 30000);
    });
    expect(result.current.showMessage).toBe("Daily bonus!");

    act(() => {
      jest.advanceTimersByTime(29999);
    });
    expect(result.current.showMessage).toBe("Daily bonus!");

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current.showMessage).toBeNull();
  });

  it("a new message replaces the old one and resets the expiry clock", () => {
    const { result } = renderHook(() => useMessages());
    act(() => {
      result.current.displayMessage("first", 5000);
    });
    act(() => {
      jest.advanceTimersByTime(4000);
    });
    act(() => {
      result.current.displayMessage("second", 5000);
    });
    expect(result.current.showMessage).toBe("second");

    // The first message's timer must have been cancelled: at t=8000 (past
    // its original 5000 expiry) only the second message is alive, and it
    // expires 5000ms after ITS own display, not the first's.
    act(() => {
      jest.advanceTimersByTime(4000);
    });
    expect(result.current.showMessage).toBe("second");
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current.showMessage).toBeNull();
  });

  it("displaying the same message twice refreshes its clock", () => {
    const { result } = renderHook(() => useMessages());
    act(() => {
      result.current.displayMessage("Daily bonus!", 3000);
    });
    act(() => {
      jest.advanceTimersByTime(2000);
      result.current.displayMessage("Daily bonus!", 3000);
    });
    act(() => {
      jest.advanceTimersByTime(2999);
    });
    expect(result.current.showMessage).toBe("Daily bonus!");
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current.showMessage).toBeNull();
  });
});
