# Iteration 7 — Tier-5 "Motherlode" endgame: hard-mode equation modes

Continues phase 7. Iteration 6 shipped tier 5's legendary miners; the log's
"Next: hard-mode equation modes, then the final cosmetic set" lands here.
Tier 5 is the §4.6 endgame tier — "legendary miner type, **hard-mode
equation modes with better payouts**, final cosmetic set". This iteration
ships the second endgame line: **hard mode** — 3-term equations that pay
more per correct answer, per §4.2 ("hard mode with 3-term equations").
The final cosmetic set is a later iteration (it touches the cosmetics
catalog, not the equation generator).

## Design

- **Hard mode** (equation generator + settings): a per-save-file optional
  equation difficulty the player opts into from settings. When on, every
  equation is **3 terms** — `a ○ b ○ c`, evaluated strictly
  **left-to-right** (no parentheses, so the typeable answer is unambiguous)
  — and every correct answer pays **×2** the normal amount. The premium
  comes from the third term (more arithmetic, bigger/finer answers) plus
  the flat payout; the §4.6 "better payouts" line.
  - **Equation shape**: `Equation` gains optional `op2?: string` /
    `c?: number`. Soft mode (the default) generates exactly today's
    2-term shape — no `op2`/`c` — so every existing consumer
    (`useEquations`, `EquationDisplay`, tests) stays source-compatible.
  - **Generation** (`getRandomEquation`, `equations.ts`): hard mode picks
    the first two terms exactly like today (same range / sub / div rules),
    then a second step whose result — the actual answer — stays
    integral, non-negative, and in-range-operand, left-to-right:
    - `+` / `*`: `c` uniform in `[minNumber, maxNumber)`.
    - `-`: `c = min(c, intermediate)` — the same clamp 2-term subtraction
      already uses, so the answer is never negative.
    - `/`: `c` must divide the intermediate; pick uniformly among the
      divisors of the intermediate in `[1, maxNumber)`, falling back to
      `c = 1` (always in range, always divides) when none exist —
      so division is exact at *both* steps, like today's single division.
  - **Payout**: `HARD_MODE_PAYOUT = 2` in `game.ts` (balance constants
    live there). Applied in `useEquations`' submit path exactly where the
    existing op bonuses are folded in (the ÷ ×10 / − ×2 multipliers), and
    folded into `EquationDisplay`'s pending-gain readout so what the
    player sees before answering is what the engine pays. The operator
    tooltips' gain-formula line mentions the hard-mode ×2.
- **Settings persistence**: `hardMode: boolean` joins
  `EquationSettings` (persisted under the existing `equationSettings`
  AsyncStorage key, *not* `SaveData` — no save-version bump). The loader
  already merges over `defaultEquationSettings`, so stored pre-hard-mode
  settings simply get `hardMode: false`; `defaultEquationSettings`
  defaults to false.
- **`goals.ts`**: new `HARD_MODE_UNLOCK_TIER = "t5"` constant; tier-5
  unlock text extends "Legendary miners" → "Legendary miners + hard-mode
  equations" (names the shipped line, same treatment as the tier-4
  "Cave themes").
- **UI**: `SettingsPanel` gains a "Hard mode equations" row — `Switch`
  behind a `Tooltip` (3-term equations, ×2 payout, gain formula) — rendered
  **locked** (`🔒 Motherlode`, switch disabled) until tier 5 completes,
  per the §4.6 visible-but-locked rule. The unlock state is threaded as a
  prop from `MinesOfDoom` (which already tracks completed tiers).
  `EquationDisplay` renders the third term (`a ○ b ○ c?`) and shows the
  ×2 in the pending-gain readout when hard mode is on.

## Tasks

- [ ] `equations.ts`: `hardMode` in `EquationSettings` (+ default false),
      `op2`/`c` on `Equation`, 3-term generation in `getRandomEquation`
      (left-to-right, non-negative, exact-at-both-steps division)
- [ ] `game.ts`: `HARD_MODE_PAYOUT = 2`; `useEquations` folds it into the
      correct-answer value; `EquationDisplay` renders `a ○ b ○ c?` and
      folds the ×2 into the pending gain; tooltip gain-formula text updated
- [ ] `goals.ts`: `HARD_MODE_UNLOCK_TIER = "t5"` + tier-5 unlock text
      "hard-mode equations"
- [ ] UI: `SettingsPanel` hard-mode switch (locked 🔒 Motherlode until the
      tier completes; tooltip explains ×2 payout)
- [ ] Unit tests: hard-mode generation invariants (all-op combos, many
      draws: 3 terms present, integral & non-negative left-to-right answer,
      exact division at both steps, operands in range), soft mode unchanged
      (no `op2`/`c`), payout fold (×2 vs soft mode), settings default
- [ ] Verify: `npm run typecheck` / `lint` / `test` / `npx expo export -p web`
- [ ] Update `docs/todo.md` (phase 7 section + log)
