/**
 * Lightweight local event logging (AGENTS.md guardrail 5, "measure before
 * scaling"): the handful of events the UA-spend decision needs — first
 * ad view, IAP purchases, D1/D7 retention, free-path progress (first
 * prestige + total prestige count). Stored as one-shot day stamps and
 * counters, folded in as the game observes them (no per-event session
 * stream).
 *
 * Deliberately minimal and privacy-friendly: no PII, no third-party SDK,
 * no network. Everything lives in ONE small AsyncStorage record, which
 * keeps it trivial to audit, export, or delete: the record is readable
 * on-device in Settings → "Local stats (debug)" (`summarizeAnalytics`),
 * and data-deletion requests are a `removeItem` (`useAnalytics.clear`).
 */

import type { IapProductId } from "./iaps";
import type { AdKind, AdResult } from "./ads";
import { AD_KIND_VALUES, AD_OUTCOME_VALUES } from "./ads";
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
   * "First-time ad view" (guardrail 5) is the moment the player first taps
   * "watch" — recorded whether or not they finish the ad.
   */
  firstAdViewDay: string;
  /**
   * The kind of the FIRST rewarded-ad tap ("" = not yet observed; invalid
   * persisted values drop to "" at parse time). "First" semantics: a later
   * tap of a different kind never overwrites it (F26.4 — the hook seam
   * already carried the kind, the fold dropped it).
   */
  firstAdKind: string;
  /**
   * The outcome of the FIRST rewarded-ad attempt ("" = not yet observed):
   * "rewarded" | "closed" | "error" — the ad pipeline's failure modes
   * (no fill / early close) are otherwise invisible (F26.4).
   */
  firstAdOutcome: string;
  /** Local day of the first IAP purchase (wired when the store SDK ships). */
  firstIapPurchaseDay: string;
  /** Total IAP purchases (receipt count, guardrail 5). */
  iapPurchases: number;
  /**
   * Bounded per-purchase log (F26.3: IAP had no per-event log — "which
   * product sold" was not measurable on-device). Newest last, capped; the
   * catalog is small, the cap only exists so a hand-edited record can't
   * bloat the AsyncStorage row. Pre-dates products with no id are counted
   * in `iapPurchases` but leave no row.
   */
  iapPurchaseLog: IapPurchaseEvent[];
  /** Local day of the player's first prestige (free-path progress). */
  firstPrestigeDay: string;
  /** Total prestiges sunk (free-path progress, guardrail 5). */
  prestiges: number;
  /** Local day of the player's first cosmetic purchase (any path). */
  firstCosmeticPurchaseDay: string;
  /** Total cosmetic purchases (per-purchase log below). */
  cosmeticPurchases: number;
  /**
   * First-occurrence local day per goal tier id (t1–t5) — the gate
   * moments measured directly instead of via the `firstPrestigeDay`
   * proxy (pass 23 `analytics:tier-milestone`). Keyed by tier id so
   * content-added tiers need no migration; first occurrence wins.
   */
  firstTierDay: Record<string, string>;
  /**
   * Bounded per-purchase log (guardrail-5 granularity, features.md
   * pass-16 `cosmetics:analytics`): which line, which item, which path,
   * and the gem balance at the moment of purchase. Newest last, capped
   * at COSMETIC_PURCHASE_LOG_MAX (the catalog is small; the cap only
   * exists so a hand-edited record can't bloat the AsyncStorage row).
   */
  cosmeticPurchaseLog: CosmeticPurchaseEvent[];
  /**
   * One-shot first-use stamps (F27.4): epoch ms per gated feature
   * (FirstUseFeature) — "which entry points do players actually find, and
   * when", answerable from the local record. Absent key = never observed;
   * unknown keys are dropped at parse time (closed vocab).
   */
  firstUse: Record<string, number>;
};

/** The three cosmetic lines the catalog is organized by. */
export type CosmeticLine = "outfit" | "pickaxe" | "theme";

