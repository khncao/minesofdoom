# Plan Progress — Mines of Doom

Tracks implementation of [`ux-and-feature-plan.md`](./ux-and-feature-plan.md).
Legend: ✅ done (with notes) · ⏸ deferred (decision noted) · ⬜ not started

Last updated: 2026-09-01

## Phase 1 — Quick wins (UX) (§6.1)

- ✅ **Number formatting** (`formatNumber` in `apps/utils/format.ts`) — now used everywhere: HUD counters (`MiningCanvas`), purchase-button costs (`PurchaseButtons`), depth banner rate (`DepthBanner`), toasts. Unit-tested.
- ✅ **Pending gain display** — `EquationDisplay` shows the computed total (`clickPower × comboMultiplier × opBonus`) with the operator bonus folded into the number: `correct: +120 🪨 (×10 /)`.
- ✅ **Wrong-answer feedback** — input shake (`useShakeInput`) + "Combo lost!" toast (now visible on the main screen via the message overlay, not just inside the settings modal).
- ✅ **Operator tooltips** — new `Tooltip` component (long-press/hold bubble + `accessibilityHint` for screen readers); each operator toggle in settings now explains its bonus (÷ ×10, − ×2, + / × none) and the full gain formula (answer × click power × combo × operator bonus). Helper line under the toggles: "Long-press an operator to see how it pays".
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
- Cosmetics such as unique player and pickaxe skins with unique sounds, animations, and other audio-visual

## Phase 5 — Juice (§6.5)

