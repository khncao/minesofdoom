# Mines of Doom — UX, Improvements & New Features Plan

Status: planning draft
Last updated: 2026-08-31

## 1. Current State (baseline)

- Core loop: solve a math equation → gain minerals × click power × combo multiplier.
- Tapping the cave canvas also mines (click power only, resets combo).
- Currency chain: minerals → gems (100k) → miners (quadratic-ish cost) → passive minerals/sec.
- Combo: +1 per correct answer, resets on wrong answer or canvas tap; multiplier = 1 + floor(combo/10).
- Depth = floor(minerals / 500), drives cave background.
- Save: manual save + autosave every 100 ticks (100s); offline progress computed on load.
- Settings: equation difficulty (max number, enabled operators), mute toggle.

## 2. UX Improvements

### 2.1 Feedback & clarity
- **Show what a correct answer is worth.** Before submitting, display the pending gain: `clickPower × comboMultiplier` (and ×10 for division, ×2 for subtraction). Right now the bonus multipliers for `/` and `-` are invisible until you get them.
- **Explain the combo.** Add a small tooltip/first-time hint: "10 correct in a row = ×2, 20 = ×3…". Show a progress bar toward the next multiplier tier.
- **Wrong-answer feedback.** Currently a wrong answer just plays a stone sound and silently resets the combo. Show a brief shake animation on the input and a "combo lost" flash so the reset is visible.
- **Show miner cost curve context.** Buttons show the next cost only; add "next: X" or a small progress indicator toward affordability (e.g., "62% to next miner").
- **Number formatting.** Minerals/gems are raw numbers; switch to compact notation (1.2k, 3.4M, 1.2B) with full value on long-press/tap. Costs like `100000` are hard to scan.
- **Depth banner.** Depth only changes every 500 minerals — add a progress bar to the next depth so progress feels continuous.

### 2.2 Layout & input
- **Keyboard handling.** `TextInput` with `autoFocus` + `clearTextOnFocus` is fragile (focus fights with canvas taps, keyboard covers the canvas on small screens). Consider:
  - A custom on-screen numeric keypad (the `NumericKeypad` component already exists in `apps/components/` — wire it up) so the game never depends on the OS keyboard.
  - Or at least: don't auto-focus on web/desktop, and keep the equation + input visible above the keyboard.
- **Canvas tap vs. equation submit.** Tapping the cave resets the combo — easy to do accidentally while playing fast. Options: require a short hold, or make the canvas a secondary "slow" action and move it below the fold / behind a button.
- **Button hierarchy.** All three purchase buttons look identical. Visually distinguish: upgrade (minerals), miner (gems), gem (minerals→gems). Consider grouping by currency with headers.
- **Settings modal discoverability.** The ⚙️ button is small and bottom-left. Add a labeled icon or a "Settings" pill. Also add a visible "Save" affordance outside the modal (e.g., a small save indicator that pulses when the save is stale).
- **First-run onboarding.** A 3-step overlay: (1) solve equations to mine, (2) combos multiply gains, (3) buy miners for passive income. Dismissible, stored in AsyncStorage.
- **Accessibility.**
  - Add `accessibilityLabel` to all Pressables (canvas, buttons, mute, settings).
  - Respect `useAccessibilityReduceMotion()` for debris particles and combo flash.
  - Minimum tap target 44×44 for the settings gear and mute toggle.
