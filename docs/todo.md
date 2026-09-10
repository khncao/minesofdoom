# Mines of Idle Doomath — UX, Improvements & New Features Plan

Legend: [ ] not started, [o] in progress, [-] blocked
Completed items are removed from this file (see git history); only remaining work is tracked here.
Only work on continuous tasks after other tasks are completed

- [ ] verify web Google sign-in end-to-end in a real browser after the ID-client fix — root cause of the 401 was the GSI *token* API (`initTokenClient`/`requestAccessToken`), which Google documents as data-access only ("not for sign-in"): it minted an opaque OAuth access_token, not a JWT, and the sidecar refused it (`identity REFUSED ... malformed google token` in the VPS logs). `signinSdks.ts` now uses the ID client (`id.initialize` + `id.prompt`), whose `credential` IS the signed idToken the existing JWKS path verifies; the COOP `window.closed` warning came from that token-client popup, so confirm it's gone too (sign-in flow: popup → credential → /api/app/auth/google 200)
- [o] add a one time purchase that enables custom skinning (user uploaded images and audio) — decode pipeline (src/utils/graphics/customSprite.ts: PNG bytes→16×16 grid, 11 tests) + pure skin module (src/mines_of_doom/customSkin.ts: save-slot validation/normalize, grid→URI cache, audio data-URI cap, 250-gem unlock price, 14 tests) landed. **Remaining landing (one pass, ~6 files):** (1) SaveData fields customSkinUnlocked/Grid/Audio/Equipped + migration (save module was types.ts, mid-refactor when this was drafted); (2) IAP product `customSkinPass` (26th catalog row, feature line — storeId custom_skin, Stripe test price via `node scripts/stripe/syncStripe.mjs products`, catalog.json + storeConfig.prices); (3) picker: Web = DOM `<input type=file>` + canvas downscale→PNG→pngBytesToGrid (`.web.ts` swap, same pattern as iapProvider.web), native needs expo-file-system documentPicker or expo-image-picker (dependency + prebuild — native build pending); (4) IapPanel feature row + upload section (image/audio pick, equip toggle, clear) reusing the iap.* i18n pattern (en/es); (5) apply: Miner `bodyUri` override when equipped (customSkinGridToUri(grid, gridToPngDataUri)), emoji mode unaffected; swing sound: useSounds custom AudioPlayer from the data URI; (6) grant path: iapGrantCosmeticIds + IapPanel owned logic + MinesOfDoom grant effect
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
