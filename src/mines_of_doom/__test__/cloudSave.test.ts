/**
 * Provider-core tests for cloud saves (cloudSave.ts): the selection
 * matrix (dev/web/unconfigured/configured) and the store provider's
 * fetch round-trip against a scripted fetch — push accepted/stale/error,
 * pull present/absent/malformed, delete. The engine wiring (push cadence,
 * launch recovery, settings UI) is tested with the engine hooks.
 *
 * storeConfig is a plain const object, so the tests flip
 * `pocketbaseUrl` (and restore it) — same pattern as iapProvider.test.ts.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { storeConfig } from "../storeConfig";
import {
  CloudSaveProviderSelection,
  CloudSaveSnapshot,
  devSimCloudSaveProvider,
  noopCloudSaveProvider,
  pickCloudSaveProvider,
  storeCloudSaveProvider,
} from "../cloudSave";
import { IAP_DEVICE_ID_KEY } from "../iapDeviceId";

const BASE = "https://pb.example.test";
const DEVICE_ID = "abcdefgh234567890123456789";

const snapshot: CloudSaveSnapshot = {
  blob: '{"saveVersion":1,"minerals":123}',
  saveVersion: 1,
  updatedAt: 1_000,
};

/** Scripted fetch: resolves a JSON body or a non-2xx per call. */
const fetchMock = jest.fn();
const jsonResponse = (body: unknown, ok = true) => ({
  ok,
  json: async () => body,
});

async function seedDeviceId() {
  await AsyncStorage.setItem(IAP_DEVICE_ID_KEY, DEVICE_ID);
}

beforeEach(async () => {
  await AsyncStorage.clear();
  await seedDeviceId();
  storeConfig.pocketbaseUrl = BASE;
  fetchMock.mockReset();
  (global.fetch as unknown) = fetchMock;
});

afterEach(() => {
  storeConfig.pocketbaseUrl = "";
});

// -- selection ---------------------------------------------------------------

describe("pickCloudSaveProvider (selection matrix)", () => {
  const sel = (over: Partial<CloudSaveProviderSelection> = {}) => ({
    dev: false,
    web: false,
    pocketbaseConfigured: false,
    ...over,
  });

  it("dev always wins — the labeled in-memory simulation", () => {
    expect(
      pickCloudSaveProvider(sel({ dev: true, pocketbaseConfigured: true })),
    ).toBe(devSimCloudSaveProvider);
  });

  it("web is a no-op, even with the backend configured", () => {
    expect(pickCloudSaveProvider(sel({ web: true, pocketbaseConfigured: true })))
      .toBe(noopCloudSaveProvider);
  });

  it("native without the Pocketbase URL is a no-op (entry points hidden)", () => {
    expect(pickCloudSaveProvider(sel())).toBe(noopCloudSaveProvider);
  });

  it("native production with the URL gets the store provider", () => {
    expect(pickCloudSaveProvider(sel({ pocketbaseConfigured: true })))
      .toBe(storeCloudSaveProvider);
  });
});

// -- store provider: gating ----------------------------------------------------

describe("storeCloudSaveProvider (gating)", () => {
  it("is unavailable and inert while the URL is empty", async () => {
    storeConfig.pocketbaseUrl = "";
    expect(storeCloudSaveProvider.isAvailable()).toBe(false);
    await expect(storeCloudSaveProvider.push(snapshot)).resolves.toEqual({
      status: "error",
    });
    await expect(storeCloudSaveProvider.pull()).resolves.toBeNull();
    await expect(storeCloudSaveProvider.delete()).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is available once the URL is configured", () => {
    expect(storeCloudSaveProvider.isAvailable()).toBe(true);
  });
});

// -- store provider: push ------------------------------------------------------

