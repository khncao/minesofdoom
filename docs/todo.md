# Mines of Idle Doomath — UX, Improvements & New Features Plan

Legend: [ ] not started, [o] in progress
Completed items are removed from this file (see git history); only remaining work is tracked here.

- [ ] Set app display name to "Mines of Idle Doomath"
  Done in source (2026-09-06): `app.config.ts` `name`, the `+html.tsx` title/description, web description, legal + inquiries copy. Remains: the **device label** still reads "minesofdoom" (checked-in `android/` project, `res/values/strings.xml`) until the next `expo prebuild` — re-apply the two build.gradle patches (debuggableVariants + upload-key signing) after it, per the AGENTS gotchas — and the Play Console listing display name, which is store-side (`scripts/play/play.mjs` / Play Console → Store presence).
- [ ] Make sure font colors and sizes are readable
- [ ] Optimize build size
- [ ] Add oauth2 login for web
- [ ] Remove the "remove ads" iap

- [ ] Add stripe payment provider for web one time products
- [ ] Add adsense for web ads
- [ ] allow first time setup of operators and other key settings
  Done in source (2026-09-07): the onboarding overlay gained a 4th SETUP step (`OnboardingOverlay.tsx`) — operator toggles, × / ÷ symbol display, on-screen keypad — reusing the settings panel's i18n keys and live settings state; choices persist on dismiss via `handleSaveSettings`, and `AnswerInput` is made non-focusable under the overlay so the OS keyboard can't swallow the Start button. CI gates green (typecheck/lint/716 tests). Remains: on-device run of the `maestro/adhoc/v8_first_time_setup.yaml` verification flow (deferred — no emulator e2e yet).
- [ ] scale juice based on mine amount such as more repeated mining animation
- [ ] reorganize menus with clean reinplementation

- [ ] once everything else is complete: 
  - [ ] check project for additional UX improvements
  - [ ] audit project security and compliance
  - [ ] check project ship readiness

- [ ] IAP — on-device purchase leg (license tester)
  Everything else is done (client, Pocketbase + sidecar deploy, Android Play credentials, 26 products live, §4 web-bundle grep clean — see `docs/store-integration.md` §4 and `docs/blockers.md`). Remaining: add the test Gmail to **Play Console → Testing → License testers → `internal`** (UI-only — the v3 API can't register testers), then on the emulator: test-card purchase → entitlement → wipe local key → restore.

