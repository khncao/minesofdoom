# Mines of Idle Doomath — Feature gaps (explored 2026-09)

All of the game's open feature gaps: an **impact ranking** up front,
then the per-pass research sources, then the full gap layers —
`docs/features.md` §7 moved here on 2026-09, leaving that file as a
pure reference of what exists. **A ranking, not a plan — per the todo
rule nothing here is planned or greenlit**; anything picked up goes
into `docs/todo.md`. Section numbers cited in the layers below (e.g.
"§2", "§4") are in `docs/features.md`.

## Impact ranking (2026-09)

Ranking of the open, unimplemented feature gaps named in the gap
layers below (this doc's former `docs/features.md` §7, moved on
2026-09) by expected impact on the product. **A ranking, not a plan —
per the todo rule nothing here is planned or greenlit.** Each item's
triggers and scope of record live at the cited pass; this file only
orders them.

**Ranking basis** (in order): (a) does closing the gap unblock *knowing*
what to build — guardrail 5 mandates measure-first, and pre-launch there
is no cohort data yet; (b) magnitude on the retention funnel
(D1 → D7 → D30+); (c) pre-install conversion; (d) quality/trust floor.
Consequence: measurement gaps outrank most real features, because until
they land every real-feature decision is a guess the research says the
repo is not equipped to make.

## Tier 0 — Instrumentation & benchmark integrity (cheap; precondition for everything else)

1. **`telemetry:opt-in-cohort`** (pass 26) — opt-in upload of the
   reduced analytics record to the pre-staged Pocketbase `events`
   collection. Today no cohort denominator exists anywhere: D1/D7,
   ad-view fractions, IAP rates are per-device booleans. This is the
   only candidate that turns per-device truth into fractions; until it
   lands, guardrail 5 is single-player. Opt-in, default off; the GDPR
   delete endpoint and per-device write-budget precedent already
   cover the rows.
2. **FTUE funnel instrumentation** (pass 7) — time-to-core, per-step
   drop-off, tour completion, first-session length, session 1→2
   conversion. D1 is the named retention driver; the first session is
   its biggest lever (the 60-second-playable rule). Onboarding
   dismissal is currently the only onboarding signal.
3. **`free-path:motherlode-target` + `economy:offline-sim-fix`**
   (passes 25/19) — benchmark integrity: CI pins F2P only at the
   *opening* (first prestige ≤ 7 days); time-to-t5 is unpinned, and
   the sim's offline term has been structurally zero
   (`computeOfflineMinerals` called with `saveTime: 0` since before
   the bigint rewrite) — the near-idle persona has never earned
   offline in the benchmark. The F2P guardrail is only as good as the
   benchmark's coverage; both are cheap (a sim fix + a CI assertion).
4. **`analytics:readout-completeness`** (pass 26) — cheapest item in
   the layer: surface the stored record (`cosmeticPurchaseLog` last-N
   rows, per-product IAP counts) in `summarizeAnalytics`; the debug
   section currently hides the rows it counts.
5. **Failure-class events** (pass 21 F21.2, pass 11) —
   `save-failure-event` (Nth consecutive failed local write),
   `stale-resolution-event` (the client already knows when a push
   loses; log the `updatedAt` delta — the skew measurement this game
   can't get any other way), and a save-corruption event. "The one
   failure class this game can least afford to be blind to (progress
   loss) is the only one with no event."
6. **`analytics:tier-milestone`** (pass 23) — first-occurrence
   local-day fields for t1–t5 on the existing analytics record, so the
   gate moments (t1 = first purchasable line, t3 = the prestige gate)
   are measured directly instead of via the `firstPrestigeDay` proxy.
7. **`analytics:first-ad-kind`** (+ first-ad-outcome) (pass 26) — the
   rewarded kind is dropped at the `MinesOfDoom.tsx` hook seam and no
   ad *outcome* (`rewarded` / `closed` / `error`) is recorded; the ad
   pipeline's failure modes (no fill, early close) are invisible.
8. **Perf measurement trio** (pass 20) — `perf:android-size` (build
   one release AAB, record download vs installed size; the one
   delivery number that moves conversion, ≈1% install per +6 MB,
   currently unmeasured), `perf:web-startup` (give the 3 s / 53%
   benchmark a real number), `perf:tick-measure` (the per-second
   root re-render of the 1,692-line component has no number). All
   local logging, no code change; `perf:audio-lazy` only if
   web-startup shows the 640 KB WAV on the critical path.
9. **`economy:interval-metric`** (pass 19) — the pass-8
   interval-to-next-purchase invariant as a dev-only script (or a
   `--pacing` flag on the sim). The D18→D60 wall is income
   *saturation* (all gem lines capped), not the cost curve — pacing
   complaints can't be triaged without the metric.
10. **Crash-code export / crash ring into local stats** (pass 11) —
    the crash-context trail (12 labels + 24-key snapshot) is the
    game's only per-event trail but is in-memory and dies with the
    process; an export path makes per-device crash context reportable.
11. **Per-feature first-use / first-open stamps** (pass 27) — which
    header entries players actually discover: first daily-equation start,
    first weekly-contract claim, first leaderboard open, first records /
    collection / goals tab open, first save-code export, first cloud link
    — one-shot stamps on the existing local record, generalizing pass 24's
    `analytics:leaderboard-open` into the family. The only measurement
    that turns pass 27's IA candidates from a hunch into data; same
    local-stamp-now, cohort-later split as item 1.
12. **`deploy:prod-env-gate`** (pass 28) — the one trust-chain
    weakness pass 28 found, and the only one where a silent
    failure is a money leak, not a UX bug: the sandbox flag
    (`MDOOM_DEV_FAKE_TOKEN`, which mints *any* IAP + identity
    token when set) and the sidecar URL are asserted nowhere at
    release time — §4's release gate checks on-device
    verification but never the production container's env.
    The release-gate item (or a deploy-time assert): production
    reports the flag unset and the sidecar `/healthz` is
    `configured: true` per platform. Hours of work.

## Tier 1 — Real feature gaps, ranked by impact-per-line

 1. **`math:adaptive` + `math:mastery`** (pass 15) — the biggest
    *content* gap: equation difficulty is fully static (a number range
    + optional hard mode, chosen once and unchanged by performance).
    Math is the game's identity; static difficulty is a D7+
    engagement ceiling. Per-skill tracking with mastery tier-ups is
    the research shape; `equations.ts` is pure and shapes per type,
    so tiers slot in without touching the active loop. Hard
    constraint: challenge, never replace, hand-solved math; the
    player-set range stays the ceiling. Of its smaller companion fixes,
    `math:zero-operand` (it.13) and `math:pending-gain` (it.21) are DONE;
    `math:ladder` (a stepped number range) is the one still riding
    along. Pass 32 adds a control-surface companion: `settings:min-floor`
    (F32.3) — the range has a model floor (`minNumber`, fixed at 0) but
    no UI writer; only the ceiling is exposed.
 2. **Text size / UI scaling** (+ high-contrast second step) (pass 3,
    accessibility) — "the cheapest high-impact item in the playbooks":
    `styles.ts` hard-codes `fontSize: 11–12` with no OS scaling; a
    kid-skewed audience argues strongly. High-contrast /
    color-independence (gem-pocket discovery currently reads mostly
    from canvas color) is the follow-on step on the same settings row.
 3. ~~**`web-ambient-unlock`**~~ (pass 22, F22.4(b)) — **DONE 2026-09-10**
    (landed as a bug-fix inside the web sign-in e2e work, commit
    `49c472f`): `useSounds.ts` gesture-gates the ambient bed — web
    `play()` never fires before the first user gesture (`gestureSeen`
    state + first-tap listener; a blocked `play()` rejection is
    swallowed), and native delays the bed from boot to the first tap.
    The proposed "one-time gesture unlock" is exactly what shipped.
 4. **Keyboard operability check** (pass 13) — verify first with a
    keyboard only on the shipped web build, then standard
    focus/tab-order props on the holes. Load-bearing: web is the
    first-class monetization surface and its desktop players are
    mouse-only today (the only keyboard surface is the answer field);
    this is also the seam iOS Eye Control / Android switch access
    arrive through. The cheap 80 %.
 5. **`corrupt-backup-surface` + `save-code-checksum`** (pass 21) —
    the `.corrupt` forensic backup is written and unit-tested but
    orphaned (nothing reads it); and `decodeSaveCode` clamps a
    truncated paste into a partial save instead of failing. A
    settings restore/discard row + a trailing FNV-1a checksum turn
    the worst failure class into recoverable events. The
    checksum-only half is strictly safe.
 6. **`reward-sfx-set` + `sfx-gain-scaling`** (pass 22) — sound is the
    one juice channel that ignores `juiceWaves`: a 5-crystal and a
    500 k-crystal mine play the identical clip, and the reward moments
    (combo tier-up, depth milestones, gem pocket) ride generic clips.
    Dedicated synthesized one-shots first, then pitch/loudness
    scaling mirroring `haptics.ts`. Follow-ons: `tier-ambience-variant`
    (one bed per depth tier), then `bed-ducking`, then
    `player-cleanup-remove` (one line — fold into any touch of
    `useSounds.ts`, don't ship alone). No SFX may be purchase-gated.
 7. **`i18n:listing-es` → full listing localization** (passes 10/14) —
    the pre-install conversion item: +30 % downloads from 10+
    localized listings, +128 % for top-10 markets (pass 14 research).
    The listing slice ships with zero app change (Play CLI
    `set-listing --lang`). In-app re-enablement is a separate, larger
    item with four known landmines: the share-badge pixel font has no
    accented glyphs, legal docs are Spanish-titled/English-bodied,
    nothing exercises string length, and the static `<head>` stays
    English. `i18n:formatters` (Intl-based numbers/duration) and
    `i18n:language` (picker + persisted boolean) are its companions.
 8. **Endgame tail, in value-per-line order** (pass 25) — all gated
    on Tier 0 item 3's timing number first:
    + **`achievements:tail`** — data-only: prestige-count,
      legendary-cosmetic, and collection-complete achievement entries
      (the metrics already exist on the save; combo axis also stops at
      250 while t5 demands 500).
    + **`t6`** — a goal that is *not* depth or gems (the only two
      axes that plateau), so the tail gets a named destination;
      second-axis surprise per the prestige canon.
    + **`endless-biomes`** — the cave scroll freezes at 850 m while
      t5's binding target (1 B lifetime) lands at ~2,000,000 m.
    + **`gem-sink:post-max`** — a second post-max gem sink; highest
      design risk of the five (touches the guarded gem balance),
      recommended last.
 9. **Social, cheapest first** (pass 24, social/meta layer) —
    **daily-challenge leaderboard** (the day-key equation is already
    identical for every player — trivially fair, reuses the live
    Pocketbase endpoint) → **community milestone** (guild-lite, the
    solo-player-safe shape that survives a small base) → **friend
    leaderboards / streaks** (≥1 friend streak → +22 % daily
    completion, the Duolingo data point). The global top-10 exists;
    nothing below it does.
10. **Seasonal events → battle pass → narrative layer** (engagement
    layer) — the genre's main re-engagement drivers ("content
    cadence as the retention plan"), but the heaviest items here:
    real windows only (no fake timers), free-earnable rewards
    (guardrail 1), and a battle pass needs a season product type the
    IAP catalogue doesn't have yet. Gated on cohort data from Tier 0.
11. **OS-level "come collect" push / home-screen reminder** (pass 9,
    player-facing layer) — the in-app idle reminder is DONE; the
    OS-level push is the D30+ win-back surface. Earned-grant
    discipline: ask after a success moment, never at launch, single
    shot; track grant rate as a first-class metric; always send value
    (the offline-haul cap is the natural payload); never an empty
    "come back" ping.
12. **Store: rating-prompt bridge + negative-review triage** (pass 10)
    — no Play Core / SKStoreReviewController anywhere; 47 % of
    negative reviews name a specific bug or crash, so pre-launch bug
    triage is half the item. One attempt per month, from a genuine
    success moment; a store-link footer is the web's honest version.
13. **`prestige:currency` / `prestige:ceiling`** (pass 18) — only if
    tier-3 adoption data (Tier 0 items 1 and 6) shows the pure ×N is
    underwhelming; the step-gate is already the genre's strongest
    anti-spam invariant and the 5 B / ×5 ceiling is a content-gate,
    not a bug.
14. **PWA / offline web** (pass 12) — "the one big missing
    web-standard feature — and the most deferrable": manifest +
    versioned service worker. Trigger is a real install/offline
    demand signal; today's absence is low-blast-radius (CDN-cached
    static export, nothing lost on a refresh).
15. **`gamepad`** (pass 13) — trigger-gated on a handheld/desktop
    cohort signal or a player ask; the verb set is already
    one-button-per-verb, the Android leg is nearly free, the iOS leg
    is the only genuine native module.
16. **`offline:clock-hwm`** (pass 17) — deliberately low priority per
    its own sources and per `todo.md`: a monotonic high-water
    timestamp that removes the free 8 h clock-jump farm. Lowest
    impact in the inventory: non-competitive single-player, and it
    doesn't make the clock trustworthy anyway.
17. **`iap:anchor-bundle`** (pass 29, F29.3) — the IAP ladder is
    compressed (4 points, $0.99–$3.99) and has no anchor: the top tier
    is the *best* $/gem and the whole catalogue is bare single items —
    26 rows since `packSkin` landed (the 26th, a $3.99 non-gem feature
    line, sits *at* the $3.99 top, not above it, so it anchors nothing;
    all 25 gem-bearing rows remain bare). The
    gap is the missing high anchor — an honest bundle tier (per-line
    "full set" or a collection pack) whose price sits above $3.99 so
    the bare items read as the cheap path. Trigger-gated on the same
    tier-3 adoption / payer-mix data as item 13: no payer-mix signal,
    no bundle. Constraints (canon + guardrails): real discount only —
    sum of parts > bundle price, no decoys, no fake scarcity;
    every packed item stays earnable in the shop (the 100k-mineral
    converter keeps that floor automatic); price stays band-derived
    from gem cost so store and shop can't drift. Note the structural
    ceiling that motivates it: one-time-only packs cap IAP revenue at
    $63.74 per player ($59.75 at the pass-29 audit, before `packSkin`'s
    $3.99 row), so the mix is ad-weighted by design (F29.4).
18. **`share:clipboard-opt-in`** (pass 30, F30.3) — the game's single
    user-facing share surface (achievement badge share) is a silent
    no-op in any browser without the Web Share API (Firefox desktop
    lacks it; Chrome desktop routes through OS share targets): the
    picker deliberately returns `none` (no silent clipboard write), and
    the tap then does nothing with no visible affordance. Fix: an
    explicit "Copy" action when the API is absent — a visible,
    user-initiated clipboard write, which keeps it inside guardrail 4
    (the rule is against *silent* writes). Cheap (one `pickShareTarget`
    branch + a label string), web-only. Trigger-gated on the
    share-badge/cosmetics demand signal already recorded in
    `docs/todo.md` (or any web-growth bet that raises the desktop-web
    share audience): no share demand signal, no copy button.
19. **`settings:commit-model`** (pass 32, F32.1) — 20 of the 23
    player-writable controls are staged in React state until an explicit
    "Save" button on the *Save* tab (a different tab) is tapped; there is
    no dirty indicator, and closing the app without tapping it reverts
    every settings change silently on the next launch. The three
    remaining controls (mute, keypad, onboarding) persist per change via
    their own `useLocalStorage` keys, and the panel's own comments already
    distinguish the two patterns ("applies immediately (no Save tap) … the
    keypad toggle persists itself") — the codebase knows both models, the
    UI presents them identically. The repo solves exactly this for *save
    data* (the save pill's dirty dot) but not for settings. Fix: per-change
    persistence (the AsyncStorage writers and the merge-over-defaults load
    already exist) or a dirty dot reusing the save-pill pattern. Cheap;
    a silent revert is a bug-adjacent failure, not a taste call.
20. **`settings:portability`** (pass 32, F32.2) — both settings stores are
    explicitly excluded from `SaveData` (the game.ts note: "must NOT be
    folded into this object"), so save-code transfer, cloud restore, and a
    fresh install all start from defaults: operator mix, hard mode, symbol
    choice, range ceiling, keypad, volumes, notation, autosave interval.
    The parse side is already defensive (clamps + merge-over-defaults), so
    this is an omission, not a trust issue (pass 21). Fix shape: additive
    optional fields on the save-code payload (decode already routes
    through `migrateSaveData`/`buildSaveData`, so absent/unknown fields
    are safe both ways); the cloud backup rides the same decision.
21. **`art:cave-crisp` + `art:pixel-crisp`** (pass 31, F31.1/F31.2) —
    the web surface (the first-class monetization surface, Tier 1 #4's
    framing) ships the full-bleed cave as 288 px rows smoothly stretched
    up to ~5× on a desktop monitor, and the same unpinned scaling
    softens every 16×16 sprite at its 2.75× default render size. Fix is
    a property pin (web `image-rendering: pixelated` / native
    `resizeMode: "nearest"`) plus re-baking the cave rows at the measured
    viewport width; web-first, cheap. Trigger-gated on the same
    web-growth bets as #14 (PWA / installability, es-market, any
    desktop-cohort signal): until then the stretch is a taste call, not
    a defect. Companion `art:contrast-audit` (F31.4) is a Tier 1 #2
    input, not a separate ranking item.
22. **`account:web-erasure`** (pass 33, F33.2) — the only
    "delete my data" surface in the app is the SaveTab cloud-backup
    section, which renders only while the *cloud* provider is available
    — never on web — while accounts are a three-platform surface (web
    sign-in is live, and web purchases tag accounts). A web account can
    be created, carry purchases, and yet have no in-app erasure path:
    the server supports account-scope delete from any client, only the
    native client can trigger it. The compliance floor (security-audit
    S4/S6 assumes in-app erasure), and the store-integration release
    gate still cites the button at a component that does not hold it
    ("LegalSection 'delete my data'" — the button is in SaveTab). Fix:
    render the erasure in the *account* surface (gated on the auth
    provider, not the cloud provider); the plain wordings are already
    i18n'd, and the release-gate line needs the stale component name
    corrected. Same-pass companions: `account:erase-signout` (F33.3 —
    a successful account-scope delete leaves the client signed in with
    the dead token until the next launch; sign out after the delete)
    and `cloud:stale-notice` (F33.4 — the stale-push import path
    replaces local progress with the other device's save and no toast,
    unlike the two restore paths that do).
23. **`entitlements:clobber-on-second-purchase`** (pass 39, F39.1) —
    a real bug on the money path, not a feature gap: the entitlement
    row upsert is keyed by `deviceId` alone, so a second, *different*
    pack bought on the same device silently rewrites the first
    purchase's row in place — restore and the verify response return
    only the last product purchased, and the first pack's entitlement
    is gone from the collection. Masked in normal play by the
    device-local entitlement store; surfaces on reinstall or
    cross-device restore, exactly where the server row is the recovery
    source. The webhook suite can't catch it (every scenario mints one
    product per device, and the fake datastore models the *intended*
    pair-keyed semantics, not the code's). Fix is small: pair-keyed
    upsert for `entitlements`, `linkDeviceRows` iterating the device's
    rows, and a two-product regression test against a
    production-faithful fake.
24. **`web:stripe-script-retry-hang`** (pass 41, F41.1) — a real bug on the
    web money path: `loadStripe()` caches its failure badly. When the
    `js.stripe.com/v3` script tag fails once (CDN blip, adblock, flaky
    connection), the error path clears the promise cache but leaves the
    dead script element in `document.head`; the *next* `loadStripe()` call
    finds that same element via `querySelector("script[data-stripe-v3]")`
    and attaches `load`/`error` listeners to a script that has already
    settled — neither event ever fires again, so the promise never
    resolves. `purchase()` hangs at `await loadStripe()` *inside*
    `useIap`'s in-flight guard, whose `.finally` never runs, so the
    in-flight flag stays set and **every subsequent purchase attempt
    returns silently and instantly** — the shop is dead for the page
    session (a reload is the only recovery). The repo already contains
    the correct pattern a file away: `loadGsiScript` (signinSdks.ts)
    creates a fresh element per attempt, sets a load timeout, and rejects
    (never hangs). Fix: mirror it — remove the failed element on error
    (or create fresh per attempt) and add a load timeout. No test can
    catch this today (the web e2e stubs the loader; the unit tests stub
    `window.Stripe` present).
25. **`account:me-network-wipes-token`** (pass 41, F41.2) — a real bug on
    the account path, same class as F39.1 (a destructive local action
    taken on an ambiguous remote result): `storeAuthProvider.me()` returns
    `null` for both "the server said 401, this session is dead" and "the
    network round-trip itself failed" (offline, DNS, the 20 s timeout,
    a dead VPS) — `postJsonWithStatus` folds every transport failure into
    the same `null` as a 401. `useAccount`'s mount-time restore reads
    that `null` as "dead session" and **clears the stored 30-day token**.
    A cold start while offline (or through one VPS blip) silently signs
    the player out on that device — no toast, no way to tell, and the
    server session that was still alive is now unreachable from the
    client until a full re-sign-in. Every other ambiguous-result site in
    this layer is non-destructive (cloud `pull` → "no backup", IAP verify
    → queue, leaderboard → "unavailable"); this is the one place a `null`
    deletes local state. Fix is small: make `me()` tri-state (dead /
    unknown / account — `postJsonWithStatus` already has the status to
    tell them apart) and wipe the token only on `dead` (an explicit 401);
    a 200-with-malformed-body should also stop wiping (recorded, F41.5).

**Context — closed since the passes ran** (so the ranking isn't
re-derived from stale reads): streak grace (it.14), streak freezes +
repair (it.19), day-7 bonus spike (it.15), `cosmetics:analytics`
(it.17), the Collection view (it.23), `offline:active-clock` (it.13),
`math:zero-operand` (it.13), `offline:streak-grace` (it.14),
`math:pending-gain` readout (it.21), number-notation setting (it.20),
`web-ambient-unlock` (2026-09-10, gesture-gate bug-fix in `useSounds.ts`,
commit `49c472f` — Tier 1 #3 is done, see the struck-through entry),
weekly contract, equation of the day, gem pocket, idle reminder, share
images, SFX/music volume controls, music bed, reduce-effects toggle,
statistics detail, cosmetic compendium, `settings:commit-model`
(F32.1 — landed 2026-09-10, per-change settings persistence,
commit `4af0a08`), `settings:portability` (F32.2 — landed 2026-09-10,
settings ride-along on save codes + cloud snapshots, commit
`43cb08d`). All the "deliberately absent" items (interstitials,
fake scarcity, pay-to-win gates, device-motion input, landscape,
voice/social input) are guardrails, not gaps, and stay out of this
ranking.

**Net:** Tier 0 first — items 1–12 are mostly days of work, they are
the guardrail-5 obligation, and they convert the Tier 1 items from
research into a data-ordered queue. Among the real features,
top-of-queue on impact-per-line: **Tier 1 #1 adaptive math, #2 text
scaling, #7 listing localization** (#3, the web audio fix, landed
2026-09-10 as part of the web sign-in e2e bug-fixes); the
endgame tail (Tier 1 #8) stays held until Tier 0 #3 lands its
time-to-t5 number.

## Research sources (per pass)

The passes are cross-referenced against
checklists (ClickerHeroes idle-game roundup, ENEBA best-idle list, G2A
incremental-guide, Edu.com / Reflex math-engagement research, 2026-09;
2026-09 pass 3: GameGrowthAdvisor mobile-retention 2026 benchmark piece,
Mind Studios idle-clicker design/monetization guide, Various Cloud +
GameNeAI mobile-accessibility playbooks;
2026 pass 4: Duolingo streak-system teardown (deconstructoroffun),
PlayIO D1/D7/D30 retention benchmarks 2026, GameAnalytics 2025 retention
report (11,600 games / 1.48B MAU), math-app gamification roundups;
2026-09 pass 5: the idle-game prestige canon — Pecorella "The Math of
Idle Games, Part III" (Game Developer) via a 2026-07 prestige-math/
progression-pacing canon report, MissionsSanx prestige-layer guide,
AppFollow 2026 retention/review-signal workflow;
2026-09 pass 6: monetization benchmarks — GameGrowthAdvisor
F2P-monetization-models comparison 2026 (rebuilt on named datasets:
AppsFlyer 2025–26 monetization analysis, TopOn H1-2025 ad-format data,
Sensor Tower IAP totals, Lancaric hybrid-casual App Store analysis,
Liftoff casual ROAS) and the FTC COPPA 2025 final rule (Federal
Register 2025-04-22, now in full effect) as the S6 kid-safety decision
input;
2026-09 pass 7: first-session / FTUE research — PlayIO "Onboarding
Decides Your D1" (FTUE funnel metrics → D1), LoadoutLore "Skip to
Play" (the tutorial-skip generation, 2026), NastyRodent "Onboarding
and FTUE Design: The AAA Production Playbook" (push vs pull
revelation, minimum viable rule set);
2026-09 pass 8: session structure & the return loop — Vectra Play
"Session Length: Designing for How People Actually Play" (Aug 2026),
gamedesign.gg "Idle and Incremental Game Design" (idle canon: Pecorella
GDC 2016 talk + idle-math blog, Eyal's habit loop, Schell's
anticipation lens, Lantz's decision layers, Alter's stopping cues),
Tideward offline-progression design note (alpha-tested offline UX);
2026-09 pass 9: win-back & the reactivation layer — Helpshift
"Re-Engagement Campaigns for Mobile Games" (2026 playbook: lapse windows,
moment-of-return, reactivation measurement), XtremePush "Gamification
for dormant player reactivation" (Apr 2026: dormancy tiers, comeback
mechanics, cross-channel frequency caps), Pushwoosh game retention case
studies (justDice / Bladestorm / Beach Bum);
2026-09 pass 10: store presence & the pre-install layer —
GameGrowthAdvisor ASO-for-mobile-games guide (Apr 2026, a 50+ launch
studio; qualitative + case studies), Digital Applied ASO-statistics 2026
(collection consolidating AppTweak / Sensor Tower / AppFollow numbers),
the Play Console store-listing-experiments page (official), and the
Play Core in-app-review guide (official);
2026-09 pass 11: stability & the device-quality layer — the
Android vitals docs (user-perceived crash / ANR / excessive battery /
excessive partial wake locks / memory thresholds, official), the Android
developers blog "Battery Technical Quality Enforcement is Here"
(2026-03: wake-lock treatments live) and "Leveling Guide for your
Performance Journey" (2025-11: core-vitals tour, ApplicationExitInfo),
and Bugspulse "Crash Rate Benchmarks by Industry 2026" (consolidates
Crashlytics / Instabug / Embrace numbers; treat magnitudes as
illustrative, as passes 4 and 6 did). Items
adopted from that list move into `docs/todo.md`;
2026-09 pass 12: the web platform layer — the only platform dimension
passes 7–11 left un-audited, and the surface this iteration's Stripe
web-IAP work made first-class. MDN "Making PWAs installable" + "Storage
quotas and eviction criteria" (official), RevenueCat engineering "Can you
use Stripe for in-app purchases?" (2026: the Epic v. Apple carve-out, the
web-checkout conversion dip, cross-device entitlement sync, and the gap
Stripe leaves to a backend), and the 2026 offline-first PWA caching
checklist (MDN service-worker caching guide + the cache-strategy table);
2026 pass 13: the input & control layer — gamedesign.gg "Mobile Game UX
Design" (Hoober 2013 one-handed-hold field data, thumb zones, target-size
canon, the gesture-affordance rule, portrait-for-idle), W3C WCAG 2.2
target-size-minimum criteria (2.5.5 / 2.5.8), the simplified.media Gamepad
API guide (polling model, standard mapping, the handheld / TV-browser
surfaces), the Android / ChromeOS input-compatibility docs, and Rizzo et
al. "Playdate" (IJHCI 2016) on input methods for players with motor
impairments;
2026-09 pass 14: the localization / i18n layer — the CLDR Plural Rules
spec (cldr.unicode.org, primary/standards), AppDrift ASO statistics 2026
(vendor-aggregated listing-localization lifts and the top-10-market
gap), the SimpleLocalize pseudo-localization guide (methodology +
text-expansion estimates), and MDN on the Intl locale seams
(`Intl.NumberFormat` compact notation, `Intl.Locale.getWeekInfo` — Hermes
support flagged, not asserted). Items adopted from that list move into
`docs/todo.md`;
2026-09 pass 15: the math / difficulty layer — what the player is actually
solving; the only layer passes 3–14 never audited (everything the player
does, sees, types, and reads was audited; the content being typed was not).
Tokac, Novak & Thompson "Effects of game-based learning on students'
mathematics achievement: A meta-analysis" (J. Computer Assisted Learning
35(3) 2019, peer-reviewed, 24 studies), the gamedesign.gg flow-theory
reference (Jenova Chen's 2006 USC MFA thesis on the wider flow channel,
DDA, player-directed difficulty — same source family as passes 8 and 13),
Bardy, Holzäpfel & Leuders "Adaptive Tasks as a Differentiation Strategy in
the Mathematics Classroom" (METED 23(3) 2021, open, full text read), and
the Rocket Math automaticity FAQ (the standard accuracy → fluency →
automaticity definition);
2026-09 pass 16: the cosmetics / skin economy layer — the one axis passes
1–15 never audited as a system (the only gem sink with no payback). Sam
Novak "Idle game economy design: don't ask what a sink gives, ask what it
eats" (dev.to / itembase.dev — sinks as converters, the status-vs-reset
prestige split), the gamedesign.gg "cosmetic monetization" glossary
(the visibility thesis, the clarity budget, scarcity management), Xsolla
"Vanity sells: how self-expression drives game revenue" (outward vs inward
vanity, decorative-environment customization, bundle shape),
GameGrowthAdvisor "Game economy design & virtual currency balancing"
(2026-07-14: sink-first design, pinch points, the 5-question audit, the
prestige-sink inflation lever), and Steinnes & Reich "Cosmetics as social
currency" (Procedia Computer Science 2025, peer-reviewed, abstract only);
2026-09 pass 17: the offline / absence math layer — HustleTycoon's
offline-earnings design doc (the cap is the genre contract and the
upgrade target, only automated producers earn offline), GeekExtreme's
idle-math overview (delta-time fast-forward is the illusion; the 30m–2h
check-in rhythm), the two canonical indie-forum clock-cheating threads
(GDevelop "[SOLVED]" + GameMaker: no offline-only counter exists, low
severity outside competitions, cheap client-side high-water marks are the
right trade), and the streak-forgiveness literature (Yu-kai-chou's streak
teardown + the habit-tracker literature: the one-missed-day hard reset is
the #1 burnout trigger, the grace day is the standard fix);
2026-09 pass 18: the prestige / reset math layer — HustleTycoon's
idle-prestige overview (the four reset shapes — soft / hard / tiered /
currency — and the loss-as-investment reframe) and the Godot
incremental-game design guide (token-vs-effect split, the
`floor(lifetime^exp × mult)` curve with exp 0.5–0.8, the `earned > 0`
hard block, the `preview >= 3 && run_time > 1800 s` suggestion floor, the
reset/keep lists). Items adopted from that list move into `docs/todo.md`).
2026-09 pass 19: the numerical curve / pacing layer — Pecorella "Quest
for Progress — The Math of Idle Games, Part I" (GDC Europe 2016, via
Game Developer — the genre-standard `cost = base × rate^owned` model and
the generator-optimality rules) and PaperPilot.dev's idle-balancing guide
(secondary/community: inflation rules — effect growth must stay under
cost growth, caps as controlled inflation, D30+ depth via additive
mechanics). Pass 8 named "interval to next purchase" as unmeasured;
this pass measures it (scratch harness, deleted after the run) and audits
the whole cost/production family as a system;
2026-09 pass 20: the performance / rendering layer — the one layer
passes 3–19 never audited as a system (pass 11 covered the OS-side vitals
deliberately without code; the repo has no performance instrumentation).
The React Native "Performance" docs (official: the 16.67 ms frame budget,
the JS-thread vs UI-thread model, native-driver animations, the
root-re-render cost example), the Play Console app-size page (official,
direction only — no numbers), the Google Play developer blog "Shrinking
APKs, growing installs" (vendor benchmark, 2017: ~1 % install-conversion
per +6 MB APK below 100 MB — treated as illustrative), and Google's 2016
research (53 % of mobile visits abandoned past a 3 s load, via
Marketing Dive — illustrative). Items adopted from that list move into
`docs/todo.md`.)
2026-09 pass 21: the persistence / data-integrity layer — the save blob
is the game (live-audited: the load/save corruption paths, the v11
migration chain, the cloud LWW against the clock-skew literature, the
save-code trust chain; the dependency's entire persistence contract is
one sentence long, which is itself a finding; candidates: the corrupt-
backup surface, the stale-resolution audit event, the save-failure
event, the save-code checksum/sentinel (source: AsyncStorage README +
FAQ + usage docs + the pinned 2.2.0 shipped source (official),
codewithkarani "last-write-wins sync silently destroys user data"
(vendor post-mortem), oneuptime LWW reference (vendor),
cookieclicker.wiki.gg Save (community), three reddit thread titles as
existence signals only (community, secondary)).
2026-09 pass 22: the audio / feedback layer — what the player hears
(live-audited: the SFX trigger map and per-key throttles, the generated
ambient bed's construction, the mute > toggle > two-independent-scales
volume hierarchy, and the pinned expo-audio 57.0.4 dependency contract
— the `createAudioPlayer` memory-leak clause, the iOS silent-switch
default, the Android background lock-screen stop). Sources: the
expo-audio official docs (docs.expo.dev, fetched this pass — the
latest-version page read against the 57.0.4 pin) and Wikipedia "Video
game music" / "Loop (music)" / "Sound design" (tertiary, genre-canon
use only). Items adopted from that list move into `docs/todo.md`.
2026-09 pass 23: the goal / achievement layer — the two retention
axes (live-audited: the sequential goal-tier chain t1–t5 that gates
every major content unlock, the 19 independent one-time-bonus
achievements, the completion effects, the GoalsPanel surface, the
leaderboard achievement upload, and the analytics gap). Sources:
Wikipedia "Achievement (video games)" (tertiary, genre-canon use only,
fetched this pass), with the 2011 DiGRA achievement framework cited via
that article's reference list only. Items adopted from that list move
into `docs/todo.md`.

pass 24 (2026-09-27) closed the social/leaderboard axis — its three social
candidates were **adopted in full: `play-store-review`** (Play Console in-app
feedback → `docs/todo.md`), **`leaderboards`** (one live monthly
leaderboard + season resets → `docs/todo.md`), **`social-compare`**
(passive, no accounts → `docs/todo.md`). Pass 25 (2026-09-28) closed the
final unaudited axis, **endgame / content-ceiling** (the t5→∞ arc, gem
currency, cosmetics, achievements, goals): the end-state exists and is
honest (no hard wall, F25.1), but it is **one-dimensional** — the Motherlode
tier binds on 1B lifetime minerals (a single axis, since depth is derived
from lifetime: at 1B the player is at depth 2,000,000 m, not the 1500 m the
goal names), the cave scroll freezes at 850 m and never moves again, post-max
gems only buy more miners, and the achievement list has zero
prestige/legendary/cosmetics coverage (F25.2–F25.5). **5 candidates**
(`free-path:motherlode-target` (recommended), `endless-biomes`,
`achievements:tail`, `t6`/second-axis surprise, `gem-sink:post-max`) —
none adopted yet. As with passes 22–24, **external genre-canon sourcing
failed this pass too** (Exa rate-limited, 3rd consecutive pass); the
endgame findings were internal-only where they'd otherwise read as
category consensus, and are labelled as such where it matters. **Re-pull
(2026-09-09, after the 3-pass 429 streak broke):** the two endgame
genre-claim lines (F25.3 "satisfying sink", F25.4 "collection-complete
endgame") are now partially sourced — see the re-pull note in pass 25's
source-quality notes. The related unsourced lines in passes 23
(achievement-payback lore — now sourced, with a correction) and 24
(trust-model industry cross-check) were upgraded in the same re-pull.

pass 26 (2026-09-09) closed the last unaudited axis, the **telemetry /
data layer** — the guardrail-5 local analytics record, the on-device crash
diagnostics, and the pre-staged-but-unwired server `events` collection
(the `pb_hooks` write budget and GDPR delete endpoint already treat it as
the future analytics home). The data never leaves the device, by design;
the gap is the missing **opt-in cohort channel** plus a handful of dropped
event kinds and a recorded-but-never-surfaced purchase log (F26.1–F26.5,
F26.6 a canon pin: the crash-first, local-only posture is exactly the
2026 indie-safe default, and its fill-in trigger is guardrail 5 itself).
**3 candidates** (`telemetry:opt-in-cohort` (the big one),
`analytics:readout-completeness`, `analytics:first-ad-kind`) — documented,
not planned; cross-references keep pass 7's FTUE funnel, pass 23's
`analytics:tier-milestone`, and F21.2's failure-class events from
re-listing. Sourced this pass via DuckDuckGo (Exa still 429): the PostHog
analytics docs (event-schema canon, primary vendor docs),
GameGrowthAdvisor's retention-measurement rewrite (same 50+ launch-studio
family as passes 6/10/16 — also the source of a benchmark-freshness flag
against pass 4's top-quartile line, see F26.2), the 2026
privacy-telemetry posture articles, and a crash-vs-analytics ordering
article (vendor; ordering argument only).
2026-09 pass 27: the discoverability / information-architecture layer —
where the features live on the screen and how their arrival is announced
(the one surface the per-axis passes never treated as an axis in its own
right). Feature-discovery content is a vendor category, so this pass's
canon is its thinnest: InAppStory "How to drive new feature adoption"
(vendor, in-app-messaging SDK — the announcement → discovery → first use
→ repeat use cycle, the badge/timing cadence, the minimal measurement
set), UserGuiding "A Guide to Feature Discovery" (vendor, onboarding
SDK — the discovery-vs-adoption split, the tooltip-on-new-icon pattern,
the Flowla one-tooltip-not-a-tour discipline), Boomiestudio "5 UI
Mistakes Killing Your Game's Retention" (independent dev blog — the
Hoober 2014 thumb-zone result, the 44–48 px hit-box canon, the
three-state button state machine, the contextual-UI argument), and the
MissionsSanx idle-game design guide re-fetched (the gradual-unlock
progression line; SEO-adjacent, flagged). Exa still 429; DuckDuckGo per
the re-pull convention.
2026-09 pass 28: the trust / adversarial layer — what a modified
client, a fast clock, and a misconfigured deploy can do (the one
frame no per-axis pass asked). The clock-attack canon is all
vendor or community: bugnet.io's daily-reward clock-rewind fix
(vendor — the Bugnet error-capture SDK, and the article's second
half pitches it; the fix section only was used —
server-authoritative eligibility, wall-vs-monotonic divergence,
offline fail-closed), the Unity Cloud Code "server time
anti-cheat" sample (official docs, JS-heavy page — cited as a
canon pointer only), the GameMaker forum idle-game time-cheat
thread (community practitioner, two visible posts — the
worldtimeapi-ping pattern and its self-avowed offline crash),
and a PocketBase rate-limiting deepwiki page (AI-generated
tertiary over line-referenced source — IP-based, in-memory,
disabled by default). The save-tampering vector taxonomy comes
from guardingpearsoftware (vendor, anti-cheat SDK knowledge
base — the vectors and the prioritization line only). Exa still
429; DuckDuckGo per the re-pull convention.
2026-09 pass 29: the monetization-mix layer — how the IAP
catalog, the ad surfaces, and the gem economy relate to each other
(the one frame passes 6/12/16 each touched from the outside but
never audited as one system; the F29.1–F29.2 numbers are live-code
and deterministic freePath sim measurement, not sourced). The
pricing/monetization canon is all vendor: gamemantra "IAP Pricing
Psychology: Decoy, Anchor, Charm" (vendor blog — anchor-effect and
decoys-vs-trust quotes, the 30–40% bundle-lift claim, no
methodology on the page), SolarEngine "Casual Games IAP
Monetization Strategies" (vendor docs — the 5–7-point ladder
$0.99–$99.99 and the $4.99–$9.99 transaction-share line), cas.ai
"Hybrid Monetization in Mobile Games: A Practical Guide" (vendor
— the 50/50 and 30/70 ads/IAP slots, geo segmentation, 3–4
rewarded/day starting frequency; "no perfect ratio" stated on the
page), and GameGrowthAdvisor "Mobile Game Paywall / IAP Pricing
Optimization 2026" (same 50+ launch-studio family as passes 6/10/
16/26 — the "hard currency must be scarce" framing; fetched, not
cited). All directional, not Tier A; if the bundle candidate is
ever greenlit, re-pull the price claims from a Tier A source.
Exa still 429; DuckDuckGo per the re-pull convention.
2026-09 pass 30: the platform-parity layer — cross-platform parity as
a first-class axis (the first pass to enumerate the feature ×
platform matrix; earlier passes audited axes *across* platforms but
none enumerated parity itself). An internal audit by construction
(the matrix is a property of this repo's provider seams, not
sourceable externally), so every cell was verified against `src/` as
of this commit; the one external anchor is the Web Share API support
context behind F30.3 (MDN `Navigator.share` + the caniuse-lite
`web-share` dataset, via DuckDuckGo after Exa's 429 — the MDN page's
compat table did not render on fetch, so the browser matrix is
context, not load-bearing). New candidate: `share:clipboard-opt-in`
(F30.3) → Tier 1, item 18. Items adopted from that list move into
`docs/todo.md`.
2026-09 pass 31: the visual / presentation layer — the image itself as
a system (every earlier pass audited a channel *around* the pixels —
inputs 13, cost 20, sound 22 — none the channel the player looks at
constantly). Internal audit by construction (F31.1–F31.5 are live-code
as of this commit), so the external anchors are yardsticks, not claims:
WCAG 2.2 contrast criteria (w3.org TR + Understanding pages — the F31.4
measurement yardstick, nothing in the repo is measured against it yet)
and MDN/W3C pixel-art scaling guidance (`image-rendering: pixelated` is
browser-supported since 2020, so F31.1's fix is a property pin, not a
compat bet). New candidates: `art:cave-crisp` + `art:pixel-crisp`
(F31.1/F31.2) → Tier 1, item 19; `art:style-decision` (F31.3) and
`art:contrast-audit` (F31.4) stay candidates, trigger-gated.

2026-09 pass 32: the settings / player-control layer — the set of things
the player can tune about their own experience, and what happens to a
changed control (pass 3 audited the accessibility gaps *in* this surface,
pass 13 the input methods *around* it, pass 27 where features sit on
screen; none audited the *lifecycle of a control change*: what "the player
changed it" means for durability and portability). Internal audit by
construction (F32.1–F32.4 are properties of this repo's settings stores
as of this commit; the stores are small enough that every cell was
verified against `src/`). The one external anchor is the pattern shape:
the `formdraft` README (a vendor package — the stock form-draft
persistence stack: per-change localStorage persistence + restore-on-mount

+ status indicator; used for F32.1's fix shape, not as a claim about this
game). New candidates: `settings:commit-model` (F32.1) → Tier 1, item 20;
`settings:portability` (F32.2) → Tier 1, item 21; `settings:min-floor`
(F32.3) rides along on Tier 1 #1. Items adopted from that list move into
`docs/todo.md`. (Both settings items landed 2026-09-10 — see the
"Context — closed" list in the ranking.)

2026-09 pass 33: the account / session layer — the surface passes 21,
24, 26 and 28 each audited one axis of (local persistence,
leaderboard, telemetry, adversarial posture), and the account surface
itself got a single pass-30 matrix row (the sign-in mechanisms) —
none audited the *session lifecycle* or the data plane a session
tags. Internal audit by construction: F33.1–F33.4 are properties of
this repo's account / data-plane wiring as of this commit (`auth.ts`,
`useAccount.ts`, `useCloudSave.ts`, `SaveTab.tsx`, the `pb_hooks`
endpoint contract) — no external sources, no external claims. New:
`account:web-erasure` (F33.2, with the `account:erase-signout` F33.3
and `cloud:stale-notice` F33.4 companions) → Tier 1, item 22;
`account:web-value` (F33.1) stays a candidate, trigger-gated.

2026-09 pass 34: the content & data-authoring layer — what
"adding one thing" (a pack, a cosmetic, a string, a save) actually
touches. Internal audit by construction (the same class as passes
30–33): F34.1–F34.3 are properties of this repo's authoring / sync /
persistence wiring as of this commit (`iaps.ts` + `stripe/price_sync.mjs`

+ `scripts/stripe/catalog.json`, `i18n/en.ts`/`es.ts`/`i18n.ts`,
`useLocalStorage.ts`, the custom-skin store, `analytics.ts`) — no
external sources, no external claims. Headline: the content-authoring
path is one of the best-netted surfaces in the repo — the catalog is
pinned five ways, the i18n tables exactly, the cosmetic-name i18n, the
sound-asset naming + existence, and the save migration; the gaps are
the one catalog copy that lives in a markdown ops table and the one
placeholder price that passes every shape check. New candidates, both
Tier 2 and both riding the pending `pack_skin` release step:
`docs:sku-table-sync` (F34.1) and `release:price-placeholder-net`
(F34.3). F34.2 is not a defect but the rule the pass found (version
what crosses a process boundary, normalize what doesn't) — recorded so
the next cross-boundary state makes the call consciously. Items adopted
into a tier list move into `docs/todo.md`.

2026-09 pass 35: the release / distribution pipeline — the layer the
build passes through to reach a player: `expo export` (web) / prebuild +
gradle (AAB) → version bump → gates → deploy (`wrangler` / the Play
Developer API). Passes 10 and 12 audited *around* it (store presence,
the web platform); none walked the pipeline itself. Internal audit by
construction (the same class as passes 30–34): F35.1–F35.3 are
properties of this repo's build / gate / deploy wiring as of this
commit (`package.json` scripts, `app.config.ts`, `wrangler.toml`,
`pnpm-lock.yaml`, `.github/workflows/`, `scripts/play/` +
`scripts/stripe/`, `plugins/withDebugSigning`, `e2e/web/`) — no external
sources, no external claims. Headline: the gates are well-netted where
they exist (the web e2e runs against the REAL `expo export` build, the
prebuild input is byte-for-byte reproducible, store-critical config is
pinned by `storeConfig.test.ts`, the disabled gates are labelled and
tracked); the gaps are the one unpinned deploy binary, the one
doc-only shape rule, and one self-contradicting bump instruction. New
candidates, all Tier 2: `release:wrangler-pin` (F35.1),
`app:route-only-net` (F35.2), `release:version-doc` (F35.3). Items
adopted into a tier list move into `docs/todo.md`.

2026-09 pass 36: the web discoverability / search layer — how a
player who does NOT yet have the app finds it (the search-engine &
ad-network contract the static export presents: ads.txt, robots.txt,
sitemap, canonical, Open Graph, JSON-LD), and what that surface is
netted by. Passes 30/32/33/35 touched this layer from the *inside*
(serving the web platform, settings, session, deploy pipeline) but
none audited the *outward contract* a crawler or ad network sees. Internal
audit by construction (the same class as passes 30–35): F36.1–F36.3
are properties of this repo's web export as of this commit (`public/`,
`src/app/+html.tsx`, the exported `dist/`, `app.config.ts`) — no
external sources, no external claims. Headline: the one-off "add an
ads.txt" and "improve seo" todo items LANDED this pass (ads.txt at the
export root; canonical/OG/Twitter/JSON-LD in `+html.tsx`; robots.txt +
sitemap.xml + og-image.png at the export root) — all verified in the
exported `dist/`. The remaining gaps are the ones the repo CANNOT net
alone (console/account verification in Google & Bing Search, the
AdSense approval — human, out of jest) plus one shape-net the export
lacks: nothing asserts the export root ships a well-formed ads.txt /
robots.txt / sitemap.xml (F36.2). No new Tier 1: discoverability is a
pre-install lever that only pays after there is something to find (no
search traffic exists before the release), so it stays Tier 2,
trigger-gated on the first production web release. Items adopted into a
tier list move into `docs/todo.md`.

2026-09 pass 37: the numeric ledger layer — where a value crosses a
Number/BigInt boundary and what happens to its precision. Pass 19 audited
the cost curves as pacing, pass 21 audited the save blob as persistence;
neither asked which number TYPE carries the value. Internal audit by
construction (the same class as passes 30–36): F37.1–F37.3 are
properties of this repo's economy code as of this commit (`game.ts`,
`useGameEngine.ts`, `saveCode.ts`, `utils/format.ts`, `freePath.ts`) —
no external sources, no external claims. Headline: the design is
strong and no player-visible defect — three bigint counters (minerals,
lifetimeMinerals, maxDepth; minerals went bigint at save migration v10)
with ONE exact float bridge (`mulFloats`, scale-100 half-up), shared
decimal-string serialization across the three persistence surfaces, and
exact-integer bigint formatting in both notation modes. The gaps are
nets, not bugs: the bridge's multiple-of-0.01 invariant is asserted
nowhere (F37.1), the one unclamped field in `buildSaveData` is the gem
wallet (F37.3), and the number-typed quartic costs cross 2^53 at level
9742 — internally consistent, recorded for a future content pass
(F37.2). No new Tier 1. Items adopted into a tier list move into
`docs/todo.md`.

## The gap layers (formerly `docs/features.md` §7)

Cross-checked against the idle/clicker genre roundups and math-game
engagement research listed under "Research sources (per pass)" above.
**None of the open (non-struck)
items exist in the codebase** (verified against `src/` on each pass; DONE
items are struck through with their iteration and carry a short
implementation note). Ranked rough order of genre-impact; anything picked
up goes into `docs/todo.md`.

### Engagement / progression

+ ~~**Weekly / monthly challenges**~~ — **DONE 2026-09** (todo "weekly
  challenges"): the weekly contract — 3 delta-goals on monotonic lifetime
  metrics with a flat weekly mineral bonus, derived-state progress via a
  week-start baseline snapshot, real weekly window, free-earnable reward
  (`mines_of_doom/weeklyChallenge.ts`, `hooks/useWeeklyChallenge.ts`,
  `components/WeeklyContractButton.tsx`). See §2 "Weekly contract". The
  monthly cadence stays open if it ever earns its place.
+ ~~**Daily rotating challenge equations**~~ — **DONE 2026-09-07** (todo
  "daily equation"): seeded day-key equations in `utils/math/equations.ts`
  (`hashString` + `mulberry32` + `getSeededEquation`), flat-bonus solve
  reward with penalty-free wrong answers (`mines_of_doom/dailyEquation.ts`).
  See §2 "Equation of the day".
+ **Seasonal / limited-time events** — the genre's main re-engagement
  driver (real-time events, event cosmetics). Note: real limited windows
  only — the no-fake-scarcity guardrail forbids fake timers, and the
  F2P-viability guardrail means event rewards must be earnable free.
  Pass 3 adds the *cadence* angle: the 2026 retention piece treats
  "content cadence as the retention plan" — a 2–4-week update rhythm
  players can anticipate, planned during soft launch, not retrofitted
  when the day-30 cohort hits the content wall. Candidate, not planned.
+ ~~**Day-7 reward spike**~~ — **DONE 2026-09** (iteration 15,
  autonomous no-signal pick; the retention research's cost-to-skip
  anchor): `getDailyBonus` keeps the linear ladder through day 6 and
  pays the flat `DAILY_MILESTONE_BONUS` (250k) on streaks 7+ — pinned by
  test to be worth *more than days 1–6 combined* (210k < 250k). The cap's
  meaning flips from "bonus stops growing" to "milestone kicks in": a
  lapsed streak now costs 250k/day, not a 70k rung, which is the anchor
  the linear ladder lacked. Days 1–6 are unchanged, and the free-path /
  cosmetic benchmarks consume `getDailyBonus` unchanged with lower-bound
  assertions (their sim's day-7+ income only grows). Pairs with the pass-
  17 streak grace (iteration 14): the grace is the mechanic that lets a
  streak *reach* day 7; the spike is the prize that makes keeping it
  worth it.
+ ~~**Streak protection (freezes / repair)**~~ — **DONE 2026-09**
  (iteration 19, autonomous no-signal pick; the Duolingo teardown's
  core-of-the-streak safety nets): the streak grace (iteration 14) is
  now the first of three nets in `dailyBonus.ts` — behind it, a stock
  of up to `STREAK_FREEZE_CAP` (3) streak **freezes**, earned passively
  one per `STREAK_FREEZE_EVERY_DAYS` (7) streak day (day 7, 14, 21…
  claims — keeping the habit IS the earning, so they're free by
  construction, guardrail 1) and consumed silently on a one-day gap,
  surfaced retroactively in the claim toast (no popup drama, per the
  finding). If both are spent the streak resets as before, but a reset
  that lost `STREAK_REPAIR_MIN_DAYS` (3)+ records a snapshot and the
  next local day's claim (the 24h window) can **repair** the streak to
  lost+1, once per rolling `STREAK_REPAIR_COOLDOWN_DAYS` (30). All
  counters are real and bounded (guardrail 3); every new state field is
  optional, so no migration. `computeDailyClaim` now reports
  `bridge: "grace" | "freeze" | "repair"` + `earnedFreeze`; the hook
  picks the matching toast (`toast.dailyBonusGrace/Freeze/Repair`), the
  button's a11y label carries the freeze count (`a11y.streakFreezes`),
  no new pixels in the menu row. Tests: `dailyBonus.test.ts` (streak-
  freezes + streak-repair describes, 33 total). Pairs with the day-7
  spike above (the spike is now what a repair restores) — milestone-day
  ceremony stays open as its own item.
+ **Narrative / character layer** — the idle-genre design guide (Mind
  Studios) lists narrative as a first-class retention lever: a story
  that unfolds as levels unlock, characters with goals we'd want to
  check back for. We already have the scaffold (depth tiers, cave
  themes, miner characters, outfits) with no story on top of it — a
  lightweight "cave lore" flavor layer (per-depth flavor text /
  encounters) would be the cheap version. Candidate, not planned.
+ **Battle pass / season pass** — the 2026 idle roundups list battle
  passes alongside events as a top retention driver. Heavier than the
  events item above: it is a *structured* season (fixed real window,
  tiered rewards, a free track — a paid-only track would break the
  F2P-viability guardrail) on top of the weekly contract cadence, and
  the current IAP catalogue is strictly one-time products (no
  recurring/season product type exists yet). Candidate, not planned.
+ **Deeper automation layers** — the genre's core loop is "check
  progress → spend → unlock automation → hit a wall → reset"; our
  miners automate minerals but every equation is still solved by hand.
  An automation layer that changes HOW the game plays (not just rate)
  is the genre-standard next step — with a hard caveat: auto-solving
  equations would hollow out the active math loop the whole game is
  built on, so any candidate has to automate around the equations
  (e.g. goal-directed resource routing), not replace them.
+ **Multi-layer prestige / ascension** — single multiplier bank (6 levels);
  big idle games add a second meta-axis (ascension points → new tree).
  Bigger design lift than the single-shaft reset. Pass 5 pins the shape
  against the prestige canon (Pecorella, "The Math of Idle Games, Part
  III", via the 2026-07 canon report): two families — **lifetime-stats**
  (Cookie Clicker heavenly chips; currency from cumulative earnings) vs
  **since-reset** (Egg, Inc., Clicker Heroes; fresh currency per run —
  rewards active play, staircase tiers). Ours is lifetime-stats, and a
  **finite fixed table** (6 thresholds, ×1 → ×5) rather than a curve: the
  canon's steepness table (Realm Grinder quadratic → 4× the previous run
  to double currency; AdVenture Capitalist √ → 3–4×; Cookie Clicker ∛ →
  8×; Egg, Inc. 1/7-power → 128×) is the cost of another reset — ours
  costs nothing once a threshold is hit, and the top level makes the
  prestige axis *end* (canon: "when prestige is over, players leave").
  Its named countermeasure is a **second-axis surprise** (AdVenture
  Capitalist's Angels, Paperclips phase shifts) so a reset reads as a
  new game, not a taller one — that is the concrete candidate shape
  for this item, layered on the existing single bank, and it's where the
  narrative-flavor layer above would attach (prestige as the story
  beat, not just a number).
+ ~~**Random in-game events**~~ — **DONE 2026-09** (todo "random
  in-game events"): the gem pocket — a rare tap-to-collect bonus node in
  the cave (`gemPocket.ts`, `hooks/useGemPocket.ts`, rendered in
  `components/MiningCanvas.tsx`). See §2 "Gem pocket". Pass 5 (canon):
  the genre's variable-ratio "spice" — Cookie Clicker's golden cookie,
  5 %/min spawn, 13 s lifetime, weighted rarity — is the canon's
  dopamine-schedule pattern; our pocket sits at the same spawn order
  (1/120 per 1 s ≈ 5 %/min, 30 s lifetime), so a rarity-weighted pocket
  pool is the documented growth path for this item if it's ever picked
  up.
+ **Adaptive difficulty / mastery tiers** — pass 4. The equation
  difficulty is static per player setting: a number range + optional
  hard mode, chosen once in settings and unchanged by performance.
  The math-engagement research line (spaced-repetition / mastery apps)
  frames difficulty as *per-skill and adaptive*: track performance
  per equation type and step the range/shape up as a type is mastered,
  with a mastery marker (tier up) as the visible reward. `equations.ts`
  is pure and already shapes equations per type, so tiers per type
  (e.g. correct-answer rate on the last N) slot in without touching the
  active loop — hard caveat from the automation item: this must
  challenge, never replace, hand-solved math; the player-set range
  stays the ceiling. Candidate, not planned.
+ ~~**Cosmetic compendium / collection**~~ — **DONE 2026-09**
  (iteration 23, autonomous no-signal pick; the pets-and-creatures
  pattern's completeness surface, the item's own "cheap candidate"
  shape): the menu sheet's new **Collection** view shows every catalog
  line with owned vs. not-yet and per-group/total progress — pickaxes
  (sprite thumbs), outfits (the shop's fixed-seed preview sprites),
  cave themes (tint swatches), and achievement badges (icon + bonus) —
  owned ✓ / equipped ✓ / gem price for the rest. Pure derivation over
  the save (`getCollection` in `collection.ts`, same spirit as
  `records.ts`: the IAP entitlement record stays a purchase record, not
  an ownership source; achievement "ownership" is the same
  derived-from-lifetime-stats completion the Goals panel uses), the
  panel (`components/CollectionPanel.tsx`) is a dumb read-only renderer
  — no buys, no equipping (the shop keeps its single-surface contract),
  so it can't drift and nothing migrates. Menu wiring: one more
  `MenuNavButton` (`menu-tab-collection`), `menu.collection` / `en`+`es`
  copy, tests in `__test__/collection.test.ts` (group order/ids, fresh-
  save defaults only, equipped marking, derived achievement completion,
  foreign-id immunity).
+ ~~**Statistics detail**~~ — **DONE 2026-09** (todo “statistics detail”):
  the records panel now carries a lifetime “Time in the mine” row and a
  per-session block (minerals, answers, active time since launch) —
  see §2 “Local records”. (No export; that was never the ask.)

### Accessibility (2026-09, pass 3)

None of these exist today except where noted; the 2026 accessibility
playbooks rank text scaling and separate audio channels as the
low-effort/high-impact first tier, so this section is in that order.

+ **Text size / UI scaling** — `styles.ts` hard-codes `fontSize: 11–12`
  everywhere; nothing scales with the OS font setting. The cheapest
  high-impact item in the playbooks: a settings row with ~3 scale
  steps applied as a multiplier at the style layer.
+ ~~**Independent music volume**~~ — **DONE 2026-09** (iteration 16,
  autonomous no-signal pick): the bed no longer rides the SFX level —
  `settings.musicVolume` (0–100, default **50**, which is exactly the
  old half-level law's default experience for a 100% SFX player) sets
  it on its own independent scale via `clampMusicVolume` /
  `musicLevel(musicVolume)` in `game.ts`; a parallel 10%-step settings
  row next to the SFX row (`components/SettingsPanel.tsx`), the menu
  mute toggle still pauses the bed outright, and old settings get the
  default through the `{ ...defaultSettingsData, ...parsed }` merge
  (no migration — the settings key is unversioned like soundVolume's
  precedent). Pinned by `game.test.ts` (clampMusicVolume + the new
  1:1 `musicLevel` semantics).
+ ~~**Native reduce-motion / manual kill switch**~~ — **DONE 2026-09-08 (iteration 22, autonomous, no signal)**:
  `settings.reduceEffects` (default **off** — it's a kill switch, so the
  effects stay on for everyone by default) is OR'd into
  `useAccessibilityReduceMotion` as the hook's new manual argument and
  drives the same single boolean in `MinesOfDoom.tsx` that already gates
  the debris, combo flash, gem-pocket pulse, miner bobbing and
  save-pill pulse — so the web-only `prefers-reduced-motion` coverage now
  extends to native (RN still has no reduce-motion API) AND web players
  get a manual off. Settings row beside the haptics row (the pass-13
  note's "persisted boolean beside the reduce-effects row" it referenced
  is now a real seam), `en`/`es` strings, no migration (the settings
  merge supplies the default). Tests: `game.test.ts` (default + merge)
  and `useAccessibilityReduceMotion.test.ts` (toggle / OS / live-change
  matrix).
+ **High-contrast / color-independence** — no high-contrast mode, and
  a few states are color-leaning (vein/gem-pocket discovery reads
  largely from the node's look on the canvas). Playbook baseline: never
  convey meaning by color alone; we'd audit the canvas cues and add a
  contrast step to the same settings row as text size.

### Benchmarks (pass 4 — the guardrail-5 instrumentation gets targets)

Cross-genre retention medians to benchmark against (guardrail 5 already
mandates first-time-ad-view / IAP / D1 / D7 logging before UA spend;
these are the numbers to compare that data to):

+ **D1 median ≈ 22 %** (GameAnalytics 2025 report, 11,600 games /
  1.48 B MAU); top quartile 25–27 % Android, 31–33 % iOS. A 2026
  cross-genre piece (PlayIO) puts D1 ~26 %, **D7 ~10 %**,
  **D30 ~3–4 %** medians; top quartile D7 20 %+.
+ The same piece frames the stages: **D7 is a habit problem** (does the
  daily-goal/reward cycle give a reason to come back — we already carry
  the daily bonus, weekly contract, and daily equation in exactly that
  slot) and **D30 is a depth + LiveOps problem** (meta-gameplay that
  doesn't run out; a live-ops calendar to come back *for* — the
  seasonal-events and battle-pass items above are the D30 answers).
  Arcade fades fast; puzzle/board/idle "frequently match or beat
  RPG-level numbers at D7 and D30" — the most favorable genre fit for
  a math-idle.
+ **Name the retention definition before comparing** (AppFollow 2026):
  classic retention counts players active on *exactly* day N; rolling
  counts day-N-or-later and always reads higher — a top reason two
  studios quoting "D7" disagree. `analytics.ts` carries the raw events;
  state the definition when the D1/D7 numbers land. Same piece's churn-
  diagnosis workflow, which the dashboard can't do: track store **review
  / rating themes per app version** — economy complaints, repetitive
  events, and first-session (FTUE) friction surface in reviews *before*
  cohorts explain the drop, and FTUE difficulty spikes are a named D1
  driver (the onboarding overlay + skip is the current FTUE surface).
  Cheap habit: when a cohort drops, read the review window of the
  release that shipped before it (`pnpm run play` covers listings,
  not reviews — that leg is manual until the CLI gains it).

### FTUE / first session (pass 7 — the D1 driver the benchmarks named)

Pass 4 named "FTUE difficulty spikes" a D1 driver but never audited
our FTUE surface against first-session research; this pass is that
audit. The current surface: a **4-step static overlay before the first
dig** — three text tips (equations, combo, miners) plus a first-time
setup step (equation types, × / ÷ symbols, keypad style) — skippable
at any point, dismissal persisted as a single boolean
(`components/OnboardingOverlay.tsx`; the flag is the ONLY onboarding
telemetry that exists — no per-step or per-event data). The 2026
first-session literature's shape: **tutorial ⊂ onboarding ⊂ FTUE**
(FTUE = everything from launch to a working mental model of the game,
~10–60 min; the tour is one implementation, not the discipline);
mobile players get ~2–3 minutes to prove value, **core gameplay
within 60 s of install**, an "aha" within 90 s; studios shipping
isolated pre-game tutorial sequences see ~40 % hour-one drop-off, and
the fix is teaching woven into early play, not a better tour.

+ **FTUE funnel instrumentation is absent** — the pass-7 metrics to
  add (guardrail 5's first-class D1 input): time-to-core-gameplay
  (baseline 60 s), **per-step drop-off** ("12 % leave at step three"),
  tour completion rate, first-session length, and **session 1→2
  conversion** — the literature's direct leading indicator of D1. Read
  as a step funnel, never as an average. Today the dismiss flag
  can't even say WHICH of the four steps churns. Cheap first step:
  the events into the existing `analytics.ts` local logger; the
  numbers are what decide whether any of the items below are worth
  doing.
+ **The current tour is the research's anti-pattern** — four
  front-loaded static text screens *before* play are the exact
  "static text box / training room" pattern the skip-generation
  literature blames for the Pavlovian skip (players trained on
  2000s–2010s forced tutorials now skip on instinct, often before
  reading the prompt). The same literature caps the first-run tour
  at **two steps** and prefers **pull revelation** (contextual,
  state-triggered hints — the tooltip appears when the thing becomes
  relevant) over push (modals: "skipped often, remembered poorly").
  The three tips are the natural demotees: a nudge when the combo
  first ignites, when the first miner first becomes affordable, when
  the first depth change fires — in-world, one contextual hint each,
  no tour. Candidate, not planned.
+ **The setup step vs. the "defer settings" rule** — the first-time
  setup BEFORE the first dig was an explicit prior todo; first-session
  research says defer settings until after the first win and land the
  aha within 90 s. A genuine tension between the two sources, not a
  bug in either. If this is ever picked up, the funnel item above is
  what decides it (dismiss → first-solve time per path); a possible
  middle: keep setup, but after the first solved equation rather
  than before the first dig. Candidate, not planned.
+ **Design the skip path, not just the skip button** — "a skip that
  dumps a genre-experienced player into a HUD with zero context is
  its own churn source." Our skip goes straight to the full HUD; the
  equation + keypad IS the minimum viable rule set (the idle-math
  analogue of the playbook's "match three, get a reward" example), so
  the exposure is smaller than in a system-heavy game — but the 2026
  personalization trend (even a two-way **veteran-vs-new** split
  "measurably cuts early churn") has a ready-made signal here: a
  returner with a save, or a fast Skip tap, is the veteran. Candidate,
  not planned.
+ **End-of-first-session hook** — research wants a visible early
  milestone (a first goal, a level-up) plus a reason to come back by
  the end of session 1. Ours: goal tier t1 is the first milestone in
  reach, the daily bonus is the return hook, a day-1 push would be
  the bridge (pairs with the home-screen widget item). Likely
  sufficient on paper; the funnel item is what confirms it. Not a
  candidate by itself.

### Session structure & the return loop (pass 8 — the unit players actually play)

Passes 3–7 audited content, onboarding, revenue, and compliance; none
looked at the unit the player actually experiences: the session, and the
moment of return between sessions. Two of the 2026 session/idle
literature's prescriptions turn out to be met by construction (pinned as
canon below, not gaps); the rest are candidates.

+ **The offline return is applied silently, not designed** — the 8 h
  offline cap (`game.ts`: 8 h max + 2 h rewarded top-up,
  `computeOfflineMinerals` / `computeOfflineTopUpMinerals`) pays the
  lump straight into `minerals` on load; the only return-moment
  surfaces that exist are the two rewarded-ad offers (double the haul /
  +2 h top-up when the cap was hit). The genre guide is explicit about
  the missing piece: "treat the return screen as designed content, not
  a receipt" — show the elapsed time, show the lump earned in a
  satisfying tick-up, and **immediately point the player at what that
  windfall can now buy**; that handoff ("here is what accumulated" →
  "here is the next thing you can afford") is what converts a check-in
  into a session. The ad-offer placement at the return moment is
  canon-correct (the cap creating the scarcity the ad relieves is the
  genre's standard shape), but the base windfall has zero ceremony. The
  cheap version: a one-tap "while you were away" card — away time, the
  haul, and one line naming the next purchasable upgrade; every number
  is already computed at load. Real counters only, never inflated
  (guardrail 3). Candidate, not planned. Pairs with the FTUE pass's
  session 1→2 conversion metric — this card would be the day-2 opening
  beat.
+ **Session length is an accident, not a decision** — the 2026
  session-design piece: most mobile sessions last a few minutes
  squeezed into queues and commutes; the session length is a decision
  "that half the design flows from" and should be recorded in the
  design doc, checked by three questions: how long is a session in
  this design and why does that fit the player; what happens when the
  app is killed mid-play; where are the natural stopping points and
  what pulls the player back tomorrow. Ours answers two of the three by
  construction (autosave + the offline haul make a mid-play kill
  free; the daily bonus, weekly contract, and daily equation are
  ready-made stopping points and return hooks — the exact "tidy
  stopping point + a reason to come back" heartbeat) but the first
  answer, a session length with a rationale, exists nowhere in the
  docs. The FTUE pass's first-session-length metric generalizes to the
  full session-length distribution in `analytics.ts`; that number is
  what validates the recorded decision. Candidate: a one-paragraph
  session-design note in this doc + the session-length measurement.
  Discipline, not a feature.
+ **The "time to next purchase" invariant is unmeasured** — canon
  (Pecorella's idle math, the pass-5 prestige report's source):
  tune production against cost so the *interval* to the next
  meaningful purchase stays roughly constant even as the numbers
  explode — "players feel the interval, not the magnitude." Production
  outrunning cost makes everything buyable at once (anticipation
  collapses); cost outrunning production is the wall. Our
  cost-scaled upgrades are the interval the whole game runs on, and
  the pass-4 D30 "depth" problem is most likely an interval that has
  stretched past the comfortable band at depth. Cheap measurement (the
  pass-5 instrumentation discipline): from a few sample saves at
  different depths, log time-to-next-affordable-upgrade over a few
  days; the pass-4 churn workflow (review themes per version) gets a
  concrete pacing signal to match complaints against. Candidate, not
  planned. *(Pass 19 measured this invariant for the free persona with a
  temporary instrumentation harness; the interval distribution landed in
  the pass-25 free-path section. The measurement itself stays a candidate.)*
+ ~~**The number notation is a fixed ladder**~~ — **DONE 2026-09**
  (iteration 20, autonomous no-signal pick): exactly the cheap version
  as researched — `settings.notation` ("compact" | "plain", default
  "compact" so old saves look unchanged) cycles from a settings row
  whose button is a live sample of 1,234,567 in the current mode
  (compact "1.23M" ↔ plain "1,234,567"); `clampNumberNotation` in
  `game.ts` (junk falls back to the default, pinned in game.test.ts),
  no migration through the settings merge. Plumbing follows the i18n
  locale-store precedent: a tiny store in `utils/format.ts` (get / set
  / subscribe, no-op on same-value sets) that `formatNumber`'s default
  second argument reads, so none of the ~70 display call sites thread
  it; MinesOfDoom syncs the settings value in and subscribes via
  useSyncExternalStore, so a flip re-renders the tree in place
  (counters, costs, records, share badges — everything). Plain mode
  mirrors compact's value law exactly (floored, non-finite via
  toString; bigint through the string route so absurd values stay
  exact). The i18n table stays key-pinned (en + es). Candidate that
  stays open: the scientific-notation step, if a player ever asks for
  it.
+ **Canon pin (confirmed correct, not gaps):** (1) the automation arc
  — the genre's shape is click → generator → auto-collection → pure
  optimization, and our deliberate inversion (equations stay
  hand-solved forever; miners automate only the minerals) is the seam
  the pass-4/5 "deeper automation layers" item already guards; (2) the
  rewarded offline cap — "watch for the +2 h top-up once the 8 h cap
  is hit" is the genre's standard return-moment offer, already
  shipped per plan §5.1. Same sources name the two long-game failure
  modes to watch: the **progression wall** (cost outruns income,
  hours with nothing meaningful — the time-to-next-purchase
  measurement above is its early warning) and **clicker fatigue**
  (the input becomes tedium — for us the combo/tap axis flattening
  out, where the pass-4 adaptive-difficulty item is the cure once it
  lands).

### Win-back & the reactivation layer (pass 9 — the funnel segment after D30)

Passes 3–8 documented the funnel from install to D30 and the return
moment between sessions; none looked at the player who churned and the
layer that wins them back. This is that audit. Source-quality note up
front, per the pass-6 discipline: the CTR / opt-in numbers below are
vendor case studies (single-studio anecdotes, no dataset named) — the
DIRECTION (event-triggered and localized push massively out-earns
generic "we miss you"; value-selling at the permission prompt) is
consistent across all three sources, but treat the magnitudes as
illustrative, and keep guardrail 5's local logging as the only honest
number, exactly as pass 4 did for retention.

+ **The offline cap quietly kills the long-lapsed return haul** — the
  strongest win-back asset this game already has is the offline haul
  (the mine kept working while you were away). The 8 h cap
  (`game.ts: maxOfflineTicks`) makes a 3-day-lapsed return *no better
  than a 20-hour one*: both land the same capped lump, so the lapsed
  player has no windfall to arrive at and no new reason to be here.
  The genre's offline design (the Tideward offline-progression note
  pass 8 read: real offline rewards, no ad-gates) treats the haul as a
  designed return experience. The cheap fix is NOT a bigger cap (that
  would change free-path pacing `freePath.ts` polices) but an explicit
  **welcome-back state**: when absence exceeds N days, the load screen
  shows away time, the capped haul, the next purchasable upgrade, and
  frames the cap as the reason-to-be-back ("your miners hit the cap
  while you were gone") rather than a ceiling. The rewarded
  double/top-up offers already live at exactly this moment (canon,
  pinned in pass 8); this is the base ceremony for the long-absence
  case the pass-8 "while you were away" card doesn't cover (that item
  is the sub-8 h case). Candidate, not planned. Extends the pass-8
  item.
+ **The streak reset is a demotion at the return moment** — the
  reactivation research names tier degradation as a top re-churn
  driver ("a player who left at Gold returning to Bronze loses
  motivation before they place a single bet"). Ours is the same shape:
  after any break the daily streak is day 1 again (`dailyBonus.ts` — a
  lost streak "never costs progress", but the return screen shows a
  SMALLER daily bonus than the one they had), and it is the first
  number a returning player reads. The streak-protection item above
  (freezes / repair, Engagement section) is the mechanic-side fix; this
  is the reactivation-side framing of the same item — a streak that can
  survive or be repaired is itself a return hook, and the day-7 spike
  is the return *prize*. Three items, one root cause: the return state
  reads as a downgrade. Candidate, not planned.
+ **Re-engagement is three-layer and we have zero of the layers** —
  the 2026 playbook splits re-engagement into the **channel layer**
  (push / email / retargeting), the **moment-of-return layer** (the
  designed first 90 seconds: progress recap, what's new since the last
  session, optional re-onboarding, friction removed), and the
  **retention layer** (return rewards, returning-player missions, the
  re-established habit). Ours: channel — absent (no
  `expo-notifications` anywhere; the home-screen-widget item in
  "Player-facing surfaces" is the blocker, and its pass-3 permission
  reality — an earned grant after a success moment, never at launch —
  still applies); moment of return — absent (the lapsed player gets
  the same home screen as a 3-minute player; the pass-8 card item is
  the start of this layer); retention — partially by construction (the
  weekly contract still owes this week's delta goals IF the return is
  inside the same real week — a genuine in-game stake; the daily
  equation has rotated; the goal tiers advance). The playbook's
  ordering for a solo-scale game: moment of return first (no
  permission, no channel, pure in-app), channels last.
+ **Lapse segmentation can ride on state we already have** — the
  research is emphatic: segment by behavior, not days-since-last
  (short-term dormant 7–30 d → low-friction hook; mid-term 30–90 d →
  re-onboarding with easy wins; long-term 90+ d → treat as near-new,
  lead with what CHANGED, not continuity; reward scales with
  dormancy length). The named leading signals all precede inactivity
  (session-depth decline, progression stall, missed cadence) and ours
  are all derivable from existing state: `analytics.ts` events,
  lifetime stats, the weekly contract's claim state, the depth-tier
  last-changed time. The missing piece is a *server-side* view —
  guardrail-5 events are local by design, so behavior-based targeting
  needs a Pocketbase cohort endpoint. The honest solo-scale alternative
  is a deliberate decision, not a gap: keep re-engagement
  device-local — the device IS the cohort, and the welcome-back state
  computes on load from the save with zero new infrastructure (the
  first item above is exactly that shape).
+ **Push design is pre-decided for when the widget item lands** — the
  numbers that justify waiting for it to be good (vendor case
  studies, direction per the source note): mobile-game push CTR median
  0.46–1.05 % vs 14.14 % on event-triggered pushes (a bonus actually
  became available) and up to 28.21 % on localized offer pushes; the
  iOS opt-in benchmark is ≤74.7 % and the 97.9 % case sold VALUE at
  the prompt, not offers. What that pins for the widget/push item when
  it's picked up: the pass-3 value push (the offline-haul cap "your
  miners hit the cap") is the canonical example — a real reason to
  return; a win-back push names a STAKE, not an absence ("your weekly
  contract still has X to go this week" beats "we miss you");
  frequency-capped across all channels in one window; and the
  justDice early-churn pattern (a nudge within *minutes* for a
  day-1 player who quit before their first solve — their -26 % early
  churn) pairs with the FTUE pass's funnel item. None of it is a
  feature today — design debt for the widget item, per guardrail 3 all
  timers in it stay real.
+ **Measure reactivation, not sends** — the playbook's operational
  distinction: re-engagement is the campaign, **reactivation** is the
  outcome; the KPI is D7 retention on reactivated players (named
  definition, per the pass-4 discipline), not impressions/clicks. For
  this game the measurement is nearly free and fully on-device: a
  return event at load (away time, streak state, weekly-claim state,
  cap-hit-or-not) plus a D7 flag gives a reactivation funnel per
  dormancy tier inside the existing guardrail-5 local logger. Same
  piece: read the store-review window of the lapsed cohort
  (pass-4 churn workflow) before designing the long-term offer —
  churn reason is in the reviews, not in the inactivity timestamp.
+ **Canon pins (confirmed correct, not gaps):** (1) the **zero-cost
  return** — autosave + offline haul means leaving costs nothing,
  which is the precondition that makes any "come collect" push honest
  (guardrail 3); (2) the **in-game stakes exist already** — the weekly
  contract, daily equation, and goal tiers advance while the player
  is away, so a re-engagement message has a real stake to name (the
  playbook's "stake, not absence") without any new mechanic; (3) the
  **rewarded offers at the return moment** (offline double / top-up)
  are the genre-standard shape. The two long-game failure modes this
  research names and this game is specifically exposed to: the
  **content wall** (D30+ churn = nothing new; the seasonal-events and
  battle-pass items above are the answer, and a 90+ d win-back must
  lead with "what changed", so those items' landing order matters for
  win-back copy) and the **empty return** (capped haul + reset streak —
  the first two items of this pass).

### Store presence & the pre-install layer (pass 10 — the segment before the funnel)

Passes 7–9 audited everything from install onward; this pass audits the
segment before the funnel: how a player finds the game, whether the
listing converts the browse, and the rating cold start a brand-new app
carries. Live audit (2026-09-11, `pnpm run play` against the Console +
`src/`): the production track is **empty** (internal 1.0.8 only), the
en-US listing is **title only** — no short description, no full
description, no screenshots at any size, no other language — and the
app has no in-app review prompt. So this is a launch checklist, not a
gap list: most of it gates the production release itself, which is
already gated on the S6 rating decision (`docs/security-audit.md`).
Source-quality note per the pass-6 discipline: the two 2026 ASO pieces
are a studio guide and a stats collection respectively (directions
agree across all of them; treat magnitudes as illustrative, and keep
the local logger as the only honest number, exactly as pass 4 did).

+ **The production listing is the first deliverable, and it is fully
  CLI-drivable** — the research side: Play search is ~58% of installs
  (Digital Applied 2026, AppTweak/Sensor Tower); Play has **no keyword
  field** — the long description is fully indexed (that is the keyword
  surface), title is 30 chars, short description 80; the first two
  screenshots do most of the conversion work (54% of winning screenshot
  tests won on the first screenshot; median winning-test lift 11.8%);
  Play median tap-through-to-install is 27.7% with the Games category
  at 34–41% — so a title-only listing with zero screenshots sits
  structurally under the category floor. The work: an en-US short/full
  description that uses the indexed long-description space, a
  screenshot set leading with the core loop (the equation + the mine —
  the game's hook — in the first two frames), and a ≤30 s video with
  real gameplay inside the first 3 s; plus the **es-ES listing** — the
  in-app i18n is already en/es, and the research calls cross-
  localization the most underused ASO lever (54% of apps lack it). The
  CLI covers all of it today (`set-listing`, `upload-image`); the only
  non-CLI step is the rating questionnaire (S6), which is a UI gate
  before the first production release anyway. Pre-launch todo for when
  the S6 decision lands; expect ~2 weeks of re-indexing after metadata
  changes before rankings stabilize (Sensor Tower, via the same
  collection).
+ **The review cold start is the launch-week metric, and the prompt is
  a real API** — the research side: 4.5+ star apps install 1.7× the
  rate of sub-4.0 apps, the most recent 90 days of ratings weight
  heaviest, Games is the highest-velocity category (18 reviews/1k
  installs vs 4.2 across categories), and apps using in-app review
  prompts get 2.8× the review velocity of unprompted — prompting is
  the lever, and on Play it is a first-party API (Play Core in-app
  review: Android 5.0+, Play Store present, no Console setup). Google's
  exact rules, which pin the UX: trigger only after meaningful
  engagement, **no call-to-action button** (the dialog can be
  suppressed by quota and a button would present a broken experience),
  **no questions before or during** ("would you rate 5 stars?" is
  explicitly called out), and no more than roughly monthly attempts
  (sub-month quota enforced by the platform). `src/` has zero review
  surface (verified — no Play Core / SKStoreReviewController anywhere).
  Candidate shape: a small native bridge module fired from a genuine
  success moment (first achievement / first prestige — the pass-3
  earned-grant discipline, never at launch, never a button), at most
  one attempt per month; web has no equivalent (a store-link in the web
  footer is the honest version). Candidate, not planned. Pairs with the
  item below: 47% of negative reviews name a specific bug or crash,
  so pre-launch bug triage is half of this item.
+ **The honest-listing rule is also a quality gate** — Play's ranking
  now weighs retention, engagement, uninstall velocity, and Android
  Vitals (crash / ANR / **battery drain**) ahead of install volume, and
  the research is explicit that a listing whose screenshots promise a
  different experience than the game delivers demotes the ranking via
  uninstall velocity. Our exposure: an idle game that animates forever
  (the shared clock in `utils/graphics/animationClock.ts` runs for the
  app's lifetime; the ambient loop in `hooks/useSounds.ts` runs while
  foregrounded) is exactly the battery-drain profile Vitals penalizes —
  and the crash-log hook (`hooks/useCrashLog.ts`) plus the pass-4 review
  workflow is the detection path. Pre-launch checklist, not a feature:
  triage the crash log from the dev builds, and check the Vitals
  baseline on the internal track before production ships. No new code
  unless the numbers say there is.
+ **Review replies have an API but no tooling** — the Play Developer
  API v3 exposes `edits.reviews` (list / get / **reply**), and
  `scripts/play/play.mjs` has no reviews command (verified against the
  CLI surface) — this is the exact gap pass 4 named when it made the
  review-themes-per-version workflow "manual until the CLI gains it".
  A `reviews` / `reviews-reply` pair of commands is cheap to add and
  turns the pass-4 workflow ("when a cohort drops, read the review
  window of the release that shipped before it") into a script; it also
  gives the negative-review triage above a machine-readable source.
  Candidate, not planned.
+ **Listing experiments are a post-launch, UI-only lever** — Play
  Store Listing Experiments (official page): free, A/B over listing
  text + graphics (Google names icons, videos, screenshots as the
  high-impact assets), reports **acquisition and 1-day retention per
  variant**, minimum one week (weekday/weekend), localized variants
  allowed, email on declared winner. There is **no API surface** (the
  official page names none; Developer API v3 has no experiments
  endpoint) — it is UI work, the same class as the S6 rating
  questionnaire. The 2026 experiment-hygiene literature pins the shape
  for when it runs: write the decision rule before making variants
  (audience, one primary metric, minimum useful effect, invalidation
  events), test one asset family at a time, never stop at first peek,
  and keep an experiment ledger (hypothesis, dates, market, assets,
  guardrails, decision — neutral and negative results included). The
  traffic reality decides the sequence: a solo pre-launch app has no
  search traffic to split, so the practical order is variant assets
  pre-launch → observe launch week → run experiments once search volume
  exists. Play-specific caveat: a declared winner ships to ~85% and the
  rest keeps re-randomizing, so lift attribution is noisier than on
  Apple's product-page optimization.
+ **Canon pins (confirmed correct, not gaps):** (1) the **retention-
  first ranking** — D1/D7/D30, engagement, uninstall velocity, and
  Vitals ahead of install volume — is exactly what guardrail 5's
  instrumentation (first ad view / IAP / D1 / D7 in
  `analytics.ts`) measures; the local logger and the ranking
  algorithm are watching the same numbers, so there is nothing to
  build and no reason to game the listing. (2) the **honest-listing
  rule** — "a misleading listing actively hurts ASO" (uninstall
  velocity) is guardrail 4 at the store level: screenshot promises
  must match the shipped game, and the no-dark-patterns guardrail
  extends naturally to store assets. (3) the **audience-segmentation
  surfaces** (Play's up-to-50 custom listings per app, Apple's CPPs)
  and all paid-UA creative are gated by guardrail 5 — no UA spend
  before the measurement lands — so they are deliberately absent,
  not gaps.

### Stability & the device-quality layer (pass 11 — the floor under the funnel)

Passes 7–10 audited funnel segments; pass 10 left a pre-launch vitals
checklist with the discipline "no new code unless the numbers say there
is". This pass audits the layer that keeps the app from being demoted or
warned — crashes, ANRs, battery/wake locks, memory — and checks what is
buildable at all from a JS codebase. Live audit (2026-09-08, `src/`):
the stability stack is local-only — a persisted crash ring buffer
(`crashLog.ts`, 5 entries, each with a session-trail + state snapshot
from `crashContext.ts`), a React `ErrorBoundary` (render layer) plus
`ErrorUtils` global capture (`crashLogging.ts` / `useGlobalCrashCapture.ts`,
no-op on web), and local-only analytics (`analytics.ts`). Zero background
work: offline progression computes on load, the ambient bed pauses on
backgrounding (AppState listener in `useSounds.ts`), and there is no
wake lock, foreground service, scheduled work, or push anywhere in our
code. The only third-party SDKs with a wake-lock surface are
`react-native-google-mobile-ads`, `expo-iap`, and
`@react-native-google-signin/google-signin` — all Google-owned.

+ **User-perceived crash rate is a core vital, and the local stack
captures exactly the right class of event** — Play's user-perceived
crash rate counts DAUs who had ≥1 crash *while actively using the app*
(any activity displayed or foreground service executing). Bad-behavior
thresholds: **1.09 % overall**, **8 % on a single device model** (a
per-device breach is what earns a store-listing warning); assessed on a
28-day window with "emerging issues" flagged after 7 days, leaving ~21
days to remediate. Consequence is reduced discoverability + a listing
warning — not delisting. The local ring buffer exists precisely to catch
the user-perceived class (the Android Hermes white-screen class that
motivated it); the gap is *aggregation* — nothing rolls crashes up
across devices. Candidate: a **crash-code export** — the ring buffer is
already save-code-sized JSON, so rendering it as a shareable code in
Settings → "Local stats (debug)" next to the analytics summary reuses
the existing share-badge/share-text degradation path (PNG → plain text).
No SDK, no network, nothing new to delete (it is a `removeItem` of the
same record, same as the analytics clear). Candidate, not planned; the
trigger is the first non-zero vitals crash signal on the internal track,
not FOMO.
+ **ANR is the blind spot JS cannot see — and the risk profile says
wait for vitals** — user-perceived ANR is the second core vital
(0.47 % overall / 8 % per-device), and an ANR is an OS-level event:
neither of our two JS error layers fires, the local crash log never
sees it, and the only first-party view is Play's ANR dashboard (with
stack traces). Our exposure is structurally small — single-screen app,
pure-TS compute, the roster bobs off ONE shared native-driver clock
(`utils/graphics/animationClock.ts`); the JS-burst candidates are save
parse, the offline-progress computation on load, and canvas repaints on
long rosters. If vitals ever names an ANR, the diagnosis path is
`ApplicationExitInfo` (API 30: why the process died — native crash, ANR,
OOM kill — with `getTraceInputStream` for the trace) plus Perfetto
traces; neither is reachable from JS today (a native module would be
required). No code now; the pass-10 discipline generalizes:
numbers first.
+ **The 2026 wake-lock enforcement is the one vital our architecture
sits on the right side of — verify, don't build** — from 2026-03-01
Google is *enforcing* "excessive partial wake locks": a core vital
where cumulative non-exempt partial wake-lock usage averages ≥2 h
screen-off in **>5 % of user sessions** (28-day window) draws tangible
treatments — a store-listing warning **and exclusion from discovery
surfaces** (rolling out, per the 2026-03 blog). It is the newest vital
and the only one with live treatment rather than demotion risk. Our
surface: zero wake locks in our code (no background work at all; the
ambient bed pauses on backgrounding — verified in `useSounds.ts`), and
audio playback is itself a system-exempted category. The only possible
offenders are the three Google SDKs above, for which the blog's
workflow is: read the offending lock's name from the Excessive Partial
Wake Locks dashboard, cross-reference the identify-wls table of known
system APIs/Jetpack libraries, and configure/replace only if it is
ours. The pass-10 pre-launch checklist item is now concrete; no code
unless a name surfaces.
+ **Crash-free targets: 98.5–99.2 % for a casual game, with the
purchase path instrumented separately** — the 2026 benchmark
consolidation (Bugspulse, over Crashlytics / Instabug / Embrace
aggregates — directions agree, magnitudes illustrative, per the pass-6
discipline): casual/hyper-casual games target 98.5–99.2 % crash-free,
on a maturity curve of 95 %+ pre-launch → 98 % at 3 months → 99 % at
12 months → 99.5 %+ mature, and ~42 % of users leave a negative review
after a single crash — which plugs into the pass-10 review cold start:
stability is half of review hygiene, as pass 10 already pinned when it
made pre-launch bug triage half of the review item. The same source
targets 99.9 % on *purchase paths*: our purchase paths are `expo-iap`
(native) and Stripe hosted Checkout (web), where a crash is revenue
plus trust. Candidate: fold the crash ring buffer into the local
analytics summary (crashes-per-N-sessions computed on-device, same
local-only posture) so a crash-free number exists before it is ever
needed in a report. Candidate, not planned — same trigger as the export
item above; the two collapse into one settings-row feature.
+ **Memory vitals give the games category headroom — there is nothing
to do** — the vitals memory thresholds are tiered by device RAM and app
state, and games get higher limits than apps at every tier (at 8 GB
RAM, foreground: 2.25 GB apps vs 3.50 GB games; bitmap foreground cap
200 MB), and our surface is a static cave canvas plus interpolation-
only bobbing off one shared driver — no bitmap churn (pixel-art canvas;
the share-badge PNG is generated on demand and released). New
Architecture is already on (SDK 57), and FlashList is the canonical
countermeasure for list growth — but the roster row is fixed layout,
not a scrolling list. No code.
+ **Canon pins (confirmed correct, not gaps):** (1) the **local-only
crash posture is right under guardrail 5** — the 2026 crash-tooling
literature itself flags that third-party SDKs capture device IDs / IPs
when "all you need is the stack trace", which is the reason the
benchmark articles exist; the privacy-consistent aggregation path is
opt-in sharing of the on-device record, and Play vitals is the free
first-party aggregator above it — so there is no SDK-shaped gap to
fill. (2) the **pass-10 "no code unless the numbers say there is"
discipline generalizes to the whole layer**: vitals (crash / ANR /
battery / wake / memory) is free, first-party, and pre-decision — every
build candidate in this pass is trigger-based on a vitals reading, not
checklist FOMO. (3) the **white-screen class is covered as far as a JS
codebase can cover it** — release builds have no red box, but the
ErrorBoundary + context snapshot covers the render tree, the global
`ErrorUtils` capture covers outside-render JS (the suspected class of
the original `describe` crash), the `debuggableVariants` embedded bundle
(AGENTS.md gotcha) keeps dev/debug boots alive without Metro, and the
remaining class (native process death) is exactly what
ApplicationExitInfo + vitals see *from outside* — so the gap is
aggregation, not detection.

### The web platform layer (pass 12 — entry surface, cross-device parity, offline)

Passes 7–11 audited the funnel and stability for the native app; the one
platform dimension none of them touched is the **web build, which is already
live** — and this iteration's Stripe work made web a first-class
monetization surface, not just a static export. Live audit (2026-09-08,
`app.config.ts` + `src/`): web is a **static export** (`output: "static"`)
served from the Cloudflare Pages site root `https://minesofdoom.pages.dev`
(post-migration — the pre-migration GitHub Pages subpath is gone with
`experiments.baseUrl`, so the static export emits asset URLs relative to
`"/"`; without that root deploy the page would render blank),
with **no service worker, no PWA manifest, no offline capability** — every
launch fetches the JS bundle + assets over the network. Web IAP is the only
web-specific monetization path (Stripe; native is the stores, §4), web ads
run the AdSense Ad Placement API as parity, and persistence rides the
AsyncStorage→browser-storage shim. In one line: web is a monetizable surface
that is today a *page*, not an *app*.

+ **Stripe web IAP is the right architecture, and the store-compliance
literature confirms the boundary we already hold** — RevenueCat's 2026
engineering piece on "can you use Stripe for in-app purchases" is precise
about where our design sits: since the April 2025 *Epic v. Apple* ruling,
the App Store lets **US iOS apps** link out to an external web checkout, but
that carve-out is for the *native* app; **web is the only surface where
Stripe-first is unambiguously allowed** (no store commission, no IAP
mandate). The piece's headline discipline — treat web checkout as a
*complement to, not a replacement for,* native IAP, and A/B before scaling
(their Dipsea test showed a conversion dip moving iOS users to web
checkout) — is exactly our posture: native uses `expo-iap` (Play Billing /
StoreKit), Stripe runs **only** on web. The cross-device entitlement sync it
describes ("web purchases unlock in-app instantly… as soon as a payment is
complete, entitlements sync across devices") is already our architecture —
the Pocketbase entitlement row is the sync point and `reconcileStore`
re-derives from the store record, so a web purchase appears on a signed-in
native device at its next restore. **Canon pin:** the server-created
Checkout Session + webhook/return-visit double-mint design is the right
pattern, and the "Stripe alone doesn't handle app-to-web checkout /
entitlement syncing / cross-platform unification" gap is precisely the role
our Pocketbase sidecar fills.
+ **Offline / installable (PWA) is the one big missing web-standard feature —
and the most deferrable** — MDN's installability guide + the 2026
offline-first checklists: an installable web app = a web-app **manifest** +
a **service worker** (registered and active on https) → the browser offers
an install prompt and can cache every asset. The canonical cache split for
an idle game (offline-first): **cache-only** for critical assets (our
sprites/audio — a static pixel-art canvas with no remote content),
**cache-first** for the JS bundle/CSS/fonts, versioned + invalidated per
build, with a static fallback page for the cache-miss class. Consequence if
built: the web build installs to the phone home screen and plays fully
offline — and an idle game is the ideal offline-first shape (progress is
local, nothing is real-time). Cost/risks: a service worker needs a deliberate
versioned cache-bust strategy for the static-export bundle (post-migration
the SW scope is the site root on Cloudflare Pages, so no subpath
fiddliness), and it adds a second delivery path to test on every release.
**Candidate, not planned** — the trigger is a real install/offline
demand signal (a web-cohort D1 dip attributable to reconnect cost, or a
player ask), not FOMO. Today the absence is low-blast-radius: it's a page
served from CDN-cached static export, so a refresh on a flaky network
re-fetches the bundle and then plays; nothing is lost.
+ **Web storage posture is right and the quota is not a constraint** —
MDN's storage-quotas page: best-effort storage (`localStorage`) persists
while the origin is under quota **and** the device has room, and the
per-origin `localStorage` budget is ~5 MB in browsers (IndexedDB is far
larger, device-dependent). Our save is a single small JSON blob (the
save-code format, `saveCode.ts`) — orders of magnitude under the 5 MB
budget, on our own origin (the Cloudflare Pages site root), so capacity and
eviction
under normal use are a non-issue. The real web-storage risk is **eviction,
not capacity** (browsers may reclaim best-effort storage under device
pressure), and the mitigation already exists in the right shape: a
save-code export (manual + prompted) **and** a cloud save
(`cloudSave.ts`, LWW with a durable budget) — so a cleared or evicted
browser never loses a run. **Canon pin:** no storage work — the quota is
~100× the save size and the two escape hatches already cover the eviction
class.
+ **Cross-device parity is an account story, not a web story — and we hold
it** — the web→native funnel (and web↔native parity) rides the optional
account layer (§5): a web player who signs in carries cloud save +
entitlements to a native install, and a native player on web gets the same.
The web→native *install* funnel itself (deep link to the store, deferred
install) is a candidate, not planned — there is no store-linking /
deferred-install infra, and the free path is identical on both platforms
(guardrail 1), so a web player can enjoy the whole game without installing.
Trigger: a web→native conversion metric (guardrail 5) that justifies a
deep-link CTA.
+ **Web ads parity is done and is the one web monetization surface we won't
expand** — the AdSense Ad Placement API rewarded parity (rewarded-only, no
banners/interstitials — guardrails 2–3, hard per-day caps in pure code,
§4) is already live and mirrors the native posture. No ad work here.
+ **Canon pins (confirmed correct, not gaps):** (1) the **static export is
right for a first-party idle game** — post-migration it deploys at the Cloudflare
Pages site root (no `baseUrl`), and delivery is a CDN-cached static bundle
(Play/Pocketbase traffic rides Caddy on the VPS domain), so there is no SSR
to get wrong. (2) the **web surface is
deliberately small** — web exists as a monetization surface (Stripe) and an
ad-parity surface (AdSense), not as a full second app; the features we are
*not* doing (PWA/offline, deep-link install funnel, web push) are
signal-gated candidates, the passes 10/11 "no code unless the numbers say
there is" discipline applied to the platform layer. (3) the **server-created
Session + double-mint Stripe design is the canonical one** — the client
mints nothing; the webhook and the return-visit both re-derive from
Stripe's paid state through the sidecar; the Pocketbase row is the single
entitlement source. That is the cross-platform unification RevenueCat says
"Stripe alone" can't do — and we have it.

### Inputs & the control layer (pass 13 — the hand on the screen)

Passes 3–12 audited everything above the hand: content, sessions, the
funnel, the platform, stability. The one layer none of them touched is
the hand itself — the verbs the player performs, and how they are
discovered, sized, and (not) extended beyond touch. Live audit
(2026-09-13, `src/`): the control vocabulary is exactly **three verbs** —
a **300 ms hold** on the cave canvas to mine (a quick tap deliberately
does nothing; the canvas carries a persistent "hold to mine" caption),
**digit entry** (the OS-keyboard field, the default, or the
settings-toggled on-screen keypad), and **confirm** (Enter / the keypad's
`=`). There is no gamepad path anywhere (no `getGamepads`, no native
controller module), no device-motion input (`useShakeInput` is the
answer box's error *shake* animation, not an accelerometer), no keyboard
surface beyond the answer field (no `tabIndex` / focus management
anywhere; every touch surface is an RN `Pressable`, which RN-web gives
default focus semantics), and the app is portrait-locked
(`app.config.ts: orientation: "portrait"`). Tap targets run 44–56 px
(`styles.ts`, `NumericKeypad.tsx`); safe-area insets are honored via
`react-native-safe-area-context` on the main screen, the bottom modal, and
the onboarding overlay; 25 a11y strings label the touch surfaces
(`utils/i18n/en.ts`). Source-quality note per the pass-6 discipline: the
target-size criteria (W3C / Apple HIG / Material) are primary and exact;
the Hoober hold-mode numbers are a single 2013 field study cited by a
2026 UX piece — direction only; the gamepad guide is a vendor engineering
blog (mechanics accurate, no market-share numbers — none exist to cite
honestly).

+ **Target sizing passes every published standard — canon pin, not a
gap** — WCAG 2.2's target-size criteria (2.5.5 at Level-AA publication,
2.5.8 in 2.2) require a 24×24 CSS-px minimum (with small-target spacing
escapes); Apple HIG says 44 pt, Material 48 dp. Our floor is the 44 px
keypad minimum (56 px natural), so **every** interactive target clears all
three by size alone — the keypad's 6 px gap is under Material's 8 dp
recommendation, but that spacing rule exists only to rescue
sub-minimum targets, of which we have none. The one geometry rule the 2026
UX canon states that we already meet is pinned with its seam named: anchor
interactive UI to safe-area insets and let the playfield absorb aspect
drift (16:9 → 19.5:9 → 20:9 → foldables) — `useSafeAreaInsets` in
`MinesOfDoom.tsx` / `BottomModal.tsx` / `OnboardingOverlay.tsx` is exactly
that shape, verified. No code.
+ **Hold is the genre-canonical verb, and it is a one-knob accessibility
exposure in both directions** — the UX canon pins the verb itself:
long-press is the standard "give me more / charge" mapping (the intent
players already expect a hold to mean), and the portrait one-thumb idle
is the canonical shape — Hoober's field data (~49 % one-handed / 36 %
cradled / 15 % two-handed holding, via the 2026 piece) is why idlers sit
with match-3 and card games in the portrait genres. The portrait lock is
therefore a pin, not a gap (landscape buys dual-stick control this game
deliberately lacks — see "Deliberately absent"). The exposure: the hold is
a *timed* verb — the 300 ms gate filters fat-finger contact (good), but it
is also a sustained press, and a player whose tremor breaks a 300 ms
contact — or who simply expects a tap — has no mining path but the hold.
Cheap version: a settings toggle that sets `MINE_HOLD_MS` to 0 (tap
mines), one persisted boolean beside the pass-3 reduce-effects row, the
a11y label flipping with it. Candidate, not planned.
+ **Gesture invisibility is handled at the one place it bites — pin** —
the canon's Norman rule: gestures have no affordance, a gesture nobody
discovers is a feature that does not exist, and a *required* hidden
gesture is worse than an invisible one. Our required verb (the hold) is
the one in-game affordance that matters: a persistent "hold to mine"
caption under the player — the verb is taught in-context, not in a
tutorial, exactly the fix the canon prescribes. The quick-tap gem pocket
is the one deliberately hidden gesture, and it is pure upside (an
accidental tap can only ever help — already pinned in §2 "Gem pocket").
No candidate; the rule is a constraint on *future* features: any gesture
added later (none exist — no swipe, no pinch anywhere in `src/`) ships
with its caption.
+ **Gamepad / controller is the one input surface with a real loss
surface — and ours is the smallest possible mapping** — the 2026
browser-gamepad canon: players reach browser games on Steam Deck / ROG
Ally / Legion Go and through TV browsers (Samsung Tizen, LG webOS) where
a broken controller path is *unplayable*, not inconvenient — and the
mechanics that pin the implementation: poll `navigator.getGamepads()`
every frame (only connect/disconnect are real events), pads are hidden
until the first button press (fingerprinting privacy), "standard"
mapping normalizes Xbox/PS button indices, radial deadzone 0.10–0.25,
hot-plug keyed on pad identity not slot, rumble feature-detected. Our
verb set (mine, digit, confirm, panel up/down) maps one-button-per-verb
with digits riding the on-screen keypad that already exists (or a D-pad).
The honest cost notes: the web bundle is RN-web, whose responder system
doesn't poll gamepads, so the web leg is a thin web-only module; the
Android leg gets DPAD / controller keys *free* on ChromeOS and TV (the
platform's input-compatibility layer delivers them to Android apps —
verifiable on one device, no new infrastructure); the iOS leg is the only
genuine native module (GameController framework). Trigger-gated per the
pass-11/12 discipline: a handheld/desktop signal from the pass-12
web-cohort instrumentation, or a player ask — not FOMO. Candidate, not
planned.
+ **Keyboard operability past the answer field is the cheap 80 % — and
the load-bearing accessibility step** — today the only keyboard surface is
the answer field (autofocused, numeric, Enter submits); the HUD icon row,
panels, and keypad are pointer targets, and no `tabIndex` / focus
management exists anywhere in `src/` — so a web-desktop player (the
monetization surface pass 12 made first-class) drives the whole game with
a mouse, and a keyboard-only or switch-access user is stuck at the HUD.
Two steps, in order: (1) *verify* — with a keyboard only, can a player
tab through the menu panels, open the shop, and buy on the shipped web
build? RN-web gives `Pressable`s default focus semantics in many cases, so
this check is discipline, not code; (2) if the walk finds holes, the fix
is standard focus/tab-order props on the affected rows. It is
load-bearing for the reason the input-methods research (Rizzo et al.,
"Playdate", IJHCI 2016) makes explicit: no single alternative input
method wins across players and tasks — what keeps a game playable is a
*small, remappable verb vocabulary*, and both platforms' OS stacks
(iOS Eye Control / AssistiveTouch, Android Accessibility Suite / switch
control) arrive through exactly the keyboard/pointer semantics this step
guarantees. Ours — hold, digit, confirm — is already the study's
adaptable shape; this step is what makes that true from a keyboard. The
gamepad item above also routes through this seam. Candidate (verification
first), not planned.

### The localization / i18n layer (pass 14 — every word the player reads)

Passes 3–13 audited everything the player does; the layer none of them
touched is what the player *reads* — UI chrome, data-driven names, toasts,
a11y labels, the share badge, the web `<head>`, the legal docs, and the
store listing. Live audit (2026-09-13, `src/utils/i18n/`,
`src/utils/format.ts`, `weeklyChallenge.ts`, `shareBadge.ts`,
`+html.tsx`): the localization machinery is **built, key-parity-tested,
and deliberately switched off**. Commit `62ff419` ("feat(i18n): disable
localization, English only") pinned the live locale store to `"en"` —
`src/hooks/useI18n.ts` says it plainly: no persisted preference, no
settings picker, "re-enabling is a settings-UI + useI18n change; the i18n
core stays intact" — and the Spanish side stayed live in the meantime:
`en.ts` (516 lines, source of truth) and `es.ts` (515 — same key set, a
`Locale = "en" | "es"` union that makes a missing key a *type error*, plus
a placeholder-parity test pinning `{name}`-style tokens across languages),
a second data-driven namespace (`content.ts` / `content-es.ts`, 438 lines)
resolving miner / pickaxe / achievement / cave / legal-doc names at the
`t()` call sites, and full a11y coverage in both tables (including the
canvas caption). The honest state: the translation work is essentially
done and CI-protected; what's missing is one picker, one persisted
boolean, and four landmines.

+ **Landmine 1 — the share-badge pixel font has no accented glyphs.**
`shareBadge.ts` renders the achievement name with a hand-authored 5×7
bitmap font (`PIXEL_FONT`) covering A–Z, 0–9, and a handful of
punctuation — and any unknown glyph becomes a *space* (`PIXEL_FONT[rawCh]
?? PIXEL_FONT[" "]`). English content names are safe; the Spanish content
names (ñ/á/é/í/ó/ú in `content-es.ts` achievement and miner names) would
render as *blank runs* in the badge image. Re-enabling Spanish without
extending the font (or giving the badge an en-name fallback) ships a
broken-looking share image — the single most concrete re-enablement
prerequisite in the audit.
+ **Landmine 2 — legal docs: a Spanish title over an English body.**
`legal.ts` carries English-only document *bodies*; the es tables cover
only the doc *titles* (`content-es.ts` has `legalDoc:privacy` /
`legalDoc:terms`). A Spanish player would get a Spanish-titled,
English-bodied legal page — legally fine, visually broken.
+ **Landmine 3 — the safety net pins keys, not length.** The parity tests
pin key sets and placeholders, which is the right guard — but nothing
exercises *length*. Research (#3 below) puts the typical es inflation of
English UI strings at ~25 % (de ~30 %), and the standard practice is a
pseudo-locale pass in CI. The cheap analogue here: a test-only locale
that inflates `en.ts` values and asserts the rendering components don't
overflow. Belongs in the re-enablement checklist, not a standalone
feature.
+ **Numbers and time are locale-blind, correctly, while English-only.**
`format.ts` is a fixed k/M/B/T/Qa/Qi suffix ladder (no `Intl`, no locale
digit grouping) and `formatDuration` uses English unit labels — pass 8
already owns that notation decision, so this pass only names the seam: a
locale-aware `Intl.NumberFormat` compact formatter is its honest
successor when a second locale lands (Hermes `Intl` support must be
smoke-tested first — it has historically lagged web engines). Calendar
boundaries are fixed the same way: the weekly window hardcodes a Monday
start (`weeklyChallenge.ts: (d.getDay() + 6) % 7`, device-local timezone)
and daily bonus/caps roll at device-local midnight. All correct today; the
`Intl.Locale.getWeekInfo()` seam (UTS 35 week data: `firstDay` /
`weekend` / `minimalDays`) exists for a future locale with a different
week start, and is rejected for now for the reason below.
+ **The web `<head>` is static-English by construction.** `+html.tsx`
hardcodes `lang="en"` and an English `<title>`/`<meta description>`, and
the static Cloudflare export can only serve one document per build — so
in-app locale switching is fine (JS-only) but the HTML metadata stays
`en` no matter what. Acceptable for a web presence that is secondary to
the store; one line in any re-enablement note.
+ **`i18n:listing-es` — the slice that ships without touching the app.**
Pass 10 audited the Play listing as en-US-only with no es-ES, and the
Play CLI already supports per-language listings (`set-listing --lang`).
Research (#2) is the strongest quantitative case yet for listing
localization as the first slice: an average **+30 % download lift from
localizing a listing into 10+ languages**, **+128 % for apps localized
into the top-10 markets**, **72 % of users prefer an app in their native
language** (56 % say it matters more than price), and the gap stat that
motivates the whole layer — **only 13 % of apps are fully localized for
the top-10 markets** (45 % support 5+ languages). The current screenshots
are mostly canvas art with little text overlay, so a localized listing is
near-free (English text overlays in a foreign listing are the known
anti-pattern; we barely have any). **Candidate, not planned** — trigger:
sustained organic installs from es-market in Play Console traffic, or a
Play Console listing-localization suggestion that survives a re-check.
+ **`i18n:language` — re-enable the picker, behind a four-item checklist.**
The machinery (tables, `navigator.language` detection, format/translate,
a11y coverage) exists and is tested; the delta is (1) the share-badge font
fix or en-name fallback (landmine 1), (2) the two legal doc bodies
(landmine 2), (3) the pseudo-locale CI pass (landmine 3), and (4) the
settings picker + one persisted preference, with the existing detection
as fallback. **Candidate, not planned** — same trigger as the listing,
but it *follows* the listing: the app should catch up to a localized
listing, not lead it. No RTL language is in scope — the layout is built
LTR and RTL support is a project, not a feature.
+ **`i18n:formatters` — locale-aware numbers/durations, the pass-8
successor.** Replace the fixed ladder with `Intl.NumberFormat` compact
notation ("1,2 M" in es vs "1.2M" in en) and route `formatDuration`'s
unit labels through the i18n tables. **Candidate, not planned** —
trigger: re-enablement, or any locale with a non-Latin digit script (then
the ladder is not a style choice, it's wrong). The Hermes
`Intl.NumberFormat` smoke test is a build prerequisite, not a note.
+ **Rejected, with reasons** (so they aren't re-litigated): (1) *locale
week start* — keeping Monday is right while English-only and matches
es-ES; a locale-aware start would make "weekly" mean different things to
different players for zero visible benefit; revisit only if a
Sunday-start locale (e.g. `ar-XX`) becomes a candidate. (2) *a CLDR
plural-rule engine* — English and Spanish are both 2-category languages
(one/other), and the table strings keep numbers as bare tokens with
invariant nouns ("×{bonus}", "{activeDays} días activos"), sidestepping
count-adjacent grammar entirely; a plural engine becomes necessary only
when a >2-category language (ru, ar, pl) enters the candidate set — and
CLDR's own rules shift between versions (CLDR 24 added fractional-value
handling and merged categories for Russian), which is itself an argument
against pinning plural logic into the app before a language forces it.

Source quality per the pass-6 discipline: #1 is the standards body
(CLDR — exact); #2 is a vendor ASO-statistics aggregator (direction
consistent with pass 10's Digital Applied numbers, magnitudes
illustrative); #3 is a vendor technical guide (standard methodology,
expansion percentages illustrative); #4 is a reference (MDN) for the Intl
seams — Hermes support flagged as unverified, not asserted.

**Not re-audited here:** pass 8's numeric-notation decision (the fixed
ladder stands; `i18n:formatters` is its locale-aware successor) and pass
10's full store-listing audit (this pass only adds the es-ES listing
candidate on top).

### The math / difficulty layer (pass 15 — what the player is actually solving)

Passes 3–14 audited everything the player does, sees, types, and reads;
the layer none of them touched is the content being typed — the equations
themselves. Live audit (2026-09-15, `src/utils/math/equations.ts`,
`hooks/useEquations.ts`, `mines_of_doom/dailyEquation.ts`,
`components/EquationDisplay.tsx`, `game.ts`): the generator is a
guarantees-first machine — 7 toggleable shapes (×, +, −, ÷, %, ², ?) over a
player-set `[min, max)` range (default: × only, [0, 12)), with integer,
non-negative, exact answers by construction (subtraction swaps so a ≥ b;
division picks a = b·k; percent bases are multiples of 100/p with p ∈
{10, 25, 50}; ? is add/× only, whole answer ≥ 1; percent/²/? are
soft-mode-only). The difficulty levers are exactly three, all
player-directed and static: the range, the shape mix, and hard mode (3
terms left-to-right, the classic four ops only, sub clamped, exact
division at both steps). Nothing adapts to performance — and speed is
deliberately unmeasured (the timed/streak modes were removed; the
`useEquations.ts` comment says so), so difficulty here means shape
complexity, never speed. The pay stack names difficulty explicitly: the
engine pays **answer × op-premium × click power × combo × click-boost ×
depth bonus × prestige** (`useGameEngine.ts: applyAnswerReward` — use
"minerals"), with the op-premium ladder ÷ ×10, ² ×4, % ×3, ? ×3, − ×2, ×/+ ×1
× hard-mode ×2 — so the range lever already has pay-for-difficulty built
in (wider range → bigger answers → more minerals per solve). Two audit
findings. (1) **The pending-gain readout understates the real payout by a
factor of the answer's value.** `EquationDisplay` shows `correct: +{gain}`
with gain = click-power × combo × op-premium only; the engine pays
answer × that (and the floating "+N" on solve does include the answer). The
`equation.pending` i18n copy carries no "per answer value" hint, and the
display *has* the equation object, so the exact gain is computable — the
understatement is an omission, not a constraint. (2) **The default range
makes zero a legal operand:** with min = 0, ~16 % of the default × pool
(1 − (11/12)², "0 · n" / "n · 0") plus 1/12 of the ² pool ("0²") degenerate
to zero-answer equations that pay the `Math.max(1, …)` floor — trivially
easy, trivially rewarded. Division is immune by construction (a = b·k, k ≥ 1).

The research (four sources; quality notes at the end):

+ **What the meta-analysis actually says.** Tokac, Novak & Thompson
  (JCAL 35(3) 2019, 24 studies, ~360 citations) find a "small but
  marginally significant" overall effect of learning video games vs.
  traditional instruction, with heterogeneity "in magnitude and direction"
  — "a slightly effective instructional strategy." The honest consequence:
  the math verb is an engagement/flavor choice, not a defensible learning
  claim. Store copy and any future marketing should stay
  entertainment-framed — which is also the posture the S6 13+ decision
  implies (`docs/security-audit.md`). The research's value to this game is
  what it says to optimize *for*: flow, not pedagogy.
+ **Flow / challenge calibration.** The flow channel sits between anxiety
  (challenge above skill — the review voice "unfair") and boredom (challenge
  below skill — "bored players don't complain. They just leave."). The cited
  primary is Jenova Chen's 2006 USC MFA thesis: most games author ONE fixed
  difficulty path while players arrive at different skills and learn at
  different rates; the fix is a *wider* flow channel (multiple or adaptive
  paths). The two canonical implementations are DDA (Resident Evil 4's
  invisible performance score) and player-directed difficulty (Celeste's
  Assist Mode). The audit implication: this game already ships the
  player-directed version of the fix — range + shape mix + hard mode *is*
  the player's own challenge menu — and it ships no DDA. The silent failure
  mode here is boredom: an idle game's audience is by construction already
  good at its active verb, so a player who is automatic at 2-term × in
  [0, 12) sits in the boredom zone for the rest of the session unless they
  move the levers themselves — which, per pass 4's retention data, most
  casual players won't do unprompted. The pay stack (finding above) already
  rewards moving the range lever; nothing tells the player the lever exists
  in a way tied to their own performance.
+ **Automaticity.** The standard definition (Rocket Math FAQ, standard
  across the practice-app literature): automatic = fast, accurate, without
  conscious attention — the third stage after accuracy and fluency; its
  function is freeing attention for higher-order work (a student without
  fact automaticity can't run the fact *and* the procedure at once). The
  design implication is a ladder this game already contains but never
  narrates: 2-term facts (the accuracy → automaticity stage) → missing-number
  (working the op backwards) → 3-term (hard mode is exactly the
  higher-order stage automaticity exists to free you for). No in-game
  surface tells the player the ladder exists or that they're ready for the
  next rung.
+ **Differentiation by task feature.** Bardy, Holzäpfel & Leuders (METED
  23(3) 2021, full text read): in practice-phase work the right unit of
  "adaptive" is the task's features — 22 validated categories from operand
  range to representation shape — and a task with *differentiation
  potential* is done by heterogeneous learners at different levels at the
  same time. This is the research anchor for pass 4's per-type mastery
  tiers: not a different game, the same seven shapes at stepped ranges.

+ ~~**`math:pending-gain`**~~ — **DONE 2026-09** (iteration 21,
  autonomous no-signal pick; audit finding (1)): the pending-gain
  readout now shows the EXACT payout — `getPendingAnswerGain`
  (`game.ts`) mirrors `applyAnswerReward`'s integer core (premium-folded
  answer value floored at 1 exactly like the reward, × effective click
  power × combo multiplier; the depth/prestige float tail stays in the
  caller's `mulFloats`'d effective click power), so the readout agrees
  with the floating "+N" on solve digit-for-digit instead of
  understating by a factor of the answer's value. `EquationDisplay` just
  swapped its local product for the helper — the `×{mult}` detail suffix
  and the `equation.pending` copy ("correct: +{gain}") are unchanged and
  are now literally true. Pure display change, engine untouched; tests in
  `game.test.ts` (premium ladder, hard-mode leading-op keying, the
  zero-answer floor).
+ ~~**`math:zero-operand`**~~ — **DONE 2026-09-12** (iteration 13,
  autonomous pick alongside the pass-17 active-clock fix; audit finding
  (2)): `generateTermsEquation` now floors multiplicative operands (× and
  ²) at 1 even when `minNumber` is 0 — "0 · n" / "n · 0" / "0²" no longer
  generate, so no zero-answer equation pays the `Math.max(1, …)` floor.
  +/− keep 0 legal ("0 + n = n" is easy, not degenerate); existing saves
  keep their stored range — no migration. Tests in `equations.test.ts`
  (zero-operand exclusion describe).
+ **`math:mastery`** — a per-type fact-table view: rolling accuracy on the
  last N answers per enabled type (the records seam, `records.ts` tracks
  lifetime answers, not per-type yet — that delta is the cost) plus a
  suggested next step ("× in [0, 12) is at 95 %+ — try + or widen the
  range"). Presentation + suggestion only; the actual step stays with the
  player (the Celeste-Assist shape the flow research endorses). The cheap
  half of pass 4's adaptive item. Candidate, not planned.
+ **`math:adaptive`** — pass 4's per-type mastery tiers, now anchored by
  Chen's wider-channel argument and Bardy's feature-level differentiation:
  auto-step a type's range/shape up on mastery, the player-set range as
  the ceiling, a tier-up marker as the visible reward. Up-steps only,
  never down (the rejected-DDA reason below), player setting as the
  escape hatch. Bigger than `math:mastery`: it changes what the player
  *gets*, not just what they see. The pass-4 hard caveat carries over:
  it must challenge, never replace, hand-solved math. Candidate, not
  planned.
+ **`math:ladder`** — narrate the automaticity ladder the research
  describes: an opt-in suggested sequence (2-term facts → missing-number →
  3-term) in sawtooth shape (the flow research's ramp-to-peak, drop,
  ramp-higher). Heavier design lift than the other three and overlaps
  `math:adaptive` — adopt at most one of adaptive/ladder, whichever the
  free-path benchmark (guardrail 1) can verify stays viable. Candidate,
  not planned.

**Rejected, with reasons** (so they aren't re-litigated): (1) *reviving
timed / speed modes* — the automaticity axis is speed, and the timed modes
were deliberately removed (`useEquations.ts`); a timer turns the active
loop into a speed drill, which for a 13+ casual audience is the flow
research's anxiety corner (challenge above skill reads as "unfair" in
reviews). The sanctioned difficulty axes are shape and range, player
controlled. (2) *"improves arithmetic" marketing claims* — Tokac's
small, marginally-significant, heterogeneous effect doesn't support an
educational claim, and the S6 13+ entertainment posture is the
compliance-safe one; the math verb stays engagement and flavor. (3)
*personalizing the daily equation's difficulty* — the day-key seed making
the equation identical for everyone is the fairness/identity property the
daily-challenge leaderboard idea (below) builds on; per-player difficulty
breaks it. (4) *auto-stepping down on misses (aggressive DDA)* — the flow
research's DDA precedent (RE4) is tuned to hours of continuous play; for
an idle's single active verb, a difficulty that steps down on a miss
punishes the one mistake that is already a combo reset. If `math:adaptive`
lands, it steps up only, with the player as the fallback — the
Celeste-Assist shape.

Source quality per the pass-6 discipline: #1 is peer-reviewed (JCAL; the
effect-size *value* itself wasn't re-verifiable here — the abstract's
"small but marginally significant" is quoted, the numeric d is not stated); #2 is a vendor design reference (same family as passes 8/13, qualitative — Chen's 2006 USC MFA thesis is the academic primary, cited through it); #3 is a vendor FAQ (the standard accuracy → fluency → automaticity definition, qualitative); #4 is peer-reviewed, open, full text read.

**Not re-audited here:** pass 4's adaptive-difficulty item (this pass
anchors it; the candidates above are its concrete shapes), the op-premium
and answer-value pay *balance* (an economy matter — the ÷ ×10 "top scorer"
is deliberate per the `game.ts` comment), and the FTUE equation-setup step
(pass 7).

### Monetization benchmarks (pass 6 — revenue-side targets for guardrail 5)

The GameGrowthAdvisor F2P-monetization comparison (2026, rebuilt against
named primary datasets — AppsFlyer's 2025–26 monetization analysis from
≈$900M verified purchases / 9,600 apps, TopOn H1-2025 ad-format data,
Sensor Tower, Lancaric, Liftoff) is worth citing *because it states which
numbers do NOT exist*:

+ **Model mix.** Midcore ≈ 90% and casino ≈ 83% of revenue from IAP
  (AppsFlyer); in three-stream games the split is ≈ 35% IAP / 56% ads /
  7% subscription (subscription up from 4% a year earlier). Hybrid
  (IAP + ads) is present in under 30% of games overall (casual 33%,
  hypercasual 32%, midcore 15%, AppsFlyer) — TopOn's "72% of developers"
  figure only counts games already on its ad platform. A math-idle with
  one-time IAP + rewarded ads sits in the casual-hybrid slot.
+ **Ad-format economics (TopOn H1 2025, casual):** rewarded video is
  39.35% of casual ad revenue from 21.25% of impressions, interstitial
  44.25%, and banner earns 6.50% of revenue from 37.01% of impressions —
  the format math confirming the rewarded-only ban (guardrail 2) costs
  little: rewarded out-earns its impression share, banner massively
  under-earns. In midcore rewarded leads at 51.77%.
+ **eCPM trend (casual Android):** rewarded $3.60 (H1 2023) → $3.02
  (H1 2025), -7% YoY; interstitial -11%. The regional spread is the real
  story: rewarded eCPM $8.90 Android / $12.24 iOS in EU/NA vs low single
  digits in SEA/LATAM. The plan-against number is the formula
  `rewarded impressions/DAU × eCPM / 1000` on OUR OWN cohorts — no
  published impressions-per-DAU exists ("3–5/day" is a design
  recommendation, not a measurement).
+ **ARPDAU bands to plan against:** ads-only casual $0.01–0.05,
  hypercasual blended $0.03–0.08, hybrid-casual blended $0.15–0.50
  (Lancaric: hybrid-casual is 40–50% IAP-driven; segment net revenue
  ≈$174.8M/mo App Store March 2025, ~3× early-2024). IAP-only and
  subscription-only ARPDAU have NO primary benchmark — derive from own
  payer share × order value.
+ **UA arithmetic (Liftoff 2024 data, 2025 casual report):** casual D30
  ROAS 47% iOS vs 15% Android; US Android casual/puzzle CPI $1.50–3.50,
  iOS 3–4× Android. Ads-only economics rarely close a Tier-1 Android CPI
  gap — another argument the hybrid (rewarded + entry-priced IAP) shape
  is right for this game.
+ **The famous "1.8% of players pay" has no primary source.** Closest
  Tier-A: AppsFlyer Q1-2022 install→purchase 2.6% within 30 days,
  install→subscription 0.2% (both stale). Guardrail 5's IAP-purchase
  logging is the only honest number; don't back-fill from folklore.
+ **Sequencing precedent:** rewarded first → entry-priced IAP →
  seasonal pass at month 2 → light subscription at month 3; interstitial
  suppression for recent payers (moot — banned here); store refund
  windows (Apple 90-day, Play 48-hour) belong in revenue recognition.
  Battle passes appear in ~60% of top-grossing titles (GameRefinery
  2022 — stale; pairs with the battle-pass item in §1 above).

### Compliance (pass 6 — COPPA 2025 final rule, the S6 decision input)

The FTC's COPPA 2025 final rule (Federal Register 2025-04-22; effective
2025-06-23; compliance deadline 2026-04-22 — **in full effect now**) is
the first amendment since 2013 and reshapes the S6 age-rating decision
(`docs/security-audit.md`):

+ **Two-tier consent for ads:** verifiable parental consent is now
  required *separately* to disclose children's data to third-party
  advertisers — third-party/behavioral ads are off by default unless a
  parent opts in. For a child-directed app, the AdMob/AdSense rewarded
  legs need that consent **on top of**
  `TAG_FOR_CHILD_DIRECTED_TREATMENT`, not instead of it.
+ **Data minimization + retention:** no indefinite retention of
  children's personal information; a written retention schedule (business
  need + deletion timeframe) must be described in the privacy notice.
  Our v2.0 policy (`legal.ts`) describes deletion *on request* (GDPR
  shape), not a scheduled retention window — a child-directed path needs
  policy copy regardless.
+ **Broader "directed to children" test:** marketing, representations
  to third parties, reviews, and the age composition of users on similar
  sites are explicit evidence. A 3+ math game aimed at kids is
  child-directed; a teen (12+) rating is the way to keep COPPA out of
  the consent path, at the cost of part of the math audience.
+ **What it means for this game:** the age-rating decision gates either
  (a) a launch parental-consent gate (verifiable consent before data
  collection, plus the third-party-ad consent) if we stay kid-directed,
  or (b) a teen rating with the device-scoped anonymous model (no
  account by default, minimal collection) doing the compliance work.
  Option (b) is the cheaper path and matches the current architecture
  (local save default, opt-in account, local-only analytics); the
  kid-mode/parent-screen item below is where option (a) would land.
+ **Monetization-side minor protections** (the pass-6 monetization
  piece): parental consent for IAP targeting under-13s, minors
  segmented out of whale-optimization. Our IAP is direct purchases with
  no loot-box odds to disclose (gem *drops* are free gameplay rewards,
  not paid randomized containers), which keeps us clear of the
  odds-disclosure regime (platform policy since 2017–2019; statutory in
  CN/TA/KR).

### The cosmetics / skin economy layer (pass 16 — the one gem sink that pays nothing back)

Passes 3–15 audited everything the player taps, reads, types, and buys for
*power*; the one axis never audited as a system is what the player buys for
how it *looks*. Live audit (2026-09-15, `cosmetics.ts`, `iaps.ts`,
`game.ts`, `freePath.ts`, `ads.ts`, `useGameEngine.ts`, `IapPanel.tsx`,
`MiningCanvas.tsx`, `shareBadge.ts`, `achievements.ts`, `analytics.ts`):
the catalog is 28 items in 3 lines — 14 outfits (free default + 13 paid,
15–85 💎), 4 pickaxes (free + 3 paid, 25–90 💎, each with its own swing
`soundFile` and `feel` — swingMs/bounceDepth, feedback not power), 10 cave
themes (free + 9 paid, 25–170 💎, background recolors). The full paid
collection is **1,675 💎** (675 outfits + 160 pickaxes + 840 themes). Gem
income for scale (`freePath.ts` sim, the same one the balance test runs):
the first prestige run takes ~4.7 days and grosses 208 💎 (164 drops + 44
mints); a 30-day free run grosses 1,958 💎 (re-measured pass 19, 2026-09-10,
on the deterministic seed-20260902 sim: 1,548 drops + 410 mints; the
1,946 figure quoted in pass 16 was a one-off measurement of a pre-09-08
code state that never landed in a test or the repo). Gem sources are the per-answer
drop (5 % base + 1 %/level, `gemChance`), the 100 k minerals → 1 gem mint
faucet (`gemMineralCost`), and the ad roll (5 💎, 3×/day, `ads.ts`). Gem
*sinks* are the three miner lines, gem chance, click boost, and combo
resistance — all functional, all paying back in minerals — plus cosmetics,
**the only sink with no payback**. The store is 25 packs, one per paid
cosmetic, with the USD tier pinned to the gem-cost band (≤30→$0.99 …
>100→$3.99, `packPriceLabel`); each pack grants the same item (idempotent
grant into the owned lists) and the row prints "also earnable in-game"
(guardrails 1 & 4) — convenience, not access. Identity is two-dimensional:
purchased palette × a free unlimited seed reroll (`rerollPlayerSeed`), and
the whole roster inherits the look (`rosterSeed`), so the selected outfit
wears on the player *and every roster miner on the canvas* — the game's
highest-visibility cosmetic surface.

Five structural findings. (1) **The status sink is capped by the balance
test's own horizon:** the catalog is static — no rarity, no rotation, no
collection-progress UI, no completion achievement (`achievements.ts` has
no cosmetic metric; all 19 are miner/depth/answer/combo/gems-minted) — so
"top end runs out of things to signal" (research #1 below) lands at ~day
30, exactly the horizon the balance test uses. (2) **Zero inter-player
sightlines:** the share badge draws a hardcoded generic gold pickaxe
sprite (not the owned pickaxe, no outfit) and the leaderboard row carries
no avatar. The only audience for a purchased look is the player's own
roster — the game sells outward-facing status items with no audience. (3)
**The affordability test doesn't measure competition:** the invariant
compares the collection against *gross* 30-day gem earnings; a free player
who spends gems on cosmetics while still funding the functional sinks has
no benchmark at all (and the persona never buys cosmetics — all its gems
hit functional sinks — so the guardrail-1 sim is silent on the exact
choice a human faces). (4) **Analytics can't attribute:** `analytics.ts`
carries only the `iapPurchases` count + `firstIapPurchaseDay` — no
line/item/path (gems vs pack) granularity, so guardrail 5 can't say which
cosmetics carry revenue. (5) **Doc-drift footnote:** the Stripe sync
script and the `docs/store-integration.md` §2 header say "26 products" but
the catalog table — and the code — is 25 packs, one per paid cosmetic; a
stale count, harmless, but §2 is the SKU source of truth so the number
should match it.

The research (five sources; quality notes at the end):

+ **Sinks are converters, not containers — and "prestige" is two sinks.**
  Novak's sink framework (itembase / dev.to): every sink is a
  `resource_in → resource_out` conversion, and the usual "prestige" box
  hides two different sinks — the **status sink** (pay money, receive
  visibility/ego; "its only value is that others can see it") and the
  **reset sink** (pay your whole run, receive a multiplier). This game
  has both, cleanly separated: prestige (sink a new shaft) is the reset
  sink, cosmetics are the status sink — and the status sink's named
  failure mode is that "the top end runs out of things to signal".
  Finding (1) above is that failure mode pre-loaded: the reset sink
  can't run out; the status sink runs out by construction at 25 items.
+ **Cosmetic revenue scales with visibility.** The gamedesign.gg
  "cosmetic monetization" glossary: what players buy is "identity and
  status" — player expression and social currency at once — and cosmetic
  revenue "scales with visibility"; the model "thrives where other players
  can see you" (lobbies, kill cams, third-person views), with the
  canonical example being designing the product *around the sightline*
  (Valorant's first-person gun skins). The same entry carries two craft
  notes: a **clarity budget** (cosmetic effect must not erode play
  readability) and **scarcity management** ("rarity is much of the
  value"; re-releasing vaulted items devalues the exclusivity players
  paid for). The academic anchor: Steinnes & Reich (2025, peer-reviewed)
  find young players use skins "to express individuality, attain social
  visibility, and navigate in-group and out-group dynamics" — signaling
  "competence, economic investment and time spent in the game". Findings
  (2) and (3) are both consequences: the signaling function needs an
  audience, and this game's only audience is the player's own roster.
+ **Vanity splits in two, and the game ships mostly one of them.**
  Xsolla's "Vanity sells" separates outward-facing vanity (showing
  identity to *others* — skins, emotes, sprays) from inward-facing vanity
  (embodiment, a personal mix-and-match aesthetic), and singles out
  *decorative environment customization* (the Sims / Hay Day shape) as
  the building-game variant — the cave-theme line is exactly that item,
  and the reroll randomizer is a strong inward-facing mechanic. The
  monetization side: the right *shape* of options matters more than the
  count — for direct sale, curated bundles beat itemized listings, and
  seasonal bundles as the end of a reward chain drive the engagement.
+ **The economy audit asks what the committed player spends in month
  two.** GameGrowthAdvisor's economy-balancing guide (2026-07-14; same
  author family as passes 3/6/10, and notably disciplined — it removed
  two numbers it couldn't source) gives the 5-question audit (map every
  source/sink, per-segment ratios, pinch points, **stress-test the late
  game**: "what a committed player is spending on in month two, and
  whether those sinks are aspirational or absent"). Its inflation-lever
  table names "high-end prestige sinks — extremely expensive cosmetics or
  status items" as the whale-friendly lever, i.e. the lever on a static
  25-item catalog is raising the ceiling, not adding features. It is
  also the source for the sink-first design discipline: sinks designed
  before sources — which is exactly what the balance test encodes.

Candidates (documented, trigger-gated — **`cosmetics:analytics` landed in
iteration 17, the collection surface partially in iteration 23, the rest
not planned, none shipped without the trigger**):

+ ~~**`cosmetics:analytics`**~~ — per-purchase event granularity on the
  guardrail-5 event log: line, item id, path (gems vs pack), gem balance
  at purchase. A pure `analytics.ts` addition on the existing buy/grant
  paths; no UX. The cheapest candidate and the precondition for every
  other trigger in this pass — which lines carry spend is currently
  unanswerable. **DONE (iteration 17, 2026-07-16):**
  `recordCosmeticPurchase` + `CosmeticPurchaseEvent` in `analytics.ts`
  (bounded newest-last log, cap 100, parse sanitizer + cap, summary
  rows in the Settings debug panel); the engine fires it from `buyCosmetic` / `buyCaveTheme` on completed gem buys (mirror-guarded, path "gems", post-spend balance) and `MinesOfDoom`'s IAP grant effect fires the "iap" path for newly granted items only. ~15 new test assertions across `analytics.test.ts` / `useGameEngine.test.ts`; zero UX change.
+ **`cosmetics:collection`** — a collection-progress surface: per-line
  owned counts ("5/14 outfits"), the next-missing item highlighted, a
  completion reward that stays earnable (a free-only cosmetic or a
  minerals bonus — nothing pay-gated, guardrail 1). The aspiration ladder
  the static catalog lacks; turns the 1,675 💎 ceiling into a visible
  runway. The save already holds the owned lists; the surface is
  IapPanel/settings UI + one achievement metric. **Partially landed
  2026-09 (iteration 23):** the progress surface is DONE (the menu
  sheet's Collection view — per-line owned counts, per-group + total
  progress, see §3 and the DONE entry in "Engagement / progression");
  the two unlanded legs are the next-missing highlight and the
  completion reward/achievement (pass 16 finding (1): `achievements.ts`
  still has no cosmetic metric). Candidate for the remaining legs, not
  planned.
+ **`cosmetics:visibility`** — give the cosmetics a sightline, cheapest
  leg first: the share badge already has the pixel-sprite pipeline, so
  draw the owned pickaxe sprite (palette-tinted) instead of the hardcoded
  gold pickaxe, putting the player's look on the one surface the game
  already shares. The leaderboard-avatar leg is the expensive one
  (Pocketbase submit payload gains an outfit/pickaxe id pair) and lands
  only if the badge leg shows demand. No new mechanics — the displayed
  items already exist. Candidate, not planned.
+ **`cosmetics:ceiling`** — raise the status-sink ceiling per research
  #4: a higher-cost cave-theme tier (the line with the most headroom —
  recolors, no new art assets) or a *display-only* featured rotation
  (what's highlighted in the panel rotates; nothing is removed and
  nothing becomes exclusive — guardrail 3 bans fake scarcity, and the
  scarcity note says a vault devalues exclusivity, so a rotation is
  re-illumination, not a vault). Requires re-running the guardrail-1
  benchmark (the collection-cost / 30-day-income invariants) and the
  §2 SKU-table regeneration. Candidate, not planned.

**Rejected, with reasons** (so they aren't re-litigated): (1) *gem packs
/ direct currency IAP* — a currency pack turns the cosmetic packs from
"convenience" into "speed up the whole gem economy", and the guardrail-1
benchmark (collection vs free gem income) stops measuring what it should
the moment gems become purchasable; that is a monetization-model change
deserving its own pass + the SKU regeneration, not a candidate. (2)
*gacha / lootbox cosmetics* — randomized access to earnable items is
odds-disclosure territory (the pass-6 compliance section), a dark
pattern (guardrail 3), and flatly against guardrail 4, which the
one-product-one-item store is built on. (3) *cosmetics with mechanical
effects* — the clarity note plus the F2P-viable promise: cosmetics stay
zero-power; the pickaxe `feel` (swing timing/bounce) is the line the game
already walks and stays feedback, never payout. (4) *paid rerolls* — the
free unlimited reroll is what makes identity two-dimensional (palette ×
seed); charging per roll turns self-expression into another grind, and
paying for a random look is the dark pattern guardrail 3 exists to
forbid.

Source quality per the pass-6 discipline: #1 is a designer's blog / tool
pitch (dev.to crosspost of itembase.dev; qualitative, framework-level —
but the status-vs-reset distinction matches this game's code 1:1, which
is why it leads); #2 is a vendor design reference (gamedesign.gg glossary
— same source family as passes 8/13/15, qualitative) with its academic
anchor peer-reviewed (Procedia Computer Science 2025; abstract only — the
full text is paywalled from this machine, the quoted finding is from the
abstract); #3 is a vendor sales reference (Xsolla monetization marketing;
the outward/inward split is standard across the cosmetics literature, the
bundle advice is self-interested to a web-shop vendor); #4 is a vendor
design reference (GameGrowthAdvisor 2026-07-14 — same family as passes
3/6/10; the article itself removed two numbers it couldn't source, which
is why it's cited). No source in this pass carries a hard benchmark:
cosmetics here are a gem sink, not an IAP funnel, and no published
number constrains a 25-item catalog — so the pass output is structure +
candidates, not targets.

**Not re-audited here:** the IAP storefront / SKU / entitlement plumbing
(`docs/store-integration.md`, the Stripe sidecar — a separate layer), the
free-path persona design itself (guardrail-1 benchmark methodology), the
sprite/theme art pipeline, and the sound feel (pass 13, inputs).

### The offline / absence math layer (pass 17 — what the mine does when the player isn't there)

Passes 3–16 audited everything that happens *while the player is looking at
the screen*; the one axis never audited as a system is the layer that runs
when they aren't — the offline/absence math (pass 15 named it as the next
axis; pass 16 took cosmetics instead). Live audit (2026-09-08,
`game.ts`, `useGameEngine.ts`, `useAdRewards.ts`, `dailyBonus.ts`,
`weeklyChallenge.ts`, `session.ts`, `ads.ts`): away time is paid through
**two different mechanisms** depending on whether the process restarted.

+ **Load path** (app/tab restarted, or fresh launch): on load,
  `computeOfflineMinerals` pays `miners × minerPower per tick` × elapsed
  seconds since the last save, at the **full passive rate** (prestige
  multiplier included), capped at `maxOfflineTicks` = **8 h** — plus two
  ad offers the haul earns: `offlineDouble` (watch an ad → the whole haul
  again) and, only when the 8 h cap was actually hit, `offlineTopUp`
  (watch → +2 h of extra haul, `offlineTopUpTicks`). A welcome-back toast
  shows the number. Load-offline never credits `playSeconds` and never
  mints gems (gems stay tap/answer- and faucet-gated, `gemChance` applies
  only to live answers — the gem economy is deliberately untouched by
  absence).
+ **Background path** (app backgrounded / tab hidden, no restart): the JS
  event loop freezes, so the tick loop's next fire computes
  `elapsed = now − last` (real elapsed, capped at the same 8 h) and pays it
  out as ordinary passive income — **full rate, no ad offers, no toast**,
  and — the key asymmetry — the whole caught-up `elapsed` is added to
  `playSecondsRef` (`useGameEngine.ts`, the tick loop's `playSecondsRef.
  current += elapsed` is unconditional; there is no visibility/AppState
  handler that resets the loop's `last` baseline on resume).

Five structural findings. (1) **The honest-clock violation:**
  `SaveData.playSeconds` is documented as "lifetime ACTIVE time …
  foreground/active time only — offline earnings and away time never count"
  (`game.ts`, and `session.ts` repeats "ACTIVE time only"), and the load
  path honors that — but the background path pays away time *and* books it
  as play time, so a player who backgrounds the app for 8 h a day inflates
  the records panel's play-time stat by up to 8 h/day while an equivalent
  player who quits the app books 0. Same absence, different accounting,
purely by which process boundary the player crossed. (2) **The 8 h cap is
per-continuous-absence, not per-day:** backgrounding in <8 h chunks (or
keeping the app backgrounded on Android overnight) pays each chunk in full,
so a 24 h away-time spread over several foreground touches is paid ~24 h of
passive income, while the same 24 h as one closed-app gap is paid 8 h + 2 h
ad-top-up — the cap and the top-up's "only meaningful when the away time
exceeded `maxOfflineTicks`" premise are both bypassable by chunking, and
the top-up's gate (`elapsedTicks <= maxOfflineTicks → 0`) never even
triggers on a chunked absence. (3) **Clock jumps are unhandled but
community-standard-tolerated:** `now − saveTime` with no high-water mark
means a +24 h device-clock jump + restart farms the full 8 h haul (repeat
per restart); a backward jump is safe by construction (`now ≤ saveTime`
→ 0). The indie-forum consensus (the two forum sources below) is that the
system clock is player-controllable with no robust offline-only counter,
and that for a non-competitive single-player idle the severity is low —
consistent with this codebase's overall cheat posture (derived-state goals,
no server as time oracle). (4) **Full-rate offline is the generous end of
the genre norm:** offline pays 100 % of the passive rate, where the
reference design (source #1) describes offline as "usually calculated" at
close-to-current rate but *typically earning at a slower effective rate
than active play" — which this game still achieves indirectly, because the
active session also carries tap, equation and combo income that absence
cannot. Note, not bug: the rate is the selling point, and gems staying
offline-immune is the load-bearing choice that keeps it safe. (5) **The
absence-retention surface is thin where the habit literature says it
bites:** the daily streak (`dailyBonus.ts`) hard-resets on any missed local
day — no grace day, no shield — while the streak-design literature (sources #4/#5) names the one-missed-day hard reset as the #1 burnout trigger and the grace-day/freeze as the standard anti-burnout pattern; the weekly
contract at least re-snapshots baselines on a missed week without penalty,
which is the correct absence posture. The ad pair (`offlineDouble` /
`offlineTopUp`) is a good return-time reward surface; the missing piece is
the *next-session* one (the streak), where a single travel day kills a 7-day
run for a game whose core audience (pass 15: 13+ casual) has exactly
travel-day absences.

The research (five sources; quality notes at the end):

+ **The cap is the genre contract, and the cap is normally an upgrade
target.** HustleTycoon's own design doc (source #1): offline earnings
credit "your income rate at the moment you close the game … up to some
maximum limit", "almost every idle game limits how much offline time it
will credit, often expressed as a maximum number of hours" — because
uncapped away-time "would undermine the point of playing at all" — and
"most games let you raise the cap through permanent upgrades, purchased
with a prestige or premium currency". It also names the gate this game
already mirrors: only *automated* producers earn offline (here: only
miners — taps and equations are active-only, correct by construction). The
one lever this game doesn't expose is the upgrade-able cap; its +2 h ad
top-up is the partial substitute (ad-gated, not currency-gated).
+ **Offline progress is a delta-time illusion, tuned for 30-min–2-h
rhythms.** GeekExtreme's idle-math overview (source #2): offline
progression is "an illusion powered by mathematical delta-time calculations
that fast-forward your state upon login, not a continuously running
background server" — which is exactly this engine's shape (the tick loop's
catch-up *is* the delta-time fast-forward) — and that the most engaging
ids optimize for "30m to 2h rhythmic check-in sessions". That rhythm
confirms the 8 h cap sits well above the natural session cadence (a
deliberately generous cap), and confirms finding (2) is about player
*behavior* (chunking), not about the cap value being wrong.
+ **Clock-cheating: no offline-only counter, low severity outside
competitions.** Two indie-forum threads (sources #3/#6): the GDevelop
"[SOLVED] checking time offline without player abuse" thread concludes
"any offline time checks … will require the system clock, which will always
be player controllable" and settles on not stressing about it absent
"a heavy multiplayer, online game"; the GameMaker "how to prevent players
from time-cheating" thread is the canonical "+8 hours" scenario (the
player's clock is pushed forward, the game pays the idle window) — the
exact unhandled path in finding (3). The standard cheap mitigations named
across both threads are all client-side bookkeeping (monotonic
high-water marks, treating large forward jumps as zero), none of them
server-side — and none of them fool a determined player, which for a
single-player idle with no economy crossing between players (the
leaderboard is submit-and-merge, pass 5) is the right trade.
+ **Streaks die on the one missed day; the fix is the grace day, not the
shield economy.** Yu-kai-chou's streak-design analysis (source #4): the
missed-day reset is "the moment users feel the system is against them",
and the design rules that keep streaks past day 30 are small forgiveness
mechanics — and the habit-tracker literature (source #5) quantifies the
pattern: "one grace day per 30 days — a single miss doesn't reset
anything" prevents "the most common failure mode" (a 30-day habit streak
wiped by one travel day). This is the evidence base for the
`offline:streak-grace` candidate; note the literature's warning that
streaks without forgiveness "build habits or breed anxiety" — the
anxiety is the failure mode guardrail 3 (no dark patterns) cares about.

Candidates (documented, trigger-gated — **none planned, none
implemented**):

+ ~~**`offline:active-clock`**~~ — **DONE 2026-09-12** (iteration 13,
  autonomous pick as the pass's only bug-class item): in the tick loop,
  split live ticks from caught-up ticks for the play-time clock —
  `playSecondsRef` now advances only by `activePlaySeconds(elapsed,
  activeRef)`: zero while the app is not active (AppState on native,
  AppState + `visibilitychange` on web), and capped at `LIVE_PLAY_TICK_CAP`
  (2 ticks) while active, so the first fire after a background gap pays
  the full mineral catch-up but books at most two seconds of play time.
  Pure helper + constant in `game.ts` (`activePlaySeconds` / `LIVE_PLAY_
  TICK_CAP`), tests in `game.test.ts`; the mineral catch-up payment stays
  exactly as-is. No UX, no migration (the stat is a display-only record
  — already-credited inflation was not worth migrating down).
+ **`offline:clock-hwm`** — mitigation for finding (3), the standard
  client-side bookkeeping the forum sources describe: a monotonic
  `timeHighWater` timestamp in the save, advanced on every tick/save;
  a forward jump of the device clock beyond a small tolerance (e.g. a
  few minutes of observed drift) is treated as manipulation and pays 0
  for that jump (the jump is *not* trusted as away time), while backward
  jumps already pay 0 by construction. Small `game.ts` addition +
migration-v11 field + tests; it does not make the clock trustworthy
  (source #3's point), it only removes the free 8 h farm. Candidate, not
  planned — and explicitly low priority per the same sources: severity is
  low for a non-competitive single-player.
+ ~~**`offline:streak-grace`**~~ — **DONE 2026-09** (iteration 14,
  autonomous no-signal pick; finding (5), the habit-literature fix): the
  daily streak no longer hard-resets on a single missed local day —
  `computeDailyClaim` now bridges a one-day gap (`isTwoDaysAgoLocal` +
  `graceAvailable`), the streak continues at its previous count + 1
  (the skipped day neither counts nor breaks the run), and the grace is
  at most one per rolling `STREAK_GRACE_WINDOW_DAYS` (30) measured off a
  new optional `lastGraceDay` field on `DailyBonusState` — absent until
  first use, so old persisted state needs no migration (the field lives
  in the isolated `dailyBonus` AsyncStorage key, not the save). The grace
  is automatic and free (guardrail 1), the counter is real and bounded
  (guardrail 3), and there is no UX surface: a bridged claim shows the
  existing streak toast, a failed bridge (two+ missed days, or a used-up
  window) resets to day 1 exactly as before. The shield/freeze *item*
  variant remains rejected (below); the free grace day was the whole
  candidate. Tests in `dailyBonus.test.ts` (streak-grace describe).

**Rejected, with reasons** (so they aren't re-litigated): (1) *reduced-rate
offline mode* (the common 50 % offline convention) — a pure nerf to
existing players for no retention gain; the genre's "slower effective
rate" (source #1) is already satisfied structurally because absence earns
none of the tap/equation/combo income, and the cap, not the rate, is the
control that keeps offline from replacing active play. (2) *offline gem
income* — it would turn the gem economy into a time function (gems per
hour away), invalidating the pass-16 gem-income benchmark the
affordability invariants are pinned to, and it removes the only
active-play gate on the premium currency the cosmetic lines are paid in;
the load path's gems-immunity is deliberate and load-bearing. (3) *
server-side absence accounting* (Pocketbase as the time oracle) —
source #3's conclusion applies: the system clock is player-controllable
either way, the device is the source of truth by design (cloud save is
an LWW *copy*, pass 5), and adding a server round-trip to the earn path
buys
none of the security a competitive game needs — it buys latency and a new
failure mode for an idle game. (4) *win-back / return-timer push
mechanics on absence* — the reward surface for absence must exist at
return time (an absent player can't tap "watch"), and the two ad offers
already occupy that slot; scheduled push is pass 9's win-back layer with
its own triggers, not this pass's. (5) *streak shields as a purchasable
item/upgrade* — the grace day (candidate 3) is the forgiveness the
literature prescribes; a second, purchasable forgiveness tier is
monetization scope-creep on a retention stat and edges toward selling the
player back the streak the game just broke (the guardrail-3 shape), with
no benchmark to tell us it's wanted.

Source quality per the pass-6 discipline: #1 is a vendor design reference
(HustleTycoon's own in-genre design doc — self-interested to a game
vendor, but describing its own shipping mechanics, which is exactly the
comparative data this pass needs; the cap-as-upgrade and
automated-only-offline claims are the load-bearing ones); #2 is a
vendor/SEO math reference (GeekExtreme — the delta-time framing is
textbook and matches this engine's code 1:1, which is why it's cited
rather than its marketing sections); #3 and #6 are community forum
threads (GDevelop "[SOLVED]" + GameMaker — anecdotal and
day-to-day, but they are *the* canonical discussion of this exact
problem class, the SOLVED marker on #3, and their consensus — "no offline
counter, low severity, cheap client-side bookkeeping" — is the
anti-over-engineering guard for finding (3)); #4 is a practitioner
analysis (Yu-kai-chou, the gamification reference behind the
`yu-kai-chou` model — design-pattern level, no benchmarks, but the
missed-day-reset finding is consistent across #4 and #5); #5 is a
vendor blog (Keelify habit-tracker marketing — the one-grace-day-per-30
figure is a design choice, not a benchmark, and is cited as the
pattern, not as a number to copy). No source carries a hard benchmark:
offline math is a genre convention, not a measurable market rate, so the
pass output is structure + candidates, not targets (same as passes 13/16).

**Not re-audited here:** the rewarded-ad reward implementation itself
(`ads.ts` / `useAdRewards.ts` internals — pass 6 monetization), the
in-session idle reminder (`useIdleReminder` — a foreground UX surface),
cloud-save LWW merge and leaderboard submit (pass 5), and the OS-level
push/deep-link return path (pass 9 win-back / pass 10 store presence).

### The prestige / reset math layer (pass 18 — what “New Shaft” actually is)

Passes 3–17 audited every other layer; the prestige / reset system (“New
Shaft”) had been touched only as a multiplier passed into the offline math
(pass 17) and never as its own system. Live audit (2026-09-15, `game.ts`
`PRESTIGE_LEVELS` / `getPrestigeLevel` / `getPrestigeMultiplier`,
`useGameEngine.ts` `sinkNewShaft` + the three earn sites, `PurchaseButtons.tsx`,
`goals.ts` `PRESTIGE_UNLOCK_TIER`): “New Shaft” is a **stepped, lifetime-keyed
multiplier on a soft reset** — the gentlest reset in the genre, gated by the
strongest anti-spam invariant this codebase has.

+ **The reset is single-axis (soft).** `sinkNewShaft` (the engine) zeroes only
  the *minerals axis*: `minerals → 0`, `miners → 0`, `fastMiners → 0`,
  `legendaryMiners → 0`, `clickPower → 1`, `minerPower → 1`. Everything else
  is preserved: the *premium axis* (`gems` + the three gem-line levels
  `gemChanceLevels` / `comboResistLevels` / `clickBoostLevels`), all cosmetics
  (owned + equipped), all lifetime stats (including `lifetimeMinerals` itself,
  which the multiplier is keyed to), `completedTiers` / achievements / goals,
  and the run’s `startTime` / `playerSeed`. Depth is lifetime-mining based
  (pass 15), so the depth-tier click bonus survives the reset untouched. The
  one lifetime counter that *does* move is `totalPrestiges` (the record panel
  reads it) — the reset leaves a scar on the record, not on the progression.
+ **The reward is a stepped multiplier, not a currency.** `PRESTIGE_LEVELS` is
  a 6-row table keyed by *lifetime* minerals (a stat the reset never reduces):
  ×1 @ 0, ×1.5 @ 5 M, ×2 @ 50 M, ×2.5 @ 250 M, ×3.5 @ 1 B, ×5 @ 5 B.
  `getPrestigeLevel(lifetimeMinerals)` returns the highest rung the lifetime
  total has met; `sinkNewShaft` banks it into `prestigeLevel` (which only ever
  moves up toward it). There is no prestige token, no spend table, no
  “meta-progression shop” — the ×N *is* the whole reward. It clamps to the
  last row, so ×5 @ 5 B lifetime is a hard ceiling with no rung above it.
+ **The anti-spam is the step-gate, and it is the strongest invariant in the
  engine.** `sinkNewShaft` is a no-op unless
  `getPrestigeLevel(lifetimeMinerals) > prestigeLevel`. Because the reset never
  reduces `lifetimeMinerals`, re-prestige is impossible until lifetime crosses
  the next rung — eligibility is a *pure function of an immutable stat*. You
  cannot re-bank the same tier or bank ahead; repeated resets are structurally
  spammed-out, not merely gated. The button mirrors it (`canBank =
  availableLevel > prestigeLevel`) and the indicator dot shares the same check
  (`hasAffordablePurchase`’s prestige branch), so the affordance never appears
  for a reset that would bank nothing.
+ **The ×N is scoped to the minerals axis and deliberately does not touch the
  gem economy.** It multiplies the three minerals earn sites — the passive
  tick (`useGameEngine.ts`’s `getMineralsPerSec × elapsed` through
  `mulFloats`), the load-path offline catch-up (`computeOfflineMinerals` /
  `computeOfflineTopUpMinerals` take it as an argument), and the tap/answer
  mineral gain (`value × clickPower × combo × clickBoost × depthBonus ×
  prestige`) — but it is *not* applied to gem minting (the answer handler’s
  `gem` boolean is independent of the multiplier) or to any cost curve. So a
  banked ×N makes the free resource strictly faster while leaving the premium
  resource (gems) and the pass-16 gem-affordability benchmark untouched —
  the guardrail-1 F2P invariant survives the reset by construction.
+ **The gate is triple-layered and consistent.** (1) *Content* —
  `prestigeUnlocked = completedTiers.includes("t3")` (the Magma Frontier tier,
  `goals.ts` `PRESTIGE_UNLOCK_TIER`); until tier 3 is complete the prestige
  content doesn’t exist. (2) *Visibility* — the prestige purchase row shows
  once `prestigeUnlocked` **or** `lifetimeMinerals ≥ PRESTIGE_LEVELS[1].at`
  (5 M, the first bankable rung), so it never appears before it could be
  meaningful. (3) *Enable* — the button is enabled only when a new rung is
  actually bankable (`canBank`). Three independent gates, all pointing the
  same direction: the affordance exists exactly when the reset is worth doing.
+ **Structural findings (this layer is healthy — no bug-class item).**
  (1) The soft reset + preserved premium axis is the genre’s loss-aversion
  cushion in its purest form: the only thing a player loses is the fastest to
  re-earn (minerals, and the banked ×N makes it faster), while the expensive
  and the cosmetic (gems, cosmetics, lifetime records) survive. (2) The
  step-gate is a *stronger* anti-spam invariant than the reference designs
  (source #2’s `earned > 0` guard only blocks a zero-currency reset; the
  step-gate blocks any same-tier re-bank by construction). (3) The stepped
  table is the *inverse incentive* of the reference continuous formula: the
  source-#2 `floor(lifetime^exp × mult)` with exp 0.5–0.8 creates diminishing
  returns that reward *frequent small cycles*; the stepped table pays nothing
  between rungs and rewards *one bank per threshold crossing* — prestige here
  is a milestone reward, not a cycle currency, and that is a deliberate
  simplification for a small game (no token to manage, nothing to buy, the
  guardrails stay intact by omission). (4) The 5 B / ×5 ceiling is the one
  layer in the sweep with a hard terminal state (pass 17’s offline layer has
  no such wall) — fine at the current content ceiling, dead UI past it.

The research (two sources; quality notes at the end):

+ **Reset/keep is a spectrum, and this game sits at its gentlest end.**
  HustleTycoon’s idle-prestige overview (source #1) names four reset shapes —
  *soft* (only certain resources reset, core upgrades remain), *hard* (most
  progress resets, permanent meta bonuses remain), *tiered* (sequential
  layers, each resetting deeper portions for a stronger permanent multiplier),
  and *currency-based* (earn a prestige currency proportional to power) — and
  its load-bearing line is the psychological reframe: “players are conditioned
  to avoid losing progress. Prestige systems reframe loss as investment. …
  progress is no longer measured in current stats, but in long-term
  efficiency.” The single-axis reset above is soft reset with a tiered
  multiplier on top; the preserved gem + cosmetic axis is exactly the
  “permanent bonuses remain” clause that makes the reframe hold.
+ **The anti-spam and the “when to offer it” floor are the reference design’s
  two guards, both present in stronger form here.** The Godot incremental-game
  guide (source #2) separates the *token* (prestige currency, earned per
  reset) from the *effect* (the multiplier it buys), and guards the reset with
  (a) a hard block `if earned <= 0 → “not enough progress for a meaningful
  prestige”` and (b) a *suggestion* trigger that only fires at `preview >= 3`
  tokens **and** `run_time > 1800 s` (≥3 tokens and ≥30 min in the current
  run), checked every 60 s — i.e. “never offer a prestige that isn’t worth
  something, and don’t nag for trivial gains.” `sinkNewShaft`’s step-gate is
  the hard-block in its strongest form (a pure function of an immutable stat,
  not a per-reset currency count), and the triple gate above is the
  suggestion-floor: the affordance only exists when the bank is strictly
  positive. The guide’s reset/keep split — “anything that represents player
  skill and knowledge persists; anything that represents in-game resources
  resets” (currency + prestige upgrades + achievements + cosmetics persist;
  gold + items + skills reset) — is the exact principle the single-axis reset
  applies to one resource axis.

Candidates (documented, trigger-gated — **none planned, none
implemented**):

+ **`prestige:currency`** — add a small prestige-*currency* axis on top of the
  multiplier, if player signals show the pure ×N is underwhelming (trigger:
  the guardrail-5 / free-path benchmark shows a large fraction of players
  reaching the tier-3 content but a low `totalPrestiges` adoption — i.e. they
  hit the wall but don’t bank). Source #2’s token shape:
  `floor(lifetimeMinerals^0.6 × k)` earned per bank, spent on a small run-start
  upgrade set (e.g. “start the new shaft with N miners”, a temporary
  multiplier). This adds the “meta-progression shopping” loop the reference
  designs have and gives the reset a second, spendable reason to exist beyond
  the ×N. Larger scope: a new save field (migration), a cost table, a settings
  UI, and interaction with the pass-16 gem-affordability benchmark. Candidate,
  not planned.
+ **`prestige:ceiling`** — extend the table (a tier 6+ above 5 B) or attach a
  continuous tail, only if content ever extends lifetime past 5 B and the ×5
  wall stops being the deep endgame (trigger: a content pass pushes the
  intended endgame lifetime above 5 B). Until then the table is correct and
  `getPrestigeMultiplier`’s clamp is the honest representation of “this is the
  top.” Candidate, not planned — and it is a *content*-gate, not a code bug.

**Rejected, with reasons** (so they aren’t re-litigated): (1) *convert the
stepped table to a continuous currency to match the reference formula* — the
step-gate already achieves the anti-spam invariant more strongly (a pure
function of an immutable stat), and there is no evidence the stepped shape is
felt as coarse; a currency adds a save field + UI + benchmark interaction for
a loop the current design deliberately omits (the same monetization-
model-change-not-a-feature shape as pass 16’s gem-pack rejection). (2) *a
prestige cooldown / timer gate* — the step-gate already makes same-tier
re-prestige impossible; a timer would add state (and a clock surface, the exact
cheat-prone axis pass 17 flagged) to prevent something that cannot happen.
(3) *harder reset (reset gems / cosmetics too)* — destroys the loss-aversion
cushion and the guardrail-1 invariant; a spenders’ cosmetics being wiped by a
free-player’s reset is a pay-to-*lose* shape, and it inverts source #2’s
“skill persists, resources reset” principle (the current soft reset *is* that
principle). (4) *prestige as a purchasable / premium-speed path* — pay-to-win
on the reset itself; guardrail 1 forbids it.

Source quality per the pass-6 discipline: #1 is a vendor/SEO design
reference (HustleTycoon’s idle-prestige guide — conceptual, names the four
reset shapes and the loss-as-investment reframe but carries **no numbers**;
cited for the classification vocabulary and the psychological framing, not
for any threshold). #2 is a single-author community guide (a Godot
incremental-game design doc — the prestige chapter is engine-agnostic and is
the only source with concrete structure: the `floor(lifetime^exp × mult)`
token formula with exp 0.5–0.8 and the “double the currency ⇒ 4× the XP at
exp 0.5” consequence, the `earned > 0` hard block, the `preview >= 3 and
run_time > 1800 s` suggestion floor, and the reset/keep lists; treated as the
*shape* of a reference design, not a benchmark to copy). No source carries a
hard market benchmark: prestige tuning is a content-ceiling question, not a
measurable market rate, so the pass output is structure + candidates, not
targets (same as passes 13/16/17).

**Not re-audited here:** the gem economy and cosmetic lines (pass 16), the
offline/absence math around the offline multiplier (pass 17), the depth-tier
table and depth-lifetime coupling (pass 15), and the free-path / guardrail-1
benchmark that the “×N doesn’t touch gems” finding depends on (pass 4/11).

### The numerical curve / pacing layer (pass 19 — what the cost curves actually do)

Passes 3–18 audited every *surface* the player touches; the one layer
never audited as a system is the one underneath all of them — the
**cost/production curves**: how fast each line's price grows, how fast
its effect grows, and what that does to the *interval* between
purchases (the invariant pass 8 named as unmeasured, citing Pecorella).
Live audit (2026-09-10, `game.ts` cost/effect formulas re-read in full at
HEAD, `freePath.ts` sim, `freePath.test.ts`, `useGameEngine.ts` buy paths)
plus a deterministic re-run of the shipped sim at 30 and 60 days (scratch
instrumentation harness, **deleted after the run** — nothing committed
from it except the numbers below), plus the two research sources in the
header.

**The cost family as shipped** (`game.ts`, all verified at HEAD):

| Line | Cost (to buy the next) | Effect of the next | Curve shape |
| --- | --- | --- | --- |
| click power | `level⁴` (marginals 15, 671, 4,641, 34,481 at n=1,5,10,20) | +1 click power | polynomial cost, **flat** effect |
| miner power | `1,000·n²` (marginals 3,000, 11,000, 21,000, 41,000) | +1 power to *every* miner line | polynomial cost, **compounding** effect (return grows with miner count — the only such line) |
| regular miner | `n⁴ + 1` | +1 miner × power | polynomial, flat effect |
| fast miner | `⌈(n+1)⁴/8⌉` | +1 miner × `⌊power/2⌋` | polynomial, flat effect |
| legendary miner | `⌈2(n+1)⁴⌉` | +1 miner × `2·power` | polynomial, flat effect |
| gem chance | `10(l+1)²` (cap 20 → 25 %) | +1 %/level | quadratic, capped |
| click boost | `25(l+1)²` (cap 4) | `2^level` (×16 max) | quadratic cost, **exponential** effect — the one line where effect growth outruns cost growth; the cap at ×16 is what makes it safe |
| combo resist | `20(l+1)²` (cap 5 → 42 %) | +8 %/level | quadratic, capped |
| gem mint | 100 k minerals | 1 gem | linear faucet |

Versus the genre standard (source #1, Pecorella Part I — the canonical
description): `cost = base × rate^owned` with `rate ≈ 1.07–1.15`, i.e.
**exponential** cost, where "exponential costs will eventually crush
polynomial production" and the pacing loop *is* the cost curve — each
purchase deliberately takes longer than the last. This game runs the
opposite family: polynomial (mostly n⁴) cost with flat-or-compounding
effects. Pecorella's generator-balancing rule (each generator should be
the optimal buy at a different stage) is applied here only in the weakest
sense — see finding 2.

Five structural findings.

1. **Pacing here is income-governed, not cost-governed — the genre
inversion.** Deterministic shipped sim (seed 20260902, `freePath.ts`),
no-prestige runs: 30-day = **97.2 M lifetime** (answers 37.9 M / 39 %, passive
49.6 M / 51 %, daily 6.2 M / 6 %, taps 3.5 M / 4 %, **offline 0**); 60-day =
**286.7 M**. Production: 70/s at D1 → 239/s D10–15 → **296/s D18–30 → 330/s
D45–60** — a 13 % rise across the last 30 days of the run. The D18→D60 wall
is not the cost curve (marginal costs keep falling as a share of income);
it is **income saturation**: every gem line is capped (gem chance 20,
click boost 4, combo resist 5), the sim's own mineral policy caps at
`cpCost ≤ 2,500` and `mpCost ≤ 500 k` (the persona stops there because
beyond it the next upgrade costs more than the day's income), the expected
answer value is flat (E = 30 in the sim; the live equation table is
bounded too), and the prestige multiplier tops at ×5. In the genre model
the wall is "the cost outpaced my income"; here it is "my income plateaued
and the caps stopped the effects from scaling with it". Same felt
symptom (stretching intervals), opposite lever — which matters for every
"pacing feels off" report (finding 5).

2. **The miner trio is a finite-value sink, and its first purchases are the
bargains.** Per-gem marginal efficiency (pps bought per gem, at
minerPower 23): the *first* units — regular 23/gem, **legendary 23/gem**
(46/s for 2), fast 5.5/gem; the *second* units — regular 1.35, fast 1.0,
legendary 0.28; by the fifth — fast 0.068 > regular 0.037 > legendary
0.018; by the tenth all three ≈ 0.002–0.006. Two consequences. (a) The
ordering *inverts* around n≈2–3 (early: legendary/regular first; later:
fast wins) — so the trio is not a single-winner collapse, but (b) every
line's marginal value trends to **zero** (flat production against n⁴
cost): the rational strategy the numbers describe is "buy the first few
of each line cheap, then stop" — the remaining gems either idle in the
hoard or mint-loop. Pecorella's per-generator optimality (source #1) is
only half present: the lines differ by cost offset, not by *role*, so
none of them is the interesting buy at any given stage — they are all
the same buy (flat pps) with different entry prices.

3. **The pass-8 invariant, measured.** From the instrumented 30-day run:
interval-to-next-purchase minimum falls 35 s (D1) → 14 s (D30) — the
cheap lines stay trivially buyable — while the **median** interval
stretches to 17–27 k s (≈ 5–7 h) by D14+: the persona's affordable set
simply runs out and the run becomes a hoard-to-next-capped-line wait.
That is the genre's "production outrunning cost" failure mode (source #1)
in its mildest form: anticipation doesn't collapse, it just stops being
*per-purchase* and becomes *per-cap*. The D30 next-meaningful-purchase
concretely: fast miner #7 costs ⌈7⁴/8⌉ = 301 gems; the D30 hoard is 229
→ ~1–2 days at the run's drop rate. The measurement itself (the
harness) is not committed — candidate below.

4. **The benchmark's offline term is structurally zero.** `freePath.ts`
calls `computeOfflineMinerals(miners, power, fastMiners, /*saveTime*/ 0,
/*now*/ offlineSeconds)` and the function's first guard is
`if (saveTime <= 0 || now <= saveTime) return 0n` — so the persona's
22 h of "offline" time has **never earned anything** in the benchmark
(the call has passed `saveTime: 0` since before the bigint rewrite,
verified by history). The `freePath.test.ts` near-idle test's comment
("offline earnings carry the run") is therefore inaccurate: that run is
carried by in-session passive + active play. Direction of the bias:
real players *do* earn offline (pass 17's load path pays 100 % of the
passive rate for up to 8 h), so the benchmark is **conservative** — a
balance that passes it passes for real players, and the 7-day F2P
assertion holds a fortiori. What it can *not* do is what its comments
claim: guard against a balance that only works offline (such a balance
would pass the benchmark invisibly, and the near-idle persona's margin
would overstate the offline dependency rather than measure it).

5. **Doc drift, minor, fixed here.** Pass 16 quoted "a 30-day free run
grosses 1,946 💎"; the deterministic sim today grosses **1,958** (1,548
drops + 410 mints) — the margin over the 1,675 💎 full-collection
cost is 283 (pass 16 said 271 — same conclusion, near-identical margin).
The quoted figure never appeared in any test or commit (one-off
measurement of a pre-09-08 code state; streak-mode removal `a751060` and
the daily-bonus rework landed around it). The mineral-side 30-day figure
this pass re-ran (97.2 M) is new — no prior doc quote existed to drift.

Six candidates, **documented, not planned** (todo rule): `economy:offline-sim-fix`
— set `saveTime` to the session-end timestamp in the sim so the near-idle
guard actually measures offline carry (benchmark bug fix, smallest of the
six); `economy:interval-metric` — commit the pass-8 invariant as a dev-only
script (or a `--pacing` flag on the sim) and only surface a
"next purchase in ~" readout in-app if a D30+ churn theme names pacing
(guardrail 5: measure first); `economy:miner-trio-roles` — give the three
lines distinct roles per Pecorella's generator balancing (e.g. legendary
as the offline-mechanic tie-in, fast as the combo tie-in) so gem spend
is a choice between *what it does*, not a per-gem efficiency ranking;
`economy:cost-family` — if D30+ pacing ever is the felt problem, the
genre lever is switching the miner lines to `base·rate^n` (rate ≈ 1.07–1.15)
to deliberately lengthen intervals; the buy-all planner (`planBuyAll`
binary search over any monotone cost, `game.ts`) is curve-agnostic, so
the mechanics are already migration-ready — a balance decision, not an
implementation blocker; `economy:wall-diagnostic` — the real endgame
walls are the 1.5 B t5 goal and the 5 B final prestige level (the sim
runs the whole no-prestige run at ×1, so even the 286.7 M D60 figure
overstates how far a ×1.5–×5 prestige'd player is from t5); what a
D250+ player does is an open question and a candidate *additive* D30+
mechanic in the PaperPilot sense (source #2) — only if retention data
shows the wall is felt.

Source quality per the pass-6 discipline: #1 is the canonical genre
document (Pecorella, GDC 2016, full text via Game Developer — the
`base × rate^owned` model and the generator-optimality rules are the
primary reference for the cost-family finding); #2 is community
practice (PaperPilot.dev balancing guide — the inflation rules and
"caps as controlled inflation" vocabulary; treated as practice, not
benchmark). As in passes 13/16/18, no source carries a market
benchmark for curve shapes — curve choice is a design decision the
sim's numbers constrain but do not settle.

### The performance / rendering layer (pass 20 — what a second of this game costs)

Passes 3–19 audited every surface the player touches and the math under
them; the one layer never audited as a system is the cost of keeping the
app alive — re-render cadence, per-frame animation, particle caps, and
the delivery size behind the first paint. Pass 11 audited the OS-side
vitals (crash / ANR / battery / memory) and deliberately changed no code
"unless the numbers say so" — but the repo has **no performance
instrumentation at all** (no frame or startup measurement anywhere), so
that decision had no numbers to act on. This pass audits the code at
HEAD, measures the artifacts that exist, and brings two benchmark
sources for the delivery-size side only.

Live audit (2026-09-09, at HEAD — `useGameEngine.ts` loop,
`animationClock.ts`, `MiningCanvas.tsx`, `Miner.tsx`, `DebrisParticles.tsx`,
`BlockBreak.tsx`, `FloatingTextLayer.tsx`, `CaveBackground.tsx`,
`useSounds.ts`, the `dist/` export):

+ **Tick** — `msPerTick = 1000` (`game.ts`); one timestamped `setInterval`
  (`useGameEngine.ts`) with `maxOfflineTicks`-capped catch-up. `setGameState`
  allocates only when passive income > 0, so the root re-renders **once
  per second with miners, zero times without**.
+ **Per-frame motion** — one shared `Animated.Value` clock
  (`utils/graphics/animationClock.ts`) with deterministic per-miner phase
  offsets; native driver on native, JS driver on web.
+ **Roster** — max 50+50+50 miners + player = **151 memoized `Miner`
  views**; sprites lazily baked (emoji-art fallback path).
+ **Particle caps** (the code's own comment: avoiding RN's "Excessive
  number of pending callbacks" on the JS driver): debris MAX 12 /
  80 ms min interval / 600 ms, floating text MAX 16, block break MAX 5.
+ **Memo coverage** is wide (~30 memoized components) but `gameState`
  flows into `MenuPanel` etc., so the per-tick top-level re-render is real
  and shallow — the leaf views under it skip.
+ **Canvas** — plain-View responder instead of Pressable (the web
  double-render fix, noted in code).
+ **Artifacts (measured this pass)** — web entry JS **1.57 MB raw /
  420 KB gzip**, single file, no code splitting; `dist/` total 3.1 MB;
  assets 1.5 MB, of which the 20 s cave-ambience WAV is **640 KB** — the
  largest single asset and the only audio file over 10 KB (created
  *paused* at mount in `useSounds.ts`, so the fetch is at first play, not
  load). No APK/AAB artifact in the tree — the Android download size is
  **unmeasured**. No `preferredFrameRate` config, no frame or startup
  instrumentation.

Four findings.

1. **The architecture already implements the docs' own recommendations**
   (source #1): per-second state re-render instead of per-frame, one
   shared animation driver, capped pending animations, memoized roster,
   transform-based pocket scale (scale over width/height is exactly the
   expensive-path warning in that doc). What is unknown is not
   *probably-fine*, it is *unmeasured*: the root re-render — a 1,692-line
   component plus the full header row — is the exact shape of source #1's
   "root state change re-rendering an expensive subtree, 200 ms, 12
   dropped frames" example, and it happens once per second.

2. **The web's continuous per-frame cost is JS-driven.**
   `useNativeDriver: true` is ignored by react-native-web, so every frame
   is one clock tick + ~151 miner interpolations + DOM transform writes
   at the display refresh rate (60–120 Hz). Capped and presumably fine —
   but it is the largest *continuous* cost in the game, the only one that
   runs every frame regardless of what the player does, and it is the
   only cost with no number next to it.

3. **The delivery-size side is healthy against both benchmarks.** 420 KB
   gzip JS is comfortably inside the 3 s / 53 % threshold (source #4) on
   any modern mobile connection; the one heavy asset (the 640 KB WAV) is
   off the load path. Android is the open question: no AAB in the tree,
   no measurement, and source #3's benchmark (≈1 % install conversion per
   +6 MB, pre-AAB data) says size is the one delivery number that moves
   conversion — so the honest state is "comfortable on web, unknown on
   Android", not "small everywhere".

4. **No gate.** CI (currently disabled; typecheck + lint + tests when
   enabled) would not fail on a frame regression. The particle caps are
   data-driven constants and the only defense; nothing would flag a
   future feature that adds an unbounded JS-driven animation.

Four candidates, **documented, not planned** (todo rule):
`perf:tick-measure` — one-shot release-mode measurement of the per-tick
root re-render (React profiler, or `performance.now` around the render)
logged locally (guardrail 5), the smallest and most informative of the
four; `perf:web-startup` — `performance.mark` the web load (bundle eval →
first paint → first tick) and log it locally, giving the 3 s / 53 %
benchmark (source #4) a real number; `perf:android-size` — build one
release AAB and record download vs installed size against source #3
(measurement only, no code change); `perf:audio-lazy` — only if
`perf:web-startup` shows the WAV on the critical path, defer
`createAudioPlayer(ambientLoop)` to first un-mute play. Rejected:
120 Hz (`preferredFrameRate`) — a 1 s-tick idler with a 1 s-period bob
gets zero visible gain at extra per-frame cost (source #1's frame-budget
math); rasterization flags — source #1 warns of the memory cost itself and
there is nothing to rasterize; React Compiler — SDK-level, not justified
at a once-per-second re-render cadence.

Source quality per the pass-6 discipline: #1 is the official mechanism
reference (authoritative on the JS/UI thread model and native driver; the
200 ms / 12-frames figure is an *example*, not a benchmark); #2 is
official but numberless (direction only — "smaller apps … higher install
success rates"); #3 is a 2017 vendor benchmark (pre-AAB, snippet-verified
— illustrative, per passes 4/6/11); #4 is the 2016 Google research stat
(re-cited; no newer primary data located). As in the earlier passes, no
source carries a benchmark for *this game's* per-second cost — only a
release-build local measurement can be the honest number (guardrail 5).

Not re-audited here: the OS-side vitals (pass 11), the service-worker /
PWA caching and delivery strategy (pass 12), and the native build
pipeline (R8 / Play App Bundling) — all three need a release build, not a
repo read.

### Player-facing surfaces

+ **Home-screen widget** — ~~+ idle reminders~~ (the in-app idle reminder
  is DONE 2026-09 — `idleReminder.ts` / `useIdleReminder.ts` + settings
  toggle, see §2). No `expo-notifications` / widget anywhere in `src/`:
  the OS-level "come collect" push remains; must stay a simple reminder
  (no dark patterns). Pass 3 adds the permission reality (2026): push is
  an earned grant on both platforms (Android 13+ `POST_NOTIFICATIONS`
  runtime prompt), so the work is the UX around it — ask after a
  success moment, never at launch, single-shot; track grant rate as a
  first-class metric; always send value (the offline-haul cap
  "your miners hit the cap" is the natural one), cap frequency, and
  never an empty "come back" ping (those buy opt-outs).
+ ~~**Sound volume controls**~~ — **DONE 2026-09** (todo "sound volume
  controls"): the SFX volume — 0–100% (default 100%), a settings row
  stepped in 10% units, `clampSoundVolume` in `game.ts` keeping parsed or
  hand-edited values in range, applied to every expo-audio player by
  `hooks/useSounds.ts` (mute toggle still wins). See §3 "Sound".
  Per-sound toggles stay open if they ever earn their place.
+ ~~**Music / ambient loop**~~ — **DONE 2026-09** (todo "music /
  ambient loop"): the cave-ambience bed — a 20 s exactly-periodic looping
  WAV synthesized in-repo (`scripts/generate-ambient-loop.mjs`), played
  under the SFX at half the sound-volume level by `hooks/useSounds.ts`
  (player loop flag, independent `musicVolume` level via `musicLevel`,
  paused while muted /
  music-off / backgrounded), settings toggle `settings.music` (on by
  default). See §3 "Sound". Per-sound toggles stay open if they ever earn
  their place (see the sound-volume note above).
+ **More languages** — en/es only; the i18n table machinery
  (`utils/i18n/`) makes adding locales cheap, and the kid-skewed audience
  argues for more coverage eventually.
+ ~~**Share images**~~ — **DONE 2026-09** (todo "share images"): a pure-TS
  320x180 PNG badge (pixel font + pako PNG encoder) shared via
  expo-sharing (native) / Web Share API files (web), degrading to the
  plain-text share on any failure (`shareBadge.ts`, `shareImage.ts`,
  `shareImage.web.ts`). See §2 "Share badges".
+ **Deep/universal links** — none; save transfer is clipboard-only
  (`saveCode.ts`).

### Social / meta

+ **Friends / social leaderboard** — global top-10 exists; no
  Game Center / Play Games friend feeds, no friend-list leaderboard.
  Pass 4 adds the friend-*streak* data point from the Duolingo teardown:
  users with ≥1 friend streak are **22 % more likely to complete their
  daily lesson** (up to 5 parallel friend streaks, both parties must
  play the same day) — the cheapest social mechanic that survives a
  small player base, alongside the community-milestone idea below.
+ **Daily-challenge leaderboard** — the daily equation is identical for
  every player (day-key seed), so a first-solve speed or bonus-claimed
  ranking is trivially fair without an anti-cheat model beyond the
  honest-casual caps the existing leaderboard already uses
  (`leaderboard.ts`). The math-game version of the genre's daily
  reward loop; reuses the live Pocketbase leaderboard endpoint. Good
  candidate for the "real social loop" the genre roundups call out.
+ **Guilds / community goals** — genre-common in bigger idle games;
  requires backend work on the existing Pocketbase deployment. The
  pass-3 research refines *which* social mechanic survives a small
  player base: the solo-player-safe ones — asynchronous goals where
  solo players benefit from other people's activity without anyone
  being online (a shared community-milestone bar toward a collective
  reward, backed by the existing Pocketbase aggregation; the
  leaderboard already proves the endpoint pattern). That is the
  cheaper first step toward this item, and it can be ranked against
  it: a community milestone is a guild-lite.
+ **Kids mode / parent screen** — **NOT a launch requirement:** the S6
  decision (2026-09-08, `docs/security-audit.md`) chose option (b) —
  teen+ (13+) positioning, not child-directed — so no
  verifiable-parental-consent gate is needed at launch. This item is
  the landing spot if the stance ever flips to kid-directed (the
  revisit trigger: post-launch data showing heavy under-13 usage —
  COPPA 2025's "directed to children" test weighs user composition).
  A voluntary, non-COPPA parent area (time limits, ad opt-out surface)
  can still be built for goodwill at any time. See the
  "Compliance (pass 6)" section above.

### Deliberately absent (guardrails, not gaps)

+ Interstitials / native display ads — banned permanently (rewarded-only).
+ Fake scarcity / fake timers — banned (no dark patterns).
+ Pay-to-win gates — all content is free-path reachable (`freePath.ts`).
  Paid-UA creative and audience-segmented store pages — gated by
  guardrail 5 (measure before scaling); see the pass-10 canon pins in
  "Store presence & the pre-install layer".
+ Device-motion input (shake-to-X tropes — the accelerometer is the one
  input a motor-impaired player cannot use, and no verb here would need
  it), landscape / dual-thumb (no dual-stick genre; the
  portrait-is-canonical pin), and voice / social input (no real-time
  social surface exists) — pass 13, the input-side absences.

  These show up on genre checklists and are listed here so future passes
  don't "discover" them as missing.

### The persistence / data-integrity layer (pass 21 — the save blob is the game, written 2026-09-09)

Everything the player owns lives in one AsyncStorage key
(`saveDataKey` — a ~1.5–2 KB JSON blob carrying `saveVersion` 11) plus
a handful of independent keys (settings, equation settings, the
daily/weekly day-stamps, the analytics state, the cloud-save toggle +
last-sync, the device id, the auth token). This pass audits the
integrity of that state end to end — load, store, migrate, back up,
sync, export/import — and brings in the literature pass 16 (the
cloud-save design itself) deliberately left out: what "persistent"
actually guarantees, and what client-clock last-write-wins can silently
do. The design reviewed here is stronger than the genre norm in its
recovery paths and weaker in its observability; the candidates below
are the observability half.

**F21.1 The local lifecycle already treats loss as detectable at load
time, and that is the correct posture for the contract the dependency
actually provides.** Load = read → `JSON.parse` →
`migrateSaveData` (per-version steps 0→11, each lenient and clamped) →
`buildSaveData` (per-field clamp/filter, BigInt minerals as strings) →
online pay-up. Read or parse failure → the raw bytes are backed up to
`saveDataKey + ".corrupt"`, a `saveLoadFailed` flag is set, a fresh
save starts with a toast, and cloud launch-recovery (once per launch,
ignores the user toggle, provider-live only) pulls the stored backup
through the same import pipeline (`hooks/useGameEngine.ts:
restoreFromBlob`). Store failure toasts `saveFailed` and the next
periodic autosave (5–600 s, default 30 s) retries. Nothing on the
dependency side is stronger than this: the AsyncStorage 2.2.0 README's
entire persistence contract is its opening sentence ("an asynchronous,
unencrypted, persistent key-value storage system") — the README, FAQ,
and usage doc state no quota, no eviction, no update/reinstall
semantics (the FAQ covers serialization and batch atomicity only). The
pinned 2.2.0 shipped source confirms the web backend is
`window.localStorage`, so the pass-12 MDN quota/eviction analysis
applies to the web save directly; the current v3 docs (SQLite /
IndexedDB backends) do not apply to this pin. Truncation or a wipe is
therefore always visible at the next load (unparseable → the
`.corrupt` path) — "detect at load, back up, recover from cloud" is
exactly what this contract warrants, and the code does it.

**F21.2 The `save.corrupt` backup is an orphan, and the failure class
has zero instrumentation.** The backup is written (and unit-tested) but
nothing reads it: no settings row, no restore path, no event. It is the
only forensic record of a destroyed save, and it is invisible to both
the player and the team. Likewise, neither a detected corruption nor a
repeated write-failure produces an analytics event — the toast is the
whole signal. Under guardrail 5 ("measure before scaling"), the one
failure class this game can least afford to be blind to (progress loss)
is the only one with no event.

**F21.3 The cloud LWW is the literature's risk class, bounded to a much
narrower failure than the general case — but its one silent path is
unobservable.** The server keeps `max(stored, pushed)` by client
`updatedAt` (a tie goes to the push — `stored > pushed` is the only
stored-wins branch, so it is deterministic), caps timestamps at year
2100 (a sanity fence, not a skew bound), and caps the blob at 16 KB
(the save is ~2 KB; 8× headroom). The sources state the general failure
precisely: wall-clock LWW lets "the device with the faster clock win,
even when its edit was older," with "no error in your logs" (codewith-
karani's 40-minutes-fast example), and the loss is "undetectable after
the fact"; its fixes are server-controlled ordering (version numbers +
409, or per-field server sequences) and "log every resolution"
oneuptime adds bounded-skew rejection and HLCs as the clock-side
variants. Against that, the actual blast radius here: (a) per push the
loss window is ≤ the 5-minute push cadence of play; (b) the stale path
restores the server-held blob into the pushing device, so a *linked*
device whose clock runs persistently fast (by more than the cadence)
while holding an older save can roll the correct device's state back —
but cross-device scope requires sign-in (anonymous backups are
device-scoped), so the risk is opt-in and bounded to linked players;
(c) the stale outcome is already visible to the client (`res.status ===
"stale"`) yet is neither logged nor surfaced — the "no conflict log" item
from both sources is the one gap this game actually has.

**F21.4 The save code is the weakest link in the trust chain, by
design.** No checksum, no MAC, no end sentinel: `decodeSaveCode`
accepts the `MOD1` prefix *or* any raw base64 JSON. The genre's
reference point (Cookie Clicker, the wiki's Save article) appends an
`!END!` trailer to its base64 save string as a portability marker —
ours has no such shape marker, and a truncated paste decodes to a
partial JSON that is then *clamped into a valid-looking save* rather
than rejected, because the import rides the same lenient pipeline as
stored saves (clamp/filter/NaN-guard: garbage degrades silently). The
import UI does carry a confirm modal (guardrail 3 is met at the consent
level), but the player is never told what a given code *does* —
including that an out-of-range value was clamped or an unknown id
dropped — so a "successful" import can be a quiet downgrade. The
transparency gap, not the trust gap, is the finding.

**Candidates (documented, not planned)** — in rough order of value per
line:

+ `corrupt-backup-surface` — a settings row ("last corrupt save —
  restore / discard") that reads the `.corrupt` key: restore rides
  `restoreFromBlob`, discard removes it. Turns the orphan forensic
  record into a second recovery path (it covers exactly the case where
  no cloud backup exists: web, or cloud never synced). Pairs with a
  corruption event (day, `saveVersion`, byte size).
+ `stale-resolution-event` — the client already knows when a push loses
  (`stale`); log it (reason, the pushed-vs-stored `updatedAt` delta).
  The minimum of the sources' "log every conflict resolution" list, and
  the delta is the skew measurement this game can't get any other
  way.
+ `save-failure-event` — on the Nth consecutive failed local write, log
  one event. A write-failure loop is a quota/backend problem, and the
  toast is today's only signal.
+ `save-code-checksum` — a trailing 16-bit FNV-1a over the JSON folded
  into the code's tail (plus the optional `!END!`-style sentinel for
  shape), so a truncated paste *fails* instead of clamping into a
  partial save; keep prefix-free decoding for legacy codes and report
  "imported, N fields clamped" instead of a bare success. The
  checksum-only half is strictly safe; the sentinel half is cosmetic.

**Source-quality notes (pass 21).** AsyncStorage: official README +
FAQ + usage docs, all checked — the absence of any persistence
guarantee is the finding, not a research gap; the web-backend claim
(`window.localStorage`) is verified in the pinned 2.2.0 shipped source
in-tree. The v3 docs' SQLite/IndexedDB backends do not apply to this
pin — a version-pin trap for any future "the docs say" citation in this
layer. codewithkarani: vendor post-mortem; the 40-minute figure is an
example, not a measurement — used as a failure taxonomy, not data.
oneuptime (2026-01): vendor reference write-up; its NTP-100 ms /
1000 ms numbers are its own examples. cookieclicker.wiki.gg: community
wiki, the genre-canonical save-code reference. Reddit
(r/incremental_games "I lost all of my saves"; r/idleslayer "cloud save
and lost progress"; a Territory Idle save-corruption thread): titles
only — the fetches were JS-blocked, so they confirm this failure class
is genre-common, not the details. No official AsyncStorage eviction or
quota numbers exist; F21.1's point is that the contract is the
sentence, not that the sentence is wrong.

Not re-audited: the Pocketbase schema/migrations (endpoint contracts
are pass 16's), auth-token storage (the 2026-09-14 optional-login
section), the analytics pipeline internals (pass 2026-09-02), the
offline-earnings math (pass 15), and pass 16's "the cloud is a backup,
not a sync" decision (unchanged — this pass audits the LWW edges of
that decision, not the architecture). Meta note: several earlier
section headings carry day-level dates (e.g. "2026-09-18") that are
later than the git commit dates of the same passes (2026-09-08/09);
flagged here, history not rewritten.

### The audio / feedback layer (pass 22 — what the player hears, written 2026-09-09)

§3 ("Sound", "Haptics") documents the settings surface; this pass
audits the audio system itself: one hook (`hooks/useSounds.ts`) owning
7 `AudioPlayer` instances (generic pickaxe, stone, 4 per-pickaxe
swing WAVs, the cave-ambience bed), 7 asset files in
`public/assets/audio/` all synthesized in-repo by deterministic scripts
(`generate-pickaxe-sounds.mjs` + `generate-ambient-loop.mjs`, asset
net in `scripts/__test__/ambientLoop.test.ts`), and two pure scale
functions in `game.ts` (`clampSoundVolume`, `clampMusicVolume` /
`musicLevel`). It is checked against (a) the pinned dependency's actual
contract (expo-audio 57.0.4; docs fetched this pass) and (b) the
genre canon of looped / dynamic game audio (sources below). Haptics
are in scope only where they couple to sound: they don't — `haptics.ts`
is a parallel channel.

**F22.1 The SFX trigger map and throttles — audit, no contract
violations found.** Five trigger sites, per-`SoundKey` throttles
(capped replays, not per-player): mine-tap 60 ms (`useMineTaps.ts`),
correct answer 60 ms, gem pocket 80 ms, wrong answer 150 ms — both the
penalizing and the soft-penalty-free paths (`MinesOfDoom.tsx`). The
two keys are `"pickaxe"` and `"stone"` regardless of which file plays:
the generic pickaxe mp3 and the 4 per-pickaxe WAVs share one 60 ms
lane, which is the intended behavior — one swing per tap, from whichever
file the equipped id selects (`pickaxeSoundFiles`, keyed by pickaxe id;
unknown/corrupt ids fall back to the generic asset so a bad save can't
silence mining). `replay()` re-creates expo-av's "cancel + restart"
semantics on top of expo-audio's `play()`, which the shipped source
states never rewinds (playing → pause + `seekTo(0)` → play; finished →
`seekTo(0)` → play; fresh → play) — the restart is explicit, correct.
Mute is checked at trigger time; volumes are applied by an effect on
settings change while the 7 players are created once (the creation
comment records the per-click re-render tick-budget fix). Every API
surface used (`play` / `pause` / `seekTo` / `volume` / `loop` /
`currentTime` / `playing`) is unqualified in the fetched docs — `volume`
is 0.0–1.0 (the hook divides by 100), `loop` is a plain flag, `seekTo(0)`
is the least-error-prone seek target.

**F22.2 Sound is the flat channel of the juice loop.** Visuals scale
with gain magnitude (`juice.ts` wave count drives the canvas waves) and
haptics scale with it too (the in-module `10 + 4·(waves-1)` ms tap
tick, capped at 30 — verified in `haptics.ts`), but sound does not: a
5-crystal mine and a 500k-crystal mine play the identical ~0.2 s clip.
Sound is the only juice channel that ignores `juiceWaves`, and the one
the genre sources treat as the reward signal (the VGM article:
soundtracks "reward ... specific achievements"). Two related absences:
(a) no dedicated reward SFX — the gem pocket rides the generic
`pickaxe` clip (its "success" haptic is a two-step `[0,15,60,15,40]`),
and the depth-milestone toasts (the 10 m boundaries) and depth-tier-
entry toasts are display-only (no audio, no haptic — verified at the
effect sites); (b) no ducking — SFX never dip the bed while playing
(the Wikipedia sound-design article's named "adaptive mixing"
technique); the mix is static, which works at the defaults because the
bed is quiet by construction (the generator normalizes its peak to
0.55, "the bed sits under the SFX at the same volume"), but a 100% SFX

+ 100% music setting has no automatic priority order.

**F22.3 The ambient bed is correct-by-construction — and one track for
all content.** 20 s, 16 kHz mono, 16-bit (320k samples, 640 KB),
seamless by construction: 4 pad partials at 27.5 / 55 / 82.4 / 110 Hz
(all integer multiples of 1/20 Hz — the generator's own NOTE),
integer-cycle amplitude LFOs (1 / 2 / 3 / 2 cycles, free phases), a
period-preserving circular box low-pass on the deterministic noise bed
(width 65 samples → first null ≈ 246 Hz, "air, not hiss"), 5 drip
blips with two echoes each confined to [1.5, 18.5] s so they never
land in the fade zones, peak normalized to 0.55, and a redundant
0.35 s head/tail fade ("belt-and-suspenders"). Deterministic: mulberry32
seed 4242, asset net in `scripts/__test__/ambientLoop.test.ts`. That
matches the genre canon exactly (Wikipedia "Loop (music)": "The musical
loop is one of the most important features of video game music"; the
VGM history: Space Invaders' looped melody, Dig Dug stopping its music
while idle, Frogger's 11 adaptive tracks — looped and *conditional*
audio is the canonical technique). The bed is stateless: identical
across all 5 `DEPTH_TIERS` (Surface Caverns → Crystal Kingdom), all 10
`CAVE_THEMES`, and all modes — tier transitions and theme purchases
re-color the cave but never touch the audio. It is on by default
(`settings.music`), rides the independent `musicVolume` scale (default
50 — the former half-level law's default experience, DONE item in the
player-facing layer below), and pauses on muted / music-off / backgrounded (AppState), the player's
`loop` flag alone making it seamless.

**F22.4 Dependency-contract findings (expo-audio 57.x docs, fetched
this pass).** (a) *Lifecycle:* the docs state explicitly that
`createAudioPlayer` players "may cause memory leaks" unless the caller
removes/releases them, and name the lifecycle-managed alternative
(`useAudioPlayer`, not used here). The hook's cleanup pauses all 7
players and nulls the refs but never calls `remove()` — bounded in
practice (root-screen hook; unmount is app exit) but the cleanup does
not do what the docs ask of `createAudioPlayer` callers. (b) *Web
autoplay — likely silent, unverified:* the bed's `play()` fires from a
mount effect with **no user gesture**; browsers gate non-muted
`play()` behind a user gesture, the rejection is swallowed
(`void p.play()`), and the effect only re-runs on
`appActive` / `muted` / `music` — so on web the ambient bed is likely
permanently silent, unlike on native. SFX are unaffected (they play
inside gesture handlers). A related edge the docs state: audio also
stops when the headphone / Bluetooth device unplugs, and the app has no
explicit re-arm path beyond the same effect deps. Flagged as **likely,
not verified** — see source-quality notes. (c) *iOS silent switch:* no
`setAudioModeAsync` anywhere in `src/` (verified), so
`playsInSilentMode` stays false and the silent switch mutes the game —
genre-correct; do **not** "fix" this by enabling `playsInSilentMode`
(a flipped switch should silence the cave). (d) *Android background:*
the docs' ~3-minute background stop without lock-screen controls is
moot because the AppState pause fires first — double insurance, keep
the AppState pause.

**Candidates (documented, not planned)** — in rough order of value per
line:

+ ~~`web-ambient-unlock`~~ — **DONE 2026-09-10** (bug-fix inside the web
  sign-in e2e work, commit `49c472f`): `useSounds.ts` gesture-gates the
  ambient bed — web `play()` is held until the first user gesture
  (`gestureSeen` state; a blocked `play()` rejection is swallowed
  rather than leaking as an unhandled pageerror), and native delays the
  bed from boot to the first tap. The F22.4(b) hypothesis (permanently
  silent on web) was right: the fix is exactly the one-time gesture
  unlock this item proposed. Remaining residue, if it ever matters: the
  audio-state event for guardrail-5 visibility (no longer needed to
  make the bed play).
+ `reward-sfx-set` — dedicated one-shot SFX for the reward moments that
  ride generic clips today: combo tier-up, the depth-milestone toasts,
  the gem pocket (synthesized, same deterministic-script family —
  highest-frequency reward moments first). Guardrail: none of them may
  be purchase-gated — sound must never become a paywall.
+ `sfx-gain-scaling` — scale audio with gain the way haptics already
  do: a pitch or loudness step per juice wave (or wave-count layering
  mirroring `juiceWaves`). `haptics.ts` is the precedent (10 + 4
  ms/wave, capped 30) — sound is the only juice channel ignoring
  `juiceWaves`.
+ `tier-ambience-variant` — one bed variant per depth tier (5 generated
  files, same pipeline — the integer-harmonic construction is already
  parameterized by `DUR`) — the Frogger-shaped genre answer. Theme-
specific audio is a separate, larger candidate; the 10 cave themes
  stay audio-silent for now.
+ `bed-ducking` — dip the bed N dB for T ms while SFX play (adaptive
  mixing). Only worth it after `reward-sfx-set` raises SFX density; at
  current density the static mix is fine at the defaults.
+ `player-cleanup-remove` — `player.remove()` in the `useSounds`
  cleanup to match the documented `createAudioPlayer` contract
  (F22.4(a)). One line; fold into any future touch of that file rather
  than shipping alone.

**Source-quality notes (pass 22).** expo-audio official docs
(docs.expo.dev, fetched this pass; the page is the *latest* version,
read against the pinned 57.0.4 — the API surface this hook uses, the
`createAudioPlayer` memory-leak clause, `playsInSilentMode`, and the
background-stop behavior are quoted from that page; nothing cited there
is marked deprecated on it). Wikipedia "Video game music", "Loop
(music)", "Sound design": tertiary/encyclopedic, used **only** for
genre canon (looping as the canonical game-music technique, dynamic /
conditional audio, adaptive mixing as a named technique), not as design
authority — the VGM article carries `[citation needed]` markers in
places this pass does not rely on. The F22.4(b) web-autoplay claim is
**inference** (browser autoplay policy + the code path), not
expo-audio-documented behavior — treat it as "likely, verify with a
manual web check" and do not cite it as fact. The `gamedesignpatterns`
.com audio-design pattern was attempted and unreachable at fetch time —
**not** cited, and this pass was not blocked on it (the three retrieved
sources cover the canon used).

Not re-audited: the haptics patterns themselves (pass 13 / §3
"Haptics"), the synthesized assets' musical quality (subjective, out of
scope), the settings rows' i18n (pass 14), and the rendering budget
(pass 20 — audio playback is native and outside that pass's scope).

### The goal / achievement layer (pass 23 — the two retention axes, written 2026-09-09)

Scope: two pure modules — `goals.ts` (191 lines, the 5 tier chain) and
`achievements.ts` (103 lines, the 19 badges) — plus the two completion
effects in `MinesOfDoom.tsx` (~665–720), the idempotent engine
updaters (`useGameEngine.ts` `completeTiers` / `completeAchievements`),
one UI panel (`GoalsPanel`, Menu → 🎯), and the leaderboard upload.
§2 carries the settings-level summary; this pass is the mechanic +
integration audit, checked against the achievement genre canon (sources
below). These are the game's explicit retention surface.

**F23.1 Two-axis design — gates vs. celebration, over the same stats.**
The two modules are deliberately split: **goal tiers** are the
*content spine* — 5 sequential tiers (t1 Prospector's License → t5
Motherlode), each an AND of 3–4 goals over lifetime metrics, with
`getCompletedTierIds` returning the longest prefix (a tier can't complete
before its predecessors even if its stats are already high). The six
`*_UNLOCK_TIER` constants make the chain gate every major purchase line:
t1 miner power, t2 fast miners + gem chance, t3 prestige ("New Shaft") +
gem upgrades, t4 cave themes, t5 legendary miners + hard mode — each gate
reads `completedTiers.includes(...)` at the purchase site. **Achievements**
are the *celebration* axis: 19 independent badges over 6 metric families
(miners owned 1/5/10/25, gems minted 1/10/50/100, max combo 25/100/250,
max depth 10/50/150/500, lifetime correct 100/1000, lifetime minerals
1M/1B), each a one-time mineral bonus; the module doc is explicit —
"they never unlock content … the minerals are the confetti". Both axes
derive from the same 9 `GoalMetric` lifetime stats, and completion is
always *derived* (`metric >= target`), never a mutable flag: the save's
`completedTiers` / `completedAchievements` only record which
celebrations already fired, and the engine updaters are idempotent (a
double-fired dev updater can't pay a bonus twice). That matches the
genre canon (Wikipedia: achievements as mastery-signaling meta-goals
whose purpose is to "extend the title's longevity" — in-game systems
rather than a platform profile, which the article notes is standard for
long-form games). The metric axes deliberately overlap the tier targets
(depth 10/50/150/500 appears in both), so the same milestone is
celebrated twice by design (tier toast + badge toast) — confetti and badge
landing on the same stats on purpose.

**F23.2 The tier chain is cross-gated with prestige — and the shared
names are deliberate.** t3 unlocks prestige; t4 requires *one* prestige;
t5 requires *three* — so the endgame content (cave themes, legendary
miners, hard mode) is unreachable without actually running the
pass-18 reset loop, a deliberate coupling of the content spine and the
prestige loop. The tier names that collide with depth-tier names are
intentional, not a bug: depth tier 3 "Magma Frontier" (entered at 150 m,
`game.ts`) shares its name with goal tier t3, whose depth goal is exactly
150 m; likewise depth tier 4 "Crystal Kingdom" (500 m) and t4 (depth
goal 500 m). The two toasts stay distinguishable ("Entered Magma
Frontier!" vs "🏆 Magma Frontier complete! … unlocks …"); t1/t2/t5 use
names no depth tier uses. Audit: the gates read the celebration record,
which in-app code only fills from derived completion — no purchase or
debug path sets a tier id without the metrics (the save-code import
trust model is pass 21's, not this layer's).

**F23.3 The economics — confetti by construction.** Tier bonuses step
×10: 5k / 50k / 500k / 5M / 50M (total 55.555M). Achievement bonuses
range 500 → 500k (total 1.185M across all 19, the largest single being
mine-1b's 500k). Both updaters add the bonus to `minerals` **and**
`lifetimeMinerals` — self-consistent "everything ever earned"
semantics: a bonus can push the player across a lifetime target (mine-1m/
mine-1b, t5-lifetime), but there is no feedback loop since each
celebration fires once. Relative size: t5's bonus (50M) is 5 % of its
tier's lifetime target (1B); mine-1b's (500k) is 0.05 % of 1B. The
confetti is biggest relative to the curve early (t1's 5k lands when the
player's totals are in the thousands — the D1–D7 era per pass 19's
curve) and negligible late, which matches the canon: Wikipedia notes
achievements can be "fulfilled without needing to provide the player
with any direct, in-game benefit", and only *some* implementations add
in-game perks (its example: TF2 class milestones) — this game adds none.
Coverage gap: the achievement set stops scaling at the endgame — the
three lifetime metrics `totalPrestiges`, `totalGemsSpent`, and
`minerPower` exist in the `GoalMetric` union but appear in **zero**
achievements, so a t4/t5 player (the only players who prestige at all)
has no new badges past mine-1b.

**F23.4 Integration-surface audit.** Completion effects
(`MinesOfDoom.tsx` ~665–720): derived ids minus celebration record →
idempotent updater → toasts. Tiers: one 6-second toast per newly completed
tier plus a single "success" haptic. Achievements: multiple first-
completions in one render collapse into a single toast (up to 3 names +
"+N more") — the comment notes the anti-spam-on-save-load rationale —
plus one "success" haptic. UI: a single `GoalsPanel` lists all 5 tiers
with per-goal progress bars, shows what each completed tier unlocked, and
carries the achievement badge list below — one surface for both axes
(`CollectionPanel` is the cosmetic collection, unrelated). Leaderboard:
the upload payload includes the achievement-id set
(`completedAchievements`) alongside bestDepth / maxCombo /
lifetimeMinerals — the badge set is the social-status axis; tier
completions are not uploaded (implicitly derivable, not stated). The one
real gap: `analytics.ts` (the guardrail-5 record) has **no** tier or
achievement events — free-path progress is proxied by
`firstPrestigeDay` + prestige counts, so the gate moments themselves
(first t1 unlock = first purchasable line; t3 = the prestige gate) go
unmeasured.

**Candidates (documented, not planned)** — in rough order of value per
line:

+ `analytics:tier-milestone` — one first-occurrence local-day field per
tier (t1–t5) on the existing analytics record (same shape as
`firstAdViewDay`), measuring the gate moments directly instead of via
the prestige proxy. Guardrail 5: local, no PII, fits the record's
existing one-shot-day pattern.
+ `endgame-achievements` — extend `ACHIEVEMENTS` to the three uncovered
axes (`totalPrestiges`, `totalGemsSpent`, `minerPower`) so the badge
list keeps scaling into the t4/t5 era.
+ `achievement-payback` — a small permanent per-achievement effect (the
genre variant Wikipedia names: "Some implementations use a system of
achievements that provide direct, in-game benefits"). Scope: save field
+ economy tuning + a guardrail-1 F2P check (trivially satisfiable —
the payback keys to achievements a free player can earn).

**Source-quality notes (pass 23).** Wikipedia "Achievement (video
games)" (fetched this pass): tertiary/encyclopedic, used **only** for
canon — the definition (mastery-signaling meta-goal), the purpose
(longevity / "impetus to do more"), the secret-vs-achievement
distinction, the in-game-benefit variant, and the origin timeline
(Activision 1982 → Xbox 360 Gamerscore 2005 → Steam 2007). Its
reference [1], Hamari & Eranti's 2011 DiGRA paper "Framework for
Designing and Evaluating Game Achievements", is peer-reviewed but is
cited here **only via the reference list** and was not fetched
directly — no specific claim is attributed to it. The Cookie Clicker
achievement-payback lore (per-achievement click-power bonus) was
**not** cited in the original pass (Fandom 403, Exa still 429).
**Re-pull note (2026-09-09):** the wiki mirror (cookieclicker.wiki.gg,
fetched — Fandom is still 403) was reached, and it corrects the lore:
payback is **not** a direct click-power bonus, it is the **milk**
mechanic — each normal achievement grants +4% milk (622 normal
achievements → max 2488% milk), milk thresholds unlock the Kitten
upgrade series, and each Kitten multiplies CpS (all 17 kittens at max
milk ≈ 1.17×10¹³ CpS, per the wiki's worked example). So the folklore
the `achievement-payback` candidate was chasing — a *permanent
per-achievement effect* — is real but indirect: the reference title
makes achievements the backbone of the production curve, not of click
power. That strengthens the candidate (shape: a small per-achievement
permanent production bump, milk-style) and gives Wikipedia's general
in-game-benefit statement its concrete reference-title instance.

Not re-audited: the leaderboard internals (the Social / meta section,
covered in pass 24), the gate cost curves (pass 19), the
save-migration semantics of `completedTiers` /
`completedAchievements` (pass 21), the i18n of the labels (pass 14),
and the depth-tier click-power bonus (a separate surface — pass 15 /
§1).

### The social / leaderboard layer (pass 24 — the scoreboard and its trust model, written 2026-09-09)

Scope: the client trio — provider core (`leaderboard.ts`, 349 lines),
engine-wiring hook (`hooks/useLeaderboard.ts`, 206 lines), and the
single panel (`components/LeaderboardPanel.tsx`, 134 lines) — plus
the server half in the same Pocketbase deployment (`pb_hooks/`:
the `leaderboard` collection in `collections.js`, validation in
`logic.js`, submit/top/rank handlers in `handlerLib.js`) and two
client test suites (290 + 354 lines). The Social / meta section of
§5 holds the feature-level status (✅ implemented, not yet verified
on device); this pass is the mechanics-and-trust-model audit pass 23
deferred. It is the game's only cross-player surface — the one thing
the VPS exists for (guardrails: "a scoreboard, never a paywall").

**F24.1 The client trio.** The provider core is pure fetch round-
trips mirroring `cloudSave.ts`: three POST endpoints (`/api/app/
leaderboard/{submit,top,rank}`), a 20 s timeout, a never-reject
contract, and strict per-field parse validation (`parseRow` /
`parseRankEntry` — malformed rows are dropped, never rendered).
Provider selection is a pure, unit-tested matrix: dev builds → an
in-memory labelled simulation (one row, this device only, module
state — honest, never fakes a populated board); web → no-op
(always; the save-code + local records view cover web); native
production → the real provider, gated on
`isPocketbaseConfigured()`. No-op hides the entry point — the same
rule as ads / IAP / cloud save. The hook adds the policy layer
(F24.2–3); the panel is a dumb memoized renderer (rows, you-row,
name input, refresh, `leaderboard-*` testIDs, both locales of the
seven i18n keys — mechanism pass 14).

**F24.2 Submission — derived lifetime stats only, fire-and-forget.**
What leaves the device is lifetime maxima only: `maxDepth`,
`maxCombo`, `lifetimeMinerals`, the `completedAchievements` set —
read from a ref at submit time so a stale capture is impossible —
and monotone by construction. `requestSubmit()` is called on the
same two triggers as cloud push (the dirty→clean landing of every
local save, plus the prestige run-boundary); it is cadence-gated
at 5 min per attempt — the prestige cadence-bypass applies to cloud
push only; the board submit stays 5-minute-gated. A failed submit
is silent: the board has no status line (the status line belongs to
cloud backup). The display name lives in its own AsyncStorage key,
never in the save blob — save codes cannot carry it, so a restore
cannot resurrect a stale one; default "Digger"; both sides strip
control/whitespace and cap at 16 chars; renaming takes effect on the
*next* submit.

**F24.3 Display — no spinner trap.** A refresh fetches top-10 and
this device's rank in parallel; 60 s in-memory cache (reopen within
a minute is free) and a 5 s tap-throttle on refresh; a loaded board
stays on screen while the refetch runs; a failed fetch swaps in the
"unavailable right now" row. Rows render rank / name / depth /
badge count; the you-row is the pinned rank + depth (or "not in the
top 10 yet"); the trophy button renders only when a provider is
available, and the sim label is appended to the title in dev.

**F24.4 The server half — honest-casual, made concrete.** One row
per `deviceId` (unique index); numeric fields are NOT required, so
a fresh device's first all-zeros submit is legal. The validation
caps are the anti-cheat: `bestDepth` / `maxCombo` integers below
1e9, `lifetimeMinerals` below 1e15, achievement ids ≤ 64 chars ×
1000 — over-cap means the submission is treated as a corrupted save
and dropped, not clamped. Merge is monotone: per-field maxes, set
union of badge ids, display name from the latest submit — a
re-submitted older save cannot move a row backwards, and a reset
device cannot farm a fresh one. Top-N sorts by `-bestDepth` with a
stable `deviceId` tiebreak, limit clamped 1..50 (the client asks
for 10). Rank is the count of strictly-greater rows + 1, so ties
share a rank. When a session is live the row is tagged with
`accountId` and the rank is the best across the account's linked
devices — a reinstall keeps board position from its prior devices —
while no session token means a byte-identical round trip, so login
is never a prerequisite (optional login, §3.3 decision 3). The
write budget is durable (`events` rows — Pocketbase's pooled
runtime has no in-memory state that survives a request): 30 writes
per hour per `deviceId`, **shared across the writing endpoints**
(IAP verify, cloud push, leaderboard submit, auth register) — the
31st write in an hour 429s. GDPR delete covers both scopes:
device (cloudSaves + leaderboard + events; entitlements *survive*
so refunds can still be honored) and account (everything,
including entitlements, and the sessions are killed).

**F24.5 The trust model — and where it drifted from the plan.**
The stance is plan §3.1 decision 4, near-verbatim: "the leaderboard
is a *claim*, not an authoritative score" — the server trusts
monotone lifetime stats plus caps, never re-simulates the game, and
the board is cosmetic: nothing is gated on it, so the only cheating
incentive is top-10 vanity. The genre framing comes from the
Wikipedia high-score canon (source note below): inherently
competitive lists, initials entry since Star Fire (1978), then the
move to central online boards, and the Twin Galaxies era that
invented *verification* (videotaped submissions) — this game
deliberately inverts that, because there is no prize. The shipped
contract drifted from the §3.3 table in ways the plan text does not
yet record (all in the lenient direction, and the plan text should
say so): "1 write/device/hour" → the 30/hour shared budget (a per-
endpoint cap would have starved the board under save traffic);
submit response `{ ok, rank }` → `{ ok: true }` (rank is its own
route and the client doesn't read an inline one); field `name` →
`displayName`; and the cloud-save 16 KB client blob cap (pass 21's
territory; the plan said 64 KB). Also: decision 5's `achievement_
log` collection + `/api/app/achievements/unlock` append-only route
was **not** shipped — badge ids ride the leaderboard submit payload
instead (same data, one row; the append-only log's replay value is
moot while the save blob itself carries the completed set). And
the §4 release-gate checklist still carries the board's on-device
verification as an open item — end-to-end it is unit-tested
client and server but not yet walked on a device, unlike the
rewarded-ads and IAP paths.

**Candidates (documented, not planned)** — rough value-per-line
order:

+ `board-row-enrichment` — `maxCombo` and `lifetimeMinerals` are
collected (client → server → collection → top-row shape) but never
rendered; rows show depth + badge count. Either render maxCombo on
the row (one i18n string + one format call) or drop both fields
from the submit and the collection. The combo axis is the one the
game's own identity lives on (pass 15), so rendering is the better
default.
+ `analytics:leaderboard-open` — first-board-open as a one-time day
field on the existing guardrail-5 record, same shape as
`firstAdViewDay`; today nothing here is measured (Phase 7 is ⬜ —
store-integration §3.4). Local, no PII.
+ `plan-drift-sync` — update store-integration.md §3.3 to the
shipped contract (30/hour shared budget, `{ ok: true }` response,
`displayName`, 16 KB blob cap, no `achievements/unlock` route).
Doc-only; makes §3 re-readable.
+ `web-board-view` — a read-only board on web (the `/top` route is
an unauthenticated POST; only the provider's no-op keeps web out).
Guardrail-3 transparency preserved: plain label, no gating; the
save-code / local-records story is unchanged.
+ `daily-challenge-board` — already listed in the Social / meta
section (first-solve-speed on the day-keyed equations, reusing
this layer's endpoints pattern); cross-referenced here so the two
candidate lists point at one layer.
+ `achievement-log-route` — decision 5's append-only unlock log, if
a durable per-account badge record is ever wanted beyond the board
row. Lowest value: badge ids are already durable in the row, and
the save is the local truth.

**Source-quality notes (pass 24).** Wikipedia "Score (video
games)" (fetched this pass via the MediaWiki API behind the
"High score" redirect): tertiary / encyclopedic, and the article
carries its own "needs rewrite" flag (April 2017) — used **only**
for canon: the high-score-table / leaderboard terminology, the
"inherently competitive" one-upmanship framing, the initials-entry
origin (Star Fire, December 1978), the move to central online
boards with continuously-maintained rankings, and the Twin
Galaxies videotape-verification era as the historical precedent
for verifying claimed scores (which this game inverts by making
the board prize-free). A "Leaderboard (software)" page does not
exist (red link — checked this pass; do not cite it). Exa search
was still 429-rate-limited this pass (as in pass 23), so there was
no industry-side cross-check in the original pass. **Re-pull note
(2026-09-09):** an industry-side cross-check was fetched (boomiestudio
"Secure Leaderboards with Firebase: The Anti-Cheat Guide" — vendor
engineering blog, practitioner tier, not canon). It supports the
*direction* of the shipped trust model: the standard answer to
client-claimed scores is server-side heuristic validation (submit the
run's metadata, not just the score; "speedrunner" and "impossible"
caps; the server writes the row, never the client) — the same shape
as this game's submit contract (derived lifetime stats + server-side
caps + server-side write). It does **not** validate the *lightness*
choice: that article prescribes obfuscation and shadow-banning for
board stakes that actually mean something, whereas this game's "no
prize → caps-only validation" stance is a deliberate inversion of the
industry default, justified by the board being cosmetic. That inversion
remains a repo-plan-text claim (store-integration.md §3), now with the
industry default on record for contrast.

Not re-audited: the `cloudSave.ts` round trip and the restore-choice
UX (pass 21 + store-integration §3.1), the optional-login / auth
session internals (`pb_hooks/README.md` territory), the i18n
mechanism (pass 14), the local Records view (`records.ts` — the 95-
line pure-derivation sibling, the offline half of plan §4.3's
"leaderboard groundwork"), the share-badge flow (separate surface),
and the daily-challenge board (candidate, not shipped).

---

### The endgame / content-ceiling layer (pass 25 — what remains after every named goal is complete)

pass 23 closed the goal / achievement axis at the **t5 boundary** (it
flagged `t6` / the Motherlode arc as the open question — §3.7) and pass 22
had the endgame **economy** in scope but not the endgame **content**. This
pass closes the last unaudited axis: what the game looks like after every
named goal is complete — the t5→∞ arc, the gem currency's post-max state,
cosmetics, achievements, and the goal list itself. **Source-quality note,
carrying the pass 22–24 precedent:** the external genre-canon pull
**failed again** (Exa rate-limited, 3rd consecutive pass; no Brave/OpenAI
keys in this environment), so the endgame findings below rest on the
repo's own code plus **internal convention only** — same status as
pass 22's F22.4(b) web-autoplay claim ("likely, verify manually"). The
genre-claim lines are labelled "internal, not canon-verified" where
they'd otherwise read as category consensus; **a re-pull on 2026-09-09
(after the 3-pass 429 streak broke) sourced one and half of the two —
see the re-pull note in the source-quality section below.**
**F25.1 — The end-state exists and is honest: no hard wall, no
paywall, no fake ceiling** (the guardrail holds at the top of the
curve). Verified: depth is unbounded but **derived** —
`getDepth(lifetimeMinerals) = lifetimeMinerals / 500` (`game.ts`), so the
"depth axis" and the "lifetime-minerals axis" are the same axis in two units
and depth can never stall; every named goal is a derived lifetime stat
(never a mutable flag) that stays complete; cosmetics are all gem-earnable
one-shot buys with nothing gated behind a purchase (the store is
cosmetic-only, per store-integration §3 — and IAP exists in the build);
achievements grant a one-time mineral bonus and **never** gate content
(`achievements.ts`: "they never unlock content, they just celebrate"); and
the prestige multiplier is unbounded. There is no "final screen", no game-over, no pay-to-progress
branch. The F2P guardrail (AGENTS.md) is not just met at the opening —
it's structural at the endgame too. This is a **confirmation** finding,
not a gap; it's recorded because "is there a wall" was the open
question from pass 22's `endgame-economy` scope.
**F25.2 — t5 "Motherlode" is the last named goal; it binds on 1B
lifetime minerals, which puts the player at depth 2,000,000 m — 1333×
past the 1500 m the goal names — while the cave scroll has been frozen
since 850 m** (the tail is a single axis with no named anchors past
t5). Verified in code: the four t5 sub-goals are prestige ×3,
`maxDepth` 1500 m, `maxCombo` 500, and `lifetimeMinerals` 1B
(`goals.ts`). Because `getDepth = lifetimeMinerals / 500`, the "depth
1500 m" sub-goal is the *same axis* as "lifetime 1B" in different units,
and it is met at only 750K lifetime (1500×500) — 0.075% of the way to
the binding 1B target. So **lifetime 1B is the binding sub-goal**, and
at that point the player's depth is 1B/500 = **2,000,000 m**, not the
1500 m the goal labels. Meanwhile the cave scroll is driven by the same
`lifetimeMinerals` (`getDepthTierProgress`) and freezes at 850 m of
depth: the final real tier (Crystal Kingdom, `game.ts` `DEPTH_TIERS` at
500 m) scrolls a virtual `FINAL_TIER_PROGRESS_SPAN` of 350 m and caps
— i.e. 850×500 = 425K lifetime. The free-path benchmark CI pins only
the **opening** (first prestige ≤ 7 days); nothing pins the
time-to-t5. Net: the "Motherlode" destination is a static background
~2,000,000 m deep, the last ~1,999,150 m of it un-scrolled, and the
depth labels in the goal chain are ~1333× shallower than where the
binding target actually lands. Everything else in the tail (miner
count, miner power, combo, answers, prestige) is unbounded and
un-named.
**F25.3 — Post-max, gems have exactly one sink: more miners** (the gem
economy's terminal state is a single monotone spend, not a design).
Verified: the three gem upgrade lines are finite and capped —
`GEM_CHANCE_MAX_LEVELS = 20`, `CLICK_BOOST_MAX_LEVELS = 4`,
`COMBO_RESIST_MAX_LEVELS = 5` (29 levels total, `game.ts`) — and the
only **unbounded** gem spend is miners (`getMinerUpgradeCost`, whose
count is unbounded; fast miners likewise). Cosmetics are also gem
spend but one-shot (a finite set, F25.4), so they run out; there is no
gem sink for achievements or for goals. In the terminal state — every
line maxed, every cosmetic owned — the gem counter is a number that
only buys one thing: another miner. That is the inverse of the
idle-genre "satisfying sink" convention — **sourced on the 2026-09-09
re-pull**: Novak, "Don't Ask What a Sink Gives. Ask What It Eats"
(itembase.dev, also in pass 16's lineage), names this exact terminal
failure mode — "the sink ran out of depth while its source kept
minting… If there's nothing left to buy, the soft currency has nowhere
to go, it inflates into meaninglessness, and the number going up stops
meaning anything" — i.e. a source/sink-rate imbalance, which is
precisely the single-sink gem economy described above.
**F25.4 — The cosmetic collection is finite and complete-able; the
"collection" is the actual endgame, and it's done by a small number
of gem-spend events, not a progression** (internal observation; the
"collection-complete is a real endgame shape" half is partially sourced
on the 2026-09-09 re-pull at the reference-title level — see the note
in the source-quality section below). Verified: `cosmetics.ts` defines the full set —
pickaxes, outfits, cave themes — as a finite, enumerable list, each a
**pure one-time gem purchase**; no achievement gating exists anywhere
in `cosmetics.ts` (achievements grant only mineral bonuses, per
F25.1). There is no "collect them all" meta-goal in `goals.ts` (no
completionist goal), no cosmetic rarity/rotation, no seasonal
cosmetics. So the collection is
**finishable** — a player can own 100% of every cosmetic and the game
has no named response to that (contrast: the goal list names depth,
gems, prestiges, but not cosmetics). This is a candidate, not a bug:
"collection-complete" is a real idle-game endgame shape, and naming
it would cost ~1 goal entry.
**F25.5 — The achievement list has zero coverage of the prestige,
legendary-cosmetic, and collection axes, and its combo axis stops at
half of what t5 demands** (the "achievement tail" is the cheapest real
gap in the layer). Verified in `achievements.ts`: the 19 achievements
cover exactly six metrics — `minersOwnedEver`, `totalGemsMinted`,
`maxCombo`, `maxDepth`, `lifetimeCorrect`, `lifetimeMinerals` — capping
at `mine-1b` (1B), and the combo axis (the closest thing to a "streak")
stops at `maxCombo` 250 while t5 demands 500. There are **no**
prestige-count achievements (the prestige multiplier is the biggest
number in the game and has none), **no** legendary-cosmetic
achievements (the priciest gem cosmetics have no "you collected
this"), **no** collection-complete achievements, and no day/login-streak
axis at all (the daily-challenge board is an unshipped candidate, so
there is no login-streak metric for such an achievement to bind on).
The 19-count is a single flat list with no tiers.
Pass 23's F23.4 already flagged the completion-effect gap; this
narrows it: the **content** of the tail (which achievements are
missing) is the missing piece, and it's data-only (add entries to the
list, no new mechanics).

**Endgame terminal-state itemization** (what "after everything" looks
like, concretely, for the candidate decisions below):

+ **Depth**: derived from lifetime (/500), art freezes at 850 m;
  t5's binding target (1B lifetime) actually lands at 2,000,000 m.
+ **Gems**: earn unbounded, spend is 29 fixed upgrade levels +
  unbounded miners; post-max, one sink.
+ **Cosmetics**: finite set, 100%-ownable, no meta-goal, no rotation.
+ **Achievements**: 19, flat, 6 metrics only, cap 1B; no
  prestige/legendary/collection coverage, combo stops at 250 (t5
  wants 500).
+ **Goals**: 5 tiers t1–t5, t5 = 1B lifetime; no t6, no completionist.
+ **Prestige**: unbounded multiplier, no achievement, no named arc
  beyond "new shaft".

**Candidate additions** (in value-per-line order, none greenlit):

+ `free-path:motherlode-target` (recommended) — pin **time-to-t5** in
  the CI free-path benchmark (it currently pins only first-prestige
  ≤ 7 days). This is the one finding that is a **measurement** gap, not
  a content gap: we don't know how long the tail actually takes, and
  the F2P-viability guardrail is only as good as the benchmark's
  coverage. Cheap (a benchmark assertion), high-value (it's the
  guardrail itself), no new content. Pairs with F25.2: if the tail is
  too long, the fix is a pacing knob, not more content.
+ `endless-biomes` — give the cave scroll a destination past 850 m
  (F25.2). With the corrected numbers the gap is not 650 m but ~2,000,000
  m (the 1B-lifetime binding target), so "extend the span until it
  catches up" is not a design — the realistic shapes are (a) a few named
  deep biomes that re-anchor the scroll periodically (data: new
  `DEPTH_TIERS` entries + tints, the final-tier virtual-span mechanism
  already exists), or (b) accept the freeze deliberately and make the
  end-state background a designed "Motherlode" scene instead of a stalled
  scroll. Medium cost, high value (it's the "Motherlode" name having a
  destination). Gated on the motherlode-target timing first — if the
  tail is too fast, this is premature.
+ `achievements:tail` — fill F25.5: prestige-count, legendary-cosmetic,
  and collection-complete achievements. All data-only — the metrics
  already exist on the save (`totalPrestiges`, the `owned*` cosmetic
  sets), so this is entries on the list, no new mechanics. A
  day/login-streak achievement would additionally need a new
  login-streak metric (the daily-challenge board is unshipped), so keep
  that one out of scope. Directly extends pass 23's
  `achievement:completion` candidate (which was about the completion
  *effect*; this is the completion *content*).
+ `t6` / second-axis surprise — a t6 goal that is **not** depth or gems
  (the only two axes that ever plateau) — e.g. a cosmetics-collection
  goal (F25.4) or a prestige-count goal, so the tail has a *different*
  named destination than "more minerals" (F25.2). Cheapest as a goal
  entry; the design question is what axis it binds on. This is the
  direct continuation of pass 23's `t6` open question, now with the
  terminal-state itemization above to answer it from.
+ `gem-sink:post-max` — a second post-max gem sink so the terminal
  gem counter buys more than one thing (F25.3). The obvious shapes:
  an upgrade the cosmetic lines (rare/seasonal cosmetics as gem
  *progression* not one-shot buys), or a prestige-linked gem sink.
  Highest design risk of the five (it touches the gem economy's
terminal balance, which the cosmetics-balance test guards) —
  recommend it last, after the measurement candidate proves the tail
  actually needs it.

**Source-quality notes for the pass 25 findings** (per the standing
convention, since no genre-canon pull succeeded in the original pass):
the F25.1 confirmation rests on the repo's own guardrail text
(AGENTS.md) plus the store-integration §3 cosmetic-only claim; the
F25.2–F25.5 findings are pure code audit. The two genre-claim lines
("satisfying sink" is the idle-genre convention; "collection-complete"
is a real endgame shape) were **internal, not canon-verified** in the
original pass — the re-pull note below supersedes that for one and
half of them.

**Re-pull note (2026-09-09 — the 3-pass Exa 429 streak finally
broke; searched via DuckDuckGo, not Exa).** (1) **F25.3 is now
sourced.** Novak, "Don't Ask What a Sink Gives. Ask What It Eats"
(itembase.dev/blogs/…, with the dev.to mirror) — full text fetched —
names the terminal single-sink failure explicitly: "the sink ran out
of depth while its source kept minting"; "If there's nothing left to
buy, the soft currency has nowhere to go, it inflates into
meaninglessness, and the number going up stops meaning anything." The
article taxes all idle sink failure as rate problems (source outpaces
a maxed sink; mistuned conversion; exhausted meaning), not content
lists — which is exactly the framing F25.3 needs. Tier: indie
practitioner design blog, not canon; it is the strongest sink-taxonomy
source found on this pull and was already in pass 16's lineage (this
re-pull re-fetched it and confirms the cited passage). (2) **F25.4 is
now partially sourced — at the reference-title level, not the genre
level.** Cookie Clicker wiki (cookieclicker.wiki.gg, fetched): Milk
"is a statistic… directly associated with the player's Achievements
amount"; shadow achievements are defined *by not counting* towards
"achievement completion percentage" — i.e. the reference title has a
completion meter in its UI. Community records of a ~600-hour 100%
achievement run (steamcommunity threads, search snippets only, not
fetched), and a dedicated third-party 100%-tracker site
(cookieclickercalc.com) — completion is a real community endgame
activity in the reference title, with tracking infrastructure. But
nothing on this pull asserts "collection-complete" for the idle genre
as a whole: the only genre-wide guide found (missionszanx "Idle Game
Design: Systems, Mechanics, and Progression") is SEO-thin and not
citable, and the r/incremental_games endgame-design thread was
snippet-only (Reddit extraction blocked). The genre-wide half of the
F25.4 claim therefore stays **internal**. (3) The missionszanx article
is recorded here as attempted-and-rejected so a future pass doesn't
re-cite it. (4) The two genre-claim findings themselves are
unchanged — the re-pull confirmed direction, not structure; F25.2–
F25.5 remain pure code audit either way.

**Not re-audited in pass 25:** the goal/achievement **mechanics**
(pass 23's scope — the tier-chain gating, completion effects, the
GoalsPanel surface), the store/IAP internals (store-integration §3),
the analytics gap (pass 23 F23.5 — the endgame findings above don't
depend on it), the cloud-save round trip (pass 21), and the
leaderboard social layer (pass 24 — the endgame is single-player by
design; the leaderboard reads from it but doesn't change its
terminal state).

### The telemetry / data layer (pass 26 — the measurement surface, written 2026-09-09)

The last unaudited axis. Every prior pass referenced the analytics gap from
the side (pass 4's benchmark table targets it, pass 7's FTUE funnel needs
it, pass 23's F23.4 leaves a named candidate in it); none of them audited
the instrumentation surface itself. The layer has exactly three surfaces,
live-audited this pass:

1. **The guardrail-5 local record** — `analytics.ts` /
   `hooks/useAnalytics.ts`: one AsyncStorage record per device ("no PII,
   no third-party SDK, no network" by documented design), holding one-shot
   day stamps (first open, first ad view, first IAP, first prestige, first
   cosmetic), counters (`d1Retention` / `d7Retention` booleans,
   `activeDays`, prestige / IAP / cosmetic purchase counts) and
   `cosmeticPurchaseLog` (the only per-event log in the game, capped at
   100 rows). Folded in on app open, first ad-watch tap, verified IAP,
   prestige, cosmetic purchase. Read out only as human-copyable
   "Local stats (debug)" text on the Settings → About screen
   (`summarizeAnalytics`).
2. **On-device crash diagnostics** — `crashLog.ts` (5-entry ring with
   dedupe counts), `crashContext.ts` (12-event session trail + 24-key state
   snapshot, in-memory, snapshotted at capture time),
   `crashLogging.ts` (AsyncStorage bridge), two capture nets (render
   `ErrorBoundary` + global `ErrorUtils` handler) and two readouts (the
   crash screen, the About screen).
3. **The pre-staged server side** — the Pocketbase `events` collection,
   created "now so the GDPR delete endpoint can clear it even before any
   endpoint writes rows" (`pb_hooks/collections.js`), currently carrying
   only the per-device write-budget counters (`kind:"write"`) and Stripe
   webhook dedup rows — not analytics.

**F26.1 The guardrail-5 data never leaves the device, and no cohort
denominator exists anywhere.** Everything in the record is per-device
truth. The only off-device paths are the human-copiable debug text and the
save code — and the save code does not include the analytics record
(different AsyncStorage key, `saveCode.ts` serializes the save only). The
server accepts no analytics rows: no endpoint in the Pocketbase client
handler set writes them. So the architecture is pre-staged end-to-end for
an opt-in upload — the row shape (deviceId-keyed `events` rows), the
deletion path (the GDPR endpoint already clears them), the budget
precedent (the write budget already counts per-device rows in that same
collection) — but the channel itself is unwired on both sides. Every
"measure before scaling" number is currently single-player: no fraction can
be computed anywhere, because no device can see another device.

**F26.2 The retention metric is rolling-return, not classic day-N — and
the benchmark it would be compared against is itself contested.**
`recordAppOpen` flips `d1Retention` / `d7Retention` when the player "came
back on a later local day within ~2 / ~8 calendar days" — a
return-within-N-days boolean, flipped at most once, never reversed. That
reads higher than classic day-N (pass 4's AppFollow note already said
so), and the 2-day D1 window sits between classic D1 and classic D2 —
whichever number this device eventually contributes, its definition must
be named at the moment of use (pass 4's rule). This pass's re-pull also
surfaced a benchmark-freshness flag: GameGrowthAdvisor's July 2026
rewrite of its retention page (the same 50+ launch-studio family as passes
6/10/16) reports a measured top-quartile D7 of 7–8% (GameAnalytics 2025,
11,600 games) and calls a 20% D7 excellence target "a category error
rather than ambition" — directly in tension with pass 4's "top quartile
D7 20%+" line (PlayIO). Both lines are live in the Benchmarks section;
the rewrite's stated rule — "if a retention table does not name a primary
dataset with a date and a population, it is folklore" — is the standard
the final table should be judged by. Its two useful re-anchors: the D30
cost arithmetic (cost of a day-30-active player = install cost ÷ D30;
moving D30 from 3.5% to 5% "does the same work as cutting your CPI by
30%") and the staged kill signals ("D7 at or under 4%, the market median,
means the loop is not forming"; "get to playable inside 60 seconds. No
account creation, no settings, no extended tutorial before the first
game" — the latter is pass 7's 60-second rule, independently stated).

**F26.3 The only per-event log is never surfaced.**
`cosmeticPurchaseLog` (line, item, gems, path, day — the pass-16
`cosmetics:analytics` data) is stored, sanitized on parse, and then
unread: `summarizeAnalytics` omits it and no other reader exists. The one
debug surface that can leave the device shows the count, not the rows the
count was built for — recorded-but-unexportable. The mirror image: IAP has
no per-event log at all — `recordIapPurchase` is a bare counter, so for a
25-SKU catalogue "which product sold" is not measurable on-device
(cosmetics get a row per purchase; IAP does not).

**F26.4 Event kinds are dropped at the hook boundary; ad outcomes are
unrecorded.** `useAdRewards` fires `onAdView?.(kind)` carrying the
rewarded kind, but the wiring in `MinesOfDoom.tsx` passes
`onAdView: onFirstAdView` — a no-arg hook — so `recordAdView` stores the
day key only. "Which ad kind did the player first touch" (gem roll vs
offline double vs top-up vs combo save) is lost at the seam. And no ad
*outcome* is recorded at all: the first tap is stamped, but the pipeline's
second-phase results (`rewarded` / `closed` / `error`, pass 12) never are
— the ad pipeline's failure modes (no fill, early close) are invisible to
the record.

**F26.5 The only per-event trail exists only on the failure path.**
Pass 7's FTUE funnel (time-to-core, per-step drop-off, tour completion,
first-session length, session 1→2 conversion) remains uninstrumented;
onboarding dismissal is still the only onboarding telemetry (re-verified
this pass — no analytics field references it). Meanwhile
`crashContext.ts` maintains the game's only per-event trail — 12 labeled
transitions (app start, save loaded, prestige, ad reward, IAP purchase,
reset, daily bonus, weekly contract, equation-of-day, cloud restore, save
imported, data deletion, equations mode) plus a 24-key state snapshot —
but it is in-memory, capped at 12 events, and snapshotted only when a
process actually crashes. The trail's label vocabulary is exactly the
event vocabulary a future pipeline would want; it dies with the process.
Also confirmed still open this pass: pass 23's
`analytics:tier-milestone` (no goal-tier or achievement completion
events) and F21.2 (save corruption / write failure emit no event —
"the one failure class this game can least afford to be blind to … is the
only one with no event"). (One line of doc drift found while auditing:
`analytics.ts`'s module comment said the record holds "the raw session
signals [retention is] derived from" — the record holds one-shot day
stamps and counters, no session signals. Comment corrected, iteration 25.)

**F26.6 (canon pin, not a gap) The crash-first posture is canon, and the
local-only variant is its small-team form.** The 2026 canonical
integration order (the crash-vs-analytics article): crash reporting →
custom crash context / breadcrumbs → basic analytics once the crash rate
is acceptable → funnels / cohorts / A-B only after confident
product-market fit. The game ships steps 1 and 2 fully local (two capture
nets, context trail, ring buffer, two readouts) and none of 3–4, which is
defensible pre-launch — "a crash ends the session before analytics can
record it, and a player who can't launch your game at all generates no
analytics events whatsoever" is the argument, and the Play vitals crash
rate is the OS-side aggregate substitute (pass 11). The local-only choice
also matches the 2026 indie-safe posture the privacy-telemetry literature
states ("first-party telemetry that does not collect PII, is documented in
a one-page privacy posture statement, and is opt-in or anonymous-by-design";
the pressures it names: tightened ATT enforcement, Play Data Safety
disclosure of every collected data category, GDPR/DMA second-wave
audits). The privacy statement in `legal.ts` already discloses the local
record ("used only for our own development decisions … readable
on-device … can be deleted there at any time"). What the canon does *not*
excuse is a *permanent* local-only state: a per-device ring cannot produce
a crash rate, and per-device booleans cannot produce retention. The fill-in
trigger is the one guardrail 5 names (the pre-UA-spend decision).

**Candidates (documented, not planned)** — in rough order of value per
line:

+ `telemetry:opt-in-cohort` — opt-in (default off; a settings row next to
  the existing ad opt-in, a11y + copy on both) upload of the *reduced*
  analytics record (day keys, booleans, counters — never the per-purchase
  log, never the save) to the existing `events` collection
  (`kind:"analytics"`, deviceId-keyed rows: the GDPR delete endpoint
  already clears them and the write-budget precedent already budgets
  per-device rows there). The one-page privacy posture is in `legal.ts`;
  the Play Data Safety section gains one data category. This is the only
  candidate that turns per-device booleans into fractions; until it lands,
  guardrail 5 is single-player. (F26.1. The big one.)
+ `analytics:readout-completeness` — surface what is stored: last-N
  `cosmeticPurchaseLog` rows (plus per-product IAP counts, if any log is
  added) in `summarizeAnalytics`, so the debug section reflects the
  record. Cheapest item in the layer. (F26.3.)
+ `analytics:first-ad-kind` — stamp the first rewarded ad kind next to the
  day (the hook already carries it; the fold drops it), and if it's being
  touched, a first-ad-outcome stamp for the `closed` / `error` failure
  modes too. (F26.4.)
+ Cross-references, not new items: pass 7's FTUE funnel events (the
  PostHog docs' event-schema canon and the privacy article's
  one-event-first discipline pin their shape), pass 23's
  `analytics:tier-milestone`, F21.2's failure-class events, pass 25's
  endgame-measurement candidate. All land on the same record or the same
  pipeline; the ordering canon says crash-first is already shipped, so any
  of them may come next — but only the upload channel makes them
  cohortable.
+ Not a candidate: a full event pipeline (PostHog-style). The PostHog
  docs' schema conventions (fixed lowercase snake_case names,
  `category:object_action` shape, `is_` / `has_` boolean prefixes,
  `_date` / `_timestamp` suffixes, never dynamically-named events,
  version-on-revamp) are the reference for *when* any of the above lands;
  the local record stays field-based, not event-based, until an upload
  path exists.

**Source-quality notes (pass 26).** PostHog official docs
(`posthog.com/docs/product-analytics/best-practices`, `schema-management`;
fetched this pass): primary vendor documentation, used **only** for the
event-schema canon (naming, property conventions, fixed names, versioning)
and the backend-over-frontend reliability note — a shape reference for
future event work, not a product claim. GameGrowthAdvisor "Mobile Game
Retention 2026" (2026-03-17, rewritten 2026-07; same 50+ launch-studio
family as passes 6/10/16): used for the benchmark-freshness finding
(top-quartile D7 7–8% with the "category error" framing, the folklore
rule, the D30 cost arithmetic, the staged kill signals, the 60-second
playable line); its numbers cite GameAnalytics 2025 / AppsFlyer Q3 2022 /
Liftoff, which are attributed here **via that page only**, not fetched
directly. GameNeAI "Your first in-game telemetry event" (2026, Unity/
Godot, vendor-flavored): used only for the 2026 posture (the
ATT / Data Safety / GDPR-DMA pressure lines, the "first-party,
non-PII, opt-in or anonymous-by-design" default, the one-event-first
discipline). Bugnet "game-analytics-vs-crash-reporting" (vendor blog,
self-interested — it sells a crash SDK): used **only** for the structural
ordering argument (crash before analytics; crash report and analytics
event are different evidence); its numbers (15% launch-week crash rate,
10%-of-players crash-on-launch) are treated as illustrative, not canon.
opensources.live "Privacy-first telemetry for games": SEO-tier, low
signal; used only for the edge-aggregation / ephemeral-raw-data /
consent-as-first-class-event principles, flagged as such — it supports
nothing load-bearing. Exa was 429-rate-limited throughout the initial
pull; sourced via DuckDuckGo per the re-pull convention.

Not re-audited: the crash ring's own mechanics (`crashLog.ts` dedupe /
ring internals — the Adjust-plan surface), the ad pipeline's second-phase
outcomes (pass 12), the leaderboard trust model (pass 24), the
save-corruption backup surface (pass 21), and the write budget itself (its
`events`-collection usage is read here only for the pre-staging).

### The discoverability / information-architecture layer (pass 27 — how the player finds what the game has, written 2026-09-09)

The one surface the per-axis passes never treated as an axis in its own
right: where the features live on the screen, and how their arrival is
announced. Pass 7 audited what the player is *taught* on day 0 (the tour
content); pass 10 audited discoverability *before install* (the listing);
nothing has looked at the navigation itself — the header row, the menu
sheet, and the "hidden until configured" rule. The canon this pass pulls
is thin and vendor-flavored (flagged in the source notes below); it is
used for *shape* only, never for thresholds.

The surfaces (live-audited this pass):

1. **The header row** — a single wrapping `View` at the top of the game
   column holding every non-canvas entry point: menu (☰, "the entry
   point to every other top-row button's settings and to save/account/
   goals"), save (💾, icon-only, dirty-amber pulse), daily bonus (🎁/🌙),
   weekly contract (📜), daily equation (📅), leaderboard (🏆, rendered
   only while the provider is available), ad rewards (🎬, same gate), and
   the shop (🛍️, rendered always — "the gem buy is the universal path").
   The upgrades button deliberately sits *outside* the row (it floats over
   the canvas); the row's docstring records the placement trade: "the old
   footer moved up so no entry point sits behind the OS keyboard."
2. **The menu sheet** — a 7-tab BottomModal (Settings / Save / Account /
   Goals / Records / Collection / About) with no tab gating. The Account
   tab and its cloud-save section render only "while the provider is
   available" — "hidden until configured", by name; the hard-mode settings
   line appears only once `HARD_MODE_UNLOCK_TIER` is in
   `completedTiers`.
3. **The canvas-attached surfaces** — the depth banner, the equation
   display, the floating upgrades button, the gem pocket, and the toast
   stack. The pocket is the one canvas feature that announces itself
   (scale-pulse, then a collection toast).

**F27.1 The IA is "show everything, hide nothing" — a documented policy,
not an omission.** Every entry point above the canvas is always rendered
(no drawer, no tab, no overflow menu), and the only absence rule is the
provider-availability one (🏆/🎬/Account tab). That is the inverse of the
anti-clutter canon (the contextual-UI argument: "do not have an 'Inventory'
button always on screen") — but the canon's own examples are busy shooter
HUDs (kill feeds, ammo counters), and the idle genre's progression canon
is *gradual expansion* (new mechanics unlock as the player progresses;
early simple, late optimization), which this game already ships in two
other places: `showAllPurchases` hides the upgrades button until the first
affordable line, and content unlocks on goal tiers t1–t5 (pass 23). So the
policy is defensible and consistent; the audit question is its *cost* —
the row can wrap to two or more rows on a narrow phone with all eight
pills present (the docstring acknowledges it wraps, and the "canvas floor
keeps the cave visible" is the mitigation) — and whether the player can
still read a strip of eight 30-px glyphs as a menu at all (F27.3). Not a
defect by itself; the device audit below is its check, not a
reorganization.

**F27.2 There is no announcement layer: availability changes are
silent.** The game has two of the three discoverability affordances —
*presence* (render only when ready: `showAllPurchases`, the provider
gates) and *state* (the opacity 0.5 dim, the glyph swap 🎁→🌙, the
save pill's two-tone status dot, the pulses: save-dirty, pocket,
claimable) — and the middle one is absent:
nothing ever says *this has arrived*. The inventory of what appears
without announcement: the 🏆 and 🎬 pills (zero-to-pill the moment their
provider becomes available — no toast, no badge, nothing), the
hard-mode settings line and the cave-theme purchases (tier unlocks,
`themesLocked`), the weekly contract's claimable state changing meaning
mid-run, and the streak freezes (a11y-label-only). The onboarding tour
teaches three verbs plus setup and points once at the 🎯 goals; it
mentions none of the eight header entries, and no "what's new" mechanism
exists anywhere in the app. The discovery canon (vendor sources, flagged
below) is consistent on shape even though its vendors sell the tooling:
a one-shot nudge on the new surface (badge on the new icon for ~a week,
or a single tooltip — the Flowla case is "one tooltip, not a tour"),
event-triggered, timed (day 0 → event-driven days 1–7 → reminder ~day
14 → retired by ~day 30), and measured (reach → click-through to the
feature → 7-day activation → retention). The repo already has both
primitives: the `onboardingDone`-style one-shot localStorage stamp and the
`showMessage` toast (the toast inventory — depth, tier, achievement,
pocket, vein, combo, daily-equation start, save/import — has no
first-availability entry).

**F27.3 The strip is emoji-only: seven glyphs at 30 px and one at 16 px,
no labels, no tooltips; state is dim or glyph swap.** There is no
`Tooltip` on any header entry (the `Tooltip` component exists and is used
only in `SettingsPanel`); the *full* detail of every pill lives in its
`accessibilityLabel` (e.g. the daily bonus carries bonus, streak, and
freeze counts) — the detail exists, only for screen-reader users. Against
the UI-mistakes canon: the 44×44 hit-box canon is met everywhere (the
44×44 is commented into the pill code); the "mystery meat" line is the
finding — a 30-px 📜 with no label is low affordance, and the 💾 at 16 px
breaks the strip's own size uniformity. The dimmed state (opacity 0.5, no
shape change, `disabled` Pressable) is the pass-3 color-independence
follow-up, with the bonus glyph swap (🎁→🌙) being the one place state
gets a shape change. Placement note that comes out in the row's favor:
the canon's thumb-zone result (75 % one-handed hold; top corners are the
"hard zone", reserved for read-only data) would not put *primary* actions
up there — and this layout does not: the core verbs (cave tap, answer
input, keypad, upgrades drawer) all live in the lower two-thirds, the
header is secondary/periodic content, and the docstring's keyboard-
occlusion reason is independently recorded.

**F27.4 Discoverability itself is unmeasured, and unmeasurable today.**
No field in the local analytics record says whether a player ever opened
the leaderboard, claimed a weekly contract, used the daily equation, or
exported a save code; the only such candidate in the file is pass 24's
`analytics:leaderboard-open` (single feature, never generalized). Pass 7's
FTUE funnel is still uninstrumented (re-verified in pass 26), and F26.1
confirms no off-device path carries the record at all (the save code
serializes the save, not the analytics key). So the question every other
pass-27 candidate hinges on — *which of the eight entries do players
actually find, and when* — has no answer path today, local or cohort.
The cheap local half is a family of one-shot stamps on the existing
record (below); the cohort half waits on `telemetry:opt-in-cohort`
(Tier 0, item 12).

**Candidates (documented, not planned)** — in rough order of value per
line:

+ `analytics:feature-first-use` — the one-shot stamp family on the
  existing local record: first daily-equation start, first weekly
  contract claim, first leaderboard open, first records / collection /
  goals tab open, first save-code export, first cloud link. Generalizes
  pass 24's `analytics:leaderboard-open` into the family and is the
  Tier-0 precondition for every other item here (F27.4). Same
  local-stamp-now, cohort-later split as Tier 0 item 1.
+ `ia:arrival-toast` — a one-shot toast (or ~week-limited badge) when a
  gated entry point *becomes* available (🏆, 🎬) and when a tier unlock
  adds content (hard-mode line, cave themes), stamped with an
  `onboardingDone`-style one-shot so it fires exactly once per surface;
  the `showMessage` toast system already exists, so the cheapest variant
  is a single toast per arrival, copy in the existing i18n files.
  Data-triggered: adopt once `analytics:feature-first-use` shows an
  actual discovery gap for a named surface — or immediately if it ever
  costs less than a day. (F27.2.)
+ `ia:header-device-audit` — verify on a real device (per the project
  note: the mines-play-35 AVD) how many rows the header wraps to with
  all eight pills present at 360 dp, and whether the strip is readable as
  a menu before ~60 s of play (pass 7's rule, applied to the nav row).
  If it wraps to three or more rows or the 60-second check fails,
  reorder by first-use frequency (from the stamp family above) or fold
  the least-used entries into the menu sheet. A check, not a spec.
  (F27.1, F27.3.)
+ `ia:pill-labels` — text labels (or first-use labels) for the emoji-only
  pills, plus a dimmed state that changes shape, not just opacity — the
  mystery-meat fix folded into the pass-3 color-independence item rather
  than re-listed there. (F27.3.)
+ Not a candidate: a full IA reorganization (drawers, tabs, "hide until
  needed"). Show-everything is a documented, deliberate design choice
  (the row's own docstring), matches the genre's single-screen layout,
  and the clutter canon it would be judged against targets busy HUDs, not
  a single-screen idle's eight secondary entries. Revisit only via
  `ia:header-device-audit` plus the stamp family's data.

**Source-quality notes (pass 27).** This is the thinnest canon of any
pass — feature-discovery content is a vendor category, and it shows:
InAppStory "How to drive new feature adoption" (vendor, sells an in-app
messaging SDK) used only for the announcement → discovery → first use →
repeat use cycle, the badge/timing cadence (the ~7-day badge, day 0 →
event-driven 1–7 → ~14-day reminder → ~30-day retirement), and the
minimal measurement set (reach / click-through-to-feature / 7-day
activation / retention) — vendor intent flagged, the game is not
buying a messaging SDK. UserGuiding "A Guide to Feature Discovery"
(vendor, onboarding SDK) used for the discovery-vs-adoption distinction,
the tooltip-on-new-icon pattern, behavior-targeted nudges, and the Flowla
one-tooltip-not-a-tour discipline — same flag. Boomiestudio "5 UI
Mistakes Killing Your Game's Retention" (independent dev blog) used for
the Hoober 2014 thumb-zone result (75 % one-handed hold; natural /
stretch / hard zones; top corners for read-only data), the 44–48 px
hit-box canon (the game already meets it), the three-state button
state machine, the contextual-UI anti-clutter argument, and the WCAG
4.5:1 / 18 sp lines (the last two already pass-3 findings, not
re-listed). MissionsSanx idle-game design guide (the pass-5 prestige
source, re-fetched) used only for the gradual-unlock / layered-expansion
progression line; the page is SEO-adjacent and low-signal overall,
flagged as such. Exa still 429-rate-limited; sourced via DuckDuckGo per
the re-pull convention.

Not re-audited: the upgrades drawer's internal discoverability
(`showAllPurchases`'s hiding rule itself, pass 16's "the drawer is the
game" surface), the content of the a11y labels (pass 3 / pass 22's
surface — their existence is noted here, their copy was not audited),
the FTUE tour's content (pass 7), and pre-install discoverability, which
is the store listing (pass 10).

### The trust / adversarial layer (pass 28 — what a modified client, a fast clock, and a misconfigured deploy can do, written 2026-09-09)

The per-axis passes never asked the adversarial question: what
can a player who can't be trusted do? The server-side trust
posture existed only as `pb_hooks/README.md`'s security section
plus store-integration.md §4's release gate that defends it, and
the client's clock surfaces (the offline formula, the
daily/weekly rolls) were audited in passes 15/17 without an
adversarial frame. This pass audits that frame end to end:
(a) time trust — the local-clock day boundaries, (b) device
identity — the regenerable `deviceId`, (c) save-data trust —
plaintext local state, (d) server posture — the verification
chain, write budget, caps, PII, (e) the operational seam where
(a)–(d) meet production: the container env.

**F28.1 — the day-boundary rewards trust the local clock; the
reward structure makes tampering unprofitable by construction.**
Claim eligibility is a string comparison against the local
wall: `computeDailyClaim` says `lastClaimDay !==
getLocalDayKey(Date.now())` (a local `yyyy-MM-dd` string;
`dailyBonus.ts`); the weekly contract reuses the same clock on a
Monday anchor (`getLocalWeekKey`) and the daily equation rolls on
the same `dayKey`. So, yes — rewinding the device clock re-opens
🎁/📜/📅. But the streak logic is the defense: a rewind leaves
`lastClaimDay` *in the future*, which is neither "yesterday"
nor "2 days ago", so the claim lands as a gap reset paying the
day-1 bonus (10,000); the valuable rewards — the streak ladder,
the milestone free freeze every 7 days, the repair snapshot — are
the ones the tamperer *breaks*, not farms. Max extractable per
real day: one extra day-1 bonus. A legitimate player earns at
least that every day. The canonical fix set (server-side
eligibility; wall-vs-monotonic divergence detection; offline
fail-closed — bugnet; Unity's server-time sample; the GM
thread's worldtime ping rolling dailies on server `day_of_year`)
is all disproportionate to the value at risk, and the one
*farmable* clock surface in the game — the 8-hour offline
earnings cap — is already ranked (Tier 1 item 16,
`offline:clock-hwm`, deliberately low priority). Server-side
eligibility, the canonical answer, is *considered and rejected*:
it would trade a network round-trip on the game's cheapest
feature to deny a ~10,000/day extra to a player who can already
root their device. No new candidate — the axis is closed as
safe-by-construction, and its one residual is already ranked.

**F28.2 — the server posture is stronger than the genre norm,
and the README's claims hold against the shipped surface.**
All collections are private with null rules and only the hooks
touch the rows; every data route is keyed to the anonymous
device id (verified in `collections.js`, `handlerLib.js`, the
endpoint table). Minting has exactly one path — the store's own
API verdict (Play `purchaseState` 0 on the pinned SKU; Apple
JWS + x5c chain + live root fetch; Stripe paid-lookup bound to
product + device) — and the three-mode `sandbox → sidecar →
fail-closed` chain makes an unconfigured or down verifier
degrade to "not purchased", never "granted" (`storeVerify.js`,
`identityVerify.js`). Webhook bodies are untrusted hints
deduped by event id; raw receipts are never persisted (sha256
only); the 30 writes/hour per-device budget is *durable* (an
`events` row; reads unlimited); caps reject rather than clamp;
blob ≤16 KB; a `saveVersion` newer than the app is rejected;
display names ≤16. Secrets are env-only; the web bundle holds
`pk_` only; the client ships *no* sandbox/fake-receipt path
(grep of `src/`: cosmetic blurbs and the `storeConfig` "never
fake" comment only). The runtime's own rate limiter is no
substitute — PocketBase's is IP-based, in-memory, off by
default (deepwiki, tertiary), and under the v0.40 pooled-VM
model an in-memory limiter couldn't be shared between handlers
anyway (pb_hooks rule 5), which is exactly why the app built its
own durable budget. Consistent with pass 24's F24.5 (claims +
caps as the genre answer) and the anti-cheat canon (the server
owns the important state; the client may cache). PII is
minimal: displayName ≤16, no names or emails in the crash
snapshot's 24 keys, analytics local-only, GDPR deletion
documented (pass 26).

**F28.3 — the single trust-chain weakness is operational, and
it isn't in the release gate.** `MDOOM_DEV_FAKE_TOKEN=1` mints
*any* non-empty token — IAP and identity (README: "**must never
be set in production**"). But store-integration.md §4 (the
release gate) and the deploy checklist assert nothing about the
production container having it unset, or
`MDOOM_SIDECAR_URL` set — the flag is documented only in the
sandbox runbook (pocketbase-plan.md) and the README's env
table. A misconfigured production would silently mint arbitrary
entitlements — a money leak — and accept any identity link
(account-takeover class), which is the one failure mode the
README calls out by name. The sidecar already exposes the
surface (`/healthz` reports `configured` per platform);
nothing asserts on it at deploy time. (→ the candidate below;
Tier 0 item 12.)

**F28.4 — the plaintext local save is the right posture, not a
gap.** The save blob, the day stamps, the entitlements state,
the analytics record: all readable and writable in place
(AsyncStorage; `localStorage` on web, pass 12). The canon's
mitigations (encryption + integrity, context / monotonic
counters, server-owned state — guardingpear) are satisfied to
the extent the architecture allows: the *important* state
(entitlements, the cloud copy, the board rows) is server-owned
and store-verified, and the local copy is a cache — exactly the
shape the canon prescribes for offline-first games. The only
state where a wrong local value hurts is where it hurts the
player themself (single-player; no server truth for a run,
F24.5). The cross-player vectors are closed by design: device
identity never rides in the save blob (`iapDeviceId.ts` keeps
it out on purpose — a copied/imported save cannot steal
entitlements, because the store token proves ownership and the
id is "a key, not a secret"); the board takes capped claims
(F24.5). Rollback abuse (save before a risk, restore after) has
pass 21's recovery paths (`.corrupt` backup, cloud LWW, save
code). The regenerable `deviceId` (`dev-<ts36><16 alnum>`,
`Math.random`) costs the player only: a fresh identity starts
with an empty cloud save / board / events — no endpoint exposes
another device's state (the board's top-10 exposes depth claims
by design, F24.5) — so regenerating is self-harm, not theft. No
candidate.

**Candidates (documented, not planned):**

+ `deploy:prod-env-gate` — the release-gate item (store-
  integration §4, beside the IAP row): assert the production
  container reports `MDOOM_DEV_FAKE_TOKEN` unset and the
  sidecar `/healthz` shows `configured: true` per platform (one
  curl, or a compose-level assert that fails the deploy while
  the flag is set). The only trust-chain weakness this pass
  found, and the one where a silent failure is a money leak
  instead of a UX bug. Hours of work; Tier 0 item 12.

### The monetization-mix layer (pass 29 — how the IAP catalog, the ad surfaces, and the gem economy relate to each other, written 2026-09-09)

Pass 6 set the *external* benchmark (where this game slots in hybrid-casual
ARPDAU/ARPDAU bands, rewarded-format economics, the pass-6 sequencing canon).
Pass 12 covered the web IAP mechanism; pass 16 the cosmetics sink; pass 25
pinned the free path's first-prestige target. But the game's own mix — the
25-pack catalog, the four capped ad kinds, and the gem economy they share —
had never been audited as one system: nobody had checked the price-ladder
shape, whether the ad and IAP surfaces overlap, or measured how long a free
player actually waits for what the store sells. That is this pass.

**F29.1 — the audited mix (live code, `iaps.ts` / `ads.ts` /
`cosmetics.ts` / `game.ts`).**
The IAP catalog is 25 one-time cosmetic packs (13 outfits, 3 pickaxes,
9 cave themes) — no currency packs, deliberately: nothing for advantage is
sold, so the store cannot out-earn the free path. There is no
repurchasable surface; max revenue per player is the catalog itself,
$59.75 at list (5×$0.99 + 9×$1.99 + 7×$2.99 + 4×$3.99). Prices are not
independently set: `packPriceLabel` maps gem cost to a monotone band
(≤30g→$0.99, ≤60g→$1.99, ≤100g→$2.99, else→$3.99), so the IAP price can
never drift from the in-game shop — and the panel already shows the
"earnable in game (N gems)" line per item, which is the transparency the
canon asks for. The ad surface is four capped opt-in "watch" kinds (3×/day
5-gem rolls, 1×/day combo save, 2 situational offline helpers, a 10×/day
total anti-fraud cap), caps visible in the rewards panel; the meter is stored under its own key
outside the save blob, so a save edit can't farm ads (live code,
`ads.ts`; F28.4 covers why that local state isn't worth defending). And
the two surfaces
do not overlap: ads never grant cosmetics or money; IAP never grants a
mechanic. The only intersection is gems (ads→gems→cosmetics), which is the
designed substitution path. Guardrail 1 (F2P viability) is structural here,
not aspirational: every pack in the store is gem-earnable and no mechanic
is sold anywhere in the game.

**F29.2 — "a purchase and saving gems stay roughly comparable" is a
measurable claim, and the freePath sim says it holds at item level.**
The freePath benchmark persona (seeded, deterministic; run with
`stopAtFirstPrestige: false` for the long-horizon gem trajectory the
module documents) accumulates gross gem income of 52 by day 1, 130 by day
3, 332 by day 7, 841 by day 14, 1,361 by day 21, 1,958 by day 30, 2,739 by
day 40 (gross, before the persona's own upgrade policy spends them; ad
rolls add up to 15g/day on top; the 100k-mineral faucet keeps the floor
non-random). Against that: an entry pack (≤30g) is covered by day 1, a
mid pack (90g) by day 3, the top tier (170g) by day 4, and the full
1,675g catalog is crossed between day 21 and day 30 (≈ day 25). So
"pay, or wait days" holds for every item in the catalog, not "wait weeks".
Caveat, stated plainly: gems are one shared flow currency — the same gem a
player would save for an outfit can fund the gemChance line (28,700g
across 20 levels) or the quartic miner lines (unbounded, self-throttling) —
so the *net* wait for a player simultaneously bankroll-ing upgrades is
longer; the measurement pins the ceiling, not the player's actual queue.
The cosmetics catalog is 5.5% of the finite gem sink (1,675 of 30,375),
i.e. cosmetics are cheap relative to upgrades by construction, which is
the right direction for the guardrail. (Sim measurement, deterministic
seed — not a sourced claim.)

**F29.3 — the mix's shape is the finding: an anchorless 25-item ladder
where the top tier is the best buy.**
The ladder is four price points, $0.99–$3.99, entirely bare single items,
no bundle anywhere. And the value gradient runs the wrong way for a
catalog: dollars per gem *fall* as price rises — from $0.066/gem at the
weakest entry item (15g at $0.99) to $0.023/gem at the top themes
(170g at $3.99). The most expensive thing in the store is the best value.
The canon is consistent on what that does:

+ **Anchor effect.** "A starter pack at $0.99 reads as cheap when the
  catalog tops out at $99.99. The same starter pack reads as expensive in
  a catalog that tops out at $4.99." and "A studio that prices its largest
  bundle at $19.99 because they don't expect many players to buy it is
  mispricing the rest of the catalog." (gamemantra, price-psychology
  audit — vendor blog, directional not Tier A). Our top is $3.99, *below*
  the standard tier: nothing in the catalog anchors the rest, and the
  top tier is doing the opposite of anchoring (it makes the middle look
  like the deal).
+ **Ladder size.** "Most successful casual games use a tiered ladder of
  5–7 price points, typically $0.99, $1.99, $4.99, $9.99, $19.99,
  $49.99, and $99.99. The $4.99–$9.99 tier drives the majority of
  transactions for most titles." (SolarEngine docs — vendor, same tier).
  This catalog has four points and no $4.99 tier at all.
+ **Bundles.** "Bundled IAPs convert 30–40% higher than standalone
  items." (gamemantra). The trust caveat matters as much as the lift:
  "A decoy that's obviously a decoy … reads as manipulation and damages
  trust." Guardrail 3 (no dark patterns) rules the decoy pattern out of
  the box; what survives it is the honest-bundle shape — a real discount
  against the sum of its parts, nothing else.
+ **Mix ratio / frequency slots.** "Many casual titles land near 50/50
  (Ads/IAP)"; logic/puzzle "often 30% Ads / 70% IAP"; rewarded frequency
  starts "3–4 rewarded per user/day" (cas.ai practical guide — vendor,
  starting points not benchmarks; "no perfect ratio" is stated on the
  page). Our 3-rolls/day ad cap sits inside that frequency band, and the
  no-interstitials posture is the guardrail, not a gap.

**F29.4 — the mix can't be observed yet, and that's the other half of
the finding.** The guardrail-5 cohort upload (Tier 0 item 1 — the
IAP and gem-purchase rows are already recorded locally, the upload is
what makes them a fraction) is what produces the first mix KPI —
revenue and per-install split by surface — against which the canon's
30/70–50/50 slot means something for
*this* game. Until then the mix exists only as design intent. One
structural fact that will frame that data: with one-time packs and no
repurchasable surface, the IAP side has a hard per-player ceiling
($59.75 as of this pass), so the mix is structurally ad-weighted
relative to a consumables catalog. That is consistent with the 30/70
slot (puzzle-
leaning), documented here so the first real split is read against intent
rather than surprise.

*Sync (post-pass, 2026-09-10):* the `packSkin` feature row landed after
this pass — the catalogue is now 26 rows (25 bare gem-bearing items +
`packSkin`, a $3.99 non-gem feature line). The per-player full-buy
ceiling is now **$63.74** (59.75 + 3.99); the ladder's shape findings
(F29.3) are unchanged — `packSkin` sits at, not above, the $3.99 top, so
the anchor gap and the "top tier is the best buy" gradient over the gem
rows stand as audited.

**Source quality (pass 29).** Exa was 429 at write time; per the
documented re-pull convention this pass used DuckDuckGo. All three
sources are vendor-affiliated (gamemantra blog, SolarEngine docs, cas.ai
guide) — directional design canon, not Tier A measurements, and the
quantitative claims (30–40% bundle lift, 5–7-point ladders, 50/50 and
30/70 slots, 3–4 rewarded/day) carry no methodology on the page. The
F29.1–F29.2 numbers are live-code and sim measurement, not sourced. If
pass 29's bundle candidate is ever greenlit, the price claims behind it
should be re-pulled from a Tier A source before design.

**Research sources (pass 29, DuckDuckGo fallback):**

+ gamemantra, “IAP Pricing Psychology: Decoy, Anchor, Charm”
  (vendor blog): anchor-effect and decoy-trust quotes + the 30–40%
  bundle lift. No methodology on the page; directional.
+ SolarEngine docs, “Casual Games IAP Monetization Strategies”:
  the 5–7-point ladder ($0.99–$99.99) and the $4.99–$9.99
  transaction share. Vendor docs.
+ cas.ai, “Hybrid Monetization in Mobile Games: A Practical Guide”:
  the 50/50 and 30/70 mix slots, geo segmentation, 3–4 rewarded/day
  frequency. Starting points, methodology unstated.
+ (fetched, not cited) gamegrowthadvisor, “Mobile Game Paywall / IAP
  Pricing Optimization 2026”: the “hard currency must be scarce”
  claim is a useful framing but the page is the weakest of the four
  and adds nothing the above don't; excluded rather than padded in.

**Candidates (documented, not planned):**

+ `iap:anchor-bundle` (pass 29) — gated on the same tier-3 adoption /
  payer-mix data as Tier 1 item 13 (`prestige:currency`): if that data
  shows a demand pattern, add an honest bundle (e.g. per-line "full set"
  packs, or a collection pack) that gives the ladder an anchor tier above
  the current $3.99 ceiling. Constraints from the canon + guardrails:
  real discount only (sum of parts > bundle price; no decoys, no fake
  scarcity), the earnable-in-game line preserved for every packed item,
  price still band-derived from gem cost so the store can't drift from
  the shop. Until the data exists, this is a note, not a plan. Tier 1,
  item 17.

### The platform-parity layer (pass 30 — what runs where, written 2026-09-09)

Passes 7–29 each audited *some* axis across platforms, but none
enumerated the feature × platform matrix itself — where a surface runs,
which implementation it runs on, and what silently degrades. That is
this pass. Every cell verified against `src/` as of this commit.

**F30.1 — parity is maintained by four provider seams plus a handful
of UI-level `Platform.OS` branches — by construction, not by test.**
The seams: `adProvider(.web)` (AdMob ↔ AdSense H5),
`iapProvider(.web)` (Play Billing / App Store ↔ Stripe hosted
checkout), `shareImage(.web)` (expo-sharing sheet ↔ offscreen-canvas
Web-Share-API file), and `secureToken` (Keychain ↔ localStorage).
Everything upstream of a seam is platform-agnostic. The UI-level
branches (~20 `Platform.OS` sites) cover: save-on-exit (web
`pagehide` + AppState; native AppState backgrounding), play-time-clock
liveness (web `visibilitychange`), keyboard avoidance (native
`KeyboardAvoidingView` vs the web read-only answer box), reduce-motion
OS setting (web `prefers-reduced-motion`; parity via the manual toggle
on all platforms), the web-only "Reload page" on the error boundary,
sign-in kinds per platform (`providerKindsForPlatform`), and the
analytics `web` event flags. The matrix as of this commit:

| Surface | Web | Android | iOS |
| --- | --- | --- | --- |
| Rewarded ads | AdSense H5 (client configured; live) | AdMob (App ID + 4 units; live) | code live, `iosAppId: ""` — dark until configured (backlog) |
| IAP | Stripe checkout, 25 SKUs, server-side verification (live) | Play Billing (live) | expo-iap code live; store-side products unregistered (backlog) |
| Sign-in | Google (GSI) | Google | Google + Sign in with Apple |
| Token storage | localStorage | Keychain | Keychain |
| Share (achievement → badge → text) | Web Share API; `none` when the API is absent | RN Share sheet | RN Share sheet |
| Haptics | no-op (no vibration API) | `Vibration` | `Vibration` |
| Reduce motion | OS setting + manual toggle | manual toggle | manual toggle |
| Save on exit | `pagehide` + AppState | AppState backgrounding | AppState backgrounding |
| Error surface | Try Again + Reload page | Try Again | Try Again |

**F30.2 — the open parity holes are all already tracked elsewhere.**
iOS AdMob App ID and iOS IAP registration (backlog; the iOS code is
complete), Apple web sign-in (features.md §5 — pending a
domain-verified service ID), the web ambient bed's silent-until-gesture
(Tier 1 #3), and mouse-only keyboard operability (Tier 1 #4). The
matrix check found no *new* hole in those categories, and the
save-on-exit / liveness / token / error-surface cells are parity-
complete (native saves on AppState backgrounding, so there is no
web-`pagehide`-only gap).

**F30.3 — on desktop web, the share button is a silent, complete
no-op (new).** `pickShareTarget` returns the `none` target when
`navigator.share` is absent — a deliberate choice (no silent clipboard
write, guardrail 4) — but Web Share API support is uneven on desktop:
absent in Firefox desktop, and Chrome desktop routes through OS share
targets (caniuse: Windows 11+), so a meaningful slice of the
desktop-web share audience sees the achievement share button as a dead
button. The share button is the game's only user-facing share surface
(the badge's plain-text fallback rides the same picker). It is also
the only matrix cell that silently does nothing *without telling the
player*: the haptics no-op is documented in features.md and merely
harmless, but a share tap that does nothing reads as a bug, not a
feature. The fix is cheap and honest — when the API is absent, offer
an explicit "Copy" action instead of a dead tap: a visible,
user-initiated clipboard write is not the silent write guardrail 4
objects to.

**F30.4 — parity is enforced by construction, not by test.** Two of
the four seams have web-variant tests (`iapProvider.web`,
`shareImage.web`) and the `pickShareTarget` picker is pure and pinned,
but nothing enumerates the matrix: a `Platform.OS` branch added in one
place and missed in another would sail through every gate. This is a
quality observation (the same class as pass 20's "no perf CI"), not a
feature gap — recorded here so a future parity regression starts from
this section.

**Source quality (pass 30).** Internal audit: the parity matrix is a
property of this repo's seams, not sourceable externally, so the
F30.1/F30.2 cells are live-code as of this commit, not sourced
claims. The one external anchor is the Web Share API support context
behind F30.3 (MDN `Navigator.share` + the caniuse-lite `web-share`
dataset, DuckDuckGo after Exa's 429); the MDN page's browser-compat
table did not render on fetch, so the browser matrix is context, not a
load-bearing claim. The product claim — "the picker's `none` fallback
covers real desktop browsers" — rests on the repo's own test-pinned
`pickShareTarget` logic, which is the load-bearing part.

**Research sources (pass 30, DuckDuckGo fallback):**

+ MDN, "Navigator: share()" (official) — API contract (transient
  activation, Permissions Policy, `navigator.canShare()` detection);
  the compat table itself did not render on fetch.
+ caniuse-lite `web-share` dataset (the source behind caniuse.com,
  fetched as the lite JSON) — desktop support is the uneven part:
  absent in Firefox desktop; Chrome desktop gated on OS share
  targets (Windows 11+); Safari desktop / Edge fine. Treated as
  context (dataset markers cross-checked against one vendor matrix
  page) — not a load-bearing claim.
+ (fetched, not cited) webshareapi.com browser-support matrix —
  consistent with the caniuse picture ("Firefox Desktop remains the
  significant gap"); vendor/SEO site, used only as a cross-check.

**Candidates (documented, not planned):**

+ `share:clipboard-opt-in` (pass 30, F30.3) — when `navigator.share`
  is absent, replace the dead share tap with an explicit "Copy"
  action (one `pickShareTarget` branch + a label string + the
  GoalsPanel button; the clipboard write is user-initiated and
  visible, so the no-silent-write rule holds). Cheap, web-only.
  Trigger-gated on the share-badge/cosmetics demand signal already
  recorded in `docs/todo.md`, or any web-growth bet (es-market
  listing, PWA installability) that raises the desktop-web share
  audience. Tier 1, item 18.

### The visual / presentation layer (pass 31 — what the player actually sees, written 2026-09-10)

Passes 13, 20, and 22 audited the channels *around* the image — inputs,
cost, sound. The image itself, the one channel the player looks at
constantly, was never audited as a system: how the pixels are made,
scaled, tinted, and laid out. That is this pass. Every cell verified
against `src/` as of this commit.

**F31.1 — every image on screen is a fixed-pixel baked-PNG data URI,
stretched to fixed point sizes; no scaling algorithm is pinned.** The
pipeline is hand-placed color grids (16×16 miner/pickaxe bodies in
`pixelArt.ts`, 288×24 cave rows in `caveTiles.ts`, 5×7 badge font in
`shareBadge.ts`, currency icons 20–34 px) baked once per cache key by
`gridToPngDataUri` and displayed by RN `Image` at fixed pt sizes (Miner
body 44/24, pickaxe 36/20) or `resizeMode: "stretch"` (cave rows,
`CaveBackground.tsx`). Neither `imageResizingMode` (native) nor
`image-rendering` (web CSS) appears anywhere in the repo — so a 16×16
source rendered at 44 px (2.75×) takes whatever scaling the host
compositor defaults to (browser smooth upscaling on web, GPU sampling
on native). For a pixel-art identity, the crispness of the art the
player sees is a property of the platform, not the game. Browser
support for pinning it (`image-rendering: pixelated`) is universal
since 2020 (MDN / caniuse `css-crisp-edges`), so this is a property
pin, not a compat bet.

**F31.2 — the full-bleed cave rework made the cave row the most
stretched image on the page (new, surfaced by the wide-web work).**
Rows are baked 288 px wide (12 tiles × 24 px) and stretch
horizontally to the canvas. On phones the stretch is ≤ ~1.3× (phones
never reach the 640 px column cap). Since the wide-screen rework
(`styles.canvasFullBleed` — the cave spans 100vw on web while content
stays capped at 640), the cave is the only full-viewport image: at a
1440 px desktop viewport the 288 px row stretches ~5× with default
smooth filtering — the cave softens proportionally to the monitor
while the capped content column next to it is DOM-sharp, making the
crisp-vs-soft seam *more* visible the wider the screen. The stretch was
deliberate (rows are addressed by absolute cave depth and re-baked per
(tier, strip, tint) — cheap), so this is the un-audited cost of the
rework, not an oversight to revert; the fix is re-baking at measured
viewport width (width as a fourth cache-key dimension) and/or pinning
nearest-neighbor, both small.

**F31.3 — four generated art styles are drafted, tested, and
deliberately unwired; the decision is open and zero-code.**
`stylePasses.ts` (flat baseline / mono 1-bit woodcut / retro16
console-palette / outline cartoon-cel — pure `PixelGrid -> PixelGrid`,
deterministic, tested) composes at a single hook point before
`gridToPngDataUri` (the adoption notes in `docs/art-styles.md`); sample
sheets re-render via `scripts/generate-art-style-samples.mjs`. This is
the game's only art-direction surface, and it is frozen at `flat` by
omission, not by choice. Two design questions are deliberately deferred
to greenlight, not here: global style vs. an "art style" setting (a
setting is cheap with this design but fans out the cache keys), and
what the chosen pass does to a user-uploaded custom skin (F31.3's fresh
angle — pass the user's grid through the pass for cohesion, or leave
uploads raw out of respect for the upload; the custom-skin line shipped
with no precedent either way).

**F31.4 — color and contrast are hand-tuned once and measured nowhere.**
The cave overlay is pinned at opacity 0.35 over the `#2f1f1f` canvas
(`CaveBackground.tsx`); each of the five depth tiers and the nine cave
themes re-tints the cave (`cosmetics.ts`), and whatever text/UI sits
over the cave inherits whatever that pairing is; body `fontSize` is
hard-coded 11–12 (the text-scaling gap is pass 3 / Tier 1 #2 —
recorded there, not re-audited here). Nothing in the repo measures
contrast — no lint, test, or script. The natural yardstick is WCAG 2.2
SC 1.4.3 (4.5:1 normal / 3:1 large text) and SC 1.4.11 (3:1 non-text
UI) — and the repo already knows one color-dependent affordance: the
gem pocket "reads mostly from canvas color" (pass 3's high-contrast
step names it), so a contrast audit would start from a known suspect,
not a blank slate.

**F31.5 — layout is hand-tuned portrait for one device class, by
choice.** `orientation: "portrait"` is pinned in `app.config.ts` and
the Android manifest; density is hand-tuned to phones (640 px column
cap, 140 px canvas floor, 56→44 px keypad key floors, drawer overlays
the canvas instead of pushing it). No landscape (deliberately absent —
guardrails list), no zoom or text scaling (Tier 1 #2), and no
breakpoint between phone and the 640 cap: a portrait tablet simply
gets the capped column. Recorded so a future "make it feel big-screen"
pass starts from here instead of re-deriving the layout inventory.

**Source quality (pass 31).** Internal audit by construction (the same
class as pass 30): F31.1–F31.5 are properties of this repo's rendering
pipeline — verified against `src/` as of this commit
(`pixelArt.ts`, `caveTiles.ts`, `CaveBackground.tsx`, `Miner.tsx`,
`MiningCanvas.tsx`, `styles.ts`, `MinesOfDoom.tsx`, `app.config.ts`,
`customSkin.ts`, `stylePasses.ts`), not sourced claims. The external
anchors are yardsticks only: WCAG 2.2 (the F31.4 measurement standard —
nothing here is measured against it yet) and MDN/W3C pixel-art scaling
(browser support for the F31.1 property pin). No retention or
conversion claim is made, because none is needed: the gaps below are
quality and decision-state observations.

**Research sources (pass 31):**

+ W3C, "Web Content Accessibility Guidelines (WCAG) 2.2" (TR) +
  "Understanding SC 1.4.3 Contrast Minimum" / SC 1.4.11 (w3.org) — the
  4.5:1 / 3:1 / 3:1 thresholds F31.4 would measure against; cited as
  the yardstick, not as a claim about this game.
+ MDN, "image-rendering" reference + "Crisp pixel art look" (web games
  techniques) — `image-rendering: pixelated` scaling-hint support
  (2020+, cross-browser; caniuse `css-crisp-edges` as the dataset
  cross-check) — the F31.1/F31.2 fix is a property pin, not a
  compat bet; the native counterpart is RN `Image`
  `resizeMode: "nearest"` (no fetch needed — API is stable).
+ (context, not cited) Android "Adapt your layout" / large-screen
  guidance — resizability and multi-window arguments for F31.5's
  "portrait-lock is fine" call; the game already locks orientation, so
  the platform asks for a posture the game deliberately declines.

**Candidates (documented, not planned):**

+ `art:cave-crisp` (+ the sprite half `art:pixel-crisp`) (pass 31,
  F31.1/F31.2) — pin nearest-neighbor scaling on the baked art (web:
  `image-rendering: pixelated` via the `+html.ts` document or web-only
  styles; native: `resizeMode: "nearest"` on the sprite `Image`s) and
  re-bake the cave rows at the measured viewport width on web (width
  joins the existing (tier, strip, tint) cache key — the rows are
  deterministic in it, so a fourth dimension is the whole change).
  Web-first; cheap. Trigger-gated on the same web-growth bets as
  Tier 1 #14 (PWA / installability, es-market listing, any
  desktop-cohort signal): until then the stretch is a taste call, not a
  defect. Tier 1, item 19.
+ `art:style-decision` (pass 31, F31.3) — pick one of the four drafted
  passes (or affirm `flat`), and decide global vs. setting; if
  setting, `art:style-picker` is the wiring (one hook point + a
  settings row + the i18n key, cache-key fan-out already scoped in
  `docs/art-styles.md`). The decision itself is zero-code (a taste
  call, human) — the candidate is the *state* of being undecided: the
  draft has sat since the art-style pass with no decision recorded
  anywhere. Trigger-gated on a store-listing refresh (new screenshots
  are a pre-install lever — pass 10) or a player art request; the
  custom-skin pass-through question is part of this decision, not a
  separate candidate.
+ `art:contrast-audit` (pass 31, F31.4) — measurement only, not a
  feature: a script that enumerates every (depth-tier tint × cave theme
  × 0.35 overlay × text color) pair the game can actually render and
  computes the WCAG ratios, recording failures in this layer. It is the
  INPUT to the Tier 1 #2 high-contrast step, so that step gets
  greenlit against a failure list instead of a hunch — the
  gem-pocket-from-color affordance (pass 3) is the expected first
  hit. Trigger-gated on the Tier 1 #2 high-contrast greenlight
  (un-scopable without the list, which is why it's a candidate, not a
  ranking item of its own).

### The account & cloud layer (pass 33 — what a signed-in session owns, written 2026-09-10)

Pass 21 (local persistence), pass 24 (leaderboard), pass 26
(telemetry), pass 28 (adversarial) and pass 30 (the platform-parity
sign-in matrix row) each audited one axis of the account surface —
this pass audits the *session lifecycle* and the data plane a session
tags: what a signed-in client owns, what it can erase, and what
hens to its save while it plays. Internal audit by construction:
F33.1–F33.4 are properties of this repo's account / data-plane wiring
(`auth.ts`, `useAccount.ts`, `useCloudSave.ts`, `cloudSave.ts`,
`SaveTab.tsx`, the `pb_hooks` endpoint contract).

+ **F33.1 — `account:web-value` (candidate, trigger-gated).** Web
  sign-in is live (the ID-client flow, e2e-verified) and web purchases
  tag accounts — but the cloud provider is a no-op on web *by
  construction* (`cloudSave.ts`: "no-op on web — save codes cover web
  backup"; `selectCloudSaveProvider` returns the no-op provider when
  the target is web). So a web account's one durable value today is
  entitlement restore across devices/reinstalls; it gets no save sync
  and (F33.2) no erasure path. Whether that is worth carrying the web
  sign-in surface is a growth bet, not a defect: candidate,
  trigger-gated on the same web-growth bets as Tier 1 #14 (PWA /
  installability, es-market listing, any desktop-cohort signal).
+ **F33.2 — `account:web-erasure` (→ Tier 1, item 22).** The app's
  only "delete my data" surface is the SaveTab cloud-backup section
  (`SaveTab.tsx` `CloudSaveSection`), which returns null when
  `cloudSave.available` is false — and it is never true on web (the
  no-op provider above). Accounts are a three-platform surface (web
  sign-in is live, web purchases tag accounts), so a web account can be
  created, carry purchases, and yet have no in-app erasure path. The
  server side already supports account-scope delete from any client
  (`pb_hooks` `/api/app/delete` takes `{ deviceId, sessionToken? }`
  and returns `deletedAccount`); only the client surface is missing.
  The compliance floor is affected (the security-audit S4/S6 posture
  assumes in-app erasure), and the store-integration release gate is
  stale on two counts: `docs/store-integration.md` still cites the
  "LegalSection 'delete my data'" button (the LegalSection has no
  delete link — the button is in SaveTab) and the endpoint table still
  uses the old `/api/app/gdpr/delete` name (the route is
  `/api/app/delete`, per the client and `pb_hooks`). Fix: render the
  erasure in the *account* surface, gated on the auth provider
  (available on all three platforms once signed in) rather than the
  cloud provider; the plain wordings are already i18n'd, and the
  release-gate line gets the component name and route name corrected.
+ **F33.3 — `account:erase-signout` (F33.2 companion).**
  `useCloudSave.deleteMyData` round-trips `provider.delete(token())`
  and toasts the outcome — but never signs out. A successful
  *account-scope* delete removes the account server-side, leaving the
  client holding a session on a dead token until the next launch
  (`useAccount.signOut` exists and clears the token store, but nothing
  in the delete path calls it). Fix: sign out after a successful
  account-scope delete (device-scope deletes keep the session — the
  account still exists).
+ **F33.4 — `cloud:stale-notice` (F33.2 companion).** The cloud has
  three import paths and only two of them speak. Launch-recovery and
  the manual restore both toast `toast.cloudRestored` after importing
  a blob; the third path — the `stale` branch of `requestPush` (the
  last-write-wins conflict: the server kept a NEWER snapshot than the
  one just pushed, so the client refreshes its local view from the
  stored one) — calls the same import pipeline with no toast at all.
  A background push silently replacing the player's live progress with
  the other device's save is exactly the moment a notice is owed; the
  silent path is the odd one out. Fix: toast on the stale import
  (reusing or varianting the existing restored wording).

**Source quality (pass 33).** Internal audit by construction (the same
class as passes 30–32): no external sources, no external claims —
every statement above is a property of the wiring as of this commit,
verified against `src/` and `pb_hooks/`.

### The content & data-authoring layer (pass 34 — what “adding one thing” actually touches, written 2026-09-10)

Every pass before this one audited a layer the player *experiences*; none
audited the *authoring* surface — the set of files that must change
together when a piece of content is added, and the nets that catch the
drift when one of them is forgotten. The stress test is the IAP catalog
(26 products, mirrored across five surfaces); the wide shot is the local-
state inventory (16 keys). The result: the content-authoring path is one
of the best-netted parts of the repo — the gaps are in the one copy that
lives in a markdown table and the one placeholder value that passes every
shape check.

**Fully-netted surfaces (verified against `src/` this pass).**
Catalog ↔ `cosmetics.ts`: `iaps.test.ts` pins *exactly one pack per paid
cosmetic, in catalog order per line* (both directions: a new paid
`costGems > 0` cosmetic without a pack fails, an orphan pack fails), and
blurbs/price labels resolve from the gem shop (`getIapPackCosmetic`), so
the “also earnable in-game” half of the F2P-viability claim is
mechanical, not a promise. Catalog ↔ `scripts/stripe/catalog.json`:
`stripeCatalog.test.ts` pins ids, store ids, names, price tiers *and*
blurbs. Catalog ↔ `pb_hooks` `PRODUCTS`: `logic.test.js` pins an exact
equality against `IAP_STORE_IDS`. Catalog ↔ `storeConfig.stripe.prices`:
key coverage (every product id, once) + shape. Content names ↔ i18n:
`content.test.ts` walks nine data modules (depth tiers, goal tiers +
goals, achievements, records, IAP products, outfits, pickaxes, cave
themes, legal docs) and pins the Spanish table exactly — key set,
`detail`/`body` presence, non-empty — while the English side *is* the
data modules (no EN table by design), so a name cannot drift without the
item; `i18n.test.ts` pins the `es.ts` key set against `en.ts` plus
per-key `{placeholder}` sets. Pickaxe swing sounds: `cosmetics.test.ts`
pins the `audio/pickaxe-<id>.wav` naming convention *and* file
existence. Save schema: `game.test.ts` walks `migrateSaveData` (legacy
no-version, junk version, field-level clamps) — and the one cross-process
coupling in that schema is pinned too (F34.2).

**F34.1 — `docs:sku-table-sync` (candidate; rides the pack_skin release
step).** `docs/store-integration.md` §2.1 is titled “The product table
(create these)” — it is the ops instruction sheet for creating the store
products — and it is the ONLY catalog copy no test reads. The other five
surfaces all moved when the 26th row (`packSkin`) landed 2026-09-10:
`PACK_SPECS` (26), `catalog.json` (26), `pb_hooks` `PRODUCTS` (26),
`storeConfig.stripe.prices` (26 keys), the content-i18n tables (`iap:
packSkin`, pinned) — the §2.1 table still has 25 rows, and the missing
one is exactly the SKU the pending release step (“create the pack_skin
Play Billing SKU”) exists to create; the instruction sheet under-creates
the catalog by one product. The two documents also disagree on the
maintenance model: `iaps.ts` asserts the table “is generated from this
catalog”, §2.1 asserts manual sync (“Adjust the tiers in `iaps.ts` and
update this table”) — the drift proves the manual claim is the true one.
Fix: add the 26th row and either pin the table with a small test (parse
the markdown table, diff against `IAP_PRODUCT_LIST`) or correct the
`iaps.ts` docstring so the next author knows the table is a claim, not a
fact.

**F34.2 — The versioning posture is bimodal, and strictness tracks the
process boundary — which is the right rule, stated here for the next
author.** Of the 16 local state keys (`save`, `settings`,
`equationSettings`, `analytics`, `crashLog`, `adRewards`, `dailyBonus`,
`dailyEquation`, `weeklyChallenge`, `iap` entitlements, `customSkin`,
`cloudSaveEnabled`, `cloudSaveLastSync`, `iapDeviceId`, the auth token,
the i18n preference) exactly ONE is versioned: `save` (`saveVersion` 11,
the key-0→11 migration walk, each step lenient and clamped) — and it is
the only one that crosses a process boundary: `pb_hooks`
`validateCloudPush` rejects any blob whose `saveVersion` exceeds
`MAX_SAVE_VERSION`, and `MAX_SAVE_VERSION` (11) is pinned to the client’s
`saveVersion` by `logic.test.js`, so a client bump that outruns the
deploy fails *safe* (push rejected, nothing stored the server can’t
understand) rather than corrupt. Every other key is unversioned by
deliberate leniency — `customSkin` re-validates its 256 cells on every
load, `analytics`/`crashLog` default new fields in, the save code never
bumps its `MOD1` prefix (the F32.2 ride-alongs are optional fields;
legacy codes stay byte-identical). Companion note on that walk itself: `migrateSaveData` keys the migration map on the numeric version and advances by `version++`, so the keys must be consecutive 0..10 — and the literal defines key 7 *after* 8/9/10 (order-independent today, but a readability trap: the "add a migration entry here" instruction reads as append, and a future author who skips a version number silently under-migrates via the `migrate == null` warn-and-break). Not a defect: the risk it documents is
that the next piece of state to cross a boundary (the F33.x erasure
path’s audit trail, a cohort upload if `telemetry:opt-in-cohort` ever
lands) must make the versioning decision consciously, and the rule to
apply is the one this pass found: **version what crosses a boundary,
normalize what doesn’t.**

**F34.3 — `release:price-placeholder-net` (candidate; rides the same
release step).** *Status 2026-09-10: the shadowed release step LANDED —
`packSkin` now holds the real test-mode price
`price_1UEDJqDPxWoXhXF8WYfaEDSe` (`syncStripe.mjs verify` 26/26 clean),
so the placeholder no longer exists; the net gap below is unchanged and
the three-line test (no price value carries a placeholder marker) still
closes it for any future pending-price row.* The finding as written:
`storeConfig.stripe.prices.packSkin` was
`"price_PENDINGPACKSKIN"` (the known pending release step), and every
net in the repo lets it through: the value shape regex
`/^price_[A-Za-z0-9]+$/` matches the placeholder, the key-coverage pin
passes (the key exists), and `syncStripeVerify.test.ts` builds its mock
Stripe from the same `storeConfig` — so `verify` passes *against
itself*. The first net that would actually see the placeholder is the
live Stripe checkout. A three-line test (no price value carries a
placeholder marker) closes the hole at the cost of the one release step
it shadows. Companion note: `syncStripe.mjs`’s repo parser reads only
the FIRST `prices:` block (the test-mode one); the `stripeProd` block is
populated by a manual paste at the launch flip, and nothing in-repo
validates that a pasted `--live` snippet parses — the flip step is
“paste and run `verify`”, which is adequate for a one-time launch action
and noted here only so the bimodal rule of F34.2 doesn’t get applied to
the wrong block.

**Not re-audited:** equation shapes & difficulty content (pass 15), the
cosmetic economy (16), the goal / achievement content itself (23),
telemetry label taxonomy (26), the pacing curves the content sits on
(19), and the out-of-repo ops state (the live Play / Stripe consoles —
`syncStripe verify` is the net for the Stripe half, the Play half is
`play.mjs` + console, by design out of jest). Play listings are
console-managed with no repo surface, so they are not a sync axis.

**Source quality (pass 34).** Internal audit by construction (the same
class as passes 30–33): no external sources, no external claims —
every statement above is a property of the authoring / sync /
persistence wiring as of this commit, verified against `src/`,
`scripts/stripe/`, `stripe/`, and `pb_hooks/`.

### The release / distribution pipeline layer (pass 35 — build → version → gate → deploy, written 2026-09-10)

Every layer so far was one the player *experiences*; this one is the
path a release takes to get there, and it is internal by construction:
`expo export -p web` (the static web build) and `expo prebuild` + gradle
(the AAB) → the version pair (`version` + `android.versionCode` in
`app.config.ts`) → the gates (typecheck / lint / test, the e2e harnesses)
→ the two deploys (`wrangler pages deploy dist` for the web static site,
the Play Developer API via `pnpm run play` for Android). The stress test
is “what must be true for a release to be reproducible by someone who
only has this repo”.

**Fully-netted surfaces (verified against the repo this pass).**
The web e2e runs against the *real* production build: `test:e2e:web`
is `expo export -p web` + serve `dist/` + Playwright, so a dev-only
(`pnpm run web`) behavior drift would be caught; the ad test-mode flag
(`data-adbreak-test`) is injected at serve time by `e2e/web/server.mjs`,
and the IAP round-trip is stubbed at the network layer — no live ad
impressions, no live Stripe / Pocketbase traffic. The native build input
is reproducible: the `withDebugSigning` config plugin re-applies the
debug-bundle + upload-signing patches on every prebuild and its unit
test (`plugins/__test__/`) asserts the committed `android/app/build.gradle`
is byte-for-byte what a clean prebuild produces; the keystore is
root-anchored and gitignored with a documented re-download path.
Store-critical config is pinned from `app.config.ts` by
`storeConfig.test.ts` (version / versionCode, the release-keystore
properties, the ad units, the IAP units, the play config) — a release-
config drift breaks a test, not just the store. The release CLIs are
offline-testable (`scripts/__test__`, `scripts/stripe/__test__`,
`pb_hooks/__test__` — no live API calls in jest). The disabled gates
are labelled, not forgotten: both `.github/workflows/*.disabled` files
state their rename-to-re-enable in a header comment, and the release-
gate todo item tracks them.

**F35.1 — `release:wrangler-pin` (Tier 2).** The web deploy path
(`predeploy` / `deploy` scripts) ends in a *bare* `wrangler pages deploy
dist` — and `wrangler` is in neither `package.json` nor
`pnpm-lock.yaml` (verified by grep), so the deploy runs with whatever
CLI version the machine happens to have, while `wrangler.toml` is a
v4-shaped config (`[pages]` block + a `wrangler.jsonc` alias). A
v3-only machine errors on the config parse; two different v4 minors can
behave differently on asset upload. Deploy reproducibility is a
property of the dev machine, not of the repo, and nothing tests it —
the disabled CI runs typecheck / lint / test and never deploys, and a
fresh clone cannot reproduce the deploy without knowing which `wrangler`
to install first. Fix: `pnpm add -D wrangler` (the v4 major the config
is written against), route the scripts through the local binary, and
add the three-line test that `wrangler` is a direct devDependency
(the `storeConfig.test.ts` shape — read `package.json`, assert).

**F35.2 — `app:route-only-net` (Tier 2).** “ONLY route files belong
under `src/app/`” (AGENTS.md gotcha) is doc-enforced only. Because the
web static export emits an HTML page **per route**, any stray non-route
file placed there (a `helpers.ts` next to the screens, a co-located
`.test.ts`, a stray `.d.ts`) silently becomes a public URL — a broken
`/helpers.html` shipped to Cloudflare — and a 404 screen in the native
builds; the export itself *succeeds*, so nothing fails. The route table
is three roots today (/, /settings, /store) plus the special files
(+html), so the blast radius is small — but the guard is discipline,
and the failure mode is “shipped a broken public page” rather than
“a build broke”. Fix: a jest test that enumerates `src/app/**` and
asserts the set equals the known routes + special files (+html,
+not-found when it lands) — a route addition becomes an intentional,
test-visible change (updating the test is the ritual).

**F35.3 — `release:version-doc` (Tier 2, low).** The version-bump rule
is doc-only, and the doc contradicts itself: `docs/store-integration.md`
says every future upload bumps `version` + `android.versionCode` in
`app.config.ts` **and** `versionCode` / `versionName` in
`android/app/build.gradle` in sync — but that file is prebuild-
GENERATED (AGENTS.md: don't edit generated files there), prebuild
re-injects the versions from `app.config.ts` on the next prebuild, and
the committed tree is already at `8`/`1.0.8` while `app.config.ts` is
at `32`/`1.5.4` — expected for a generated tree, but an operator who
follows the doc's double-bump will hand-edit a file prebuild silently
rewrites, and the two sources of truth disagree in the committed tree.
The one net that exists is good but indirect: `storeConfig.test.ts`
pins the *current* value, so a forgotten bump fails typecheck-adjacent
tests — a “bumps are deliberate” net, not a shape net. Fix is
 doc-only + one small test: state in the doc that `app.config.ts` is
the single source of truth (prebuild syncs `build.gradle`; the committed
`android/` is generated and expected to be stale until the next
prebuild), and add a cheap test that `version` is semver-shaped and
`versionCode` is a positive integer (shape, not value).

**Not re-audited:** the e2e flows' *content* (what the flows assert is
the e2e layer's own surface; only the harness wiring is in scope here),
the sidecar deploy path (pass 28's deploy axis), and the out-of-repo ops
state (the live Play / Cloudflare consoles — `play.mjs`'s
`products-check` and the `verify` commands are the nets for those,
by design out of jest).

**Source quality (pass 35).** Internal audit by construction (the same
class as passes 30–34): no external sources, no external claims —
every statement above is a property of this repo's build / gate /
deploy wiring as of this commit, verified against `package.json`,
`app.config.ts`, `wrangler.toml`, `pnpm-lock.yaml`,
`.github/workflows/`, `scripts/`, `plugins/`, `e2e/web/`, and
`docs/store-integration.md`.

### The web discoverability / search layer (pass 36 — how a crawler sees the site, written 2026-09-10)

Pass 35 walked the export out to the deploy step; this pass audits
what the deployed static export *presents* to the things that find a
site before a player does: search crawlers (Google, Bing) and the
ad network (AdSense/Google). Internal audit by construction (the same
class as passes 30–35): every statement below is a property of this
repo's web export as of this commit — `public/`, `src/app/+html.tsx`,
`app.config.ts`, and the exported `dist/` — no external sources, no
external claims.

**What this pass landed (the two one-off todo items, closed 2026-09-10):**

+ `public/ads.txt` — the AdSense/Google-ads requirement for a first-party
  publisher site: one line, `google.com, pub-2101316086878618, DIRECT,
  f08c47fec0942fa0` (publisher id derived from `storeConfig.adsense.client`
  — the same value the loader tag in `+html.tsx` is gated on; `DIRECT`
  because the site runs the ads itself; the hash is Google's standard
  cert-hash for first-party Google rows). `public/` copies verbatim into
  the static export root, so it ships at `https://<site>/ads.txt` with no
  build-config change (verified in the exported `dist/`).
+ SEO head in `src/app/+html.tsx` — canonical link (`https://minesofdoom.
  pages.dev/`), Open Graph + Twitter card meta (title/description/image),
  and a minimal `WebApplication` JSON-LD block (`price: 0` — the free
  guardrail-1 stance is machine-readable too). Shared by every exported
  page because the app is a single route.
+ `public/robots.txt` (allow-all + the sitemap ref), `public/sitemap.xml`
  (the single route + the two legal pages — the only other real URLs the
  export ships), and `public/og-image.png` (the 22KB `app-icons/icon.png`,
  1024×1024 — the logo.jpg stays out of `public/` as before, per the
  existing favicon note in `app.config.ts`). All verified in the exported
  `dist/` (files at the root, head tags present in `index.html`).

**Candidates (documented, not planned):**

+ **F36.1 — `search:console-verify` (Tier 2, trigger-gated; mostly
  out-of-repo).** Nothing the repo can do: Google Search Console and
  Bing Webmaster verification are account actions (a DNS TXT or an HTML
  meta token for the verified domain), and the AdSense site approval is
  Google-side. Recorded so the next release pass doesn't rediscover that
  a sitemap.xml and ads.txt are the *repo* half of the "Google sees the
  site" checklist, not the whole of it. Trigger: the first production
  web release (guardrail 5's measure-first batch is the natural owner —
  the same operator session that starts the Search Console property
  should paste in the verification). Zero code; the repo side is done.
+ **F36.2 — `export:seo-shape-net` (Tier 2).** The export is netted for
  *shape* on the app side (the e2e boot spec runs against the real
  `expo export` build) but nothing asserts the *discoverability files*
  ship and are well-formed: a rename or delete of `public/ads.txt` /
  `public/robots.txt` / `public/sitemap.xml` passes every gate in the
  repo, and AdSense approval and search indexing would just not happen
  (the failure is silent, like F35.2's stray-route class but outward).
  Cheap: one jest test that reads the three files from `public/` and
  asserts (a) ads.txt has exactly one row naming `google.com` + the
  `pub-` form of `storeConfig.adsense.client` (the two values already
  live in `storeConfig.test.ts`'s pinned world, so this is the same
  "can't drift" net, not a new one), (b) robots.txt points at a
  sitemap that (c) exists and is parseable XML with the site root in it.
  Trigger: rides the F36.1 release session (the net is only useful once
  the files matter, i.e. once the domain is verified).
+ **F36.3 — `seo:installability` (candidate, alias for the existing
  Tier 1 #14).** Installable-on-web (PWA manifest + install prompt) is
  already Tier 1 #14 (`web:pwa`); it sits in *this* layer too —
  discoverability's ceiling is the install, not the search result.
  Recorded once so the layer is complete; no separate scope, no
  separate trigger.

**Not audited:** per-page metadata (impossible on the single-route SPA
without routing — F36.3's install is the lever instead), international
metadata (the es-market is Tier 1 #14's trigger, not this layer's), and
the social-graph side (share-badge candidates are in the gap layers'
trigger-gated list, deliberately low priority per their sources).

**Source quality (pass 36).** Internal audit by construction: no
external sources, no external claims — every statement above is a
property of this repo's web export as of this commit, verified against
`public/`, `src/app/+html.tsx`, `app.config.ts`, the exported `dist/`,
and `docs/store-integration.md` for the domain.

### The numeric ledger layer (pass 37 — where a value crosses a Number/BigInt boundary, written 2026-09-10)

Pass 19 audited the cost curves as pacing and pass 21 audited the save
blob as persistence; neither asked which number TYPE carries the value
at each boundary — and this game deliberately splits: three counters
are `bigint`, everything else is `number`. This pass audits every
Number↔BigInt crossing in the economy. Internal audit by construction
(the same class as passes 30–36): every statement below is a property
of this repo's economy code as of this commit (`game.ts`,
`useGameEngine.ts`, `saveCode.ts`, `utils/format.ts`, `freePath.ts`,
`game.test.ts`) — no external sources, no external claims.

**The design is strong; the boundaries are deliberate:**

+ Exactly three `bigint` fields on `SaveData` — `minerals`,
  `lifetimeMinerals`, `maxDepth` (minerals went bigint at save
  migration v10; `buildSaveData.mineral()` still accepts a legacy
  pre-v10 number, flooring it — "the value is what the player last
  saw, nothing can be recovered", as the comment says). Every other
  economic field (gems, counts, levels, costs' *inputs*) is `number`.
+ Every float × bigint multiplication in the game goes through ONE
  bridge, `mulFloats` (game.ts: `FLOAT_SCALE = 100n`, half-up final
  division, zero short-circuit). Callers: passive income
  (× prestige), answer payout (× depth-tier clickBonus, × prestige),
  the offline haul and its top-up (× the same prestige multiplier).
  The engine composes INTEGER factors first —
  `BigInt(value) * BigInt(clickPower) * BigInt(comboMultiplier) *
  BigInt(clickBoost)` — and only then passes the float factors through
  `mulFloats`; the combo multiplier is *designed* integer
  (`1 + floor(combo / 10)`), which is exactly what makes that first
  product exact.
+ Both persistence surfaces share one JSON-safe stringify
  (`serializeSaveData`, bigint → decimal string) — the AsyncStorage
  save, the save-code encoder, and the cloud snapshot all ride it,
  and the decode side (`mineral()`) parse-guards the strings
  (corrupt → fallback, never thrown). So a bigint can only ever
  re-enter the ledger as an exact integer.
+ The display side is exact too: `format.ts` has a dedicated bigint
  path in BOTH notation modes (compact scales by exact `1000n **
  tier` integer division; plain is a regex over the digit string —
  no float round-trip at any magnitude), mirroring the number path's
  value law so the two modes never disagree.
+ The guardrail-1 free-path benchmark (`freePath.ts`) already runs
  its cost-side arithmetic in `BigInt` (verified in
  `freePath.test.ts`), so the benchmark is unaffected by every
  boundary below.

**F37.1 — `ledger:mulfloats-net` (Tier 2).** The bridge's exactness
rests on an invariant that is asserted nowhere: every float fed to
`mulFloats` must be an exact multiple of 0.01 (scale 100). Today that
holds — `DEPTH_TIERS` clickBonus `{1, 1.1, 1.25, 1.5, 2}`,
`PRESTIGE_LEVELS` multipliers `{1, 1.5, 2, 2.5, 3.5, 5}`, and the
offline path's `1`/`2` — but (a) `mulFloats` has no direct unit test
(the only mention in `game.test.ts` is a comment at its
`getPendingAnswerGain` site), and (b) nothing checks the two tables
against the scale-100 rule, so a future ×1.15 or ×1.05 line would
silently introduce a 1/20000–1/100 rounding error, visible only as a
suspicious gain. The half-up rule's comment ("minerals are an idle
counter, never a currency ledger, so a half mineral is worth the
determinism") documents the intent in prose only. The net is cheap:
direct `mulFloats` unit tests (exact cases incl. the `1n × [1.1, 1.5]`
half-up example from its own doc, the zero short-circuit) + table tests
asserting every caller-fed value satisfies `f * 100` is integral
(same "can't drift" class as `storeConfig.test.ts`, not a new net).

**F37.2 — `ledger:number-boundary` (recorded, not a defect).** The
quartic-family cost functions (`level⁴` click/miner curves,
`1000·current²` miner power, the `n²` gem lines) and
`getMineralsPerSec` (a `miners × minerPower`-class product) stay
`number` even though the balance they're compared against is bigint.
The quartic cost crosses `Number.MAX_SAFE_INTEGER` at level 9742
(cost ≈ 9.007e15); beyond that it is a ROUNDED float — but every
consumer (the display, the affordability flag, the deduction,
`buyAllCumulativeCost`'s float sum, which also carries an
`isFinite` break) reads the SAME number, so the ledger stays
internally consistent: a purchase can never cost a different amount
than it displays. `perSec` loses relative precision around
3.4e8 × 3.4e8 miners × power, where the miner cost itself is ≈ 1e35 —
unreachable. Recorded (like F34.2's versioning rule) so a future
content pass that ever pushes miner counts toward 10⁵+ knows the
cost/perSec pair should be promoted to bigint the way minerals was at
v10, and that no test needs to net the 2^53 boundary today.

**F37.3 — `ledger:buildclamp-gaps` (Tier 2, low).**
`buildSaveData`'s clamping is asymmetric, and the one unclamped field
is a wallet. The three bigint counters go through `mineral()` (floor,
≥ 0 clamp, guarded `BigInt` parse); the count/level fields get
`Math.max(0, Math.floor(...))` + cap; but `gems`, `lifetimeCorrect`,
`maxCombo`, `minersOwnedEver`, `totalGemsMinted/Spent`,
`totalPrestiges`, `startTime`, `saveTime` pass through bare `num()`
(only a `Number.isFinite` check). A CRAFTED save code (the `MOD1` +
dot + base64 prefix is trivial to forge) can therefore import
`gems: -5` or `gems: 3.7`: the engine floors *increments*
(`grantGems`) but never the balance, so a fractional or negative gem
wallet persists through the load pipeline that pass 21 documented and
renders as-is (`formatNumber` floors for display only). Blast radius
is benign — every engine purchase guard is `n.gems < cost → return n`
(verified at all six gem-buy sites), so nothing debits below zero and
the mint path is store-verdict-gated (pass 28) — but pass 28's
"clamped levels" claim overstates the net: the gem wallet is a
clamped-adjacent field that isn't. The fix is the same one-liner the
count fields already get: floor + `Math.max(0, …)` on the wallet
(and, while there, the lifetime counters' family). Trigger: rides any
save-import hardening session; not standalone.

**Recorded, not a defect (gem-rate saturation).** `rollGem` pays
`Math.random() < chance × comboMultiplier` with an UNBOUNDED
multiplier (`1 + floor(combo/10)`), so past combo ≈ 30 (chance at cap:
5% base + 20 × 1% = 25%) every correct answer mints a gem, and the
higher the combo the faster the mint line compounds. That is a
balance property of the combo line, not a ledger defect — the mint
stays exact (`lifetimeDelta` books it) and the caps clamp the *chance*
line, not the combo — but it belongs to pass 29's monetization-mix
question (is the gem faucet combo-gated enough?) more than to this
layer's.

**Not audited:** the equation operand magnitudes (pass 15's difficulty
domain — integers generated within configured bounds, never crossing a
boundary), the analytics counters (pass 26), and the clock surfaces
(passes 17/28 — the offline tick math is bigint-exact at its one
crossing: `BigInt(perSec) * BigInt(elapsed)` before `mulFloats`).

**Source quality (pass 37).** Internal audit by construction: no
external sources, no external claims — every statement above is a
property of this repo's economy code as of this commit, verified
against `game.ts`, `useGameEngine.ts`, `saveCode.ts`,
`utils/format.ts`, `freePath.ts`, and `game.test.ts`.

### The dependency / supply-chain layer (pass 38 — the third-party code the app is built on, how it's pinned, and what a version move touches, written 2026-09-10)

Passes 30–37 audited the code the game writes; none asked what the
app is *built on*. This pass audits the substrate: the 21 direct
runtime + 39 dev dependencies (≈570 packages, `lockfileVersion 9.0`),
their pinning discipline, the native/SDK config files that ride beside
them, and what a version move would actually touch. Internal audit by
construction (same class as passes 30–37): every structural claim is a
property of `package.json`, `pnpm-lock.yaml`, `app.config.ts`,
`tsconfig.json`, `metro.config.js`, `jest.config.js`, and `AGENTS.md`
as of this commit. The only external tool run was `pnpm audit`
(count, not chased — see F38.3). No external claims.

**The substrate is healthier than its prose suggests:**

+ The Expo/React core stack is **tilde-locked** — `expo ~57`,
  `react-native ~0.86`, `react 19.1.0` exact, `metro ~56` via
  `jest-expo ~57` — so a fresh install cannot float the framework past
  Expo's major without an explicit edit. That is the load-bearing part,
  and it is done right.
+ The lockfile (`pnpm-lock.yaml`, v9.0) is committed and intact, so the
  *reproducible* story exists; the gaps below are about *future drift*
  and *unenforced prose*, not a broken lockfile.
+ The test leg of the dependency story is clean: the store-config suite
  imports the bare `assets/` alias and runs hermetic in 0.35s
  (no live Stripe/Pocketbase/Google — pass 32's IAP-test isolation
  holds at the dependency layer too), and the one pure crypto leaf
  (`pako ^3`, save-code compression, used at runtime in `game.ts`) is
  tiny and well-established. No keychain/native-secret dependency
  anywhere in the tree.

**F38.1 — `dep:pin-drift` (Tier 2).** The pinning discipline is
inconsistent exactly at the dangerous boundary. The Expo core is
locked to Expo's major (above), but the third-party *leaf* deps that
carry the real native surface area are **caret-pinned**, and a caret
floats MINOR versions on the next `pnpm install`/`add`:
`expo-admob ^14.4.x`, `expo-av ^15.x`, `react-native-purchases ^8.x`,
`react-native-mmkv ^3.x`, `expo-updates ^29.x`,
`react-native-qrcode-svg ^6.x`, `@expo/google-maps-android ^29`,
`@react-native-community/cookies ^7.0.x`, `expo-splash-screen ^0.40.x`.
The cost of such a float is asymmetric and invisible to every gate in
this repo: an admob/av/purchases minor can ship a **native** ABI or
runtime change that only surfaces on a device/emulator, and all three
local gates (typecheck, lint, jest) are JS-only and will not see it
(the hermetic e2e web suite, pass 36, also never compiles native
modules). The lockfile already records the exact installed versions,
so flipping these carets to tildes/exact changes *future drift
behavior only* — a fresh install can no longer move them without an
explicit choice. Low blast radius, cheap. (Recorded, not a defect: a
minor float of a native lib is usually *wanted* — bugfix minors — so
this is about making the choice explicit and enforced, not about carets
being wrong.)

**F38.2 — `dep:pnpm-major` (Tier 3).** There is no `packageManager`
field and no `engines` in `package.json`; the only pnpm-major signal is
the `lockfileVersion 9.0` line in the lockfile (pnpm 9). A pnpm-major
switch silently changes the tree: pnpm 8 reads a 9.0 lockfile as
incompatible and regenerates; a different pnpm 9.x/10 can resolve
differently. Nothing in the repo names the authoritative pnpm major,
and with CI currently disabled there is no gate that would catch a
contributor (or a re-enabled pipeline) building with the wrong major.
This matters *more* than usual here because `AGENTS.md` documents that
`.npmrc` sets `node-linker=hoisted` and that **Metro and the
"jest-in-dependencies" setup require a flat npm-like `node_modules`**
— i.e. the build depends on pnpm-specific layout behavior, which is
exactly what a pnpm-major change can perturb. Fix is one line:
`"packageManager": "pnpm@9.x"` (enforced by corepack's
`packageManager` check). Record: the dependency layer's reproducibility
rests on a lockfile version string, not a declared contract.

**F38.3 — `dep:advisory-gate` (recorded).** `pnpm audit` currently
reports **4 vulnerabilities (2 high, 2 moderate)**. This pass does NOT
chase those specific advisories (out of scope, and advisory state is
volatile — the count itself is the finding). The layer's real gap is
that there is **no automated advisory gate at all**: CI is disabled, so
the only advisory signal is a manual `pnpm audit`, and there is no
recorded policy on (a) `--prod` vs the full tree, (b) a severity
threshold that would block a release, or (c) where an advisory check
sits in the (currently `.disabled`) pipeline. Most of the tree is
dev-chain (jest/expo/prettier/eslint dev tooling) with no reachable
surface in a shipped idle game, which is why "2 high" is almost
certainly not a product risk — but that's an inference, not a checked
fact. Recorded so pass 35's successor (the release-pipeline pass) has a
concrete decision: advisory threshold + prod-only scope + a CI step.

**F38.4 — `dep:prose-contracts` (Tier 2).** Several load-bearing
dependency relationships exist **only in prose** (`AGENTS.md`) with no
machine check, and this pass found one of them weaker than documented.
  (a) *The alias contract* — "keep `src/*`, `components/*`, `hooks/*`,
  `assets/*` in sync across `tsconfig` ↔ `metro` ↔ `jest`". In fact
  `jest.config.js` explicitly maps **only** `^src/(.*)$`; the bare
  `assets/` alias resolves in tests with no explicit mapping (so
  `jest-expo` 57 is honoring the tsconfig `paths` directly), and
  `components/`/`hooks/` are **imported by no test at all** (verified
  by grep) — so that leg of the "keep 3 configs in sync" rule is
  unexercised, and its working-today-ness is a *version property of
  jest-expo 57*, not pinned config. A future test that imports
  `components/X` will work only as long as jest-expo keeps auto-honoring
  tsconfig paths. (b) *The prebuild contract* — "don't edit
  `android/app/build.gradle`; the `plugins/withDebugSigning` config
  plugin re-applies the debug-bundle + release-signing patches on every
  prebuild; `expo prebuild --clean` reproduces the committed dir
  byte-for-byte." That plugin is **first-party JS, not a pnpm
  dependency** — it is invisible to `pnpm audit` and the lockfile, yet
  it is the single most load-bearing thing on native boot (the committed
  `android/` dir matching a fresh prebuild). The unit test
  (`plugins/__test__/withDebugSigning.test.js`) tests the plugin's
  *logic*, not that its output matches the **current Expo SDK's**
  actual prebuild output — so a major Expo bump (the one thing the
  tilde pins *do* allow, within Expo's major) could change prebuild
  output and silently break the "byte-for-byte" claim with no net. (c)
  *The versionCode coupling* — `App.tsx` reads `android.versionCode`
  from `app.config.ts`; "bump both" is prose, no net. Fix is a small set
of cheap nets: a test asserting the three alias maps (tsconfig paths,
  metro aliases, jest moduleNameMapper) resolve the same four roots;
  a test that the `withDebugSigning` patch output byte-matches a fresh
  `expo prebuild --clean` for the *pinned* SDK; a warning when
  `versionCode` lags `version`. None is standalone-critical; the theme
is that the dependency layer's reproducibility currently rests on
prose + a first-party plugin, with no check tying it to the pinned
versions.

**Recorded, not a defect.** The native/SDK config files are
version-independent by design and correctly outside the lockfile:
`android/key.properties`, `ios/GoogleService-Info.plist`,
`android/google-services.json` (all required-at-prebuild, none in
`.env`/gitignored secrets), the `com.google.android.gms.ads.APPLICATION_ID`
meta-data constant, and `play-service-account.json` (gitignored,
Play-Console side). These are *credentials/config*, not dependencies —
no finding. Also recorded: the Expo-managed Android SDK matrix
(`play-services-ads 24.1.0`, `firebase-auth 23.2.0`, etc. in
`app.config.ts`) is Expo's choice, not the app's — auditing it is
pass 30/32 (platform/account) territory, not the dependency layer.

**Not audited:** the *content* of the 4 advisories (F38.3 — deliberately
not chased this pass), the 570-package transitive tree package-by-package
(full transitive audit is out of scope for a layer pass), the wrangler /
Cloudflare deploy toolchain (pass 35), and the Play-Console API contract
(`play-service-account.json`, pass 33's cloud layer).

**Source quality (pass 38).** Internal audit by construction: no
external sources, no external claims — every structural statement is a
property of `package.json`, `pnpm-lock.yaml`, `app.config.ts`,
`tsconfig.json`, `metro.config.js`, `jest.config.js`, and `AGENTS.md`
as of this commit. The single external tool run was `pnpm audit`
(vulnerability count only, not chased, per F38.3); the single external
empirical check was running the hermetic `storeConfig` jest suite to
confirm bare-alias resolution (F38.4a).

### The server-side store-verification layer (pass 39 — what runs when a purchase is verified, minted, and restored, written 2026-09-10)

Pass 24 audited the leaderboard half of this same Pocketbase surface
(submit caps, merge rules, the 30/hour durable write budget, the trust
model); pass 28 audited the signature chain (S2: the sidecar verifies
Stripe-Signature over the raw body, the trusted-source gate); pass 29
the client-side catalog; pass 33 the account data plane. Nobody had
audited the handler logic that *mints and reads entitlements* — the
money path itself: verify → upsert → restore, with the webhook backup
mint — or the shared device-row helpers those lean on. This pass does,
on the server side: `handlerLib.js` (`handleVerify`, `handleRestore`,
`handleStripeWebhook`, `linkDeviceRows`, the shared `upsertDeviceRow`),
the collection contracts (`collections.js`), the route table
(`endpoints.js`), and the ten `__test__/` files (≈2,944 lines) that
net them.

**F39.1 — `entitlements:clobber-on-second-purchase` (real bug, →
Tier 1 #23).** The collection contract says "one row per
(deviceId, productId)" (`collections.js`, the `entitlements` def), and
both readers honor it: `listEntitlements` filters `deviceId = …` and
maps *every* row's `productId`, and `handleRestore`/`handleVerify`
union device rows with the account's rows. But the shared writer
doesn't key on the pair: `upsertDeviceRow(app, "entitlements",
deviceId, row)` looks the row up with
`findFirstRecordByData(name, "deviceId", deviceId)` — **deviceId
alone** — and on a hit sets *every key of the new row* on the existing
record. The first pack creates the row; a second, different pack on the
same device finds that same row and rewrites it in place: `productId`,
`tokenHash`, `verifiedAt`, `platform` all flip to the newer purchase
and the first pack's entitlement row no longer exists. The readers can
only return what's in rows, so restore and the verify response return
only the last product purchased — on a 26-pack catalog, any two-purchase
player on one device is affected.

+ *Why it's masked in normal play:* the client keeps entitlements in a
device-local AsyncStorage and restore is explicitly additive ("a
restore can never revoke" — `iapProvider.ts`), so the loss surfaces only
when the server row is the recovery source: a reinstall, a fresh
device, or the cross-device account restore. That is the worst moment
to lose a purchase (the player just asked the game to give it back).
+ *Blast radius of the same assumption:* `linkDeviceRows` (the sign-in
backfill, "claim, never copy") also takes the *first* row found per
collection via the same single-row helper — in the intended
multi-row-per-device world, only one of the device's entitlement rows
ever gets the `accountId` tag, so the account-union restore misses the
others even when they exist.
+ *Why the suite missed it — two independent gaps:* (1) every webhook
scenario mints one product per device, so the find → set → save cycle
is idempotent under BOTH semantics and the divergence never fires;
(2) the fake datastore's `save()` implements the *intended*
upsert — its comment literally says "upsertDeviceRow semantics: one
row per device+product" — and the handler mutates a `FakeRecord`
shallow-copy, so even a two-product scenario against the fake would
pass: the fake pushes a second row where Pocketbase's in-place record
mutation clobbers the stored one. The fake models the design, not the
code; the one place it mirrors production exactly (`findFirstRecordByData`
matching on the given field) is the field the handler chose wrong.
+ *Fix (small):* key the `entitlements` upsert on the pair — look up
with `findRecordsByFilter("entitlements", "deviceId = {:d} &&
productId = {:p}", …)` instead of `findFirstRecordByData(…, "deviceId",
…)` (keep the single-row-by-deviceId shape for `cloudSaves` /
`leaderboard`, where one row per device is correct), make
`linkDeviceRows` iterate the device's rows rather than the first one,
and add the regression test the fake's comment promises: real
`handleVerify` against a production-faithful fake (in-place record
mutation), two distinct products, one device → two rows.

**F39.2 — `verify:no-direct-coverage` (the gap that let F39.1 hide).**
Of the minting surface, only the webhook *backup* path has a direct
handler test. `handleVerify` — the PRIMARY path (client return-visit
verify, the platform the player actually hits) — and `handleRestore`
have no test at all; `handleCloudPush`/`Pull`,
`handleLeaderboardSubmit`/`Top`/`Rank`, `handleDelete`, and the auth
handlers (register/login/google/apple/link/set-password/logout)
likewise. `logic.test.js` covers the pure halves (validators, merge,
budget, KDF, session, provider-merge) and the sidecar has its own
suites, so the *logic* is netted — but the handler wiring between
validation and record I/O (the layer where F39.1 lives) is exercised
only for `stripe/webhook`. The money path's coverage map: webhook
backup ✔ (with the F39.1 divergence), primary verify ✘, restore ✘.

**F39.3 — Recorded, not a defect.**

+ A *refused* verify records no dedup marker, so a Stripe retry can
still mint once the sidecar is healthy — "a refused verify must not
poison the dedup marker" (tested, fail-closed mode).
+ Webhook idempotency on the Stripe event id is tested, including the
duplicate-delivery no-op (`events` rows: `kind: "stripe-event"`,
`payload: <eventId>`, pageSize 1 probe).
+ The trusted-source gate's header normalization is tested across three
wire shapes (canonical, canonical-cased, v0.40 snake_case
`x_mdoom_key`) — a live-probed regression: a hyphen-only lookup 403'd
the sidecar's own correctly-keyed forward on the public v0.40.3
deployment.
+ Re-verify of the *same* product is idempotent under both semantics
(the row just refreshes `tokenHash`/`verifiedAt`), so a webhook
delivery racing the client return-visit verify can't double-mint.
+ `accountId` is set, never cleared: a row minted signed-in keeps its
account tag through later anonymous writes on the same device (the
update path sets only keys present in the new row). Direction of
effect is grant-not-revoke (the tagged account can restore the row;
the writer is the same device), and the sign-in backfill deliberately
re-labels ("claim, never copy") — a property of the backfill model,
recorded so a future pass doesn't re-derive it.

**Not audited this pass:** the sidecar's Stripe-API internals
(checkout lookup, price-map enforcement, `verify.js`'s JWKS/identity
path) — covered by their own suites
(`stripeCheckoutRoute`, `stripeWebhookSignature`, `verifySidecar.*`,
`identityVerify`, `storeVerify`) and pass 28's S2 posture; the
ops/deploy half (compose, container env, the `MDOOM_*` surface) is
pass 35/28 territory (`deploy:prod-env-gate`, Tier 0 #12). One stale
doc reference found en route: `docs/store-integration.md` still cites
`pb_hooks/verify-purchase.js` — a module that no longer exists (verify
lives in `storeVerify.js` + the sidecar); same drift class as F33.2's
stale gate lines, folded into that item's fix rather than ranked anew.

**Source quality (pass 39).** Internal audit by construction (the same
class as passes 30–38): F39.1–F39.3 are properties of this repo's
`pb_hooks/*.js`, `pb_hooks/__test__/*.js` (10 files, ≈2,944 lines),
`collections.js`'s field contracts, and the client's IAP seam
(`useIap.ts`, `iapProvider.ts`, `iapProvider.web.ts`) as of this
commit — no external sources, no external claims. The F39.1 clobber
trace was followed line-by-line through `handleVerify` →
`upsertDeviceRow` → `findDeviceRow` → the fake's
`findFirstRecordByData`/`save` in `handlerStripeWebhook.test.js`; no
external corroboration was sought for an internal-code claim.

### The tick / time-scheduling layer (pass 40 — every clock in the repo, and what freezes each, written 2026-09-10)

Pass 17 audited the absence *accounting* (which minerals get paid for
away time, through which of the two paths); pass 20 the cost of a second
(what one tick renders); pass 13 the input path (where a tap enters). None
audited the *scheduler itself* — what fires, when, what freezes it, and
which state would die if a fire never came. Live audit (2026-09-10):
the tick loop + liveness effects in `useGameEngine.ts`, the `onTick`
registry contract in `Context.tsx`, the `msPerTick` / `maxOfflineTicks` /
`activePlaySeconds` / `LIVE_PLAY_TICK_CAP` block in `game.ts`, the 50 ms
rAF flush in `useMineTaps.ts`, and all eight deadline pollers
(`useDailyBonus`, `useDailyEquation`, `useWeeklyChallenge`,
`useIdleReminder`, `useGemPocket`, `AdRewardsPanel`,
`ComboSaveIndicator`, and `MinesOfDoom`'s combo-save expiry interval).

**The load-bearing invariant holds (audited, no violation).** Exactly two
timer shapes exist in the repo, and neither counts fires:

+ *Catch-up timers.* The engine loop is `setInterval(msPerTick=1000)` but
  every fire recomputes `elapsed = floor((now − last) / msPerTick)` from
  wall clock (per-fire capped at `maxOfflineTicks`), so a fire being late
  loses no time — the catch-up *is* the resume handler; there is no
  resume handler. The 50 ms tap flush (`useMineTaps`) likewise recomputes
  `Date.now()` on every frame instead of banking a per-frame constant.
+ *Deadline pollers.* Every other timer in the repo polls a wall-clock
deadline — `now ≥ until` (gem-pocket expiry, combo expiry, the two
countdown panels), a local day-key (daily bonus / daily equation, 60 s
poll), a local week-key (weekly challenge, 60 s poll), or an idle
threshold (5 s poll) — so a late fire can only *delay* a transition
becoming visible, never *miss* it (React bails out on unchanged keys, so
the 60 s polls are no-ops most minutes).

Consequence, verified across all ten sites: the OS behaviors that freeze
JS — iOS process suspension, Android keep-alive-or-kill, Chrome's
background-tab timer throttling (≤1 fire/min) — can delay any state in
this repo but never lose it, because the next surviving fire recomputes
from `Date.now()`. That is why the game survives bfcache restores,
laptop sleep, and Android process death with zero `resume` code: there is
none to write, by construction.

**F40.1 — `tick:registry-not-a-clock` (Tier 2, low).** The documented 1 Hz
animation clock is actually “1 Hz *while passive income is non-zero*”.
`Context.tsx` describes `onTick` as “the engine's 1Hz loop calls every
registered callback exactly once per tick” — but the loop invokes the
registry only inside `if (miners > 0 || fastMiners > 0 ||
legendaryMiners > 0)`, and only after the `elapsed < 1` early return. A
zero-miner session (the whole run until the first miner purchase) gets no
tick callbacks at all. The gate is correct for the registry's only consumer
(`Miner` rows, which `MiningCanvas` mounts per miner — a zero-miner roster
mounts none), and the *reason* the eight deadline pollers each reinvent a
1 Hz clock instead of riding the documented registry is precisely that they
can't trust it as a clock; their deadline-based shape is exactly what makes
them throttle-immune, so the reinvention is *correct*. What remains is the
doc-trap for future consumers: a countdown or spawn roll registered on
`onTick` would silently stop for the entire pre-miner session, and nothing
(a comment at the gate, a doc line, a test) says why. Fix is one line in
`Context.tsx` (state the gate); promoting the registry to a true clock
(moving `onTick` outside the miner branch) is optional and only pays if a
future consumer actually wants to ride it. No player-visible or data
impact.

**F40.2 — `tick:catchup-untested` (Tier 3).** The one expression the whole
absence economy depends on — `elapsed = min(max(0, floor((now − last)/
msPerTick)), maxOfflineTicks)` — is inline in `useGameEngine` and
unit-tested nowhere, while its sibling, the play-time half of the same
fire (`activePlaySeconds`, extracted into `game.ts`, fully tested incl.
the `maxOfflineTicks`-catch-up cap and NaN/negative inputs), is. Same
class as F37.1 (an invariant that lives in code without a net): extract
the catch-up expression into a pure `game.ts` helper (e.g.
`catchUpTicks(lastMs, nowMs)`) and test it the way `activePlaySeconds` is
tested — sub-tick → 0, floor at tick boundaries, backward clock → 0, >8 h
absence → capped. Cheap, no behavior change.

**F40.3 — Recorded, not a defect.**

+ *The pre-load race is netted.* The tick loop and both save-on-background
handlers (`AppState` on native, `pagehide` on web) start on mount — before
the async save load finishes — but `saveGame` guards on `loadedRef`, so a
background during a slow cold start cannot clobber the stored save with
the zeroed in-memory state. The race F39.1's class would have been here;
the guard is there.
+ *Autosave cadence is tick-counted, not wall-counted*
(`tickCountRef − lastSaveTickRef ≥ interval`, with the settings value
clamped to 5–600 s): under background throttling one fire advances up to
60 ticks and the save lands on that fire — throttling delays the autosave
but the effective interval can't stretch past the throttle, and the 5 s
floor means a bad stored value can't disable autosaving. The manual-save,
cloud-push, and pagehide paths all funnel through the same guarded
`saveGame`.
+ *The tap-flush window is the one state that depends on a fire that may
never come:* `useMineTaps` banks gains in a ref and flushes on rAF; a tab
closed inside the ≤50 ms window after the last tap drops the unflushed
gain (rAF doesn't run in a background tab). Bounded by one frame of
accumulation (~a tap or two of click power) and invisible at idle-game
scale; the `pagehide` save can't see it either, because it never entered
state. Recorded, not worth fixing.
+ *Clock phases are independent and that is safe:* no consumer diffs two
separately-scheduled clocks. The engine tick, the 50 ms flush, and the
eight pollers each run on their own phase, and every read of time
recomputes `Date.now()` at the point of use — which is also why a device
clock jump hits exactly the surfaces pass 17 finding (3) already
ranked (`offline:clock-hwm`), not the scheduler itself.
+ *The platform-freeze matrix* (recorded so the invariant above stays
checkable): iOS suspends the process → one catch-up fire on resume,
per-fire capped at 8 h; Android keeps the loop alive (pays every fire in
full) or kills it (the load path pays 8 h + the ad top-up instead); Chrome
throttles a hidden tab's timers to ≤1/min → each fire pays ~a minute,
so a *restarted* absence pays 8 h + 2 h while a *live, hidden-tab*
absence pays everything — the accounting asymmetry is pass 17 finding (2)
(the per-continuous-absence cap, bypassable by chunking); the scheduler
mechanism that enables it is this layer's, and it is ranked there, not
here.

**Not audited this pass:** the offline payment *math* (pass 17 — caps, the
`offlineDouble`/`offlineTopUp` ad offers, streak grace), per-second render
cost (pass 20), the tap input path's latency budget (pass 13), and the
audio pause-on-background (pass 22, `useSounds`' AppState handling).

**Source quality (pass 40).** Internal audit by construction (the same
class as passes 30–39): F40.1–F40.3 are properties of this repo's
`useGameEngine.ts` tick loop, `Context.tsx` registry contract, the
game.ts timing constants, `useMineTaps.ts`, and the eight poller sites as
of this commit — no external sources, no external claims. The platform
freeze semantics are the standard RN-`AppState` / browser-tab behavior
the repo's own comments already rely on; nothing new is asserted about
them.

### The external-code & ambiguous-result layer (pass 41 — code that doesn't come from this repo, and the local state that reacts to its ambiguous results, written 2026-09-10)

Pass 38 audited the *bundled* dependency substrate (lockfile, pinnings,
audit); this pass audits the code the shipped build executes from
*outside* the bundle — the third-party scripts the web build injects or
emits — and the local state that reacts to ambiguous remote results from
the VPS. Live audit (2026-09-10): the two runtime script loaders
(`loadStripe` in `iapProvider.web.ts`, `loadGsiScript`/
`mintGoogleIdTokenWeb` in `signinSdks.ts`), the statically-emitted
AdSense loader tag (`+html.tsx`), `postJsonWithStatus` + the
`storeAuthProvider` outcome mapping in `auth.ts`, and the
mount-time session restore in `hooks/useAccount.ts` (the one local
consumer that acts destructively on an ambiguous `me()` result).

**The inventory is three external origins, two of them
runtime-injected:**

+ `js.stripe.com/v3` — injected at first web purchase (`loadStripe`),
  cached in a module-level promise, retry-on-error by design ("let a
  later purchase retry the load").
+ `accounts.google.com/gsi/client` — injected at first web sign-in tap
  (`loadGsiScript`), fresh element per attempt, 15 s load timeout,
  rejects on failure.
+ `pagead2.googlesyndication.com` — the AdSense loader tag is *emitted
  statically into `+html.tsx`* at export time, not injected at runtime:
  no loader promise, no retry surface, out of scope for this pass's
  loader findings (its boot timing is pass 36/39's territory).

**The non-defect invariants (audited, hold):**

+ *The GSI loader is the repo's correct pattern* and the fix template
  for F41.1: fresh element per attempt (a failed element is never
  re-attached to), an explicit load timeout that *rejects*, and a cancel
  modeled as a typed result (`SignInCancelledError`) rather than an
  error. It never hangs and never leaves a promise unresolved.
+ *Every other ambiguous-result site in the layer is non-destructive:*
  cloud `pull` on a transport failure → "no backup found" (local save
  untouched), IAP verify on failure → the pending-verify *queue*
  (`enqueueVerify` is additive, replayed later), leaderboard on failure
  → "unavailable", IAP `postJson` (which folds every non-2xx *and* every
  transport failure into null) → null maps to "retry later / error
  outcome", never to a local-state wipe. The session-restore `me()`
  below is the one site where a `null` deletes local state.
+ *The fix machinery already exists:* `postJsonWithStatus` (auth.ts) is
  the one fetch wrapper that keeps the HTTP status precisely because
  "409/401 are distinct outcomes, not failure" — `me()`'s fix (F41.2)
  only has to use the status it already receives.

**F41.1 — `web:stripe-script-retry-hang` (Tier 1, #24 — real bug).**
The Stripe loader's retry design is broken on the exact path it was
written for. `loadStripe()` resolves its failure by clearing the
promise cache (`stripePromise = null`) but leaving the dead `<script
data-stripe-v3>` element in `document.head`. The next purchase calls
`loadStripe()` again, `querySelector` finds that dead element, and the
new promise attaches `load`/`error` listeners to a script that has
*already settled* — a settled script never fires either event again, so
the promise never resolves, and (unlike the GSI loader) there is no
timeout to reject it. Consequences, all verified in
`hooks/useIap.ts`: the hang is at `await loadStripe()` inside
`provider.purchase`, so the in-flight guard's `.finally` never runs —
`inFlightRef.current` stays true and `setPurchasing(id)` stays set, so
*every subsequent purchase attempt returns silently and instantly* and
the UI is stuck in the purchasing state. The shop is dead for the rest
of the page session; a reload (which resets the module cache) is the
only recovery. Trigger is one transient failure of a single CDN script
(CDN blip, adblocker, flaky mobile connection) — on the web money
path, the most traffic-sensitive surface in the app (Tier 1 #4's
framing). No test can catch it today: the unit suite stubs
`window.Stripe` present with `querySelector: () => null` (exactly the
branch the bug lives in is never exercised), and the web e2e stubs the
loader at the network layer. Fix: mirror the GSI loader one file away —
on `error`, remove the element (or create fresh per attempt) and add a
load timeout; keep the promise-cache reset. Small, web-only.

**F41.2 — `account:me-network-wipes-token` (Tier 1, #25 — real bug).**
Same defect class as F39.1 (a destructive local action on an ambiguous
remote result), on the account path: `storeAuthProvider.me()` maps
three distinct outcomes to the same `null` — an explicit 401 (the
session *is* dead), *any* other non-2xx (500/502/503/504: the VPS
restarted, is mid-deploy, or is down — the session is still alive), and
a transport-level failure (offline, DNS, the 20 s abort — the
round-trip never happened). `useAccount`'s mount-time restore reads the
`null` as "dead/expired session: drop the stored token" and calls
`clearToken()`. So a cold start while the device is offline — or through
one 5-second VPS blip — silently destroys the stored 30-day token, the
server-side session outlives the client's knowledge of it, and the
player is signed out with no toast and no way to tell; recovery is a
full re-sign-in, and a password-account player who can't recall the
password is locked out of the *linked* Google/Apple session too (the
claim rows survive — the server never copied anything — but the token
is gone). Every other ambiguous-result site in this layer is
non-destructive (the invariant above); this is the one place a `null`
deletes local state. Fix: make `me()` tri-state (dead / unknown /
account — `postJsonWithStatus` already returns the status to tell them
apart) and wipe only on `dead` (an explicit 401); on `unknown`, keep the
stored token, stay `loading`/`out` for this run, and re-attempt `me()`
on the next launch or on a connectivity return. Small; touches `auth.ts`
(the interface + store/dev-sim/noop providers), `useAccount`'s restore
branch, and the `useAccount.test.ts` fakes.

**F41.3 — `web:gsi-dead-element-accumulation` (Tier 3, recorded).** The
GSI loader's one hygiene gap: on `onerror`/timeout it rejects but
leaves the dead (or still-downloading, in the timeout case) script
element in the head, and the *next* attempt injects a *second* element
(rather than reusing or cleaning up) — so N consecutive failed sign-in
attempts with a blocked/broken `accounts.google.com` leave N orphaned
script tags. No functional impact: each attempt is independent, the
`w.google?.accounts` short-circuit makes any later success skip
injection entirely, and a backgrounded late-arriving load just sets
`w.google` for the next read. Fix is two lines (remove the element in
`onerror`/timeout cleanup); recorded, fold into the F41.1 fix if that
touch runs anyway.

**F41.4 — `web:stripe-null-cache` (Tier 3, recorded).** The sibling of
F41.1's hang, on the other two branches of `loadStripe`: when
`window.Stripe` exists but `safeConstruct` returns/throws to `null`, or
the script's `load` event fires but the global is still undefined (a
partial block that lets the tag "load" without executing), the promise
resolves to `null` *and the module-level `stripePromise` cache keeps
that null for the page's lifetime* — unlike the error branch, which
resets the cache for a retry. Same "one bad load bricks the shop for
the session" family, but the trigger is a hostile/partial loader
environment rather than a plain network blip, and the player-visible
outcome is the milder repeated `"error"` (the in-flight guard's
`.finally` still runs, so the shop re-enables) rather than a hang.
Fold into the F41.1 fix (reset the cache on a null resolve too).

**F41.5 — `account:malformed-200-wipes-token` (recorded, sibling of
F41.2).** Third of the three `me()` `null`s, named for the fix: a 200
reply whose body fails `parseAccount` (a sidecar mid-deploy returning a
partial shape, a response-body truncation) also wipes the stored token
— a *successful* transport with a *live* session, deleted locally.
Already covered by the F41.2 fix shape (parse failure maps to
`unknown`, not `dead`); recorded separately so the fix's test matrix
includes a 200-with-malformed-body case and not just the network/401
split.

**Not audited this pass:** the bundled-dependency substrate (pass 38 —
lockfile, pinnings, the audit posture), the server-side sidecar code
itself (pass 39 — `pb_hooks`/Stripe confirmation), the AdSense loader's
*runtime* behavior (static tag; pass 36), and the native SDKs
`google-signin`/`expo-apple-authentication` (their cancel/timeout
contracts are the documented SDK behavior the module header pins; the
lazy-`require` import-time safety is pass 30's platform-parity
finding).

**Source quality (pass 41).** Internal audit by construction (the same
class as passes 30–40): F41.1–F41.5 are properties of this repo's
`iapProvider.web.ts`, `signinSdks.ts`, `auth.ts`, and
`hooks/useAccount.ts` as of this commit — no external sources, no
external claims. The one non-repo fact relied on is the browser
guarantee that a settled `<script>` element fires its `load`/`error`
exactly once and never re-fires for late-attached listeners — the
standard DOM script-element contract the fix template (fresh element
per attempt) already assumes.

### The test & verification layer (pass 42 — the nets that catch everything else: jest, web e2e, probes, and their own gaps, written 2026-09-11)

The layer is well-provisioned but has never been audited as a subject: 77 jest
suites / 1,170 tests (src, pb_hooks, plugins) running in ~7s and hermetic (no
network, no live Stripe/Pocketbase/Google — the store suites stub at the module
boundary, the e2e leg stubs at the network layer), plus the Playwright web e2e
(`e2e/web/`: boot, ads, iap, signin specs + the ad-test-mode export server +
network stubs) and the manual probe scripts (`scripts/stripe/checkoutTest.mjs`,
`gsiOriginProbe.mjs`). Auditing the nets:

**F42.1 — `test:worker-force-exit` (Tier 2 — the full jest run survives only on
a force-exit, and the leak source is now pinpointed).** Every full-suite run
ends with jest's *"A worker process has failed to exit gracefully and has been
force exited"* warning, and the stack jest dumps is the leak:
`commitPassiveMountEffects → … → performWorkUntilDeadline [as _onImmediate]`
in `scheduler.native.development.js` — a live react-test-renderer scheduler
`setImmediate` chain at worker teardown. Cause: 20 `render()` calls across five
suites — `useLeaderboard.test.ts` (×12), `useCloudSave.test.ts` (×4),
`haptics.test.ts`, `useMineTaps.test.ts`, `useEquations.test.ts` — with **zero**
`unmount()` / `cleanup()` anywhere (`nativeStackWiring.test.tsx` is the one
correct suite: 2 renders, 2 unmounts). Cost: (a) any *future* genuine
teardown/regression leak is invisible against this baseline; (b) the standard
diagnostic — `--detectOpenHandles` on the full suite — is unreliable on this
substrate (a 300s probe run timed out inside it this pass; a single-file
`--detectOpenHandles` run is clean and fast, which is exactly the signature of
leaked handles accumulating across suites); (c) the previously observed
"full suite hangs past 300s and resists SIGKILL" is the extreme tail of the
same leak class. Fix is mechanical: add `unmount()` after each of the 20
renders (or a per-suite `afterEach` cleanup) and verify a full run exits with
no worker warning. No player impact today — jest force-exits, results are
valid, the run still finishes in 7s.

**F42.2 — `tree:concurrent-mutation` (Tier 2, methodology — the working tree
mutated under the audit).** Mid-pass, the on-disk `pb_hooks` layout changed
from the 8-module vintage (`index.js`/`handler.js`/`pb.js`/`server.js`/
`stripe.js`/`stripeClient.js`/`verify.js` + 6 `__test__` files) to the committed
vintage (`app.pb.js`/`collections.js`/`endpoints.js`/`handlerLib.js`/
`identityVerify.js`/`logic.js`/`storeVerify.js`/`sidecar/` + 10 `__test__`
files), and 6 files sit uncommitted WIP (`customSkinPicker.ts`/`.web.ts` +
test, `wav.ts` + test, `es.ts` — the in-flight native skin-picker release,
HEAD `90b90e5`). Consequence for this document: file-level coverage findings
written against the old layout (notably F39.2's untested `handleVerify` /
`handleRestore`, and the 401-checkout gap below) must be re-verified against
the current tree before any fix pass is greenlit. Standing caveat, not a repo
defect.

**F42.3 — `pb:checkout-401-untested` (Tier 3, re-verified on the current
tree).** Zero occurrences of `401` in any of the 10 `pb_hooks/__test__/`
files: the unauthenticated checkout-session path (an invalid/expired session
id hitting the `/_stripe/checkout` route) is still untested in the restructured
vintage — carried from the pass 39/41 coverage notes, gap persists.

**Recorded, not defects:** the single-file `--detectOpenHandles` diagnostic
works and is clean (`format.test.ts`: 10/10, 0.3s, no open handles) — the
leak is cross-suite, not per-file. `e2e/web` gained `signin.spec.ts` since
pass 36 (sign-in flow is now e2e-covered; the todo's "10/10" count reflects
the four specs). A `jest-runner` API probe from the project root fails
module resolution (`jest-runner` is not hoisted to the top level under
`node-linker=hoisted` — consistent with pass 38's F38.4 alias/config note;
the CLI form works fine).

**Source quality (pass 42).** Internal audit by construction: properties of
the tree as of `90b90e5` + the 6 WIP files. The leak is reproducible evidence
from this pass's own runs (full-suite task output with the force-exit warning
and scheduler stack; single-file probe clean), not inference. F42.2 is a
record of observed mid-audit tree mutation, with the before/after file lists
as stated.

### The asset-generation & shipped-artifact layer (pass 43 — how the shipped art and audio come to exist, written 2026-09-11)

The layer answers: when a pixel or a sample changes, what actually has to
be regenerated, and what catches a drift. Five `scripts/generate-*.mjs`
compilers plus the in-code grid builders:

| generator | artifact | net on the shipped artifact |
| --- | --- | --- |
| `generate-sprite-library.mjs` | `bundledSprites.ts` (data-URI module) | **strong** — `bundledSprites.test.ts` decodes every URI with the production PNG decoder, pins license/source/size/id shape |
| `generate-pickaxe-sounds.mjs` | `public/assets/audio/pickaxe-*.wav` | none (files are checked in; a corrupt regen is caught only by ear) |
| `generate-ambient-loop.mjs` | `public/assets/audio/cave-ambient.wav` | none (same) |
| `generate-art-style-samples.mjs` | `docs/art-styles/samples/*.png` | none (doc artifacts) |
| `generate-detailed-art-samples.mjs` | `docs/art-detail/samples/*.png` | none (doc artifacts) |

The in-code builders (`pixelArt.ts` grids, `caveTiles.ts` rows, the
`stylePasses.ts` / `detailPass.ts` transforms) are the well-netted half:
determinism, size caps, and palette/immutability contracts are all tested.
The generator half is where the layer's contract is thin.

**F43.1 — `gen:regen-net` (Tier 2 — the generator→artifact reproducibility
contract is doc-only).** No test re-runs any generator and compares the
result to the committed artifact. The sprite-library compiler is
deterministic by design (sorted id order, fixed base64, no rng/Date), and
its own header says "regenerate with `node scripts/generate-sprite-library.mjs`"
— but nothing verifies that the committed `bundledSprites.ts` is what a
regeneration would produce today; a drifted or non-deterministic regen
silently ships stale art. Same class as F35.2 (a doc-only contract with no
machine check) and a sibling of F38.4's "prose contracts" finding. Cheap fix:
a jest suite that runs each generator pointed at a temp dir (or runs it
in-place and reads back) and byte-compares against the committed artifact —
the scripts already print their output paths, so the net is a `spawnSync`
per generator + `deepEqual` on the buffer/module text. Trigger: next time a
generator or its inputs change (sprite library re-vendor, art-pass tuning).
No player impact today — the artifacts are correct *as committed*.

**F43.2 — `gen:script-dup` (Tier 3 — the sample-sheet renderers duplicate
their substrate).** `generate-art-style-samples.mjs` and
`generate-detailed-art-samples.mjs` each inline the same minimal zlib PNG
writer (IHDR/IDAT/IEND, filter-None rows, `crc32` from `pixelArt.ts`) and
the same extensionless-relative-import `registerHooks` block, and the
detailed script's sample set is deliberately copied ("IDENTICAL to
generate-art-style-samples.mjs") rather than shared. Two copies that must
stay in sync by hand; a fix to one (e.g. the PNG writer hitting a pngjs-less
edge) won't reach the other. Extract the PNG writer + resolve hook + sample
set to a shared `scripts/lib/` helper before a third renderer appears. No
defect today.

**Recorded, not defects:** (a) the vendored CC0 source PNGs live in
`public/assets/sprites/`, which the web export copies verbatim — so the web
build ships the 8 source images (~90 KB) *on top of* the compiled data URIs
the runtime actually renders. Deliberate-by-side-effect upside: `CREDITS.txt`
and the source art are discoverable in the production build (attribution
transparency, guardrail 4). (b) the two doc contact-sheet families
(`docs/art-styles/samples/`, `docs/art-detail/samples/`) are git-only — the
static export emits from `public/`, so the sheets cost repo weight, not
bundle weight. (c) the audio generators' outputs are un-netted (as in the
table) but audio drift is low-stakes and ear-checkable; promoted here only
so the layer is complete, not ranked.

**Source quality (pass 43).** The table is verified against the tree as of
this pass: each generator's output path read from the script, each net claim
from the named test file. F43.1/F43.2 are structural findings (missing
machine check / duplication), not observed breakage — no artifact was found
stale or corrupt in this pass.
