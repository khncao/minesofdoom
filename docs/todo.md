# Mines of Idle Doomath — UX, Improvements & New Features Plan

Legend: [ ] not started, [o] in progress, [-] blocked
Completed items are removed from this file (see git history); only remaining work is tracked here.

- [x] fix failed to sign in error using oauth2 on web build — **verified fixed 2026-09-08**: the GSI origin gate now passes on the deployed build — `scripts/gsiOriginProbe.mjs` (headless Playwright against `https://minesofdoom.pages.dev`) drove the exact `mintGoogleIdTokenWeb` flow (menu → account tab → the `account-google` button) and GSI opened its token-client popup at `accounts.google.com/v3/signin/identifier` with `origin=https://minesofdoom.pages.dev` + the pinned client id — the pre-fix failure mode was the popup never opening at all (the client's **Authorized JavaScript origins** picked up the post-migration origin, the Google Cloud Console change that was the only remaining leg; the click-path that was in `docs/blockers.md` is now history — section deleted per the file's convention). The server half was already live-verified the same day (the exact web-client fetch shape against the deployed Pocketbase: register → login → `/me`, and the sidecar `/identity` path the idToken lands on). What a human may still do one-off: the actual account-picker → consent click-through with a real Google account (no credentials exist in the repo, so the probe stops at the popup — exit 0 = authorized, 1 = still blocked; re-run it after any future origin migration as the origin-gate canary). The in-repo half of the same migration fallout (the `/stripe/checkout` CORS error above) is FIXED + verified 2026-09-08: the sidecar's `MDOOM_WEB_BASE_URL` VPS env still held the pre-migration `https://khncao.github.io/minesofdoom` origin, so its CORS allow-origin never matched `https://minesofdoom.pages.dev`; env updated + `docker compose up -d sidecar` (restart doesn't re-read env). Verified live: preflight 204 + `access-control-allow-origin: https://minesofdoom.pages.dev` (old origins still refused), a real POST carries the headers into the route, and `scripts/stripe/checkoutTest.mjs` (no-cost order, blank-card policy) PASSED end to end — session `cs_test_a1c3gZvf…`, device `mdoom-step6-mtt2frc5`: the return navigation landed on `https://minesofdoom.pages.dev/?iap=success…` AND the page asserted as the app (its persistent "hold to mine" canvas caption — `document.title` is unusable, the RN-Web runtime clears it after the static load), the session reached `complete`/`paid`, and the webhook + redirect legs granted one idempotent row. The probe itself had a pre-migration blind spot (success/cancel URLs pointed at the Pocketbase domain, so its "return navigation" never landed on the app; it now uses `WEB_BASE` = the app origin, asserts the app by that caption, and closes page-then-browser so a still-loading return navigation can't crash node with exit 1 after the PASS printout).

  (Third 2026-09-08 todo — custom numeric keypad default for web — is FIXED in code: the `onScreenKeypad` `useLocalStorage` default is now `Platform.OS !== "web"` (web users start on the OS keyboard, no numpad strip; native keeps the numpad; the user's saved setting still wins) + the input-layer doc updated in `docs/features.md` §1 (the Equations bullet now states the per-platform first-launch default).)
- [x] continuous task: document features then explore and document missing
  features -- do not implement until approved — **done 2026-09-08** (passes
  1–18; the full layer sweep, done twice over — input, locale, session,
  platform, stability, math, cosmetics, offline/absence, prestige/reset, plus
  FTUE, benchmarks, monetization, win-back, store presence, and the original
  surfaces/social checklists). All remaining items are trigger-gated
  candidates in `docs/features.md` §7 (none planned, none implemented), and
  every trigger is a player/content signal that does not exist yet: analytics
  is local-only (guardrail 5 — no network) and there is no production release,
  so there is nothing to act on. **Reopen** (a new §7 pass, not
  implementation) when any of these lands: (1) the first production release +
  the guardrail-5 signal batch (free-path deltas vs the pass-4 targets — e.g.
  `prestige:currency`'s tier-3-reached-but-never-banked trigger, D1/D7,
  `cosmetics:analytics` as the per-line gate); (2) a content pass that pushes
  intended endgame lifetime past 5 B (→ `prestige:ceiling`); (3) an es-market
  signal (→ the pass-14 locale candidates); (4) a share-badge / cosmetics
  demand signal (→ the pass-16 `cosmetics:visibility` / `collection`
  candidates). Per-pass detail: git history ("docs(features): pass N") +
  `docs/features.md` §7.
- [x] Stripe (web IAP) — **test-mode setup DONE + verified end to end (2026-09-08)**: the 26
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
  the endpoint URL is the same, the secret changes per key — then
  `node scripts/stripe/syncStripe.mjs verify --live`, the read-only
  drift check that diffs the account vs `catalog.json` + the
  `storeConfig.ts` price block and catches the half-flips: stale
  pasted price ids, pk/sk mode mismatch, tier drift, missing/rogue
  products; §2.6 step 6).

- [x] audit project security and compliance — **DONE 2026-09-08 (reviewed + `docs/security-audit.md`)**
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
Play Console UI step BEFORE the first production release. **All S-items
closed:** S1/S3 fixed + tested, S2/S4 fixed + tested (S4's only
remainder is linking the privacy/terms URLs from the store listings —
external), S5 accepted, S6 decided — so the in-repo half of the audit is
done; everything left is the manual pre-production console steps listed
in the `docs/security-audit.md` follow-up checklist (S4 link + S6 steps
1–3 + the post-launch S6 revisit trigger).
