# Mines of Idle Doomath — UX, Improvements & New Features Plan

Legend: [ ] not started, [o] in progress
Completed items are removed from this file (see git history); only remaining work is tracked here.

- [ ] continuous task: document features then explore and document missing
  features--do not implement until approved

- [o] Add stripe payment provider for web one time products — **code done**
  (hosted Checkout provider + sidecar Stripe-API confirm + the
  `/api/app/stripe/webhook` backup mint; docs/store-integration.md §2.6).
  Remaining is the external console side only: Stripe products/prices,
  the `pk_`/`sk_` keys, the webhook endpoint + sidecar env, then flip
  `storeConfig.stripe` (all-or-nothing, shop stays hidden until then).
  The public `/stripe/webhook` URL is already routed to the sidecar
  (Caddy, 2026-09-06, fail-closed until `STRIPE_WEBHOOK_SECRET` lands),
  so the Stripe console's webhook endpoint can point at it as-is. Added publishable key to storeConfig. Give me a command to run on the server to add the secret key

- [o] Add adsense for web ads — **rewarded code done (2026-09-07)**: the
  banner path was REPLACED by the AdSense "Ad Placement API" (H5 Games
  Ads) for parity with the native rewarded placements — the loader in
  `+html.tsx` now feeds `adSenseProvider.web.ts`, which pushes
  `type: "reward"` placements (one per AdKind) onto `window.adsbygoogle`
  in the two-phase flow: prime on probe (panel open / pill mount),
  `showFn` called synchronously on the player's "watch" tap. `slot` is
  gone from the config (per-kind placements, same client); the
  `AdSenseBanner*` files, `react-native-web.d.ts`, and the `iap.adLabel`
  i18n key are deleted; privacy policy v2.0 + Spanish content updated
  (the published HTML regenerates via `legalDocs.test.ts`). External
  console side only: confirm the account is approved for H5 Games Ads /
  Ad Placement API and the rewarded placements serve for the deployed
  domain (test with the AdSense "ad fill" preview tools, then the
  deployed site), then flip nothing — the client is already in
  `storeConfig.adsense` and the loader ships in the export.

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

- [ ] harden pocketbase

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
