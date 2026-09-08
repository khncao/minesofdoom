# Mines of Idle Doomath — UX, Improvements & New Features Plan

Legend: [ ] not started, [o] in progress
Completed items are removed from this file (see git history); only remaining work is tracked here.

- [ ] continuous task: document features then explore and document missing
  features--do not implement until approved

- [o] Stripe (web IAP) — **configured in test mode (2026-09-08)**: the 26
  products + one-time USD prices synced to the Stripe test account via
  `node scripts/stripe/syncStripe.mjs products` (console-free; idempotent
  via the mdoomProductId metadata marker), `storeConfig.stripe.prices`
  filled (web shop un-hidden, all-or-nothing gate green), the webhook
  endpoint created at the public `/stripe/webhook` URL
  (`...mjs webhook`) and the sidecar env landed on the VPS
  (`STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`/`MDOOM_PB_URL` in
  ~/docker/pocketbase, compose sidecar block, backups kept). Verified
  end to end: sidecar `/healthz` → `configured.web: true` +
  `stripeWebhook: {signature: true, pocketbase: true}`; a properly-signed
  synthetic event mints nothing for an unknown session (fail closed) and
  a bad signature is refused at the sidecar. **Remaining:** step 6 of
  docs/store-integration.md §2.6 — one test-card purchase through hosted
  Checkout (4242… card, test mode) confirming the redirect grant AND the
  webhook's idempotent backup mint for the same (device, product) row;
  then the sk_live flip at launch (re-run both sync commands with a
  `sk_live_` key + `--live`, re-paste the price map, re-sync the webhook
  secret — the endpoint URL is the same, the secret changes per key).

- [o] audit project security and compliance — **reviewed + `docs/security-audit.md`**
    (fail-closed verify, device-scoped private collections, no secrets in
    bundle, no XSS sinks — all sound). S1 (session tokens/salts/account ids
    were `Math.random`, not a CSPRNG) and S3 (password hashing was
    single-iteration SHA-256) both **fixed this iteration** (CSPRNG helper +
    100k-round iterated-SHA-256 KDF with transparent on-login upgrade) and
    tested; S2 (webhook `Stripe-Signature` — delivery now lands on the
    sidecar, which verifies the HMAC over the raw body and forwards with
    the shared key; the Pocketbase route 403s anything else) and S4
    (privacy policy v2.0 + terms v2.0 in-app via `legal.ts` — the Spanish
    i18n table stays key-pinned — + the published `privacy-policy.html` /
    `terms-of-use.html` **generated from the same modules** by
    `legalDocs.test.ts`) both **fixed this iteration** and tested.
    S3's web-sign-in server path is now live-verified against the deployed
    Pocketbase (2026-09-08, the exact fetch shape of the web client:
    register → 200+token, login → 200, `/me` → 200, GDPR delete with
    session token → `{ok, deletedAccount:true}`, post-delete re-login
    refused 401 — probe account deleted, nothing lingers); the in-browser
    GIS/Apple legs remain manual (`docs/blockers.md`).
    Only open follow-up: S6 (kid-safety/age rating — external store check).

- [x] IAP — entitlements re-derive from the store's own record after a local
    data loss ("iap not persisting on android" fix): the store provider now
    implements `reconcileStore()` (expo-iap `getAvailablePurchases`), called
    once on launch (silent, after the entitlement storage load lands) — the
    panel has NO manual Restore button: the launch reconcile IS the sync.
    It re-grants
    owned products, re-acks leftover un-acked records, and re-verifies each
    token so the server row re-mints under the device's CURRENT id — the
    only restore path that works for anonymous players after a wipe (their
    server rows are keyed by the old device id). Unit-tested in
    iapProvider.test.ts + useIap.test.ts (863 tests green).
- [x] IAP — on-device verification of the above: **DONE 2026-09-08** —
    the transient emulator billing-egress condition cleared on its own and
    the FULL wipe leg passed on mines-play-35 (1.0.8 / c04e03b debug APK):
    `pm clear` → `maestro test maestro/adhoc/iap-wipe-verify.yaml` →
    reconcileStore re-derived the owned Gold Pickaxe from the store record
    alone (production bundle, no dev toggle — the optional toggle steps
    WARN by design). Purchase leg (2026-09-06) + build leg + wipe leg all
    green; see the "RESOLVED 2026-09-08" note in `docs/blockers.md`.
    (Completed items are removed next cleanup pass — kept one pass as the
    unblock record.)
