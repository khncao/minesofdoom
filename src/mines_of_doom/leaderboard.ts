/**
 * Leaderboard (docs/store-integration.md §3): the top-10
 * max-depth scoreboard hosted on the SAME Pocketbase deployment as the
 * cloud saves — one URL (`storeConfig.pocketbaseUrl`), the same
 * `isPocketbaseConfigured()` gate, the same device identity
 * (`getIapDeviceId`).
 *
 * This module is the provider core: pure fetch round-trips mirroring
 * cloudSave.ts (same REST shape, same timeout, same "never reject"
 * contract). The anti-cheat stance is the plan's explicit honest-casual
 * one: the server trusts the client's MONOTONIC lifetime stats plus
 * sanity caps — `bestDepth` is the save's lifetime max, so it is
 * monotonic by construction, and nothing in the game is gated on the
 * board (it is a scoreboard, not a paywall).
 *
 * REST contract (mirrored by the server, plan §Backend):
 *   POST {base}/api/app/leaderboard/submit
 *        { deviceId, displayName, bestDepth, maxCombo,
 *          lifetimeMinerals, achievementIds, sessionToken? }
 *        → { ok: true }   // monotonic-only upsert: the server keeps the
 *          // per-field max, so a resubmit never pushes a row backwards.
 *   POST {base}/api/app/leaderboard/top { limit }
 *        → { rows: <LeaderboardRow[]> }  // by bestDepth desc
 *   POST {base}/api/app/leaderboard/rank { deviceId, sessionToken? }
 *        → { entry: { rank, bestDepth } | null }
 *
 * `sessionToken` (optional login, pb_hooks/README.md): OPTIONAL — with a
 * live session the submitted row is tagged with the account and the rank
 * is the best across the account's linked devices (a fresh install keeps
 * the old device's board standing). Without it the round-trip is
 * byte-identical to the anonymous device default (guardrail: login is
 * never a prerequisite for anything).
 *
 * Gating: until the Pocketbase URL is configured (and it is ALWAYS a
 * no-op on web), the no-op provider keeps every leaderboard entry point
 * hidden — same rule as the ad, IAP, and cloud-save entry points.
 */
import { Platform } from "react-native";
import { isPocketbaseConfigured, storeConfig } from "./storeConfig";
import { getIapDeviceId } from "./iapDeviceId";

/** The board size shown in the modal (the plan's top 10). */
export const LEADERBOARD_TOP_LIMIT = 10;

/** Display names are ≤16 chars (plan §Backend: the client pre-truncates). */
export const LEADERBOARD_NAME_MAX = 16;

/** The display name a player who never chose one is known by. */
export const DEFAULT_DISPLAY_NAME = "Digger";

/** The control-character stripper (built at runtime so the source stays
 *  free of literal control escapes — `no-control-regex`). */
const CONTROL_CHARS = new RegExp(
  `[${String.fromCharCode(0)}-${String.fromCharCode(31)}\u007f]`,
  "g",
);

/** Strip control chars + whitespace, cap at 16; fall back to the default
 *  for an empty result (the board must never show a blank name). */
export function sanitizeDisplayName(raw: string): string {
  const cleaned = raw
    .replace(CONTROL_CHARS, "")
    .trim()
    .slice(0, LEADERBOARD_NAME_MAX);
  return cleaned.length > 0 ? cleaned : DEFAULT_DISPLAY_NAME;
}

/** The derived lifetime stats a submit carries — all monotonic by
 *  construction (the save's lifetime maxes, never per-run values). */
export interface LeaderboardStats {
  displayName: string;
  /** Deepest depth reached ever (meters), lifetime max. */
  bestDepth: number;
  maxCombo: number;
  lifetimeMinerals: number;
  /** Completed achievement ids (badge count on the board rows). */
  achievementIds: string[];
}

/** One top-N row as the server returns it. */
export interface LeaderboardRow {
  rank: number;
  displayName: string;
  bestDepth: number;
  maxCombo: number;
  /** `achievementIds.length` — the badge count the row renders. */
  achievementCount: number;
}

/** This device's rank row (`rank` = count of rows strictly above + 1). */
export interface LeaderboardRank {
  rank: number;
  bestDepth: number;
}

