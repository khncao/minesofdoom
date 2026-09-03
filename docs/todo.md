# Mines of Idle Doomath — UX, Improvements & New Features Plan

Legend: [ ] not started, [o] in progress
Completed items are removed from this file (see git history); only remaining work is tracked here.

- [ ] Implement react-native-google-mobile-ads for ads
  - [ ] **Rewarded-ads** — implement integrations (blocked: see `docs/blockers.md`)

- [ ] Implement expo-iap for iap (receipt validation + entitlements on self-hosted Pocketbase: `docs/pocketbase-plan.md`)

- [ ] App store integrations
  - [ ] Add the real Google/Apple store SDK integrations behind the `IapProvider` interface — everything in-repo is prepped: stable `storeId` per product, `selectIapProvider` as the one-line swap point, and the full runbook/verification checklist in `docs/store-integration.md`
  - [ ] Store integrations: cloud saves, leaderboard, achievements
