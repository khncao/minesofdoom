# Mines of Doom — UX, Improvements & New Features Plan

Status: planning draft
Last updated: 2026-09-02 (iteration 10)

Legend: [-] deferred (decision noted), [ ] not started, [o] in progress

Completed items are removed from this file (see git history); only remaining work is tracked here.

- [ ] On-device Android verification (blocked on a device/emulator): boot the debug build and confirm the hermes `describe` crash does not fire. Nets are in place for the next occurrence — crash boundary + persisted log (`crashLog.ts` / `crashLogging.ts`), the `ErrorUtils` global-handler net, the crash-context session trail (rendered on the crash screen and in Settings → "Recent errors (debug)"), and the jest regression net. Build workflow if it resurfaces: debug via `npx expo run:android`; release via EAS or `npx expo run:android --variant release`.
- [o] **Add localizations** — EN/ES UI strings shipped (iteration 9): `src/utils/i18n/` tables (en = source of truth, es typed against its key set, placeholder parity pinned in `i18n.test.ts`), `useI18n` hook (preference persisted in AsyncStorage key `language`, separate from the save), language picker in Settings (Auto/English/Español, each shown in its own name), device detection via `expo-localization` with a web `navigator.language` fallback. All screen UI, toasts, tooltips, a11y labels, onboarding, and the crash screen are translated. **Deferred:** data-driven content names (cosmetics, goal tiers, achievements, records labels, IAP product labels, legal doc titles/sections, biome/tier names) still live in their data modules — follow-up is to give those tables a per-locale shape and thread the locale through.
- [ ] Depth and screen scrolling should be based on lifetime mining
- [ ] Configurable equation display (7 * 2, 7 x 2)
- [ ] More types of simple mental arithmetics for all ages
- [ ] Create E2E tests for Android on phone, 7 inch tablet, and 10 inch tablet and generate 4 in game screenshots in various states for each

- [ ] **BigInt for minerals** — `formatNumber` covers up to Qi (1e30). Implement as not fully released yet so no need for migrations

- [ ] **Rewarded-ads** — implement integrations
- [ ] Allowing saving combo with rewarded-ad
- [ ] Optional ads to receive bonuses (daily, time away, etc.)

- [ ] Add the real Google/Apple store SDK integrations behind the `IapProvider` interface (Google Play Billing / StoreKit, or RevenueCat for receipt validation) — everything in-repo is prepped: stable `storeId` per product, `selectIapProvider` as the one-line swap point, and the full runbook/verification checklist in `docs/store-integration.md`. Blocked on store accounts (Play Console + App Store Connect) and the SDK decision (RevenueCat recommended).

- [ ] Cloud saves
- [ ] **Leaderboard** (optional, needs a backend or integrate with app store cloud features): depth reached, minerals/sec. (Local personal-bests view shipped — see note above; the LIVE board is what's left, still backend-gated.)
- [ ] **Achievements** store integrations
- [ ] Cosmetic: skins for miners such as cute girls, animals, homages, etc.
