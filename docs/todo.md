# Mines of Idle Doomath — UX, Improvements & New Features Plan

Legend: [ ] not started, [o] in progress
Completed items are removed from this file (see git history); only remaining work is tracked here.

- [ ] Disable localization for now. English only
- [ ] Update custom numeric with larger buttons laid out like a standard numeric keypad
- [ ] Move menu buttons (like settings and bonus) to top of screen and implement upgrades menu as a side hidden overlay on the canvas so it's not covered by the built-in keyboard at the bottom of the screen
- [ ] Show tips one at a time with auto scrolling
- [ ] Show cosmetic previews in shop listings

- [ ] IAP — on-device verification
  Client and server are done: `iapProvider.ts` / `iapDeviceId.ts` behind `selectIapProvider`; `pb_hooks/` (all 8 endpoints verified live against a Pocketbase v0.40.2 fake-token sandbox) + the store-verification sidecar in `pb_hooks/sidecar/` (the signing-gap resolution). Remaining work is external — see `docs/blockers.md`.
  Done (details in `docs/blockers.md` + git history): Pocketbase v0.40.2 live on the servarica VPS (public URL in `storeConfig.pocketbaseUrl`, fail closed — no fake tokens), the Android real-token phase on the sidecar (`/healthz` → `configured.android: true`; iOS stays fail-closed until the `APPLE_*` credentials, `docs/backlog.md`), the release AAB (1.0.8, versionCode 8) on the internal track, and all 26 Play products live + ACTIVE at the §2.1 prices (`npm run play -- products-check` clean). The App Store Connect half (products + the sidecar's `APPLE_*` credentials) is in `docs/backlog.md` (iOS section).
  Android release-APK pass (2026-09-04, Maestro ad-hoc flows in `maestro/adhoc/`): the store sheet lists all live Play products with real prices (Remove Ads $2.99, packs) on the upload-key build; the web export bundle is clean (prod Pocketbase URL only — no `MDOOM_DEV*`, no `:8090`, dev-sim code inert behind folded `__DEV__`).
  - [ ] `docs/store-integration.md` §4 remainder: a real test **purchase** + restore on a wiped local key. Runs on the **emulator** (no phone needed — §4 + `docs/blockers.md`): add one Gmail as a Play Console license tester, sign it into the emulator's Play Store, test-card purchase → entitlement → wipe local key → restore.

- [ ] Store integrations (cloud saves, leaderboard, achievements)
  Server and client are done: the six cloud/leaderboard/GDPR endpoints in `pb_hooks/` (same deployment as IAP) + the client wiring (cloud save w/ recovery + settings, leaderboard panel, achievement share, GDPR delete — designed in `docs/store-integration.md`).
  Android release-APK pass done (2026-09-04): cloud save push + recovery-pull (corrupted save → auto-restore byte-identical to the cloud blob), GDPR device-scope delete (server rows gone), and the leaderboard panel rendering live server rows. The pass also found and fixed two Pocketbase v0.4x server bugs (zero-stat leaderboard rejection + session token creation — `pb_hooks/README.md` notes the fixes + the auto-reconcile migration that ran on the live instance).
  - [ ] iOS device pass (in `docs/backlog.md`).
  Identity decision (done): **optional login, anonymous device-based default** — the shipped device-scoped model stays exactly as-is for players who don't sign in; login is additive scope, tracked as its own item below.

- [ ] Optional login (anonymous device default)
  Identity decision recorded in the item above; this is the additive scope it implies. The default path — no sign-in, everything keyed on the existing device UUID — is already built and stays untouched; login must never be a prerequisite for any feature (guardrail: F2P parity).
  Done (git history + `pb_hooks/README.md` for the contracts): the all-three-mechanisms decision (email/password + Google + Apple side by side — its GDPR / age-rating / `TAG_FOR_CHILD_DIRECTED_TREATMENT` consequences carry into the rating planning), the server half (the seven `auth/*` endpoints + sidecar `POST /identity`, the sub → email → create merge, `accountId` backfill, the account-scoped GDPR delete), the client core (`auth.ts` / `secureToken.ts` / `useAccount`, the settings account section, the session threaded through cloud/leaderboard/IAP), the native sign-in SDKs (Google + Apple, hidden-until-ready by platform; the iOS prebuild stays in `docs/backlog.md`), and the server + client test suites.
  Email/password device verification done (2026-09-04, `maestro/adhoc/v4_register.yaml` on the release APK): register → signed-in branch, the token in the OS keychain, and the account confirmed server-side (clean curl login + `/auth/me`).
  - [ ] **External:** the OS sign-in sheets need their app-side credentials before they can mint a real idToken — a Google Cloud OAuth client (android package + SHA-1, ios bundle id) and the Apple Sign in with Apple capability (the iOS prebuild on macOS picks it up via the package's config plugin). Until then the buttons fail closed to the single inline error (honest — never a faked sign-in).

