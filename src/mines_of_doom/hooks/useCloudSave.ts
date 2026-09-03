/**
 * Cloud-save engine wiring (docs/store-integration-plan.md §Cloud save,
 * the "engine wiring" half after the provider core in cloudSave.ts).
 *
 * Consumes `selectCloudSaveProvider()` and adds exactly what the plan
 * prescribes — nothing the plan doesn't:
 *
 *  - **Push cadence.** `requestPush("autosave")` is called by
 *    MinesOfDoom whenever a local save lands (the dirty→clean transition)
 *    and is gated here to 5+ minutes since the last push.
 *    `requestPush("prestige")` bypasses the cadence (the prestige is the
 *    run boundary — always push). The user toggle gates both.
 *    Fire-and-forget: a failed push never blocks play, it only moves the
 *    settings "last sync" line to "failed — will retry".
 *  - **Launch recovery.** When the engine reports the local load FAILED
 *    (corrupt save — a fresh install is NOT eligible), the cloud is pulled
 *    once and, if a blob comes back, imported through the engine's normal
 *    validate/migrate/offline-pay pipeline with a toast.
 *  - **Manual restore.** `restoreFromCloud()` for the settings button
 *    (the confirm modal itself is the component's job).
 *
 * What this hook deliberately does NOT do:
 *  - Touch the save blob: the on/off toggle and the last-sync status live
 *    in AsyncStorage (never in the save — a save code must never carry
 *    the toggle, and a restore must not resurrect a stale toggle).
 *  - Auto-override a healthy local save. The cloud is a backup; the only
 *    import paths are launch-recovery (local is unusable) and an explicit
 *    player restore.
 *
 * The hook is UI-agnostic and pure-React (provider + injected callbacks),
 * so it is testable with a scripted fake provider and fake timers.
 */
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useLocalStorage } from "src/hooks/useLocalStorage";
import type { TranslationKey, Vars } from "src/utils/i18n/i18n";
import type { CloudSaveProvider, CloudSaveSnapshot } from "../cloudSave";

/** 5-minute push cadence (plan §Cloud save "Push"). */
export const CLOUD_SAVE_PUSH_INTERVAL_MS = 5 * 60 * 1000;

export type CloudSavePushReason = "autosave" | "prestige";

/**
 * The settings status line's data. `state` is the outcome of the LAST
 * push attempt (never = no push yet since install); `at` is its epoch ms
 * (null while "never"). Persisted in AsyncStorage so the line survives a
 * restart (the "last sync: 3m ago" wording is honest across restarts).
 */
export interface CloudSaveSyncStatus {
  state: "never" | "ok" | "failed";
  at: number | null;
}

export const NEVER_SYNCED: CloudSaveSyncStatus = { state: "never", at: null };

/** Compact, locale-neutral relative time ("3m ago", "2h ago") for the
 *  "last sync" line — symbols, not words, so it needs no per-locale unit
 *  strings. */
