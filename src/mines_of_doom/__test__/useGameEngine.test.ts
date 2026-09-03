/**
 * Hook-level tests for the core gameplay loop (useGameEngine): load/save,
 * tap and answer rewards, every purchase line, prestige, offline offers and
 * save codes. The pure formulas live in game.test.ts — these tests pin the
 * glue: that player actions routed through the hook land in state (and
 * storage) the way the loop requires.
 */
import { act, renderHook } from "@testing-library/react-native";
import { useGameEngine } from "../hooks/useGameEngine";
import {
  SaveData,
  createEmptySaveData,
  serializeSaveData,
  saveDataKey,
  getMineralsPerSec,
  getClickUpgradeCost,
  getMinerUpgradeCost,
  getFastMinerCost,
  getLegendaryMinerCost,
  getMinerPowerUpgradeCost,
  getGemChanceCost,
  getClickBoostCost,
  getComboResistCost,
  gemMineralCost,
  computeOfflineMinerals,
  computeOfflineTopUpMinerals,
} from "../game";
import { getTierBonus } from "../goals";
import { getAchievementBonus } from "../achievements";

/**
 * In-memory AsyncStorage. The map lives INSIDE the jest.mock factory
 * (the factory is hoisted and runs before any module-scope initializer,
 * so capturing an out-of-scope `const` Map would read it uninitialed) and
 * is exposed on the mock module so tests can seed/inspect it.
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

/** Render the engine and wait until the stored save has loaded.
 *  Pass `rawSave` to seed an arbitrary (e.g. corrupt) stored string. */
async function renderEngine(
  overrides?: Partial<SaveData>,
  saveTime?: number | string,
) {
  mockStore.clear();
  const displayMessage = jest.fn();
  if (typeof saveTime === "string") {
    mockStore.set(saveDataKey, saveTime); // rawSave pass-through
    return doRender(displayMessage);
  }
  if (overrides) {
    const base = createEmptySaveData();
    const save: SaveData = {
      ...base,
      ...overrides,
      saveTime: saveTime ?? Date.now(),
    };
    mockStore.set(saveDataKey, serializeSaveData(save));
  }
  return doRender(displayMessage);
}

