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
      to 1.0.11. Native side DONE (2026-09-30): `expo prebuild
      --clean --platform android` regenerated `android/` — the
      manifest no longer carries the AdMob App ID (the two GMA
      `OPTIMIZE_*` flag lines and the `AD_ID` permission remain; the
      RN-GMA plugin injects those unconditionally and they're inert
      because nothing initializes the SDK), and `build.gradle` is
      now 11/1.0.11 (line endings normalized CRLF→LF in the same
      pass). ALL OF THE ABOVE COMMITTED as bcb2a1b (11 files,
      2026-09-30). What remains, split by who can do it:
      - **Owner (Play Console UI — the API cannot set these, and the
        submission captures these answers, so do them BEFORE the
        upload):** 1) Target audience and content: "13 and up" only
        (no children age groups, do NOT opt into "Designed for
        Families" / Teacher Approved). 2) IARC questionnaire:
        advertising = **No advertising** (the previous "ads" answer
        IS the rejected "inaccurate answers" bullet — the critical
        one); answer the rest honestly (cartoon/fantasy violence,
        in-app purchases; no chat/external links/UGC) and let the
        rating fall out of the descriptors. 3) Data safety (Android):
        no third-party ad SDK, no advertising-id use; keep the
        account/cloud/purchase disclosures.
      - **Agent (ready when owner says go):** the release AAB builds
        with `cd android && JAVA_HOME=~/.jdks/jdk-21* ./gradlew
        bundleRelease` (the machine's system JDK is headless — a
        full Temurin 21 was installed to `~/.jdks` and pinned via
        `~/.gradle/gradle.properties`, so any gradle invocation is
        fine). Then the atomic submission via the untracked
        `.play-submit-v1.0.11.mjs` in the repo root (ONE Play edit:
        en-US listing bullet → "No ads, no pop-ups — nothing to
        watch or skip" + AAB upload + production and internal
        tracks, release notes "No ads in this version. Same game:
        solve equations, dig deeper, build your crew."; it aborts
        uncommitted if the uploaded versionCode ≠ 11).
      - **After submit:** watch the review; if it is classified
        Families again, the app stays ad-free on native (see
        blockers.md).