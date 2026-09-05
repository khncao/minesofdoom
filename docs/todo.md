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

