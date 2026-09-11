# Mines of Idle Doomath — UX, Improvements & New Features Plan

Legend: [ ] not started, [o] in progress, [-] blocked
Completed items are removed from this file (see git history); only remaining work is tracked here.
Only work on continuous tasks after other tasks are completed

- [ ] finish the `packSkin` release — the in-repo half LANDED (custom-skin one-time purchase, catalog row `packSkin`, web + native pickers, grant path, i18n; Stripe test product/price and the `pack_skin` Play Billing SKU are live in test mode; all gates green — full writeup in git history). Remaining: (4) manual ad-hoc pass on a device (human).
- [ ] continuous task (do not complete): document feature map and fill out feature gaps and potential product improvements. Do not implement any feature gaps until greenlit (nothing in `docs/gap-ranking.md` is greenlit).
  - **Sweep status (passes 33–64, 2026-09-10 → 2026-09-16):** 25 architecture layers audited end to end (account/session, content authoring, release pipeline, web discoverability, numeric ledger, dependencies, server-side verification, tick scheduling, external code, test layer, asset generation, React state, compliance, storage, listener lifecycle, fault handling, concurrency, server API surface, juice/game feel, onboarding, input, settings, rewarded-ad economy, cosmetics rendering, IAP queue). Everything that LANDED from the sweep — Tier 1 real bugs #24–#27, the onboarding save-code seams, the erase-all one-off, the empty-submit guard, the settings-hook net, the stale ad-offer clears, the hold-to-mine i18n, the Stripe/GSI loader hygiene — is in git history together with its pass-by-pass writeups; only the open set is tracked here.
  - **Still open (all ranked in `docs/gap-ranking.md`):** Tier 1 #22 `account:web-erasure` (feature gap), #23 `entitlements:clobber-on-second-purchase` (real bug, fix-shaped), #28 `compliance:pb-portal-backdoor` (needs the owner's remove-vs-gate call); plus the pending-greenlit Tier 2/3 findings from the swept layers and the human / trigger-gated items (F36.1 Search Console + AdSense account approval; Tier 1 #14 `web:pwa` on its web-growth trigger).

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
