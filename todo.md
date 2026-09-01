# Iteration 4 — Tier-3 gem upgrades: click ×2 + combo resistance

Continues phase 7. Iteration 3 shipped prestige ("New Shaft"), the rest of
the tier-3 unlock from plan §4.6; this is the remaining part, explicitly
deferred by it: **"more gem upgrade lines (click ×2, combo resistance)"**.
Both are gem-priced, both unlock behind goal tier 3 (Magma Frontier,
`goals.ts`) like the other tier-3 content, and both are *meta* — like gems
and gem-chance they survive a sunk shaft, so a prestige run starts with the
same upgrade lines in place.

## Design

- **Click ×2** (`clickBoostLevels` in the save): each level **doubles**
  tap gains and correct-answer gains — `getClickBoostMultiplier(level) =
  2^level`. Applied to click gains only (passive miner income is
  untouched, so it stays a tap/answer investment, not an income one).
  - Cap: `CLICK_BOOST_MAX_LEVELS = 4` → ×1/×2/×4/×8/×16.
  - Cost: `getClickBoostCost(level) = 25·(level+1)²` gems (quadratic like
    gem chance, steeper base so it outlives it as a sink).
  - Applied authoritatively in the engine (`applyAnswerReward`; taps arrive
    pre-multiplied through `effectiveClickPower`) and mirrored in the UI
    via `effectiveClickPower`, so pending-gain / floating text / banner
    all agree.
- **Combo resistance** (`comboResistLevels` in the save): wrong answers and
  canvas taps used to zero the combo. Each level keeps **10%** of the
  combo on a loss (floored): `getComboRetention(level) = min(0.1·level, 0.5)`
  → level 0 = today's behavior, cap `COMBO_RESIST_MAX_LEVELS = 5` = keep
  50%. `getResistantComboReset(combo, level) = floor(combo · retention)` —
  deterministic (no RNG, so it's testable and matches what the button
  shows), strictly ≤ the combo, and a no-op at level 0.
  - Cost: `getComboResistCost(level) = 20·(level+1)²` gems.
  - Both reset paths share the retention: the wrong-answer handler and
    `useMineTaps`' per-tap reset, so tap-spamming an equation can't
    accidentally burn the combo faster than the displayed rule.
- **Save v7**: `clickBoostLevels` + `comboResistLevels`, 6→7 migration
  (clamp junk / over-cap, floor + `>= 0`) + clamped loader.
- **Engine actions** `buyClickBoost` / `buyComboResist`: cap- and
  affordability-guarded no-ops (same pattern as `buyGemChance`), count
  toward `totalGemsSpent`. `sinkNewShaft` leaves both levels intact.

## Tasks

- [x] `game.ts`: `CLICK_BOOST_MAX_LEVELS` / `COMBO_RESIST_MAX_LEVELS` +
      `getClickBoostMultiplier` / `getClickBoostCost` /
      `getComboResistCost` / `getComboRetention` / `getResistantComboReset`
- [x] Save v7: `clickBoostLevels` + `comboResistLevels`, 6→7 migration
      (clamp junk / over-cap) + clamped loader + `createEmptySaveData`
- [x] Engine: `buyClickBoost` / `buyComboResist` actions; click-boost
      multiplier folded into `applyAnswerReward`; combo resets keep the
      retained fraction (wrong answer + mine-tap paths)
- [x] `goals.ts`: tier-3 unlock text names the gem upgrade lines
- [x] UI: `PurchaseButtons` — CLICK ×2 + COMBO RESISTANCE buttons (locked
      🔒 Magma Frontier until the tier completes, MAX state, current level
      in the label); combo-lost message reflects retained combo
- [x] Unit tests: ×2 curve + clamping, retention/reset math, costs, v6→v7
      migration
- [x] Verify: `npm run typecheck` / `lint` / `test` / `npx expo export -p web`
- [x] Update `docs/todo.md` (phase 7 section + log)
