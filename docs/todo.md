# Mines of Idle Doomath — UX, Improvements & New Features Plan

Legend: [ ] not started, [o] in progress, [-] blocked
Completed items are removed from this file (see git history); only remaining work is tracked here.
Only work on continuous tasks after other tasks are completed

- [ ] draft a few different generated art styles for characters and cosmetics
- [ ] add a one time purchase that enables custom skinning (user uploaded images and audio)
- [o] rework mine background. Player should feel as if they are digging deeper based on depth
  — IMPLEMENTED (2026-09): the cave strip now descends proportionally to
  absolute depth (6 px/m, one full row per 4 m) instead of one tile per
tier, covers the full canvas height, and the next tier's rock slides in
  from the bottom before the tint flips (`caveTiles.ts:
  caveRowStartForDepth/caveTranslateForDepth`, `CaveBackground.tsx`,
  descent invariants unit-tested in `caveTiles.test.ts`). Remaining: visual
  pass on a device/emulator (feel + speed tuning of CAVE_PX_PER_METER /
  SLIDE_MS) — remove this item once that looks right.

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