- **Web parity.** On web, `inputMode="numeric"` is ignored and the keyboard is the OS one; the custom keypad (above) fixes this. Also test `KeyboardAvoidingView` behavior in browser (it's a no-op on web).

### 2.3 Juice / game feel
- **Floating "+N" text** at the click point on correct answers and canvas taps.
- **Milestone toasts** at depth thresholds (e.g., "Depth 10m — new cave layer") and first-purchase moments.
- **Screen shake / flash** on gem roll success (5% chance is a rare event — make it land).
- **Combo tier-up effect** when the multiplier increases (bigger flash + sound).
- **Haptics** on mobile via `expo-haptics` for correct/wrong answers and purchases.

## 3. General (code/technical) Improvements

### 3.1 Save system
- **Save on app blur / background** (`AppState` change listener) — currently a player who closes the app between autosaves loses up to 100s of progress.
- **Autosave interval is hardcoded** (every 100 ticks) while the settings UI for it is commented out. Either restore the setting or remove the dead code.
- **Save versioning/migration.** `saveVersion` exists but there's no migration path. Add a migration function table keyed by version.
- **BigInt for minerals** (already noted as TODO) — minerals will overflow `Number.MAX_SAFE_INTEGER` with miners running; migrate save format when switching.
- **Corrupt-save handling.** `JSON.parse` on load will crash the app on a bad save; wrap in try/catch and offer "load backup" / "start fresh".
- **Offline progress cap.** Offline earnings are unbounded; cap at e.g. 8h and show an "welcome back" modal with the earned amount.
- Tie in to app store cloud features

### 3.2 Game loop
- The tick uses `setTimeout` chained on `tick` state — drifts and pauses when the tab is backgrounded. Consider a `setInterval`-based tick that computes elapsed ticks from timestamps (also fixes drift after tab sleep).
- `saveGame` mutates `gameState.saveTime` directly (mutation of state object) — move into the state update.
- `onTick` ref array + Context is a fine pattern, but document it; currently only miners use it.

### 3.3 Structure
- **Split `MinesOfDoom.tsx`** (~500 lines, all-in-one). Extract:
  - `useGameState` hook (save/load/tick/purchase logic)
  - `useEquation` hook (equation state + submit)
  - `useCombo` hook
  - Presentational components: `PurchaseButtons`, `DepthBanner`, `MinerRoster`
- **Centralize balance constants** (`gemChance`, `gemMineralCost`, cost functions, `msPerTick`) in one `balance.ts` module so tuning doesn't require hunting the component.
- **Equation edge cases:**
  - `getRandomEquation` can produce `0 * 0`, `a - a = 0`, and division with `a < b` producing fractional answers (answered via `Math.fround` — but the player has to type a decimal; decide if division should always be exact).
  - `minNumber` setting exists but is unused in generation (always `getRandomInt(max)` from 0).
  - With all operators off, `ops` is empty → `op` is `undefined` and `answer` is `undefined`; guard against it.
- **Testing.** Add unit tests for: cost curves, `getRandomEquation` (per operator, edge cases), `approxeq`, offline progress calc, save migration. Jest + `jest-expo` fits the Expo stack.
- **Lint/CI.** ESLint config exists; add a CI workflow (lint + typecheck + unit tests) and a `test` script in `package.json`.

### 3.4 Performance
- The canvas re-renders every tick (minerals change) even when nothing visual changed. Memoize `CaveBackground` (keyed by depth) and the miner roster (keyed by count) so ticks only update the counters.
- `DebrisParticles` and `Miner` animations: verify they run on the native driver / don't trigger React re-renders per frame.

## 4. Potential New Features

### 4.1 Progression & depth
- **Depth tiers / biomes.** Every N meters: new cave background layer, new mineral type, and a bonus (e.g., +10% click power per tier). Depth already exists — make it matter.
- **Achievements.** One-time rewards (first gem, 100-combo, 10 miners, depth 100m). Small mineral bonuses + a badge list in settings.
- **Prestige ("New Shaft").** Reset minerals/miners for a permanent multiplier based on lifetime minerals. Gives the idle loop a long-term goal.
- **Miner upgrades.** Currently miners are identical and only count matters. Add: miner power upgrades (cost minerals), miner levels, or distinct miner types (slow/cheap, fast/expensive).
- **Gem uses beyond miners.** Gems currently buy only miners. Add gem-spent upgrades: click power ×2, combo decay resistance, gem chance +1%.

### 4.2 Gameplay variety
- **Equation modes.** Timed mode (answer within X seconds for bonus), streak mode (no wrong answers allowed, high reward), or "hard mode" with 3-term equations.
- **Random events.** Occasional events on tick: "gold vein! next 10 answers ×2", "cave-in! miners paused 30s". Adds variety to the idle loop.
- **Daily bonus / login streak.** Small mineral grant per day played; streak multiplier.
- **Lucky pick.** Small chance per correct answer for a crit (×5) — complements the existing gem roll.

### 4.3 Meta / social
- **Leaderboard** (optional, needs a backend or integrate with app store cloud features): depth reached, minerals/sec.
- **Shareable save codes.** Encode save as a short base64 string for sharing/import (also enables backup without cloud).
- **Themes.** Cave color themes unlocked by depth; stored in settings.

### 4.4 Platform
- **PWA / web polish.** The app deploys to GitHub Pages; add a proper loading state, favicon, and meta tags for mobile web (viewport, theme-color).
- **iOS build** is already scripted (`expo run:ios`) — verify `expo-av` audio and AsyncStorage work, then consider TestFlight.
- **App icon/splash** via `expo-splash-screen` / `expo-image` if not already set in `app.config.ts`.

### 4.5 Art: real animated sprites (replace emojis)

Current state is placeholder-grade: `Miner` renders a `👷`/`👷‍♂️` emoji `Text` with a rotating pickaxe image; the cave background is a grid of emoji text rows (`🪨💎✨·`); currency icons are `💎`/`🪨` from `emojis.tsx`. Emojis render differently per OS (Android vs iOS vs web), so the game looks different on every platform. The plan is a dedicated, consistent sprite set.

**Target assets** (all animated, multi-frame):
- **Miner** — idle (subtle breathing/bob) + mining swing (pick raises, strikes, debris flies). This is the most visible sprite; make it good.
- **Player miner** — larger/higher-detail variant of the same character, used for tap-mine feedback.
- **Pickaxe** — swing arc as part of the miner animation (retire the separate rotating `pickaxeImg` or keep it for the player overlay).
- **Mineral chunk** — 3-frame break cycle (intact → cracked → shards) at the tap point.
- **Gem** — spawn pop + idle shimmer (replaces `💎` rolls and cave sparkle).
- **Debris particles** — 3–4 small shard sprites replace generic particle dots; reuse the mineral-break shards.
- **Optional:** per-depth-tier miner outfits (pairs with 4.1 biomes) and recolorable palettes (pairs with 5.2 cosmetic theme packs — sell palette swaps, not new art).

**Style decision first.** Pick one and commit — mixing looks worse than simple. Candidates:
1. **Pixel art (recommended).** Cheapest to produce consistently, ages well in a cave-mining game, small asset sizes, easy recoloring via palette swap (directly enables the cosmetic packs). Tooling: Aseprite or free alternatives (LibreSprite). Export: PNG sprite sheets + a JSON frame manifest.
2. Vector/flat — cleaner, but animation cost per character is higher.
3. AI-assisted draft → hand-touched — acceptable for concepting; final frames should be hand-consistent.

**Rendering approach** (no canvas library is currently installed — the "canvas" is a text grid):
1. **Sprite sheets + frame stepping (recommended start).** One `SpriteView` component: preloaded `Image`/skia image of the sheet, frame index advanced by a shared rAF/timer ref, rendered via `react-native-svg` `<image>` crop or `@shopify/react-native-skia` `SpriteView`. Skia is the better bet: it also enables (2) below and keeps everything off the React reconciliation path. Keep a **`useSprite` hook** that manages preload, frame timing, and a shared clock so all miners animate in sync without per-tick React renders (ties into 3.4 — sprites must not re-render on mineral ticks).
2. **Cave background → Skia tile layer.** Replace the emoji text rows with a tile grid drawn in Skia (rock tiles, gem tiles with a 2-frame shimmer, occasional animated spark). Precompute row templates per depth (existing `buildRow` seed logic becomes the tile layout seed), memoize per depth tier — this also fixes the 2.3/3.4 concern of the background re-rendering every tick.
3. **Fallback:** keep an `EMOJI_ART` setting (default off) for low-end devices / a "performance mode" in settings.

**Integration points:**
- `Miner.tsx`: swap emoji `Text` → `<SpriteView name="miner" state={idle|mining}>`; keep the existing `pickaxeAnimate` trigger as the state-machine input (it already has throttling).
- `DebrisParticles`: shard sprites with the same shared clock.
- `emojis.tsx`: keep as the fallback-art provider; currency icons in HUD/buttons can stay as small static sprite stills (non-animated frames) to avoid over-animating the UI.
- Asset loading: `Image.prefetch`/skia cache at boot, behind the splash screen; fail-soft to emoji art if an asset is missing (never crash on art).
- **Budget guard:** total sprite assets < ~1 MB (pixel art is forgiving); measure bundle size before/after in CI.

**Risks:** art scope creep (mitigate: ship miner + mineral + gem first, everything else is stretch); animation sync (one shared clock, no per-sprite timers); web parity (Skia runs on web — verify, else use SVG-crop fallback on web).

### 4.6 Overarching goals — complete goals to unlock new purchaseables

The game has no long-term destination: everything buyable is buyable from minute one (just expensive). The plan is a **tiered goal chain** — a handful of big, thematic "contract" goals that, when completed, unlock *new* purchasable content lines. Content drips in as the player proves progress, which gives the idle loop a reason to keep going and naturally paces the §4.1 features (miner upgrades, gem uses, prestige) behind meaningful milestones instead of dumping them all at once.

**Design rules** (must stay consistent with §5.4 F2P guardrails):
- Goals only ever unlock **access** to content that is bought with *in-game* currency (minerals/gems). Never pay-to-unlock, never real-money gates.
- Every goal must be completable by a free player without grinding tricks; tiers should take roughly a week of normal play each (same horizon as the free-path benchmark in §5).
- Goal progress is permanent and survives prestige (it tracks lifetime stats, not current-run stats).
- Each tier completion gives a small immediate bonus (minerals + badge/title) plus the unlock — the unlock is the reward, the minerals are the confetti.

**Proposed chain** (names are flavor, tune to taste):

| Tier | Theme | Example goals (pick 3–5 per tier) | Unlocks (new purchaseables) |
|---|---|---|---|
| 1 | Prospector's License | reach depth 10m; 50 total correct answers; own your first miner | **Miner power upgrades** (mineral-spent, §4.1) — the first upgrade line beyond "buy more miners" |
| 2 | Deep Shaft | reach depth 50m; 10 miners; 50-combo; spend 10 gems | **Second miner type** (e.g., fast miner: cheaper/sec, weaker) + first gem upgrade (gem chance +1%, §4.1) |
| 3 | Magma Frontier | reach depth 150m; 10 miners upgraded; own 100 gems; 100-combo | **Prestige / New Shaft** (§4.1) + more gem upgrade lines (click ×2, combo resistance) + second miner type |
| 4 | Crystal Kingdom | prestige once; depth 500m lifetime; collect 50 gems in one run; 1000 total correct answers | **Cosmetic lines open** — cave themes + sprite palette packs (§4.3/§4.5/§5.2: buyable in gems *and* in the IAP cosmetic packs — same items, two currencies) |
| 5 | Motherlode | prestige ×3; reach the max depth tier; 500-combo; own all miner types | **Endgame content** — legendary miner type, hard-mode equation modes with better payouts (§4.2), final cosmetic set |

**Mechanics & implementation:**
- **Lifetime stats** in the save: `lifetimeMinerals`, `lifetimeCorrect`, `maxCombo`, `totalGemsMinted/Spent`, `maxDepth`, `totalPrestiges`, `minersOwnedEver`, `minerTypesOwned`… computed incrementally in the state update (not scanned from history). Save migration adds the fields with zeros.
- **`goals.ts` config module:** each goal = `{ id, tierId, metric, target }` where `metric` is a key into lifetime stats. Completion is derived state (`metric value ≥ target`), not stored as a mutable flag — makes it cheat-resistant to save corruption and trivial to test (unit test: metric progression → unlock).
- **Tier completion** fires once (persist `completedTiers: string[]`): toast/celebration, bonus grant, and the shop shows the new purchaseables (they render as locked + "Unlocks in: <next tier goal>" until then, so players can see what's coming).
- **UI:** a "Goals" view (settings tab or its own button) listing tiers, each goal with a progress bar (progress bars here reuse the 2.1 combo/depth progress-bar pattern). A small "next unlock" chip on the shop buttons for at-a-glance motivation.
- **Synergies:** achievements (§4.1) become the one-off bonus badges; overarching goals are the content gates — keep them distinct so neither system does both jobs. Random events (§4.2) can occasionally add temporary "bonus goal" objectives for extra minerals (e.g., "answer 10 divisions in the next 2 minutes").
- **Balance guardrail:** after each tier unlock, re-check the free-path benchmark — new purchaseables must be a *choice*, not a required power spike (a player who ignores all new purchaseables must still reach the next tier at a reasonable pace).

## 5. Monetization (ethical, F2P-first)

**Core principle: the game is fully complete and winnable free.** Paid options only (a) remove ads and (b) sell cosmetics that the free player can also unlock through play. No stat-gated IAP, no pay-to-speed, no subscription, no dark patterns. Every "buy" offer must be skippable and the player must be able to finish the full loop (depth tiers → achievements → prestige) with minerals/gems earned in-game alone.

F2P viability is a design constraint, not a marketing line — enforce it with a **free-path benchmark**: a pure free player should reach first prestige in a target time (e.g., ~7 days of normal idle+play). When tuning `balance.ts`, regression-check this path; if a change slows it, rebalance instead of selling the difference.

Web/PWA build: 100% free, no ads, no IAP.

### 5.1 Rewarded video ads — strictly opt-in, reward-only

Every ad is a bonus the player actively requests. No interstitials, no banners, no ads on the equation flow (they'd ruin the combo/tap rhythm).
- **Offline earnings ×2** — the "welcome back" modal (3.1) is the perfect natural opt-in: "Watch to double your offline minerals." No other context converts better.
- **Cave-in rescue** — when a negative random event fires (4.2), offer a rewarded video to cancel it.
- **Gem rolls** — "watch for 5 free gem rolls" as a daily-limited reward (e.g., 3/day) instead of buying gems with minerals.
- **Instant offline top-up** — once offline progress hits the cap, watching extends it by +2h.
- Implementation: `expo-ad-adsense` or `react-native-ads-mediation` (AdMob/Unity). Gate behind a provider abstraction so web falls back to a no-op. Track impressions/rewards in-app to detect fraud (cap rewards per session, e.g., ≤10/day).
- **Ad-free by default on every platform except where the player taps "watch".** "Remove Ads" (5.2) permanently disables even the opt-in buttons.

### 5.2 In-app purchases — minimal catalog, no pay-to-speed

Deliberately tiny: two kinds of product, nothing else.

- **Remove Ads** ($2.99–$4.99, one-time) — the anchor IAP. Disables all ad entry points.
- **Cosmetic packs** ($1.99–$3.99 each) — cave themes (pairs with 4.3), miner skins, UI color themes. Purely visual, and **every pack is also earnable in-game** (depth unlocks / achievements), so buying is convenience, not access.

Explicitly out of scope (and why):
- ~~Starter boost packs / mineral IAP~~ — selling currency in an idle game is a pay-to-speed backdoor; the early game should be a gentle onboarding, not a wall.
- ~~Timed power-up consumables ("Golden Pick")~~ — recurring consumption pressure on an idle loop is the main source of "predatory" perception; skip.
- ~~Subscriptions~~ — wrong model for a one-purchase-lifetime-value game.

Store: RevenueCat (or `react-native-iap` directly) for receipts/entitlements across Android/iOS. Requires receipt validation → keep the free build fully functional without it.

### 5.3 Retention & organic growth (ship before any monetization)
- **Daily bonus / streaks** (4.2) — the retention surface that makes the rewarded ads worth their while.
- **Share codes / achievements** — free word-of-mouth acquisition (lower CAC than paid UA).
- If the game gets a meaningful audience: consider a **sponsorship/branding event** (e.g., a themed biome for a partner) instead of heavier ad loads.

### 5.4 Guardrails (non-negotiable)
1. **F2P is viable, not just unpaywalled** — a free player reaches the same end-state as a spender, only possibly slower. Enforce via the free-path benchmark above; cosmetics are earnable, nothing is gated.
2. **Rewarded ads only**, and only where the player taps "watch". Interstitials and banners are off the table permanently, not just "for now".
3. **No dark patterns** — no fake scarcity ("offer ends in…"), no fake batteries, no accidental-purchase flows, no default-checked purchase options.
4. **Transparency** — the Remove Ads purchase page and ad opt-in buttons show plainly what they are; no misleading icons.
5. **Platform gating** — Google Play requires IAP for digital goods; web build stays 100% free with no ad SDKs bundled at all.
6. **Measure before scaling** — lightweight event logging (first-time-ad-view, IAP purchase, D1/D7 retention, free-path progress) before any UA spend.
7. **Compliance** — math idle games skew young: plan for a kid-safe age rating, and since ads reward minerals (a game item, not a real product), verify the ad SDK's kid-safety/`TAG_FOR_CHILD_DIRECTED_TREATMENT` setting for the chosen rating.

## 6. Suggested Order

1. **Quick wins (UX):** number formatting, pending-gain display, wrong-answer shake, save-on-blur, offline cap + welcome-back modal.
2. **Stability:** save migration + corrupt-save handling, tick drift fix, unit tests for math/save logic.
3. **Structure:** split `MinesOfDoom.tsx` into hooks/components, `balance.ts`, CI.
4. **Monetization (ethical):** daily bonus/streaks (retention first) → opt-in rewarded ads (offline ×2, cave-in rescue) → Remove Ads + earnable-also cosmetics. No pay-to-speed, web stays 100% free. Behind an ad/IAP provider abstraction so web never bundles an ad SDK.
5. **Juice:** floating text, haptics, milestone toasts, combo tier effects.
6. **Art:** pick sprite style (pixel art) → Skia `SpriteView`/shared-clock foundation → miner + mineral + gem sprites → cave tile layer → debris/depth variants.
7. **Features:** depth tiers → lifetime stats + overarching goal tiers (unlocking miner upgrades → gem upgrades → prestige → cosmetics as tiers complete) → achievements.
8. **Nice-to-have:** events, daily bonus, share codes, leaderboard.
