/**
 * Hook-level tests for the tap pipeline (useMineTaps): per-tap side effects
 * (sound, pickaxe swing, debris, block break, combo reset, floating gain)
 * and the 20Hz gain flush — rapid taps must accumulate in a ref and reach
 * addTapGain as a handful of batched re-renders, never one-per-tap.
 */
import { act, renderHook } from "@testing-library/react-native";
import { useMineTaps } from "../hooks/useMineTaps";

type UseMineTapsProps = Parameters<typeof useMineTaps>[0];

function makeProps(overrides: Partial<UseMineTapsProps> = {}): UseMineTapsProps {
  return {
    clickPower: 10n,
    play: jest.fn(),
    playerPickaxeAnimRef: { current: jest.fn() },
    debrisRef: { current: { trigger: jest.fn() } },
    blockBreakRef: { current: { trigger: jest.fn() } },
    addTapGain: jest.fn(),
    onResetCombo: jest.fn(),
    onGain: jest.fn(),
    ...overrides,
  } as UseMineTapsProps;
}

type TapResult = ReturnType<typeof renderHook<
  ReturnType<typeof useMineTaps>,
  UseMineTapsProps
>>["result"];

const tap = (result: TapResult, n = 1) =>
  act(() => {
    for (let i = 0; i < n; i++) result.current.mineTap();
  });

/** Poll until the predicate holds (the 20Hz flush is rAF-driven and needs
 *  a few macrotask frames to land) — bounded, so a regression fails loudly
 *  instead of hanging. */
async function settle(until: () => boolean) {
  const start = Date.now();
  while (!until() && Date.now() - start < 1000) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
  }
  expect(until()).toBe(true);
}

describe("useMineTaps — per-tap side effects", () => {
  it("plays the pickaxe sound (rate-limited), swings, triggers debris + block break, resets the combo and reports the gain", () => {
    const play = jest.fn();
    const swing = jest.fn();
    const debris = jest.fn();
    const blockBreak = jest.fn();
    const onResetCombo = jest.fn();
    const onGain = jest.fn();
    const { result } = renderHook(() =>
      useMineTaps(
        makeProps({
          play,
          playerPickaxeAnimRef: { current: swing },
          debrisRef: { current: { trigger: debris } },
          blockBreakRef: { current: { trigger: blockBreak } },
          onResetCombo,
          onGain,
        }),
      ),
    );
    tap(result, 3);
    expect(play).toHaveBeenCalledTimes(3);
    expect(play).toHaveBeenCalledWith("pickaxe", 60);
    expect(swing).toHaveBeenCalledTimes(3);
    expect(debris).toHaveBeenCalledTimes(3);
    expect(blockBreak).toHaveBeenCalledTimes(3);
    expect(onResetCombo).toHaveBeenCalledTimes(3);
    expect(onGain).toHaveBeenCalledTimes(3);
    expect(onGain).toHaveBeenCalledWith(10n);
  });
});

describe("useMineTaps — 20Hz gain flush", () => {
  it("batches rapid taps into a single addTapGain call with the summed gain", async () => {
    const addTapGain = jest.fn();
    const { result } = renderHook(() => useMineTaps(makeProps({ addTapGain })));
    tap(result, 5);
    expect(addTapGain).not.toHaveBeenCalled(); // flush is scheduled, not inline
    await settle(() => addTapGain.mock.calls.length === 1);
    expect(addTapGain).toHaveBeenCalledWith(50n);
  });

  it("a tap right after a flush lands in its OWN later batch (20Hz rate limit)", async () => {
    const addTapGain = jest.fn();
    const { result } = renderHook(() => useMineTaps(makeProps({ addTapGain })));
    tap(result, 2);
    await settle(() => addTapGain.mock.calls.length === 1);
    tap(result, 1);
    await settle(() => addTapGain.mock.calls.length === 2);
    expect(addTapGain.mock.calls).toEqual([[20n], [10n]]);
  });

  it("gains always use the CURRENT click power (upgrades apply mid-session)", async () => {
    const addTapGain = jest.fn();
    const r = renderHook(
      (clickPower: bigint) => useMineTaps(makeProps({ clickPower, addTapGain })),
      { initialProps: 10n },
    );
    tap(r.result, 1);
    await settle(() => addTapGain.mock.calls.length === 1);
    act(() => r.rerender(25n));
    tap(r.result, 2);
    await settle(() => addTapGain.mock.calls.length === 2);
    expect(addTapGain.mock.calls).toEqual([[10n], [50n]]);
  });
});