/** How the cosmetic was paid for: the in-game gem price or a store pack. */
export type CosmeticPurchasePath = "gems" | "iap";

/** One cosmetic purchase (the "day" field is stamped by the recorder). */
export type CosmeticPurchaseEvent = {
  line: CosmeticLine;
  /** Cosmetic / theme id (save ids, not product ids). */
  id: string;
  path: CosmeticPurchasePath;
  /** Gem balance at purchase (after the gem spend; unchanged for packs). */
  gems: number;
  /** Local day key of the purchase. */
  day: string;
};

/** Newest-last cap on the per-purchase log (see the state field). */
export const COSMETIC_PURCHASE_LOG_MAX = 100;

/** One IAP purchase (the "day" field is stamped by the recorder). */
export type IapPurchaseEvent = {
  /** The product purchased (a pack id, e.g. "packSkin"). */
  product: IapProductId;
  /** Local day key of the purchase. */
  day: string;
};

/** Newest-last cap on the IAP per-purchase log (see the state field). */
export const IAP_PURCHASE_LOG_MAX = 100;

/**
 * How many rows of each per-purchase log `summarizeAnalytics` renders
 * (the rest stay in the record; the readout is a debug surface, not an
 * export — F26.3).
 */
export const SUMMARY_RECENT_MAX = 10;

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
    firstAdKind: "",
    firstAdOutcome: "",
    firstIapPurchaseDay: "",
    iapPurchases: 0,
    iapPurchaseLog: [],
    firstPrestigeDay: "",
    prestiges: 0,
    firstCosmeticPurchaseDay: "",
    cosmeticPurchases: 0,
    cosmeticPurchaseLog: [],
    firstTierDay: {},
    firstUse: {},
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
    d1Retention: s.d1Retention || (returned && elapsed <= D1_RETENTION_MS),
    d7Retention: s.d7Retention || (returned && elapsed <= D7_RETENTION_MS),
  };
}

/** The moment the player first taps "watch" on a rewarded ad. */
export function recordAdView(
  state: AnalyticsState | null,
  now: number,
  kind: AdKind,
): AnalyticsState {
  const s = state ?? emptyAnalyticsState(now);
  return s.firstAdViewDay !== ""
    ? s
    : { ...s, firstAdViewDay: getLocalDayKey(now), firstAdKind: kind };
}

/**
 * The outcome of a rewarded-ad attempt (F26.4): only the FIRST attempt's
 * outcome is stamped (first-\* semantics — a later attempt, rewarded or
 * not, never overwrites it). Fired by the claim lifecycle after the
 * provider settles, so "rewarded" = the first tap actually played an ad,
 * "closed" = the player bailed, "error" = the ad never showed (no fill /
 * no provider) — the failure modes the day stamp alone can't see.
 */
export function recordAdOutcome(
  state: AnalyticsState | null,
  now: number,
  outcome: AdResult,
): AnalyticsState {
  const s = state ?? emptyAnalyticsState(now);
  return s.firstAdOutcome !== ""
    ? s
    : { ...s, firstAdOutcome: outcome };
}

/**
 * A store purchase completed + validated (wired when RevenueCat ships).
 * `productId` (known at every call site — the IAP hook fires it per pack)
 * adds a row to the per-purchase log, so the per-product counts the debug
 * readout shows are measurable on-device (F26.3). Omitted only by callers
 * that genuinely don't have an id (pre-2026-09 callers; the counter still
 * increments).
 */
export function recordIapPurchase(
  state: AnalyticsState | null,
  now: number,
  productId?: IapProductId,
): AnalyticsState {
  const s = state ?? emptyAnalyticsState(now);
  return {
    ...s,
    firstIapPurchaseDay: s.firstIapPurchaseDay || getLocalDayKey(now),
    iapPurchases: s.iapPurchases + 1,
    iapPurchaseLog:
      productId === undefined
        ? s.iapPurchaseLog
        : [...s.iapPurchaseLog, { product: productId, day: getLocalDayKey(now) }].slice(
            -IAP_PURCHASE_LOG_MAX,
          ),
  };
}

