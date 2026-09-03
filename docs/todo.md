# Mines of Idle Doomath — UX, Improvements & New Features Plan

Legend: [ ] not started, [o] in progress
Completed items are removed from this file (see git history); only remaining work is tracked here.

- [ ] Rewarded ads (AdMob) — production ids + on-device verification (integration itself is done; the remaining half is external — see `docs/blockers.md`)
  - [ ] **External:** create the AdMob account → app entries (Android + iOS) → one rewarded unit per platform → fill `storeConfig.adMob` **and** the `adMobAppIds` block in `app.config.ts` (pinned together by `storeConfig.test.ts`) → `npx expo prebuild` → verify on device per `docs/store-integration.md` §1/§3. AdMob's public test unit ids make the full watch → reward → caps flow device-testable before the real account exists.

- [ ] IAP — Pocketbase deploy + store products + on-device verification (the client provider is done: `iapProvider.ts` / `iapDeviceId.ts` + the `selectIapProvider` swap + tests; remaining work is external — see `docs/blockers.md`)
  - [ ] **External:** deploy Pocketbase per `docs/pocketbase-plan.md` (hook endpoints + collections; sandbox first with the fake-token dev flag), then paste the URL into `storeConfig.iap.pocketbaseUrl`
  - [ ] **External:** create the four products per the table in `docs/store-integration.md` §2 (exact `storeId`s) + the Play service-account credentials (server-side only)
  - [ ] On-device verification per `docs/store-integration.md` §3 (test purchase, restore on a wiped local key, web bundle grep incl. `expo-iap` + the Pocketbase URL)

- [ ] App store integrations
  - [ ] Store integrations: cloud saves, leaderboard, achievements
