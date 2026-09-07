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
- **Local records** — personal-best panel (depth, combo, minerals/sec, …)
  over the same lifetime stats a live leaderboard would use (`records.ts`,
  `components/RecordsPanel.tsx`).
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
- **Sound** — expo-av SFX incl. per-pickaxe swings; mute toggle
  (`hooks/useSounds.ts`, `components/MuteToggle.tsx`). No music.
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
- **Rewarded ads** (AdMob, native; web has no ad SDKs) — four opt-in
  kinds: gem rolls, offline double, offline top-up, combo save; hard
  per-day reward caps enforced in pure code as the fraud cap
  (`ads.ts`, `adProvider.ts`, `hooks/useAdRewards.ts`,
  `components/AdRewardsPanel.tsx`).
- **AdSense banner** (web shop sheet only) — config-gated until the
  AdSense account + unit id land (`AdSenseBanner.web.tsx`).
- **Guardrails enforced by design** — rewarded-only on native, no
  interstitials/banners, cosmetics earnable, free-path CI floor
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
  haptics, mute, language (`hooks/useSettings.ts`,
  `components/SettingsPanel.tsx`, `components/SaveTab.tsx`,
  `components/MenuPanel.tsx`).
- **Quality** — Jest suites over the pure modules (860+ tests), Maestro
  e2e flows, Play Console CLI helper (`npm run play`), static-export-safe
  routing (AGENTS.md).
- **Support** — in-app mailto inquiries button (`components/InquiriesButton.tsx`).

## 7. Missing features, explored (2026-09)

Cross-checked against the idle/clicker genre roundups and math-game
engagement research linked in the header. **None of these exist in the
codebase today** (verified against `src/`). Ranked rough order of
genre-impact; anything picked up goes into `docs/todo.md`.

### Engagement / progression

- **Weekly / monthly challenges** — daily bonus exists; nothing recurs on a
  longer cadence. A "weekly contract" (reuse the goal-tier derived-metric
  machinery, `goals.ts`) is the cheapest next retention tick.
- **Daily rotating challenge equations** — a fixed daily seed (the
  persona sim in `freePath.ts` already proves determinism is cheap) for a
  daily "equation of the day" with a bonus. Differentiates the math genre;
  engagement research consistently cites fresh daily content.
- **Seasonal / limited-time events** — the genre's main re-engagement
  driver (real-time events, event cosmetics). Note: real limited windows
  only — the no-fake-scarcity guardrail forbids fake timers, and the
  F2P-viability guardrail means event rewards must be earnable free.
- **Multi-layer prestige / ascension** — single multiplier bank (6 levels);
  big idle games add a second meta-axis (ascension points → new tree).
  Bigger design lift than the single-shaft reset.
- **Random in-game events** — rare bonus nodes/encounters while idling
  (e.g. a gem pocket that must be tapped). Cheap juice/retention overlap.
- **Statistics detail** — records panel shows personal bests only; no
  per-session stats, no time-played breakdown, no export.

### Player-facing surfaces

- **Home-screen widget + idle reminders** — no `expo-notifications` /
  widget anywhere in `src/`. Standard idle-game "come collect" pattern;
  must stay a simple reminder (no dark patterns).
- **Sound volume controls** — haptics landed 2026-09 (the `haptics`
  settings toggle, §3); sound is still mute-only (no volume, no
  per-sound toggles).
- **Music / ambient loop** — SFX only; no background audio.
- **More languages** — en/es only; the i18n table machinery
  (`utils/i18n/`) makes adding locales cheap, and the kid-skewed audience
  argues for more coverage eventually.
- **Share images** — achievement shares are plain text (`share.ts`);
  rendering a shareable PNG badge is the genre norm.
- **Deep/universal links** — none; save transfer is clipboard-only
  (`saveCode.ts`).

### Social / meta

- **Friends / social leaderboard** — global top-10 exists; no
  Game Center / Play Games friend feeds, no friend-list leaderboard.
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
