/**
 * Leaderboard engine wiring (docs/store-integration.md §3,
 * the "client" half after the provider core in leaderboard.ts).
 *
 * Consumes `selectLeaderboardProvider()` and adds exactly what the plan
 * prescribes — nothing the plan doesn't:
 *
 *  - **Submit cadence.** `requestSubmit()` is called by MinesOfDoom on
 *    the same triggers as the cloud push (every local save that lands,
 *    plus the prestige run boundary) and is gated here to 5+ minutes
 *    since the last submit (plan: "same cadence as the cloud push,
 *    piggybacked on the provider's network turn"). Fire-and-forget: a
 *    failed submit never blocks play and never toasts (the board is a
 *    nicety, not a feature with a status line — the status line is the
 *    cloud backup's).
 *  - **Display.** `refresh()` fetches top-10 + this device's rank with a
 *    60s in-memory cache and a 5s tap throttle (plan §Leaderboard
 *    "Display"). Offline/error → an "unavailable right now" state, never
 *    a spinner trap.
 *  - **Display name.** A plain ≤16-char string persisted in AsyncStorage
 *    (NEVER in the save blob — a save code must not carry the name, and
 *    a restore must not resurrect a stale one), default "Digger". It is
 *    sent with every submit; a rename takes effect at the next submit.
 *
 * The hook is UI-agnostic (provider + injected stats getter), so it is
 * testable with a scripted fake provider and fake timers.
 */
import { useCallback, useRef, useState } from "react";
import { useLocalStorage } from "src/hooks/useLocalStorage";
import {
  DEFAULT_DISPLAY_NAME,
  LEADERBOARD_NAME_MAX,
  LEADERBOARD_TOP_LIMIT,
  sanitizeDisplayName,
  type LeaderboardProvider,
  type LeaderboardRank,
  type LeaderboardRow,
} from "../leaderboard";

/** 5-minute submit cadence (plan §Leaderboard: same as the cloud push). */
export const LEADERBOARD_SUBMIT_INTERVAL_MS = 5 * 60 * 1000;
/** 60s in-memory cache on the board data (plan §Leaderboard "Display"). */
export const LEADERBOARD_CACHE_TTL_MS = 60 * 1000;
/** 5s tap throttle on manual refresh (plan §Leaderboard "Display"). */
export const LEADERBOARD_REFRESH_THROTTLE_MS = 5 * 1000;

/** The derived lifetime stats MinesOfDoom feeds to submit — all
 *  monotonic by construction (the save's lifetime maxes). */
export type LeaderboardStatsInput = {
  bestDepth: number;
  maxCombo: number;
  lifetimeMinerals: number;
  achievementIds: string[];
};

export type LeaderboardStatus = "idle" | "loading" | "loaded" | "error";

export interface LeaderboardOptions {
  /** The selected provider (stable; see selectLeaderboardProvider). */
  provider: LeaderboardProvider;
  /** The current save's lifetime stats (stable callback reading a ref);
   *  null = not ready (e.g. before the first save load). */
  getStats: () => LeaderboardStatsInput | null;
}

export interface LeaderboardHandle {
  /** Provider live on this platform (the trophy button renders only
   *  when true — the "hidden until configured" rule). */
  available: boolean;
  /** The player's display name (persisted, ≤16 chars after sanitize). */
  displayName: string;
  setDisplayName: (name: string) => void;
  /** Request a submit (cadence enforced here). Fire-and-forget. */
  requestSubmit: () => void;
  /** Top-N rows; null = not fetched yet OR the last fetch failed. */
  rows: LeaderboardRow[] | null;
  /** This device's rank row, or null (no row yet / board failed). */
  yourRank: LeaderboardRank | null;
  status: LeaderboardStatus;
  /** Refresh the board (60s cache + 5s throttle enforced here). */
  refresh: () => void;
}

export function useLeaderboard(opts: LeaderboardOptions): LeaderboardHandle {
  // The display name lives in AsyncStorage, never in the save (plan
  // §Leaderboard "Display name").
  const [displayName, setDisplayName] = useLocalStorage<string>(
    "leaderboardDisplayName",
    DEFAULT_DISPLAY_NAME,
  );

  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [yourRank, setYourRank] = useState<LeaderboardRank | null>(null);
  const [status, setStatus] = useState<LeaderboardStatus>("idle");

  // Refs so the stable callbacks below always see the latest values
  // without re-subscribing on every render (same pattern as
  // useCloudSave).
  const providerRef = useRef(opts.provider);
  providerRef.current = opts.provider;
  const getStatsRef = useRef(opts.getStats);
  getStatsRef.current = opts.getStats;
  const displayNameRef = useRef(displayName);
  displayNameRef.current = displayName;

  const submittingRef = useRef(false);
  const lastSubmitAtRef = useRef(0);

  const requestSubmit = useCallback(() => {
    const prov = providerRef.current;
    if (!prov.isAvailable() || submittingRef.current) return;
    const now = Date.now();
    if (now - lastSubmitAtRef.current < LEADERBOARD_SUBMIT_INTERVAL_MS) return;
    const stats = getStatsRef.current();
    if (stats == null) return;
    lastSubmitAtRef.current = now;
    submittingRef.current = true;
    void prov
      .submit({
        bestDepth: stats.bestDepth,
        maxCombo: stats.maxCombo,
        lifetimeMinerals: stats.lifetimeMinerals,
        achievementIds: stats.achievementIds,
        // Sanitize here so the board never shows control chars / blanks
        // (the server sanitizes too — the client pre-truncates, plan).
        displayName: sanitizeDisplayName(displayNameRef.current),
      })
      .catch(() => {
        // The provider contract is "never rejects"; a status line is
        // cheaper than an unhandled rejection.
      })
      .finally(() => {
        submittingRef.current = false;
      });
  }, []);

  const lastAttemptAtRef = useRef(0);
  const lastGoodAtRef = useRef(0);
  const fetchingRef = useRef(false);

  const refresh = useCallback(() => {
    const prov = providerRef.current;
    if (!prov.isAvailable() || fetchingRef.current) return;
    const now = Date.now();
    if (now - lastAttemptAtRef.current < LEADERBOARD_REFRESH_THROTTLE_MS) {
      return;
    }
    // 60s in-memory cache: a fresh board is shown as-is, no refetch.
    if (now - lastGoodAtRef.current < LEADERBOARD_CACHE_TTL_MS) return;
    lastAttemptAtRef.current = now;
    fetchingRef.current = true;
    // Keep "loaded" while a refetch is in flight (a stale board is
    // better than a flashing empty one); everything else shows loading.
    setStatus((prev) => (prev === "loaded" ? "loaded" : "loading"));
    void Promise.all([
      prov.top(LEADERBOARD_TOP_LIMIT),
      prov.rank(),
    ])
      .then(([top, rank]) => {
        if (top == null) {
          // Network/parse failure: the UI shows the "unavailable right
          // now" line (never a spinner trap).
          setStatus("error");
          return;
        }
        setRows(top);
        setYourRank(rank);
        lastGoodAtRef.current = Date.now();
        setStatus("loaded");
      })
      .catch(() => {
        setStatus("error");
      })
      .finally(() => {
        fetchingRef.current = false;
      });
  }, []);

  // A cheap per-render read: isAvailable() is a constant per provider,
  // so memoizing it would just add a dependency to appease.
  const available = providerRef.current.isAvailable();

  return {
    available,
    displayName,
    setDisplayName,
    requestSubmit,
    rows,
    yourRank,
    status,
    refresh,
  };
}

export { LEADERBOARD_NAME_MAX, DEFAULT_DISPLAY_NAME };
