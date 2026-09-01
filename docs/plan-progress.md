# Plan Progress — Mines of Doom

Tracks implementation of [`ux-and-feature-plan.md`](./ux-and-feature-plan.md).
Legend: ✅ done (with notes) · ⏸ deferred (decision noted) · ⬜ not started

Last updated: 2026-07-10

## Phase 1 — Quick wins (UX) (§6.1)

- ✅ **Number formatting** (`formatNumber` in `apps/utils/format.ts`) — now used everywhere: HUD counters (`MiningCanvas`), purchase-button costs (`PurchaseButtons`), depth banner rate (`DepthBanner`), toasts. Unit-tested.
- ✅ **Pending gain display** — `EquationDisplay` shows the computed total (`clickPower × comboMultiplier × opBonus`) with the operator bonus folded into the number: `correct: +120 🪨 (×10 /)`.
- ✅ **Wrong-answer feedback** — input shake (`useShakeInput`) + "Combo lost!" toast (now visible on the main screen via the message overlay, not just inside the settings modal).
- ✅ **Save on app blur/background** — `AppState` listener + web `pagehide`, gated by `loadedRef` so an early event can't clobber the real save.
- ✅ **Offline cap + welcome-back** — `maxOfflineTicks` (8h) + "Welcome back! Your miners collected …" toast.
- ⏸ **Combo progress bar to next tier** — defer; multiplier shown in `ComboIndicator`. Revisit with the Goals UI (phase 7) which shares the progress-bar pattern.
- ⏸ **Miner cost affordability indicator** — defer (disabled state + compact costs cover the main need).
- ⏸ **Depth progress bar** — defer (phase 7 depth tiers surface depth prominently).
- ⏸ **Custom numeric keypad wiring** — deliberate: OS keyboard kept (a second input surface is maintenance cost; `NumericKeypad.tsx` exists for a future revisit).
- ⏸ **Canvas-tap hold-to-mine** — unchanged; accidental combo reset still possible (documented trade-off, floating text makes taps feel intentional).

## Phase 2 — Stability (§6.2)

- ✅ **Corrupt-save handling** — try/catch parse; raw data backed up to `save.corrupt`; boots fresh; save-failure warning toast.
- ✅ **Autosave setting wired** — settings `autosave` (5–600s clamp) drives the loop's cadence.
- ✅ **Save versioning/migration table** — `migrateSaveData()` in `game.ts`: version-keyed `migrations` table walked from the save's `saveVersion` (legacy saves without the field = v0) up to current. Unit-tested.
- ✅ **Tick drift fix** — chained `setTimeout` replaced with `setInterval` + `Date.now()` elapsed computation: backgrounded/throttled time is banked and paid out as one mineral update (× elapsed ticks, capped at `maxOfflineTicks`) + one animation tick; autosave cadence tracked by tick counter, not state.
- ✅ **Unit tests** — Jest + `jest-expo` + `@types/jest`, `npm test` script: 19 tests across `equations.test.ts` (operator set, answer consistency, min/max range, non-negative subtraction, exact division, all-ops-off fallback, `approxeq`), `format.test.ts`, `game.test.ts` (cost curves, depth, offline calc incl. 8h cap, save migration).
- ⏸ **BigInt for minerals** — deferred. `formatNumber` covers up to Qi (1e30); switching needs a save-format migration + full audit. Revisit when `MAX_SAFE_INTEGER` is realistically in reach.
- ⏸ **App store cloud save** — deferred (needs store account).

## Phase 3 — Structure (§6.3)

- ✅ **Split `MinesOfDoom.tsx`** — hooks (`useGameEngine`, `useEquations`, `useCombo`, `useMineTaps`, `useSettings`, `useSounds`, `useShakeInput`, `useMessages`) + presentational components.
- ✅ **Balance constants centralized** — `game.ts` (costs, `gemChance`, `gemMineralCost`, `msPerTick`, `mineralsPerDepth`, `maxOfflineTicks`).
- ✅ **Equation edge cases fixed** (`apps/utils/math/equations.ts`, all unit-tested):
  - `minNumber` now honored (operands in `[minNumber, maxNumber)`).
  - Subtraction enforces `a ≥ b` → answers never negative (they were untypeable on a numeric pad).
  - Division always exact: divisor picked, dividend built as a multiple of it (no more decimals / `Math.fround` hacks).
  - All operators off → falls back to multiplication instead of `op: undefined`.
  - `useEquations` simplified accordingly (no `abs`, no null-check).
