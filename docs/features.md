# Mines of Idle Doomath — Feature Reference

Living catalog of what the game does, maintained as a continuous task
(`docs/todo.md`). Update it when adding features; keep entries short and
file-anchored so they stay verifiable. Section 7 ("Missing features,
explored") is the research output of the same task: genre-standard features
that do NOT exist yet, cross-referenced against idle/clicker and math-game
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
Play Core in-app-review guide (official). Items
adopted from that list move into `docs/todo.md`.

## 1. Core gameplay

- **Tap mining** — tap or hold the cave canvas to mine; gains scale with
  click power, depth-tier click bonus, gem-upgrade tap/answer multipliers,
  combo and prestige (`components/MiningCanvas.tsx`,
  `hooks/useMineTaps.ts`).
- **Equations** — the main active loop: solve arithmetic to earn minerals ×
  click power × combo multiplier. Seven toggleable types (multiply, add,
  subtract, division, percent, square, "missing"-operand), configurable
  number range, **hard mode** (3-term equations, 2× payout), and a
  display-symbol preference (`*`/`×`, `/`/`÷`). Answer via on-screen numeric
  keypad or OS keyboard (`utils/math/equations.ts`,
  `hooks/useEquations.ts`, `components/AnswerInput.tsx`,
  `components/NumericKeypad.tsx`).
- **Combo** — streak multiplier in tier steps; wrong answer/mine tap zeroes
  it unless **combo resistance** is upgraded (each level keeps 10%);
  **combo-save** rewarded ad can bank a combo across a miss
  (`game.ts: getComboMultiplier`, `hooks/useCombo.ts`,
  `components/ComboIndicator.tsx`, `components/ComboSaveIndicator.tsx`).
- **Gems** — second currency, rolled on correct answers (base chance +
  upgradeable +1%/level, capped); feeds gem upgrade lines and the cosmetic
  shop (`game.ts: rollGem, getGemChance*`).
- **Miners** — three idle worker types with separate cost curves: miners,
  **fast miners** (tier-2 unlock), **legendary miners** (tier-5 endgame
  sink), plus a shared miner-power upgrade; total minerals/sec shown
  (`game.ts: getMineralsPerSec`).
- **Depth** — depth (meters) is derived from lifetime minerals; six
  **depth tiers** (Surface Caverns → …) each tint the cave and add a
  click bonus; the depth banner announces tier changes
  (`game.ts: DEPTH_TIERS, getDepthTierProgress`,
  `components/DepthBanner.tsx`).
- **Prestige ("sink a new shaft")** — resets the run (miners, upgrades,
  minerals) for a **banked permanent multiplier** (6 levels, ×1 → ×5 on
  lifetime-mineral thresholds) (`game.ts: PRESTIGE_LEVELS,
  getPrestigeMultiplier`, `hooks/useGameEngine.ts: sinkNewShaft`).
- **Offline progression** — offline earnings capped at 8h on launch
  (`game.ts: maxOfflineTicks`); rewarded ads can **double** the last
  offline gain or **top up** the cap to 10h.

## 2. Progression & retention

- **Goal tiers** — sequential 5-tier contract chain (t1–t5) whose
  completion (derived from lifetime stats, never a mutable flag) unlocks
  new purchaseable content; tiers gate all content (`goals.ts`,
  `components/GoalsPanel.tsx`).
- **Achievements** — independent one-off badges with a small one-time
  mineral bonus; completion derived from lifetime stats
  (`achievements.ts` — 21 of them).
- **Daily bonus / streak** — 10k base × streak (capped) for returning each
  local day; stored separately from the save so a lost streak never costs
  progress (`dailyBonus.ts`, `components/DailyBonusButton.tsx`).
- **Weekly contract** — a recurring contract on a longer cadence than the
  daily bonus: 3 goals that are DELTAS on the save's monotonic lifetime
  metrics (answer 75 equations / mine 500k minerals / own 2 more miners
  this week), with a flat 150k mineral bonus claimable once per week when
  all three are met. Progress is derived state in the goals.ts pattern:
  the week's opening metric values are snapshotted as baselines, progress
  is current − baseline (clamped at 0), so only this week's gains count and
  nothing is a mutable flag. The real weekly window only (no fake
  scarcity) and the reward is earnable free, per the guardrails. State
  lives in its own AsyncStorage key, like the daily bonus (`weeklyChallenge.ts`,
  `hooks/useWeeklyChallenge.ts`, `components/WeeklyContractButton.tsx`).
- **Equation of the day** — one fixed equation per local day, the SAME
  equation for every player/device (FNV-1a day-key seed → mulberry32 →
  `getSeededEquation`, always-soft classic+percent+missing shape); a 📅
  header button forces it into the main display, where wrong answers are
  penalty-free and a solve pays a flat 25k bonus once per day. Solved-day
  lives in its own AsyncStorage key, like the daily bonus (`dailyEquation.ts`,
  `hooks/useDailyEquation.ts`, `components/DailyEquationButton.tsx`).
- **Local records** — personal-best panel (depth, combo, minerals/sec, …)
  over the same lifetime stats a live leaderboard would use (`records.ts`,
  `components/RecordsPanel.tsx`). Since the statistics-detail todo it also
  has a lifetime “Time in the mine” row (`SaveData.playSeconds`, save
  v11) and a “This session” block — minerals/answers/time since the app
  was last opened, derived by `session.ts` (baseline snapshot at launch,
  current − baseline clamped at zero) with `formatDuration` in
  `utils/format.ts`.
- **Share badges** — sharing a completed achievement renders a 320x180
  PNG badge (game name, "BADGE EARNED", the achievement name, the
  player's deepest depth) instead of plain text. The badge is pure TS —
  a 5x7 pixel font laid out onto an RGBA buffer and encoded by a pako-
  based PNG encoder (`shareBadge.ts`, `utils/png.ts`) so it renders
  identically everywhere with no canvas dependency; the platform hand-off
  splits like the iap/ad providers: native writes the PNG to the cache
  and hands it to expo-sharing (`shareImage.ts`), web draws the pixels
  onto an offscreen canvas and shares a File via the Web Share API
  (`shareImage.web.ts`). Every failure degrades to the pre-baseline
  plain-text share, so a share tap always does something honest; a
  user-closed sheet is a no-op, not a re-opened sheet (`shareImage.ts`,
  `shareImage.web.ts`, wired in `components/GoalsPanel.tsx`).
- **Gem pocket (random in-cave bonus)** — a rare bonus node that
  forms in the cave while the game is open (per-1s-check 1/120 odds once
  a 5-min post-pocket cooldown has elapsed; the pocket itself lives a
  real 30 s). Tapping it (a quick tap, no hold) pays ~8× the current
  effective click power (floored at 20 early, capped for Number safety)
  through the normal tap-gain path so lifetime stats stay exact; left
  alone it simply fades, ungained — pure upside, no penalty. The spawn
  is pure logic with an injectable rng (`gemPocket.ts`), the 1 s check
  loop + collect-once ref guard live in the hook (`hooks/useGemPocket.ts`),
  and the node renders in `components/MiningCanvas.tsx` with its own
  responder (a tap on it never falls through to hold-to-mine), a
  reduce-motion-respecting pulse, seeded position in a HUD-safe zone,
  and the gem sprite / emoji fallback. Not persisted (a reload never
  resurrects or forfeits one) and no spawns or toasts under the
  onboarding overlay. Guardrails held: the window is real, missing it
  costs nothing, odds are identical for every player (`features.md §7`
  "Random in-game events", in-repo half).
- **Idle reminder** — after a minute without a cave tap or an answer
  (while the app is open), a one-per-session toast reminds the player the
  mine keeps collecting and progress autosaves. Settings toggle, on by
  default; no reward, no fake timer — plain information per the no-dark-
  patterns guardrail (the §7 gap candidate, in-app half; the home-screen
  widget half stays open) (`idleReminder.ts`, `hooks/useIdleReminder.ts`).
- **Free-path benchmark** — a deterministic free-casual persona simulating
  the full economy in CI; fails if a balance change makes first prestige
  slower than the target (`freePath.ts`).

## 3. Cosmetics & presentation

- **Programmatic pixel art** — player, roster miners, currency icons,
  debris, cave strips are generated sprites (seeded per player); **emoji
  fallback** setting for low-end devices (`utils/graphics/*`,
  `game.ts: SettingsData.emojiArt`).
- **Cosmetic shop** (gem prices; earnable, F2P-viable) — outfits, pickaxes
  (each with a unique swing sound), and **cave themes** (background
  recolors); the IAP cosmetic pack sells the *same* items
  (`cosmetics.ts`, `components/PurchaseButtons.tsx`, `components/Miner.tsx`,
  `components/CaveBackground.tsx`).
- **Juice** — debris bursts, pickaxe swings, floating "+N" text, screen
  shake on errors; magnitude log-scales with the mined amount
  (`juice.ts`, `hooks/useJuiceWaves.ts`, `components/FloatingTextLayer.tsx`,
  `components/DebrisParticles.tsx`, `hooks/useShakeInput.ts`).
- **Haptics** — settings toggle (on by default) driving the same juice
  scaling through `Vibration`: a per-tap tick that buzzes a little longer
  as gains grow, a beat on correct answers, a thud on wrong ones, and a
  double-tap on tier/achievement completions and purchases
  (`haptics.ts`, `hooks/useHaptics.ts`, wired in `MinesOfDoom.tsx`);
  iOS-leading-zero patterns, 50 ms global throttle, no-op on haptics-less
  hardware (desktop web).
- **Sound** — expo-audio SFX incl. per-pickaxe swings; mute toggle
  (`hooks/useSounds.ts`, `components/MuteToggle.tsx`) plus a
  **sound-volume** setting (0–100%, default 100%, stepped in 10% units in
  the settings panel; `clampSoundVolume` keeps parsed/hand-edited values in
  range, the menu mute toggle still wins — a muted player never hears
  anything regardless of the volume). Plus a **cave-ambience** music bed
  (on by default, settings toggle): a 20 s exactly-periodic looping WAV
  synthesized in-repo (`scripts/generate-ambient-loop.mjs` →
  `public/assets/audio/cave-ambient.wav`) played by `hooks/useSounds.ts`
  with the player's loop flag, at half the SFX level (`musicLevel` /
  `MUSIC_VOLUME_RATIO` in `game.ts`), paused while muted, music-off, or
  backgrounded (AppState); asset nets in
  `scripts/__test__/ambientLoop.test.ts`.
- **Accessibility & UX** — accessibility labels/roles throughout,
  reduce-motion preference respected (`hooks/useAccessibilityReduceMotion.ts`),
  keyboard-avoiding modal sheets, onboarding overlay with skip
  (`components/OnboardingOverlay.tsx`).

## 4. Economy & monetization

- **One-time IAP catalogue** (26 products: gem packs + cosmetic packs), one
  shared provider abstraction with per-platform backends — Play Billing /
  App Store (expo-iap) on native, **hosted Stripe Checkout** on web, a
  dev-sim provider in dev builds, and clean no-ops until configured
  (`iaps.ts`, `iapProvider.ts`, `iapProvider.web.ts`). Purchases verify
  server-side (Pocketbase → sidecar store round-trip), restore re-derives
  entitlements from the **store record** (`reconcileStore`), and a local
  re-verify queue means a flaky network never loses a completed purchase.
- **Rewarded ads** — four opt-in kinds on BOTH platforms: gem rolls,
  offline double, offline top-up, combo save; hard per-day reward caps
  enforced in pure code as the fraud cap (`ads.ts`,
  `hooks/useAdRewards.ts`, `components/AdRewardsPanel.tsx`). Native runs
  the AdMob SDK (`adProvider.ts`); web runs the AdSense "Ad Placement
  API" (H5 Games Ads) as parity (2026-09-07, replacing the removed
  shop-sheet banner) — a two-phase flow where `primeReward` pushes a
  `type: "reward"` placement onto `window.adsbygoogle` (panel open /
  combo-save pill mount / after every settled ad) and the "watch" tap
  invokes the stashed show function SYNCHRONOUSLY; only `adViewed`
  entitles the reward, early dismiss → `closed`, no fill / 60 s
  watchdog → `error` (`adSenseProvider.web.ts`, loader script in
  `app/+html.tsx`, gated on the `storeConfig.adsense` client). The
  AdMob SDK itself never enters the web bundle (`adProvider.web.ts` is
  the no-op swap).