/**
 * A cosmetic was bought (features.md pass-16 `cosmetics:analytics`):
 * which line, which item, which path (the gem price vs a store pack —
 * "is this line carry spend via time or via money?"), and the gem
 * balance at the moment. Stamps the first-purchase day once, counts
 * every one, and keeps the bounded per-purchase log. Idempotency is the
 * caller's job (the engine gem buys and the IAP grant each fire once per
 * item); double-firing would only add a duplicate log line.
 */
export function recordCosmeticPurchase(
  state: AnalyticsState | null,
  event: Omit<CosmeticPurchaseEvent, "day">,
  now: number,
): AnalyticsState {
  const s = state ?? emptyAnalyticsState(now);
  return {
    ...s,
    firstCosmeticPurchaseDay: s.firstCosmeticPurchaseDay || getLocalDayKey(now),
    cosmeticPurchases: s.cosmeticPurchases + 1,
    cosmeticPurchaseLog: [
      ...s.cosmeticPurchaseLog,
      { ...event, day: getLocalDayKey(now) },
    ].slice(-COSMETIC_PURCHASE_LOG_MAX),
  };
}

/**
 * A goal tier (t1–t5, `goals.ts` GOAL_TIERS) is observed complete (pass 23
 * `analytics:tier-milestone`): stamps the first-occurrence local day for
 * that tier id — the gate moments (t1 = first purchasable line, t3 = the
 * prestige gate) measured directly instead of via the prestige proxy.
 * First occurrence wins; already-stamped tiers return `state` unchanged
 * (same reference — the caller skips the persist when nothing moved).
 * Tier ids are validated by shape (`t<digits>`) rather than catalog
 * membership, same stance as the cosmetic log's item ids — a downgraded
 * client keeps a newer client's stamps instead of dropping them.
 */
export function recordTierMilestone(
  state: AnalyticsState | null,
  tierId: string,
  now: number,
): AnalyticsState {
  const s = state ?? emptyAnalyticsState(now);
  if (!/^t\d+$/.test(tierId) || s.firstTierDay[tierId] !== undefined) {
    return s;
  }
  return {
    ...s,
    firstTierDay: { ...s.firstTierDay, [tierId]: getLocalDayKey(now) },
  };
}

/**
 * A prestige was sunk (free-path progress). Stamps the first-prestige day
 * once and counts every subsequent one — "free-path progress" (guardrail
 * 5) is a curve, not just a milestone, and the count is cheap.
 */
export function recordPrestige(
  state: AnalyticsState | null,
  now: number,
): AnalyticsState {
  const s = state ?? emptyAnalyticsState(now);
  return {
    ...s,
    firstPrestigeDay: s.firstPrestigeDay || getLocalDayKey(now),
    prestiges: s.prestiges + 1,
  };
}

/**
 * Read the stored record with a forward-compat migration (same posture as
 * the crash log: old records parse, new fields default in). Returns null
 * when the raw value is absent OR unparseable — the caller starts fresh.
 */
