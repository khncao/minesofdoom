# Mines of Doom — UX, Improvements & New Features Plan

Status: planning draft
Last updated: 2026-09-01

Legend: [-] deferred (decision noted), [ ] not started, [o] in progress

Completed items are removed from this file (see git history); only remaining work is tracked here.

## Adjust

- [ ] Fix lag and queued taps when tapping quickly (note: `useMineTaps` already batches rapid taps into a 20Hz state flush)
- [ ] Fix ReferenceError: Property 'describe' doesn't exist, js engine: hermes on Android (not reproducible in web build; suspected expo-router/native-stack interaction — grab the full stack trace from the red box next time it appears)

## Stability (§6.2)

- [-] **BigInt for minerals** — deferred. `formatNumber` covers up to Qi (1e30); switching needs a save-format migration + full audit. Revisit when `MAX_SAFE_INTEGER` is realistically in reach.
- [-] **App store cloud save** — deferred (needs store account).

## Monetization (§6.4)

- [ ] Rewarded-ads
- [ ] Add Google/Apple store SDK integrations for in app purchases, RevenueCat/ad SDKs
- [ ] Cosmetics such as unique player and pickaxe skins with unique sounds, animations, and other audio-visual

## Art / sprites (§6.6)

- [ ] Implement graphical homages to games such as Minecraft, Terraria, Dark Souls, Bloodborne, Sekiro as long as no copyright violation

## 1. Current State (baseline)

- Core loop: solve a math equation → gain minerals × click power × combo multiplier.
- Tapping the cave canvas also mines (click power only, resets combo).
- Currency chain: minerals → gems (100k) → miners (quadratic-ish cost) → passive minerals/sec.
- Combo: +1 per correct answer, resets on wrong answer or canvas tap; multiplier = 1 + floor(combo/10).
- Depth = floor(minerals / 500), drives cave background.
- Save: manual save + autosave every 100 ticks (100s); offline progress computed on load.
- Settings: equation difficulty (max number, enabled operators), mute toggle.

## 2. UX Improvements

### 2.1 Layout & input

- **Keyboard handling.** On-screen keypad shipped: `NumericKeypad` (digits, ⌫ with hold-to-clear, highlighted `=` submit) is wired into `AnswerInput` behind a 🔢/⌨️ toggle next to the answer box, persisted in the `onScreenKeypad` storage key (off by default). In keypad mode no `TextInput` is mounted at all, so the game never depends on the OS keyboard (also the web-parity path — `inputMode="numeric"` is ignored in browsers). Remaining: verify `KeyboardAvoidingView` behavior in browser for the OS-keyboard path (`AnswerInput` still relies on it there — it is a no-op on web).
- **Canvas tap vs. equation submit.** Tapping the cave resets the combo — easy to do accidentally while playing fast. Options: require a short hold, or make the canvas a secondary "slow" action and move it below the fold / behind a button.
- **Button hierarchy.** All three purchase buttons look identical. Visually distinguish: upgrade (minerals), miner (gems), gem (minerals→gems). Consider grouping by currency with headers.
- **Settings modal discoverability.** Add a labeled icon or a "Settings" pill. Also add a visible "Save" affordance outside the modal (e.g., a small save indicator that pulses when the save is stale).
- **Web parity.** On web, `inputMode="numeric"` is ignored and the keyboard is the OS one; the custom keypad (above) fixes this. Also test `KeyboardAvoidingView` behavior in browser (it is a no-op on web — `AnswerInput` currently relies on it).

## 3. General (code/technical) Improvements

### 3.1 Save system

- Tie in to app store cloud features

### 3.2 Game loop

- `onTick` ref array + Context is a fine pattern, but document it; currently only miners use it.

### 3.4 Performance

- `DebrisParticles` and `Miner` animations: verify they run on the native driver / don't trigger React re-renders per frame.

## 4. Potential New Features

### 4.1 Progression & depth

(all items done — depth tiers, achievements, prestige, miner upgrades/types)

### 4.2 Gameplay variety

- **Equation modes.** All three shipped: hard mode (3-term equations, ×2 payout), timed mode (10s window per equation, ×2 for a within-window answer, timeout = miss via the normal wrong-answer path so combo resistance applies), and streak mode (5 consecutive correct answers ignite a ×2 premium that lasts until a wrong answer / timed-mode timeout breaks the run — mine taps do NOT break the streak, unlike the combo; session-scoped, like the combo). Toggles in `equations.ts` (`hardMode` / `timedMode` / `streakMode` settings, persisted under `equationSettingsKey`, no save bump), the streak counter in `useEquations` (`streak` / `streakActive`), the window bar + streak readout in `EquationDisplay`, and all premiums stack via `getAnswerPayoutMultiplier` in `game.ts` (`HARD_MODE_PAYOUT` / `TIMED_MODE_PAYOUT` / `STREAK_MODE_PAYOUT`).

