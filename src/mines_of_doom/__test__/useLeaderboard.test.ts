/**
 * Hook tests for useLeaderboard: the 5-minute submit cadence (piggybacked
 * requests), the latest-stats-at-submit semantics, the display-name
 * sanitization + persistence (in AsyncStorage, NEVER in the save key),
 * and the display refresh policy (60s cache, 5s tap throttle,
 * error/unavailable states). Fake timers throughout (the cadence math is
 * the point).
 */
import { act, renderHook } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DEFAULT_DISPLAY_NAME,
  LEADERBOARD_NAME_MAX,
  LEADERBOARD_TOP_LIMIT,
  LeaderboardProvider,
  LeaderboardRank,
  LeaderboardRow,
} from "../leaderboard";
import {
  LEADERBOARD_CACHE_TTL_MS,
  LEADERBOARD_REFRESH_THROTTLE_MS,
  LEADERBOARD_SUBMIT_INTERVAL_MS,
  useLeaderboard,
  type LeaderboardStatsInput,
} from "../hooks/useLeaderboard";

// In-memory AsyncStorage (same pattern as the cloud-save hook tests —
// both the default export AND useAsyncStorage, which useLocalStorage
// consumes). The store lives INSIDE the factory (referencing an
// out-of-scope binding from a hoisted factory would hit the TDZ during
// import).
jest.mock("@react-native-async-storage/async-storage", () => {
  const store = new Map<string, string>();
  const mem = {
    setItem: jest.fn(async (k: string, v: string) => {
      store.set(k, String(v));
    }),
    getItem: jest.fn(
      async (k: string) => (store.has(k) ? store.get(k) : null),
    ),
    removeItem: jest.fn(async (k: string) => {
      store.delete(k);
    }),
  };
  const useAsyncStorage = jest.fn((key: string) => ({
    // The real API binds the key: setItem(value) / getItem() — mirror it.
    getItem: async () => store.get(key) ?? null,
    setItem: async (v: string) => {
      store.set(key, String(v));
    },
  }));
  return {
    __esModule: true,
    __store: store,
    default: mem,
    ...mem,
    useAsyncStorage,
  };
});

import * as AsyncStorageMock from "@react-native-async-storage/async-storage";

const mockStore: Map<string, string> = (AsyncStorageMock as unknown as {
  __store: Map<string, string>;
}).__store;

jest.useFakeTimers();
const T0 = 1_000_000_000_000; // "now" — far from epoch so the 0-sentinel refs never collide
beforeEach(() => {
  jest.setSystemTime(new Date(T0));
  mockStore.clear();
  (AsyncStorage.getItem as jest.Mock).mockClear();
  (AsyncStorage.setItem as jest.Mock).mockClear();
});

const ROWS: LeaderboardRow[] = [
  { rank: 1, displayName: "DeepDigger", bestDepth: 500, maxCombo: 120, achievementCount: 8 },
];

interface Fixture {
  provider: LeaderboardProvider;
  calls: { method: string; args: unknown[] }[];
  stats: { current: LeaderboardStatsInput | null };
  setTopResult: (r: LeaderboardRow[] | null) => void;
  setRankResult: (r: LeaderboardRank | null) => void;
}

function makeFixture(): Fixture {
  const calls: { method: string; args: unknown[] }[] = [];
  const state = {
    topResult: ROWS as LeaderboardRow[] | null,
    rankResult: { rank: 2, bestDepth: 300 } as LeaderboardRank | null,
  };
  const provider: LeaderboardProvider = {
    id: "noop",
    isAvailable: () => true,
    async submit(stats) {
      calls.push({ method: "submit", args: [stats] });
      return true;
    },
    async top(limit) {
      calls.push({ method: "top", args: [limit] });
      return state.topResult;
    },
    async rank() {
      calls.push({ method: "rank", args: [] });
      return state.rankResult;
    },
  };
  const stats = {
    current: {
      bestDepth: 120,
      maxCombo: 25,
      lifetimeMinerals: 60_000,
      achievementIds: ["miner-1", "gem-1"],
    } as LeaderboardStatsInput | null,
  };
  return {
    provider,
    calls,
    stats,
    setTopResult: (r) => {
      state.topResult = r;
    },
    setRankResult: (r) => {
      state.rankResult = r;
    },
  };
}