export function parseAnalytics(raw: string | null): AnalyticsState | null {
  if (raw == null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return null;
  }
  const o = parsed as Record<string, unknown>;
  // Anchor: fall back to "now" for a record missing firstOpenMs (can't
  // happen for records this app wrote, but the default must be safe).
  const base = emptyAnalyticsState(Date.now());
  const num = (v: unknown, dflt: number): number =>
    typeof v === "number" && Number.isFinite(v) ? v : dflt;
  const str = (v: unknown): string => (typeof v === "string" ? v : "");
  const bool = (v: unknown): boolean => (typeof v === "boolean" ? v : false);
  const firstOpenMs = num(o.firstOpenMs, base.firstOpenMs);
  const firstOpenDay = str(o.firstOpenDay) || base.firstOpenDay;
  return {
    firstOpenMs,
    lastOpenMs: num(o.lastOpenMs, firstOpenMs),
    firstOpenDay,
    lastOpenDay: str(o.lastOpenDay) || firstOpenDay,
    activeDays: Math.max(0, Math.floor(num(o.activeDays, 1))),
    d1Retention: bool(o.d1Retention),
    d7Retention: bool(o.d7Retention),
    firstAdViewDay: str(o.firstAdViewDay),
    firstAdKind: validAdKind(o.firstAdKind),
    firstAdOutcome: validAdOutcome(o.firstAdOutcome),
    firstIapPurchaseDay: str(o.firstIapPurchaseDay),
    iapPurchases: Math.max(0, Math.floor(num(o.iapPurchases, 0))),
    iapPurchaseLog: sanitizeIapPurchaseLog(o.iapPurchaseLog),
    firstPrestigeDay: str(o.firstPrestigeDay),
    // Legacy records predate the counter: a stamped first day implies ≥1.
    prestiges: Math.max(
      0,
      Math.floor(num(o.prestiges, 0)),
      str(o.firstPrestigeDay) !== "" ? 1 : 0,
    ),
    firstCosmeticPurchaseDay: str(o.firstCosmeticPurchaseDay),
    cosmeticPurchases: Math.max(0, Math.floor(num(o.cosmeticPurchases, 0))),
    // Forward-compat + corruption guard: keep only well-formed entries,
    // newest last, capped (a hand-edited record can't bloat the log).
    cosmeticPurchaseLog: sanitizeCosmeticPurchaseLog(o.cosmeticPurchaseLog),
    firstTierDay: sanitizeFirstTierDay(o.firstTierDay),
    firstUse: sanitizeFirstUse(o.firstUse),
  };
}

/**
 * Corruption guard for the tier-milestone stamps: keep only string keys
 * shaped like a tier id and non-empty string day values (a hand-edited
 * record must not crash the debug panel).
 */
function sanitizeFirstTierDay(raw: unknown): Record<string, string> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return {};
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (/^t\d+$/.test(k) && typeof v === "string" && v !== "") out[k] = v;
  }
  return out;
}

/**
 * Corruption guard for the per-purchase log: keep only well-formed
 * entries (hand-edited records must not crash the debug panel), newest
 * last, capped — the same forward-compat posture the rest of the parse
 * takes.
 */
function sanitizeCosmeticPurchaseLog(raw: unknown): CosmeticPurchaseEvent[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isCosmeticPurchaseEvent).slice(-COSMETIC_PURCHASE_LOG_MAX);
}

function isCosmeticPurchaseEvent(e: unknown): e is CosmeticPurchaseEvent {
  if (typeof e !== "object" || e === null) return false;
  const o = e as Record<string, unknown>;
  return (
    (o.line === "outfit" || o.line === "pickaxe" || o.line === "theme") &&
    typeof o.id === "string" &&
    (o.path === "gems" || o.path === "iap") &&
    typeof o.gems === "number" &&
    Number.isFinite(o.gems) &&
    typeof o.day === "string"
  );
}

/**
 * Corruption guard for the IAP per-purchase log: same posture as the
 * cosmetic log's (non-empty product string, string day, newest last,
 * capped). Product ids are not checked against the catalog — same stance
 * as the cosmetic log's item `id` — so a downgraded client reading a
 * newer record's rows keeps them rather than silently losing them.
 */
function sanitizeIapPurchaseLog(raw: unknown): IapPurchaseEvent[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isIapPurchaseEvent).slice(-IAP_PURCHASE_LOG_MAX);
}

function isIapPurchaseEvent(e: unknown): e is IapPurchaseEvent {
  if (typeof e !== "object" || e === null) return false;
  const o = e as Record<string, unknown>;
  return (
    typeof o.product === "string" &&
    o.product !== "" &&
    typeof o.day === "string"
  );
}

