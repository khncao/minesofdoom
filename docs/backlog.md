# Mines of Idle Doomath — Backlog

Deferred work that is intentionally out of the active `docs/todo.md` scope.
The active plan targets **Android + web first**; everything iOS-specific
lives here so the todo doesn't get polluted by platform-parallel work.
Each item stays external (store consoles / App Store Connect) — no
in-repo work is pending for any of it (the providers already exist and
fall back cleanly until the ids land).

## iOS — AdMob app entry + App ID

**Blocked on (external):** the AdMob console (iOS app entry).

- [ ] Create the iOS app entry in AdMob (same app as the Android entry) →
  iOS App ID.
- [ ] Paste it into `storeConfig.adMob.iosAppId` (see the shape in
  `docs/store-integration.md` §1) **and** the `adMobAppIds` block in
  `app.config.ts` — the two are pinned together by `storeConfig.test.ts`.
- [ ] Fill the iOS rewarded unit slots `storeConfig.adMob.rewardedUnitIos`
  once the production rewarded units for the three remaining placements
  (gem rolls, offline double, offline top-up) exist — AdMob units aren't
  platform-scoped, so the same unit ids go in the Android and iOS tables.
- [ ] `npx expo prebuild` → verify on an iOS device per
  `docs/store-integration.md` §1/§4.

Note: until `iosAppId` lands, `isAdMobIdsConfigured` is false on iOS, so
`selectAdProvider` keeps the no-op there (entry points hidden) — Android is
unaffected.

## iOS — App Store IAP (products + sidecar credentials)

**Blocked on (external):** App Store Connect. The shared halves (Pocketbase
deploy, `storeConfig.pocketbaseUrl`, the sidecar itself) are the active IAP
items in `docs/todo.md`; this section is the Apple-specific half of them.

- [ ] Create the 26 App Store Connect products per the table in
  `docs/store-integration.md` §2.1 (exact `storeId`s — the canonical ids the
  client already sends as `productId`).
- [ ] App Store Connect API key: Users and Access → Integrations →
  **App Store Server API** → create a key with the App Store Server API
  capability → capture `APPLE_BUNDLE_ID`, `APPLE_APP_ID`, `APPLE_KEY_ID`
  and the `.p8` file (`APPLE_PRIVATE_KEY`); start with
  `APPLE_IAP_ENV=sandbox`. The sidecar env-var table + runbook are in
  `pb_hooks/README.md`.
- [ ] iOS on-device verification per `docs/store-integration.md` §4: test
  purchase end-to-end (expo-iap → Pocketbase `/api/app/verify` → sidecar
  Apple lookup), restore on a wiped local entitlement key.

Note: the sidecar is per-platform — with `APPLE_*` unset it serves
`/healthz` and refuses iOS verifies (`"ios not configured"`), Android
verifies are unaffected. So iOS can ship a tick later than Android
without blocking it.

## iOS — store integrations (cloud save / leaderboard / GDPR) on-device check

- [ ] iOS on-device verification per
  `docs/store-integration.md` §Phases 6. The client is
  platform-agnostic (same `useCloudSave` / `useLeaderboard` / provider
  picks as Android) — this is a device pass over the same checklist, not
  new code.
