# Mines of Doom — UX, Improvements & New Features Plan

Status: planning draft
Last updated: 2026-09-02

Legend: [-] deferred (decision noted), [ ] not started, [o] in progress

Completed items are removed from this file (see git history); only remaining work is tracked here.

## Adjust

(Lag / queued taps shipped: mining is hold-gated (300ms) and `useMineTaps` batches rapid taps into a 20Hz state flush; on top of that `useEquations.handleSubmit` and the keypad toggle are now stable callbacks and `AnswerInput` is memoized, so the focused `TextInput` no longer re-renders on the 1s tick or on each tap flush — re-rendering a focused input was most of the perceived tap lag, especially on web.)
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
- Holding the cave canvas (press-and-hold, ~300ms) also mines (click power only, resets combo); quick taps are no-ops.
- Currency chain: minerals → gems (100k) → miners (quadratic-ish cost) → passive minerals/sec.
- Combo: +1 per correct answer, resets on wrong answer or cave hold; multiplier = 1 + floor(combo/10).
- Depth = floor(minerals / 500), drives cave background.
- Save: manual save + autosave every 100 ticks (100s); offline progress computed on load.
- Settings: equation difficulty (max number, enabled operators), mute toggle.

## 2. UX Improvements

### 2.1 Layout & input

- **Keyboard handling.** On-screen keypad shipped: `NumericKeypad` (digits, ⌫ with hold-to-clear, highlighted `=` submit) is wired into `AnswerInput` behind a 🔢/⌨️ toggle next to the answer box, persisted in the `onScreenKeypad` storage key (off by default). In keypad mode no `TextInput` is mounted at all, so the game never depends on the OS keyboard (also the web-parity path — `inputMode="numeric"` is ignored in browsers). Remaining: verify `KeyboardAvoidingView` behavior in browser for the OS-keyboard path (`AnswerInput` still relies on it there — it is a no-op on web).

(Canvas tap vs. equation submit shipped: the cave now requires a ~300ms press-and-hold to mine — a quick tap is a deliberate no-op, so accidental combo resets while answering are gone. `MiningCanvas` hold logic + "hold to mine" hint, onboarding copy updated.)

(Button hierarchy shipped: `PurchaseButtons` groups rows by currency under tinted `SPEND ✦`/`SPEND ◈`/`PRESTIGE` headers, and the shared `Button` gained a `tone` prop (default `mineral` = historical brown, `gem` = steel blue) applied to the gem group.)

(Settings discoverability shipped: footer `SavePill` — 💾 Save saves immediately with a toast, and a pulsing amber dot (native-driver opacity loop, suppressed under reduce-motion) shows while `saveDirty` is true; the flag flips on any state change after load and clears on a successful write, in `useGameEngine`.)
- **Web parity.** On web, `inputMode="numeric"` is ignored and the keyboard is the OS one; the custom keypad (above) fixes this. Also test `KeyboardAvoidingView` behavior in browser (it is a no-op on web — `AnswerInput` currently relies on it).

## 3. General (code/technical) Improvements

### 3.1 Save system

- Tie in to app store cloud features

### 3.2 Game loop

(Documented: the ref-array + Context pattern is explained in `mines_of_doom/Context.tsx` — why a mutable ref array instead of state, the mount-push/unmount-splice contract, and the stable-identity memo in `MinesOfDoom.tsx`.)

### 3.4 Performance

(Verified: all decorative animation layers — `Miner` pickaxe swing/bounce, `DebrisParticles`, `BlockBreak`, `FloatingTextLayer`, `CaveBackground` scroll — drive their values with `useNativeDriver: true` and no per-frame React state; per-event React state (particle batches, floating texts) is throttled (80ms min trigger interval) and capped (12 particles / 5 blocks / 16 texts), so animation cost is bounded even under spam. On web the JS driver is the fallback by design (RNW has no native driver) and the caps keep it cheap. No changes needed.)

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

(Loading state shipped: `LoadingScreen` (pulsing ⛏️, native-driver loop, suppressed under reduce-motion) renders until `useGameEngine` reports the stored save is loaded — a slow AsyncStorage cold start no longer flashes the zeroed game state. Favicon/splash were already set in `app.config.ts`. Remaining "web polish" is open-ended; track concrete items here when found.)
- **iOS build** is already scripted (`expo run:ios`) — verify `expo-av` audio and AsyncStorage work, then consider TestFlight.

### 4.5 Art: real animated sprites (replace emojis)

Shipped: procedural pixel-art sprites for miners & pickaxes (`apps/utils/graphics/pixelArt.ts`, seeded cosmetic variants), plus the cave background as a memoized sprite tile layer (`apps/utils/graphics/caveTiles.ts` — per-tier 24px tile strips baked from the theme tint via the same runtime PNG pipeline, cached data URIs keyed by tint × tier × strip cycle; `CaveBackground` renders stretched `Image` rows over the existing native-driver scroll animation). (Shipped: pixel sprites for mineral chunks, gems, and debris shards in `pixelArt.ts` (`mineralChunkSpriteUri` / `gemSpriteUri` / `debrisSpriteUri`, cached PNG data URIs) — the cave's currency display now draws chunk/gem sprites instead of the 🪨/💎 emoji, and `DebrisParticles` renders shard/spark `Animated.Image`s instead of emoji text. Plus a shared animation clock (`apps/utils/graphics/animationClock.ts` — one 1s native-driver 0→1 loop; each miner interpolates that single value with a deterministic seed-derived phase offset, so the whole roster idles from ONE frame driver instead of N independent animations, and `Miner`'s idle bob is suppressed under the OS reduce-motion preference). Remaining:

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