export interface LeaderboardProvider {
  /** Stable id for logs/panels ("noop", "dev-sim", "pocketbase"). */
  readonly id: "noop" | "dev-sim" | "pocketbase";
  /** Whether the board is live on this platform right now. */
  isAvailable(): boolean;
  /** Monotonic upsert of this device's row (optional `sessionToken`
   *  tags the row with the signed-in account — see module docs). */
  submit(stats: LeaderboardStats, sessionToken?: string | null): Promise<boolean>;
  /** Top N by bestDepth desc; null = network/parse failure (the UI shows
   *  an "unavailable right now" line, never a spinner trap). */
  top(limit: number): Promise<LeaderboardRow[] | null>;
  /** This device's rank, or null (no row yet, or failure). With a
   *  `sessionToken`: the best rank across the account's linked devices. */
  rank(sessionToken?: string | null): Promise<LeaderboardRank | null>;
}

/** Round-trips to a small VPS should not take long (same as IAP/cloud). */
const HTTP_TIMEOUT_MS = 20 * 1000;

/** POST JSON with a timeout; null on any failure (never throws). */
async function postJson(
  url: string,
  body: unknown,
): Promise<Record<string, unknown> | null> {
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

/** Strict client-side row check: a row only renders if every field has
 *  the right type (garbage must not reach the board UI). */
function parseRow(raw: unknown): LeaderboardRow | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Partial<LeaderboardRow>;
  if (
    typeof r.rank !== "number" ||
    !Number.isInteger(r.rank) ||
    r.rank < 1 ||
    typeof r.displayName !== "string" ||
    r.displayName.length === 0 ||
    typeof r.bestDepth !== "number" ||
    !Number.isFinite(r.bestDepth) ||
    r.bestDepth < 0 ||
    typeof r.maxCombo !== "number" ||
    !Number.isFinite(r.maxCombo) ||
    r.maxCombo < 0 ||
    typeof r.achievementCount !== "number" ||
    !Number.isInteger(r.achievementCount) ||
    r.achievementCount < 0
  ) {
    return null;
  }
  return {
    rank: r.rank,
    displayName: r.displayName.slice(0, LEADERBOARD_NAME_MAX),
    bestDepth: r.bestDepth,
    maxCombo: r.maxCombo,
    achievementCount: r.achievementCount,
  };
}

function parseRankEntry(raw: unknown): LeaderboardRank | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Partial<LeaderboardRank>;
  if (
    typeof r.rank !== "number" ||
    !Number.isInteger(r.rank) ||
    r.rank < 1 ||
    typeof r.bestDepth !== "number" ||
    !Number.isFinite(r.bestDepth) ||
    r.bestDepth < 0
  ) {
    return null;
  }
  return { rank: r.rank, bestDepth: r.bestDepth };
}

export const noopLeaderboardProvider: LeaderboardProvider = {
  id: "noop",
  isAvailable: () => false,
  submit: async () => false,
  top: async () => null,
  rank: async () => null,
};

/**
 * Development-build-only provider: one in-memory row (this device's) so
 * the full board UI (rows, "you" row, rename → next submit) can be
 * exercised on a dev build before the Pocketbase instance exists. It
 * never survives a restart — that is the point, same as the cloud dev
 * sim (transparency guardrail: a dev build must not fake a populated
 * board with invented players).
 */
let devSimRow: LeaderboardStats | null = null;
export const devSimLeaderboardProvider: LeaderboardProvider = {
  id: "dev-sim",
  isAvailable: () => true,
  async submit(stats) {
    // Monotonic, like the server: per-field max, never backwards.
    if (devSimRow == null) {
      devSimRow = stats;
    } else {
      devSimRow = {
        displayName: stats.displayName,
        bestDepth: Math.max(devSimRow.bestDepth, stats.bestDepth),
        maxCombo: Math.max(devSimRow.maxCombo, stats.maxCombo),
        lifetimeMinerals: Math.max(
          devSimRow.lifetimeMinerals,
          stats.lifetimeMinerals,
        ),
        achievementIds: [
          ...new Set([...devSimRow.achievementIds, ...stats.achievementIds]),
        ],
      };
    }
    return true;
  },
  async top() {
    if (devSimRow == null) return [];
    return [
      {
        rank: 1,
        displayName: devSimRow.displayName,
        bestDepth: devSimRow.bestDepth,
        maxCombo: devSimRow.maxCombo,
        achievementCount: devSimRow.achievementIds.length,
      },
    ];
  },
  async rank() {
    if (devSimRow == null) return null;
    return { rank: 1, bestDepth: devSimRow.bestDepth };
  },
};