describe("storeCloudSaveProvider.push", () => {
  it("sends the device id + snapshot and reports 'accepted' when the server keeps ours", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ updatedAt: snapshot.updatedAt }));
    await expect(storeCloudSaveProvider.push(snapshot)).resolves.toEqual({
      status: "accepted",
      updatedAt: snapshot.updatedAt,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/api/app/cloud/push`);
    expect(JSON.parse(init.body)).toEqual({
      deviceId: DEVICE_ID,
      blob: snapshot.blob,
      saveVersion: snapshot.saveVersion,
      updatedAt: snapshot.updatedAt,
    });
  });

  it("reports 'stale' when the server kept a NEWER snapshot", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ updatedAt: snapshot.updatedAt + 5 }));
    await expect(storeCloudSaveProvider.push(snapshot)).resolves.toEqual({
      status: "stale",
      storedUpdatedAt: snapshot.updatedAt + 5,
    });
  });

  it("treats a network failure as 'error' (never throws)", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    await expect(storeCloudSaveProvider.push(snapshot)).resolves.toEqual({
      status: "error",
    });
  });

  it("treats a non-2xx as 'error'", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, false));
    await expect(storeCloudSaveProvider.push(snapshot)).resolves.toEqual({
      status: "error",
    });
  });

  it("treats a malformed reply (no numeric updatedAt) as 'error'", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ updatedAt: "soon" }));
    await expect(storeCloudSaveProvider.push(snapshot)).resolves.toEqual({
      status: "error",
    });
  });
});

// -- store provider: pull ------------------------------------------------------

describe("storeCloudSaveProvider.pull", () => {
  it("returns the snapshot when the server has a backup", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ snapshot }));
    await expect(storeCloudSaveProvider.pull()).resolves.toEqual(snapshot);
    expect(JSON.parse((fetchMock.mock.calls[0][1].body as string))).toEqual({
      deviceId: DEVICE_ID,
    });
    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/api/app/cloud/pull`);
  });

  it("returns null when the server has no backup", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ snapshot: null }));
    await expect(storeCloudSaveProvider.pull()).resolves.toBeNull();
  });

  it("returns null on a network failure", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    await expect(storeCloudSaveProvider.pull()).resolves.toBeNull();
  });

  it("rejects a malformed snapshot row (garbage must not reach the restore path)", async () => {
    const bad: unknown[] = [
      undefined, // no snapshot field at all
      { snapshot: { blob: 42, saveVersion: 1, updatedAt: 1 } }, // blob not a string
      { snapshot: { blob: "", saveVersion: 1, updatedAt: 1 } }, // empty blob
      { snapshot: { blob: "x", saveVersion: 1.5, updatedAt: 1 } }, // non-integer version
      { snapshot: { blob: "x", saveVersion: -1, updatedAt: 1 } }, // negative version
      { snapshot: { blob: "x", saveVersion: 1, updatedAt: NaN } }, // non-finite time
      { snapshot: "a-string" },
    ];
    for (const body of bad) {
      fetchMock.mockReset();
      fetchMock.mockResolvedValue(jsonResponse(body));
      await expect(storeCloudSaveProvider.pull()).resolves.toBeNull();
    }
  });
});

// -- store provider: delete ------------------------------------------------------

describe("storeCloudSaveProvider.delete", () => {
  it("posts the device id to /api/app/delete and reports the ok flag", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    await expect(storeCloudSaveProvider.delete()).resolves.toBe(true);
    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/api/app/delete`);
    expect(JSON.parse((fetchMock.mock.calls[0][1].body as string))).toEqual({
      deviceId: DEVICE_ID,
    });
  });

  it("reports false on failure (network, non-2xx, or a non-ok reply)", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    await expect(storeCloudSaveProvider.delete()).resolves.toBe(false);
    fetchMock.mockResolvedValue(jsonResponse({ ok: false }));
    await expect(storeCloudSaveProvider.delete()).resolves.toBe(false);
  });
});

// -- dev-sim provider ------------------------------------------------------------

describe("devSimCloudSaveProvider (dev build simulation)", () => {
  it("round-trips a snapshot in memory and is available", async () => {
    expect(devSimCloudSaveProvider.isAvailable()).toBe(true);
    await expect(devSimCloudSaveProvider.push(snapshot)).resolves.toEqual({
      status: "accepted",
      updatedAt: snapshot.updatedAt,
    });
    await expect(devSimCloudSaveProvider.pull()).resolves.toEqual(snapshot);
  });

  it("keeps only the LATEST snapshot (last-write-wins, like the server)", async () => {
    const newer: CloudSaveSnapshot = { ...snapshot, updatedAt: 2_000 };
    await devSimCloudSaveProvider.push(snapshot);
    await devSimCloudSaveProvider.push(newer);
    await expect(devSimCloudSaveProvider.pull()).resolves.toEqual(newer);
  });

  it("delete() clears the simulated backup", async () => {
    await devSimCloudSaveProvider.push(snapshot);
    await expect(devSimCloudSaveProvider.delete()).resolves.toBe(true);
    await expect(devSimCloudSaveProvider.pull()).resolves.toBeNull();
  });
});