- **Guardrails enforced by design** — rewarded-only on both platforms,
  no interstitials/banners, cosmetics earnable, free-path CI floor
  (AGENTS.md; `freePath.ts`, `docs/security-audit.md`).

## 5. Account & cloud (Pocketbase backend)

- **Optional login** (anonymous device-scope is the default) — three
  mechanisms sharing one provider-agnostic account: email/password,
  **Google** (native + web via Google Identity Services), **Apple**
  (native; web pending a domain-verified service id)
  (`auth.ts`, `signinSdks.ts`, `components/AccountTab.tsx`).
- **Session security** — token in OS keychain (native) / localStorage
  (web), never AsyncStorage; server-side CSPRNG tokens + iterated-SHA-256
  password KDF (`secureToken.ts`, `pb_hooks/`, `docs/security-audit.md`).
- **Cloud save** — device-scoped LWW backup of the serialized save with a
  durable 30-writes/hour budget and launch recovery
  (`cloudSave.ts`, `hooks/useCloudSave.ts`).
- **Leaderboard** — top-10 max-depth scoreboard, monotonic-only upsert
  (client's lifetime stats + sanity caps; honest-casual anti-cheat,
  nothing is gated on it) (`leaderboard.ts`,
  `components/LeaderboardPanel.tsx`).
