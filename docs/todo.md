# Mines of Idle Doomath — UX, Improvements & New Features Plan

Legend: [ ] not started, [o] in progress
Completed items are removed from this file (see git history); only remaining work is tracked here.

- [o] Add stripe payment provider for web one time products — **code done**
  (hosted Checkout provider + sidecar Stripe-API confirm + the
  `/api/app/stripe/webhook` backup mint; docs/store-integration.md §2.6).
  Remaining is the external console side only: Stripe products/prices,
  the `pk_`/`sk_` keys, the webhook endpoint + sidecar env, then flip
  `storeConfig.stripe` (all-or-nothing, shop stays hidden until then).
- [o] Add adsense for web ads — **code done** (the shop-sheet banner,
  `AdSenseBanner.web.tsx` + the `+html.tsx` loader; §1.1). Remaining is
  external: AdSense approval + the `ca-pub-` client + a banner slot, then
  fill `storeConfig.adsense`.

- [ ] once everything else is complete: 
  - [ ] check project for additional UX improvements
  - [o] audit project security and compliance — **reviewed + `docs/security-audit.md`**
      (fail-closed verify, device-scoped private collections, no secrets in
      bundle, no XSS sinks — all sound). S1 (session tokens/salts/account ids
      were `Math.random`, not a CSPRNG) and S3 (password hashing was
      single-iteration SHA-256) both **fixed this iteration** (CSPRNG helper +
      100k-round iterated-SHA-256 KDF with transparent on-login upgrade) and
      tested. Open follow-ups: S2 (webhook `Stripe-Signature`/rate-limit),
      S4 (privacy policy — **blocks ship**), S6 (kid-safety/age rating).
  - [ ] check project ship readiness

- [ ] IAP — test purchase → entitlement → wipe local key → restore.


