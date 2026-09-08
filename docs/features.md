# Mines of Idle Doomath — Feature Reference

Living catalog of what the game does, maintained as a continuous task
(`docs/todo.md`). Update it when adding features; keep entries short and
file-anchored so they stay verifiable. Section 7 ("Missing features,
explored") is the research output of the same task: genre-standard features
that do NOT exist yet, cross-referenced against idle/clicker and math-game
checklists (ClickerHeroes idle-game roundup, ENEBA best-idle list, G2A
incremental-guide, Edu.com / Reflex math-engagement research, 2026-09).
Items adopted from that list move into `docs/todo.md`.

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
  Bigger design lift than the single-shaft reset.
- ~~**Random in-game events**~~ — **DONE 2026-09** (todo "random
  in-game events"): the gem pocket — a rare tap-to-collect bonus node in
  the cave (`gemPocket.ts`, `hooks/useGemPocket.ts`, rendered in
  `components/MiningCanvas.tsx`). See §2 "Gem pocket".
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

### Player-facing surfaces

- **Home-screen widget** — ~~+ idle reminders~~ (the in-app idle reminder
  is DONE 2026-09 — `idleReminder.ts` / `useIdleReminder.ts` + settings
  toggle, see §2). No `expo-notifications` / widget anywhere in `src/`:
  the OS-level "come collect" push remains; must stay a simple reminder
  (no dark patterns).
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
- **Daily-challenge leaderboard** — the daily equation is identical for
  every player (day-key seed), so a first-solve speed or bonus-claimed
  ranking is trivially fair without an anti-cheat model beyond the
  honest-casual caps the existing leaderboard already uses
  (`leaderboard.ts`). The math-game version of the genre's daily
  reward loop; reuses the live Pocketbase leaderboard endpoint. Good
  candidate for the "real social loop" the genre roundups call out.
- **Guilds / community goals** — genre-common in bigger idle games;
  requires backend work on the existing Pocketbase deployment.
- **Kids mode / parent screen** — guardrail 6 (kid-safe age rating) is
  planned but there is no in-app parent area (time limits, ad consent
  surface). Becomes mandatory-looking once an age rating is chosen.

### Deliberately absent (guardrails, not gaps)

- Interstitials / native display ads — banned permanently (rewarded-only).
- Fake scarcity / fake timers — banned (no dark patterns).
- Pay-to-win gates — all content is free-path reachable (`freePath.ts`).
  These show up on genre checklists and are listed here so future passes
  don't "discover" them as missing.
