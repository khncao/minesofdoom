/**
 * Engine-wiring tests for cloud saves (useCloudSave.ts): the push cadence
 * (5-minute gate, prestige bypass, toggle), the last-sync status line,
 * the "stale → refresh local" contract, launch recovery (failed local
 * load → pull → import → toast), the manual restore path, and the
 * formatAgo helper. Providers are scripted fakes — the real fetch
 * round-trips are pinned in cloudSave.test.ts.
 */
import { act, renderHook } from "@testing-library/react-native";
import type { CloudSaveOptions } from "../hooks/useCloudSave";
import {
  CLOUD_SAVE_PUSH_INTERVAL_MS,
  NEVER_SYNCED,
  formatAgo,
  useCloudSave,
} from "../hooks/useCloudSave";
import type { CloudSaveProvider, CloudSaveSnapshot } from "../cloudSave";

/** In-memory AsyncStorage (same pattern as useGameEngine.test.ts). */
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

// The toggle / last-sync live in AsyncStorage — every test starts from a
// clean slate so persisted state can't leak between cases.
beforeEach(() => {
  mockStore.clear();
});

const SNAPSHOT: CloudSaveSnapshot = {
  blob: '{"minerals":"5","saveVersion":10}',
  saveVersion: 10,
  updatedAt: 1_700_000_000_000,
};

type PushResult =
  | { status: "accepted"; updatedAt: number }
  | { status: "stale"; storedUpdatedAt: number }
  | { status: "error" };

function makeProvider(
  overrides: Partial<CloudSaveProvider> = {},
): CloudSaveProvider {
  return {
    id: "fake",
    isAvailable: () => true,
    push: jest.fn(async (s: CloudSaveSnapshot): Promise<PushResult> => ({
      status: "accepted",
      updatedAt: s.updatedAt,
    })),
    pull: jest.fn(async () => null),
    delete: jest.fn(async () => true),
    ...overrides,
  };
}

interface SetupOpts extends Partial<CloudSaveOptions> {
  provider?: CloudSaveProvider;
}

function setup(opts: SetupOpts = {}) {
  const provider = opts.provider ?? makeProvider();
  const getSnapshot =
    opts.getSnapshot ??
    (jest.fn(() => SNAPSHOT) as unknown as CloudSaveOptions["getSnapshot"]);
  const restore = opts.restore ?? jest.fn(() => true);
  const displayMessage =
    opts.displayMessage ?? (jest.fn() as CloudSaveOptions["displayMessage"]);
  const t = opts.t ?? ((key: unknown) => key as string);
  const options: CloudSaveOptions = {
    provider,
    getSnapshot,
    restore,
    isLoaded: true,
    saveLoadFailed: false,
    displayMessage,
    t,
  };
  const { result, rerender } = renderHook(
    (o: CloudSaveOptions) => useCloudSave(o),
    { initialProps: options },
  );
  // `withOpts` builds a FULL options object for rerenders (the hook reads
  // the whole options object, so rerenders must not drop fields).
  const withOpts: (over: Partial<CloudSaveOptions>) => CloudSaveOptions = (
    over,
  ) => ({ ...options, ...over });
  return { result, rerender, provider, getSnapshot, restore, displayMessage, withOpts };
}

/** Flush microtasks (the fake provider's promises resolve on them). */
const flush = () => act(async () => {});

