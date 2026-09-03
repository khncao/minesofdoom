/**
 * Provider-core tests for the leaderboard (leaderboard.ts): the
 * selection matrix (dev/web/unconfigured/configured), the display-name
 * sanitizer, and the store provider's fetch round-trips against a
 * scripted fetch — submit accepted/error, top parsed/dropped/malformed,
 * rank present/absent/malformed. Mirrors cloudSave.test.ts (the engine
 * wiring — cadence, cache, throttle — is tested in useLeaderboard.test.ts).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { storeConfig } from "../storeConfig";
import {
  DEFAULT_DISPLAY_NAME,
  LeaderboardProviderSelection,
  LEADERBOARD_TOP_LIMIT,
  LeaderboardRow,
  devSimLeaderboardProvider,
  noopLeaderboardProvider,
  pickLeaderboardProvider,
  sanitizeDisplayName,
  storeLeaderboardProvider,
} from "../leaderboard";
import { IAP_DEVICE_ID_KEY } from "../iapDeviceId";

const BASE = "https://pb.example.test";
const DEVICE_ID = "abcdefgh234567890123456789";

const STATS = {
  displayName: "Digger",
  bestDepth: 120,
  maxCombo: 25,
  lifetimeMinerals: 60_000,
  achievementIds: ["miner-1", "gem-1"],
};

const ROWS: LeaderboardRow[] = [
  { rank: 1, displayName: "DeepDigger", bestDepth: 500, maxCombo: 120, achievementCount: 8 },
  { rank: 2, displayName: "Quarry Queen", bestDepth: 300, maxCombo: 90, achievementCount: 5 },
];

/** Scripted fetch: resolves a JSON body or a non-2xx per call. */
const fetchMock = jest.fn();
const jsonResponse = (body: unknown, ok = true) => ({
  ok,
  json: async () => body,
});

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem(IAP_DEVICE_ID_KEY, DEVICE_ID);
  storeConfig.pocketbaseUrl = BASE;
  fetchMock.mockReset();
  (global.fetch as unknown) = fetchMock;
});

afterEach(() => {
  storeConfig.pocketbaseUrl = "";
});

// -- selection ---------------------------------------------------------------

describe("pickLeaderboardProvider (selection matrix)", () => {
  const sel = (over: Partial<LeaderboardProviderSelection> = {}) => ({
    dev: false,
    web: false,
    pocketbaseConfigured: false,
    ...over,
  });

  it("dev always wins — the labeled in-memory row", () => {
    expect(
      pickLeaderboardProvider(sel({ dev: true, pocketbaseConfigured: true })),
    ).toBe(devSimLeaderboardProvider);
  });

  it("web is a no-op, even with the backend configured", () => {
    expect(pickLeaderboardProvider(sel({ web: true, pocketbaseConfigured: true })))
      .toBe(noopLeaderboardProvider);
  });

  it("native without the Pocketbase URL is a no-op (entry points hidden)", () => {
    expect(pickLeaderboardProvider(sel())).toBe(noopLeaderboardProvider);
  });

  it("native production with the URL gets the store provider", () => {
    expect(
      pickLeaderboardProvider(sel({ pocketbaseConfigured: true })),
    ).toBe(storeLeaderboardProvider);
  });
});

// -- sanitizer ------------------------------------------------------------------

describe("sanitizeDisplayName", () => {
  it("keeps a normal name unchanged", () => {
    expect(sanitizeDisplayName("Digger")).toBe("Digger");
  });

  it("strips control characters and surrounding whitespace", () => {
    expect(sanitizeDisplayName("  di\u0000g\u001fer \n")).toBe("diger");
  });

  it("caps at 16 characters", () => {
    expect(sanitizeDisplayName("a".repeat(40)).length).toBe(16);
  });

  it("falls back to the default for an empty result", () => {
    expect(sanitizeDisplayName("")).toBe(DEFAULT_DISPLAY_NAME);
    expect(sanitizeDisplayName("   \u0000\u0001 ")).toBe(DEFAULT_DISPLAY_NAME);
  });
});

// -- store provider: gating ----------------------------------------------------

describe("storeLeaderboardProvider (gating)", () => {
  it("is unavailable and inert while the URL is empty", async () => {
    storeConfig.pocketbaseUrl = "";
    expect(storeLeaderboardProvider.isAvailable()).toBe(false);
    await expect(storeLeaderboardProvider.submit(STATS)).resolves.toBe(false);
    await expect(storeLeaderboardProvider.top(LEADERBOARD_TOP_LIMIT)).resolves.toBeNull();
    await expect(storeLeaderboardProvider.rank()).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is available once the URL is configured", () => {
    expect(storeLeaderboardProvider.isAvailable()).toBe(true);
  });
});

// -- store provider: submit ----------------------------------------------------

