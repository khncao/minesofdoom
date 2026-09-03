/**
 * Hook-level tests for the rewarded-ads claim lifecycle (useAdRewards):
 * eligibility gating → provider call → reward grant → daily metering. The
 * pure reward rules live in ads.test.ts — these tests pin the glue: the
 * claim flow, the one-at-a-time guard, and the per-day caps as surfaced to
 * the UI through the canClaim* flags.
 */
import { act, renderHook } from "@testing-library/react-native";
import { useAdRewards } from "../hooks/useAdRewards";
import {
  AdKind,
  AdProvider,
  AdResult,
  AdRewardsState,
  AD_COMBO_SAVES_PER_DAY,
  AD_GEM_ROLLS_PER_DAY,
  AD_GEM_ROLLS_PER_USE,
  AD_MAX_REWARDS_PER_DAY,
} from "../ads";
import { getLocalDayKey } from "../dailyBonus";

/**
 * In-memory AsyncStorage (same pattern as useGameEngine.test.ts: the map
 * lives inside the hoisted factory and is exposed on the mock module).
 */
jest.mock("@react-native-async-storage/async-storage", () => {
  const store = new Map<string, string>();
  const mem = {
    setItem: jest.fn(async (k: string, v: string) => {
      store.set(k, v);
    }),
    getItem: jest.fn(
      async (k: string) => (store.has(k) ? (store.get(k) as string) : null),
    ),
    removeItem: jest.fn(async (k: string) => {
      store.delete(k);
    }),
    clear: jest.fn(async () => {
      store.clear();
    }),
  };
  const useAsyncStorage = (key: string) => ({
    getItem: () => mem.getItem(key),
    setItem: (v: string) => mem.setItem(key, v),
  });
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

/** Test provider: resolves every ad to a scripted result. */
function makeProvider(result: AdResult = "rewarded"): AdProvider {
  return {
    id: "test",
    isAvailable: () => true,
    showRewarded: jest.fn().mockResolvedValue(result),
  };
}

type AdRewardsProps = Parameters<typeof useAdRewards>[0];

/** Default props (available test provider, empty offers) + overrides. */
function makeProps(overrides: Partial<AdRewardsProps> = {}): AdRewardsProps {
  return {
    provider: makeProvider(),
    grantGems: jest.fn(),
    offlineDouble: null,
    claimOfflineDouble: jest.fn(),
    offlineTopUp: null,
    claimOfflineTopUp: jest.fn(),
    comboSave: null,
    claimComboSave: jest.fn(),
    displayMessage: jest.fn(),
    onAdView: jest.fn(),
    ...overrides,
  };
}

type AdRewards = ReturnType<typeof useAdRewards>;

async function renderAdRewards(props: AdRewardsProps, seed?: AdRewardsState | null) {
  mockStore.clear();
  if (seed != null) {
    mockStore.set("adRewards", JSON.stringify(seed));
  }
  const { result } = renderHook(() => useAdRewards(props));
  // Let the initial localStorage read land (so a seeded meter is visible).
  for (let i = 0; i < 20; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
  return result;
}

const today = () => getLocalDayKey(Date.now());
const seeded = (p: Partial<AdRewardsState>): AdRewardsState => ({
  dayKey: today(),
  rollsUsed: 0,
  rewardsToday: 0,
  savesUsed: 0,
  ...p,
});

async function claim(result: { current: AdRewards }, kind: AdKind) {
  await act(async () => {
    result.current.claim(kind);
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useAdRewards — availability", () => {
  it("mirrors provider availability into the UI flags", async () => {
    const provider: AdProvider = {
      id: "noop",
      isAvailable: () => false,
      showRewarded: jest.fn().mockResolvedValue("error"),
    };
    const result = await renderAdRewards(makeProps({ provider }));
    expect(result.current.available).toBe(false);
    expect(result.current.canClaimGemRolls).toBe(false);
    expect(result.current.canClaimComboSave).toBe(false);
    expect(result.current.canClaimOfflineDouble).toBe(false);
    expect(result.current.canClaimOfflineTopUp).toBe(false);
  });

  it("exposes the full per-day budget on a fresh day", async () => {
    const result = await renderAdRewards(makeProps());
    expect(result.current.available).toBe(true);
    expect(result.current.gemRollsLeft).toBe(AD_GEM_ROLLS_PER_DAY);
    expect(result.current.comboSavesLeft).toBe(AD_COMBO_SAVES_PER_DAY);
    expect(result.current.dailyCapLeft).toBe(AD_MAX_REWARDS_PER_DAY);
    expect(result.current.canClaimGemRolls).toBe(true);
  });
});

describe("useAdRewards — claim lifecycle", () => {
  it("gemRolls: completed ad grants the rolled gems and meters the day", async () => {
    const provider = makeProvider("rewarded");
    const grantGems = jest.fn();
    const displayMessage = jest.fn();
    const onAdView = jest.fn();
    const result = await renderAdRewards(
      makeProps({ provider, grantGems, displayMessage, onAdView }),
    );
    await claim(result, "gemRolls");
    expect(provider.showRewarded).toHaveBeenCalledWith("gemRolls");
    expect(onAdView).toHaveBeenCalledWith("gemRolls");
    expect(grantGems).toHaveBeenCalledTimes(1);
    expect(grantGems).toHaveBeenCalledWith(AD_GEM_ROLLS_PER_USE);
    expect(displayMessage).toHaveBeenCalled();
    expect(result.current.claiming).toBeNull();
    expect(result.current.gemRollsLeft).toBe(AD_GEM_ROLLS_PER_DAY - 1);
    expect(result.current.dailyCapLeft).toBe(AD_MAX_REWARDS_PER_DAY - 1);
    // The meter persisted for the next session.
    const stored = JSON.parse(
      mockStore.get("adRewards") ?? "{}",
    ) as AdRewardsState;
    expect(stored.dayKey).toBe(today());
    expect(stored.rollsUsed).toBe(1);
    expect(stored.rewardsToday).toBe(1);
  });

  it("gemRolls: a bailed ad grants nothing and meters nothing", async () => {
    const provider = makeProvider("closed");
    const grantGems = jest.fn();
    const displayMessage = jest.fn();
    const result = await renderAdRewards(
      makeProps({ provider, grantGems, displayMessage }),
    );
    await claim(result, "gemRolls");
    expect(grantGems).not.toHaveBeenCalled();
    expect(result.current.gemRollsLeft).toBe(AD_GEM_ROLLS_PER_DAY);
    expect(result.current.dailyCapLeft).toBe(AD_MAX_REWARDS_PER_DAY);
    expect(displayMessage).toHaveBeenCalled(); // "closed early" toast
  });

  it("gemRolls: an errored ad grants nothing and stays silent", async () => {
    const provider = makeProvider("error");
    const grantGems = jest.fn();
    const displayMessage = jest.fn();
    const result = await renderAdRewards(
      makeProps({ provider, grantGems, displayMessage }),
    );
    await claim(result, "gemRolls");
    expect(grantGems).not.toHaveBeenCalled();
    expect(displayMessage).not.toHaveBeenCalled();
  });

  it("offlineDouble: claims the pending haul exactly once through the engine", async () => {
    const provider = makeProvider("rewarded");
    const claimOfflineDouble = jest.fn();
    const result = await renderAdRewards(
      makeProps({ provider, offlineDouble: 7n, claimOfflineDouble }),
    );
    expect(result.current.canClaimOfflineDouble).toBe(true);
    await claim(result, "offlineDouble");
    expect(claimOfflineDouble).toHaveBeenCalledTimes(1);
    expect(result.current.dailyCapLeft).toBe(AD_MAX_REWARDS_PER_DAY - 1);
  });

  it("offlineDouble: no pending haul → claim is a no-op, provider untouched", async () => {
    const provider = makeProvider("rewarded");
    const claimOfflineDouble = jest.fn();
    const result = await renderAdRewards(
      makeProps({ provider, offlineDouble: null, claimOfflineDouble }),
    );
    expect(result.current.canClaimOfflineDouble).toBe(false);
    await claim(result, "offlineDouble");
    expect(provider.showRewarded).not.toHaveBeenCalled();
    expect(claimOfflineDouble).not.toHaveBeenCalled();
  });

  it("offlineTopUp: claims the withheld haul through the engine", async () => {
    const provider = makeProvider("rewarded");
    const claimOfflineTopUp = jest.fn();
    const result = await renderAdRewards(
      makeProps({ provider, offlineTopUp: 3n, claimOfflineTopUp }),
    );
    expect(result.current.canClaimOfflineTopUp).toBe(true);
    await claim(result, "offlineTopUp");
    expect(claimOfflineTopUp).toHaveBeenCalledTimes(1);
  });

  it("comboSave: restores the lost combo once per day, then gates off", async () => {
    const provider = makeProvider("rewarded");
    const claimComboSave = jest.fn();
    const result = await renderAdRewards(
      makeProps({ provider, comboSave: 25, claimComboSave }),
    );
    expect(result.current.canClaimComboSave).toBe(true);
    await claim(result, "comboSave");
    expect(claimComboSave).toHaveBeenCalledTimes(1);
    expect(result.current.comboSavesLeft).toBe(AD_COMBO_SAVES_PER_DAY - 1);
    expect(result.current.canClaimComboSave).toBe(false);
    // A second same-day attempt never reaches the provider.
    const callsBefore = (provider.showRewarded as jest.Mock).mock.calls.length;
    await claim(result, "comboSave");
    expect(provider.showRewarded).toHaveBeenCalledTimes(callsBefore);
  });

  it("comboSave: no recent loss → claim is a no-op", async () => {
    const provider = makeProvider("rewarded");
    const claimComboSave = jest.fn();
    const result = await renderAdRewards(
      makeProps({ provider, comboSave: null, claimComboSave }),
    );
    expect(result.current.canClaimComboSave).toBe(false);
    await claim(result, "comboSave");
    expect(provider.showRewarded).not.toHaveBeenCalled();
    expect(claimComboSave).not.toHaveBeenCalled();
  });
});

describe("useAdRewards — daily caps", () => {
  it("gemRolls: the per-kind allowance gates after N rolls", async () => {
    const provider = makeProvider();
    const result = await renderAdRewards(
      makeProps({ provider }),
      seeded({
        rollsUsed: AD_GEM_ROLLS_PER_DAY,
        rewardsToday: AD_GEM_ROLLS_PER_DAY,
      }),
    );
    expect(result.current.gemRollsLeft).toBe(0);
    expect(result.current.canClaimGemRolls).toBe(false);
    await claim(result, "gemRolls");
    expect(provider.showRewarded).not.toHaveBeenCalled();
  });

  it("the total fraud cap gates every kind once spent", async () => {
    const provider = makeProvider();
    const result = await renderAdRewards(
      makeProps({ provider }),
      seeded({ rewardsToday: AD_MAX_REWARDS_PER_DAY }),
    );
    expect(result.current.dailyCapLeft).toBe(0);
    expect(result.current.canClaimGemRolls).toBe(false);
    expect(result.current.canClaimComboSave).toBe(false);
    expect(result.current.canClaimOfflineDouble).toBe(false);
    expect(result.current.canClaimOfflineTopUp).toBe(false);
    await claim(result, "gemRolls");
    expect(provider.showRewarded).not.toHaveBeenCalled();
  });

  it("counters reset at the local midnight (stale dayKey reads as fresh)", async () => {
    const result = await renderAdRewards(makeProps(), {
      dayKey: "2000-01-01",
      rollsUsed: AD_GEM_ROLLS_PER_DAY,
      rewardsToday: AD_MAX_REWARDS_PER_DAY,
      savesUsed: AD_COMBO_SAVES_PER_DAY,
    });
    expect(result.current.gemRollsLeft).toBe(AD_GEM_ROLLS_PER_DAY);
    expect(result.current.dailyCapLeft).toBe(AD_MAX_REWARDS_PER_DAY);
    expect(result.current.canClaimGemRolls).toBe(true);
  });

  it("only one ad plays at a time (double-tap guard)", async () => {
    let resolveAd!: (r: AdResult) => void;
    const provider: AdProvider = {
      id: "slow",
      isAvailable: () => true,
      showRewarded: jest.fn(
        () =>
          new Promise<AdResult>((resolve) => {
            resolveAd = resolve;
          }),
      ),
    };
    const result = await renderAdRewards(makeProps({ provider }));
    act(() => {
      result.current.claim("gemRolls");
    });
    // Second tap while the first ad is still playing: swallowed.
    act(() => {
      result.current.claim("gemRolls");
    });
    expect(result.current.claiming).toBe("gemRolls");
    await act(async () => {
      resolveAd("rewarded");
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(provider.showRewarded).toHaveBeenCalledTimes(1);
    expect(result.current.claiming).toBeNull();
  });
});