function getStatsOf(fx: Fixture) {
  return () => fx.stats.current;
}

/** Render + flush the initial AsyncStorage load. */
async function render(fx: Fixture) {
  const rendered = renderHook(() =>
    useLeaderboard({ provider: fx.provider, getStats: getStatsOf(fx) }),
  );
  await act(async () => {});
  return rendered;
}

// -- submit cadence ------------------------------------------------------------

describe("requestSubmit (cadence + payload)", () => {
  it("submits the current lifetime stats + the default display name on the first request", async () => {
    const fx = makeFixture();
    const { result } = await render(fx);
    expect(result.current.available).toBe(true);
    expect(result.current.displayName).toBe(DEFAULT_DISPLAY_NAME);

    act(() => {
      result.current.requestSubmit();
    });
    await act(async () => {});

    expect(fx.calls).toEqual([
      {
        method: "submit",
        args: [
          {
            bestDepth: 120,
            maxCombo: 25,
            lifetimeMinerals: 60_000,
            achievementIds: ["miner-1", "gem-1"],
            displayName: DEFAULT_DISPLAY_NAME,
          },
        ],
      },
    ]);
  });

  it("caps the submit cadence at one per 5 minutes", async () => {
    const fx = makeFixture();
    const { result } = await render(fx);
    act(() => result.current.requestSubmit());
    await act(async () => {});
    // Piggybacked requests in the same minute are no-ops.
    act(() => {
      result.current.requestSubmit();
      result.current.requestSubmit();
    });
    await act(async () => {});
    expect(fx.calls).toHaveLength(1);

    // ...but the NEXT minute's save flush resubmits.
    jest.setSystemTime(new Date(T0 + LEADERBOARD_SUBMIT_INTERVAL_MS + 1000));
    act(() => result.current.requestSubmit());
    await act(async () => {});
    expect(fx.calls).toHaveLength(2);
  });

  it("sends the LATEST stats and name at submit time (not a stale capture)", async () => {
    const fx = makeFixture();
    const { result } = await render(fx);
    act(() => result.current.requestSubmit());
    await act(async () => {});

    fx.stats.current = {
      bestDepth: 999,
      maxCombo: 99,
      lifetimeMinerals: 499_500,
      achievementIds: ["miner-1"],
    };
    act(() => result.current.setDisplayName("Deep"));
    await act(async () => {});

    jest.setSystemTime(new Date(T0 + LEADERBOARD_SUBMIT_INTERVAL_MS + 1000));
    act(() => result.current.requestSubmit());
    await act(async () => {});

    const sent = fx.calls[1].args[0] as {
      bestDepth: number;
      displayName: string;
      achievementIds: string[];
    };
    expect(sent.bestDepth).toBe(999);
    expect(sent.displayName).toBe("Deep");
    expect(sent.achievementIds).toEqual(["miner-1"]);
  });

  it("sanitizes the display name before it leaves the device", async () => {
    const fx = makeFixture();
    const { result } = await render(fx);
    act(() =>
      result.current.setDisplayName("  " + "x".repeat(LEADERBOARD_NAME_MAX * 2) + " "),
    );
    await act(async () => {});
    act(() => result.current.requestSubmit());
    await act(async () => {});
    const sent = fx.calls[0].args[0] as { displayName: string };
    expect(sent.displayName).toBe("x".repeat(LEADERBOARD_NAME_MAX));
  });

  it("persists the display name in AsyncStorage — never in the save key", async () => {
    const fx = makeFixture();
    const { result } = await render(fx);
    act(() => result.current.setDisplayName("Deep"));
    await act(async () => {});
    expect(mockStore.get("leaderboardDisplayName")).toBe(
      JSON.stringify("Deep"),
    );
    expect(
      (AsyncStorage.setItem as jest.Mock).mock.calls.some(
        ([key]) => key === "MinesOfDoom.SaveData",
      ),
    ).toBe(false);
  });

  it("never submits when the provider is unavailable (no-op platform)", async () => {
    const fx = makeFixture();
    const { result } = renderHook(() =>
      useLeaderboard({
        provider: { ...fx.provider, isAvailable: () => false },
        getStats: getStatsOf(fx),
      }),
    );
    await act(async () => {});
    expect(result.current.available).toBe(false);
    act(() => result.current.requestSubmit());
    act(() => result.current.refresh());
    await act(async () => {});
    expect(fx.calls).toHaveLength(0);
    expect(result.current.status).toBe("idle");
  });

  it("never submits before the first save is ready (null stats)", async () => {
    const fx = makeFixture();
    const { result } = await render(fx);
    fx.stats.current = null;
    act(() => result.current.requestSubmit());
    await act(async () => {});
    expect(fx.calls).toHaveLength(0);
  });
});

