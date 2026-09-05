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

- [ ] Optional login (anonymous device default)
  Identity decision (done): **optional login, anonymous device-based default** — the shipped device-scoped model stays exactly as-is for players who don't sign in. The default path — no sign-in, everything keyed on the existing device UUID — is already built and stays untouched; login is additive scope and must never be a prerequisite for any feature (guardrail: F2P parity).
  Done (git history + `pb_hooks/README.md` for the contracts): the all-three-mechanisms decision (email/password + Google + Apple side by side — its GDPR / age-rating / `TAG_FOR_CHILD_DIRECTED_TREATMENT` consequences carry into the rating planning), the server half (the seven `auth/*` endpoints + sidecar `POST /identity`, the sub → email → create merge, `accountId` backfill, the account-scoped GDPR delete), the client core (`auth.ts` / `secureToken.ts` / `useAccount`, the settings account section, the session threaded through cloud/leaderboard/IAP), the native sign-in SDKs (Google + Apple, hidden-until-ready by platform; the iOS prebuild stays in `docs/backlog.md`), and the server + client test suites.
  Email/password device verification done (2026-09-04, `maestro/adhoc/v4_register.yaml` on the release APK): register → signed-in branch, the token in the OS keychain, and the account confirmed server-side (clean curl login + `/auth/me`).
  - [ ] **External (Android, ~90% done):** the Google OAuth **Android** client exists (package `com.minus4kelvin.minesofdoom` + upload-key SHA-1, created 2026-09-04 — that's what makes the Play Services sign-in flow accept the app). v16 mints the idToken for the project's **Web** client id instead (`webClientId` → the token's `aud`; the VPS sidecar's `GOOGLE_CLIENT_ID` env must equal it — `pb_hooks/sidecar/verify.js`). Remaining: create the Web client in the same Google Cloud project → paste the id into `signinSdks.ts` (`GOOGLE_WEB_CLIENT_ID`, currently empty, test pin flips with it) → set the sidecar env → re-verify on the emulator. Until then the sheet can open but no token comes back — the single inline error (honest — never a faked sign-in). The Apple sign-in half stays out of this file — tracked in `docs/backlog.md`.

