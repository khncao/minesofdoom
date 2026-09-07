import {
  GemPocket,
  POCKET_CLICKS,
  POCKET_COOLDOWN_MS,
  POCKET_LIFETIME_MS,
  POCKET_MIN_BONUS,
  POCKET_POWER_CAP,
  POCKET_SPAWN_CHANCE,
  computePocketBonus,
  isPocketExpired,
  pocketCooldownUntil,
  pocketPosition,
  rollPocketSpawn,
} from "../gemPocket";

const T0 = 1_700_000_000_000;
const pocket = (over: Partial<GemPocket> = {}): GemPocket => ({
  spawnedAt: T0,
  bonus: 100,
  seed: 12345,
  ...over,
});

/** A deterministic rng that returns the scripted values in order. */
const seqRng = (values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe("computePocketBonus", () => {
  it("is clickPower × POCKET_CLICKS for meaningful powers", () => {
    expect(computePocketBonus(100)).toBe(100 * POCKET_CLICKS);
    expect(computePocketBonus(1234)).toBe(1234 * POCKET_CLICKS);
  });
  it("accepts bigint click powers", () => {
    expect(computePocketBonus(250n)).toBe(250 * POCKET_CLICKS);
  });
  it("floors at POCKET_MIN_BONUS for a fresh save (click power 1)", () => {
    expect(computePocketBonus(1)).toBe(POCKET_MIN_BONUS);
    expect(computePocketBonus(0)).toBe(POCKET_MIN_BONUS);
  });
  it("caps the power so the result stays a safe integer", () => {
    const huge = (1n << 100n).toString(); // Number() of this is Infinity
    expect(computePocketBonus(BigInt(huge))).toBe(POCKET_POWER_CAP * POCKET_CLICKS);
    expect(Number.isSafeInteger(POCKET_POWER_CAP * POCKET_CLICKS)).toBe(true);
  });
});

describe("isPocketExpired", () => {
  it("is false inside the window and true once it runs out", () => {
    const p = pocket();
    expect(isPocketExpired(p, p.spawnedAt)).toBe(false);
    expect(isPocketExpired(p, p.spawnedAt + POCKET_LIFETIME_MS - 1)).toBe(false);
    expect(isPocketExpired(p, p.spawnedAt + POCKET_LIFETIME_MS)).toBe(true);
    expect(isPocketExpired(p, p.spawnedAt + 10 * POCKET_LIFETIME_MS)).toBe(true);
  });
});

describe("pocketCooldownUntil", () => {
  it("is lifetime + cooldown past the spawn (next one may form then)", () => {
    const p = pocket();
    expect(pocketCooldownUntil(p)).toBe(p.spawnedAt + POCKET_LIFETIME_MS + POCKET_COOLDOWN_MS);
  });
});

describe("rollPocketSpawn", () => {
  const input = (over: Partial<Parameters<typeof rollPocketSpawn>[0]> = {}) => ({
    now: T0,
    active: null as GemPocket | null,
    cooldownUntil: 0,
    clickPower: 100,
    ...over,
  });

  it("never spawns while a pocket is live (the roll is never drawn)", () => {
    const rng = seqRng([0]); // a would-be successful roll
    expect(
      rollPocketSpawn(input({ active: pocket() }), rng),
    ).toBeNull();
  });

  it("never spawns before the cooldown has elapsed", () => {
    const rng = seqRng([0]);
    expect(
      rollPocketSpawn(
        input({ cooldownUntil: T0 + POCKET_COOLDOWN_MS, active: null }),
        rng,
      ),
    ).toBeNull();
  });

  it("rolls at exactly the cooldown boundary and honors the chance", () => {
    const eligible = input({
      cooldownUntil: T0, // now < cooldownUntil is the guard; equal is eligible
      active: null,
    });
    const rng = seqRng([0]);
    const rolled = rollPocketSpawn(eligible, rng);
    expect(rolled).not.toBeNull();
    expect(rolled?.bonus).toBe(computePocketBonus(100));
    expect(rolled?.spawnedAt).toBe(T0);

    const refused = rollPocketSpawn(eligible, seqRng([1]));
    expect(refused).toBeNull();
    expect(POCKET_SPAWN_CHANCE).toBeCloseTo(1 / 120);
  });

  it("stays quiet for a whole realistic session most of the time", () => {
    // 1s checks for 10 minutes after the cooldown: with p=1/120 the
    // probability of at least one spawn is 1 − (119/120)^600 ≈ 99.99%.
    // A fixed-seed pseudo-rng pinned just below the chance must ALWAYS
    // spawn on the first check; one just above it must never.
    const eligible = input({ cooldownUntil: T0 - 1, active: null });
    expect(rollPocketSpawn(eligible, () => POCKET_SPAWN_CHANCE - 0.0001)).not.toBeNull();
    expect(rollPocketSpawn(eligible, () => POCKET_SPAWN_CHANCE + 0.0001)).toBeNull();
  });

  it("assigns a safe non-negative seed", () => {
    const rolled = rollPocketSpawn(input(), () => POCKET_SPAWN_CHANCE - 0.001);
    expect(rolled).not.toBeNull();
    expect(rolled!.seed).toBeGreaterThanOrEqual(0);
    expect(Number.isSafeInteger(rolled!.seed)).toBe(true);
  });
});

describe("pocketPosition", () => {
  it("is deterministic for a given seed", () => {
    const a = pocketPosition(987654);
    const b = pocketPosition(987654);
    expect(a).toEqual(b);
  });
  it("stays inside the safe zone (clear of HUD top and miner rows bottom)", () => {
    for (let seed = 0; seed < 2000; seed++) {
      const { leftPct, topPct } = pocketPosition(seed);
      expect(leftPct).toBeGreaterThanOrEqual(10);
      expect(leftPct).toBeLessThanOrEqual(70);
      expect(topPct).toBeGreaterThanOrEqual(16);
      expect(topPct).toBeLessThanOrEqual(60);
    }
  });
  it("spreads different seeds to different spots", () => {
    const spots = new Set(
      Array.from({ length: 20 }, (_, i) => {
        const { leftPct, topPct } = pocketPosition(1000 + i * 7919);
        return `${leftPct.toFixed(2)},${topPct.toFixed(2)}`;
      }),
    );
    expect(spots.size).toBeGreaterThan(10);
  });
  it("handles hostile seeds (negative, fractional, zero)", () => {
    for (const seed of [-1, 0.5, 0, Number.MAX_SAFE_INTEGER]) {
      const { leftPct, topPct } = pocketPosition(seed);
      expect(leftPct).toBeGreaterThanOrEqual(10);
      expect(leftPct).toBeLessThanOrEqual(70);
      expect(topPct).toBeGreaterThanOrEqual(16);
      expect(topPct).toBeLessThanOrEqual(60);
    }
  });
});
