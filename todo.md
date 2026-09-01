# Iteration 3 — Tier-3 content: prestige / "New Shaft"

Continues phase 7 (see `docs/todo.md` — last log entry: "Next: prestige/New
Shaft (tier 3)").

Unlocks behind goal tier 3 ("Magma Frontier", `goals.ts`), per plan §4.6:
**Prestige / "New Shaft"** (§4.1) — the long-term goal that gives the idle
loop a reason to keep going. This is the headline tier-3 unlock; the extra gem
upgrade lines from §4.6 (click ×2, combo resistance) stay a later iteration.

## Design

Prestige is the classic "bank a permanent multiplier for a fresh run" loop:

- **Permanent multiplier** from a stepped table (`PRESTIGE_LEVELS` in
  `game.ts`) keyed by **lifetime** minerals (a stat that never resets, so a
  banked level can never be lost by spending). Stepped, not continuous, so
  "banking a new level" is a discrete, meaningful event — between two
  thresholds the available level is fixed, so you can't re-prestige until
  lifetime crosses the next rung.
  - `getPrestigeLevel(lifetime)` → highest level whose `at` ≤ lifetime.
  - `getPrestigeMultiplier(level)` → the applied multiplier (clamped to the
    table, always ≥ 1).
- **Banked level** is a *saved* value (`prestigeLevel`), not purely derived:
  it only moves up when the player actually sinks a shaft. That's what makes
  the reset worth doing — the multiplier is the reward, banked at prestige.
- **`sinkNewShaft`** (engine action): banks `prestigeLevel = max(banked,
  available)` and increments `totalPrestiges`, then resets the run's mining
  operation — `minerals`, `miners`, `fastMiners`, `clickPower`→1,
  `minerPower`→1. **Kept** (meta): gems, gem-chance levels, cosmetics, and
  every lifetime stat (they drive the goal tiers / achievements / higher
  prestige rungs, and none of them ever decrease).
- **Guard (no farming):** the action is a no-op unless a strictly higher level
  is available to bank. Combined with the lifetime-only-raises property,
  repeated resets can't be spammed, and each real reset genuinely costs the
  run's minerals/miners.
- **Applied everywhere gains matter** (authoritative in the engine, mirrored
  in the UI so pending-gain / floating text / banner agree): tap gains and
  correct-answer gains (folded into `effectiveClickPower`), passive income
  (per-tick), offline earnings, and the depth-banner `/s`.

## Tasks

- [x] `game.ts`: `PrestigeLevel` / `PRESTIGE_LEVELS` / `getPrestigeLevel` /
      `getPrestigeMultiplier`; `computeOfflineMinerals` takes a multiplier
- [x] Save v6: `prestigeLevel` + 5→6 migration (clamp junk / over-table) +
      loader (clamped)
- [x] Engine: `sinkNewShaft` affordability/guard action; prestige multiplier
      applied to tick income, offline earnings, `mineralsPerSec` banner, tap
      gains and answer gains
- [x] `goals.ts`: `PRESTIGE_UNLOCK_TIER`; tier-3 unlock text now names the
      real unlock (drops "coming soon")
- [x] UI: `PurchaseButtons` — SINK NEW SHAFT button (locked 🔒 Magma Frontier
      until the tier completes), shows banked multiplier, the level you can
      bank next, and the lifetime requirement for the next rung
- [x] Unit tests: level/multiplier curve + clamping, monotonicity, offline
      with multiplier, v5→v6 migration
- [x] Verify: `npm run typecheck` / `lint` / `test` / `npx expo export -p web`
- [x] Update `docs/todo.md` (phase 7 section + log)
