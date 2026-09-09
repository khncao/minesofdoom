# Mines of Idle Doomath — Feature Reference

Living catalog of what the game does, maintained as a continuous task
(`docs/todo.md`). Update it when adding features; keep entries short and
file-anchored so they stay verifiable. Open feature **gaps** —
explored, ranked, not planned — live in `docs/gap-ranking.md` (impact
ranking + every gap layer; formerly this file's section 7).

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
  number range (multiplicative operands floor at 1 even when the player-
  set minimum is 0, so the default range never rolls trivial 0·n / 0²
  equations — `utils/math/equations.ts: generateTermsEquation`),
  **hard mode** (3-term equations, 2× payout), and a display-symbol
  preference (`*`/`×`, `/`/`÷`). The display shows the **exact pending
  gain**, answer value included (`components/EquationDisplay.tsx` —
  `getPendingAnswerGain`, mirroring the engine's integer core so it
  agrees with the floating "+N" on solve). Answer via the **on-screen
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
  costs nothing, odds are identical for every player (`docs/gap-ranking.md`
  "Random in-game events" layer, in-repo half).
- **Idle reminder** — after a minute without a cave tap or an answer
  (while the app is open), a one-per-session toast reminds the player the
  mine keeps collecting and progress autosaves. Settings toggle, on by
  default; no reward, no fake timer — plain information per the no-dark-
  patterns guardrail; the in-app half of the `docs/gap-ranking.md`
  "Idle reminder" candidate — the home-screen widget half stays open)
  (`idleReminder.ts`, `hooks/useIdleReminder.ts`).
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
  (nothing new is stored); "Cosmetic compendium", DONE iteration 23 in
  `docs/gap-ranking.md`.
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
  rebuild: the four landmines and the `i18n:*` candidates live in pass 14
  of `docs/gap-ranking.md`.
- **Observability** — local lightweight analytics record (guardrail 5;
  per-device only, readable and clearable in Settings → About “Local
  stats (debug)”), on-device crash ring + session-trail context behind two
  capture nets (render error boundary + global handler) with two readouts;
  all local, no network, no PII (`analytics.ts`, `crashLog.ts`,
  `crashContext.ts`, `crashLogging.ts`, `components/ErrorBoundary.tsx`,
  `components/AboutTab.tsx`). Pass 26 (F26.1–F26.6) audits the layer and
  names the missing opt-in cohort channel.
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
  request that would become a live impression or sidecar call; pass 12 of
  `docs/gap-ranking.md` is the design context, `docs/store-integration.md`
  §2.7 the spec-by-spec contract), Play Console CLI helper (`npm run play`), static-export-safe
  routing (AGENTS.md).
- **Support** — in-app mailto inquiries button (`components/InquiriesButton.tsx`).