describe("useCloudSave — push cadence", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(1_700_000_000_000));
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("the first autosave push goes out; the 5-minute gate holds until it expires", async () => {
    const { result, provider } = setup();
    await flush();
    act(() => result.current.requestPush("autosave"));
    await flush();
    expect(provider.push).toHaveBeenCalledTimes(1);
    expect((provider.push as jest.Mock).mock.calls[0][0]).toEqual(SNAPSHOT);
    // Immediately again: gated.
    act(() => result.current.requestPush("autosave"));
    await flush();
    expect(provider.push).toHaveBeenCalledTimes(1);
    // Just short of the cadence: still gated.
    jest.advanceTimersByTime(CLOUD_SAVE_PUSH_INTERVAL_MS - 1_000);
    act(() => result.current.requestPush("autosave"));
    await flush();
    expect(provider.push).toHaveBeenCalledTimes(1);
    // Past the cadence: goes out.
    jest.advanceTimersByTime(2_000);
    act(() => result.current.requestPush("autosave"));
    await flush();
    expect(provider.push).toHaveBeenCalledTimes(2);
  });

  it("a prestige push bypasses the cadence (the run boundary)", async () => {
    const { result, provider } = setup();
    await flush();
    act(() => result.current.requestPush("autosave"));
    await flush();
    act(() => result.current.requestPush("prestige"));
    await flush();
    expect(provider.push).toHaveBeenCalledTimes(2);
  });

  it("the toggle off stops all pushes (and persists)", async () => {
    const { result, provider } = setup();
    await flush();
    act(() => result.current.setEnabled(false));
    await flush();
    act(() => result.current.requestPush("autosave"));
    act(() => result.current.requestPush("prestige"));
    await flush();
    expect(provider.push).not.toHaveBeenCalled();
    expect(mockStore.get("cloudSaveEnabled")).toBe("false");
  });

  it("an unavailable provider is inert", async () => {
    const provider = makeProvider({ isAvailable: () => false });
    const { result, provider: used } = setup({ provider });
    await flush();
    expect(result.current.available).toBe(false);
    act(() => result.current.requestPush("prestige"));
    await flush();
    expect(used.push).not.toHaveBeenCalled();
  });
});

describe("useCloudSave — last-sync status", () => {
  it("starts 'never' and records 'ok' with the push time on success", async () => {
    const { result } = setup();
    await flush();
    expect(result.current.lastSync).toEqual(NEVER_SYNCED);
    jest.useFakeTimers();
    jest.setSystemTime(new Date(1_700_000_000_000));
    act(() => result.current.requestPush("autosave"));
    await flush();
    jest.useRealTimers();
    expect(result.current.lastSync).toEqual({
      state: "ok",
      at: 1_700_000_000_000,
    });
  });

  it("records 'failed' when the push errors (a retry is expected, silently)", async () => {
    const provider = makeProvider({
      push: jest.fn(async () => ({ status: "error" as const })),
    });
    const { result } = setup({ provider });
    await flush();
    act(() => result.current.requestPush("autosave"));
    await flush();
    expect(result.current.lastSync.state).toBe("failed");
  });

  it("a stale push refreshes the local view from the stored snapshot", async () => {
    const stored: CloudSaveSnapshot = {
      blob: '{"minerals":"9"}',
      saveVersion: 10,
      updatedAt: 1_700_000_000_999,
    };
    const provider = makeProvider({
      push: jest.fn(async () => ({
        status: "stale" as const,
        storedUpdatedAt: stored.updatedAt,
      })),
      pull: jest.fn(async () => stored),
    });
    const restore = jest.fn(() => true);
    const { result } = setup({ provider, restore });
    await flush();
    act(() => result.current.requestPush("autosave"));
    await flush();
    await flush();
    expect(restore).toHaveBeenCalledWith(stored.blob);
    expect(result.current.lastSync.state).toBe("ok");
  });
});

