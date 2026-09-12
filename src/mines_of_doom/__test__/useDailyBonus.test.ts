/**
 * Hook-level tests for useDailyBonus — the async storage-backed state, the
 * once-per-day claim guard (the unlimited-claim bug fix: the ref is updated
 * synchronously so a fast double-tap before the re-render cannot pay the
 * bonus twice), and the once-per-day persistence. The pure claim math
 * (streak ladder, grace/freeze/repair bridges) is covered by
 * dailyBonus.test.ts; here we only verify the hook's state machine around
 * it. AsyncStorage is mocked with a shared in-memory store, same pattern as
 * useSettings.test.ts.
 */
import { act, renderHook } from "@testing-library/react-native";
import {
  DAILY_BASE_BONUS,
  DAILY_MILESTONE_BONUS,
  getLocalDayKey,
  localDayKeyDaysAgo,
} from "../dailyBonus";
import { dailyBonusKey, useDailyBonus } from "../hooks/useDailyBonus";
import { formatNumber } from "src/utils/format";

const mockStore = new Map<string, string>();
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  useAsyncStorage: (key: string) => ({
    getItem: async () => mockStore.get(key) ?? null,
    setItem: async (v: string) => {
      mockStore.set(key, v);
    },
    removeItem: async () => {
      mockStore.delete(key);
    },
  }),
}));

const NOW = Date.now();

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

const seed = (state: object) =>
  mockStore.set(dailyBonusKey, JSON.stringify(state));

const mount = () => {
  const grantMinerals = jest.fn();
  const displayMessage = jest.fn();
  const { result } = renderHook(() =>
    useDailyBonus({ grantMinerals, displayMessage }),
  );
  return { result, grantMinerals, displayMessage };
};

describe("useDailyBonus", () => {
  beforeAll(() => {
    jest.useFakeTimers();
  });
  afterAll(() => {
    jest.useRealTimers();
  });
  beforeEach(() => {
    mockStore.clear();
    jest.clearAllMocks();
  });

  it("fresh start: claimable for the base bonus, claim pays once and persists", async () => {
    const { result, grantMinerals, displayMessage } = mount();
    await flush();
    expect(result.current.claimable).toBe(true);
    expect(result.current.bonus).toBe(DAILY_BASE_BONUS);
    expect(result.current.streak).toBe(0);

    await act(async () => {
      result.current.claim();
    });
    expect(grantMinerals).toHaveBeenCalledTimes(1);
    expect(grantMinerals).toHaveBeenCalledWith(BigInt(DAILY_BASE_BONUS));
    expect(displayMessage).toHaveBeenCalledTimes(1);
    expect(displayMessage).toHaveBeenCalledWith(
      `Daily bonus: +${formatNumber(DAILY_BASE_BONUS)} minerals`,
      4000,
    );

    // Fast second tap in the same render window: the ref guard blocks it.
    await act(async () => {
      result.current.claim();
    });
    expect(grantMinerals).toHaveBeenCalledTimes(1);
    expect(result.current.claimable).toBe(false);

    const saved = JSON.parse(mockStore.get(dailyBonusKey) as string);
    expect(saved.lastClaimDay).toBe(getLocalDayKey(NOW));
    expect(saved.streak).toBe(1);
  });

  it("already claimed today: not claimable, claim is a no-op", async () => {
    seed({ lastClaimDay: getLocalDayKey(NOW), streak: 5 });
    const { result, grantMinerals, displayMessage } = mount();
    await flush();
    expect(result.current.claimable).toBe(false);
    await act(async () => {
      result.current.claim();
    });
    expect(grantMinerals).not.toHaveBeenCalled();
    expect(displayMessage).not.toHaveBeenCalled();
  });

  it("next local day: streak continues and the ladder bonus grows", async () => {
    seed({ lastClaimDay: localDayKeyDaysAgo(NOW, 1), streak: 1 });
    const { result, grantMinerals, displayMessage } = mount();
    await flush();
    expect(result.current.claimable).toBe(true);
    expect(result.current.streak).toBe(1);
    expect(result.current.bonus).toBe(DAILY_BASE_BONUS * 2);

    await act(async () => {
      result.current.claim();
    });
    expect(grantMinerals).toHaveBeenCalledWith(
      BigInt(DAILY_BASE_BONUS * 2),
    );
    expect(displayMessage).toHaveBeenCalledTimes(1);
    const [msg, timeout] = displayMessage.mock.calls[0] as [
      string,
      number,
    ];
    expect(timeout).toBe(4000);
    expect(msg).toContain(formatNumber(DAILY_BASE_BONUS * 2));

    const saved = JSON.parse(mockStore.get(dailyBonusKey) as string);
    expect(saved.lastClaimDay).toBe(getLocalDayKey(NOW));
    expect(saved.streak).toBe(2);
  });

  it("day 7 of the streak pays the milestone, not the ladder", async () => {
    seed({ lastClaimDay: localDayKeyDaysAgo(NOW, 1), streak: 6 });
    const { result, grantMinerals } = mount();
    await flush();
    expect(result.current.bonus).toBe(DAILY_MILESTONE_BONUS);
    await act(async () => {
      result.current.claim();
    });
    expect(grantMinerals).toHaveBeenCalledWith(
      BigInt(DAILY_MILESTONE_BONUS),
    );
    const saved = JSON.parse(mockStore.get(dailyBonusKey) as string);
    expect(saved.streak).toBe(7);
  });
});