export function formatAgo(from: number, to: number): string {
  const mins = Math.max(0, Math.floor((to - from) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export interface CloudSaveOptions {
  /** The selected provider (stable; see selectCloudSaveProvider). */
  provider: CloudSaveProvider;
  /** The current save as a snapshot (stable callback reading a ref). */
  getSnapshot: () => CloudSaveSnapshot | null;
  /** The engine's blob importer (validate/migrate/offline-pay); false =
   *  the blob was unusable. */
  restore: (blob: string) => boolean;
  /** Engine "stored save loaded" flag — recovery is gated on it (the
   *  storage subsystem must be up before a recovered save can be saved). */
  isLoaded: boolean;
  /** Engine "local load failed" flag (corrupt stored save). */
  saveLoadFailed: boolean;
  displayMessage: (message: string, timeout: number) => void;
  t: (key: TranslationKey, vars?: Vars) => string;
}

export interface CloudSaveHandle {
  /** Provider live on this platform (the settings section renders only
   *  when true — the "hidden until configured" rule). */
  available: boolean;
  /** The user's on/off toggle (persisted; defaults ON — the backup is
   *  free and on by default, plan guardrail mapping). */
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  lastSync: CloudSaveSyncStatus;
  /** Request a backup push (cadence + toggle enforced here). */
  requestPush: (reason: CloudSavePushReason) => void;
  /** Manual "restore from cloud" (settings button; the confirm modal is
   *  the component's job). Toasts the outcome. */
  restoreFromCloud: () => Promise<void>;
  /** GDPR "delete my data" (plan §Backend `POST /api/app/delete`): removes
   *  this device's cloud-save + leaderboard rows. Purchases survive (the
   *  copy in the confirm modal says so). Toasts the outcome. */
  deleteMyData: () => Promise<void>;
}

/** The bundle MinesOfDoom hands to the settings section (memo-friendly:
 *  only these fields ever change it). */
export interface CloudSaveSettingsProps {
  available: boolean;
  /** Dev build (the labeled in-memory simulation). */
  isDevSim: boolean;
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  lastSync: CloudSaveSyncStatus;
  onRestore: () => void;
  /** GDPR "delete my data" (ConfirmableButton in the same section; the
   *  section already renders only while the provider is available, so
   *  the button is never a no-op). */
  onDeleteData: () => void;
}

const STORAGE_KEY_ENABLED = "cloudSaveEnabled";
const STORAGE_KEY_LAST_SYNC = "cloudSaveLastSync";

export function useCloudSave(opts: CloudSaveOptions): CloudSaveHandle {
  const { provider } = opts;

  // The toggle lives in AsyncStorage, never in the save (plan §Cloud
  // save "Persistence of the toggle"). Default ON: the backup is free.
  const [enabled, setEnabled] = useLocalStorage<boolean>(
    STORAGE_KEY_ENABLED,
    true,
  );
  // Last-sync status: persisted so the settings line is honest across
  // restarts. The setter is stable (useLocalStorage), safe in callbacks.
  const [lastSync, setLastSync] = useLocalStorage<CloudSaveSyncStatus>(
    STORAGE_KEY_LAST_SYNC,
    NEVER_SYNCED,
  );

  // Refs so the stable callbacks below always see the latest values
  // without re-subscribing on every render (same pattern as
  // useGameEngine's saveGameRef).
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const providerRef = useRef(provider);
  providerRef.current = provider;
  const getSnapshotRef = useRef(opts.getSnapshot);
  getSnapshotRef.current = opts.getSnapshot;
  const restoreRef = useRef(opts.restore);
  restoreRef.current = opts.restore;
  const displayMessageRef = useRef(opts.displayMessage);
  displayMessageRef.current = opts.displayMessage;
  const tRef = useRef(opts.t);
  tRef.current = opts.t;

  const pushingRef = useRef(false);
  const lastPushAtRef = useRef(0);

  const requestPush = useCallback(
    (reason: CloudSavePushReason) => {
      const prov = providerRef.current;
      if (!prov.isAvailable() || !enabledRef.current) return;
      if (pushingRef.current) return;
      const now = Date.now();
      // The 5-minute cadence applies to autosave pushes; a prestige push
      // is the run boundary and always goes out (plan §Cloud save).
      if (
        reason === "autosave" &&
        now - lastPushAtRef.current < CLOUD_SAVE_PUSH_INTERVAL_MS
      ) {
        return;
      }
      const snapshot = getSnapshotRef.current();
      if (snapshot == null) return;
      pushingRef.current = true;
      lastPushAtRef.current = now;
      void prov
        .push(snapshot)
        .then((res) => {
          if (res.status === "error") {
            setLastSync({ state: "failed", at: Date.now() });
            return;
          }
          setLastSync({ state: "ok", at: Date.now() });
          if (res.status === "stale") {
            // The server kept a NEWER snapshot than the one we just
            // pushed — its restore contract (cloudSave.ts): refresh the
            // local view from the stored one (same import pipeline; it is
            // the newer backup, so offline earnings from it, if any, are
            // legitimately owed).
            void providerRef.current.pull().then((stored) => {
              if (stored != null) restoreRef.current(stored.blob);
            });
          }
        })
        .catch(() => {
          // The provider contract is "never rejects", but a status line
          // is cheaper than an unhandled rejection.
          setLastSync({ state: "failed", at: Date.now() });
        })
        .finally(() => {
          pushingRef.current = false;
        });
    },
    [setLastSync],
  );

  // Launch recovery (plan §Cloud save "Pull"): the local load FAILED and
  // the provider is live → pull once; a blob imports through the engine's
  // normal pipeline with a toast. Runs at most once per app launch
  // (recoveryStartedRef), ignores the toggle (recovery is a safety net,
  // not a sync — a player who switched the backup off still gets their
  // last backup back when the local save is unreadable).
  const recoveryStartedRef = useRef(false);
  useEffect(() => {
    if (!opts.isLoaded || !opts.saveLoadFailed || recoveryStartedRef.current) {
      return;
    }
    const prov = providerRef.current;
    if (!prov.isAvailable()) return;
    recoveryStartedRef.current = true;
    void prov.pull().then((snapshot) => {
      if (snapshot != null && restoreRef.current(snapshot.blob)) {
        displayMessageRef.current(tRef.current("toast.cloudRestored"), 6000);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.isLoaded, opts.saveLoadFailed]);

  const restoreFromCloud = useCallback(async () => {
    const prov = providerRef.current;
    const t = tRef.current;
    const snapshot = await prov.pull();
    if (snapshot == null) {
      displayMessageRef.current(t("toast.cloudNoBackup"), 4000);
      return;
    }
    if (restoreRef.current(snapshot.blob)) {
      displayMessageRef.current(t("toast.cloudRestored"), 6000);
    } else {
      displayMessageRef.current(t("toast.cloudRestoreFailed"), 4000);
    }
  }, []);

  const available = useMemo(() => provider.isAvailable(), [provider]);

  // "Delete my data" (plan §Backend, GDPR): the confirm modal with the
  // plain wording is the component's job (a ConfirmableButton in the
  // settings section); this is just the round-trip + the outcome toast.
  const deleteMyData = useCallback(async () => {
    const ok = await providerRef.current.delete().catch(() => false);
    displayMessageRef.current(
      ok ? tRef.current("toast.dataDeleted") : tRef.current("toast.dataDeleteFailed"),
      4000,
    );
  }, []);

  return {
    available,
    enabled,
    setEnabled,
    lastSync,
    requestPush,
    restoreFromCloud,
    deleteMyData,
  };
}
