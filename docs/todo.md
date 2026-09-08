# Mines of Idle Doomath — UX, Improvements & New Features Plan

Legend: [ ] not started, [o] in progress, [-] blocked
Completed items are removed from this file (see git history); only remaining work is tracked here.

- [-] fix failed to sign in error using oauth2 on web build — root cause = GSI **Authorized JavaScript origins** missing the post-migration origin `https://minesofdoom.pages.dev` (client `94426274846-7vsqc2…`, Web-application type). The authorized-origins list is a Google Cloud Console-only change (no API/CLI) — exact click-path + verification in `docs/blockers.md` → "Web Google sign-in (GSI) fails on the deployed web build". The in-repo half of the same migration fallout (the `/stripe/checkout` CORS error above) is FIXED + verified 2026-09-08: the sidecar's `MDOOM_WEB_BASE_URL` VPS env still held the pre-migration `https://khncao.github.io/minesofdoom` origin, so its CORS allow-origin never matched `https://minesofdoom.pages.dev`; env updated + `docker compose up -d sidecar` (restart doesn't re-read env). Verified live: preflight 204 + `access-control-allow-origin: https://minesofdoom.pages.dev` (old origins still refused), a real POST carries the headers into the route, and `scripts/stripe/checkoutTest.mjs` (no-cost order, blank-card policy) PASSED end to end — session `cs_test_a1c3gZvf…`, device `mdoom-step6-mtt2frc5`: the return navigation landed on `https://minesofdoom.pages.dev/?iap=success…` AND the page asserted as the app (its persistent "hold to mine" canvas caption — `document.title` is unusable, the RN-Web runtime clears it after the static load), the session reached `complete`/`paid`, and the webhook + redirect legs granted one idempotent row. The probe itself had a pre-migration blind spot (success/cancel URLs pointed at the Pocketbase domain, so its "return navigation" never landed on the app; it now uses `WEB_BASE` = the app origin, asserts the app by that caption, and closes page-then-browser so a still-loading return navigation can't crash node with exit 1 after the PASS printout).

  (Third 2026-09-08 todo — custom numeric keypad default for web — is FIXED in code: the `onScreenKeypad` `useLocalStorage` default is now `Platform.OS !== "web"` (web users start on the OS keyboard, no numpad strip; native keeps the numpad; the user's saved setting still wins) + the input-layer doc updated in `docs/features.md` §1 (the Equations bullet now states the per-platform first-launch default).)
- [ ] have the menu modal (settings/save/account/etc.) take up whole screen

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
  - Pass 14 done 2026-09-13 (the localization / i18n layer — every word
    the player reads; the machinery is built, key-parity-tested, and
    deliberately disabled since commit 62ff419). Candidates documented,
    nothing implemented: an es-ES store listing (no app code — the first
    slice; Play CLI already supports `set-listing --lang`), re-enabling the
    language picker behind a four-item checklist (share-badge pixel font
    has no accented glyphs — es names would render as spaces; legal doc
    bodies are English-only; pseudo-locale CI pass for text overflow; the
    picker + one persisted preference), and locale-aware number/duration
    formatting (pass 8's `num:notation` successor, Hermes Intl smoke test
    first). All not planned — trigger-gated on es-market signal per the
    pass-11/12 discipline.
  - Pass 15 done 2026-09-15 (the math / difficulty layer — what the player
    is actually solving; the layer passes 3–14 never audited; all in
    `docs/features.md`). Live audit findings: the pending-gain readout
    (`EquationDisplay`) understates the real payout by a factor of the
    answer's value (the engine pays answer × op-premium × …; the display
    shows the answer-independent base with no copy hint), and the default
    `[0, 12)` range makes zero a legal operand (~16 % of the default × pool
    is answer-0 equations paying the ×1 floor; division is immune by
    construction). Candidates documented, **not implemented**:
    `math:pending-gain` (honest readout — the display already receives the
    full equation, so the exact gain is computable), `math:zero-operand`
    (generator fix; floor the default range, no migration), `math:mastery`
    (per-type fact-table view + suggested next step — the cheap half of the
    pass-4 adaptive item), `math:adaptive` (the pass-4 per-type mastery
    tiers, now anchored by Chen 2006's wider-flow-channel thesis + Bardy
    2021's feature-level differentiation — up-steps only, player range as
    ceiling), and `math:ladder` (narrate the 2-term → missing → 3-term
    automaticity ladder; overlaps `math:adaptive` — adopt at most one,
    whichever the free-path benchmark can verify). Rejected, with reasons:
    reviving timed/speed modes (deliberately removed; a timer is the
    flow-anxiety corner for a 13+ casual audience), "improves arithmetic"
    marketing claims (Tokac 2019 JCAL meta-analysis: small, marginally
    significant, heterogeneous — the math verb stays engagement, not
    pedagogy; consistent with the S6 13+ entertainment posture),
    personalizing the daily equation's difficulty (breaks the fairness /
    identity property), and down-stepping DDA (punishes the combo-reset
    miss). All candidates trigger-gated, per the pass-11/12 discipline.
    Pass 15 completes the layer sweep — passes 3–15 now cover input, locale,
    session, platform, stability, and the math layer; the next pass (if
    the task continues) would audit a new axis, e.g. the cosmetic / skin
    economy (never audit-passed as a system) or the offline/absence math.
  - Pass 16 done 2026-09-15 (the cosmetics / skin economy layer — the one
    axis passes 1–15 never audited as a system; all in `docs/features.md`).
    Live audit findings: cosmetics are the only gem sink with no payback
    (every other gem sink pays back in minerals); the catalog is static —
    25 paid items / 1,675 💎 total, no rarity, no rotation, no
    collection-progress UI, no completion achievement (full collection is
    ≤ a 30-day free run's 1,946 💎 gross, and the balance test pins only
    gross-earnings affordability, not competition with the functional
    sinks); zero inter-player sightlines (share badge draws a hardcoded
    generic pickaxe, leaderboard rows have no avatar — the player's own
    roster is the only audience); `analytics.ts` has no per-cosmetic
    granularity (guardrail 5 can't attribute revenue to a line); stale
    "26 products" count in the Stripe sync comment + store-integration §2
    header (code + table are 25 packs). Candidates documented, **not
    implemented**: `cosmetics:analytics` (per-purchase line/item/path
    events — precondition for every other trigger), `cosmetics:collection`
    (per-line owned counts + earnable completion reward),
    `cosmetics:visibility` (owned pickaxe on the share badge first — the
    sprite pipeline exists; leaderboard avatar only if the badge leg shows
    demand), `cosmetics:ceiling` (higher-cost theme tier or display-only
    featured rotation; re-run the guardrail-1 benchmark + §2 SKU
    regeneration). Rejected, with reasons: gem packs / direct currency
    IAP (breaks what the guardrail-1 benchmark measures; monetization-
    model change, not a candidate), gacha/lootbox cosmetics (odds-disclosure
    territory, dark pattern, against guardrail 4), cosmetics with
    mechanical effects (stay zero-power; pickaxe `feel` is feedback, never
    payout), and paid rerolls (self-expression is not a grind; paying for
    a random look is the dark pattern guardrail 3 forbids). All candidates
    trigger-gated, per the pass-11/12 discipline; the next pass (if the
    task continues) would audit a new axis, e.g. the offline/absence math
    (the other axis Pass 15 named).

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