/**
 * The first-use stamp family (F27.4, docs/gap-ranking.md pass 27): one
 * one-shot timestamp per gated entry point, so "which of the eight entries
 * do players actually find, and when" is answerable from the local record
 * (read in the About tab, exportable like every other field — nothing
 * leaves the device). The vocab is CLOSED: a typo'd feature is a type
 * error at the call site, and sanitizeFirstUse drops unknown keys a
 * hand-edited record might carry.
 */
export const FIRST_USE_FEATURES = [
  "daily-equation",
  "weekly-claim",
  "leaderboard-open",
  "records-tab",
  "collection-tab",
  "goals-tab",
  "save-code-export",
  "cloud-link",
] as const;
export type FirstUseFeature = (typeof FIRST_USE_FEATURES)[number];

const FIRST_USE_FEATURE_SET: ReadonlySet<string> = new Set(
  FIRST_USE_FEATURES,
);

/**
 * Corruption guard for the first-use stamps: keep only keys from the closed
 * FirstUseFeature vocab with finite numeric timestamps (a hand-edited record
 * must not bloat the row or reach the debug panel with junk).
 */
function sanitizeFirstUse(raw: unknown): Record<string, number> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return {};
  }
  const out: Record<string, number> = {};
  for (const [feature, ts] of Object.entries(raw)) {
    if (FIRST_USE_FEATURE_SET.has(feature) && typeof ts === "number") {
      out[feature] = ts;
    }
  }
  return out;
}

/**
 * Stamp the first use of a gated feature (F27.4). Idempotent per feature —
 * re-firing (strict mode, repeated opens) never moves the stamp, so call
 * sites fire unguarded at the natural moment (button press, view switch,
 * sign-in settle). `state` may be null: the stamp establishes the record,
 * exactly like every other record* here.
 */
export function recordFeatureFirstUse(
  state: AnalyticsState | null,
  feature: FirstUseFeature,
  now: number,
): AnalyticsState {
  const prev = state ?? emptyAnalyticsState(now);
  const firstUse = { ...(prev.firstUse ?? {}) };
  if (!(feature in firstUse)) firstUse[feature] = now;
  return { ...prev, firstUse };
}

/**
 * One-line-per-field human-readable summary of the record — rendered in
 * Settings → "Local stats (debug)" (selectable, so it can be copied or
 * long-press-shared off-device) and the format a data-deletion/export
 * request expects. Deliberately plain text: no PII, stable field order,
 * "never" for one-shot fields that haven't fired. After the fixed field
 * block come variable blocks (only when non-empty): per-product IAP
 * counts, the newest SUMMARY_RECENT_MAX rows of each per-purchase log
 * (F26.3 — the readout reflects the record, not just its counters), and
 * the tier-milestone stamps (pass 23 — the gate moments, data-driven by
 * whichever tiers have been observed).
 */
/**
 * Parse-time validation of the first-ad stamps: a persisted value outside
 * the AdKind/AdResult vocab (hand-edited record) drops to "" — the same
 * corruption guard the other fields get. The value lists live in ads.ts
 * next to the types, so the vocab can't drift.
 */
function validAdKind(v: unknown): string {
  return typeof v === "string" && (AD_KIND_VALUES as readonly string[]).includes(v)
    ? v
    : "";
}

function validAdOutcome(v: unknown): string {
  return typeof v === "string" &&
    (AD_OUTCOME_VALUES as readonly string[]).includes(v)
    ? v
    : "";
}

/**
 * The "first ad view" summary line: the day plus the first-attempt kind
 * and outcome in parentheses when stamped. Pre-F26.4 records (and fresh
 * records, where the day is "never") render exactly the bare line.
 */
function adViewLine(state: AnalyticsState): string {
  const day = state.firstAdViewDay === "" ? "never" : state.firstAdViewDay;
  if (state.firstAdKind === "") return day;
  const extra =
    state.firstAdOutcome === ""
      ? state.firstAdKind
      : `${state.firstAdKind}, ${state.firstAdOutcome}`;
  return `${day} (${extra})`;
}

