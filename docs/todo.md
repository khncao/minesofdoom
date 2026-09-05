# Mines of Idle Doomath — UX, Improvements & New Features Plan

Legend: [ ] not started, [o] in progress
Completed items are removed from this file (see git history); only remaining work is tracked here.

- [ ] Sync settings, cosmetics, progress, etc. if signed in
- [ ] Set app display name to "Mines of Idle Doomath"
  Done in source (2026-09-06): `app.config.ts` `name`, the `+html.tsx` title/description, web description, legal + inquiries copy. Remains: the **device label** still reads "minesofdoom" (checked-in `android/` project, `res/values/strings.xml`) until the next `expo prebuild` — re-apply the two build.gradle patches (debuggableVariants + upload-key signing) after it, per the AGENTS gotchas — and the Play Console listing display name, which is store-side (`scripts/play/play.mjs` / Play Console → Store presence).
- [ ] Make sure font colors and sizes are readable
- [ ] Optimize build size
- [ ] Add oauth2 login for web

- [ ] Add stripe payment provider for web one time products
- [ ] Add adsense for web ads
- [ ] allow first time setup of operators and other key settings
- [ ] scale juice based on mine amount such as more repeated mining animation
- [ ] reorganize menus with clean reinplementation

- [ ] once everything else is complete: 
  - [ ] check project for additional UX improvements
  - [ ] audit project security and compliance
  - [ ] check project ship readiness

- [ ] IAP — on-device verification
  Client and server are done: `iapProvider.ts` / `iapDeviceId.ts` behind `selectIapProvider`; `pb_hooks/` (all 8 endpoints verified live against a Pocketbase v0.40.2 fake-token sandbox) + the store-verification sidecar in `pb_hooks/sidecar/` (the signing-gap resolution). Remaining work is external — see `docs/blockers.md`.
  Done (details in `docs/blockers.md` + git history): Pocketbase v0.40.2 live on the servarica VPS (public URL in `storeConfig.pocketbaseUrl`, fail closed — no fake tokens), the Android real-token phase on the sidecar (`/healthz` → `configured.android: true`; iOS stays fail-closed until the `APPLE_*` credentials, `docs/backlog.md`), the release AAB (1.0.8, versionCode 8) on the internal track, and all 26 Play products live + ACTIVE at the §2.1 prices (`npm run play -- products-check` clean). The App Store Connect half (products + the sidecar's `APPLE_*` credentials) is in `docs/backlog.md` (iOS section).
  Android release-APK pass (2026-09-04, Maestro ad-hoc flows in `maestro/adhoc/`): the store sheet lists all live Play products with real prices (Remove Ads $2.99, packs) on the upload-key build; the web export bundle is clean (prod Pocketbase URL only — no `MDOOM_DEV*`, no `:8090`, dev-sim code inert behind folded `__DEV__`).
  - [ ] `docs/store-integration.md` §4 remainder: a real test **purchase** + restore on a wiped local key. Runs on the **emulator** (no phone needed — §4 + `docs/blockers.md`). Diagnosis done (2026-09-05, new API 35 `google_apis_playstore` emulator `mines-play-35`, account signed into Play Store): the Buy → Play sheet says **"The item you were attempting to purchase could not be found"** because **zero license testers are registered on any track** (verified via the Play API — `edits.testers.get` per track). The v3 API can only set `googleGroups`, so the fix is UI-only: **Play Console → Testing → License testers → add the Gmail to `internal`**. (Everything else was ruled out: SKUs match live — `products-check` clean; `pack_amethyst` ACTIVE with US $0.99 AVAILABLE; the panel's prices are static `priceLabel`s, not proof of a live billing query.) After the tester is added: test-card purchase → entitlement → wipe local key → restore.

- [ ] Optional login (anonymous device default)
  Identity decision (done): **optional login, anonymous device-based default** — the shipped device-scoped model stays exactly as-is for players who don't sign in. The default path — no sign-in, everything keyed on the existing device UUID — is already built and stays untouched; login is additive scope and must never be a prerequisite for any feature (guardrail: F2P parity).
  Done (git history + `pb_hooks/README.md` for the contracts): the all-three-mechanisms decision (email/password + Google + Apple side by side — its GDPR / age-rating / `TAG_FOR_CHILD_DIRECTED_TREATMENT` consequences carry into the rating planning), the server half (the seven `auth/*` endpoints + sidecar `POST /identity`, the sub → email → create merge, `accountId` backfill, the account-scoped GDPR delete), the client core (`auth.ts` / `secureToken.ts` / `useAccount`, the settings account section, the session threaded through cloud/leaderboard/IAP), the native sign-in SDKs (Google + Apple, hidden-until-ready by platform; the iOS prebuild stays in `docs/backlog.md`), and the server + client test suites.
  Email/password device verification done (2026-09-04, `maestro/adhoc/v4_register.yaml` on the release APK): register → signed-in branch, the token in the OS keychain, and the account confirmed server-side (clean curl login + `/auth/me`).
  - [ ] **External (Android, ~95% done):** the Google OAuth **Android** client exists (package `com.minus4kelvin.minesofdoom` + upload-key SHA-1 — that's what makes the Play Services sign-in flow accept the app; verified on-device: the account picker opens and closes cleanly). v16 mints the idToken for the project's **Web** client id instead (`webClientId` → the token's `aud`; the VPS sidecar's `GOOGLE_CLIENT_ID` env must equal it — `pb_hooks/sidecar/verify.js`). **Proven on-device 2026-09-05**: with an **installed**-type client id (`google_oauth_web.json`, gitignored) in `GOOGLE_WEB_CLIENT_ID` + sidecar env, sign-in completes but **no idToken comes back** (server logs stay silent — the app throws before any network call) → the single inline error (honest — never a faked sign-in). So an **installed-type id is not enough — a real Web-application-type client is required**: Google Cloud → APIs & Services → Credentials → Create credentials → **Web application** (no redirect URIs needed) in the same project → paste the `client_id` into `signinSdks.ts` (`GOOGLE_WEB_CLIENT_ID`, test pin + the sidecar env flip with it) → rebuild → re-verify. The Apple sign-in half stays out of this file — tracked in `docs/backlog.md`.

