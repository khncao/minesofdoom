# Mines of Idle Doomath — UX, Improvements & New Features Plan

Legend: [ ] not started, [o] in progress
Completed items are removed from this file (see git history); only remaining work is tracked here.

- [o] Rewarded ads (AdMob) — production ids + on-device verification (integration itself is done; the remaining half is external — see `docs/blockers.md`)
  - [x] **External (done):** Android AdMob App ID + the production combo-save rewarded unit landed in `storeConfig.adMob` (unit ids are keyed per placement — `AdKind` — per platform; the other three placements run AdMob's public test unit ids until their production units are created). App IDs also in the `adMobAppIds` block in `app.config.ts` (pinned together by `storeConfig.test.ts`).
  - [ ] **External:** create the remaining rewarded ad units (gem rolls, offline double, offline top-up — one per placement; AdMob units aren't platform-scoped so one set serves both platforms) + the iOS app entry → fill the test-id slots in `storeConfig.adMob.rewardedUnitAndroid/Ios` + `iosAppId` **and** the `adMobAppIds` block in `app.config.ts` → `npx expo prebuild` → verify on device per `docs/store-integration.md` §1/§3.

- [ ] IAP — Pocketbase deploy + store products + on-device verification (the client provider is done: `iapProvider.ts` / `iapDeviceId.ts` + the `selectIapProvider` swap + tests; remaining work is external — see `docs/blockers.md`)
  - [ ] **External:** deploy Pocketbase per `docs/pocketbase-plan.md` (hook endpoints + collections; sandbox first with the fake-token dev flag), then paste the URL into `storeConfig.pocketbaseUrl`
  - [ ] **External:** create the four products per the table in `docs/store-integration.md` §2 (exact `storeId`s) + the Play service-account credentials (server-side only)
  - [ ] On-device verification per `docs/store-integration.md` §3 (test purchase, restore on a wiped local key, web bundle grep incl. `expo-iap` + the Pocketbase URL)

- [ ] App store integrations
  - [o] Store integrations: cloud saves, leaderboard, achievements — designed in `docs/store-integration-plan.md` (device-keyed, no account; extends the same Pocketbase deployment as IAP)
    - [ ] **External:** same Pocketbase deploy as the IAP item above (sandbox first); the six cloud/leaderboard endpoints from the plan go in the same `pb_hooks/` folder as the IAP ones
    - [ ] Identity decision pending — device-scoped (no account, plan's default) vs. login: see `docs/blockers.md`
    - [ ] Client: cloud-save engine wiring — push cadence (autosave/prestige) into `cloudSave.ts`, launch-recovery path (corrupt local → cloud import), settings UI (toggle, last-sync status, manual restore) + tests
    - [ ] Client: leaderboard (monotonic submit piggyback, top-10 modal + trophy button, display name, availability gate) + tests
    - [ ] Client: achievement badge count on board rows + share strings; "delete my data" (GDPR) button + endpoint
    - [ ] On-device verification per the plan §Phases 6

