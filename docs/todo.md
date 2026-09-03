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
  - [ ] On-device verification per the plan §Phases 6 (the iOS device pass is in `docs/backlog.md`).
  - [x] Identity decision (done): **optional login, anonymous device-based default** — the shipped device-scoped model stays exactly as-is for players who don't sign in; login is additive scope, tracked as its own item below.

- [ ] Optional login (anonymous device default)
  Identity decision recorded in the item above; this is the additive scope it implies. The default path — no sign-in, everything keyed on the existing device UUID — is already built and stays untouched; login must never be a prerequisite for any feature (guardrail: F2P parity).
  - [x] Decision (done): **all three mechanisms** — email/password, Google sign-in, and Apple sign-in, offered side by side in the sign-in UI. Carried consequences: email/password is the GDPR-heaviest surface (password reset + verification flows; guardrail 6 — plan the age rating with it in, and `TAG_FOR_CHILD_DIRECTED_TREATMENT` if that's the answer), and with a third-party (Google) login present, iOS "Sign in with Apple" is required — offered anyway, so the rule holds by construction.
  - [ ] Server (`pb_hooks/`): accounts are provider-agnostic — any of the three mechanisms creates or signs into the SAME account (email where it exists is the shared identity); key cloud saves / leaderboard (and entitlements, for cross-device restore) by user identity with the device id as fallback; a sign-in links the device's existing rows to the account (data is never lost or duplicated); the GDPR `delete my data` endpoint gains the account target (account + all linked devices).
  - [ ] Client: settings sign-in/out with all three options visible ("continue without an account" is the visible default), claim/link flow for pre-existing device data, and the settings copy that is currently drafted for the device-only model (`delete my data`, reinstall caveats). The two native SDKs (Google sign-in, Sign in with Apple; + secure storage for the email credentials) land in provider files behind the same pick-pattern as the store providers → `npx expo prebuild` after adding them.
  - [ ] Tests (server merge/link logic in the existing `__test__` suites, client against scripted fetch) + on-device verification added to the §Phases 6 list.
