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
      - **Agent (ready when owner says go):** the release AAB is
        BUILT and verified (2026-09-30, `app-release.aab` in
        `android/app/build/outputs/bundle/release/`, 77MB, vc 11,
        signed with the Play upload key): no real AdMob App ID
        anywhere in the bundle — the merged manifest's
        APPLICATION_ID is the GMA SDK's zero placeholder and the
        only other `ca-app-pub` strings are the SDK's test-id
        constant + validation regex. Build note: the machine's
        system JDK is headless — a full Temurin 21 was installed to
        `~/.jdks` and pinned in `~/.gradle/gradle.properties` (any
        gradle invocation works now). Submission is the untracked
        `.play-submit-v1.0.11.mjs` in the repo root (ONE Play edit:
        en-US listing bullet → "No ads, no pop-ups — nothing to
        watch or skip" + AAB upload + production and internal
        tracks, release notes "No ads in this version. Same game:
        solve equations, dig deeper, build your crew."; it aborts
        uncommitted if the uploaded versionCode ≠ 11).
      - **After submit:** watch the review; if it is classified
        Families again, the app stays ad-free on native (see
        blockers.md).
- [o] re-enable native rewarded ads on **Unity Ads** (code DONE 2026-10-01;
      blocked on owner input — the Unity project + ids)
      Code: AdMob is GONE (`react-native-google-mobile-ads` removed, its
      config plugin + App IDs deleted, AD_ID stripped by
      `plugins/withUnityAds.js`) and replaced by the local Expo module
      `modules/unity-ads` (`unity-ads` 4.20.1, Families self-certified)
      + `src/mines_of_doom/unityAdProvider.ts`. Why: Play's Families rule
      bans rewarded ads that aren't closeable in 5 seconds, and the AdMob
      rewarded unit can't be — Unity placements have a documented
      "Allow skip after 5 seconds" setting, so ONE player-tapped
      rewarded surface is compliant for all ages (a skip resolves
      "closed": no reward). Every request is child-treated
      (`childDirectedTreatment: true` → `setNonBehavioral(true)`, i.e.
      contextual-only demand) and the ad-id permissions are removed from
      the APK, so **no neutral age screen is needed**. Tests/lint/
      typecheck green; a release AAB with the module compiles.
      **Owner (see store-integration.md §1):** 1) create the Unity
      Android project (Game ID) + four rewarded placements, 2) set
      "Allow skip after 5 seconds" on EVERY placement, 3) enable App
      store compliance → Google Designed for Families, 4) paste the ids
      into `storeConfig.unityAds`, 5) verify on a release build that a
      5-second skip really is available, 6) then set the console
      answers to match the build (target audience may include children,
      IARC advertising = **Yes**, data safety: ad SDK declared + no
      advertising id) and re-submit. Until step 4 the config is empty
      and the app is still ad-free (correct interim state).
      Versioning: keep 1.0.11/vc 11 for the ad-free build (it is already
      built and signed); **bump to 1.0.12 / vc 12 when the Unity ids
      land**, since the ad-bearing APK is a different bundle.
- [ ] pick the Play target-audience stance (owner decision, see
      blockers.md 2026-09-30)

## Art follow-ups (papercut shipped 2026-10-02)

Direction decided + shipped behind the art-pack seam
(`src/utils/graphics/artPack.ts`; see docs/art-directions.md). Left open,
in rough priority order:

- [ ] **cave art in the new style.** `caveTiles.ts` is a separate 336×24
      strip pipeline and still uses the classic rock art. A paper-cut cave
      (flat layered rock planes per tier, the same value-plane treatment as
      the characters) is its own draft, not a renderer change.
- [ ] **paper-cut debris shard.** The papercut pack delegates the 12px
      debris particles to the classic shards (a 32px rock crushed into 12px
      is mush). A small paper-cut shard subject would close the pack.
- [ ] **custom-skin samples in the new style.** The custom-skin slot and
      its baked 16×16 sample sprites (`skinSamples.ts`) are still classic
      art next to paper-cut bodies; the upload path itself is untouched
      player data, so only the SAMPLES need regenerating.
- [x] **skin line as shop content.** SHIPPED 2026-09-14: the 12 named
      paper-cut skins are the `SKINS` catalog in `cosmetics.ts` — a real
      cosmetic line with gem prices, shop cards, a compendium group and
      `selectedSkin` (saveVersion 14). See `docs/skin-line.md`. All twelve
      are sold in the stores too (prices synced 2026-09-14: 42/42 in both
      Stripe accounts, 43/43 Play products). Per-crew skin assignment was
      deliberately NOT done — a skin is the player's own slot.
- [ ] **art-style setting (optional).** The seam already supports it
      (`setActiveArtPack` + a `defaultArtPackId` in the save); only a
      settings row + i18n is missing. Not promised — papercut is the
      default globally.

