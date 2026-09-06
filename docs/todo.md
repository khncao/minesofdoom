# Mines of Idle Doomath — UX, Improvements & New Features Plan

Legend: [ ] not started, [o] in progress
Completed items are removed from this file (see git history); only remaining work is tracked here.

- [ ] Set app display name to "Mines of Idle Doomath"
  Done in source (2026-09-06): `app.config.ts` `name`, the `+html.tsx` title/description, web description, legal + inquiries copy. Remains: the **device label** still reads "minesofdoom" (checked-in `android/` project, `res/values/strings.xml`) until the next `expo prebuild` — re-apply the two build.gradle patches (debuggableVariants + upload-key signing) after it, per the AGENTS gotchas — and the Play Console listing display name, which is store-side (`scripts/play/play.mjs` / Play Console → Store presence).
- [ ] Make sure font colors and sizes are readable
- [ ] Optimize build size
- [ ] Add oauth2 login for web
- [ ] Remove the "remove ads" iap
  Done (2026-09-07): `removeAds` left the catalog (`iaps.ts` — the catalog is packs only), the entitlement/panel/toast glue (`useIap`, `IapPanel`, `MinesOfDoom`), the server allow-list (`pb_hooks/logic.js` — legacy `remove_ads` rows are dropped like any unknown store id, and the app's restore allowlist ignores them too), i18n (`toast.iapRemoveAds`/`toast.iapComplete`/`iap:removeAds`), legal copy, and the §2.1 table; tests repointed to `packGold`. CI gates green (714 tests). The `remove_ads` Play Console product is now orphaned — never queried; delete it store-side (`npm run play -- delete-product --sku=remove_ads` or Play Console) whenever convenient. The rewarded-ads panel is now shown whenever the ad provider is available (no way to hide it).

- [ ] Add stripe payment provider for web one time products
- [ ] Add adsense for web ads
- [ ] allow first time setup of operators and other key settings
  Done in source (2026-09-07): the onboarding overlay gained a 4th SETUP step (`OnboardingOverlay.tsx`) — operator toggles, × / ÷ symbol display, on-screen keypad — reusing the settings panel's i18n keys and live settings state; choices persist on dismiss via `handleSaveSettings`, and `AnswerInput` is made non-focusable under the overlay so the OS keyboard can't swallow the Start button. CI gates green (typecheck/lint/716 tests). Remains: on-device run of the `maestro/adhoc/v8_first_time_setup.yaml` verification flow (deferred — no emulator e2e yet).
- [ ] scale juice based on mine amount such as more repeated mining animation
  Done in source (2026-09-05): juice now scales with the mined amount on a log scale — new pure module `juice.ts` (`getJuiceWaves`: one repeated swing/debris wave per decimal digit of the gain, capped at 5; `getJuiceTextSize`: the floating "+N" grows one step per wave, 18→26px) plus the `useJuiceWaves` hook (wave 0 immediate, later waves at 130ms — clears the Miner/debris internal throttles — all timers cancelled on unmount). Wired into both mine paths: canvas holds (`useMineTaps`) and equation answers (`MinesOfDoom` onCorrect); the block break stays once per mine, and the OS reduce-motion preference collapses the decorative waves to one. CI gates green (typecheck/lint/723 tests). Remains: on-device look of the wave flurry (no e2e flow asserts animation count) — deferred with the rest of the emulator e2e work.
- [ ] reorganize menus with clean reinplementation

- [ ] once everything else is complete: 
  - [ ] check project for additional UX improvements
  - [ ] audit project security and compliance
  - [ ] check project ship readiness

- [ ] IAP — on-device purchase leg (license tester)
  Everything else is done (client, Pocketbase + sidecar deploy, Android Play credentials, 25 products live, §4 web-bundle grep clean — see `docs/store-integration.md` §4 and `docs/blockers.md`). Remaining: add the test Gmail to **Play Console → Testing → License testers → `internal`** (UI-only — the v3 API can't register testers), then on the emulator: test-card purchase → entitlement → wipe local key → restore.

