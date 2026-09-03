# Mines of Idle Doomath — UX, Improvements & New Features Plan

Legend: [ ] not started, [o] in progress
Completed items are removed from this file (see git history); only remaining work is tracked here.

- [ ] Rewarded ads (AdMob) — production ids + on-device verification (integration itself is done; the remaining half is external — see `docs/blockers.md`)
  - [ ] **External:** create the AdMob account → app entries (Android + iOS) → one rewarded unit per platform → fill `storeConfig.adMob` **and** the `adMobAppIds` block in `app.config.ts` (pinned together by `storeConfig.test.ts`) → `npx expo prebuild` → verify on device per `docs/store-integration.md` §1/§3. AdMob's public test unit ids make the full watch → reward → caps flow device-testable before the real account exists.

- [ ] Implement expo-iap for iap (receipt validation + entitlements on self-hosted Pocketbase: `docs/pocketbase-plan.md`)

- [ ] App store integrations
  - [ ] Add the real Google/Apple store SDK integrations behind the `IapProvider` interface — everything in-repo is prepped: stable `storeId` per product, `selectIapProvider` as the one-line swap point, and the full runbook/verification checklist in `docs/store-integration.md`
  - [ ] Store integrations: cloud saves, leaderboard, achievements