- **Save codes** — whole save as a `MOD1…` base64 string for backup /
  transfer without an account (`saveCode.ts`).
- **Account GDPR** — delete-my-data for the device row and (signed in) the
  account; entitlements survive account deletion by design
  (`pb_hooks/`, `components/AccountTab.tsx`).
- **Legal** — privacy policy + terms, in-app and published as generated
  HTML from the same module (`legal.ts`).

## 6. Platform & engineering

- **Platforms** — Android (Play live, 1.0.x), web (static export,
  GitHub Pages → Caddy → Pocketbase sidecar), iOS (code complete;
  console-side items in `docs/backlog.md`).
- **i18n** — English (source of truth) + Spanish, auto-detected or
  player-picked (`utils/i18n/`).
- **Observability** — local lightweight analytics events (guardrail 5),
  on-device crash context + crash log view, React error boundary
  (`analytics.ts`, `crashLog.ts`, `crashContext.ts`,
  `components/ErrorBoundary.tsx`).
- **Settings** — autosave cadence, show-all-purchases, emoji-art fallback,
  haptics, cave-ambience music, sound volume, mute, language
  (`hooks/useSettings.ts`,
  `components/SettingsPanel.tsx`, `components/SaveTab.tsx`,
  `components/MenuPanel.tsx`).