(Daily bonus / login streak shipped in `dailyBonus.ts` + `useDailyBonus` — 🎁 button next to the goals panel, streak-capped at ×7, persisted in its own `dailyBonus` storage key.)

### 4.3 Meta / social

- **Leaderboard** (optional, needs a backend or integrate with app store cloud features): depth reached, minerals/sec.

(Shareable save codes shipped in `saveCode.ts` — settings panel export/import, `MOD1.`-prefixed base64, decoded through the same migration pipeline as the storage loader.)

### 4.4 Platform

- **PWA / web polish.** Add a proper loading state (favicon/splash already set in `app.config.ts`).
- **iOS build** is already scripted (`expo run:ios`) — verify `expo-av` audio and AsyncStorage work, then consider TestFlight.

### 4.5 Art: real animated sprites (replace emojis)

Shipped: procedural pixel-art sprites for miners & pickaxes (`apps/utils/graphics/pixelArt.ts`, seeded cosmetic variants). Remaining:

- **Cave background** is still a text-grid `CaveBackground` (tier-tinted) — replace with a real tile layer (Skia or memoized sprite grid); the §4.5 Skia/sprite-sheet approach was not adopted.
- **Mineral chunk / gem / debris shard sprites** and a shared animation clock for miners.
- Optional: `EMOJI_ART` fallback setting for low-end devices.

### 4.6 Overarching goals

(done — tiered goal chain in `goals.ts` with lifetime stats, one-time bonuses, and the Goals panel)

## 5. Monetization (ethical, F2P-first)

**Core principle: the game is fully complete and winnable free.** Paid options only (a) remove ads and (b) sell cosmetics that the free player can also unlock through play. No stat-gated IAP, no pay-to-speed, no subscription, no dark patterns. Every "buy" offer must be skippable and the player must be able to finish the full loop (depth tiers → achievements → prestige) with minerals/gems earned in-game alone.

F2P viability is a design constraint, not a marketing line — enforce it with a **free-path benchmark**: a pure free player should reach first prestige in a target time (e.g., ~7 days of normal idle+play). When tuning `balance.ts`, regression-check this path; if a change slows it, rebalance instead of selling the difference.

### 5.1 Rewarded video ads — strictly opt-in, reward-only

Every ad is a bonus the player actively requests. No interstitials, no banners, no ads on the equation flow (they'd ruin the combo/tap rhythm).

- **Offline earnings ×2** — the "welcome back" toast is the natural opt-in: "Watch to double your offline minerals." No other context converts better.
- **Gem rolls** — "watch for 5 free gem rolls" as a daily-limited reward (e.g., 3/day) instead of buying gems with minerals.
- **Instant offline top-up** — once offline progress hits the cap, watching extends it by +2h.
- Implementation: `expo-ad-adsense` or `react-native-ads-mediation` (AdMob/Unity). Gate behind a provider abstraction so web falls back to a no-op. Track impressions/rewards in-app to detect fraud (cap rewards per session, e.g., ≤10/day).
- **Ad-free by default on every platform except where the player taps "watch".** "Remove Ads" (5.2) permanently disables even the opt-in buttons.

### 5.2 In-app purchases — minimal catalog, no pay-to-speed

Deliberately tiny: two kinds of product, nothing else.

- **Remove Ads** ($2.99–$4.99, one-time) — the anchor IAP. Disables all ad entry points.
- **Cosmetic packs** ($0.99–$3.99 each) — cave themes (pairs with 4.3), miner skins, UI color themes. Purely visual, and **every pack is also earnable in-game** (depth unlocks / achievements), so buying is convenience, not access.

Explicitly out of scope (and why):

- ~~Starter boost packs / mineral IAP~~ — selling currency in an idle game is a pay-to-speed backdoor; the early game should be a gentle onboarding, not a wall.
- ~~Timed power-up consumables ("Golden Pick")~~ — recurring consumption pressure on an idle loop is the main source of "predatory" perception; skip.
- ~~Subscriptions~~ — wrong model for a one-purchase-lifetime-value game.

Store: RevenueCat (or `react-native-iap` directly) for receipts/entitlements across Android/iOS. Requires receipt validation → keep the free build fully functional without it.

### 5.3 Retention & organic growth (ship before any monetization)

- **Daily bonus / streaks** (4.2) — the retention surface that makes the rewarded ads worth their while.
- **Share codes / achievements** — free word-of-mouth acquisition (lower CAC than paid UA).
- If the game gets a meaningful audience: consider a **sponsorship/branding event** (e.g., a themed biome for a partner) instead of heavier ad loads.
