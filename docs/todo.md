# Mines of Idle Doomath — UX, Improvements & New Features Plan

Legend: [ ] not started, [o] in progress, [-] blocked
Completed items are removed from this file (see git history); only remaining work is tracked here.
Only work on continuous tasks after other tasks are completed

- [x] remove the calendar icon for daily question. Have daily question pop up automatically when available (with setting to toggle). Idle rewards as well (remove icon) → DONE (2026-09-11): both header icons are now fallback-only. Two new settings (both ON by default, settings merge supplies them — no migration): `autoDailyEquation` auto-starts today's equation (the existing daily-equation mode, start toast included) at most once per local dayKey while unsolved, and `autoDailyBonus` auto-claims a claimable streak bonus once per dayKey through the same grant path/toast (`claim` is internally claimable-guarded, so double-fire can't double-pay). While either toggle is OFF, the 📅/🎁 header button renders exactly as before, so every state has an entry point. Both effects are onboarding-gated like the gem pocket (the tutorial owns the display first); per-dayKey ref guards make repeat renders no-ops. i18n en/es + SettingsPanel rows; useDailyBonus now exposes `dayKey` for the per-day guards.
- [x] gems should be more rare and buying gems with minerals should increase in price after each purchase → DONE (2026-09-11): the direct mineral→gem purchase is now a self-limiting fallback, not a faucet: base 100,000 minerals, each subsequent LIFETIME purchase costs ×1.10 (`GEM_PURCHASE_ESCALATION`, save field `gemsBoughtWithMinerals` — survives prestige, save version 12 migration; pb_hooks save-schema sync pin bumped in step). Price computed on the pure module (`getGemPurchaseCost`), surfaced on the buy button + settings preview, free-path sim uses the same curve. Consequence, benchmark recalibrated: no positive escalation can keep the old 30-day full-collection benchmark (it needs ~400 flat-cost mints), so the F2P horizon moved 30→45 days (deterministic crossover between day 42 and 45; 1634/1782 gems vs 1675 cost). Guardrail 1 wording preserved: free players reach the same end-state, only slower — and a future change pushing the crossover past 45 days fails the benchmark on purpose.
- [x] background canvas should cover whole screen and be more random (less patterns) → DONE (2026-09-11): CaveBackground reworked to a full-screen 4-layer background at the MinesOfDoom root (flat tint wash + far row layer at 0.5× + mid rows at 1× + jagged rock wall columns on both screen edges at 1.25× with random-cut inner edges, ore flecks and crystals); the mining canvas box is transparent now; caveTiles.ts gained the wall-strip baker (buildCaveWall / caveWallUri / caveWallWidthPx) + tests.
- [ ] since they give minerals, mineral pocket instead of gem pocket
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
