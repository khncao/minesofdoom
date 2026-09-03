# Mines of Idle Doomath — UX, Improvements & New Features Plan

Legend: [ ] not started, [o] in progress
Completed items are removed from this file (see git history); only remaining work is tracked here.

- [o] Rewarded ads (AdMob) — production unit ids + on-device verification
  Integration is done: the AdMob provider behind `selectAdProvider`, the Android App ID + the production combo-save unit in `storeConfig.adMob` (rest are AdMob test unit ids) + `adMobAppIds` in `app.config.ts` (pinned by `storeConfig.test.ts`). Remaining work is external — see `docs/blockers.md`; the iOS half (app entry + `iosAppId`) is in `docs/backlog.md`.
  - [ ] **External:** create the remaining rewarded units (gem rolls, offline double, offline top-up — one per placement; AdMob units aren't platform-scoped so one set serves both platforms) → fill the slots in `storeConfig.adMob.rewardedUnitAndroid/Ios` **and** the `adMobAppIds` block in `app.config.ts` → `npx expo prebuild` → verify on device per `docs/store-integration.md` §1/§3.

- [ ] IAP — Pocketbase deploy + store products + on-device verification
  Client and server are done: `iapProvider.ts` / `iapDeviceId.ts` behind `selectIapProvider`; `pb_hooks/` (all 8 endpoints verified live against a Pocketbase v0.40.2 fake-token sandbox) + the store-verification sidecar in `pb_hooks/sidecar/` (the signing-gap resolution). Remaining work is external — see `docs/blockers.md`.
  - [ ] **External:** deploy `pb_hooks/` to a Pocketbase **v0.40.x** instance per `docs/pocketbase-plan.md` (sandbox first with `MDOOM_DEV_FAKE_TOKEN=1`), then paste the URL into `storeConfig.pocketbaseUrl`. Real-token phase: run `pb_hooks/sidecar/` next to Pocketbase, set `MDOOM_SIDECAR_URL` on Pocketbase + the `PLAY_*`/`APPLE_*` credential env on the sidecar (tables + runbook in `pb_hooks/README.md`); until it's up, `MDOOM_SIDECAR_URL` unset = fail closed.
  - [ ] **External:** create the four Play Console products (the `storeId`s in the table in `docs/store-integration.md` §2 are the exact SKUs) + the Play service-account credentials (server-side only). The App Store Connect half (products + the sidecar's `APPLE_*` credentials) is in `docs/backlog.md` (iOS section).
  - [ ] On-device verification per `docs/store-integration.md` §3 (test purchase, restore on a wiped local key, web bundle grep incl. `expo-iap` + the Pocketbase URL).

- [ ] Store integrations (cloud saves, leaderboard, achievements)
  Server and client are done: the six cloud/leaderboard/GDPR endpoints in `pb_hooks/` (same deployment as IAP) + the client wiring (cloud save w/ recovery + settings, leaderboard panel, achievement share, GDPR delete — designed in `docs/store-integration-plan.md`).
  - [ ] **External:** same Pocketbase deploy as the IAP item above (sandbox first).
  - [ ] Identity decision — device-scoped (no account, the plan's default) vs. login: see `docs/blockers.md`.
  - [ ] On-device verification per the plan §Phases 6 (the iOS device pass is in `docs/backlog.md`).