- ✅ **Floating "+N" text** — new `FloatingTextLayer` (imperative ref, native-driver rise+fade, 16-item cap so tap-spam can't stack animations). Spawns on canvas taps (`+N`) and correct answers (`+N 🪨` in the exact earned amount).
- ✅ **Milestone toasts** — "Depth 10m — deeper into the cave!" every 10m (not every 1m, which would spam).
- ✅ **Gem-roll landing** — `rollGem` moved out of the React state updater (which may run twice in dev) into `applyAnswerReward`, which now returns the result; on success: "You struck a vein! +1 💎" toast + blue `+1 💎` floating text.
- ✅ **Combo tier-up effect** — "Combo x2! / x3! …" toast when the multiplier steps up, on top of the existing scale flash.
- ✅ **Main-screen message overlay** — `displayMessage` output (combo lost, welcome back, gem, milestones) is now shown centered on the main screen; previously it only rendered inside the settings modal, so most toasts were invisible.
- ⏸ **Screen shake on gem** — reduced to toast + floating text (no new animation infra this pass).
- ✅ **Minecraft-style rock break** — new `BlockBreak` component (imperative ref, same self-capping pattern as `DebrisParticles`): each mine tap / correct answer spawns a small block at the impact point that shows a growing radial crack, pulses on the pickaxe impact, then pops away (450ms, native driver, ≤5 live blocks, 80ms throttle). Triggered from `useMineTaps.mineTap` and the correct-answer handler.

## Phase 6 — Art / sprites (§6.6)

- ✅ **Priority art work (user request): programmatic player art, sprite randomizer, cosmetics** — no asset files, no new dependency:
  - `apps/utils/graphics/pixelArt.ts` — dependency-free runtime PNG generator (stored-deflate block + CRC32 + Adler-32 → base64 data URI for `<Image>`, identical on web/iOS/Android). 16×16 grids; deterministic PRNG (`mulberry32`, `hashSeed`); per-look URI cache so all same-variant miners share one image. Miner sprite (4 hat styles: helmet/beanie/cap/bandana) + pickaxe sprite (crescent head, diagonal handle, 4 color themes).
  - `apps/mines_of_doom/cosmetics.ts` — 5 outfit palettes (classic free, night 3💎, goldrush 5💎, crystal 10💎, magma 15💎) + 4 pickaxe themes (steel free, gold 5💎, frost 10💎, shadow 20💎); `rollMinerLook(seed, outfit)` = the **player sprite randomizer** (each reroll draws skin/shirt/pants/boots/hat within the owned outfit's palette); `rosterSeed(playerSeed, idx)` gives the crew distinct deterministic variants that reshuffle together on reroll.
  - **Cosmetics UI** — `CosmeticsSection` inside the settings sheet: current-look preview (real sprites) + 🎲 reroll, outfit list with per-outfit thumbnails, pickaxe list; gem prices, owned/selected/affordable states. Engine actions `buyCosmetic` / `selectCosmetic` / `rerollPlayerSeed` (id-validated, affordability-guarded).
  - **Save v3** — `playerSeed`, `ownedCosmetics`, `selectedOutfit`, `selectedPickaxe`; v2→v3 migration seeds the look deterministically from the save's timestamps (old saves get an old, stable look) and grants the free defaults. Unit-tested.
  - `Miner.tsx` now renders the generated sprites (body + animated swing on the pickaxe); `MiningCanvas` threads the player seed/outfit/pickaxe through (player + roster).
  - `jest.config.js` gained a `moduleNameMapper` for bare `apps/*` specifiers (matches Metro/tsconfig paths) so tests can import the same way as app code.
  - Unit-tested: PNG structure decoded byte-for-byte in test (signature, chunk CRCs, IHDR, stored block, Adler-32 trailer, pixel colors), CRC32/Adler-32 standard vectors, PRNG determinism, cosmetic catalog invariants, roster-seed collision-freedom, v3 migration.
- ⬜ Full pixel-art sprite set, Skia foundation, cave tile layer.
- **Decision (rest):** still deferred — the programmatic sprite foundation above covers the visible player + pickaxe; the broader set (props, cave tiles, Skia) remains separate workstream.

## Phase 7 — Progression features (§6.7) — in progress

- ✅ **Lifetime stats + save v2** — new save fields (`lifetimeMinerals`, `lifetimeCorrect`, `maxCombo`, `maxDepth`, `minersOwnedEver`, `totalGemsMinted`, `totalGemsSpent`, `totalPrestiges`) tracked incrementally in the engine's updaters via `lifetimeDelta()` (also offline earnings on load). Save v1→v2 migration folds existing progress in (mined→lifetime, roster→miners-owned-ever). Unit-tested.
- ✅ **Goal tiers / `goals.ts`** — 5-tier contract chain (Prospector's License → Motherlode) per §4.6. Completion is *derived* from lifetime stats (no mutable flag); tiers are sequential (first unmet tier stops the chain); save's `completedTiers` only records fired celebrations, so a loaded save whose goals are already met celebrates exactly once (idempotent `completeTiers` updater guards dev double-fires). Completion toast grants the tier's one-time mineral bonus. Unit-tested (sequencing, spending doesn't un-complete, progress clamp, bonus sums).
- ✅ **Goals UI** — `GoalsPanel` (🎯 bottom-sheet next to settings): every tier listed with per-goal progress bars (green = done), status icons (✅/▶/🔒), unlock + bonus line, so players see what's coming. `BottomModal` gained an `accessibilityLabel` prop.
- ✅ **Depth tiers / biomes** — `DEPTH_TIERS` in `game.ts` (5 tiers at 0/10/50/150/500m): each gives a cave-background tint (tinted `CaveBackground` rows, bands realigned to 10/50m), a biome name in the depth banner, and a click-gain bonus (×1 → ×2) applied authoritatively in the engine updaters *and* shown in pending-gain/floating text (they only disagree across a tier boundary, by one gain event). Biome-entry toast on tier change. Unit-tested.
- ✅ **First goal unlock: miner power upgrades** — tier 1 unlocks an "UPGRADE MINERS" button (minerals, `getMinerPowerUpgradeCost = 1000·p²`); renders locked (🔒 Prospector's License) until the tier completes, per §4.6's "visible but locked" rule. Engine action is affordability-guarded.
- ✅ **Player skins / pickaxe themes (tier-4 "skins" half)** — see Phase 6 art work: 5 outfits + 4 pickaxe themes in gems, seeded randomizer + reroll, roster variants. `goals.ts` tier-4 unlock text now reads "Cave themes (coming soon)" (cave themes themselves remain).
- ⬜ Miner types (tier 2), prestige/New Shaft (tier 3), cave themes (tier 4), endgame (tier 5) — `goals.ts` lists them as "(coming soon)" unlocks; each lands when implemented.
- ⬜ Achievements (one-off bonus badges, distinct from goal gates per §4.6).
- ⬜ Gem uses beyond miners (gem-chance +%, click ×2, …).

## Phase 8 — Nice-to-haves (§6.8)

- ⬜ Random events, share codes, leaderboard, PWA polish, iOS TestFlight.
- **Decision:** deferred.

## Accessibility (2.2)

- ✅ `accessibilityLabel`/`accessibilityRole` on: mine canvas (pre-existing), mute toggle, settings gear, settings close, all `Button`s (label = title).
- ⏸ Reduce-motion (`useAccessibilityReduceMotion`) for debris/combo flash — small follow-up.
- ⏸ 44×44 tap targets — gear/mute are ~30px text; bump padding in a follow-up.

## Build fix (found while verifying, pre-existing)

- ✅ **`assets/*` imports didn't resolve in Metro** — web/native builds were broken before this pass: source imports `assets/index` (tsconfig-mapped to `dist/assets/`, a tsc-only mapping; Metro ignores tsconfig paths). Fixed with `resolver.extraNodeModules` → `public/assets` (the real source folder) in `metro.config.js`, tsconfig path corrected to match, and `experiments.tsconfigPaths: true` in `app.config.ts`. Verified with a clean `npx expo export -p web --clear` (builds).

## Verification (all run 2026-09-01)

- `npm run typecheck` — clean
- `npm run lint` — clean
- `npm test` — 60/60 passing
- `npx expo export -p web --clear` — builds

---

## Log

- 2026-09-01 — Shipped the priority art work: fully programmatic 16×16 PNG sprites (dependency-free encoder in `pixelArt.ts`, base64 data URIs, per-look cache), the player-sprite randomizer (seeded `rollMinerLook` + reroll; roster variants via `rosterSeed`), and the cosmetic line (5 outfit palettes, 4 pickaxe themes, gem-priced, in-settings picker with live sprite previews) behind save v3. Caught and fixed a cosmetic-id collision (outfit `crystal` vs pickaxe → renamed pickaxe to `frost`) which would have made the pickaxe unpurchasable; added `apps/*` moduleNameMapper to Jest. 25 new unit tests (PNG byte-level decode, checksum vectors, PRNG, cosmetics, v3 migration). Typecheck, lint, 60 tests, clean web export all pass. Next: achievements, then tier-2/3 content (miner types, prestige).
- 2026-08-31 — Started phase 7 with its foundation: lifetime stats + save v2 migration, the `goals.ts` 5-tier contract chain with derived completion + one-time tier bonuses (celebrated once via persisted `completedTiers`), the Goals bottom-sheet UI with per-goal progress bars, depth tiers/biomes (tint, banner name, ×1–×2 click bonus applied in engine + UI), and the first tier unlock — miner power upgrades (locked until Prospector's License). 16 new unit tests (goals derivation, sequencing, v1→v2 migration, depth tiers, `lifetimeDelta`, cost curve). Typecheck, lint, 35 tests, clean web export all pass. Next: achievements, then tier-2/3 content (miner types, prestige).
- 2026-08-31 — Shipped the open plan TODO (operator tooltips) and the remaining phase-5 juice item, the Minecraft-style rock break (`BlockBreak` + wiring into tap/correct-answer flows). Typecheck, lint, 19 tests, and a clean `npx expo export -p web --clear` all pass.
- 2026-08-31 — Shipped the open plan TODO: operator-toggle tooltips. Added `apps/components/Tooltip.tsx` (long-press bubble, works with touch + mouse hold, content also exposed as `accessibilityHint`) and rewired the settings operator row to map over a single `OPERATOR_HELP` table (bonus per operator + gain formula), with a small helper caption. Typecheck/lint/19 tests all pass.
- 2026-07-10 — Audited codebase vs. plan (much of §6.1–6.3 had already landed in the uncommitted working tree: hook split, formatting, save-on-blur, offline cap, corrupt-save recovery, shake, pending-gain). Implemented remaining phase 1–3 + 5 items: equation edge cases, migration table, timestamp-based tick loop, reactive gem rolls, FloatingTextLayer, depth milestones, combo tier toasts, main-screen message overlay, full number formatting, a11y labels, Jest suite (19 tests), CI workflow, ESLint config repair, and a pre-existing Metro asset-resolution build break. Phases 4–8 deferred with decisions recorded above.
