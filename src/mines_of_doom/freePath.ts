/**
 * Free-path benchmark (plan §5, guardrail 1: "F2P is viable, not just
 * unpaywalled").
 *
 * The plan's enforceable constraint: *a pure free player should reach first
 * prestige (banking prestige level 1, i.e. lifetime minerals reaching
 * PRESTIGE_LEVELS[1].at) within ~7 days of normal idle + play* — with no
 * ads, no IAP, no dev tools, only the in-game economy (equations, taps,
 * miners, gem minting, gem upgrades, the daily bonus).
 *
 * This module simulates that persona by driving the SAME pure rules the
 * engine uses (every gain formula, cost curve, and cap is imported from
 * game.ts / dailyBonus.ts rather than re-implemented), so a balance change
 * in game.ts that slows the free path breaks `freePath.test.ts` in CI and
 * the fix is to rebalance, not to sell the difference.
 *
 * Persona (see DEFAULT_FREE_PATH_PERSONA): a free casual player who each day
 * claims the daily bonus, closes the app for the night (offline earnings,
 * capped at the game's 8h), then plays one 2h evening session — answering
 * an equation every 10s (90% accuracy, misses reset the combo through the
 * normal resistance path), hold-tapping the cave every 4s, and spending
 * through the greedy "normal player" shopping policy below. Fully
 * deterministic for a fixed seed (no Date.now, no unseeded Math.random).
 *
 * Deliberately a regression FLOOR, not an optimality proof: the persona is
 * ordinary, and the assertion has slack. It catches balance regressions
 * (a cost curve change that quietly walls off prestige), not playtesting.
 */
import {
  PRESTIGE_LEVELS,
  computeOfflineMinerals,
  gemMineralCost,
  getClickBoostCost,
  getClickBoostMultiplier,
  getClickUpgradeCost,
  getComboResistCost,
  getComboMultiplier,
  getDepth,
  getDepthTier,
  getFastMinerCost,
  getGemChance,
  getGemChanceCost,
  getLegendaryMinerCost,
  getMineralsPerSec,
  getMinerPowerUpgradeCost,
  getMinerUpgradeCost,
  getResistantComboReset,
} from "./game";
import { DAILY_STREAK_CAP, getDailyBonus } from "./dailyBonus";

/**
 * The §5 target, operationalized. `firstPrestigeLifetime` is the lifetime
 * minerals needed to *bank* prestige level 1; `maxDays` is the plan's
 * "~7 days of normal idle+play" bound the persona must beat.
 */
export const FREE_PATH_TARGET = {
  firstPrestigeLifetime: PRESTIGE_LEVELS[1].at,
  maxDays: 7,
};

export type FreePathPersona = {
  /** Active play per day: one evening session (2h). */
  activeSecondsPerDay: number;
  /** App-closed time per day (22h); offline earnings cap at the game's
   * 8h via computeOfflineMinerals, so this only needs to exceed 8h. */
  offlineSecondsPerDay: number;
  /** Seconds per answer: read + type + submit. */
  secondsPerAnswer: number;
  /** Fraction of answers that are correct (misses reset the combo with
   * resistance, exactly like the real wrong-answer path). */
  accuracy: number;
  /** Seconds between hold-to-mine cave taps (each resets the combo). */
  secondsPerTap: number;
  /**
   * Expected raw answer value (answer × operator bonus) for the persona's
   * equation settings. Default is the DEFAULT settings (multiply-only,
   * numbers in [0, 12)): E[a·b] = ((12-1)/2)² = 30.25, floored to 30. A
   * benchmark player plays the settings as shipped.
   */
  expectedEquationValue: number;
  /** RNG seed (deterministic simulation). */
  seed: number;
  /**
   * Stop the run the moment first prestige is bankable (the §5 target).
   * Set false to let the persona keep playing past prestige — used to
   * measure long-horizon gem income for balance questions (e.g. whether a
   * free player can ever afford the full cosmetic collection).
   */
  stopAtFirstPrestige?: boolean;
};

export const DEFAULT_FREE_PATH_PERSONA: FreePathPersona = {
  activeSecondsPerDay: 2 * 60 * 60,
  offlineSecondsPerDay: 22 * 60 * 60,
  secondsPerAnswer: 10,
  accuracy: 0.9,
  secondsPerTap: 4,
  expectedEquationValue: 30,
  seed: 20_260_902, // arbitrary fixed seed — the benchmark is reproducible
};

/**
 * A pure free player drives the first-prestige path within the §5 target:
 * simulate DEFAULT_FREE_PATH_PERSONA and assert the report. Returns the
 * report so tests (and future balance-tuning sessions) can inspect the
 * per-day breakdown when a run is slower than expected.
 */
