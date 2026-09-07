/**
 * Gem pocket (features.md §7 "Random in-game events"): a rare bonus node
 * that forms somewhere in the cave while the game is open. It pays a
 * mineral bonus scaled to the player's current effective click power when
 * tapped, and simply fades away (ungained) if it's left alone — a small
 * idle-loop "something new in the cave" encounter with zero penalty.
 *
 * Guardrails: the window is REAL (the pocket actually expires; there is
 * no fake urgency), the reward is pure upside (missing it costs nothing),
 * and nothing is gated — every player gets the same odds, free players
 * included (the F2P-viability guardrail).
 *
 * State is deliberately NOT persisted: a pocket is a session-long
 * transient, like the floating juice text, and a reload must never
 * resurrect (or forfeit) one.
 */

/** One live pocket. `bonus` is fixed at spawn time (no late recompute). */
export type GemPocket = {
  /** `Date.now()` when it formed — also drives expiry and the cooldown. */
  spawnedAt: number;
  /** Exact minerals a collect grants (safe integer, see computePocketBonus). */
  bonus: number;
  /** Deterministic position variant (see pocketPosition). */
  seed: number;
};

/** How long a pocket stays tappable once formed. */
export const POCKET_LIFETIME_MS = 30_000;
/** Quiet period after a pocket ended before the next one may form. */
export const POCKET_COOLDOWN_MS = 5 * 60_000;
/** Odds per 1s check once the cooldown has elapsed (mean ~2 min extra). */
export const POCKET_SPAWN_CHANCE = 1 / 120;
/** The bonus is worth this many full clicks of the effective click power. */
export const POCKET_CLICKS = 8;
/** Early-game floor so the pocket is always worth more than a click. */
export const POCKET_MIN_BONUS = 20;
/** Hard cap on the power used in the bonus math (Number-overflow safety). */
export const POCKET_POWER_CAP = 1_000_000_000;

/**
 * What a pocket would pay: ~POCKET_CLICKS clicks of the player's effective
 * click power (depth tiers, click upgrades, boosts included — whatever
 * the tap button is worth right now), floored at POCKET_MIN_BONUS so a
 * brand-new save still gets a meaningful nudge. Capped so the number
 * stays a safe integer no matter how far the economy grows.
 */
export function computePocketBonus(clickPower: number | bigint): number {
  const raw = typeof clickPower === "bigint" ? Number(clickPower) : clickPower;
  const power =
    Number.isFinite(raw) && raw > 0 ? Math.min(Math.floor(raw), POCKET_POWER_CAP) : 0;
  return Math.max(POCKET_MIN_BONUS, power * POCKET_CLICKS);
}

/** Has the pocket's real window run out? */
export function isPocketExpired(pocket: GemPocket, now: number): boolean {
  return now - pocket.spawnedAt >= POCKET_LIFETIME_MS;
}

/** When the next pocket may form after THIS one ends (fade or collect). */
export function pocketCooldownUntil(pocket: GemPocket): number {
  return pocket.spawnedAt + POCKET_LIFETIME_MS + POCKET_COOLDOWN_MS;
}

export type PocketSpawnInput = {
  now: number;
  /** A live (non-expired) pocket — one at a time, ever. */
  active: GemPocket | null;
  /** Next-spawn-eligible timestamp (0 = eligible immediately). */
  cooldownUntil: number;
  /** Effective click power at spawn time (drives the bonus). */
  clickPower: number | bigint;
};

/**
 * The spawn roll, kept pure so the odds are unit-testable with a
 * deterministic rng: never while one is live, never before the cooldown
 * ends, otherwise POCKET_SPAWN_CHANCE per call.
 */
export function rollPocketSpawn(
  input: PocketSpawnInput,
  rng: () => number,
): GemPocket | null {
  const { now, active, cooldownUntil, clickPower } = input;
  if (active != null) return null;
  if (now < cooldownUntil) return null;
  if (rng() >= POCKET_SPAWN_CHANCE) return null;
  return {
    spawnedAt: now,
    bonus: computePocketBonus(clickPower),
    seed: Math.floor(rng() * 0x7fffffff),
  };
}

const frac = (x: number) => x - Math.floor(x);

/**
 * Deterministic in-cave spot for a seed: golden-ratio hashing keeps the
 * same seed on the same spot (tests + no flicker across re-renders) while
 * staying inside safe zones — clear of the HUD counts up top and the
 * miner rows at the bottom.
 */
export function pocketPosition(seed: number): {
  leftPct: number;
  topPct: number;
} {
  const s = Math.abs(Math.floor(seed)) >>> 0;
  return {
    leftPct: 10 + frac(s * 0.6180339887) * 60, // 10..70 %
    topPct: 16 + frac(s * 0.4142135623 + 0.5) * 44, // 16..60 %
  };
}
