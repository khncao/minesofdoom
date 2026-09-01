# Iteration 6 — Tier-5 "Motherlode" endgame: legendary miners

Continues phase 7. Iteration 5 shipped tier 4 (Crystal Kingdom) cave themes;
the log's "Next: tier 5 endgame" lands here. Tier 5 is the §4.6 endgame tier:
**"Endgame content — legendary miner type, hard-mode equation modes with
better payouts, final cosmetic set."** This iteration ships the first and
most mechanical of the three: the **legendary miner type** — the third miner
type and the endgame raw-output sink. Hard-mode equation modes and the final
cosmetic set are later iterations (they touch the equation generator /
cosmetics catalog, not the miner economy).

## Design

- **Legendary miners** (third miner type, `game.ts`): gem-priced, the
  **premium** miner — highest absolute output per miner, steepest gem curve.
  Fast miners (tier 2) remain the *efficiency* play (cheap, weak); legendary
  miners convert a gem hoard into raw income — the classic endgame sink.
  - **Cost** `getLegendaryMinerCost(current) = max(1, ceil(2·(current+1)⁴))`
    gems — the same quartic family as the other two types, 2× the
    normal-miner curve and above both types at every count (miners are a
    premium, not a bargain).
  - **Output** `getLegendaryMinerOutput(minerPower) = 2·minerPower`
    minerals/sec — exactly double a normal miner, and miner-power upgrades
    apply to *all three* types (same rule as fast miners).
- **Save v9**: `legendaryMiners: number` (defaults to 0). 8→9 migration
  clamps junk (`Math.max(0, floor(...))`, like `fastMiners`); clamped loader
  in `useGameEngine`; `createEmptySaveData` defaults to 0.
- **Engine**: `buyLegendaryMiner` action — affordability-guarded (same
  pattern as `buyFastMiner`), counts toward `totalGemsSpent`. Passive income
  paths include the third type: `getMineralsPerSec` /
  `computeOfflineMinerals` gain a `legendaryMiners` parameter (defaulted, so
  call sites and tests stay source-compatible), the per-tick income check
  fires when any of the three types is owned, and the depth-banner `/s`
  agrees. `sinkNewShaft` resets `legendaryMiners` to 0 — miners are *run*
  resources, exactly like normal/fast miners (only meta cosmetics survive).
- **`goals.ts`**: new `LEGENDARY_MINER_UNLOCK_TIER = "t5"` constant; tier-5
  unlock text drops "(coming soon)" → "Legendary miners" (names the shipped
  line, same treatment as `CAVE_THEME_UNLOCK_TIER`'s "Cave themes").
- **UI**: new `BUY A LEGENDARY MINER` button in `PurchaseButtons` — gem cost,
  owned count, `/s each` readout; rendered locked
  (`🔒 BUY LEGENDARY MINER (Motherlode)`) until tier 5 completes, per the
  §4.6 visible-but-locked rule. `MiningCanvas` gains a third roster row
  (scale 0.55 — between normal 0.5 and player 1, seed offset 2000 so sprite
  variants can't collide with the normal (0) or fast (1000) rows).

## Tasks

- [x] `game.ts`: `getLegendaryMinerCost` / `getLegendaryMinerOutput`,
      `legendaryMiners` in `getMineralsPerSec` / `computeOfflineMinerals`
- [x] Save v9: `legendaryMiners` (8→9 migration + clamped loader +
      `createEmptySaveData` default)
- [x] Engine: `buyLegendaryMiner` action (affordability-guarded, counts
      toward `totalGemsSpent`); tick income / offline earnings / banner `/s`
      include the type; `sinkNewShaft` resets it
- [x] `goals.ts`: `LEGENDARY_MINER_UNLOCK_TIER = "t5"` + tier-5 unlock text
      "Legendary miners"
- [x] UI: `PurchaseButtons` legend-miner button (locked until Motherlode) +
      `MiningCanvas` third roster row
- [x] Unit tests: cost curve (monotonic, 2× fast, above normal), output =
      2× power, per-sec across all three types, offline with legendaries,
      v8→v9 migration (junk clamp), new-save default
- [x] Verify: `npm run typecheck` / `lint` / `test` / `npx expo export -p web`
- [x] Update `docs/todo.md` (phase 7 section + log)
