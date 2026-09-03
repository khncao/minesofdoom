/**
 * Cloud saves (docs/store-integration-plan.md §Client "Cloud save"): a
 * device-scoped backup of the serialized save blob, hosted on the SAME
 * Pocketbase deployment as IAP — one URL (`storeConfig.pocketbaseUrl`),
 * the same `isPocketbaseConfigured()` gate, the same device identity
 * (`getIapDeviceId` — the key stays "iapDeviceId" for compatibility; this
 * is just the app's single device UUID, never part of the game save).
 *
 * This module is the provider core: a pure fetch round-trip to the
 * Pocketbase hook endpoints, mirroring iapProvider.ts (same REST shape,
 * same timeout, same "never reject" contract). The engine wiring (push
 * cadence, launch-recovery, settings UI) is a separate iteration and
 * consumes `selectCloudSaveProvider()`.
 *
 * REST contract (mirrored by the server, plan §Backend):
 *   POST {base}/api/app/cloud/push
 *        { deviceId, blob, saveVersion, updatedAt }
 *        → { updatedAt }  // the STORED value after the upsert: the
 *          // server keeps the newer of (stored, pushed), so a stale
 *          // client learns it lost by comparing to its own timestamp.
 *   POST {base}/api/app/cloud/pull { deviceId }
 *        → { snapshot: <CloudSaveSnapshot> | null }
 *   POST {base}/api/app/delete { deviceId } → { ok: true }
 *
 * Gating: until the Pocketbase URL is configured (and it is ALWAYS a
 * no-op on web — save codes cover web backup, and this module imports no
 * native SDK, so there is no `.web` twin to resolve), the no-op provider
 * keeps every cloud-save entry point hidden — same rule as the ad and
 * IAP entry points.
 */
import { Platform } from "react-native";
import { isPocketbaseConfigured, storeConfig } from "./storeConfig";
import { getIapDeviceId } from "./iapDeviceId";

/**
 * A backed-up save snapshot. `blob` is the `serializeSaveData()` output
 * (a ~1.5KB JSON string — the server caps it at 16KB, a real save never
 * gets close). `updatedAt` is the CLIENT clock in epoch ms; the server
 * is last-write-wins on that field by design (the plan's conflict rule —
 * no server-side notion of "newer save" beyond the client's timestamp).
 */
export interface CloudSaveSnapshot {
  blob: string;
  saveVersion: number;
  updatedAt: number;
}

/**
 * The outcome of a push. `accepted`: the server stored OUR snapshot (the
 * reply's updatedAt equals the one we sent). `stale`: the server kept a
 * NEWER snapshot it already had (the caller should refresh its local
 * view — e.g. after a restore from a different device install).
 * `error`: network / non-2xx / bad JSON — nothing was concluded; the
 * caller retries on the next cadence (a failed push never blocks play).
 */
export type CloudSavePushResult =
  | { status: "accepted"; updatedAt: number }
  | { status: "stale"; storedUpdatedAt: number }
  | { status: "error" };

export interface CloudSaveProvider {
  /** Stable id for logs/panels ("noop", "dev-sim", "pocketbase"). */
  readonly id: string;
  /** Whether cloud saves can sync on this platform right now. */
  isAvailable(): boolean;
  /**
   * Back up a snapshot. Resolves (never rejects) to the outcome; a
   * failure is an "error" outcome, not a thrown error.
   */
  push(snapshot: CloudSaveSnapshot): Promise<CloudSavePushResult>;
  /**
   * Fetch this device's latest snapshot, or null (no backup, network
   * failure, or a server reply the client can't trust — a bad blob is
   * "no backup", because importing garbage would be worse than none).
   */
  pull(): Promise<CloudSaveSnapshot | null>;
  /** GDPR "delete my data" (plan §Backend). Resolves true only on 2xx. */
  delete(): Promise<boolean>;
}

/** Round-trips to a small VPS should not take long (same as IAP). */
const HTTP_TIMEOUT_MS = 20 * 1000;

/** POST JSON with a timeout; null on any failure (never throws). */
async function postJson(url: string, body: unknown): Promise<Record<string, unknown> | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const parsed: unknown = await res.json();
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Strict client-side check of a pull reply: a snapshot is only usable if
 * every field has the right type (the blob goes through
 * migrateSaveData/buildSaveData on import anyway — this just keeps
 * obviously-broken rows out of the UI's "restore?" path).
 */
function parseSnapshot(raw: unknown): CloudSaveSnapshot | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { blob, saveVersion, updatedAt } = raw as Partial<CloudSaveSnapshot>;
  if (
    typeof blob !== "string" ||
    blob.length === 0 ||
    typeof saveVersion !== "number" ||
    !Number.isInteger(saveVersion) ||
    saveVersion < 0 ||
    typeof updatedAt !== "number" ||
    !Number.isFinite(updatedAt)
  ) {
    return null;
  }
  return { blob, saveVersion, updatedAt };
}

