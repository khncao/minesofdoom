# Mines of Idle Doomath — UX, Improvements & New Features Plan

Legend: [ ] not started, [o] in progress
Completed items are removed from this file (see git history); only remaining work is tracked here.

- [ ] continuous task: document features then explore and document missing
  features--do not implement until approved
  - Pass 13 done 2026-09-13 (input & control layer — the hand on the
    screen; passes 3–13 are in `docs/features.md`). Candidates documented,
    nothing implemented: a tap-vs-hold settings toggle (pair of the pass-3
    reduce-effects row), a gamepad / controller path (web leg is a thin
    web-only module; the Android leg gets DPAD/controller keys free on
    ChromeOS/TV — one-device verification), a keyboard-operability walk of
    the shipped web build, and an alternative-input pin (Playdate: adapt
    the verb vocabulary, not the hardware). All not planned — trigger-gated
    on player signals per the pass-11/12 discipline.

- [o] Cloudflare Pages web build — **broken 2026-09-08, fix pending push**:
  `expo export -p web` crashes with `TypeError: configs.toReversed is not a
  function` because Expo SDK 57's metro-config needs Node ≥ 21 but the build
  ran on the legacy image (Node 18.17.1, EOL). Two contributing findings:
  (1) the root `wrangler.toml` carrying `image = "node-22"` is NOT a valid
  Pages build config — the builder rejected it (missing `pages_build_output_dir`)
  and skipped it, so the pin never applied; (2) with no pnpm pin, the build
  detected pnpm 8.7.1 from the environment, which cannot read our
  `lockfileVersion: 9.0` lockfile (`Ignoring not compatible lockfile` —
  install runs unlocked). Fix: pin the Node 22 + pnpm ≥ 9 build environment
  where the builder actually reads it (dashboard env vars / supported pin
  file, not the root wrangler.toml — remove or repurpose that file), then
  push to main to re-trigger the deploy and confirm a green Pages build.

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
  a bad signature is refused at the sidecar. Step 6 of
  docs/store-integration.md §2.6 **verified 2026-09-08**:
  `scripts/stripe/checkoutTest.mjs` drove a hosted Checkout session end
  to end (a no-cost order under the script's blank-card policy — no card
  number is ever sent; the documented no-cost-orders sandbox flow),
  confirming the redirect grant (client verify fetch → HTTP 200) AND the
  webhook's idempotent backup mint for the same (device, product) row —
  session `complete`/`paid`, exactly 1 `pack_gold` row (session
  `cs_test_a1f0WT…`, device `mdoom-step6-mtstwwil`). **Remaining:** the
  sk_live flip at launch (re-run both sync commands with a `sk_live_`
  key + `--live`, re-paste the price map, re-sync the webhook secret —
  the endpoint URL is the same, the secret changes per key).

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
    **S6 DECIDED 2026-09-08 (iteration 9): teen+ (13+) positioning, not
child-directed** — `TAG_FOR_CHILD_DIRECTED_TREATMENT` stays `false`
(already the shipped value; `storeConfig.test.ts` pins it, decision
recorded in the `storeConfig.ts` comment). Rationale + the remaining
MANUAL pre-production steps (Play Console questionnaire + listing
minimum-age 13+ + no families opt-in; App Store equivalent; AdMob
console "Not child-directed") and the post-launch revisit trigger
(heavy under-13 usage ⇒ COPPA option (a) becomes mandatory) are all in
the S6 section of docs/security-audit.md and docs/features.md §7
"Compliance (pass 6)". Store-side check context: no production release
yet (internal track 1.0.8 only), so nothing published to verify; Play
Developer API v3 no longer exposes content ratings (top-level app
endpoint 404s, `edits.details` carries none) — the questionnaire is a
Play Console UI step BEFORE the first production release.
