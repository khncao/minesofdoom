# Store integration — IAP, ads, and the Pocketbase cloud backend

The single runbook for everything store-side: ad-network setup (Unity Ads
native + AdSense web), the IAP catalog and the exact store products to
create, the Pocketbase cloud backend (IAP verification + cloud saves +
leaderboard), the on-device verification checklist, and the iOS/TestFlight
half.

**Status (2026-07):**

- ✅ **IAP + ads integration is complete on the code side** —
  rewarded provider (Unity Ads on native via `modules/unity-ads`, AdSense
  Ad Placement API on web), IAP provider
  (expo-iap → Pocketbase verify → entitlement), provider selection,
  panel wiring. The IAP purchase UI is **hidden in production** until
  the Pocketbase verify backend is configured (it is — live, see §2.3);
  on dev builds the purchase UI runs the labeled simulation so the full
  flow is testable.
- ✅ **Cloud backend is live** — Pocketbase v0.40.2 + the zero-dependency
  store-verification sidecar on servarica at
  `https://minesofdoom.minus4kelvin.com` (`pb_hooks/` in the repo,
  deployed per `docs/pocketbase-plan.md`; deployment ops live there).
- ✅ **Play Console CLI** — `scripts/play/play.mjs` (`npm run play`) wraps
  the Play Developer API v3: store listings, store images, tracks,
  AAB upload + release, and **full one-time-product CRUD** (new publishing
  API `monetization.onetimeproducts` — the old `inappproducts` API is
  retired and returns "Please migrate to the new publishing API"; the
  API is *not* read-only for one-time products). Everything Play-store-side
  is scriptable; the
  same service-account key works for the CLI and the sidecar
  (`./play-service-account.json` (gitignored) or `PLAY_SERVICE_ACCOUNT_JSON`).
- ✅ **Play store side is live** — the 25 products in the §2 table are
  created and ACTIVE (via the CLI, §2.2), the release AAB (1.0.8) is on
  the internal track, and the sidecar carries the Play service-account
  credentials (`/healthz` → `configured.android: true`).
- ✅ **Android IAP and Google sign-in work on device** — both verified
  on `mines-play-35` against a build **signed with the Play upload
  (release) key**; a debug-signed build is *not* a valid test route
  (IAP then needs the §2.4 license-key setup). Ad testing no longer
  needs a console-registered test device (the AdMob requirement): the
  provider passes `testMode = !isProdEnvNow()`, so a release build
  served from a non-prod origin talks to Unity's test inventory (§1.1
  step 5).
- ✅ **Web is built on the code side (2026-09)** — Stripe Checkout web
  IAP (`iapProvider.web.ts` + the sidecar's Stripe-API confirm + the
  `/api/app/stripe/webhook` backup-mint route) and AdSense REWARDED
  ads via the Ad Placement API (`adSenseProvider.web.ts` — the H5 Games
  Ads two-phase flow; the earlier banner path was removed). Both follow
  the repo's empty-config = hidden rule: nothing renders or charges
  until `storeConfig.stripe` / `storeConfig.adsense` are filled
  (§2.6 / §1.6). The web build is the static export the player actually
  visits, so this is the only monetization path that ever runs in a
  browser.
- ⬜ **Apple store side remains** (backlog) — the App Store Connect
  products + the sidecar's `APPLE_*` credentials.
  Nothing in this doc can be skipped; the §4 checklist is the release
  gate.

Guardrails (AGENTS.md) in force throughout: rewarded ads only
(§2.1.3), no dark patterns (transparency lines in every purchase row),
and **F2P is viable** — every pack also unlocks a cosmetic that is
gem-earnable in-game (guardrail 1).

---

## 0. The Play Families rejection & the ad-free resubmission (2026-09-30)

**What happened.** Google Play **rejected the v1.0.10 update**
(2026-09-30) with a *Families Ad Format Requirements* notice, citing
**version code 9** — i.e. 1.0.9, the live build that ships the AdMob
rewarded ads (v1.0.10 itself is account-deletion only, so the violation
is attributed to the build it updates):

