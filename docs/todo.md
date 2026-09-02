# Mines of Doom — UX, Improvements & New Features Plan

Status: planning draft
Last updated: 2026-09-02

Legend: [-] deferred (decision noted), [ ] not started, [o] in progress

Completed items are removed from this file (see git history); only remaining work is tracked here.

## General

- [ ] On-device Android verification (blocked on a device/emulator): boot the debug build and confirm the hermes `describe` crash does not fire. Nets are in place for the next occurrence — crash boundary + persisted log (`crashLog.ts` / `crashLogging.ts`), the `ErrorUtils` global-handler net, the crash-context session trail (rendered on the crash screen and in Settings → "Recent errors (debug)"), and the jest regression net. Build workflow if it resurfaces: debug via `npx expo run:android`; release via EAS or `npx expo run:android --variant release`.
- [ ] Extend `maestro/flows/` with deeper smoke coverage (mining tap, purchase, save/reload) as needed.
- [ ] Increase gem cost of cosmetics
- [ ] Have cave background scroll/move as player mines deeper

## Stability (§6.2)

- [-] **BigInt for minerals** — deferred. `formatNumber` covers up to Qi (1e30); switching needs a save-format migration + full audit. Revisit when `MAX_SAFE_INTEGER` is realistically in reach.
- [-] **App store cloud save** — deferred (needs store account).

## Monetization (§6.4)

- [o] **Rewarded-ads** — reward economy + provider abstraction shipped: `ads.ts` (pure rules — 5 💎 per watch, 3/day; offline-×2 as a one-shot pending offer held by the engine; ≤10 rewards/day fraud cap; `AdProvider` interface with no-op production + clearly-labeled dev-sim provider), `useAdRewards` + `AdRewardsPanel` (footer 🎬 entry point, rendered only when a provider reports available, so production UI is untouched until a real SDK ships), plus guardrail-6 local event logging (`analytics.ts`/`useAnalytics`: app opens, D1/D7 retention, first ad view, IAP purchase counters, first prestige — one small AsyncStorage record, no SDK, no PII). (+2h offline top-up shipped as the third panel row: `computeOfflineTopUpMinerals` in `game.ts` — granted ONLY when the away time actually hit the 8h cap (nothing withheld ⇒ no offer), itself capped at `offlineTopUpTicks` (2h) — held by the engine as a one-shot pending offer on load (and save-code import, same path as the double) and claimed through the same daily fraud caps. The base 8h haul is still paid unconditionally at load; the top-up only pays the extra hours.)

Remaining: the external half of the runbook — store accounts, product creation, SDK packages, and the one-line swaps (`docs/store-integration.md`): real ad SDK (expo-ad-adsense or react-native-ads-mediation; web stays no-op per guardrail 5) + real store SDK behind the same interfaces.
(IAP foundation shipped: `iaps.ts` — the deliberately-tiny catalog (Remove Ads, one-time, $2.99 display price with a plain-English blurb per guardrail 4), the `IapProvider` interface (production no-op whose entry points stay hidden, plus a clearly-labeled dev-sim selected behind `__DEV__`, mirroring the ads provider pattern), and the entitlement rules (grant/merge pure functions, merge is additive-only and returns the original reference when unchanged so restores skip no-op writes). `useIap` owns the lifecycle (purchase → validated → grant entitlement → analytics) and persists entitlements device-locally under the `iap` storage key — deliberately OUTSIDE the game save, so a shared/imported save can never carry the sender's store receipts. `IapPanel` (footer 🛍️, dev-sim banner, Restore row) renders only when a provider reports itself available, so production builds never show a Buy button until a real store SDK ships; owning Remove Ads hides BOTH the purchases panel and the rewarded-ads panel (plan §5.1 "permanently disables even the opt-in buttons"). The first validated purchase fires `recordIapPurchase` through `useAnalytics` (first-IAP day + purchase count, guardrail 6).)

- [ ] Skippable ads on set intervals
- [ ] Optional ads to receive bonuses (daily, time away, etc.)

- [ ] Add the real Google/Apple store SDK integrations behind the `IapProvider` interface (Google Play Billing / StoreKit, or RevenueCat for receipt validation) — everything in-repo is prepped: stable `storeId` per product, `selectIapProvider` as the one-line swap point, and the full runbook/verification checklist in `docs/store-integration.md`. Blocked on store accounts (Play Console + App Store Connect) and the SDK decision (RevenueCat recommended).

### Rewarded video ads — strictly opt-in, reward-only

Every ad is a bonus the player actively requests. No interstitials, no banners, no ads on the equation flow (they'd ruin the combo/tap rhythm).

- **Offline earnings ×2** — the "welcome back" toast is the natural opt-in: "Watch to double your offline minerals." No other context converts better.
- **Gem rolls** — "watch for 5 free gem rolls" as a daily-limited reward (e.g., 3/day) instead of buying gems with minerals.
- **Instant offline top-up** — once offline progress hits the cap, watching extends it by +2h. (Shipped — see the monetization item above; all three §5.1 reward kinds are now playable end-to-end in dev builds behind the same caps.)
- Implementation: `expo-ad-adsense` or `react-native-ads-mediation` (AdMob/Unity). Gate behind a provider abstraction so web falls back to a no-op. Track impressions/rewards in-app to detect fraud (cap rewards per session, e.g., ≤10/day).

### In-app purchases — minimal catalog, no pay-to-speed

Deliberately tiny: two kinds of product, nothing else.

- **Remove Ads** ($2.99–$4.99, one-time) — the anchor IAP. Disables all ad entry points.
- **Cosmetic packs** ($0.99–$3.99 each) — cave themes (pairs with 4.3), miner skins, UI color themes. Purely visual, and **every pack is also earnable in-game** (depth unlocks / achievements), so buying is convenience, not access.

Store: RevenueCat (or `react-native-iap` directly) for receipts/entitlements across Android/iOS. Requires receipt validation → keep the free build fully functional without it.

### App Store or Cloud Integrations

- Cloud saves
- **Leaderboard** (optional, needs a backend or integrate with app store cloud features): depth reached, minerals/sec. (Local personal-bests view shipped — see note above; the LIVE board is what's left, still backend-gated.)
- **Achievements**

### 5.3 Retention & organic growth (ship before any monetization)

- If the game gets a meaningful audience: consider a **sponsorship/branding event** (e.g., a themed biome for a partner) instead of heavier ad loads.