export const noopCloudSaveProvider: CloudSaveProvider = {
  id: "noop",
  isAvailable: () => false,
  push: async () => ({ status: "error" }),
  pull: async () => null,
  delete: async () => false,
};

/**
 * Development-build-only provider: an in-memory snapshot so the full
 * sync UI (toggle, last-sync line, restore flow) can be exercised on a
 * dev build before the Pocketbase instance exists. It never survives a
 * restart — that is the point: the dev build must not pretend to be a
 * durable backup (transparency guardrail).
 */
let devSimSnapshot: CloudSaveSnapshot | null = null;
export const devSimCloudSaveProvider: CloudSaveProvider = {
  id: "dev-sim",
  isAvailable: () => true,
  push: async (snapshot) => {
    devSimSnapshot = snapshot;
    return { status: "accepted", updatedAt: snapshot.updatedAt };
  },
  pull: async () => devSimSnapshot,
  delete: async () => {
    devSimSnapshot = null;
    return true;
  },
};

/**
 * The real provider: fetch round-trips to the Pocketbase hook endpoints.
 * Selected by `pickCloudSaveProvider` for a native production build with
 * the Pocketbase URL configured; entry points stay hidden until then.
 */
export const storeCloudSaveProvider: CloudSaveProvider = {
  id: "pocketbase",
  isAvailable: () => isPocketbaseConfigured(),

  async push(snapshot) {
    if (!isPocketbaseConfigured()) return { status: "error" };
    const deviceId = await getIapDeviceId();
    const res = await postJson(`${storeConfig.pocketbaseUrl}/api/app/cloud/push`, {
      deviceId,
      blob: snapshot.blob,
      saveVersion: snapshot.saveVersion,
      updatedAt: snapshot.updatedAt,
    });
    const stored = res?.updatedAt;
    if (typeof stored !== "number" || !Number.isFinite(stored)) {
      return { status: "error" };
    }
    // The server replies with the STORED value (its upsert rule: keep the
    // newer of stored/pushed). Equal to ours → we won; greater → the
    // server had a newer snapshot, we lost.
    return stored === snapshot.updatedAt
      ? { status: "accepted", updatedAt: stored }
      : { status: "stale", storedUpdatedAt: stored };
  },

  async pull() {
    if (!isPocketbaseConfigured()) return null;
    const deviceId = await getIapDeviceId();
    const res = await postJson(
      `${storeConfig.pocketbaseUrl}/api/app/cloud/pull`,
      { deviceId },
    );
    if (res === null) return null;
    return parseSnapshot(res.snapshot);
  },

  async delete() {
    if (!isPocketbaseConfigured()) return false;
    const deviceId = await getIapDeviceId();
    const res = await postJson(`${storeConfig.pocketbaseUrl}/api/app/delete`, {
      deviceId,
    });
    return res?.ok === true;
  },
};

/** The inputs to provider selection — a pure decision so the swap point
 *  stays unit-testable (same pattern as pickIapProvider in iaps.ts). */
export type CloudSaveProviderSelection = {
  /** `__DEV__` — the dev build always runs the labeled simulation. */
  dev: boolean;
  /** Web target: always the no-op (save codes cover web backup). */
  web: boolean;
  /** `isPocketbaseConfigured()` (storeConfig.ts). */
  pocketbaseConfigured: boolean;
};

/**
 * Pure provider selection. The rules, in order (mirror of
 * pickIapProvider):
 *  1. dev always wins — the in-memory simulation makes the sync UI
 *     testable before the backend exists.
 *  2. web is a no-op by construction (no `.web` twin needed: this module
 *     imports no native SDK).
 *  3. native production: the real provider only once the Pocketbase URL
 *     is configured; until then the no-op keeps entry points hidden.
 */
export function pickCloudSaveProvider(sel: CloudSaveProviderSelection): CloudSaveProvider {
  if (sel.dev) return devSimCloudSaveProvider;
  if (sel.web) return noopCloudSaveProvider;
  if (!sel.pocketbaseConfigured) return noopCloudSaveProvider;
  return storeCloudSaveProvider;
}

/** The one call the engine uses to get its provider. */
export function selectCloudSaveProvider(dev: boolean): CloudSaveProvider {
  return pickCloudSaveProvider({
    dev,
    web: Platform.OS === "web",
    pocketbaseConfigured: isPocketbaseConfigured(),
  });
}