export function simulateFreePath(
  persona: FreePathPersona = DEFAULT_FREE_PATH_PERSONA,
  maxDays: number = 30,
): FreePathReport {
  const rng = mulberry32(persona.seed);

  // Run resources & banked upgrades — the free player starts at the empty
  // save, exactly like a real install.
  let minerals = 0;
  let lifetime = 0;
  let gems = 0;
  let clickPower = 1;
  let miners = 0;
  let minerPower = 1;
  let fastMiners = 0;
  let legendaryMiners = 0;
  let gemChanceLevels = 0;
  let clickBoostLevels = 0;
  let comboResistLevels = 0;
  // Prestige: the benchmark stops AT first prestige, so the banked level
  // (and multiplier) stays at 0/x1 throughout.
  const prestige = 1;
  let dailyStreak = 0;
  // Combo is session-scoped (like the app): it resets at each session start.
  let combo = 0;

  const earned = {
    answers: 0,
    taps: 0,
    passive: 0,
    offline: 0,
    daily: 0,
  };
  // Lifetime gem income by source (the benchmark's gem-sink pressure gauge —
  // gem drops scale with the combo, mints scale with mineral throughput).
  const gemGains = { drops: 0, mints: 0 };
  const perDay: FreePathDay[] = [];

  const addGain = (amount: number, source: keyof typeof earned) => {
    minerals += amount;
    lifetime += amount;
    earned[source] += amount;
  };

  /**
   * The "normal player" shopping policy, checked every second. Priority
   * mirrors how the UI surfaces the buttons (core loop first) and the caps
   * keep minerals from ever being parked in a dead-end sink (a free player
   * doesn't, e.g., pour 6M minerals into a click-power level they'll never
   * miss). All cost curves are the engine's own (game.ts).
   */
  const shop = () => {
    // 1. Get the passive engine running as fast as gems allow: a normal
    //    miner (quartic gem curve — the economy self-throttles, so no cap).
    if (gems >= getMinerUpgradeCost(miners)) {
      gems -= getMinerUpgradeCost(miners);
      miners += 1;
    }
    // 2. Miner power: each level multiplies the WHOLE roster's output;
    //    only worth buying with a crew (>= 2) and only while the payback
    //    stays sensible (absolute cap).
    const mpCost = getMinerPowerUpgradeCost(minerPower);
    if (miners >= 2 && mpCost <= 500_000 && minerals >= mpCost) {
      minerals -= mpCost;
      minerPower += 1;
    }
    // 3. Click power: the early-game mineral sink (quartic); stop once it's
    //    pricier than a chunky mineral haul (cap ~= level 7).
    const cpCost = getClickUpgradeCost(clickPower);
    if (cpCost <= 2_500 && minerals >= cpCost) {
      minerals -= cpCost;
      clickPower += 1;
    }
    // 4. Mint a gem (the free player's gem faucet) while the gem hoard is
    //    thin — the gem sinks below are the hoard's purpose.
    if (gems < 40 && minerals >= gemMineralCost) {
      minerals -= gemMineralCost;
      gems += 1;
      gemGains.mints += 1;
    }
    // 5. Gem upgrade lines & second/third miner types, in "when you meet
    //    them" order (fast miners first — cheapest per output, then the
    //    quality-of-life lines, legendary as the endgame raw-output sink).
    if (gems >= getFastMinerCost(fastMiners)) {
      gems -= getFastMinerCost(fastMiners);
      fastMiners += 1;
    }
    if (
      gems >= getGemChanceCost(gemChanceLevels)
    ) {
      gems -= getGemChanceCost(gemChanceLevels);
      gemChanceLevels += 1;
    }
    if (gems >= getClickBoostCost(clickBoostLevels)) {
      gems -= getClickBoostCost(clickBoostLevels);
      clickBoostLevels += 1;
    }
    if (gems >= getComboResistCost(comboResistLevels)) {
      gems -= getComboResistCost(comboResistLevels);
      comboResistLevels += 1;
    }
    if (gems >= getLegendaryMinerCost(legendaryMiners)) {
      gems -= getLegendaryMinerCost(legendaryMiners);
      legendaryMiners += 1;
    }
  };

  const answer = () => {
    if (rng() < persona.accuracy) {
      // Correct: paid with the combo as it stands (the engine pays
      // pre-increment, see MinesOfDoom's onCorrect), depth-tier bonus,
      // banked prestige, and the click x2 line — exactly
      // applyAnswerReward's formula with the persona's expected value.
      const comboMult = getComboMultiplier(combo);
      const depthBonus = getDepthTier(getDepth(minerals)).clickBonus;
      addGain(
        Math.max(1, persona.expectedEquationValue) *
          clickPower *
          comboMult *
          depthBonus *
          prestige *
          getClickBoostMultiplier(clickBoostLevels),
        "answers",
      );
      // Gem roll: same chance × combo-multiplier formula as rollGem,
      // through the seeded RNG (rollGem's own roll is left to the app).
      if (rng() < getGemChance(gemChanceLevels) * comboMult) {
        gems += 1;
        gemGains.drops += 1;
      }
      combo += 1;
    } else {
      // Miss: the normal wrong-answer path — combo resistance applies.
      combo = getResistantComboReset(combo, comboResistLevels);
    }
  };

  const tap = () => {
    // Hold-to-mine: click power × depth bonus × prestige × click x2
    // (effectiveClickPower in MinesOfDoom), and the tap RESETS the combo
    // (with resistance) just like the real onResetCombo path.
    combo = getResistantComboReset(combo, comboResistLevels);
    const depthBonus = getDepthTier(getDepth(minerals)).clickBonus;
    addGain(
      clickPower * depthBonus * prestige * getClickBoostMultiplier(clickBoostLevels),
      "taps",
    );
  };

  for (let day = 1; day <= maxDays; day++) {
    // Morning: claim the daily bonus (the retention surface every free
    // player taps; streak-capped by the game's own rule).
    dailyStreak = Math.min(dailyStreak + 1, DAILY_STREAK_CAP);
    addGain(getDailyBonus(dailyStreak), "daily");

    // Night: the app was closed — offline earnings at the game's cap.
    const offline = computeOfflineMinerals(
      miners,
      minerPower,
      fastMiners,
      0,
      persona.offlineSecondsPerDay,
      prestige,
      legendaryMiners,
    );
    if (offline > 0) addGain(offline, "offline");

    // Evening session, second by second.
    combo = 0;
    const sessionSeconds = persona.activeSecondsPerDay;
    for (let t = 1; t <= sessionSeconds; t++) {
      const pps =
        getMineralsPerSec(miners, minerPower, fastMiners, legendaryMiners) *
        prestige;
      if (pps > 0) addGain(pps, "passive");
      // Tap and answer cadences are independent; when both fire the same
      // second, the tap goes first (deterministic, and matches a player who
      // stops tapping to answer).
      if (t % persona.secondsPerTap === 0) tap();
      if (t % persona.secondsPerAnswer === 0) answer();
      shop();

      if (
        (persona.stopAtFirstPrestige ?? true) &&
        lifetime >= FREE_PATH_TARGET.firstPrestigeLifetime
      ) {
        return {
          reached: true,
          days: (day - 1) + t / sessionSeconds,
          simulatedDays: maxDays,
          lifetimeMinerals: lifetime,
          earned,
          gemGains,
          perDay,
        };
      }
    }
    perDay.push({
      day,
      lifetime,
      mineralsPerSec: getMineralsPerSec(
        miners,
        minerPower,
        fastMiners,
        legendaryMiners,
      ),
      gems,
    });
  }

  return {
    reached: false,
    days: maxDays,
    simulatedDays: maxDays,
    lifetimeMinerals: lifetime,
    earned,
    gemGains,
    perDay,
  };
}

export type FreePathDay = {
  day: number;
  lifetime: number;
  /** Passive income at end of day (minerals/sec, pre-prestige). */
  mineralsPerSec: number;
  gems: number;
};

export type FreePathReport = {
  /** True when lifetime crossed FREE_PATH_TARGET.firstPrestigeLifetime. */
  reached: boolean;
  /**
   * Wall-clock days (fractional: the day's active session is prorated by
   * how far through it the threshold was crossed). Equals `simulatedDays`
   * when the run never crossed.
   */
  days: number;
  simulatedDays: number;
  lifetimeMinerals: number;
  /**
   * Total gems earned (dropped from the rock or minted from minerals), by
   * source. Lifetime, not the end-of-run hoard (the hoard is spent).
   */
  gemGains: {
    drops: number;
    mints: number;
  };
  /** Total lifetime minerals per source (should sum to lifetimeMinerals). */
  earned: {
    answers: number;
    taps: number;
    passive: number;
    offline: number;
    daily: number;
  };
  /** End-of-day snapshots for balance-tuning diagnostics. */
  perDay: FreePathDay[];
};

/**
 * Small deterministic PRNG (mulberry32) so the benchmark is reproducible
 * in CI and across platforms — the same seed always plays the same run.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
