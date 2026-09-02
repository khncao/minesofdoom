# Mines of Doom — UX, Improvements & New Features Plan

Status: planning draft
Last updated: 2026-09-02

Legend: [-] deferred (decision noted), [ ] not started, [o] in progress

Completed items are removed from this file (see git history); only remaining work is tracked here.

Path note: source moved from `apps/` to `src/` (2026-09-02, web-export fix — see §4.4); bare import specifiers went from `apps/*` to `src/*`. Path references in the historical entries below that say `apps/...` mean `src/...`.

## Adjust

(Crash-context tracing shipped: every crash entry now carries the session trail captured at crash time — `crashContext.ts` keeps a bounded in-memory ring of high-level transitions only (app start, save loaded, prestige, reset, save import, manual save, daily bonus, ad reward, IAP purchase/restore, equation-mode toggles — never per-tick/per-answer, so the trail can't be evicted by normal play) plus a small state snapshot (depth / prestiges / gems / platform / dev), snapshotted into `CrashEntry.context` by `recordCrash` and rendered both on the crash screen and in Settings → "Recent errors (debug)". The crash screen also gained a "Reload page" button on web. So when the `describe` crash next fires on-device, the trace reads as a story (what the game was doing) next to the stack — remaining: reproduce on device.)
- [x] Fix ReferenceError: Property 'describe' doesn't exist, js engine: hermes on Android (not reproducible in web build; suspected expo-router/native-stack interaction) — resolved as far as possible without a device repro: statically traced the full `describe` chain (expo-router 4.0.22 forked `createNativeStackNavigator` → `useNavigationBuilder` → `NativeStackView.native.js`) and verified it is internally consistent, and added a jest regression net (`apps/__test__/nativeStackWiring.test.tsx`) that renders that exact Android (`.native.js`) code path — including a self-check that jest resolves the native file, not the web fallback — so the next regression of this wiring fails in CI instead of as an on-device ReferenceError. If the crash still fires, the crash nets + context trail above will carry the trace.

(Lag / queued taps shipped: mining is hold-gated (300ms) and `useMineTaps` batches rapid taps into a 20Hz state flush; on top of that `useEquations.handleSubmit` and the keypad toggle are now stable callbacks and `AnswerInput` is memoized, so the focused `TextInput` no longer re-renders on the 1s tick or on each tap flush — re-rendering a focused input was most of the perceived tap lag, especially on web.)

(Crash diagnostics shipped for the unreproducible Android crash below: `ErrorBoundary` (`mines_of_doom/components`) now wraps the game screen in `apps/index.tsx` — a render crash shows a crash screen with the full long-press-copyable stack instead of a silent white screen (release builds have no red box), and every crash is recorded into a persisted ring of 5 with consecutive-duplicate `×count` (`crashLog.ts` pure logic + unit tests, `crashLogging.ts` AsyncStorage `crashLog` key with serialized read-modify-write and an in-memory fallback) that also surfaces in Settings → “Recent errors (debug)” with a Clear button, so the trace survives a restart. Plus the second net: an `ErrorUtils` global-handler wrapper (`useGlobalCrashCapture` hook, installed from `apps/index.tsx`) records errors thrown OUTSIDE the React render tree — native-stack listeners, timers, native-module callbacks — into the same log with a `(global)` tag, then hands the error to the previous handler so the dev red box is preserved. The earlier “RN 0.76 dropped ErrorUtils” note was wrong — it IS exported from the main entry; web (react-native-web has no ErrorUtils) is handled with a guarded lazy require that no-ops, so the static export stays intact. Each log entry now carries `source: "render" | "global"` (old logs parse as `render` — they were boundary-only anyway), so the next trace will show which layer caught it.)
- [x] Fix ReferenceError: Property 'describe' doesn't exist, js engine: hermes on Android (second occurrence) — same outcome as the first entry above: wiring statically verified, jest regression net covering the `.native.js` path in place, and both crash nets will capture the layer + trace of any further occurrence.

## Stability (§6.2)

- [-] **BigInt for minerals** — deferred. `formatNumber` covers up to Qi (1e30); switching needs a save-format migration + full audit. Revisit when `MAX_SAFE_INTEGER` is realistically in reach.
- [-] **App store cloud save** — deferred (needs store account).

## Monetization (§6.4)

- [o] **Rewarded-ads** — reward economy + provider abstraction shipped: `ads.ts` (pure rules — 5 💎 per watch, 3/day; offline-×2 as a one-shot pending offer held by the engine; ≤10 rewards/day fraud cap; `AdProvider` interface with no-op production + clearly-labeled dev-sim provider), `useAdRewards` + `AdRewardsPanel` (footer 🎬 entry point, rendered only when a provider reports available, so production UI is untouched until a real SDK ships), plus guardrail-6 local event logging (`analytics.ts`/`useAnalytics`: app opens, D1/D7 retention, first ad view, IAP purchase counters, first prestige — one small AsyncStorage record, no SDK, no PII). (+2h offline top-up shipped as the third panel row: `computeOfflineTopUpMinerals` in `game.ts` — granted ONLY when the away time actually hit the 8h cap (nothing withheld ⇒ no offer), itself capped at `offlineTopUpTicks` (2h) — held by the engine as a one-shot pending offer on load (and save-code import, same path as the double) and claimed through the same daily fraud caps. The base 8h haul is still paid unconditionally at load; the top-up only pays the extra hours.)

(Local stats debug surface shipped, closing the read side of guardrail 6: the analytics record was previously write-only — now Settings → "Local stats (debug)" renders `summarizeAnalytics` (one plain-text line per field, stable order, "never" for unfired one-shots — selectable so it can be copied/long-press-shared off-device) with a Clear button as the data-deletion path (`useAnalytics.clear` = removeItem; a fresh record is established on the next open, per the module's deletion semantics). The hook now reads through a `parseAnalytics` migrator (legacy pre-`prestiges` records parse — a stamped first-prestige day implies ≥1 — and corrupt/non-object raw starts fresh), and free-path progress counts EVERY prestige sunk live this session (`prestiges`), not just the first-prestige day. Single-owner discipline kept: `MinesOfDoom`'s `useAnalytics` is the only writer; Settings receives the record as a read-through prop, so there's no second AsyncStorage reader to race it.)

(SDK-readiness prep shipped for BOTH reward and purchase lines: provider selection moved from `MinesOfDoom.tsx` into `selectAdProvider` / `selectIapProvider` (one documented function body each — the real-SDK swap edits ONE line and never the UI), pinned by tests (`ads.test.ts` / `iaps.test.ts` "provider selection"); the IAP catalog gained stable store-side `storeId` slugs per product (`IAP_STORE_IDS`, Play-Billing/App-Store/RevenueCat-safe, uniqueness + shape test-pinned) so the store consoles can be populated before the SDK lands; and `docs/store-integration.md` is the end-to-end runbook — product table, RevenueCat-recommended validation path, provider implementation sketch, on-device verification checklist, kid-safety/compliance notes, plus the §4.4 iOS/TestFlight steps.)

Remaining: the external half of the runbook — store accounts, product creation, SDK packages, and the one-line swaps (`docs/store-integration.md`): real ad SDK (expo-ad-adsense or react-native-ads-mediation; web stays no-op per guardrail 5) + real store SDK behind the same interfaces.
(IAP foundation shipped: `iaps.ts` — the deliberately-tiny catalog (Remove Ads, one-time, $2.99 display price with a plain-English blurb per guardrail 4), the `IapProvider` interface (production no-op whose entry points stay hidden, plus a clearly-labeled dev-sim selected behind `__DEV__`, mirroring the ads provider pattern), and the entitlement rules (grant/merge pure functions, merge is additive-only and returns the original reference when unchanged so restores skip no-op writes). `useIap` owns the lifecycle (purchase → validated → grant entitlement → analytics) and persists entitlements device-locally under the `iap` storage key — deliberately OUTSIDE the game save, so a shared/imported save can never carry the sender's store receipts. `IapPanel` (footer 🛍️, dev-sim banner, Restore row) renders only when a provider reports itself available, so production builds never show a Buy button until a real store SDK ships; owning Remove Ads hides BOTH the purchases panel and the rewarded-ads panel (plan §5.1 "permanently disables even the opt-in buttons"). The first validated purchase fires `recordIapPurchase` through `useAnalytics` (first-IAP day + purchase count, guardrail 6).)
- [ ] Add the real Google/Apple store SDK integrations behind the `IapProvider` interface (Google Play Billing / StoreKit, or RevenueCat for receipt validation) — everything in-repo is prepped: stable `storeId` per product, `selectIapProvider` as the one-line swap point, and the full runbook/verification checklist in `docs/store-integration.md`. Blocked on store accounts (Play Console + App Store Connect) and the SDK decision (RevenueCat recommended).

(Cosmetic IAP packs shipped: the `iaps.ts` catalog gained one pack per cosmetic line — Shadow Pickaxe ($1.99), Crimson Oni outfit ($0.99), Cherry & Indigo cave theme ($2.99), all inside plan §5.2's $0.99–$3.99 band. `IAP_PACK_GRANTS` maps each pack to the id of an EXISTING gem-shop cosmetic, and a validated purchase/restore joins it to the current save's owned lists at no gem cost via the idempotent `grantIapCosmetics` engine updater, driven from a `MinesOfDoom` effect keyed on the entitlements + owned-list refs — so it re-grants on load, restore, save import, and reset (the pack belongs to the player, not one save) and never fires on the 1s tick. `IapPanel` now renders rows from `IAP_PRODUCT_LIST` with an "also earnable in-game for N 💎 — buying is convenience, not access" line per pack (guardrails 1 & 4; a test pins every granted cosmetic exists in the live catalog with a gem cost > 0) and Owned state from either the entitlement or the save. Production is untouched: the no-op provider still hides the panel entirely, and dev builds exercise the full buy → unlock → Cosmetics flow behind the dev-sim banner, same convention as the ads.)
(Cosmetics shipped across two lines: (1) the catalog — programmatic skins, pickaxes, and cave themes in `cosmetics.ts` (all gem-buyable, §5.2 cosmetic pack source) — and (2) the audio-visual uniqueness: each pickaxe now has its own synthesized strike sound (`soundFile` per pickaxe, wavs generated by `scripts/generate-pickaxe-sounds.mjs`, required in `assets/index` as `pickaxeSoundFiles`, played by `useSounds(muted, equippedPickaxeId)` which falls back to the generic sound for unknown ids) and its own swing feel — `PickaxeFeel` (`swingMs` / `bounceDepth`) in `cosmetics.ts`, consumed by `Miner`'s swing animation, so the equipped pickaxe's mining taps sound and move differently per skin.)

(Art homages shipped: five original-palette homage cave themes (Blockfall Mines / Wilds Below / Aschen Depths / Fog & Lantern / Cherry & Indigo, 25–45 💎) and five homage outfits (Blocky Adventurer / Frontier Explorer / Ashen Knight / Wandering Hunter / Crimson Oni, 8–18 💎) in `cosmetics.ts` — they evoke the voxel-sandbox, sandbox, soulslike, gothic-hunt, and samurai-era worlds through color alone, with no game names, sprites, or assets (so homage, not copy — no copyright/trademark exposure; a test pins the absence of brand names in catalog names/blurbs). Optional `blurb` credit line added to `OutfitCosmetic`/`CaveTheme`, rendered in `CosmeticsSection`. Pure catalog data: no save-format change, purchase path untouched.)

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

- **Keyboard handling.** On-screen keypad shipped: `NumericKeypad` (digits, ⌫ with hold-to-clear, highlighted `=` submit) is wired into `AnswerInput` behind a 🔢/⌨️ toggle next to the answer box, persisted in the `onScreenKeypad` storage key (off by default). In keypad mode no `TextInput` is mounted at all, so the game never depends on the OS keyboard (also the web-parity path — `inputMode="numeric"` is ignored in browsers). (OS-keyboard web parity resolved: `AnswerInput` now renders a plain `View` on web instead of `KeyboardAvoidingView` — the browser keyboard does not shift page layout, so there is nothing to avoid; RNW's KAV is a no-op anyway, and the explicit `Platform.OS` branch keeps the web bundle free of that module with the intent documented.)

(Canvas tap vs. equation submit shipped: the cave now requires a ~300ms press-and-hold to mine — a quick tap is a deliberate no-op, so accidental combo resets while answering are gone. `MiningCanvas` hold logic + "hold to mine" hint, onboarding copy updated.)

(Button hierarchy shipped: `PurchaseButtons` groups rows by currency under tinted `SPEND ✦`/`SPEND ◈`/`PRESTIGE` headers, and the shared `Button` gained a `tone` prop (default `mineral` = historical brown, `gem` = steel blue) applied to the gem group.)

(Settings discoverability shipped: footer `SavePill` — 💾 Save saves immediately with a toast, and a pulsing amber dot (native-driver opacity loop, suppressed under reduce-motion) shows while `saveDirty` is true; the flag flips on any state change after load and clears on a successful write, in `useGameEngine`.)
- **Web parity.** On web, `inputMode="numeric"` is ignored and the keyboard is the OS one; the custom keypad (above) fixes this. (KAV item closed with the keypad item above: web renders a plain `View`, so `AnswerInput` no longer relies on `KeyboardAvoidingView` at all there.)

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

(Records shipped — the offline-first half of the leaderboard: a third view in the footer menu ("📊 Records") renders `getRecords` (pure, `records.ts`) — every row is a lifetime stat already on the save (deepest depth, longest combo, lifetime minerals/answers/miners, gems minted/spent, prestiges, goal tiers + achievements as done/total), so a record is genuinely personal-best and survives spending/prestige; the same metrics a future live leaderboard would submit. The rows come pre-formatted from the pure module, so `RecordsPanel` is a dumb list renderer, and `__test__/records.test.ts` pins zero-save values, stat pass-through, tier/achievement derivation (same thresholds as the goals view, so the two views can't disagree), and stable row order.)
- **Leaderboard** (optional, needs a backend or integrate with app store cloud features): depth reached, minerals/sec. (Local personal-bests view shipped — see note above; the LIVE board is what's left, still backend-gated.)

(Shareable save codes shipped in `saveCode.ts` — settings panel export/import, `MOD1.`-prefixed base64, decoded through the same migration pipeline as the storage loader.)

### 4.4 Platform

(Web document metadata shipped: the exported page shipped with an EMPTY `<title>` (empty browser tab) and no meta description — the root cause is that expo-router's default document template (`expo-router/html`) contains no `<title>` tag at all, and this pipeline version also injects a leftover empty RNW `<title>` as the first `<head>` child, so `web.name` in `app.config.ts` never reached the HTML. Fix: `src/app/+html.tsx` — a custom document template (the standard expo-router escape hatch; `+html`/`+api` are filtered out of the route table, so it adds no HTML routes and the "only routes under src/app" rule needs exactly this one exception). It renders `<title>`, `description` and `theme-color` (`#2f2f2f`, the cave background) around expo-router's `ScrollViewStyleReset`; per the HTML spec's in-head insertion mode the LAST `<title>` wins, so ours (after the injected empty one) is the tab title. Verified in the exported dist: exactly 3 routes, title + description present on `/` and `/+not-found`. Also removed `src/components/DropdownMenu.tsx` — dead code superseded by `BottomModal` (which already handles the viewport-cropping concern its TODO flagged, via scrollable + 90% max-height clamping).)

(Web static export fixed: `expo export -p web` was emitting an HTML page for EVERY file under the expo-router root — and the router root WAS the whole source tree, so dist shipped 95 routes (one per source file: tests, hooks, utils, even `.d.ts` shims) when the app has exactly one screen. Root cause: expo-router treats every file under its root as a route (only `+html`/`+api` are filtered by default; the CLI's `extra.router.ignore` hook is not wired into the export path in this toolchain version). Fix: restructured so ONLY routes live in the router root — all source moved `apps/` → `src/` with `src/app/index.tsx` as the sole route (expo-router root is now `src/app`), bare specifiers renamed `apps/*` → `src/*` (tsconfig paths + jest moduleNameMapper, all import sites sed-updated). `npm run predeploy` now emits exactly 3 static routes (`/`, `/_sitemap`, `/+not-found`) and a 2.4 MB dist with no test modules in the bundle; guardrail 5 re-verified (no ad-SDK strings in the web bundle). AGENTS.md architecture/module-resolution sections updated.
(Loading state shipped: `LoadingScreen` (pulsing ⛏️, native-driver loop, suppressed under reduce-motion) renders until `useGameEngine` reports the stored save is loaded — a slow AsyncStorage cold start no longer flashes the zeroed game state. Favicon/splash were already set in `app.config.ts`. Remaining "web polish" is open-ended; track concrete items here when found.)
- **iOS build** is already scripted (`expo run:ios`) — verify `expo-av` audio and AsyncStorage work, then consider TestFlight. (Checklist for both — audio/playback + persistence smoke test, version-bump reminder, TestFlight internal-test track — is now §3 of `docs/store-integration.md`, bundled with the store work since both need the prebuilt native project on a device.)

### 4.5 Art: real animated sprites (replace emojis)

Shipped: procedural pixel-art sprites for miners & pickaxes (`apps/utils/graphics/pixelArt.ts`, seeded cosmetic variants), plus the cave background as a memoized sprite tile layer (`apps/utils/graphics/caveTiles.ts` — per-tier 24px tile strips baked from the theme tint via the same runtime PNG pipeline, cached data URIs keyed by tint × tier × strip cycle; `CaveBackground` renders stretched `Image` rows over the existing native-driver scroll animation). (Shipped: pixel sprites for mineral chunks, gems, and debris shards in `pixelArt.ts` (`mineralChunkSpriteUri` / `gemSpriteUri` / `debrisSpriteUri`, cached PNG data URIs) — the cave's currency display now draws chunk/gem sprites instead of the 🪨/💎 emoji, and `DebrisParticles` renders shard/spark `Animated.Image`s instead of emoji text. Plus a shared animation clock (`apps/utils/graphics/animationClock.ts` — one 1s native-driver 0→1 loop; each miner interpolates that single value with a deterministic seed-derived phase offset, so the whole roster idles from ONE frame driver instead of N independent animations, and `Miner`'s idle bob is suppressed under the OS reduce-motion preference). Plus the low-end fallback: an "Emoji art" toggle in settings (`emojiArt` in `SettingsData`, default off, saved with the other settings) flips `Miner` (seeded emoji bodies + ⛏️), the currency icons, `DebrisParticles` (emoji burst) and `CaveBackground` (flat tinted rows, no PNG strips) to plain emoji — zero sprite decode/render on slow devices, gameplay untouched. §4.5 is now fully shipped.

### 4.6 Overarching goals

(done — tiered goal chain in `goals.ts` with lifetime stats, one-time bonuses, and the Goals panel)

## 5. Monetization (ethical, F2P-first)

**Core principle: the game is fully complete and winnable free.** Paid options only (a) remove ads and (b) sell cosmetics that the free player can also unlock through play. No stat-gated IAP, no pay-to-speed, no subscription, no dark patterns. Every "buy" offer must be skippable and the player must be able to finish the full loop (depth tiers → achievements → prestige) with minerals/gems earned in-game alone.

F2P viability is a design constraint, not a marketing line — enforce it with a **free-path benchmark**: a pure free player should reach first prestige in a target time (e.g., ~7 days of normal idle+play).

(Free-path benchmark shipped as a CI regression gate: `freePath.ts` — a free casual persona (2h active + 22h offline/day, answer every 10s at 90% accuracy, cave hold-tap every 4s, greedy "normal player" shopping with capped sinks) drives the SAME formulas, cost curves, and caps the engine uses (all imported from `game.ts`/`dailyBonus.ts`, nothing re-implemented) through a seeded PRNG. `freePath.test.ts` asserts a pure free player (no ads, no IAP) crosses first prestige (lifetime 5M) within the plan's ~7-day target (~5.3 days today, so the bound has real slack), plus determinism, an earned-breakdown conservation check, and that lighter play styles (45m and 30m active days) still arrive within relaxed horizons — so the free path can't quietly wall off on a cost-curve change. When tuning any cost curve or payout in `game.ts` (the balance lives there, not in a separate `balance.ts`), this test is the regression check: if it fails, rebalance instead of selling the difference.)

### 5.1 Rewarded video ads — strictly opt-in, reward-only

Every ad is a bonus the player actively requests. No interstitials, no banners, no ads on the equation flow (they'd ruin the combo/tap rhythm).

- **Offline earnings ×2** — the "welcome back" toast is the natural opt-in: "Watch to double your offline minerals." No other context converts better.
- **Gem rolls** — "watch for 5 free gem rolls" as a daily-limited reward (e.g., 3/day) instead of buying gems with minerals.
- **Instant offline top-up** — once offline progress hits the cap, watching extends it by +2h. (Shipped — see the monetization item above; all three §5.1 reward kinds are now playable end-to-end in dev builds behind the same caps.)
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
