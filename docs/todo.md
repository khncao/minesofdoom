# Mines of Doom — UX, Improvements & New Features Plan

Status: planning draft
Last updated: 2026-09-02 (iteration 3)

Legend: [-] deferred (decision noted), [ ] not started, [o] in progress

Completed items are removed from this file (see git history); only remaining work is tracked here.

## General

- [ ] On-device Android verification (blocked on a device/emulator): boot the debug build and confirm the hermes `describe` crash does not fire. Nets are in place for the next occurrence — crash boundary + persisted log (`crashLog.ts` / `crashLogging.ts`), the `ErrorUtils` global-handler net, the crash-context session trail (rendered on the crash screen and in Settings → "Recent errors (debug)"), and the jest regression net. Build workflow if it resurfaces: debug via `npx expo run:android`; release via EAS or `npx expo run:android --variant release`.
- [ ] Extend `maestro/flows/` with deeper smoke coverage (mining tap, purchase, save/reload) as needed.
- [x] ~~Increase gem cost of cosmetics~~ → shipped: full ~4–5× rebalance of the gem price curve (outfits 15–75, pickaxes 25–90, themes 25–170; full collection ≈1260 💎). Calibrated against the free-path benchmark's new gem-income instrumentation (`gemGains` + `stopAtFirstPrestige` in `freePath.ts`): a 30-day free player earns ~1900 💎 (collection stays earnable — guardrail 1) while a first-prestige run earns only ~240 💎 (cosmetics stay a late-game sink, not an early one). Regression net: `__test__/cosmeticsBalance.test.ts`.
- [x] ~~Have cave background scroll/move as player mines deeper~~ → shipped: the cave now slides continuously while the player mines, not just one jump per tier threshold. Pure `getDepthTierProgress` (game.ts, 0→1 within the current tier, virtual span + cap in the final tier) feeds a new `progress` prop through MiningCanvas into `CaveBackground`, whose tier-change offset (one tile per threshold) hands off seamlessly from the gradual slide.
- [x] ~~Add inquiries link to email "minus4kelvin@gmail.com"~~ → shipped: ✉️ button in the footer row (next to the daily bonus) that opens `mailto:minus4kelvin@gmail.com` via `Linking.openURL` — no SDK, works on web and native alike (`InquiriesButton.tsx`). hidden at the bottom of settings
- [x] ~~Add privacy policy, disclaimer and other essential legal notices with links at the bottom of settings~~ → shipped: in-app legal documents in `legal.ts` (privacy policy + terms of use & disclaimer, written to match actual behavior: local-only storage, no ad SDK on web, store-processed IAP) opened from “Legal & privacy” links at the very bottom of Settings via scrollable BottomModals — in-app by design so the static web export and native builds need no external hosting. Contact section uses the same address as the inquiries button. Regression net: `__test__/legal.test.ts`.
- [ ] Add localizations

- [-] **BigInt for minerals** — deferred. `formatNumber` covers up to Qi (1e30); switching needs a save-format migration + full audit. Revisit when `MAX_SAFE_INTEGER` is realistically in reach.

- [ ] **Rewarded-ads** — implement integrations
- [ ] Optional ads to receive bonuses (daily, time away, etc.)

- [ ] Add the real Google/Apple store SDK integrations behind the `IapProvider` interface (Google Play Billing / StoreKit, or RevenueCat for receipt validation) — everything in-repo is prepped: stable `storeId` per product, `selectIapProvider` as the one-line swap point, and the full runbook/verification checklist in `docs/store-integration.md`. Blocked on store accounts (Play Console + App Store Connect) and the SDK decision (RevenueCat recommended).

- [ ] Cloud saves
- [ ] **Leaderboard** (optional, needs a backend or integrate with app store cloud features): depth reached, minerals/sec. (Local personal-bests view shipped — see note above; the LIVE board is what's left, still backend-gated.)

Note: the former "Achievements" item is done and removed per this file's convention — one-off bonus badges shipped long ago (`achievements.ts` + bonus grant in `useGameEngine`, badge list under Goals, progress row in Records, `__test__/achievements.test.ts`).
