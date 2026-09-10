# Mines of Idle Doomath — UX, Improvements & New Features Plan

Legend: [ ] not started, [o] in progress, [-] blocked
Completed items are removed from this file (see git history); only remaining work is tracked here.
Only work on continuous tasks after other tasks are completed

- [ ] add a one time purchase that enables custom skinning (user uploaded images and audio)
- [ ] continuous task (do not complete): document feature map and fill out feature gaps and potential product improvements. Do not implement any feature gaps until greenlit

- `docs/blockers.md` — the IAP external remnants (iOS `APPLE_*` App Store Connect
  API key for the sidecar; the Stripe `sk_live` flip at launch) and the three
  OS-level VPS hardening steps that need a human at the terminal.
- `docs/security-audit.md` — the S4/S6 manual pre-production checklist (store
  listing privacy/terms links, the 13+ questionnaire steps, the AdMob
  console "Not child-directed" setting, the post-launch S6 revisit trigger).
- `docs/backlog.md` — the intentionally deferred iOS track (AdMob iOS entry,
  App Store IAP products + credentials, iOS on-device verification passes).
- `docs/features.md` — the feature map (what exists, per section).
- `docs/gap-ranking.md` — every open gap, ranked by impact (the former
  features.md §7, moved 2026-09), with trigger-gated candidates
(including `offline:clock-hwm`, deliberately low priority per its own
sources, and `share:clipboard-opt-in`). Reopen on the signals
recorded there (first production release + the guardrail-5 signal
batch, endgame-lifetime content pass, es-market,
share-badge/cosmetics demand).
