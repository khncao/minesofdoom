# Mines of Doom — UX, Improvements & New Features Plan

Legend: [ ] not started, [o] in progress
Completed items are removed from this file (see git history); only remaining work is tracked here.

- [ ] Translate the legal document section BODIES per-locale (`legal.ts`): the data-driven content names (cosmetics, goal tiers/goals, achievements, records labels, IAP product labels, legal doc titles/section headings, biome names) shipped with the content-name i18n — data modules stay the English source of truth, per-locale tables in `src/utils/i18n/content-es.ts`, parity-pinned by walking the data modules in `content.test.ts`. Only the ~16 paragraph bodies in `legal.ts` remain English-only in every locale.
- [ ] Create E2E tests for Android on phone, 7 inch tablet, and 10 inch tablet and generate 4 in-game screenshots in various states for each
- [ ] **Rewarded-ads** — implement integrations
- [ ] Allow saving combo with rewarded-ad
- [ ] Optional ads to receive extra bonuses (daily, time away, etc.)
- [ ] Add the real Google/Apple store SDK integrations behind the `IapProvider` interface — everything in-repo is prepped: stable `storeId` per product, `selectIapProvider` as the one-line swap point, and the full runbook/verification checklist in `docs/store-integration.md`. Use RevenueCat.
- [ ] Store integrations: cloud saves, leaderboard, achievements
- [ ] Cosmetic: skins for miners such as cute girls, animals, homages, etc.