- ✅ **Lint/CI** — `npm run test` / `typecheck` / `lint` scripts; GitHub Actions workflow (`.github/workflows/ci.yml`: typecheck → lint → test). ESLint config fixed: ignores build artifacts (`dist/`, `public/assets/`, `android/`, …), node globals for CJS config files, React version setting, dead `path` import removed.
- ✅ **Dead code cleaned** — unused imports/styles in `Miner.tsx`, `NumericKeypad.tsx` (kept for the keypad plan), `WebsiteLink.tsx`.

## Phase 4 — Monetization (§6.4)

- ⬜ Daily bonus/streaks, rewarded-ads abstraction, Remove Ads + cosmetics.
- **Decision:** deferred as a whole — needs store accounts, RevenueCat/ad SDKs, and the retention features (phases 7/8) it builds on. Web stays 100% free per §5.
- ⏸ **Haptics** (`expo-haptics`) — skipped this pass (new native dep + config churn); small follow-up.

## Phase 5 — Juice (§6.5)

- ✅ **Floating "+N" text** — new `FloatingTextLayer` (imperative ref, native-driver rise+fade, 16-item cap so tap-spam can't stack animations). Spawns on canvas taps (`+N`) and correct answers (`+N 🪨` in the exact earned amount).
- ✅ **Milestone toasts** — "Depth 10m — deeper into the cave!" every 10m (not every 1m, which would spam).
- ✅ **Gem-roll landing** — `rollGem` moved out of the React state updater (which may run twice in dev) into `applyAnswerReward`, which now returns the result; on success: "You struck a vein! +1 💎" toast + blue `+1 💎` floating text.
- ✅ **Combo tier-up effect** — "Combo x2! / x3! …" toast when the multiplier steps up, on top of the existing scale flash.
- ✅ **Main-screen message overlay** — `displayMessage` output (combo lost, welcome back, gem, milestones) is now shown centered on the main screen; previously it only rendered inside the settings modal, so most toasts were invisible.
- ⏸ **Screen shake on gem** — reduced to toast + floating text (no new animation infra this pass).

## Phase 6 — Art / sprites (§6.6)

- ⬜ Pixel-art sprite set, Skia foundation, cave tile layer.
- **Decision:** deferred — separate workstream (art production + new dependency). Emoji fallback stays as the shipped style until then.

## Phase 7 — Progression features (§6.7)

- ⬜ Depth tiers/biomes, lifetime stats + goal tiers, achievements, miner upgrades, gem uses, prestige.
- **Decision:** deferred — largest remaining gameplay chunk; needs `goals.ts` + lifetime-stats save migration (the new migration table in `game.ts` is the hook for that).

## Phase 8 — Nice-to-haves (§6.8)

- ⬜ Random events, share codes, leaderboard, PWA polish, iOS TestFlight.
- **Decision:** deferred.

## Accessibility (2.2)

- ✅ `accessibilityLabel`/`accessibilityRole` on: mine canvas (pre-existing), mute toggle, settings gear, settings close, all `Button`s (label = title).
- ⏸ Reduce-motion (`useAccessibilityReduceMotion`) for debris/combo flash — small follow-up.
- ⏸ 44×44 tap targets — gear/mute are ~30px text; bump padding in a follow-up.

## Build fix (found while verifying, pre-existing)

- ✅ **`assets/*` imports didn't resolve in Metro** — web/native builds were broken before this pass: source imports `assets/index` (tsconfig-mapped to `dist/assets/`, a tsc-only mapping; Metro ignores tsconfig paths). Fixed with `resolver.extraNodeModules` → `public/assets` (the real source folder) in `metro.config.js`, tsconfig path corrected to match, and `experiments.tsconfigPaths: true` in `app.config.ts`. Verified with a clean `npx expo export -p web --clear` (builds).

## Verification (all run 2026-07-10)

- `npm run typecheck` — clean
- `npm run lint` — clean (0 errors; 14 pre-existing unused-var warnings in kept code)
- `npm test` — 19/19 passing
- `npx expo export -p web --clear` — builds

---

## Log

- 2026-07-10 — Audited codebase vs. plan (much of §6.1–6.3 had already landed in the uncommitted working tree: hook split, formatting, save-on-blur, offline cap, corrupt-save recovery, shake, pending-gain). Implemented remaining phase 1–3 + 5 items: equation edge cases, migration table, timestamp-based tick loop, reactive gem rolls, FloatingTextLayer, depth milestones, combo tier toasts, main-screen message overlay, full number formatting, a11y labels, Jest suite (19 tests), CI workflow, ESLint config repair, and a pre-existing Metro asset-resolution build break. Phases 4–8 deferred with decisions recorded above.