/**
 * The real provider: fetch round-trips to the Pocketbase hook endpoints.
 * Selected by `pickLeaderboardProvider` for a native production build
 * with the Pocketbase URL configured; entry points stay hidden until
 * then.
 */
export const storeLeaderboardProvider: LeaderboardProvider = {
  id: "pocketbase",
  isAvailable: () => isPocketbaseConfigured(),

  async submit(stats, sessionToken) {
    if (!isPocketbaseConfigured()) return false;
    const deviceId = await getIapDeviceId();
    const res = await postJson(
      `${storeConfig.pocketbaseUrl}/api/app/leaderboard/submit`,
      {
        deviceId,
        displayName: sanitizeDisplayName(stats.displayName),
        bestDepth: stats.bestDepth,
        maxCombo: stats.maxCombo,
        lifetimeMinerals: stats.lifetimeMinerals,
        achievementIds: stats.achievementIds,
        ...sessionFields(sessionToken),
      },
    );
    return res?.ok === true;
  },

  async top(limit) {
    if (!isPocketbaseConfigured()) return null;
    const res = await postJson(
      `${storeConfig.pocketbaseUrl}/api/app/leaderboard/top`,
      { limit },
    );
    if (res == null) return null;
    if (!Array.isArray(res.rows)) return null;
    const parsed = res.rows
      .map(parseRow)
      .filter((row): row is LeaderboardRow => row != null);
    return parsed.slice(0, limit);
  },

  async rank(sessionToken) {
    if (!isPocketbaseConfigured()) return null;
    const deviceId = await getIapDeviceId();
    const res = await postJson(
      `${storeConfig.pocketbaseUrl}/api/app/leaderboard/rank`,
      { deviceId, ...sessionFields(sessionToken) },
    );
    if (res == null) return null;
    return parseRankEntry(res.entry);
  },
};

/** The optional-login body field: only present while signed in (a
 *  missing token is the anonymous device default, byte-identical). */
function sessionFields(
  sessionToken?: string | null,
): { sessionToken?: string } {
  return sessionToken === null || sessionToken === undefined || sessionToken === ""
    ? {}
    : { sessionToken };
}

/** The inputs to provider selection — a pure decision so the swap point
 *  stays unit-testable (same pattern as the cloud-save and IAP
 *  providers). */
export type LeaderboardProviderSelection = {
  /** `__DEV__` — the dev build always runs the labeled simulation. */
  dev: boolean;
  /** Web target: always the no-op (web has no board yet, like ads). */
  web: boolean;
  /** `isPocketbaseConfigured()` (storeConfig.ts). */
  pocketbaseConfigured: boolean;
};

/**
 * Pure provider selection. The rules, in order (mirror of
 * pickCloudSaveProvider):
 *  1. dev always wins — the in-memory row makes the board UI testable
 *    before the backend exists.
 *  2. web is a no-op by construction (save codes and the local records
 *    view cover web).
 *  3. native production: the real provider only once the Pocketbase URL
 *    is configured; until then the no-op keeps entry points hidden.
 */
export function pickLeaderboardProvider(
  sel: LeaderboardProviderSelection,
): LeaderboardProvider {
  if (sel.dev) return devSimLeaderboardProvider;
  if (sel.web) return noopLeaderboardProvider;
  if (!sel.pocketbaseConfigured) return noopLeaderboardProvider;
  return storeLeaderboardProvider;
}

/** The one call the engine uses to get its provider. */
export function selectLeaderboardProvider(dev: boolean): LeaderboardProvider {
  return pickLeaderboardProvider({
    dev,
    web: Platform.OS === "web",
    pocketbaseConfigured: isPocketbaseConfigured(),
  });
}
