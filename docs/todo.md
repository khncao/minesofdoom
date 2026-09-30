# Mines of Idle Doomath — UX, Improvements & New Features Plan

Legend: [ ] not started, [o] in progress, [-] blocked
Completed items are removed from this file (see git history); only remaining work is tracked here.
Only work on continuous tasks after other tasks are completed

- [o] refine the on-screen keypad (pass 1 done: keypress haptic ticks +
      visual-only boundary shakes for empty submit / full box — feels
      right on device? then close)
- [o] fix: Play Families rejection → ad-free resubmission (v1.0.11)
      Google Play rejected the update 2026-09-30: *Families Ad Format
      Requirements* — "Unclosable ads: Ads interfere with app use and
      can't be closed after 5 seconds" (citing **version code 9** =
      1.0.9, the live build with the AdMob rewarded ads) + "Play
      Console answers that do not accurately reflect the app and its
      ads". The reviewer classified the app as targeting children
      despite the S6 teen+ stance (it reserves the right to make its
      own determination). Full runbook: **docs/store-integration.md
      §0**; the target-audience stance decision: **docs/blockers.md
      (2026-09-30)**. Code side DONE (2026-09-30): `storeConfig.adMob`
      + the `app.config.ts` mirror emptied (the "empty = hidden" rule
      hides every "watch" entry point and keeps the AdMob App ID out
      of the manifest, so the GMA SDK never initializes — no ad
      requests, no advertising-id use), privacy policy v2.3 says the
      mobile build has no ads (web AdSense untouched), version bumped
      to 1.0.11. Native side DONE in the working tree (2026-09-30):
      `expo prebuild --clean --platform android` regenerated
      `android/` — the manifest no longer carries the AdMob App ID
      (the two GMA `OPTIMIZE_*` flag lines and the `AD_ID`
      permission remain; the RN-GMA plugin injects those
      unconditionally and they're inert because nothing initializes
      the SDK), and `build.gradle` is now 11/1.0.11 (its line endings
      normalized CRLF→LF in the same pass). All 10 changed files are
      uncommitted, ready for review + commit. Remaining steps (owner):
      1. Play Console → **Target audience and content**: "13 and up"
         only (no children age groups, no "Designed for Families" opt-in).
      2. Play Console → **IARC content-rating questionnaire**: answer
         honestly; let the rating fall out of the descriptors.
      3. Play Console → **Data safety (Android)**: no third-party ad
         SDK / no advertising-id use.
      4. Build the release AAB (`cd android && ./gradlew bundleRelease`
         — the prebuild above is already done), upload + release to
         production **together
         with** the en-US listing change ("Rewarded ads only: you tap
         watch, never pop-ups" → "No ads, no pop-ups — nothing to
         watch or skip") in one submission; what's-new: "No ads in
         this version. Same game: solve equations, dig deeper, build
         your crew."
      5. Watch the review; if it is classified Families again, the app
         stays ad-free on native (see blockers.md).