describe("useCloudSave — launch recovery", () => {
  const recovered: CloudSaveSnapshot = {
    blob: '{"minerals":"42","saveVersion":10}',
    saveVersion: 10,
    updatedAt: 1_699_999_000_000,
  };

  it("a failed local load pulls the cloud once and imports it, with a toast", async () => {
    const provider = makeProvider({
      pull: jest.fn(async () => recovered),
    });
    const restore = jest.fn(() => true);
    const displayMessage = jest.fn();
    const { rerender, withOpts } = setup({
      provider,
      restore,
      displayMessage,
      isLoaded: false,
      saveLoadFailed: false,
    });
    // Healthy-looking first frame: nothing happens.
    await flush();
    expect(provider.pull).not.toHaveBeenCalled();
    act(() => rerender(withOpts({ isLoaded: true, saveLoadFailed: true })));
    await flush();
    expect(provider.pull).toHaveBeenCalledTimes(1);
    expect(restore).toHaveBeenCalledWith(recovered.blob);
    expect(displayMessage).toHaveBeenCalledWith(
      "toast.cloudRestored",
      6000,
    );
    // Never pulls twice per launch.
    await flush();
    expect(provider.pull).toHaveBeenCalledTimes(1);
  });

  it("a healthy local load (or a fresh install) never pulls", async () => {
    const provider = makeProvider({
      pull: jest.fn(async () => recovered),
    });
    const { rerender, withOpts } = setup({ provider, isLoaded: false });
    act(() => rerender(withOpts({ isLoaded: true })));
    await flush();
    expect(provider.pull).not.toHaveBeenCalled();
  });

  it("a corrupt local save with NO cloud backup fails quietly (no toast)", async () => {
    const provider = makeProvider({ pull: jest.fn(async () => null) });
    const restore = jest.fn();
    const displayMessage = jest.fn();
    const { rerender, withOpts } = setup({
      provider,
      restore,
      displayMessage,
      isLoaded: false,
    });
    act(() => rerender(withOpts({ isLoaded: true, saveLoadFailed: true })));
    await flush();
    expect(restore).not.toHaveBeenCalled();
    expect(displayMessage).not.toHaveBeenCalled();
  });

  it("an unusable cloud blob is dropped (restore false → no toast)", async () => {
    const provider = makeProvider({
      pull: jest.fn(async () => recovered),
    });
    const restore = jest.fn(() => false);
    const displayMessage = jest.fn();
    const { rerender, withOpts } = setup({
      provider,
      restore,
      displayMessage,
      isLoaded: false,
    });
    act(() => rerender(withOpts({ isLoaded: true, saveLoadFailed: true })));
    await flush();
    expect(restore).toHaveBeenCalledWith(recovered.blob);
    expect(displayMessage).not.toHaveBeenCalled();
  });
});

describe("useCloudSave — manual restore", () => {
  const backup: CloudSaveSnapshot = {
    blob: '{"minerals":"7","saveVersion":10}',
    saveVersion: 10,
    updatedAt: 1_699_999_000_000,
  };

  it("imports the backup and toasts success", async () => {
    const provider = makeProvider({ pull: jest.fn(async () => backup) });
    const restore = jest.fn(() => true);
    const displayMessage = jest.fn();
    const { result } = setup({ provider, restore, displayMessage });
    await flush();
    await act(async () => {
      await result.current.restoreFromCloud();
    });
    expect(restore).toHaveBeenCalledWith(backup.blob);
    expect(displayMessage).toHaveBeenCalledWith("toast.cloudRestored", 6000);
  });

  it("no backup yet → the 'no backup' toast", async () => {
    const restore = jest.fn();
    const displayMessage = jest.fn();
    const { result } = setup({ restore, displayMessage });
    await flush();
    await act(async () => {
      await result.current.restoreFromCloud();
    });
    expect(restore).not.toHaveBeenCalled();
    expect(displayMessage).toHaveBeenCalledWith("toast.cloudNoBackup", 4000);
  });

  it("an unusable blob → the 'couldn't be read' toast", async () => {
    const provider = makeProvider({ pull: jest.fn(async () => backup) });
    const restore = jest.fn(() => false);
    const displayMessage = jest.fn();
    const { result } = setup({ provider, restore, displayMessage });
    await flush();
    await act(async () => {
      await result.current.restoreFromCloud();
    });
    expect(displayMessage).toHaveBeenCalledWith(
      "toast.cloudRestoreFailed",
      4000,
    );
  });
});

describe("formatAgo", () => {
  const now = 1_700_000_000_000;
  it("renders minute/hour/day buckets", () => {
    expect(formatAgo(now - 30_000, now)).toBe("just now");
    expect(formatAgo(now - 90_000, now)).toBe("1m ago");
    expect(formatAgo(now - 5 * 60_000, now)).toBe("5m ago");
    expect(formatAgo(now - 90 * 60_000, now)).toBe("1h ago");
    expect(formatAgo(now - 23 * 3_600_000, now)).toBe("23h ago");
    expect(formatAgo(now - 3 * 86_400_000, now)).toBe("3d ago");
  });
  it("never renders a negative span", () => {
    expect(formatAgo(now + 60_000, now)).toBe("just now");
  });
});
