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
  been done out-of-queue twice: on 2026-09-12 (iteration 13) the pass-17
  `offline:active-clock` bug fix (background catch-up no longer inflates the
  active play-time clock) and the pass-15 `math:zero-operand` generator fix
  (no more "0 · n" / "0²" zero-answer equations at the default range), and on
  2026-09 (iteration 14) the pass-17 `offline:streak-grace` finding (a
  single missed local day no longer hard-resets the daily streak — one free
  automatic grace per rolling 30 days in `dailyBonus.ts`). The rest stays
  trigger-gated (including `offline:clock-hwm`, deliberately low priority per
  its own sources). Reopen on the signals recorded there (first
  production release + the guardrail-5 signal batch, endgame-lifetime content
  pass, es-market, share-badge/cosmetics demand).
