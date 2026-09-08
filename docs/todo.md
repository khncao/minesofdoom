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
- [ ] IAP — on-device verification of the above: purchase (DONE 2026-09-06 —
    purchase leg confirmed working on the dev build, mines-play-35, license
    tester) → wipe local key (pm clear) → relaunch → entitlement re-derived
    from the store record. **Build leg DONE 2026-09-06 PM:** a debug APK
    from HEAD (c04e03b, supersedes a50aea0 — the embedded-bundle variant,
    boots standalone with the real store provider) is installed on
    mines-play-35 (versionName 1.0.8, boot-smoke clean); the wipe flow
    (`maestro/adhoc/iap-wipe-verify.yaml`) now asserts the FULL leg: pm
    clear → relaunch → panel settles back to **Owned** once reconcileStore
    re-derives it from the store record (90 s window). What remains is the
    billing network (see below) → `maestro test maestro/adhoc/iap-wipe-verify.yaml`. 2026-09-06 PM: the purchase-leg re-run is blocked by the
    emulator billing network (billing gRPC ERR_CONNECTION_REFUSED — worked
    earlier the same day; `docs/blockers.md`), and "works via
    expo run:android" is the labeled dev-sim provider (dev bundle,
    `__DEV__=true`), not real Play Billing