> 1. Your update includes the following:
>    - Monetization or advertising that interferes with normal use of
>      the app or gameplay, **including rewarded or opt-in ads that
>      cannot be closed after 5 seconds** ("Unclosable ads: Ads
>      interfere with app use and can't be closed after 5 seconds").
>    - Play Console answers that do not accurately reflect the app and
>      its ads.
> 2. Fix: Remove any violating ad content and ensure your app
>    utilizes a version of the Families Self-Certified Ads SDKs listed
>    in the program. Update your app's Play Console answers to
>    accurately reflect your app and its ads.

**Why it was rejected (policy basis).** The reviewer treated the app as
Families-scoped — targeting children — regardless of our declared
teen+ stance (security-audit.md S6, 2026-09-08): the Families Ads &
Monetization policy (play.google.com/about/monetization-ads/
families-ads-program) names "rewarded or opt-in ads that cannot be
closed after 5 seconds" as interfering with app use, and a full-screen
AdMob rewarded video holds the app until the creative's close button
appears. The policy's closing clause — "Google reserves the right to
review your app and make its own determination" — means the
classification does not depend on our console answers. **The SDK
version was NOT the problem**: the shipped GMA SDK is
`com.google.android.gms:play-services-ads` **24.6.0** (the version
`react-native-google-mobile-ads` 16.0.1 pins in its
`sdkVersions.android.googleMobileAds`; verified in the gradle cache,
which has only ever resolved 24.6.0 — the "25.0.0" figure that earlier
revisions of this section carried was wrong), far above the 19.0.0 floor for
Google AdMob on the [Families Self-Certified Ads SDK list](https://support.google.com/googleplay/android-developer/answer/9283445).
(That list also carries the relevant exemption: apps that are **not
for children** — e.g. "T"/"MA" rated — or that do not serve ads to
children are **not required** to use a self-certified SDK at all. So
the real question was always the audience classification, not the SDK.)

**The fix — v1.0.11 ships without native ads, with accurate answers.**

1. **Code (done, 2026-09-30)** — the `storeConfig.adMob` block is
   emptied (App ID + all four unit IDs, both platforms) and its mirror
   in `app.config.ts` is emptied too. The repo's own "empty = hidden"
   rule does the rest: `isAdMobIdsConfigured()` is false → the no-op
   provider → every "watch" entry point (daily-bonus double, offline
   double/top-up, gem rolls, combo-save pill, rewarded panel) stays
   hidden; with no App ID in the merged manifest the GMA SDK never
   initializes — **no ad requests, no advertising-id use**, so the
   build has no Families-violation surface. The GMA SDK stays in the
   bundle (a self-certified version — harmless, and it keeps
   re-enabling a data paste). Web AdSense (`storeConfig.adsense`)
   is a separate provider and is untouched — the web app is not part
   of the Play review.
2. **Listing en-US** — the "Rewarded ads only: you tap watch, never
   pop-ups" bullet becomes "No ads, no pop-ups — nothing to watch or
   skip". Commit it **atomically with the v1.0.11 submission** — NOT
   before: 1.0.9 (the version still serving) genuinely has ads, so
   editing the live listing first would temporarily make it false.
   (The listing edit is doable via `pnpm run play` — see §"Play
   Console CLI" above — or the console UI; the IARC/data-safety steps
   below are UI-only.)
3. **Privacy policy** — legal.ts v2.3 (2026-09-30): the mobile app
   "contains no ads at all" (web AdSense line unchanged); the in-app
   docs and the published `public/privacy-policy.html` (regenerated
   by `__test__/legalDocs.test.ts` when the tests run) now match the
   shipped build — this is exactly the "Play Console answers that do
   not accurately reflect the app and its ads" bullet, fixed at the
   document level.
4. **Play Console — manual, UI-only (the API cannot set these):**
   - **Target audience and content**: select **"13 and up" only** —
     no children age groups, and do **not** opt in to "Designed for
     Families" / Teacher Approved.
   - **Content rating (IARC questionnaire)**: answer honestly
     (cartoon/fantasy violence, in-app purchases; no chat, no
     external links, no UGC). Let the rating fall out of the
     descriptors.
   - **Data safety (Android)**: no third-party ad SDK, no
     advertising-id use (AdMob no longer present in the build); keep
     the existing account/cloud/purchase disclosures.
5. **Release** — code + `android/` regen committed (bcb2a1b,
   2026-09-30). The AAB build: `cd android && ./gradlew
   bundleRelease` — note the machine's system JDK 21 is headless
   (no `javac`), which fails `compileReleaseJavaWithJavac` with
   "Toolchain installation … does not provide the required
   capabilities: [JAVA_COMPILER]"; a full Temurin 21 was installed
   to `~/.jdks/` and pinned in `~/.gradle/gradle.properties`
   (`org.gradle.java.installations.paths`) so plain `./gradlew`
   works. Release the AAB (must be vc 11 / 1.0.11) via the untracked
   `.play-submit-v1.0.11.mjs` one-shot (one atomic edit: en-US
   listing bullet "No ads, no pop-ups — nothing to watch or skip" +
   bundle upload + production/internal tracks, release notes "No ads
   in this version. Same game: solve equations, dig deeper, build
   your crew."). Submit only AFTER the owner's step-4 console
   answers (the submission snapshots them).

**Alternative considered and rejected — making the rewarded ad
acceptable (deep-dive, 2026-09-30).** The Families ad-format rule bans
"rewarded or opt-in ads that are not closeable after 5 seconds" (a
*closeable* rewarded ad is nominally allowed for children). Investigated
against the current AdMob docs and the 2022–2024 report history;
conclusion: **not possible from our side.**

- **The reward half is already ours.** `adProvider.ts` grants the
  reward only on the SDK's `EARNED_REWARD` event — an early close
  already resolves "closed" with no grant. Zero code needed.
- **The closable half is not ours.** Official docs
  (support.google.com/admob/answer/7372450) describe the close button
  as shipping *with a 5–30 s countdown that runs until the user
  receives the reward* — per-creative, so a 30 s creative holds the
  user 25 s past the policy limit. The button is part of Google's
  creative UI with **no close/dismiss API** on `RewardedAd` (SO
  64883822). react-native-google-mobile-ads #502 (2023, the library we
  use) was closed **not_planned** in 2024 — the ecosystem treats
  "watch to the end" as rewarded's by-design behavior. Google did fix
  it once — GMA team, AdMob community thread p16MnuW3TJk, 2022-10-10:
  "all rewarded ads should be closable after 5 seconds" — but it was a
  **creative-template** change, not tied to any SDK release, and it is
  not held today (the official countdown description above, the 2023+
  reports, and this very rejection all post-date it). Neither the
  legacy GMA SDK we ship (24.6.0 via RN-GMA 16.0.1) nor the GMA
  Next-Gen SDK (open beta, release notes 2024-03 → 2026-08) documents a
  reliable ≤5 s early close — the newest note is a fix for a pod
  *freeze* that blocked closing, not an early-close guarantee. AdMob's
  own rewarded policy (answer/7313578: rewarded "must be skippable or
  dismissible") is unmeetable by the format as served. **This whole
  conclusion is scoped to the standard *Rewarded* ad-unit format in
  AdMob/GMA** — see "Re-opened" below for the two formats that DO
  satisfy the rule (AdMob *rewarded interstitial* units, and other
  self-certified networks with a documented ≤5 s close).
- **Console levers we control (risk-reducers, not a guarantee):** on
  the rewarded unit, **turn Ad pods off** (default ON — "2 back-to-back
  videos during a single impression", up to ~60 s) and **exclude
  interactive ads** (playables/surveys, default ON); keep the request
  config `tagForChildDirectedTreatment` / TFAT + `MAX_AD_CONTENT_RATING
  = G` (already in `adProvider.ts`); under a children-only console
  audience AdMob automatically serves the Families-compliant pool
  (answer/6223431). None of these caps the per-creative countdown at 5
  s — one long creative is one rejection, and certifying "closeable
  after 5 seconds" in the Play Console would be false (the rejection's
  second bullet, re-created).
- **The format matrix (what this means for the stance).** For a child
  audience the only Families-compliant formats are banners (single,
  clearly-distinguished, non-personalized slot, not on app startup) and
  non-launch interstitials with the 5 s X — both **permanently excluded
  by our guardrail 2** (rewarded-only). So under any stance that
  includes children, no ad format is both policy-compliant and
  guardrail-allowed, so the CHILDREN branch stays ad-free — which the
  policy endorses ("any ads not suitable for children are only shown
  to older audiences"). Stance-by-stance: **A (Teen+)** is the
  simplest way for rewarded to come back — the Families policy doesn't
  bind a teen-only audience, and the self-certified SDK floor is
  already met (no age gate needed). **B (Mixed)** is the only way for
  rewarded to return while still serving an under-18 audience — via
  Play's neutral age screen (free-entry birth date) gating the ad
  surface to **18+** (13-17 count as children in some locales, so a
  13+ floor is not safe); see `docs/blockers.md`. **C (Children
  only)** stays ad-free *on the standard Rewarded unit*. Revisit
  rewarded for a children branch when (a) the ad unit is switched to a
  format that is closeable within 5 s (next section) and (b) the stance
  decision in `docs/blockers.md` is made.

**Re-opened (2026-10-01): rewarded ads CAN come back for ALL ages — the
5-second rule is about the *format*, and two compliant formats exist.**
The deep-dive above is right that the standard AdMob **Rewarded** unit
cannot be made closeable in 5 s from our side. It was over-generalized
into "under any stance that includes children, ads stay off": Play bans
"rewarded or opt-in ads that are **not closeable after 5 seconds**"
(answer/9893335), so a rewarded format that *is* closeable is admissible
for children — no age screen needed, because a neutral age screen only
exists to keep ads *not suitable for children* away from children
(answer/9867159). The candidates, both verified 2026-10-01:

1. **AdMob "rewarded interstitial" ad units (recommended — no provider
   switch, smallest diff).** AdMob's own docs: *"Only skippable ads will
   be served in rewarded interstitial ad units. Currently, this includes
   demand from AdMob, Liftoff Monetize, and Meta Audience Network"* —
   i.e. this rewarded format is *built* from skippable creatives, which
   is exactly the close-in-5-seconds affordance Families allows, and a
   Google support rep pointed developers at it as the Families-compliant
   rewarded path (AdMob SDK group thread `nshbDHew5fg`). Needs GMA
   19.2.0+ (we ship 24.6.0) and `react-native-google-mobile-ads` 16.x
   already exports `RewardedInterstitialAd`. AdMob policy 7313578 adds
   one UI requirement: the format must be preceded by an intro screen
   with a clear, unobstructed "no / don't accept" option — our existing
   "watch" tap is the opt-*in*, so this adds an opt-*out* step (also
   good for guardrail 3). Trade-offs: it is a **Beta** format, demand is
   limited to those three networks, eCPM/fill will differ from a
   standard rewarded unit, and it is interstitial-shaped creative under
   the hood — so it needs an **explicit guardrail-2 amendment** (owner
   call: the guardrail's intent is "no surprise/nag ad formats", which
   an opt-in rewarded unit satisfies, but its letter says "interstitials
   … off the table permanently"). Unit ids: 4 new units in the AdMob
   console; code: a `RewardedInterstitialAd` branch in `adProvider.ts`
   behind the same "empty = hidden" gate, mapping
   `OnUserEarnedReward` → `"rewarded"` and a close → `"closed"`.
2. **Unity Ads, rewarded placement with "Allow skip after 5 seconds".**
   Unity Ads **is on the Families Self-Certified Ads SDK list**
   (`com.unity3d.ads:unity-ads` 4.0.1+; current 4.20.1) and its docs
   describe precisely our requirement: *"Compliance with kid-friendly
   programs requires that all monetized (rewarded) ads can be dismissed
   after 5 seconds. Note that Rewarded Ad Units are not skippable by
   default"* (docs.unity.com → Project Settings → "Skipping rewarded
   ads"; the ad-unit wiki adds *"select Allow skip after ___ … Five
   seconds is the minimum value for app store compliance"* and the
   project-level **App store compliance → Google Designed for Families**
   flag, which also forces contextual-only demand). Integration is the
   catch: no maintained React Native Unity Ads SDK (`react-native-unity-ads`
   last published 2022), so it means AdMob mediation (add
   `com.google.ads.mediation:unity` + `com.unity3d.ads:unity-ads` via
   `expo-build-properties`; pick an adapter built for GMA 24.x — the
   4.20.1.0 adapter is built/tested against GMA 25.5.0) or a small
   hand-written Kotlin module. **Do not use an AdMob mediation group
   with AdMob's own inventory left in the waterfall** — the group would
   still be able to fill with a standard, non-skippable AdMob rewarded
   creative, which is the exact rejection. Unity Ads' child-directed
   settings do support AdMob as a mediation partner for age designation.
3. **InMobi** (self-certified `inmobi-ads` 10.5.5+) documents that *"All
   our Rewarded Video placements are closable after 5 secs for
   child-directed apps"*. Same mediation caveats as (2), plus a larger
   data-collection surface than we want (docs/security-audit.md).
4. **AppLovin / MAX is NOT an option** — Google lists: *"AppLovin has
   left the Families Self-Certified Ads SDK Program … Families app
   developers will need to transition … by May 31, 2023."* Switching to
   MAX would be a compliance regression, not a fix (it is also the
   obvious wrong answer to "which provider do we switch to").

**The all-ages recipe (any of the formats above).** Declare the target
audience including children (13+ *and* under-13), keep ONE rewarded
surface, and make every request child-treated: `tagForChildDirectedTreatment:
true` + `maxAdContentRating: "G"` app-wide (today's
`storeConfig.adMob.tagForChildDirectedTreatment: false` flips to true;
with GMA ≥ 20.6.0 a child-tagged request does not transmit the AAID),
a self-certified SDK only, contextual (non-personalized) demand only,
no new SDK surface that is not self-certified, and console answers that
match the build (IARC advertising = **Yes** this time; data safety
declares the ad SDK and "no advertising ID for child-treated requests").
No neutral age screen is needed *because* no ad is unsuitable for
children — which also removes the 18+-floor problem blockers.md flags
for stance B. Residual risk: one mis-configured creative (a Unity
placement with skip left at "off", or an AdMob creative served into a
standard rewarded unit) is one rejection, so verify on a real build with
test mode before resubmitting, and keep the "empty = hidden" flag so
ads can be switched off between submissions.

**What this does NOT decide.** Whether the app is "for children" is a
product/legal call. The reviewer's classification may persist even
with zero ads (art style, name) — if so, the app simply stays ad-free
on native indefinitely (the web is outside Play's scope). The three
stances and their consequences live in `docs/blockers.md`
(2026-09-30). Whatever the decision, ads only come BACK after (a) the
stance is chosen, (b) the listing + privacy-policy claims are fixed
for it, and (c) — if the stance is children/mixed — the Families ad
rules (self-certified SDK ✓, no AAID from children, child-directed
tag where required) are met for the affected branch.

**Where this landed (2026-10-01).** Option 2 of "Re-opened" above was
taken: **Unity Ads** replaces AdMob everywhere in the app
(`modules/unity-ads` native module + `unityAdProvider.ts`;
`react-native-google-mobile-ads` removed, its manifest plugin and App
IDs deleted, AD_ID stripped by `plugins/withUnityAds.js`), with
`childDirectedTreatment: true` so every request is contextual. The
Game ID / placement ids are **still empty**, so the build is still
ad-free — the remaining work is the owner's Unity dashboard setup plus
the id paste (§1.1–§1.3), then a resubmission with console answers
that say "ads: yes" (this time true).

---

## 1. Unity Ads setup (the re-enable runbook)

**Status (2026-10-01):** native rewarded ads run on **Unity Ads**
(`com.unity3d.ads:unity-ads` 4.20.1, wired by the local Expo module in
`modules/unity-ads` + `src/mines_of_doom/unityAdProvider.ts`). AdMob is
gone from the app entirely (`react-native-google-mobile-ads` removed,
its manifest plugin and its App IDs deleted, the AD_ID permission
stripped by `plugins/withUnityAds.js`) because its rewarded unit cannot
be closed within the 5 seconds Play's Families rules require — §0.

The Game ID and placement ids are **empty** in `storeConfig.unityAds`
until an owner Unity project exists, and empty still means OFF end to
end (no-op provider, every "watch" entry point hidden). Re-enabling is a
data paste into `storeConfig.ts` — **plus the dashboard steps below,
which the app cannot enforce**.

### 1.1 Owner steps in the Unity dashboard (do these FIRST)

1. **Create a Unity project** for Android (Unity dashboard → Monetization
   → create project, platform Android, package
   `com.minesofdoom.minesofdoom`... see `android.package` in
   `app.config.ts` for the exact id) and note the **Game ID** (7 digits).
   A second project for iOS later (`docs/backlog.md`).
2. **Create the four rewarded placements** (Monetization → Ad units →
   Add ad unit → Rewarded), one per `AdKind`, and note each placement
   id: `gemRolls`, `offlineDouble`, `offlineTopUp`, `comboSave`.
3. **THE COMPLIANCE STEP — on every rewarded placement: “Allow skip
   after” = 5 seconds.** This is what makes the format satisfy Play's
   Families ad-format rule ("rewarded or opt-in ads … must be closeable
   after 5 seconds"); rewarded units are **not skippable by default**
   (docs.unity.com → Project Settings → “Skipping rewarded ads”: *"all
   monetized (rewarded) ads can be dismissed after 5 seconds"*, and the
   ad-unit help: *"select Allow skip after ___ … Five seconds is the
   minimum value for app store compliance"*). A skipped ad resolves
   "closed" — no reward, nothing taken away.
4. **Enable App store compliance → Google Designed for Families**
   (Monetization → Overview → Settings → App Store Compliance). Unity
   docs: selecting it *"automatically configures the age designation
   setting to ‘This app is directed to children under the age of 13’, and
   set[s] the age limits filter to ‘Do not show ads rated 13+ or
   stricter’"* — i.e. contextual-only demand for every user, which is
   exactly the all-ages posture (no personalized demand exists to
   screen out, so **no neutral age screen is needed**).
   Cross-check under **Monetization → Apps → <app> → Child-directed ad
   network settings**: game-level designation “primarily targeting
   children”, age filter “Do not show ads rated 13+ or stricter”.
5. **Leave test mode OFF for the production placements.** Test
   placements fill instantly on any device, so a stray test placement in
   the config is worse than useless. How the two build types behave:
   a `__DEV__` build runs the **labeled dev-sim** provider, not this
   module (`pickAdProvider` gives dev builds first refusal), and the
   provider passes `testMode = !isProdEnvNow()` — so a release build on
   the production domain talks to production demand, and a release build
   served from any other origin stays on Unity's test inventory as a
   safety net. Verification therefore happens on a release build
   (§1.3).

### 1.2 Paste the ids into the code

```ts
// src/mines_of_doom/storeConfig.ts
unityAds: {
  androidGameId: "1234567",
  rewardedPlacementAndroid: { gemRolls: "…", offlineDouble: "…", offlineTopUp: "…", comboSave: "…" },
  // ios* stay empty until the iOS module exists (docs/backlog.md)
}
```

That is the whole wiring: Unity takes the Game ID as a function
argument (nothing is baked into a manifest), so there is no second place
to edit and no `expo prebuild` needed after the paste. Any empty field
keeps the whole surface hidden (`isUnityAdsConfigured`).

### 1.3 Verify before submitting (this is the step that prevents a rejection)

Both checks need a **release** build on a device/emulator — a
`__DEV__` build runs the labeled dev-sim, so it never touches this
module (`pnpm exec expo run:android --variant release`, or install the
release APK; §2.5 covers the release build and its signing).

- First on a **test-mode** release build (host the build somewhere other
  than `PROD_WEB_DOMAIN` so `isProdEnvNow()` is false → `testMode: true`):
  the "watch" entry points appear, an ad loads, a **skip within 5
  seconds grants nothing**, and a completed ad grants the reward exactly
  once. Nothing is billed and no live demand is touched.
- Then on the **production** release build (test mode off, real demand):
  time the first 5 seconds of a rewarded ad and confirm the close/skip
  control is visible and functional. If Unity's skip setting is off for
  any placement, the creative holds the player for the full length and
  Play rejects the update for the same reason as v1.0.10.
- Console answers must then match the build: target audience may include
  children; **IARC “Advertising” = Yes**; Data safety declares the ad SDK
  and states that no advertising ID is collected (the permission is not
  even merged in the APK); the listing bullet and privacy policy v2.4
  already describe rewarded ads that are closeable in 5 seconds.

### 1.4 What the app does about kid-safety (guardrail 6)

- `childDirectedTreatment: true` → `UnityAds.setNonBehavioral(true)`
  before initialize → contextual, non-personalized demand for every
  user, no remarketing.
- `stripAdvertisingId: true` → `plugins/withUnityAds.js` removes
  `AD_ID` + the three `ACCESS_ADSERVICES_*` permissions from the merged
  manifest, so no ad code can read an advertising identifier at all.
- Both are ONE decision with the target-audience stance
  (`docs/blockers.md`): flipping either means flipping
  `app.config.ts`'s `removeAdvertisingId` too (pinned by
  `storeConfig.test.ts`).

### 1.5 Retired: the AdMob runbook (2026-07 → 2026-10-01)

AdMob ids and rewarded unit ids existed (recorded as the
`GEM_ROLLS_UNIT`… constants in `__test__/storeConfig.test.ts` until
this switch). They are **not** reusable: even with a self-certified GMA
version, the standard AdMob rewarded unit's close button appears on a
per-creative 5–30 s countdown with no app-side control (§0), which is
exactly what Play rejected. Two AdMob-side levers are still worth
knowing about if anyone revisits it: turn **ad pods off** and **exclude
interactive ads** on the rewarded unit, and keep
`tagForChildDirectedTreatment` + `MAX_AD_CONTENT_RATING = G`.

### 1.6 Web rewarded (AdSense Ad Placement API)

The web app's ad parity path for the native rewarded placements, via
the AdSense "Ad Placement API" (H5 Games Ads) — rewarded full-screen
ads ONLY, player-tapped (guardrail 2 holds for web exactly like
native: no interstitials, no banners anywhere; the ad runs in the
ad network's full-screen overlay, never over the game canvas
simultaneously with play). The earlier shop-sheet banner was removed
when this landed (2026-09-07).

The flow is two-phase, because AdSense probes fill BEFORE the user tap
and the tap must synchronously run the stashed `showFn` (the network
only shows the ad on a user gesture):

1. **Prime** — when the ad panel sheet opens, when the combo-save pill
   mounts, and again after every finished ad, `primeReward(kind)`
   pushes a `{type: "reward", name: kind}` placement onto
   `window.adsbygoogle`; the loader calls `beforeReward(showFn)` back
   when a real ad is fillable (or never — no fill, like a native
   no-fill: the button stays enabled, the reward is re-granted on the
   next tap).
2. **Show** — the player's "watch" tap calls the stashed `showFn`
   SYNCHRONOUSLY inside the tap handler. `adViewed` → `"rewarded"`
   (the reward applies), `adDismissed` without `adViewed` →
   `"closed"` (no reward), a 60s watchdog → `"error"`. One ad in
   flight at a time; a tap with no filled probe re-primes and
   resolves `"error"`.

Files: `adSenseProvider.web.ts` (the provider, the repo's `.web` swap
pattern — `adSenseProvider.ts` is the native no-op so `ads.ts`
imports one name everywhere), `+html.tsx` (the loader script, gated
on `isAdSenseConfigured()`), `storeConfig.adsense` (`client` only —
no slot: the placements are per-kind adBreaks on the same client).

1. **AdSense account** (adsense.com): the site is the static web export
   at the `pocketbaseUrl` origin. The account must be approved for
   **H5 Games Ads / the Ad Placement API** (a separate capability from
   plain display ads — the console flags eligibility; approval takes
days).
2. **No unit creation**: rewarded placements are declared at runtime by
   the `name` field (`gemRolls`, `comboSave`, `offlineDouble`,
   `offlineTopUp` — the four AdKinds) and group by that name in the
   console; there is no slot id.
3. **`storeConfig.adsense.client`** is the `ca-pub-…` publisher id
   (already configured; `isAdSenseConfigured()` validates the
   `ca-pub-\d+` shape so a typo can't load someone else's account).
   Empty config = no loader script, no placements pushed, the hook
   reports unavailable and every entry point hides — the repo stays
   shippable while it's blank.
4. **Verify** (`npx expo export -p web` + the deployed site): the
   loader script is in the HTML only when configured; in the console,
   the panel rows show the "Watch" flow, a completed video grants the
   reward, an early close grants nothing, and the console's ad
   placements report the four names. Until H5 Games Ads approval, the
   rows simply no-fill (button re-enables, no toast) — the purchase UI
   is unaffected.

**Verification requirements** — audited against the official docs
(`developers.google.com/ad-placement`: overview, sign up, use the Ad
Placement API (rewarded call sequence), testing modes, H5 game
structure; fetched 2026-09-30). “Passing verification” has two halves —
an external account gate and the in-code integration:

*External gates (account-side, not code):*

- **H5 Games Ads access is by-application.** Apply at
  `adsense.google.com/start/h5-beta`; “account approval is not
  guaranteed as it is subject to partner eligibility,” and an approved
  AdSense account is required. **Until approved, placements push but
  never fill** — the watch button silently re-enables (the no-fill
  behaviour in item 2 is the *expected* symptom of a missing approval,
  not a bug).
- The site (`minesofdoom.pages.dev`) is added to the AdSense account
  and approved.

*Integration (in code — audit result 2026-09-30, all met):*

- **Tag** — `async` + `?client=` + `crossorigin="anonymous"` in the same
  document as the game canvas, no `<ins>`/slot unit (the API is
  queue-driven; `app/+html.tsx`). The docs' `adBreak()` boilerplate is
  sugar for `adsbygoogle.push(o)`; `adSenseProvider.web.ts` pushes the
  same placement objects directly once the queue exists.
- **Placement object matches the rewarded reference field-for-field**
  (`adSenseProvider.web.ts`) — `type: "reward"`, `name`,
  `beforeReward(showAdFn)`, `beforeAd`, `afterAd`, `adViewed`,
  `adDismissed`. `showAdFn` is invoked only from a synchronous user tap,
  exactly once per placement (single-use, per the docs), and a fresh
  placement is pushed at every new opportunity (the documented reset
  path); `adBreakDone` is optional and intentionally omitted (the app's
  own telemetry logs outcomes).
- **Policy** — rewarded-only (no interstitials → none of the
  “unexpected full-screen ad” / “ad after an ad closes” prohibitions can
  trigger); the ad renders full-screen covering the document (the
  loader's job, not ours); rewards are in-game currency with no
  monetary value, never saleable or exchangeable; nothing in the UI
  encourages clicking *on* the ad.
- **One deliberate deviation** from the call-sequence note — `beforeAd`
  does NOT pause/mute the game (it is synchronous and returns
  immediately, as required; the idle tick keeps running behind the
  full-screen ad, which for an idle game is player-favourable and the ad
  covers the document entirely). Noted here so it isn't “fixed” by
  accident later.

*Validating the client pipeline on the deployed domain (no approval
needed):*

- Export with `EXPO_PUBLIC_ADSENSE_TEST=1 pnpm run deploy` — the loader
  gains `data-adbreak-test="on"` (Google's documented test mode: mock
  ads, **no** requests to Google's servers, cycling ad-loaded /
  ad-not-loaded so both tap outcomes are exercised). Tap a watch row:
  a mock full-screen ad appears, or the cycle is no-fill and the button
  quietly re-enables — both correct. Redeploy without the flag
  afterwards (a test build shows players mock ads and never earns).
  (`e2e/web/server.mjs` injects the same attribute in-process for the
  Playwright suite — §2.7; the export itself is flag-free by default.)
- Console probes for a manual session: `window.adsbygoogle` must be an
  array once the loader boots, and its length grows by 1 per prime
  (ad-panel open / combo-save pill mount / after every settled ad).

---

## 2. IAP products

The catalog lives in `src/mines_of_doom/iaps.ts`: **exactly one pack per
paid cosmetic** in `cosmetics.ts` (every pickaxe / outfit / cave theme
with `costGems > 0`). Tests pin the catalog
against `cosmetics.ts`, so a new paid cosmetic without a pack fails CI.
The `storeId` column of the table below is the exact product id to
create in each store console — one canonical slug for Play Billing,
App Store, and (if we ever adopt it) RevenueCat.

### 2.1 The product table (create these)

Prices are a tier of the gem price (`packPriceLabel` in `iaps.ts`):
≤30 💎 → $0.99, ≤60 → $1.99, ≤100 → $2.99, more → $3.99 — so buying a
pack stays comparable to saving gems for it (guardrail 1: convenience,
never access). Adjust the tiers in `iaps.ts` and update this table —
the console follows the code, not the other way around.

| Store id | Product | Price | Grants (also earnable in-game) |
| --- | --- | --- | --- |
| `pack_gold` | Gold Pickaxe (Mattock) | $0.99 | `gold` pickaxe (25 💎) |
| `pack_frost` | Crystal Pickaxe (Lance) | $1.99 | `frost` pickaxe (45 💎) |
| `pack_shadow` | Shadow Pickaxe (Auger) | $2.99 | `shadow` pickaxe (90 💎) |
| `pack_night` | Night Shift Outfit | $0.99 | `night` outfit (15 💎) |
| `pack_goldrush` | Gold Rush Outfit | $0.99 | `goldrush` outfit (25 💎) |
| `pack_crystal` | Crystal Miner Outfit | $1.99 | `crystal` outfit (40 💎) |
| `pack_magma` | Magma Worker Outfit | $1.99 | `magma` outfit (50 💎) |
| `pack_blocky` | Blocky Adventurer Outfit | $0.99 | `blocky` outfit (30 💎) |
| `pack_surface` | Frontier Explorer Outfit | $1.99 | `surface` outfit (40 💎) |
| `pack_knight` | Ashen Knight Outfit | $1.99 | `knight` outfit (50 💎) |
| `pack_hunter` | Wandering Hunter Outfit | $1.99 | `hunter` outfit (60 💎) |
| `pack_oni` | Crimson Oni Outfit | $1.99 | `oni` outfit (75 💎) |
| `pack_marmot` | Burrow Marmot Outfit | $1.99 | `marmot` outfit (60 💎) |
| `pack_fox` | Vein Fox Outfit | $1.99 | `fox` outfit (70 💎) |
| `pack_otter` | River Otter Outfit | $2.99 | `otter` outfit (85 💎) |
| `pack_damsel` | Damsel of the Depths Outfit | $1.99 | `damsel` outfit (75 💎) |
| `pack_amethyst` | Amethyst Cave Theme | $0.99 | `amethyst` theme (25 💎) |
| `pack_verdant` | Verdant Hollow Theme | $1.99 | `verdant` theme (35 💎) |
| `pack_solar` | Solar Vein Theme | $1.99 | `solar` theme (55 💎) |
| `pack_void` | Void Depths Theme | $1.99 | `void` theme (75 💎) |
| `pack_voxel` | Blockfall Mines Theme | $2.99 | `voxel` theme (90 💎) |
| `pack_wilds` | Undergrowth Jungle Theme | $3.99 | `wilds` theme (110 💎) |
| `pack_ashen` | Ashen Depths Theme | $3.99 | `ashen` theme (130 💎) |
| `pack_gothic` | Mist & Lantern Theme | $3.99 | `gothic` theme (150 💎) |
| `pack_cherry` | Cherry & Indigo Theme | $3.99 | `cherry` theme (170 💎) |
| `pack_emberbrand` | Emberbrand Pickaxe | $2.99 | `emberbrand` pickaxe |
| `pack_sledge` | Cinder Sledge Pickaxe | $2.99 | `sledge` pickaxe |
| `pack_lanternhook` | Lantern Hook Pickaxe | $2.99 | `lanternhook` pickaxe |
| `pack_prism` | Prism Cutter Pickaxe | $3.99 | `prism` pickaxe |
| `pack_lantern_crew` | Lantern Crew Skin | $0.99 | `lantern-crew` skin |
| `pack_frost_bit` | Frost Bit Skin | $0.99 | `frost-bit` skin |
| `pack_deep_survey` | Deep Survey Skin | $1.99 | `deep-survey` skin |
| `pack_shift_foreman` | Shift Foreman Skin | $1.99 | `shift-foreman` skin |
| `pack_fox_crew` | Fox Crew Skin | $2.99 | `fox-crew` skin |
| `pack_marmot_crew` | Marmot Crew Skin | $2.99 | `marmot-crew` skin |
| `pack_rose_lantern` | Rose Lantern Skin | $2.99 | `rose-lantern` skin |
| `pack_mint_comet` | Mint Comet Skin | $2.99 | `mint-comet` skin |
| `pack_sky_bob` | Sky Bob Skin | $2.99 | `sky-bob` skin |
| `pack_twin_bells` | Twin Bells Skin | $3.99 | `twin-bells` skin |
| `pack_blossom_bun` | Blossom Bun Skin | $3.99 | `blossom-bun` skin |
| `pack_ember_sunrise` | Ember Sunrise Skin | $3.99 | `ember-sunrise` skin |
| `pack_skin` | Custom Skin | $3.99 | `skin` skin |
| `pack_skin` | Custom Skin | $3.99 | custom-skin upload slot (250 💎) |

Every row's blurb in the purchase panel says plainly what it does and
that the game stays fully free without it (guardrail 4), and shows the
gem price of the granted cosmetic ("also earnable in-game for N 💎" —
guardrail 1).

### 2.1c Prices follow DEPTH, not gem cost

A pack's price is the cosmetic's **cash tier** (`cosmetics.CASH_PRICE_USD`),
which says how much new art the item carries:

| tier | price | what lands in it |
| --- | --- | --- |
| 1 | $0.99 | a recolour of something the player already owns — a palette swap, a tint ramp, a shape the line already had |
| 2 | $1.99 | a new character or look the line didn't have: new headwear / hair / dress silhouette, a new tool shape, a new theme palette |
| 3 | $2.99 | a new shape AND something that plays: a critter form, a new swing feel, its own strike sound, a faceted treatment |
| 4 | $3.99 | the line's hero items — the most hand-drawn art in the catalog |

Gem prices are the other axis (what the item is worth in the economy) and were
tuned by the F2P balance test; the two ladders deliberately disagree — the
Prism Cutter is the top cash tier on a 100-gem item, and the 35-gem Verdant
Hollow theme is $1.99 because that is the price it launched at.

**Already-sold items keep their launch price.** A Stripe price object is
immutable, so re-tiering a live product would leave the shop showing one amount
and the checkout charging another — the misleading-price case guardrail 4 rules
out. Re-pricing an existing item is therefore a deliberate operation: create a
new price (archive the old), change the Play price, then move the tier and
re-paste the sync snippet. `node scripts/stripe/syncStripe.mjs verify` (both
modes) is the drift check that proves display == charge.

State as of 2026-09-14: **42/42 products match in both accounts** (test and
live, `syncStripe.mjs verify`), and `node scripts/play/play.mjs
products-check` reports 43/43 live Android products with none left DRAFT —
including `pack_skin`, which had been sitting un-activated.

### 2.2 Create the products

The **Play Developer API fully manages one-time products** via the new
publishing API `monetization.onetimeproducts` (`list` / `get` / `patch` /
`delete`; there is no `insert` — creation is a `patch` with
`allowMissing: true` plus the current `regionsVersion.version`, fetched
from `monetization.convertRegionPrices`, which is also where
`--auto-convert-prices` gets its per-region prices; the legacy
`inappproducts` API is retired). `scripts/play/play.mjs` wraps it, so the
catalog is scriptable. The **verification side is also fully API-driven**
(the sidecar calls `purchases.products.get` — already built). Note:
product creation additionally requires the service account to hold the
Play Console **billing permissions** ("Manage orders and subscriptions" +
"View financial data, orders, and cancellation survey responses").

1. **Create the products with the CLI** (after a build is on a track,
   §2.5 — Play refuses product creation until then): one
   `create-product` per row of the §2.1 table (exact `sku` + price from
   that table), then diff the live catalog against `iaps.ts`:

   ```sh
   npm run play -- create-product --sku=pack_gold --title="Golden Pickaxe" \
     --desc="Unlocks the Golden Pickaxe (also earnable in-game for 25 💎)." \
     --price=0.99 --auto-convert-prices
   # …repeat for every §2.1 row…
   npm run play -- products-check
   ```

   `--auto-convert-prices` localizes the tier to every targeted region the
   same way the console does; sanity-check one with
   `npm run play -- products --sku=pack_gold`. If a price state comes back
   draft, activate it with `npm run play -- activate-product --sku=…`
   (the API equivalent of the console's one-time step) — `products-check`
   flags anything not live.
2. **App Store Connect** (if/when iOS ships — §5): create the same
   products, but with the App Store id space: `com.minus4kelvin.minesofdoom.<productId>` (the
   `{ios.bundleId}.{productId}` convention, `IAP_IOS_STORE_IDS` in
   `iaps.ts`) — NOT the Play `storeId`. The app maps both id spaces
   back to the same catalog, so a device's store record — whichever
   id space it carries — resolves to one product.
3. **Service accounts / credentials** (server-side only — never in
   the repo, never in the app bundle):
   - **Play**: a service account with "Manage apps (full access)" (or at
     minimum "View app details" + "Manage app releases" +
     "Manage orders and subscriptions") on the app; the JSON key goes
     to the sidecar's `PLAY_SERVICE_ACCOUNT_JSON` env
     (`docs/pocketbase-plan.md` §Credentials). The **same key** drives
     the CLI: put it at `./play-service-account.json` (gitignored),
     pass `--key <path>`, or skip the key file entirely and use the
     Google Cloud default app credentials (`gcloud auth application-
     default login`, or `GOOGLE_APPLICATION_CREDENTIALS` pointing at the
     key — e.g. on a Cloud Run/GCE host). The CLI tries the key file
     first, ADC second; the ADC credential needs the same Play access.
   - **Apple**: an App Store Connect API key (`.p8`) with the
     "In-App Purchase" capability, bundle id + app id + key id → the
     sidecar's `APPLE_*` envs (same doc).
   - **`GOOGLE_CLIENT_ID`**: optional Google-ID login (see
     `pb_hooks/README.md` "Optional accounts") — creates the login
     collection, a JWT-verified email login, and the cross-device
     restore layer. Not needed for purchases to work.
4. **Activate a test track** (Play → Internal testing): the §4 device
   pass uses it. Real store purchases only work on a device with the
   internal-test build + the service account configured. Web purchases
   go through Stripe Checkout (a separate account + Price catalog —
   §2.6); until that config lands the web purchase UI is a hidden
   no-op by design (the shop stays fully free, nothing is gated).
5. **Stripe** (web only — §2.6): create the matching products/prices in
   the Stripe dashboard and point the webhook at the Pocketbase route;
   the sidecar carries the `sk_` secret, the app bundle only the
   public `pk_` key.

### 2.3 How a purchase flows (what the above unlocks)

`IapPanel` (🛍️ in the footer, next to the daily bonus / rewarded ads)
→ `useIap.purchase` → `IapProvider.purchase(productId)`:

- **dev build**: `devSimIapProvider` — a labeled 1.5 s simulation
  ("⚠️ Development build" banner) so the whole buy → unlock → Cosmetics
  flow is testable pre-store. A dev build can opt into the REAL store
  provider instead ("Real store billing" toggle in the IAP panel —
  §2.4) for on-device Play Billing tests.
- **native prod**: `storeIapProvider` — `expo-iap` requests the
  purchase, then **POSTs the receipt to Pocketbase**
  (`/api/app/verify` → `pb_hooks/verify-purchase.js` → the
  zero-dependency **store-verification sidecar** calls the Play Billing
  API (`purchases.products.get`) or Apple V2 with the service
  credentials; Pocketbase itself has no store credentials and no
  outbound network needs). The reply is only `verified: true` when the
  store confirmed the purchase for the claimed internal product id.
  Then the entitlement is granted **device-locally** (AsyncStorage
  `iap` key — never in the game save, so shared/imported saves can't
  import someone else's receipts), and the Cosmetics section re-resolves
  ownership from it.
- **web**: `iapProvider.web.ts` — **Stripe Checkout (hosted)**: the
  player is redirected to Stripe's hosted page (payment happens THERE,
  never in this app's page); the provider sets `grantsLocally: false`,
  so a "purchased" result never self-grants — the entitlement arrives
  via `restore()` after the SERVER mints the row. Two independent mint
  paths, both idempotent on (device, product): the client's return
  visit (`?iap=success&iap_sid=…` → verify with the session id) and
  Stripe's `checkout.session.completed` webhook (→ `/api/app/stripe/
  webhook` → sidecar). Hidden (no-op) until the full Stripe block is
  configured — §2.6.

Entitlements are keyed by the **internal** product id; the Pocketbase
allow-list (`pb_hooks/logic.js` `PRODUCTS`) maps internal → store id
and is pinned against `IAP_STORE_IDS` by `pb_hooks/__test__/logic.test.js`.
A valid receipt for a product NOT in the allow-list never mints an
entitlement.

Entitlements re-derive **silently on every launch** — there is no
manual restore button: `useIap` runs `reconcileStore()` once per start
(expo-iap `getAvailablePurchases` → re-grant + re-ack + re-verify each
token, so the server row re-mints under the device's CURRENT id) and
`IapProvider.restore()` (`/api/app/restore`) merges additively into the
local entitlement record (a restore can only ADD, never revoke). This
is what makes an entitlement survive a full local wipe: the store's own
record is the source of truth, not the device's.

### 2.4 Testing real billing on a debug APK

The normal dev build runs the labeled simulation, which never touches
Play Billing. To exercise the REAL store round-trip (product sheet,
payment, `finishTransaction`, verify, entitlement) on a debug APK:

1. **Play Console**: the app + the products exist (§2.2) and the
   internal test track has the build's package
   `com.minesofdoom.minus4kelvin.minesofdoom`.
2. **License key**: Play Console → app → Monetize → License testing →
   **API key**. Install it on the device (the Play Store app must be
   signed in):

   ```sh
   adb shell am start -a com.android.vending.BILLING -e key <LICENSE_KEY>
   ```

   This is what lets a **debug-signed** APK talk to Play Billing; a
   release build signed with the upload key does not need it.
3. **Build the APK** (`npm run android` against Metro, or the prebuilt
   debug APK — the JS bundle is embedded, see AGENTS.md) and install it.
4. **In-app toggle**: open the IAP panel (🛍️) and flip **"Real store
   billing"** (visible only in dev builds, native only, persisted per
   device under the `iapRealStore` localStorage key). The banner above
   it switches to "REAL store billing active" so it is never
   ambiguous which mode the panel is in (transparency guardrail).
5. **Buy** any product with a test card
   (Play Console → Monetize → Test payments → test card). Expected:
   the store sheet opens for the real SKU, the purchase completes,
   `finishTransaction` acks, and the entitlement is **granted
   device-locally immediately** — even while the sidecar still has no
   Play credentials, in which case `/api/app/verify` fails closed
   ("token verification failed") and the purchase is **queued for
   re-verify** (AsyncStorage `iapPendingVerifies`). Once
   `PLAY_SERVICE_ACCOUNT_JSON` lands on the sidecar (§2.2 step 3), the
   next purchase/restore replays the queue, the server mints its
   entitlement record, and restore returns it. A completed store
   purchase is never lost to the flaky-verify state by design.

This is NOT the release gate: the §4 device pass still has to run
against a release (upload-key-signed) build before shipping.

### 2.5 Building the release AAB (Play Console upload)

Play Console needs an **app build uploaded before one-time in-app
products can be created** — this section produces it. The AAB must be
signed with the **Play upload key**; the keystore never enters the
repo. Both key files live at the **project root** — never under
`android/`, because `expo prebuild` wipes that directory (it wiped the
old `android/keystore/` + `android/keystore.properties` during the SDK 57
upgrade). The root `keystore.properties` + `my-upload-key.keystore` are
gitignored, and `android/app/build.gradle` falls back to the debug
signature when the properties file is missing, so a keyless build can
never be uploaded by mistake — Play rejects debug-signed AABs.

1. **Play Console → App integrity → App signing.** Generate (or
   select) the app-signing key and **download the `.jks`** (the page
   gives the keystore password; note the key alias too).
   - If Play App Signing is already set up with a key you don't hold
     (e.g. Google generated one earlier), you cannot sign locally —
     that AAB would need EAS/CI remote signing instead; in that case
     use *"Use an existing key"* with a key you control.
2. **Place the key** (local machine only, at the PROJECT ROOT so
   `expo prebuild` can't wipe it):
   - `my-upload-key.keystore` (the downloaded `.jks`/`.keystore`)
   - `keystore.properties` (no `storeFile` — the path is hard-coded in
     `android/app/build.gradle`):

     ```properties
     storePassword=<from the App signing page>
     keyAlias=<key alias>
     keyPassword=<key password, usually the keystore password>
     ```

   Verify with:

   ```sh
   keytool -list -keystore my-upload-key.keystore -storepass <password>
   ```

   (prints the key alias).
3. **Build** (repo root; the Android SDK must be on the machine):

   ```sh
   cd android && gradlew.bat bundleRelease
   ```

   Output: `android/app/build/outputs/bundle/release/app-release.aab`
   (the JS bundle is embedded by the RN gradle plugin — no Metro
   needed). On non-Windows: `./gradlew bundleRelease`.
4. **Upload + release** (CLI, or the console UI): `npm run play -- upload
   --aab=app-release.aab` then
   `npm run play -- release --track=internal --upload=<id>`.
   Console path: Release → Internal testing → create release → upload
   the AAB. The console verifies the signature
   matches the App signing page. Once a build is on a track, the
   **Monetize → In-app products** section unlocks and the §2.2 table
   can be created.
5. **Every future upload**: bump `version` + `android.versionCode`
   in `app.config.ts` **and** `versionCode`/`versionName` in
   `android/app/build.gradle` (the committed prebuild file — keep them
   in sync; Play requires a strictly increasing `versionCode`), then
   re-run step 3.

### 2.6 Web: Stripe Checkout (the browser purchase path)

Web is the static export the player visits, and it is the ONE place a
purchase happens in a real browser. It uses **Stripe Checkout
(hosted)** — the no-card-UI-in-the-app option: the payment is collected
on Stripe's hosted page, and the app only redirects there and back. The
app bundle carries **only the public `pk_…` key**; the `sk_…` secret
lives solely in the VPS sidecar env (it is the verify credential, same
role the Play/Apple service credentials play for native).

**Two independent, idempotent mint paths** (both gate on the sidecar
asking Stripe, so a client can never self-grant):

1. **Return-visit verify (primary).** `purchase()` redirects to hosted
   Checkout with `successUrl` = `/?iap=success&iap_product=…&iap_sid=
   {CHECKOUT_SESSION_ID}`. On the web-only on-mount effect
   (`MinesOfDoom.tsx`) the app reads those flags, calls
   `noteCheckoutSuccess(productId, sid)`, and `restore()` replays the
   pending queue → `POST /api/app/verify { platform:"web", token:sid,
   deviceId }`. The sidecar `verifyStripeCheckout` does
   `GET /v1/checkout/sessions/{sid}` with the `sk_` key and mints ONLY
   if `payment_status === "paid"` AND `metadata.mdoomProductId` matches
   AND `metadata.mdoomDeviceId` matches the caller (device binding —
   a session id can't be replayed from another device).
2. **Webhook (backup).** Stripe delivers
   `checkout.session.completed` to the sidecar's `/stripe/webhook`
   (Caddy fronts the public Pocketbase URL at that path). The sidecar is
   the one place that still has the **raw** body, so it verifies
   `Stripe-Signature` there (HMAC-SHA256, ±5-minute tolerance) and only
   then forwards the untouched event to Pocketbase's
   `/api/app/stripe/webhook` with the `x-mdoom-key` shared key — that
   route 403s anything else while `MDOOM_SIDECAR_SECRET` is configured.
   The event body remains an untrusted hint: the ONLY mint gate is the
   same sidecar Stripe-API lookup. It's idempotent on the Stripe event id
   (dedup row in the `events` collection, `kind="stripe-event"`). This
   path covers the player who pays on Stripe but never completes the
   browser redirect back.

The client provider sets `grantsLocally: false` (iaps.ts), so
`useIap` never grants on a web `purchase()` result — the entitlement
always arrives through `restore()` after the server mints the row. This
is what keeps the hosted-redirect "purchased" (really: "redirect
started") from ever being mistaken for a confirmed payment.

**Setup (console + config + server):**

   **Status (2026-09-08, test mode):** steps 1–4 are DONE — products/
   prices and the webhook endpoint were created programmatically (the
   commands below), `storeConfig.stripe` is filled with the test-mode
   `pk_`/`price_` ids, and the sidecar env (`STRIPE_SECRET_KEY`,
   `STRIPE_WEBHOOK_SECRET`, `MDOOM_PB_URL`) landed on the VPS with the
   sidecar `/healthz` reporting `configured.web: true` +
   `stripeWebhook: {signature: true, pocketbase: true}`. Step 6 is
   **verified 2026-09-08** — `node scripts/stripe/checkoutTest.mjs`
   drove a hosted Checkout session end to end (a no-cost order — the
   script's blank-card policy, the documented
   `docs.stripe.com/payments/checkout/no-cost-orders` sandbox flow —
   so no card number is ever sent): the hosted page completed, the
   return navigation carried `?iap=success&iap_sid=cs_…` back, the
   session reached `complete` / `payment_status: paid` (no PaymentIntent
   for no-cost, as documented), the **webhook leg** minted the
   `pack_gold` entitlement row (restore visible ~1s after completion)
   and the **redirect leg** (the exact client verify fetch) returned
   HTTP 200 upserting the SAME row — exactly 1 row, idempotently. The
   real paid session-creation route (`--via-sidecar` → the sidecar's
   `POST /stripe/checkout`) is verified for session creation; it cannot
   be driven to completion by the script (blank card is policy). The
   **Flip status (2026-09-11, IN FLIGHT):** the live price map is
   pasted into `stripeProd.prices` (commit `4ff4f45`), the live webhook
   endpoint was rotated to `we_1UEbw0…` (the first endpoint's one-time
   `whsec_` is unrecoverable), and the VPS sidecar env is already live
   (`STRIPE_SECRET_KEY=sk_live_…` + the new whsec + the live
   `MDOOM_STRIPE_PRICE_MAP`; backup
   `~/docker/pocketbase/.env.bak-preliveflip-20260911` on the VPS;
   sidecar /healthz all green, unsigned webhook POSTs → 400). `verify
   --live` agrees on the price map; its only finding is the unfilled
   `stripeProd.publishableKey`. What remains: paste the `pk_live_…` key
   into `stripeProd.publishableKey` — the key is **dashboard-only**
   (Developers → API keys → live mode; the API no longer returns
   account keys, so the `products --live` snippet shows a placeholder
   for it) — then `pnpm run deploy` and `verify --live` (exit 0). The
   step-6 flip below stays the runbook.

   **Steps 1–2 are scriptable** — `node scripts/stripe/syncStripe.mjs
   products` (idempotent, creates the 25 products + prices from
   `scripts/stripe/catalog.json` — the table jest-pins against `iaps.ts`
   — and prints the snippet for the matching block: the test
   `stripe.prices` map, or the `stripeProd` block with `--live`) and
   `node scripts/stripe/syncStripe.mjs webhook` (idempotent by URL,
   prints the `STRIPE_WEBHOOK_SECRET`). The `sk_` key comes from env
   `STRIPE_SECRET_KEY`, the gitignored root `stripe-secret.env`, or a
   hidden prompt — never the repo; a `sk_live_` key needs `--live`.
   Doing it in the console instead:

1. **Stripe dashboard → Products:** create a one-time **Price** per row
   of the §2.1 table (same display names, same tiers). Note each
   `price_…` id. (No subscriptions — the catalog is one-time packs.)
2. **Webhook:** add an endpoint at
   `https://minesofdoom.minus4kelvin.com/stripe/webhook` (the sidecar
   port, fronted by Caddy at the public Pocketbase URL — **this route is
   live since 2026-09-06**, fail-closed until step 3's env lands — see
   `docs/pocketbase-plan.md`) and subscribe it to
   `checkout.session.completed` only. Copy its `whsec_…` signing secret.
   (`pk_`/`sk_` never go in the URL; the `whsec_…` is a server credential
   the sidecar keeps — it is the S2 fix, `docs/security-audit.md`.)
3. **Sidecar env** (VPS, never in the repo): `STRIPE_SECRET_KEY=
   sk_…` (the Checkout session lookup), `STRIPE_WEBHOOK_SECRET=
   whsec_…` (the `/stripe/webhook` signature check), `MDOOM_PB_URL=`
   the internal Pocketbase base URL (where the verified event is
   forwarded with the shared key). Optional `STRIPE_API_VERSION` to pin
   an API version (empty = account default). `/healthz` then reports
   `configured.web: true` + `stripeWebhook: { signature: true,
   pocketbase: true }`.
4. **`storeConfig.ts`:** set `stripe.publishableKey = "pk_…"` and fill
   `stripe.prices` with every catalog id → `price_…` (all-or-nothing —
   `isStripeConfigured` keeps the whole web shop hidden until every
   `IAP_PRODUCT_IDS` entry has a price, so no button can lead to a
   purchase that can't complete). The prod counterpart — the
   `stripeProd` block — stays EMPTY until the launch flip (step 6);
   until then every environment (including the prod domain) runs the
   test block.
5. **Deploy:** rebuild the web export (`npm run deploy`) and reload the
   sidecar (new env). The IAP panel appears in the web shop sheet only
   once both the URL and the full Stripe block are set.
6. **Test with a Stripe test key** (`pk_test_…`/
   `sk_test_…`): `node scripts/stripe/checkoutTest.mjs` drives the whole
   leg — a no-cost order (blank-card policy; the script never sends a
   card number) through hosted Checkout, then confirms the redirect back
   grants the entitlement via the client verify fetch AND the webhook
   minted the same (device, product) row idempotently (exactly 1 row).
   **DONE 2026-09-08** (see the status block above; session
   `cs_test_a1f0WT…`). Then flip to live keys for launch — **the flip is
   a data paste, not a code change**: re-run
   `syncStripe.mjs products --live` (and `webhook`) with a `sk_live_`
   key to print the live snippet, and paste it into the
   `storeConfig.ts` **`stripeProd` block** (the test block `stripe`
   stays test-mode — dev/previews keep working). The prod environment
   auto-activates the prod variables: `environment.ts` detects it (the
   prod web domain `minesofdoom.pages.dev` exactly — never previews,
   never localhost — or a non-`__DEV__` native build), and
   `getActiveStripe()` serves `stripeProd` instead of `stripe` whenever
   the env is prod AND the block is fully live-mode (`pk_live_` key +
   non-empty price map); until the paste, prod falls back to the test
   block exactly as pre-launch. Re-sync the webhook secret too (the
   endpoint URL is the same; the `whsec_` secret changes per key).
   **Confirm the flip with the third command**:
   `node scripts/stripe/syncStripe.mjs verify --live` (read-only) — it
   diffs the account's mdoom-marker products + prices against
   `catalog.json` AND the `storeConfig.ts` **`stripeProd` block** (the
   `sk_live_` key reads `stripeProd`; the `sk_test_` key reads
   `stripe` — each block is checked where it belongs), so it catches
   exactly the manual-flip failure modes: an unfilled/half-pasted
   `stripeProd` (repo `price_…` missing or ≠ the live id), a
   `pk_test_` key pasted into the prod block (never an activation), a
   price amount that drifted from the catalog tier, and missing/rogue
   products. Exit 0 = the account and the repo agree; exit 1 prints the
   finding list. Pinned by
   `scripts/stripe/__test__/syncStripeVerify.test.ts` (subprocess
   against a mock Stripe API via the script's `STRIPE_API_BASE` seam,
   plus a scratch-storeConfig seam for the finished-flip run).

**Why hosted Checkout and not Payment Element:** it keeps all
PCI-scoped card fields on Stripe's page (lowest cardholder-data
surface for a hobby project), needs no backend tokenization step, and
the publishable-key-only client is enough. The trade-off is the two-
path mint (return-visit + webhook) instead of a single synchronous
confirm — handled by making both paths idempotent and both gated on
the sidecar.

### 2.7 Web e2e — what the Playwright suite covers (and the ads "not

flagged" setup)

`pnpm run test:e2e:web` exports the static web build (`expo export -p
web` → `dist/`) and drives it in Chromium from `e2e/web/` (config:
`playwright.config.ts`). Three specs:

| spec | what it proves |
| --- | --- |
| `boot.spec.ts` | the web build is *fully functional* for a free player: boots, onboarding skips, hold-to-mine works, the save round-trips through a reload — all with the ad domains and the Pocketbase sidecar ABORTED at the network layer (so it doubles as the offline-resilience check: the game works with zero backends). |
| `ads.spec.ts` | the rewarded-ad pipeline (Ad Placement API), two layers — see below. |
| `iap.spec.ts` | the full web IAP round-trip against STUBBED backends: shop → `POST /stripe/checkout` (stub session id) → `js.stripe.com` stub whose `redirectToCheckout` plays the completed hosted checkout (navigates to the `?iap=success…` return URL) → `POST /api/app/verify` (mints) → `POST /api/app/restore` (returns entitlements) → the pack shows owned (✓ + Equip) in the shop. Every other sidecar/Stripe request is aborted; the suite asserts none escapes. |

**The ads "proper test setup" (todo: "so ads don't get flagged")** —
two complementary layers, both safe to run repeatedly against the live
AdSense client `ca-pub-…`:

1. **Stubbed loader (zero Google network).** The `adsbygoogle.js`
   RESPONSE is intercepted and served as a local script that implements
   the exact push contract the provider relies on (`type:"reward"` →
   `beforeReward(showFn)` → `beforeAd` → `adViewed` → `afterAd`). No
   Google request is ever made; a guard route records (and the test
   fails on) anything that would reach a live ad domain. This is the
   deterministic, CI-safe layer.
2. **Real loader in Google's documented TEST MODE.** Google's Ad
   Placement API has an official test mode for exactly this: the
   `data-adbreak-test="on"` attribute on the loader `<script>` tag
   (<https://developers.google.com/ad-placement/docs/test>). It renders
   **mock ads and makes no ad requests to Google's servers**, and
   cycles the ad-loaded / ad-not-loaded scenarios (so the no-fill path
   is exercised too). `e2e/web/server.mjs` injects that attribute into
   the served `index.html` — **the export itself is unchanged**, the
   injection lives in the e2e server only, so production builds never
   carry the flag. `installLiveAdGuard` still aborts and fails the test
   on any request that would become a real impression, so the account
   can't be flagged even if Google's test mode ever leaked a live
   request.

**Not covered here (by design):** the LIVE Stripe↔sidecar↔VPS
round-trip (real sessions, real `STRIPE_SECRET_KEY` mint) stays in
`scripts/stripe/checkoutTest.mjs` (run it manually against the test
account), and the live Google fill path (real ads, real impressions)
is never exercised by CI — only the mock/test-mode surface above.

---

## 3. Cloud saves, leaderboards & achievements (Pocketbase)

Scope: **cloud save w/ recovery**, **leaderboard**, **achievements
sync**, **per-player achievement unlocks**, **GDPR delete**, and the
store-account half of §2.2. **No social features, no accounts required
by default** — the anonymous device is the identity, exactly as
`docs/pocketbase-plan.md` decided. (Deployment/ops details for the
server itself live in `docs/pocketbase-plan.md`; this section is the
design + status.)

### 3.1 Design decisions (the non-obvious ones)

1. **The anonymous device IS the user.** No signup, no email, no
   password. Every route is keyed by a client-generated `deviceId`
   (AsyncStorage `deviceId` key, same key family as the IAP
   entitlements). This matches the game's existing identity model:
   saves are already device-scoped, and the IAP entitlements already
   live device-locally. A Pocketbase *login* is NOT the identity — it
   is an **optional upgrade** (see §3.4) that lets the same player bind
   multiple devices.
2. **No game-logic server-side.** Pocketbase is a *store + verifier*,
   not a game server. The only non-trivial server logic is
   (a) store-purchase verification via the sidecar and (b) the
   **anti-cheat caps** on leaderboard submissions (below). Everything
   else is dumb CRUD the client already does locally. This keeps the
   server boring, keeps the app F2P-viable offline, and means the
   cloud is a *convenience layer* the game fully works without (same
   posture as IAP today: hidden until the backend is configured).
3. **Saves are opaque blobs with a version gate.** The client
   compresses the existing save payload to a JSON string and ships it
   as an opaque `data` field (the server does not parse game state —
   it only checks length + `saveVersion`). On restore the client
   validates + migrates exactly as it does for a save-code import
   (`importSaveCode`), so a corrupted/partial restore falls back to
   the local save instead of corrupting it. This is what makes the
   save-code feature and the cloud feature share one validation path.
4. **Leaderboard is a *claim*, not an authoritative score.** The
   client submits `{ bestDepth, maxCombo, lifetimeMinerals, ts }` with
   a display name; the server applies **hard caps** (depth/combo/
   lifetime bounds derived from the known end-game) and a **rate limit**
   (one write per device per hour) — it does NOT re-simulate the
   game. This is the right amount of trust for a leaderboard: the caps
   make a garbage/fabricated submission visibly absurd or silently
   clamped, and the rate limit stops a script from flooding it. We
   accept that a determined cheater can submit a plausible-but-fake
   high score; the leaderboard is cosmetic, not competitive-prize.
   (If it ever becomes prize-bearing, that's when server-authoritative
   scoring earns its cost.)
5. **Achievements are *unlock events*, not state.** The achievement
   *definitions* and the *unlocked-set* live client-side (they already
   do — `achievements.ts` + the save). The cloud just gets an
   **append-only log of unlock events** (`deviceId, achievementId,
   ts`) so (a) the same device on a fresh install can re-derive its
   unlocked set, and (b) a future "show my badges" / share feature has
   a durable record. We do NOT store the achievement *progress*
   counters in the cloud — that's re-simulating the game, which
   decision #2 rules out.
6. **One Pocketbase instance, one collection per concern.** `cloud_save`
   (1 row/device), `leaderboard` (1 row/device), `achievement_log`
   (N rows/device), plus the IAP `purchases`/`entitlements` the verify
   endpoint already needs. All collections **private** (rules null);
   the only writers are the JS hooks in `pb_hooks/`. No public API
   surface, no API keys in the client.

### 3.2 Identity & the optional account layer

- `deviceId` (required, every route): a UUIDv4 generated on first
  launch, persisted AsyncStorage `deviceId`. This is the **primary key
  of every cloud row**. The client already generates one for IAP
  entitlements; reuse it, don't mint a second.
- **Optional login (Phase 4, built — email+password, Google and
  Apple)**: a Pocketbase account (any of the three mechanisms, all
  provider-agnostic — see `pb_hooks/README.md`) that *binds* a
  `deviceId` to an account.
  The account is **never** the identity for data routing — it's a
  **restore bridge**: on a new device, the player logs in and the
  server returns *that account's other devices'* cloud rows (save +
  achievements), letting the player pull their old save. This is the
  only feature login buys; everything works without it. Keep it
  optional + one-tap-skippable (it's a recovery feature, not a gate).
  The email/oauth2 merge runs in both directions: sign-in merges
  automatically when the provider's verified email matches an existing
  account, and a signed-in player can deliberately link a provider
  (`auth/link/<provider>`, proof = a fresh sidecar-verified idToken) or
  attach the email password (`auth/set-password`) — one provider
  identity is always bound to exactly one account (409 `provider-taken`
- **Conflict rule (stated, not inferred):** cloud and local can diverge
  (player keeps playing offline). On restore, the client compares
  `updatedAt`/`minerals`/`depth` and offers the player a **choice**
  (keep local / take cloud) — it never silently overwrites a newer
  local save. Same spirit as the save-code import (which already
  refuses to clobber a newer local save).

### 3.3 REST shape (what the client will call)

Base: `https://minesofdoom.minus4kelvin.com` (Pocketbase, live).
Private collections — the client authenticates by `deviceId` (the hook
verifies the device owns the row it's touching); optional
`Authorization: <pbSession>` for the account/restore routes. All six
routes are **already built** in `pb_hooks/` (see `pb_hooks/README.md`
for the exact REST shapes) — POST + JSON, keyed by `deviceId`.

| Route | Body / query | Reply | Notes |
| --- | --- | --- | --- |
| `POST /api/app/cloud/push` | `{ deviceId, save: { version, data } }` | `{ ok, storedAt }` | 64 KB cap, version ≤ server max (a newer version is **rejected**, not stored — the client would import its own save back through a migration path the server doesn't know) |
| `POST /api/app/cloud/pull` | `{ deviceId, sessionToken? }` | `{ save, name }` / null | account bridge: with a session, the device is linked and any linked device's save is reachable |
| `POST /api/app/leaderboard/submit` | `{ deviceId, name, bestDepth, maxCombo, lifetimeMinerals }` | `{ ok, rank }` | hard caps + 1 write/device/hour |
| `POST /api/app/leaderboard/top` | `{ limit? }` | `{ rows }` | best-depth ranking |
| `POST /api/app/leaderboard/rank` | `{ deviceId }` | `{ rank }` | the device's own standing |
| `POST /api/app/verify` / `/api/app/restore` | IAP receipt / `{ deviceId }` | entitlements | §2.3 — via the sidecar |

Plus `POST /api/app/achievements/unlock` (append-only event log) and
`POST /api/app/gdpr/delete` (wipes the device's rows) — the GDPR
route is the one the LegalSection links.

### 3.4 Status

- **Phases 1–2 (store accounts, sidecar credentials)**: ⬜ — see §2.2;
  this is the same blocker as the IAP half.
- **Phase 3 (server: collections, verify endpoint)**: ✅ —
  `pb_hooks/` is deployed on servarica (deployment + credentials in
  `docs/pocketbase-plan.md`).
- **Phases 4–5 (client cloud save w/ recovery + settings;
  leaderboard panel; achievement share; GDPR delete; optional login
  (incl. the email/oauth2 account merge: link/sign-in/set-password) —
  email/password + Google/Apple native SDKs, session threaded through
  the cloud/leaderboard/IAP routes)**: ✅ — wired and tested (client
  is pointed at the live URL; the design above is what was built).
  **Google sign-in verified working on-device** (`mines-play-35`,
  release/upload-key-signed build — 2026-09).
- **Phase 6 (iOS: App Store products + the sidecar's `APPLE_*`
  credentials; TestFlight)**: ⬜ — `docs/backlog.md` (iOS section).
- **Phase 7 (metrics: first-time-ad-view, IAP purchase, D1/D7
  retention, free-path progress — lightweight event logging before any
  UA spend, AGENTS.md guardrail 5)**: ⬜ — not built yet.

---

## 4. On-device verification (the release gate)

Run with a **test purchase**, after §1 + §2 are done. Web is out (the
`.web` swaps are no-ops by design). Device requirements (researched
2026-09-04 against
[developer.android.com/google/play/billing/test](https://developer.android.com/google/play/billing/test)
and the
[OpenIAP testing guide](https://openiap.dev/docs/guides/testing) —
`expo-iap` is OpenIAP):

- **Android: a real phone is NOT required.** Play Billing works on an
  **emulator with a Google Play image** (Play Store app installed —
  check with `adb shell pm list packages | grep com.android.vending`;
  the Pixel 3a image has it, the `MinesTablet` AVDs need verifying) and
  **no emulator exclusion exists in Google's docs** — the old
  "Play Billing doesn't work on emulators" folklore is refuted by the
  official license-tester path. Requirements:
  1. A **Play Console license tester** account (Users and permissions →
     Testers; license response normal) — purchases from it use the
     special **test cards** (always-approves / declines / slow) and are
     never really charged; the purchase dialog shows a test banner.
  2. That account **signed into the emulator's Play Store** (per the
     official docs, a test account must be on the device).
  3. Official docs say license testers can even **sideload debug
     builds** (bypassing the "signed + uploaded" check; package name
     must match) — so §2.4's license-key debug APK and an
     internal-track AAB installed from the Play Store test link are
     both valid routes; the test-track install is the canonical one
     (the purchase attributes to the account that downloaded the app).
  4. Housekeeping: license-tester consumables auto-consume after
     ~3 min; test purchases can be refunded/revoked in Play Console →
     Order management; product ids must be ACTIVE (ours are).
  - StoreKit by contrast **does not** work in the iOS simulator —
    the iOS half of this pass genuinely needs a real phone.
- **A real phone still counts** as a valid path (it has no extra
  setup and doubles as the AdMob test device).

- [x] **Ads** (§1): a configured rewarded slot loads a real test ad,
      watching to the end fires `onRewarded` exactly once, the
      daily-bonus double is granted, and the "Remove Ads" panel state
      is reflected (owned → panel hidden).
      *(2026-09-04: done — phone registered as an AdMob test device and
      the rewarded watch → reward flow verified on device. The
      "Remove Ads" half rides along with the IAP purchase test below,)
      since owning it is what hides the panel. The `mines-play-35`
      emulator is also **registered as an AdMob test device** in the
      console, so rewarded test ads load on it without billing — it
      doubles as the AdMob half of this pass alongside the phone.)*
- [x] **IAP purchase** (§2.3): buy one cheap pack with a **test card**
      (license tester) → the entitlement is granted, the cosmetic
      appears in Cosmetics, and a **wipe of the local AsyncStorage key
      + restore** re-applies it from the store (this is the whole point
      of Pocketbase verify — the receipt round-trips).
      *(2026-09: **done — the IAP purchase flow works on a build signed
      with the Play upload (release) key** on `mines-play-35` (the
      license-tester route from the 2026-09-05 diagnosis: license
      tester Gmail added to `internal` in Play Console → Testing →
      License testers, the earlier “item could not be found” was the
      missing tester, not a code bug). Note the release-signing
      caveat: a debug-signed APK is only a valid billing-test route
      with the §2.4 license key installed — “works out of the box” is
      the release build.)*
- [x] **Remove Ads** (on-device, test price): owning it hides the
      rewarded-ads panel AND the IAP panel permanently.
      *(2026-09-07: dropped — the Remove Ads product was removed from the
      catalog (`iaps.ts`) and the server allow-list (`pb_hooks/logic.js`);
      there is no ad-removal entitlement anymore. The `remove_ads` Play
      product may still exist in Play Console — it is simply never
      queried; delete it there if you want the console clean.)*
- [ ] **Cloud save** (§3): play a bit → the save is pushed; change
      something, force-quit, launch → the save is pulled and
      reconciled; the settings (name etc.) round-trip.
- [ ] **Leaderboard**: submit a score, it appears in `/top` within the
      rate-limit window; a fabricated out-of-cap submission is
      clamped/rejected.
- [ ] **GDPR delete**: the LegalSection "delete my data" wipes the
      device's cloud rows and the next launch starts clean.
- [x] **Web bundle grep**: `npx expo export -p web` → grep `dist/` for
      `expo-admob` / `expo-iap` — the native SDKs must not leak into
      the web bundle (the `.web` swaps resolve no-ops; a hit here means
      a swap is missing). The Pocketbase URL *should* be present (it's
      a plain fetch endpoint).
      *(2026-09-04: done — the release APK pass exported the web bundle
      and it was clean: no `expo-admob` / `expo-iap`, no `MDOOM_DEV*`,
      no `:8090` sandbox port, dev-sim code inert behind folded
      `__DEV__`; the prod Pocketbase URL present as expected.)*

---

## 5. iOS / TestFlight half (deferred — `docs/backlog.md`)

- **App Store Connect**: create the §2.1 products by the same
  `storeId`, the `APPLE_*` sidecar credentials (API key `.p8`), the
  Apple app id.
- **`app.config.ts`**: fill `ios.bundleIdentifier` (or confirm the
  prebuilt one), run `npx expo prebuild -p ios` (the `android/` dir is
  prebuilt; iOS is not yet), build + upload to TestFlight.
- The client side is platform-neutral: `selectIapProvider` already
  keys off `Platform.OS === "web"` only, so iOS picks up
  `storeIapProvider` automatically once the Pocketbase URL is
  configured (it is) — no code change, just the store half above.

---

## 6. Guardrail reminders (AGENTS.md — non-negotiable)

- **Rewarded ads only**, always behind an explicit "Watch" tap.
  Interstitials / banners: off the table. (The `unityAdProvider` is
  literally only `showRewarded` — there is no API surface for the
  others, and the native module exposes nothing else.)
- **No dark patterns**: the purchase panel shows plain prices, plain
  blurbs, and the "also earnable in-game for N 💎" line on every pack;
  no fake scarcity, no default-checked anything.
- **F2P is viable**: every pack grants a gem-earnable cosmetic; the
  free-path benchmark in `docs/todo.md` is the gate.
- **Measure before scaling** (guardrail 5): the §3.4 Phase 7 event
  logging lands **before** any UA spend.
- **Compliance**: the game is a math idle game (young-skewing);
  the shipped ad posture is child-directed / non-personalized
  (`storeConfig.unityAds.childDirectedTreatment: true` →
  `UnityAds.setNonBehavioral(true)`) with the advertising-id permissions
  removed from the APK (`stripAdvertisingId`), and every placement is
  required to be skippable after 5 seconds (Unity dashboard, §1.1).
  Confirm all three before the ids go live beyond test.