async function doRender(displayMessage: jest.Mock) {
  const { result } = renderHook(() => useGameEngine(displayMessage));
  for (let i = 0; i < 20 && !result.current.isLoaded; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
  expect(result.current.isLoaded).toBe(true);
  return { result, displayMessage };
}

describe("useGameEngine — load & save", () => {
  it("starts empty when no save exists and flags itself loaded", async () => {
    const { result, displayMessage } = await renderEngine();
    expect(result.current.gameState.minerals).toBe(0n);
    expect(result.current.offlineDouble).toBeNull();
    expect(result.current.offlineTopUp).toBeNull();
    expect(displayMessage).not.toHaveBeenCalled();
  });

  it("restores a stored save and pays offline earnings on load", async () => {
    const saveTime = Date.now() - 2 * 60 * 60 * 1000; // 2h away, under the 8h cap
    const { result, displayMessage } = await renderEngine(
      { miners: 1, minerPower: 1, minerals: 1000n, lifetimeMinerals: 5000n },
      saveTime,
    );
    const offline = computeOfflineMinerals(1, 1, 0, saveTime, Date.now(), 1, 0);
    expect(offline).toBeGreaterThan(0n);
    // The base haul was paid at load and the welcome-back toast fired.
    expect(result.current.gameState.minerals).toBe(1000n + offline);
    expect(displayMessage).toHaveBeenCalled();
    // The "watch to double" offer holds the extra haul for a rewarded ad.
    expect(result.current.offlineDouble).toBe(offline);
  });

  it("holds the minerals beyond the 8h cap as a top-up offer", async () => {
    const saveTime = Date.now() - 10 * 60 * 60 * 1000; // 10h away: capped
    const { result } = await renderEngine(
      { miners: 1, minerPower: 1 },
      saveTime,
    );
    const base = computeOfflineMinerals(1, 1, 0, saveTime, Date.now(), 1, 0);
    const topUp = computeOfflineTopUpMinerals(1, 1, 0, saveTime, Date.now(), 1, 0);
    expect(topUp).toBeGreaterThan(0n);
    expect(result.current.gameState.minerals).toBe(base);
    expect(result.current.offlineDouble).toBe(base);
    expect(result.current.offlineTopUp).toBe(topUp);
  });

  it("survives a corrupt stored save by starting fresh", async () => {
    const { result, displayMessage } = await renderEngine(undefined, "{not json!!");
    expect(result.current.gameState.minerals).toBe(0n);
    // The corrupt raw data is backed up, not destroyed.
    expect(mockStore.get(saveDataKey + ".corrupt")).toBe("{not json!!");
    expect(displayMessage).not.toHaveBeenCalled();
    // The load failure is flagged so the cloud-save recovery path can
    // offer the last backup (see useCloudSave).
    expect(result.current.saveLoadFailed).toBe(true);
  });

  it("does not flag a load failure for a missing or a valid stored save", async () => {
    const fresh = await renderEngine();
    expect(fresh.result.current.saveLoadFailed).toBe(false);
    const valid = await renderEngine({ minerals: 7n });
    expect(valid.result.current.saveLoadFailed).toBe(false);
  });

  it("saves the current state to storage and clears the dirty flag", async () => {
    const { result } = await renderEngine();
    await act(async () => {
      result.current.addTapGain(5n);
      await Promise.resolve();
    });
    expect(result.current.saveDirty).toBe(true);
    await act(async () => {
      result.current.saveGame();
      await Promise.resolve();
      await Promise.resolve();
    });
    const raw = mockStore.get(saveDataKey);
    expect(raw).toBeDefined();
    const saved = JSON.parse(raw!) as { minerals: string; saveTime: number };
    expect(saved.minerals).toBe("5");
    expect(saved.saveTime).toBeGreaterThan(0);
    expect(result.current.saveDirty).toBe(false);
  });

  it("resetGame wipes the run and clears the stored save", async () => {
    const { result } = await renderEngine();
    await act(async () => {
      result.current.addTapGain(100n);
      await Promise.resolve();
    });
    await act(async () => {
      result.current.resetGame();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.gameState.minerals).toBe(0n);
    expect(mockStore.get(saveDataKey)).toBeUndefined();
  });
});

describe("useGameEngine — earning", () => {
  it("addTapGain adds minerals and lifetime earnings", async () => {
    const { result } = await renderEngine();
    await act(async () => {
      result.current.addTapGain(7n);
      await Promise.resolve();
    });
    const s = result.current.gameState;
    expect(s.minerals).toBe(7n);
    expect(s.lifetimeMinerals).toBe(7n);
  });

  it("applyAnswerReward pays value × click power × combo and updates the combo", async () => {
    const { result } = await renderEngine();
    const random = jest
      .spyOn(Math, "random")
      .mockReturnValue(0.99); // no gem roll
    let gem = false;
    await act(async () => {
      gem = result.current.applyAnswerReward(10, 3, 3);
      await Promise.resolve();
    });
    random.mockRestore();
    expect(gem).toBe(false);
    const s = result.current.gameState;
    expect(s.minerals).toBe(30n); // 10 × 1 clickPower × 3 combo
    expect(s.lifetimeMinerals).toBe(30n);
    expect(s.lifetimeCorrect).toBe(1);
    expect(s.maxCombo).toBe(3);
  });

  it("applyAnswerReward mints a gem on a successful roll", async () => {
    const { result } = await renderEngine({ minerals: 0n });
    const random = jest.spyOn(Math, "random").mockReturnValue(0);
    let gem = false;
    await act(async () => {
      gem = result.current.applyAnswerReward(5, 1, 1);
      await Promise.resolve();
    });
    random.mockRestore();
    expect(gem).toBe(true);
    expect(result.current.gameState.gems).toBe(1);
  });

  it("grantGems mints gems outside the mineral economy (ad gem rolls)", async () => {
    const { result } = await renderEngine();
    await act(async () => {
      result.current.grantGems(5);
      await Promise.resolve();
    });
    expect(result.current.gameState.gems).toBe(5);
    expect(result.current.gameState.totalGemsMinted).toBe(5);
    expect(result.current.gameState.minerals).toBe(0n);
  });

  it("pays passive income per tick while miners run", async () => {
    const { result } = await renderEngine({
      miners: 2,
      minerPower: 1,
      minerals: 0n,
    });
    const before = result.current.gameState.minerals;
    // 2.2s of real time = ≥2 whole ticks; income is ≥2 ticks × 2/sec.
    await new Promise((r) => setTimeout(r, 2200));
    await act(async () => {});
    const gained = result.current.gameState.minerals - before;
    const perTick = getMineralsPerSec(2, 1, 0, 0);
    expect(gained).toBeGreaterThanOrEqual(BigInt(2 * perTick));
  }, 15000);
});

describe("useGameEngine — spending", () => {
  it("upgradePower spends minerals and raises click power", async () => {
    const cost = getClickUpgradeCost(1);
    const { result } = await renderEngine({ minerals: BigInt(cost) });
    await act(async () => {
      result.current.upgradePower();
      await Promise.resolve();
    });
    expect(result.current.gameState.clickPower).toBe(2);
    expect(result.current.gameState.minerals).toBe(0n);
  });

  it("buyMiner spends gems and records ownership", async () => {
    const cost = getMinerUpgradeCost(0);
    const { result } = await renderEngine({ gems: cost });
    await act(async () => {
      result.current.buyMiner();
      await Promise.resolve();
    });
    const s = result.current.gameState;
    expect(s.miners).toBe(1);
    expect(s.gems).toBe(0);
    expect(s.minersOwnedEver).toBe(1);
    expect(s.totalGemsSpent).toBe(cost);
  });

  it("buyFastMiner / buyLegendaryMiner are affordability-guarded", async () => {
    const { result } = await renderEngine({ gems: 0 });
    await act(async () => {
      result.current.buyFastMiner();
      result.current.buyLegendaryMiner();
      await Promise.resolve();
    });
    expect(result.current.gameState.fastMiners).toBe(0);
    expect(result.current.gameState.legendaryMiners).toBe(0);

    const fc = getFastMinerCost(0);
    const lc = getLegendaryMinerCost(0);
    await act(async () => {
      result.current.grantGems(fc + lc);
      await Promise.resolve();
    });
    await act(async () => {
      result.current.buyFastMiner();
      result.current.buyLegendaryMiner();
      await Promise.resolve();
    });
    const s = result.current.gameState;
    expect(s.fastMiners).toBe(1);
    expect(s.legendaryMiners).toBe(1);
    expect(s.gems).toBe(0);
    expect(s.totalGemsSpent).toBe(fc + lc);
  });

  it("buyGem swaps minerals for gems at the flat rate", async () => {
    const { result } = await renderEngine({ minerals: BigInt(gemMineralCost) });
    await act(async () => {
      result.current.buyGem();
      await Promise.resolve();
    });
    expect(result.current.gameState.gems).toBe(1);
    expect(result.current.gameState.minerals).toBe(0n);
    expect(result.current.gameState.totalGemsMinted).toBe(1);
  });

  it("the gem upgrade lines spend gems at their curves and cap", async () => {
    const { result } = await renderEngine();
    const gc = getGemChanceCost(0);
    const cb = getClickBoostCost(0);
    const cr = getComboResistCost(0);
    await act(async () => {
      result.current.grantGems(gc + cb + cr);
      await Promise.resolve();
    });
    await act(async () => {
      result.current.buyGemChance();
      result.current.buyClickBoost();
      result.current.buyComboResist();
      await Promise.resolve();
    });
    const s = result.current.gameState;
    expect(s.gemChanceLevels).toBe(1);
    expect(s.clickBoostLevels).toBe(1);
    expect(s.comboResistLevels).toBe(1);
    expect(s.gems).toBe(0);
    expect(s.totalGemsSpent).toBe(gc + cb + cr);
  });

  it("upgradeMinerPower spends minerals and is affordability-guarded", async () => {
    const { result } = await renderEngine({ minerals: 0n });
    await act(async () => {
      result.current.upgradeMinerPower();
      await Promise.resolve();
    });
    expect(result.current.gameState.minerPower).toBe(1); // no-op: can't afford
    const cost = getMinerPowerUpgradeCost(1);
    await act(async () => {
      result.current.addTapGain(BigInt(cost));
      await Promise.resolve();
    });
    await act(async () => {
      result.current.upgradeMinerPower();
      await Promise.resolve();
    });
    expect(result.current.gameState.minerPower).toBe(2);
    expect(result.current.gameState.minerals).toBe(0n);
  });

  it("completeTiers / completeAchievements pay one-time bonuses and are idempotent", async () => {
    const { result } = await renderEngine();
    const tierBonus = getTierBonus(["t1"]);
    const achBonus = getAchievementBonus(["miner-1"]);
    await act(async () => {
      result.current.completeTiers(["t1"]);
      result.current.completeAchievements(["miner-1"]);
      await Promise.resolve();
    });
    let s = result.current.gameState;
    expect(s.minerals).toBe(BigInt(tierBonus + achBonus));
    expect(s.completedTiers).toEqual(["t1"]);
    expect(s.completedAchievements).toEqual(["miner-1"]);
    // Second grant of the same ids: no double pay (dev's double-fired updater).
    await act(async () => {
      result.current.completeTiers(["t1"]);
      result.current.completeAchievements(["miner-1"]);
      await Promise.resolve();
    });
    s = result.current.gameState;
    expect(s.minerals).toBe(BigInt(tierBonus + achBonus));
    expect(s.completedTiers).toEqual(["t1"]);
  });

  it("buyCosmetic / selectCosmetic spend gems and auto-select", async () => {
    const { result } = await renderEngine({ gems: 15 });
    await act(async () => {
      result.current.buyCosmetic("night"); // 15-gem outfit
      await Promise.resolve();
    });
    let s = result.current.gameState;
    expect(s.ownedCosmetics).toContain("night");
    expect(s.selectedOutfit).toBe("night");
    expect(s.gems).toBe(0);
    // Unknown ids are no-ops.
    await act(async () => {
      result.current.buyCosmetic("not-a-cosmetic");
      await Promise.resolve();
    });
    expect(result.current.gameState.gems).toBe(0);
    // Re-buying an owned cosmetic is a no-op.
    await act(async () => {
      result.current.buyCosmetic("night");
      await Promise.resolve();
    });
    s = result.current.gameState;
    expect(s.ownedCosmetics.filter((id) => id === "night")).toHaveLength(1);
    // Selecting back to the default works.
    await act(async () => {
      result.current.selectCosmetic("classic");
      await Promise.resolve();
    });
    expect(result.current.gameState.selectedOutfit).toBe("classic");
  });

  it("buyCaveTheme / selectCaveTheme spend gems and auto-select", async () => {
    const { result } = await renderEngine({ gems: 25 });
    await act(async () => {
      result.current.buyCaveTheme("amethyst"); // 25-gem theme
      await Promise.resolve();
    });
    const s = result.current.gameState;
    expect(s.ownedCaveThemes).toContain("amethyst");
    expect(s.selectedCaveTheme).toBe("amethyst");
    expect(s.gems).toBe(0);
    await act(async () => {
      result.current.selectCaveTheme("natural");
      await Promise.resolve();
    });
    expect(result.current.gameState.selectedCaveTheme).toBe("natural");
  });

  it("grantIapCosmetics grants store purchases for free and is idempotent", async () => {
    const { result } = await renderEngine({ gems: 0 });
    await act(async () => {
      result.current.grantIapCosmetics(["night"], ["amethyst"]);
      await Promise.resolve();
    });
    let s = result.current.gameState;
    expect(s.ownedCosmetics).toContain("night");
    expect(s.ownedCaveThemes).toContain("amethyst");
    expect(s.gems).toBe(0); // no gem cost
    await act(async () => {
      result.current.grantIapCosmetics(["night"], ["amethyst"]);
      await Promise.resolve();
    });
    s = result.current.gameState;
    expect(s.ownedCosmetics.filter((id) => id === "night")).toHaveLength(1);
    expect(s.ownedCaveThemes.filter((id) => id === "amethyst")).toHaveLength(1);
  });
});

describe("useGameEngine — prestige & offline offers", () => {
  const PRESTIGE_SAVE: Partial<SaveData> = {
    lifetimeMinerals: 6_000_000n, // ≥ 5M: prestige level 1 is available
    minerals: 999999n,
    miners: 3,
    fastMiners: 1,
    legendaryMiners: 1,
    clickPower: 4,
    minerPower: 2,
    gems: 5,
  };

  it("sinkNewShaft banks the multiplier and resets the run (gems survive)", async () => {
    const { result } = await renderEngine(PRESTIGE_SAVE);
    await act(async () => {
      result.current.sinkNewShaft();
      await Promise.resolve();
    });
    const s = result.current.gameState;
    expect(s.prestigeLevel).toBe(1);
    expect(s.totalPrestiges).toBe(1);
    expect(s.minerals).toBe(0n);
    expect(s.miners).toBe(0);
    expect(s.fastMiners).toBe(0);
    expect(s.legendaryMiners).toBe(0);
    expect(s.clickPower).toBe(1);
    expect(s.minerPower).toBe(1);
    expect(s.gems).toBe(5);
    expect(s.lifetimeMinerals).toBe(6_000_000n);
  });

  it("sinkNewShaft is a no-op when there's nothing new to bank", async () => {
    const { result } = await renderEngine({
      ...PRESTIGE_SAVE,
      prestigeLevel: 1,
    });
    await act(async () => {
      result.current.sinkNewShaft();
      await Promise.resolve();
    });
    const s = result.current.gameState;
    expect(s.totalPrestiges).toBe(0);
    expect(s.minerals).toBe(999999n); // run untouched
  });

  it("claimOfflineDouble / claimOfflineTopUp pay the pending offers once", async () => {
    const saveTime = Date.now() - 10 * 60 * 60 * 1000;
    const { result } = await renderEngine({ miners: 1 }, saveTime);
    const offer = result.current.offlineDouble;
    const topUp = result.current.offlineTopUp;
    expect(offer).not.toBeNull();
    expect(topUp).not.toBeNull();
    const base = result.current.gameState.minerals;
    await act(async () => {
      result.current.claimOfflineDouble();
      result.current.claimOfflineTopUp();
      await Promise.resolve();
    });
    const s = result.current.gameState;
    expect(s.minerals).toBe(base + (offer ?? 0n) + (topUp ?? 0n));
    expect(s.lifetimeMinerals).toBe(
      result.current.gameState.lifetimeMinerals,
    );
    expect(result.current.offlineDouble).toBeNull();
    expect(result.current.offlineTopUp).toBeNull();
    // Claiming again pays nothing.
    await act(async () => {
      result.current.claimOfflineDouble();
      result.current.claimOfflineTopUp();
      await Promise.resolve();
    });
    expect(result.current.gameState.minerals).toBe(s.minerals);
  });
});

describe("useGameEngine — cloud restore", () => {
  it("restoreFromBlob imports a valid blob and pays its offline earnings", async () => {
    const saveTime = Date.now() - 2 * 60 * 60 * 1000; // 2h away, under the cap
    const { result } = await renderEngine();
    const blob = serializeSaveData({
      ...createEmptySaveData(),
      miners: 1,
      minerPower: 1,
      minerals: 1000n,
      lifetimeMinerals: 5000n,
      saveTime,
    });
    let ok = false;
    await act(async () => {
      ok = result.current.restoreFromBlob(blob);
      await Promise.resolve();
    });
    expect(ok).toBe(true);
    const offline = computeOfflineMinerals(1, 1, 0, saveTime, Date.now(), 1, 0);
    expect(offline).toBeGreaterThan(0n);
    expect(result.current.gameState.minerals).toBe(1000n + offline);
    expect(result.current.gameState.lifetimeMinerals).toBe(5000n + offline);
  });

  it("restoreFromBlob rejects garbage (no state change)", async () => {
    const { result } = await renderEngine();
    await act(async () => {
      result.current.addTapGain(3n);
      await Promise.resolve();
    });
    for (const blob of ["!!!not json!!!", "[1,2,3]", "\"a string\""] as const) {
      let ok = true;
      await act(async () => {
        ok = result.current.restoreFromBlob(blob as string);
        await Promise.resolve();
      });
      expect(ok).toBe(false);
    }
    expect(result.current.gameState.minerals).toBe(3n);
  });
});

describe("useGameEngine — save codes", () => {
  it("exportSaveCode round-trips through importSaveCode", async () => {
    const { result } = await renderEngine({
      minerals: 42n,
      lifetimeMinerals: 42n,
      clickPower: 3,
    });
    const code = result.current.exportSaveCode();
    expect(typeof code).toBe("string");
    expect(code.length).toBeGreaterThan(0);
    let ok = false;
    await act(async () => {
      ok = result.current.importSaveCode(code);
      await Promise.resolve();
    });
    expect(ok).toBe(true);
    expect(result.current.gameState.minerals).toBe(42n);
    expect(result.current.gameState.clickPower).toBe(3);
  });

  it("importSaveCode rejects garbage", async () => {
    const { result } = await renderEngine();
    let ok = true;
    await act(async () => {
      ok = result.current.importSaveCode("!!!not-a-save-code!!!");
      await Promise.resolve();
    });
    expect(ok).toBe(false);
  });
});