// -- refresh (top + rank) ------------------------------------------------------

describe("refresh (top + rank, cache, throttle, errors)", () => {
  it("loads the top-10 + this device's rank", async () => {
    const fx = makeFixture();
    const { result } = await render(fx);
    expect(result.current.status).toBe("idle");
    expect(result.current.rows).toBeNull();

    act(() => result.current.refresh());
    await act(async () => {});

    expect(result.current.status).toBe("loaded");
    expect(result.current.rows).toEqual(ROWS);
    expect(result.current.yourRank).toEqual({ rank: 2, bestDepth: 300 });
    expect(fx.calls).toEqual([
      { method: "top", args: [LEADERBOARD_TOP_LIMIT] },
      { method: "rank", args: [] },
    ]);
  });

  it("tap throttle: rapid refresh taps fire one fetch", async () => {
    const fx = makeFixture();
    const { result } = await render(fx);
    act(() => {
      result.current.refresh();
      result.current.refresh();
      result.current.refresh();
    });
    await act(async () => {});
    expect(fx.calls.filter((c) => c.method === "top")).toHaveLength(1);
  });

  it("60s cache: a reopen within the TTL shows the cached board, no refetch", async () => {
    const fx = makeFixture();
    const { result } = await render(fx);
    act(() => result.current.refresh());
    await act(async () => {});

    jest.setSystemTime(new Date(T0 + LEADERBOARD_REFRESH_THROTTLE_MS + 1000));
    act(() => result.current.refresh());
    await act(async () => {});
    expect(fx.calls.filter((c) => c.method === "top")).toHaveLength(1);

    jest.setSystemTime(new Date(T0 + LEADERBOARD_CACHE_TTL_MS + 1000));
    act(() => result.current.refresh());
    await act(async () => {});
    expect(fx.calls.filter((c) => c.method === "top")).toHaveLength(2);
  });

  it("a failed fetch (null) flips status to 'error' — the UI shows 'unavailable'", async () => {
    const fx = makeFixture();
    fx.setTopResult(null);
    const { result } = await render(fx);
    act(() => result.current.refresh());
    await act(async () => {});
    expect(result.current.status).toBe("error");
    expect(result.current.rows).toBeNull();
  });

  it("keeps the stale board visible while a refetch is in flight", async () => {
    const fx = makeFixture();
    const { result } = await render(fx);
    act(() => result.current.refresh());
    await act(async () => {});
    expect(result.current.status).toBe("loaded");

    // Refetch after the cache expires: the rows survive until it settles.
    fx.setTopResult([...ROWS, { rank: 3, displayName: "Mole", bestDepth: 100, maxCombo: 10, achievementCount: 1 }]);
    jest.setSystemTime(new Date(T0 + LEADERBOARD_CACHE_TTL_MS + 1000));
    act(() => result.current.refresh());
    // (before the promise settles — status must still show the board)
    expect(result.current.status).toBe("loaded");
    await act(async () => {});
    expect(result.current.rows).toHaveLength(2);
  });
});