export function summarizeAnalytics(state: AnalyticsState): string {
  const day = (d: string) => (d === "" ? "never" : d);
  const yesno = (b: boolean) => (b ? "yes" : "no");
  const lines = [
    `first open      ${state.firstOpenDay}`,
    `last open       ${state.lastOpenDay}`,
    `active days     ${state.activeDays}`,
    `d1 retention    ${yesno(state.d1Retention)}`,
    `d7 retention    ${yesno(state.d7Retention)}`,
    // kind/outcome decorate the day only when stamped (pre-F26.4 records
    // — and fresh records — render the bare line, exactly as before).
    `first ad view   ${adViewLine(state)}`,
    `iap purchases   ${state.iapPurchases}`,
    `first iap       ${day(state.firstIapPurchaseDay)}`,
    `cosmetic purchases   ${state.cosmeticPurchases}`,
    `first cosmetic       ${day(state.firstCosmeticPurchaseDay)}`,
    `prestiges       ${state.prestiges}`,
    `first prestige  ${day(state.firstPrestigeDay)}`,
  ];
  // Per-product IAP counts ("which product sold", F26.3) — only products
  // with at least one recorded row; purchases recorded before the log
  // existed are in the counter but have no row, and that is the honest
  // shape of the data.
  if (state.iapPurchaseLog.length > 0) {
    const counts = new Map<IapProductId, number>();
    for (const e of state.iapPurchaseLog) {
      counts.set(e.product, (counts.get(e.product) ?? 0) + 1);
    }
    lines.push(
      `iap by product   (${state.iapPurchaseLog.length} logged)`,
    );
    const sorted = [...counts.entries()].sort((a, b) =>
      a[0].localeCompare(b[0]),
    );
    for (const [product, n] of sorted) {
      lines.push(`  ${product.padEnd(14)} ${n}`);
    }
  }
  const recentCosmetics = state.cosmeticPurchaseLog.slice(-SUMMARY_RECENT_MAX);
  if (recentCosmetics.length > 0) {
    lines.push(
      `recent cosmetics   (last ${recentCosmetics.length} of ${state.cosmeticPurchaseLog.length})`,
    );
    for (const e of recentCosmetics) {
      lines.push(
        `  ${e.day}  ${e.line}:${e.id}  ${e.path}  gems=${e.gems}`,
      );
    }
  }
  const recentIap = state.iapPurchaseLog.slice(-SUMMARY_RECENT_MAX);
  if (recentIap.length > 0) {
    lines.push(
      `recent iap   (last ${recentIap.length} of ${state.iapPurchaseLog.length})`,
    );
    for (const e of recentIap) {
      lines.push(`  ${e.day}  ${e.product}`);
    }
  }
  // Tier milestones (pass 23): data-driven — one line per stamped tier,
  // natural order (t1 < t2 < … by numeric suffix), omitted when the
  // player hasn't hit any gate yet.
  const tierDays = Object.entries(state.firstTierDay).sort((a, b) => {
    const na = Number(a[0].slice(1));
    const nb = Number(b[0].slice(1));
    return na === nb ? a[0].localeCompare(b[0]) : na - nb;
  });
  if (tierDays.length > 0) {
    lines.push(`tier first days   (${tierDays.length})`);
    for (const [tierId, d] of tierDays) {
      lines.push(`  ${tierId}  ${d}`);
    }
  }
  // First-use stamps (F27.4): data-driven — one line per stamped feature in
  // the closed vocab order, local day key, omitted when none fired yet.
  const firstUsed = FIRST_USE_FEATURES.filter((f) => f in state.firstUse);
  if (firstUsed.length > 0) {
    lines.push(`first use  (${firstUsed.length})`);
    for (const f of firstUsed) {
      lines.push(`  ${f}  ${getLocalDayKey(state.firstUse[f])}`);
    }
  }
  return lines.join("\n");
}
