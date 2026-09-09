# Mines of Idle Doomath — UX, Improvements & New Features Plan

Legend: [ ] not started, [o] in progress, [-] blocked
Completed items are removed from this file (see git history); only remaining work is tracked here.

**In-repo queue: empty (2026-09-08).** All items through iteration 11 are done and
removed per the convention above. What remains is external/manual work tracked
outside this file:

- `docs/blockers.md` — the IAP external remnants (iOS `APPLE_*` App Store Connect
  API key for the sidecar; the Stripe `sk_live` flip at launch) and the three
  OS-level VPS hardening steps that need a human at the terminal.
- `docs/security-audit.md` — the S4/S6 manual pre-production checklist (store
  listing privacy/terms links, the 13+ questionnaire steps, the AdMob
  console "Not child-directed" setting, the post-launch S6 revisit trigger).
- `docs/backlog.md` — the intentionally deferred iOS track (AdMob iOS entry,
  App Store IAP products + credentials, iOS on-device verification passes).
- `docs/features.md` §7 — trigger-gated candidates. No-signal picks have
  been done out-of-queue eight times: on 2026-07-16 (iteration 17) the
  pass-16 candidate `cosmetics:analytics` landed — per-purchase events
  (line, item id, gems-vs-pack path, gem balance at purchase) on the
  guardrail-5 log: `recordCosmeticPurchase`/`CosmeticPurchaseEvent` in
  `analytics.ts`, fired by the engine's gem buys (mirror-guarded, path
  "gems") and the IAP grant effect (path "iap"), debug-panel rows +
  parse sanitizer/cap, ~15 new test assertions, zero UX. On 2026-09-12
  (iteration 13) the
  pass-17 `offline:active-clock` bug fix (background catch-up no longer
  inflates the active play-time clock) and the pass-15 `math:zero-operand`
  generator fix (no more "0 · n" / "0²" zero-answer equations at the
  default range), on 2026-09 (iteration 14) the pass-17
  `offline:streak-grace` finding (a single missed local day no longer
  hard-resets the daily streak — one free automatic grace per rolling 30
  days in `dailyBonus.ts`), on 2026-09 (iteration 15) the pass-17
  `engagement:day7-spike` finding (the daily-streak ladder now pays the
  flat 250k `DAILY_MILESTONE_BONUS` on streaks 7+ instead of its 70k cap
  rung — a cost-to-skip anchor worth more than days 1–6 combined, per the
  retention research), and on 2026-09 (iteration 16) the pass-3
  accessibility item **independent music volume** (the cave-ambience bed no
  longer rides half the SFX level — `settings.musicVolume`, 0–100%, default
  50 = the old half-level default experience, its own 10%-step settings
  row; `clampMusicVolume` / `musicLevel(musicVolume)` in `game.ts`, the
  menu mute toggle still wins), and on 2026-09 (iteration 19) the
  pass-4 `streak-protection` candidate (**streak freezes + repair**,
  the Duolingo teardown's safety nets) in `dailyBonus.ts`: behind the
  iteration-14 grace, up to 3 streak **freezes** (earned passively one
  per 7-streak day, consumed silently on a one-day gap, surfaced
  retroactively in the claim toast) and, once both are spent, a 24h
  **repair** that restores a reset 3+ streak to lost+1 on the next
  local day's claim (once per rolling 30 days); all counters real and
  bounded, all new state fields optional (no migration), a11y-only
  freeze counter on the bonus button, and on 2026-09 (iteration 20)
  the pass-8 `ui:notation` item (**player-chosen number notation**,
  the genre guide's cozy-vs-clinical toggle): `settings.notation`
  ("compact" | "plain", default "compact" = the shipped ladder, old
  saves unchanged) cycled from a settings row whose button is a live
  sample of 1,234,567 in the current mode; plumbing mirrors the i18n
  locale-store precedent — a tiny store in `utils/format.ts` that
  `formatNumber`'s default second argument reads (no call site threads
  it), MinesOfDoom syncing the setting in and subscribing via
  useSyncExternalStore so a flip re-renders counters/costs/records/badges
  in place; plain mode mirrors compact's value law exactly (floored,
  non-finite via toString, bigint exact), and on 2026-09-08 (iteration 21)
  the pass-15 `math:pending-gain` finding (audit finding (1) — the
  pending-gain readout no longer understates the payout by a factor of the
  answer's value): `getPendingAnswerGain` in `game.ts` mirrors
  `applyAnswerReward`'s integer core (premium-folded answer value floored
  at 1 exactly like the reward, × effective click power × combo multiplier;
  the depth/prestige float tail stays in the caller's mulFloats'ed
  effective click power), so the readout agrees with the floating "+N" on
  solve digit-for-digit; `EquationDisplay` swapped its local product for
  the helper — pure display change, engine untouched, `equation.pending`
  copy unchanged (now literally true), tests in `game.test.ts` (premium
  ladder, hard-mode leading-op keying, zero-answer floor). The rest stays
  trigger-gated (including `offline:clock-hwm`, deliberately low priority per
  its own sources). Reopen on the signals recorded there (first
  production release + the guardrail-5 signal batch, endgame-lifetime content
  pass, es-market, share-badge/cosmetics demand).