- **Quality** — Jest suites over the pure modules (980+ tests), Maestro
  e2e flows, Play Console CLI helper (`npm run play`), static-export-safe
  routing (AGENTS.md).
- **Support** — in-app mailto inquiries button (`components/InquiriesButton.tsx`).

## 7. Missing features, explored (2026-09)

Cross-checked against the idle/clicker genre roundups and math-game
engagement research linked in the header. **None of these exist in the
codebase today** (verified against `src/`). Ranked rough order of
genre-impact; anything picked up goes into `docs/todo.md`.

### Engagement / progression

- ~~**Weekly / monthly challenges**~~ — **DONE 2026-09** (todo "weekly
  challenges"): the weekly contract — 3 delta-goals on monotonic lifetime
  metrics with a flat weekly mineral bonus, derived-state progress via a
  week-start baseline snapshot, real weekly window, free-earnable reward
  (`mines_of_doom/weeklyChallenge.ts`, `hooks/useWeeklyChallenge.ts`,
  `components/WeeklyContractButton.tsx`). See §2 "Weekly contract". The
  monthly cadence stays open if it ever earns its place.
- ~~**Daily rotating challenge equations**~~ — **DONE 2026-09-07** (todo
  "daily equation"): seeded day-key equations in `utils/math/equations.ts`
  (`hashString` + `mulberry32` + `getSeededEquation`), flat-bonus solve
  reward with penalty-free wrong answers (`mines_of_doom/dailyEquation.ts`).
  See §2 "Equation of the day".
- **Seasonal / limited-time events** — the genre's main re-engagement
  driver (real-time events, event cosmetics). Note: real limited windows
  only — the no-fake-scarcity guardrail forbids fake timers, and the
  F2P-viability guardrail means event rewards must be earnable free.
  Pass 3 adds the *cadence* angle: the 2026 retention piece treats
  "content cadence as the retention plan" — a 2–4-week update rhythm
  players can anticipate, planned during soft launch, not retrofitted
  when the day-30 cohort hits the content wall. Candidate, not planned.
- **Day-7 reward spike** — the daily-streak ladder
  (`dailyBonus.ts`: `DAILY_BASE_BONUS × min(streak, 7)`, linear to the
  cap) is the shape the retention research calls out as weak: a flat
  or linear ladder has no "cost to skipping" anchor. The genre-standard
  fix is a day-7 reward worth *more than days 1–6 combined* — a single
  shape change in `getDailyBonus` (pure function, unit-tested), so this
  is a near-free candidate if it's ever picked up.
- **Streak protection (freezes / repair)** — pass 4. The streak has no
  safety net: miss a day and it resets to zero (and a lost streak never
  costs progress, but nothing protects it either). The Duolingo teardown
  (2026) makes protection the *core* of the streak, not a bolt-on:
  **freezes** (capped, ~2 free; consumed silently and automatically when
  a day is missed, surfaced retroactively — no popup drama) and a
  **repair** backstop (a small amount of play within a short window
  after a break restores the streak once freezes run dry). Milestone
  days (7/30/100/365) are where ceremony goes — Duolingo's milestone
  animations are rare by design and one milestone redesign alone moved
  D7 retention +1.7 %. Cheap version here: N freezes earned passively
  (cap 2–3, like the rewarded-ad caps) + a 24 h repair window, all
  pure logic in `dailyBonus.ts`; freezes must stay earnable free
  (guardrail 1) and the counters real (guardrail 3). Candidate, not
  planned. Pairs with the day-7 spike item above.
- **Narrative / character layer** — the idle-genre design guide (Mind
  Studios) lists narrative as a first-class retention lever: a story
  that unfolds as levels unlock, characters with goals we'd want to
  check back for. We already have the scaffold (depth tiers, cave
  themes, miner characters, outfits) with no story on top of it — a
  lightweight "cave lore" flavor layer (per-depth flavor text /
  encounters) would be the cheap version. Candidate, not planned.
- **Battle pass / season pass** — the 2026 idle roundups list battle
  passes alongside events as a top retention driver. Heavier than the
  events item above: it is a *structured* season (fixed real window,
  tiered rewards, a free track — a paid-only track would break the
  F2P-viability guardrail) on top of the weekly contract cadence, and
  the current IAP catalogue is strictly one-time products (no
  recurring/season product type exists yet). Candidate, not planned.
- **Deeper automation layers** — the genre's core loop is "check
  progress → spend → unlock automation → hit a wall → reset"; our
  miners automate minerals but every equation is still solved by hand.
  An automation layer that changes HOW the game plays (not just rate)
  is the genre-standard next step — with a hard caveat: auto-solving
  equations would hollow out the active math loop the whole game is
  built on, so any candidate has to automate around the equations
  (e.g. goal-directed resource routing), not replace them.
- **Multi-layer prestige / ascension** — single multiplier bank (6 levels);
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
- ~~**Random in-game events**~~ — **DONE 2026-09** (todo "random
  in-game events"): the gem pocket — a rare tap-to-collect bonus node in
  the cave (`gemPocket.ts`, `hooks/useGemPocket.ts`, rendered in
  `components/MiningCanvas.tsx`). See §2 "Gem pocket". Pass 5 (canon):
  the genre's variable-ratio "spice" — Cookie Clicker's golden cookie,
  5 %/min spawn, 13 s lifetime, weighted rarity — is the canon's
  dopamine-schedule pattern; our pocket sits at the same spawn order
  (1/120 per 1 s ≈ 5 %/min, 30 s lifetime), so a rarity-weighted pocket
  pool is the documented growth path for this item if it's ever picked
  up. — pass 4. The equation
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
- **Cosmetic compendium / collection** — top mobile idlers lean on
  collection completeness (Roblox/social idlers' pets-and-creatures
  pattern, in the 2026 roundups): a single view of all outfits /
  pickaxes / cave themes / achievement badges with owned vs.
  not-yet, turning the cosmetic shop into a long-term goal. We already
  own all the data (`cosmetics.ts`, `achievements.ts`); this is a pure
  presentation surface. Cheap candidate.
- ~~**Statistics detail**~~ — **DONE 2026-09** (todo “statistics detail”):
  the records panel now carries a lifetime “Time in the mine” row and a
  per-session block (minerals, answers, active time since launch) —
  see §2 “Local records”. (No export; that was never the ask.)

### Accessibility (2026-09, pass 3)

None of these exist today except where noted; the 2026 accessibility
playbooks rank text scaling and separate audio channels as the
low-effort/high-impact first tier, so this section is in that order.

- **Text size / UI scaling** — `styles.ts` hard-codes `fontSize: 11–12`
  everywhere; nothing scales with the OS font setting. The cheapest
  high-impact item in the playbooks: a settings row with ~3 scale
  steps applied as a multiplier at the style layer.
- **Independent music volume** — the cave-ambience bed is locked to
  half the SFX level by the `musicLevel` law (`game.ts`), so there is
  no way to hear the music without the SFX (or vice versa). The
  audio-channel guideline is separate sliders; the cheap version is a
  music-volume settings row parallel to the existing SFX row, relaxing
  the half-level law.
- **Native reduce-motion** — `useAccessibilityReduceMotion.ts` already
  respects `prefers-reduced-motion` **on web only** (RN has no API for
  the iOS/Android OS setting yet, per the file's own comment; native
  returns false). A settings "reduce effects" toggle (decorative debris
  / combo juice off) would cover native and give everyone a manual
  kill-switch. The hook is the natural seam.
- **High-contrast / color-independence** — no high-contrast mode, and
  a few states are color-leaning (vein/gem-pocket discovery reads
  largely from the node's look on the canvas). Playbook baseline: never
  convey meaning by color alone; we'd audit the canvas cues and add a
  contrast step to the same settings row as text size.

### Benchmarks (pass 4 — the guardrail-5 instrumentation gets targets)

Cross-genre retention medians to benchmark against (guardrail 5 already
mandates first-time-ad-view / IAP / D1 / D7 logging before UA spend;
these are the numbers to compare that data to):

- **D1 median ≈ 22 %** (GameAnalytics 2025 report, 11,600 games /
  1.48 B MAU); top quartile 25–27 % Android, 31–33 % iOS. A 2026
  cross-genre piece (PlayIO) puts D1 ~26 %, **D7 ~10 %**,
  **D30 ~3–4 %** medians; top quartile D7 20 %+.
- The same piece frames the stages: **D7 is a habit problem** (does the
  daily-goal/reward cycle give a reason to come back — we already carry
  the daily bonus, weekly contract, and daily equation in exactly that
  slot) and **D30 is a depth + LiveOps problem** (meta-gameplay that
  doesn't run out; a live-ops calendar to come back *for* — the
  seasonal-events and battle-pass items above are the D30 answers).
  Arcade fades fast; puzzle/board/idle "frequently match or beat
  RPG-level numbers at D7 and D30" — the most favorable genre fit for
  a math-idle.
- **Name the retention definition before comparing** (AppFollow 2026):
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
  release that shipped before it (`npm run play` covers listings,
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

- **FTUE funnel instrumentation is absent** — the pass-7 metrics to
  add (guardrail 5's first-class D1 input): time-to-core-gameplay
  (baseline 60 s), **per-step drop-off** ("12 % leave at step three"),
  tour completion rate, first-session length, and **session 1→2
  conversion** — the literature's direct leading indicator of D1. Read
  as a step funnel, never as an average. Today the dismiss flag
  can't even say WHICH of the four steps churns. Cheap first step:
  the events into the existing `analytics.ts` local logger; the
  numbers are what decide whether any of the items below are worth
  doing.
- **The current tour is the research's anti-pattern** — four
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
- **The setup step vs. the "defer settings" rule** — the first-time
  setup BEFORE the first dig was an explicit prior todo; first-session
  research says defer settings until after the first win and land the
  aha within 90 s. A genuine tension between the two sources, not a
  bug in either. If this is ever picked up, the funnel item above is
  what decides it (dismiss → first-solve time per path); a possible
  middle: keep setup, but after the first solved equation rather
  than before the first dig. Candidate, not planned.
- **Design the skip path, not just the skip button** — "a skip that
  dumps a genre-experienced player into a HUD with zero context is
  its own churn source." Our skip goes straight to the full HUD; the
  equation + keypad IS the minimum viable rule set (the idle-math
  analogue of the playbook's "match three, get a reward" example), so
  the exposure is smaller than in a system-heavy game — but the 2026
  personalization trend (even a two-way **veteran-vs-new** split
  "measurably cuts early churn") has a ready-made signal here: a
  returner with a save, or a fast Skip tap, is the veteran. Candidate,
  not planned.
- **End-of-first-session hook** — research wants a visible early
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

- **The offline return is applied silently, not designed** — the 8 h
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
- **Session length is an accident, not a decision** — the 2026
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
- **The "time to next purchase" invariant is unmeasured** — canon
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
  planned.
- **The number notation is a fixed ladder** — `utils/format.ts`
  formats everything (HUD counters, share badges) with one fixed suffix
  ladder ("", k, M, B, T, Qa, Qi); there is no player-facing choice.
  The genre guide: suffix notation feels warm and human, scientific
  notation scales without limit, and **many titles let the player
  choose, because the same number feels cozy or clinical depending on
  how it is written** — "when your reward is literally 'the number got
  bigger,' the typography of that number is core game feel." Cheap
  version: a settings row (compact suffix vs. plain full numbers) into
  the existing formatter, persisted with the rest of the settings —
  the i18n table stays key-pinned as always. Guardrail 4: it is a
  plain preference toggle, nothing to hide. Candidate, not planned.
- **Canon pin (confirmed correct, not gaps):** (1) the automation arc
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

- **The offline cap quietly kills the long-lapsed return haul** — the
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
- **The streak reset is a demotion at the return moment** — the
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
- **Re-engagement is three-layer and we have zero of the layers** —
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
- **Lapse segmentation can ride on state we already have** — the
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
- **Push design is pre-decided for when the widget item lands** — the
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
- **Measure reactivation, not sends** — the playbook's operational
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
- **Canon pins (confirmed correct, not gaps):** (1) the **zero-cost
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
carries. Live audit (2026-09-11, `npm run play` against the Console +
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

- **The production listing is the first deliverable, and it is fully
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
- **The review cold start is the launch-week metric, and the prompt is
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
- **The honest-listing rule is also a quality gate** — Play's ranking
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
- **Review replies have an API but no tooling** — the Play Developer
  API v3 exposes `edits.reviews` (list / get / **reply**), and
  `scripts/play/play.mjs` has no reviews command (verified against the
  CLI surface) — this is the exact gap pass 4 named when it made the
  review-themes-per-version workflow "manual until the CLI gains it".
  A `reviews` / `reviews-reply` pair of commands is cheap to add and
  turns the pass-4 workflow ("when a cohort drops, read the review
  window of the release that shipped before it") into a script; it also
  gives the negative-review triage above a machine-readable source.
  Candidate, not planned.
- **Listing experiments are a post-launch, UI-only lever** — Play
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
- **Canon pins (confirmed correct, not gaps):** (1) the **retention-
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

### Monetization benchmarks (pass 6 — revenue-side targets for guardrail 5)

The GameGrowthAdvisor F2P-monetization comparison (2026, rebuilt against
named primary datasets — AppsFlyer's 2025–26 monetization analysis from
≈$900M verified purchases / 9,600 apps, TopOn H1-2025 ad-format data,
Sensor Tower, Lancaric, Liftoff) is worth citing *because it states which
numbers do NOT exist*:

- **Model mix.** Midcore ≈ 90% and casino ≈ 83% of revenue from IAP
  (AppsFlyer); in three-stream games the split is ≈ 35% IAP / 56% ads /
  7% subscription (subscription up from 4% a year earlier). Hybrid
  (IAP + ads) is present in under 30% of games overall (casual 33%,
  hypercasual 32%, midcore 15%, AppsFlyer) — TopOn's "72% of developers"
  figure only counts games already on its ad platform. A math-idle with
  one-time IAP + rewarded ads sits in the casual-hybrid slot.
- **Ad-format economics (TopOn H1 2025, casual):** rewarded video is
  39.35% of casual ad revenue from 21.25% of impressions, interstitial
  44.25%, and banner earns 6.50% of revenue from 37.01% of impressions —
  the format math confirming the rewarded-only ban (guardrail 2) costs
  little: rewarded out-earns its impression share, banner massively
  under-earns. In midcore rewarded leads at 51.77%.
- **eCPM trend (casual Android):** rewarded $3.60 (H1 2023) → $3.02
  (H1 2025), -7% YoY; interstitial -11%. The regional spread is the real
  story: rewarded eCPM $8.90 Android / $12.24 iOS in EU/NA vs low single
  digits in SEA/LATAM. The plan-against number is the formula
  `rewarded impressions/DAU × eCPM / 1000` on OUR OWN cohorts — no
  published impressions-per-DAU exists ("3–5/day" is a design
  recommendation, not a measurement).
- **ARPDAU bands to plan against:** ads-only casual $0.01–0.05,
  hypercasual blended $0.03–0.08, hybrid-casual blended $0.15–0.50
  (Lancaric: hybrid-casual is 40–50% IAP-driven; segment net revenue
  ≈$174.8M/mo App Store March 2025, ~3× early-2024). IAP-only and
  subscription-only ARPDAU have NO primary benchmark — derive from own
  payer share × order value.
- **UA arithmetic (Liftoff 2024 data, 2025 casual report):** casual D30
  ROAS 47% iOS vs 15% Android; US Android casual/puzzle CPI $1.50–3.50,
  iOS 3–4× Android. Ads-only economics rarely close a Tier-1 Android CPI
  gap — another argument the hybrid (rewarded + entry-priced IAP) shape
  is right for this game.
- **The famous "1.8% of players pay" has no primary source.** Closest
  Tier-A: AppsFlyer Q1-2022 install→purchase 2.6% within 30 days,
  install→subscription 0.2% (both stale). Guardrail 5's IAP-purchase
  logging is the only honest number; don't back-fill from folklore.
- **Sequencing precedent:** rewarded first → entry-priced IAP →
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

- **Two-tier consent for ads:** verifiable parental consent is now
  required *separately* to disclose children's data to third-party
  advertisers — third-party/behavioral ads are off by default unless a
  parent opts in. For a child-directed app, the AdMob/AdSense rewarded
  legs need that consent **on top of**
  `TAG_FOR_CHILD_DIRECTED_TREATMENT`, not instead of it.
- **Data minimization + retention:** no indefinite retention of
  children's personal information; a written retention schedule (business
  need + deletion timeframe) must be described in the privacy notice.
  Our v2.0 policy (`legal.ts`) describes deletion *on request* (GDPR
  shape), not a scheduled retention window — a child-directed path needs
  policy copy regardless.
- **Broader "directed to children" test:** marketing, representations
  to third parties, reviews, and the age composition of users on similar
  sites are explicit evidence. A 3+ math game aimed at kids is
  child-directed; a teen (12+) rating is the way to keep COPPA out of
  the consent path, at the cost of part of the math audience.
- **What it means for this game:** the age-rating decision gates either
  (a) a launch parental-consent gate (verifiable consent before data
  collection, plus the third-party-ad consent) if we stay kid-directed,
  or (b) a teen rating with the device-scoped anonymous model (no
  account by default, minimal collection) doing the compliance work.
  Option (b) is the cheaper path and matches the current architecture
  (local save default, opt-in account, local-only analytics); the
  kid-mode/parent-screen item below is where option (a) would land.
- **Monetization-side minor protections** (the pass-6 monetization
  piece): parental consent for IAP targeting under-13s, minors
  segmented out of whale-optimization. Our IAP is direct purchases with
  no loot-box odds to disclose (gem *drops* are free gameplay rewards,
  not paid randomized containers), which keeps us clear of the
  odds-disclosure regime (platform policy since 2017–2019; statutory in
  CN/TA/KR).

### Player-facing surfaces

- **Home-screen widget** — ~~+ idle reminders~~ (the in-app idle reminder
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
- ~~**Sound volume controls**~~ — **DONE 2026-09** (todo "sound volume
  controls"): the SFX volume — 0–100% (default 100%), a settings row
  stepped in 10% units, `clampSoundVolume` in `game.ts` keeping parsed or
  hand-edited values in range, applied to every expo-audio player by
  `hooks/useSounds.ts` (mute toggle still wins). See §3 "Sound".
  Per-sound toggles stay open if they ever earn their place.
- ~~**Music / ambient loop**~~ — **DONE 2026-09** (todo "music /
  ambient loop"): the cave-ambience bed — a 20 s exactly-periodic looping
  WAV synthesized in-repo (`scripts/generate-ambient-loop.mjs`), played
  under the SFX at half the sound-volume level by `hooks/useSounds.ts`
  (player loop flag, half-level `musicLevel` law, paused while muted /
  music-off / backgrounded), settings toggle `settings.music` (on by
  default). See §3 "Sound". Per-sound toggles stay open if they ever earn
  their place (see the sound-volume note above).
- **More languages** — en/es only; the i18n table machinery
  (`utils/i18n/`) makes adding locales cheap, and the kid-skewed audience
  argues for more coverage eventually.
- ~~**Share images**~~ — **DONE 2026-09** (todo "share images"): a pure-TS
  320x180 PNG badge (pixel font + pako PNG encoder) shared via
  expo-sharing (native) / Web Share API files (web), degrading to the
  plain-text share on any failure (`shareBadge.ts`, `shareImage.ts`,
  `shareImage.web.ts`). See §2 "Share badges".
- **Deep/universal links** — none; save transfer is clipboard-only
  (`saveCode.ts`).

### Social / meta

- **Friends / social leaderboard** — global top-10 exists; no
  Game Center / Play Games friend feeds, no friend-list leaderboard.
  Pass 4 adds the friend-*streak* data point from the Duolingo teardown:
  users with ≥1 friend streak are **22 % more likely to complete their
  daily lesson** (up to 5 parallel friend streaks, both parties must
  play the same day) — the cheapest social mechanic that survives a
  small player base, alongside the community-milestone idea below.
- **Daily-challenge leaderboard** — the daily equation is identical for
  every player (day-key seed), so a first-solve speed or bonus-claimed
  ranking is trivially fair without an anti-cheat model beyond the
  honest-casual caps the existing leaderboard already uses
  (`leaderboard.ts`). The math-game version of the genre's daily
  reward loop; reuses the live Pocketbase leaderboard endpoint. Good
  candidate for the "real social loop" the genre roundups call out.
- **Guilds / community goals** — genre-common in bigger idle games;
  requires backend work on the existing Pocketbase deployment. The
  pass-3 research refines *which* social mechanic survives a small
  player base: the solo-player-safe ones — asynchronous goals where
  solo players benefit from other people's activity without anyone
  being online (a shared community-milestone bar toward a collective
  reward, backed by the existing Pocketbase aggregation; the
  leaderboard already proves the endpoint pattern). That is the
  cheaper first step toward this item, and it can be ranked against
  it: a community milestone is a guild-lite.
- **Kids mode / parent screen** — guardrail 6 (kid-safe age rating) is
  planned but there is no in-app parent area (time limits, ad consent
  surface). Becomes mandatory-looking once an age rating is chosen.
  Pass 6 pins the stakes: the COPPA 2025 final rule is in full effect,
  so a kid-directed rating makes a verifiable-parental-consent gate (and
  the separate third-party-ad consent) a launch requirement — see the
  "Compliance (pass 6)" section above.

### Deliberately absent (guardrails, not gaps)

- Interstitials / native display ads — banned permanently (rewarded-only).
- Fake scarcity / fake timers — banned (no dark patterns).
- Pay-to-win gates — all content is free-path reachable (`freePath.ts`).
  Paid-UA creative and audience-segmented store pages — gated by
  guardrail 5 (measure before scaling); see the pass-10 canon pins in
  "Store presence & the pre-install layer".
  These show up on genre checklists and are listed here so future passes
  don't "discover" them as missing.
