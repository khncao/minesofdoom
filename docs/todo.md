# Mines of Idle Doomath — UX, Improvements & New Features Plan

Legend: [ ] not started, [o] in progress, [-] blocked
Completed items are removed from this file (see git history); only remaining work is tracked here.
Only work on continuous tasks after other tasks are completed

- [x] verify web Google sign-in end-to-end in a real browser after the ID-client fix — DONE 2026-07-21. Root cause of the 401 was the GSI *token* API (`initTokenClient`/`requestAccessToken`), which Google documents as data-access only ("not for sign-in"): it minted an opaque OAuth access_token, not a JWT, and the sidecar refused it (`identity REFUSED ... malformed google token` in the VPS logs). `signinSdks.ts` now uses the ID client (`id.initialize` + `id.prompt`), whose `credential` IS the signed idToken the existing JWKS path verifies. Verified with a new Playwright spec (`e2e/web/signin.spec.ts`): hermetic (default, stubbed GSI — button wired, popup→credential→`/api/app/auth/google` 200, idToken in body, no COOP noise, button not stuck when GSI is absent) + a live wiring check (`E2E_LIVE_GSI=1`, real script from accounts.google.com — ID-client surface present, click crash-free, no COOP warning, #419 count unchanged vs baseline). The live path stops at `prompt()` (headless profile has no Google account) — the last hop (real consent popup → sidecar JWT) remains the manual ad-hoc step. Along the way the live run surfaced two real bugs, both fixed: expo-audio's web bed leaked an unhandled `play()` rejection when it started before the first user gesture (now gesture-gated) and the pre-existing prod-web React #419 was baselined in the test
- [x] add a one time purchase that enables custom skinning (user uploaded images and audio) — **LANDED (2026-09-10), end to end:** PNG decode (customSprite.ts) + pure skin module (customSkin.ts: slot validation/normalize, grid→URI cache, 250-gem unlock, audio cap) + SaveData fields customSkinUnlocked/customSkinGrid/customSkinAudio/customSkinEquipped (MIGRATION_VERSION 2, SAVE_VERSION 3) + IAP `packSkin` (26th catalog row, "skin" feature line, storeId pack_skin; catalog.json + content-es iap:packSkin synced) + web picker (customSkinPicker.web.ts: file/camera input → downscale → 16×16 nearest-neighbor → pngBytesToGrid; .web.ts swap, noop native stub) + IapPanel skin pass row (gem or one-time unlock, upload/cancel sections, equip toggle, clear-with-confirm, native not-available note) + Miner bodyUri override (customSkinGridToUri; emoji unaffected) + custom swing sound (useSounds AudioPlayer from the audio data URI) + grant path (iapGrantCosmeticIds.customSkin → unlockCustomSkin on entitlement; iaps/iapProvider/pb_hooks synced) + i18n en/es (iap.* keys). Full gates green (1151 tests, typecheck, lint). **Remaining before release:** (1) run `node scripts/stripe/syncStripe.mjs products` and paste the real test price over the `price_PENDINGPACKSKIN` placeholder in storeConfig.ts (until then only packSkin checkouts fail — everything else unaffected); (2) create the pack_skin Play Billing SKU (docs/store-integration.md §2 table is generated from the catalog); (3) native picker — expo-file-system documentPicker or expo-image-picker + prebuild (native build pending); (4) manual ad-hoc + e2e web iap re-run
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
