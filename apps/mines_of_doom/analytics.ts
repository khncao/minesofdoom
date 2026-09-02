/**
 * Lightweight local event logging (AGENTS.md guardrail 6, "measure before
 * scaling"): the handful of events the UA-spend decision needs — first
 * ad view, IAP purchases, D1/D7 retention, free-path progress (first
 * prestige) — plus the raw session signals they're derived from.
 *
 * Deliberately minimal and privacy-friendly: no PII, no third-party SDK,
 * no network. Everything lives in ONE small AsyncStorage record, which
 * keeps it trivial to audit, export, or delete (data-deletion requests are
 * a `removeItem`), and the record is small enough that a future export can
 * read it straight off the device.
 */

import { getLocalDayKey } from "./dailyBonus";

/** AsyncStorage key for the analytics record. */
export const analyticsKey = "analytics";

export type AnalyticsState = {
  /** Epoch ms of the first observed app open. */
  firstOpenMs: number;
  /** Epoch ms of the most recent app open. */
  lastOpenMs: number;
  /** Local day key of the first open. */
  firstOpenDay: string;
  /** Local day key of the most recent open. */
  lastOpenDay: string;
  /** Distinct local days the app was opened on. */
  activeDays: number;
  /**
   * D1 retention (approximate, see module docs): the player returned on a
   * later local day than the first open, within D1_RETENTION_MS of it.
   * Flips at most once, never back off.
   */
  d1Retention: boolean;
  /** D7 retention, same shape, window D7_RETENTION_MS. */
  d7Retention: boolean;
  /**
   * Local day keys of first-occurrence events ("" = not yet observed).
   * "First-time ad view" (guardrail 6) is the moment the player first taps
   * "watch" — recorded whether or not they finish the ad.
   */
  firstAdViewDay: string;
  /** Local day of the first IAP purchase (wired when the store SDK ships). */
  firstIapPurchaseDay: string;
  /** Total IAP purchases (receipt count, guardrail 6). */
  iapPurchases: number;
  /** Local day of the player's first prestige (free-path progress). */
  firstPrestigeDay: string;
};

/**
 * D1/D7 windows. "D1" here means "came back on a later LOCAL DAY than the
 * first open within ~2 calendar days" (D7: within ~8). Local-day
 * boundaries plus a generous window keep the metric honest across DST and
 * timezone shifts without a server clock — good enough to compare
 * cohorts, not to bill anyone.
 */
export const D1_RETENTION_MS = 2 * 24 * 60 * 60 * 1000;
export const D7_RETENTION_MS = 8 * 24 * 60 * 60 * 1000;

export function emptyAnalyticsState(now: number): AnalyticsState {
  const day = getLocalDayKey(now);
  return {
    firstOpenMs: now,
    lastOpenMs: now,
    firstOpenDay: day,
    lastOpenDay: day,
    activeDays: 1,
    d1Retention: false,
    d7Retention: false,
    firstAdViewDay: "",
    firstIapPurchaseDay: "",
    iapPurchases: 0,
    firstPrestigeDay: "",
  };
}

/**
 * Fold an app open into the record. Idempotent per local day for everything
 * except lastOpenMs, so a double-invoked caller (React strict mode, a hot
 * reload) can't inflate activeDays. `state` may be null (never observed
 * before) — the open then establishes the record.
 */
export function recordAppOpen(
  state: AnalyticsState | null,
  now: number,
): AnalyticsState {
  const s = state ?? emptyAnalyticsState(now);
  const dayKey = getLocalDayKey(now);
  const returned = dayKey > s.firstOpenDay && now > s.firstOpenMs;
  const elapsed = now - s.firstOpenMs;
  return {
    ...s,
    lastOpenMs: now,
    lastOpenDay: dayKey,
    activeDays: dayKey === s.lastOpenDay ? s.activeDays : s.activeDays + 1,
    d1Retention:
      s.d1Retention || (returned && elapsed <= D1_RETENTION_MS),
    d7Retention:
      s.d7Retention || (returned && elapsed <= D7_RETENTION_MS),
  };
}

/** The moment the player first taps "watch" on a rewarded ad. */
export function recordAdView(
  state: AnalyticsState | null,
  now: number,
): AnalyticsState {
  const s = state ?? emptyAnalyticsState(now);
  return s.firstAdViewDay !== ""
    ? s
    : { ...s, firstAdViewDay: getLocalDayKey(now) };
}

/** A store purchase completed + validated (wired when RevenueCat ships). */
export function recordIapPurchase(
  state: AnalyticsState | null,
  now: number,
): AnalyticsState {
  const s = state ?? emptyAnalyticsState(now);
  return {
    ...s,
    firstIapPurchaseDay: s.firstIapPurchaseDay || getLocalDayKey(now),
    iapPurchases: s.iapPurchases + 1,
  };
}

/** The player's first ever prestige (free-path progress milestone). */
export function recordPrestige(
  state: AnalyticsState | null,
  now: number,
): AnalyticsState {
  const s = state ?? emptyAnalyticsState(now);
  return s.firstPrestigeDay !== ""
    ? s
    : { ...s, firstPrestigeDay: getLocalDayKey(now) };
}
