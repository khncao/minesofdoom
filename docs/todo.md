# Mines of Doom — UX, Improvements & New Features Plan

Legend: [ ] not started, [o] in progress
Completed items are removed from this file (see git history); only remaining work is tracked here.

- [ ] Create E2E tests for Android on phone, 7 inch tablet, and 10 inch tablet and generate 4 in-game screenshots in various states for each
- [ ] **Rewarded-ads** — implement integrations
- [ ] Allow saving combo with rewarded-ad
- [ ] Optional ads to receive extra bonuses (daily, time away, etc.)
- [ ] Add the real Google/Apple store SDK integrations behind the `IapProvider` interface — everything in-repo is prepped: stable `storeId` per product, `selectIapProvider` as the one-line swap point, and the full runbook/verification checklist in `docs/store-integration.md`. Use RevenueCat.
- [ ] Store integrations: cloud saves, leaderboard, achievements
- [ ] Cosmetic: skins for miners such as cute girls, animals, homages, etc.
