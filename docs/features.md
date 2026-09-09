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

## 1. Core gameplay

- **Tap mining** — hold the cave canvas (300 ms — a quick tap
deliberately does nothing; the fat-finger filter the a11y label states as
"Hold to mine" and the canvas carries a persistent caption) to mine; gains
scale with click power, depth-tier click bonus, gem-upgrade tap/answer
multipliers, combo and prestige (`components/MiningCanvas.tsx: MINE_HOLD_MS`,
`hooks/useMineTaps.ts` — the web canvas uses a plain-View responder instead
of Pressable so rapid tapping doesn't double-render).
- **Equations** — the main active loop: solve arithmetic to earn minerals ×
  click power × combo multiplier. Seven toggleable types (multiply, add,
  subtract, division, percent, square, "missing"-operand), configurable
  number range, **hard mode** (3-term equations, 2× payout), and a
  display-symbol preference (`*`/`×`, `/`/`÷`). Answer via the **on-screen
  keypad** (default on native — a 3-column digit strip beside the
  upgrades list: 56 px keys that flex-shrink to a 44 px floor on short
  screens so a bottom row is never clipped off the edge, ⌫ held clears
  the answer, 12-digit cap; the input is deliberately un-focusable while
  the onboarding overlay is up, an e2e-discovered fix) or the OS
  keyboard (default on web — autofocused numeric field, Enter submits,
  `KeyboardAvoidingView` on native, a plain read-only box on web where the
  keyboard never shifts layout); the two are settings-toggled, and the
  per-platform default (`MinesOfDoom.tsx`: `Platform.OS !== "web"`) only
  shapes first launch — a stored preference wins on every platform
  (`utils/math/equations.ts`,
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
- **Depth** — depth (meters) is derived from lifetime minerals; five
  **depth tiers** (Surface Caverns → Crystal Kingdom) each tint the cave and
  add a click bonus; the depth banner announces tier changes
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
  (`achievements.ts` — 19 of them).
- **Daily bonus / streak** — 10k base × streak through day 6, then a
  250k day-7 milestone (worth more than days 1–6 combined) for streaks
  7+; stored separately from the save so a lost streak never costs
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
- **Collection view** — the menu sheet's read-only compendium (between
  Records and About): every catalog line — pickaxes (sprite thumbs), outfits
  (the shop's fixed-seed previews), cave themes (tint swatches), achievement
  badges (icon + bonus) — shown owned vs. not-yet, with per-group and total
  progress. `getCollection` (`collection.ts`) derives everything from the
  save in the `records.ts` spirit (the IAP entitlement record stays a
  purchase record, not an ownership source; achievement "ownership" is the
  same derived-from-lifetime-stats completion the Goals panel uses), and
  `components/CollectionPanel.tsx` is a dumb renderer — no buys, no
  equipping, the shop keeps its single-surface contract. No migration
  (nothing new is stored); §7 "Cosmetic compendium", DONE iteration 23.
  (`collection.ts`, `components/CollectionPanel.tsx`).
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
  anything regardless of the volume) plus an **independent
  music-volume** setting (0–100%, default 50% — the former half-level
  law's default experience — same 10% step pattern; `clampMusicVolume`
  in `game.ts`). Plus a **cave-ambience** music bed (on by default,
  settings toggle): a 20 s exactly-periodic looping WAV synthesized in-repo
  (`scripts/generate-ambient-loop.mjs` →
  `public/assets/audio/cave-ambient.wav`) played by `hooks/useSounds.ts`
  with the player's loop flag, at the independent
  `musicLevel(settings.musicVolume)` level, paused while muted, music-off,
  or backgrounded (AppState); asset nets in
  `scripts/__test__/ambientLoop.test.ts`.
- **Accessibility & UX** — accessibility labels/roles throughout,
  reduce-motion preference respected (web, via the OS preference) **plus a
  manual "reduce effects" settings toggle** (`settings.reduceEffects`,
  off by default — effects stay on for everyone, the toggle is a kill
  switch; the two signals OR together in
  `hooks/useAccessibilityReduceMotion.ts`, pass-3 accessibility),
  keyboard-avoiding modal sheets, onboarding overlay with skip
  (`components/OnboardingOverlay.tsx`).

## 4. Economy & monetization

- **One-time IAP catalogue** (25 products — one pack per paid cosmetic
  catalog line; no gem/currency packs, by design — pass 16 rejection (1)),
  one shared provider abstraction with per-platform backends — Play Billing /
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

- **Platforms** — Android (Play live, 1.0.x), web (static export on
  Cloudflare Pages; Caddy → Pocketbase sidecar for the server legs), iOS
  (code complete; console-side items in `docs/backlog.md`).
- **i18n** — English-only **live**: the live locale store is pinned to
  `"en"` (commit `62ff419`), the settings language picker is gone, and no
  preference persists — but the full machinery is intact in `utils/i18n/`
  (en source-of-truth table + es tables held to key-parity and
  placeholder-parity in CI, `navigator.language` detection, the data-driven
  content namespace, a11y coverage). Re-enablement is a checklist, not a
  rebuild: the four landmines and the `i18n:*` candidates live in §7 pass 14.
- **Observability** — local lightweight analytics events (guardrail 5),
  on-device crash context + crash log view, React error boundary
  (`analytics.ts`, `crashLog.ts`, `crashContext.ts`,
  `components/ErrorBoundary.tsx`).
- **Settings** — autosave cadence, show-all-purchases, emoji-art fallback,
  haptics, reduce effects (manual kill switch, pass-3 accessibility),
  cave-ambience music, sound volume, music volume, mute,
  number notation (compact / plain, live-sample settings row),
  idle reminder,
  on-screen keypad, equation types / range / hard mode / symbols
  (`hooks/useSettings.ts`,
  `components/SettingsPanel.tsx`, `components/SaveTab.tsx`,
  `components/MenuPanel.tsx`).
- **Save affordance** — the top-row save pill: saves immediately on tap,
  its status dot pulses amber while state is dirty since the last
  successful write and goes green when clean; icon-only to keep the row a
  compact strip, pulse suppressed under reduce-motion; autosave still runs
  in the background — the pill makes saving a first-class visible action
  rather than a menu dig (`components/SavePill.tsx`).
- **Quality** — Jest suites over the pure modules (1082 tests), Maestro
  e2e flows, **hermetic Playwright web e2e** (`pnpm run test:e2e:web`:
  boot / rewarded-ads / IAP specs against stubbed ad + Stripe/Pocketbase
  backends from `e2e/web/` — the boot spec doubles as the zero-backend
  offline-resilience check, ads run in Google's documented
  `data-adbreak-test` test mode, and a guard route fails the suite on any
  request that would become a live impression or sidecar call; §7 pass 12
  is the design context, `docs/store-integration.md` §2.7 the spec-by-spec
  contract), Play Console CLI helper (`npm run play`), static-export-safe
  routing (AGENTS.md).
- **Support** — in-app mailto inquiries button (`components/InquiriesButton.tsx`).

## 7. Missing features, explored (2026-09)

Cross-checked against the idle/clicker genre roundups and math-game
engagement research linked in the header. **None of the open (non-struck)
items exist in the codebase** (verified against `src/` on each pass; DONE
items are struck through with their iteration and carry a short
implementation note). Ranked rough order of genre-impact; anything picked
up goes into `docs/todo.md`.

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
- ~~**Day-7 reward spike**~~ — **DONE 2026-09** (iteration 15,
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
- ~~**Streak protection (freezes / repair)**~~ — **DONE 2026-09**
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
- ~~**Cosmetic compendium / collection**~~ — **DONE 2026-09**
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
- ~~**Independent music volume**~~ — **DONE 2026-09** (iteration 16,
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
- ~~**Native reduce-motion / manual kill switch**~~ — **DONE 2026-09-08 (iteration 22, autonomous, no signal)**:
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
- ~~**The number notation is a fixed ladder**~~ — **DONE 2026-09**
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

- **User-perceived crash rate is a core vital, and the local stack
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
- **ANR is the blind spot JS cannot see — and the risk profile says
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
- **The 2026 wake-lock enforcement is the one vital our architecture
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
- **Crash-free targets: 98.5–99.2 % for a casual game, with the
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
- **Memory vitals give the games category headroom — there is nothing
to do** — the vitals memory thresholds are tiered by device RAM and app
state, and games get higher limits than apps at every tier (at 8 GB
RAM, foreground: 2.25 GB apps vs 3.50 GB games; bitmap foreground cap
200 MB), and our surface is a static cave canvas plus interpolation-
only bobbing off one shared driver — no bitmap churn (pixel-art canvas;
the share-badge PNG is generated on demand and released). New
Architecture is already on (SDK 57), and FlashList is the canonical
countermeasure for list growth — but the roster row is fixed layout,
not a scrolling list. No code.
- **Canon pins (confirmed correct, not gaps):** (1) the **local-only
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

- **Stripe web IAP is the right architecture, and the store-compliance
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
- **Offline / installable (PWA) is the one big missing web-standard feature —
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
- **Web storage posture is right and the quota is not a constraint** —
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
- **Cross-device parity is an account story, not a web story — and we hold
it** — the web→native funnel (and web↔native parity) rides the optional
account layer (§5): a web player who signs in carries cloud save +
entitlements to a native install, and a native player on web gets the same.
The web→native *install* funnel itself (deep link to the store, deferred
install) is a candidate, not planned — there is no store-linking /
deferred-install infra, and the free path is identical on both platforms
(guardrail 1), so a web player can enjoy the whole game without installing.
Trigger: a web→native conversion metric (guardrail 5) that justifies a
deep-link CTA.
- **Web ads parity is done and is the one web monetization surface we won't
expand** — the AdSense Ad Placement API rewarded parity (rewarded-only, no
banners/interstitials — guardrails 2–3, hard per-day caps in pure code,
§4) is already live and mirrors the native posture. No ad work here.
- **Canon pins (confirmed correct, not gaps):** (1) the **static export is
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

- **Target sizing passes every published standard — canon pin, not a
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
- **Hold is the genre-canonical verb, and it is a one-knob accessibility
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
- **Gesture invisibility is handled at the one place it bites — pin** —
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
- **Gamepad / controller is the one input surface with a real loss
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
- **Keyboard operability past the answer field is the cheap 80 % — and
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

- **Landmine 1 — the share-badge pixel font has no accented glyphs.**
`shareBadge.ts` renders the achievement name with a hand-authored 5×7
bitmap font (`PIXEL_FONT`) covering A–Z, 0–9, and a handful of
punctuation — and any unknown glyph becomes a *space* (`PIXEL_FONT[rawCh]
?? PIXEL_FONT[" "]`). English content names are safe; the Spanish content
names (ñ/á/é/í/ó/ú in `content-es.ts` achievement and miner names) would
render as *blank runs* in the badge image. Re-enabling Spanish without
extending the font (or giving the badge an en-name fallback) ships a
broken-looking share image — the single most concrete re-enablement
prerequisite in the audit.
- **Landmine 2 — legal docs: a Spanish title over an English body.**
`legal.ts` carries English-only document *bodies*; the es tables cover
only the doc *titles* (`content-es.ts` has `legalDoc:privacy` /
`legalDoc:terms`). A Spanish player would get a Spanish-titled,
English-bodied legal page — legally fine, visually broken.
- **Landmine 3 — the safety net pins keys, not length.** The parity tests
pin key sets and placeholders, which is the right guard — but nothing
exercises *length*. Research (#3 below) puts the typical es inflation of
English UI strings at ~25 % (de ~30 %), and the standard practice is a
pseudo-locale pass in CI. The cheap analogue here: a test-only locale
that inflates `en.ts` values and asserts the rendering components don't
overflow. Belongs in the re-enablement checklist, not a standalone
feature.
- **Numbers and time are locale-blind, correctly, while English-only.**
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
- **The web `<head>` is static-English by construction.** `+html.tsx`
hardcodes `lang="en"` and an English `<title>`/`<meta description>`, and
the static Cloudflare export can only serve one document per build — so
in-app locale switching is fine (JS-only) but the HTML metadata stays
`en` no matter what. Acceptable for a web presence that is secondary to
the store; one line in any re-enablement note.
- **`i18n:listing-es` — the slice that ships without touching the app.**
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
- **`i18n:language` — re-enable the picker, behind a four-item checklist.**
The machinery (tables, `navigator.language` detection, format/translate,
a11y coverage) exists and is tested; the delta is (1) the share-badge font
fix or en-name fallback (landmine 1), (2) the two legal doc bodies
(landmine 2), (3) the pseudo-locale CI pass (landmine 3), and (4) the
settings picker + one persisted preference, with the existing detection
as fallback. **Candidate, not planned** — same trigger as the listing,
but it *follows* the listing: the app should catch up to a localized
listing, not lead it. No RTL language is in scope — the layout is built
LTR and RTL support is a project, not a feature.
- **`i18n:formatters` — locale-aware numbers/durations, the pass-8
successor.** Replace the fixed ladder with `Intl.NumberFormat` compact
notation ("1,2 M" in es vs "1.2M" in en) and route `formatDuration`'s
unit labels through the i18n tables. **Candidate, not planned** —
trigger: re-enablement, or any locale with a non-Latin digit script (then
the ladder is not a style choice, it's wrong). The Hermes
`Intl.NumberFormat` smoke test is a build prerequisite, not a note.
- **Rejected, with reasons** (so they aren't re-litigated): (1) *locale
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

- **What the meta-analysis actually says.** Tokac, Novak & Thompson
  (JCAL 35(3) 2019, 24 studies, ~360 citations) find a "small but
  marginally significant" overall effect of learning video games vs.
  traditional instruction, with heterogeneity "in magnitude and direction"
  — "a slightly effective instructional strategy." The honest consequence:
  the math verb is an engagement/flavor choice, not a defensible learning
  claim. Store copy and any future marketing should stay
  entertainment-framed — which is also the posture the S6 13+ decision
  implies (`docs/security-audit.md`). The research's value to this game is
  what it says to optimize *for*: flow, not pedagogy.
- **Flow / challenge calibration.** The flow channel sits between anxiety
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
- **Automaticity.** The standard definition (Rocket Math FAQ, standard
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
- **Differentiation by task feature.** Bardy, Holzäpfel & Leuders (METED
  23(3) 2021, full text read): in practice-phase work the right unit of
  "adaptive" is the task's features — 22 validated categories from operand
  range to representation shape — and a task with *differentiation
  potential* is done by heterogeneous learners at different levels at the
  same time. This is the research anchor for pass 4's per-type mastery
  tiers: not a different game, the same seven shapes at stepped ranges.

- ~~**`math:pending-gain`**~~ — **DONE 2026-09** (iteration 21,
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
- ~~**`math:zero-operand`**~~ — **DONE 2026-09-12** (iteration 13,
  autonomous pick alongside the pass-17 active-clock fix; audit finding
  (2)): `generateTermsEquation` now floors multiplicative operands (× and
  ²) at 1 even when `minNumber` is 0 — "0 · n" / "n · 0" / "0²" no longer
  generate, so no zero-answer equation pays the `Math.max(1, …)` floor.
  +/− keep 0 legal ("0 + n = n" is easy, not degenerate); existing saves
  keep their stored range — no migration. Tests in `equations.test.ts`
  (zero-operand exclusion describe).
- **`math:mastery`** — a per-type fact-table view: rolling accuracy on the
  last N answers per enabled type (the records seam, `records.ts` tracks
  lifetime answers, not per-type yet — that delta is the cost) plus a
  suggested next step ("× in [0, 12) is at 95 %+ — try + or widen the
  range"). Presentation + suggestion only; the actual step stays with the
  player (the Celeste-Assist shape the flow research endorses). The cheap
  half of pass 4's adaptive item. Candidate, not planned.
- **`math:adaptive`** — pass 4's per-type mastery tiers, now anchored by
  Chen's wider-channel argument and Bardy's feature-level differentiation:
  auto-step a type's range/shape up on mastery, the player-set range as
  the ceiling, a tier-up marker as the visible reward. Up-steps only,
  never down (the rejected-DDA reason below), player setting as the
  escape hatch. Bigger than `math:mastery`: it changes what the player
  *gets*, not just what they see. The pass-4 hard caveat carries over:
  it must challenge, never replace, hand-solved math. Candidate, not
  planned.
- **`math:ladder`** — narrate the automaticity ladder the research
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
"small but marginally significant" is quoted, the numeric d is not stated);

# 2 is a vendor design reference (same family as passes 8/13, qualitative —

Chen's 2006 USC MFA thesis is the academic primary, cited through it);

# 3 is a vendor FAQ (the standard accuracy → fluency → automaticity

definition, qualitative); #4 is peer-reviewed, open, full text read.

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
mints); a 30-day free run grosses 1,946 💎. Gem sources are the per-answer
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

- **Sinks are converters, not containers — and "prestige" is two sinks.**
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
- **Cosmetic revenue scales with visibility.** The gamedesign.gg
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
- **Vanity splits in two, and the game ships mostly one of them.**
  Xsolla's "Vanity sells" separates outward-facing vanity (showing
  identity to *others* — skins, emotes, sprays) from inward-facing vanity
  (embodiment, a personal mix-and-match aesthetic), and singles out
  *decorative environment customization* (the Sims / Hay Day shape) as
  the building-game variant — the cave-theme line is exactly that item,
  and the reroll randomizer is a strong inward-facing mechanic. The
  monetization side: the right *shape* of options matters more than the
  count — for direct sale, curated bundles beat itemized listings, and
  seasonal bundles as the end of a reward chain drive the engagement.
- **The economy audit asks what the committed player spends in month
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

- ~~**`cosmetics:analytics`**~~ — per-purchase event granularity on the
  guardrail-5 event log: line, item id, path (gems vs pack), gem balance
  at purchase. A pure `analytics.ts` addition on the existing buy/grant
  paths; no UX. The cheapest candidate and the precondition for every
  other trigger in this pass — which lines carry spend is currently
  unanswerable. **DONE (iteration 17, 2026-07-16):**
  `recordCosmeticPurchase` + `CosmeticPurchaseEvent` in `analytics.ts`
  (bounded newest-last log, cap 100, parse sanitizer + cap, summary
  rows in the Settings debug panel); the engine fires it from `buyCosmetic` / `buyCaveTheme` on completed gem buys (mirror-guarded, path "gems", post-spend balance) and `MinesOfDoom`'s IAP grant effect fires the "iap" path for newly granted items only. ~15 new test assertions across `analytics.test.ts` / `useGameEngine.test.ts`; zero UX change.
- **`cosmetics:collection`** — a collection-progress surface: per-line
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
- **`cosmetics:visibility`** — give the cosmetics a sightline, cheapest
  leg first: the share badge already has the pixel-sprite pipeline, so
  draw the owned pickaxe sprite (palette-tinted) instead of the hardcoded
  gold pickaxe, putting the player's look on the one surface the game
  already shares. The leaderboard-avatar leg is the expensive one
  (Pocketbase submit payload gains an outfit/pickaxe id pair) and lands
  only if the badge leg shows demand. No new mechanics — the displayed
  items already exist. Candidate, not planned.
- **`cosmetics:ceiling`** — raise the status-sink ceiling per research
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

- **Load path** (app/tab restarted, or fresh launch): on load,
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
- **Background path** (app backgrounded / tab hidden, no restart): the JS
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
day — no grace day, no shield — while the streak-design literature (sources

# 4/#5) names the one-missed-day hard reset as the #1 burnout trigger and

the grace-day/freeze as the standard anti-burnout pattern; the weekly
contract at least re-snapshots baselines on a missed week without penalty,
which is the correct absence posture. The ad pair (`offlineDouble` /
`offlineTopUp`) is a good return-time reward surface; the missing piece is
the *next-session* one (the streak), where a single travel day kills a 7-day
run for a game whose core audience (pass 15: 13+ casual) has exactly
travel-day absences.

The research (five sources; quality notes at the end):

- **The cap is the genre contract, and the cap is normally an upgrade
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
- **Offline progress is a delta-time illusion, tuned for 30-min–2-h
rhythms.** GeekExtreme's idle-math overview (source #2): offline
progression is "an illusion powered by mathematical delta-time calculations
that fast-forward your state upon login, not a continuously running
background server" — which is exactly this engine's shape (the tick loop's
catch-up *is* the delta-time fast-forward) — and that the most engaging
ids optimize for "30m to 2h rhythmic check-in sessions". That rhythm
confirms the 8 h cap sits well above the natural session cadence (a
deliberately generous cap), and confirms finding (2) is about player
*behavior* (chunking), not about the cap value being wrong.
- **Clock-cheating: no offline-only counter, low severity outside
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
- **Streaks die on the one missed day; the fix is the grace day, not the
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

- ~~**`offline:active-clock`**~~ — **DONE 2026-09-12** (iteration 13,
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
- **`offline:clock-hwm`** — mitigation for finding (3), the standard
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
- ~~**`offline:streak-grace`**~~ — **DONE 2026-09** (iteration 14,
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
server-side absence accounting* (Pocketbase as the time oracle) — source

# 3's conclusion applies: the system clock is player-controllable either

way, the device is the source of truth by design (cloud save is an LWW
*copy*, pass 5), and adding a server round-trip to the earn path buys
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

- **The reset is single-axis (soft).** `sinkNewShaft` (the engine) zeroes only
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
- **The reward is a stepped multiplier, not a currency.** `PRESTIGE_LEVELS` is
  a 6-row table keyed by *lifetime* minerals (a stat the reset never reduces):
  ×1 @ 0, ×1.5 @ 5 M, ×2 @ 50 M, ×2.5 @ 250 M, ×3.5 @ 1 B, ×5 @ 5 B.
  `getPrestigeLevel(lifetimeMinerals)` returns the highest rung the lifetime
  total has met; `sinkNewShaft` banks it into `prestigeLevel` (which only ever
  moves up toward it). There is no prestige token, no spend table, no
  “meta-progression shop” — the ×N *is* the whole reward. It clamps to the
  last row, so ×5 @ 5 B lifetime is a hard ceiling with no rung above it.
- **The anti-spam is the step-gate, and it is the strongest invariant in the
  engine.** `sinkNewShaft` is a no-op unless
  `getPrestigeLevel(lifetimeMinerals) > prestigeLevel`. Because the reset never
  reduces `lifetimeMinerals`, re-prestige is impossible until lifetime crosses
  the next rung — eligibility is a *pure function of an immutable stat*. You
  cannot re-bank the same tier or bank ahead; repeated resets are structurally
  spammed-out, not merely gated. The button mirrors it (`canBank =
  availableLevel > prestigeLevel`) and the indicator dot shares the same check
  (`hasAffordablePurchase`’s prestige branch), so the affordance never appears
  for a reset that would bank nothing.
- **The ×N is scoped to the minerals axis and deliberately does not touch the
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
- **The gate is triple-layered and consistent.** (1) *Content* —
  `prestigeUnlocked = completedTiers.includes("t3")` (the Magma Frontier tier,
  `goals.ts` `PRESTIGE_UNLOCK_TIER`); until tier 3 is complete the prestige
  content doesn’t exist. (2) *Visibility* — the prestige purchase row shows
  once `prestigeUnlocked` **or** `lifetimeMinerals ≥ PRESTIGE_LEVELS[1].at`
  (5 M, the first bankable rung), so it never appears before it could be
  meaningful. (3) *Enable* — the button is enabled only when a new rung is
  actually bankable (`canBank`). Three independent gates, all pointing the
  same direction: the affordance exists exactly when the reset is worth doing.
- **Structural findings (this layer is healthy — no bug-class item).**
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

- **Reset/keep is a spectrum, and this game sits at its gentlest end.**
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
- **The anti-spam and the “when to offer it” floor are the reference design’s
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

- **`prestige:currency`** — add a small prestige-*currency* axis on top of the
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
- **`prestige:ceiling`** — extend the table (a tier 6+ above 5 B) or attach a
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
  (player loop flag, independent `musicVolume` level via `musicLevel`,
  paused while muted /
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
- **Kids mode / parent screen** — **NOT a launch requirement:** the S6
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

- Interstitials / native display ads — banned permanently (rewarded-only).
- Fake scarcity / fake timers — banned (no dark patterns).
- Pay-to-win gates — all content is free-path reachable (`freePath.ts`).
  Paid-UA creative and audience-segmented store pages — gated by
  guardrail 5 (measure before scaling); see the pass-10 canon pins in
  "Store presence & the pre-install layer".
- Device-motion input (shake-to-X tropes — the accelerometer is the one
  input a motor-impaired player cannot use, and no verb here would need
  it), landscape / dual-thumb (no dual-stick genre; the
  portrait-is-canonical pin), and voice / social input (no real-time
  social surface exists) — pass 13, the input-side absences.

  These show up on genre checklists and are listed here so future passes
  don't "discover" them as missing.