describe("storeLeaderboardProvider.submit", () => {
  it("sends the device id + sanitized stats and reports success on { ok: true }", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    await expect(storeLeaderboardProvider.submit(STATS)).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/api/app/leaderboard/submit`);
    expect(JSON.parse(init.body)).toEqual({
      deviceId: DEVICE_ID,
      displayName: STATS.displayName,
      bestDepth: STATS.bestDepth,
      maxCombo: STATS.maxCombo,
      lifetimeMinerals: STATS.lifetimeMinerals,
      achievementIds: STATS.achievementIds,
    });
  });

  it("sanitizes the display name before it leaves the device", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    await storeLeaderboardProvider.submit({
      ...STATS,
      displayName: "  " + "x".repeat(40) + " ",
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.displayName).toBe("x".repeat(16));
  });

  it("reports false on network failure / non-2xx / non-ok (never throws)", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    await expect(storeLeaderboardProvider.submit(STATS)).resolves.toBe(false);
    fetchMock.mockResolvedValue(jsonResponse({}, false));
    await expect(storeLeaderboardProvider.submit(STATS)).resolves.toBe(false);
    fetchMock.mockResolvedValue(jsonResponse({ ok: false }));
    await expect(storeLeaderboardProvider.submit(STATS)).resolves.toBe(false);
  });
});

// -- store provider: top --------------------------------------------------------

describe("storeLeaderboardProvider.top", () => {
  it("posts the limit and returns the parsed rows", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ rows: ROWS }));
    await expect(
      storeLeaderboardProvider.top(LEADERBOARD_TOP_LIMIT),
    ).resolves.toEqual(ROWS);
    expect(fetchMock.mock.calls[0][0]).toBe(
      `${BASE}/api/app/leaderboard/top`,
    );
    expect(JSON.parse((fetchMock.mock.calls[0][1].body as string))).toEqual({
      limit: LEADERBOARD_TOP_LIMIT,
    });
  });

  it("drops malformed rows (garbage must not reach the board UI)", async () => {
    const bad: unknown[] = [
      { rank: 0, displayName: "a", bestDepth: 1, maxCombo: 1, achievementCount: 0 }, // rank < 1
      { rank: 2, displayName: "", bestDepth: 1, maxCombo: 1, achievementCount: 0 }, // empty name
      { rank: 2, displayName: "b", bestDepth: -1, maxCombo: 1, achievementCount: 0 }, // negative depth
      { rank: 2, displayName: "b", bestDepth: Infinity, maxCombo: 1, achievementCount: 0 }, // non-finite
      { rank: 2, displayName: "b", bestDepth: 1, maxCombo: 1, achievementCount: 1.5 }, // non-integer count
      "not-an-object",
    ];
    fetchMock.mockResolvedValue(
      jsonResponse({ rows: [ROWS[0], ...bad, ROWS[1]] }),
    );
    await expect(
      storeLeaderboardProvider.top(LEADERBOARD_TOP_LIMIT),
    ).resolves.toEqual(ROWS);
  });

  it("returns null on a network failure (the UI shows 'unavailable')", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    await expect(storeLeaderboardProvider.top(10)).resolves.toBeNull();
  });

  it("returns null when the reply has no rows array", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ rows: "nope" }));
    await expect(storeLeaderboardProvider.top(10)).resolves.toBeNull();
  });
});

// -- store provider: rank --------------------------------------------------------

describe("storeLeaderboardProvider.rank", () => {
  it("posts the device id and returns the entry", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ entry: { rank: 3, bestDepth: 90 } }),
    );
    await expect(storeLeaderboardProvider.rank()).resolves.toEqual({
      rank: 3,
      bestDepth: 90,
    });
    expect(fetchMock.mock.calls[0][0]).toBe(
      `${BASE}/api/app/leaderboard/rank`,
    );
    expect(JSON.parse((fetchMock.mock.calls[0][1].body as string))).toEqual({
      deviceId: DEVICE_ID,
    });
  });

  it("returns null when the device has no row yet ({ entry: null })", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ entry: null }));
    await expect(storeLeaderboardProvider.rank()).resolves.toBeNull();
  });

  it("returns null on failure or a malformed entry", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    await expect(storeLeaderboardProvider.rank()).resolves.toBeNull();
    fetchMock.mockResolvedValue(jsonResponse({ entry: { rank: -1, bestDepth: 1 } }));
    await expect(storeLeaderboardProvider.rank()).resolves.toBeNull();
    fetchMock.mockResolvedValue(jsonResponse({}));
    await expect(storeLeaderboardProvider.rank()).resolves.toBeNull();
  });
});

// -- dev-sim provider -----------------------------------------------------------

describe("devSimLeaderboardProvider (dev build simulation)", () => {
  it("is available and empty before the first submit", async () => {
    expect(devSimLeaderboardProvider.isAvailable()).toBe(true);
    await expect(devSimLeaderboardProvider.top(10)).resolves.toEqual([]);
  });

  it("submit → top shows this device's row at rank 1 with the badge count", async () => {
    const stats = { ...STATS, displayName: "SimDigger" };
    await devSimLeaderboardProvider.submit(stats);
    await expect(devSimLeaderboardProvider.top(10)).resolves.toEqual([
      {
        rank: 1,
        displayName: "SimDigger",
        bestDepth: stats.bestDepth,
        maxCombo: stats.maxCombo,
        achievementCount: stats.achievementIds.length,
      },
    ]);
    await expect(devSimLeaderboardProvider.rank()).resolves.toEqual({
      rank: 1,
      bestDepth: stats.bestDepth,
    });
  });

  it("is monotonic: a shallower resubmit can't push the row backwards", async () => {
    const deep = { ...STATS, displayName: "DeepGuy", bestDepth: 9_000 };
    await devSimLeaderboardProvider.submit(deep);
    await devSimLeaderboardProvider.submit({
      ...deep,
      bestDepth: 10,
      maxCombo: 1,
    });
    await expect(devSimLeaderboardProvider.top(10)).resolves.toEqual([
      {
        rank: 1,
        displayName: "DeepGuy",
        bestDepth: 9_000,
        maxCombo: STATS.maxCombo,
        achievementCount: STATS.achievementIds.length,
      },
    ]);
  });
});
