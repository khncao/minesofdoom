# Security & compliance audit

Audit of the backend (`pb_hooks/` + `pb_hooks/sidecar/`) and the client
(`src/mines_of_doom/`) for the "security & compliance audit" item in
`docs/todo.md`. Scope: account/auth, IAP entitlement minting, cloud saves,
leaderboard, GDPR, ads, and secrets-in-bundle. Method: code review of every
`/api/app/*` handler and the verify sidecar, plus targeted searches (secrets,
XSS sinks) and verification of the Pocketbase goja `$security` API surface
against the official docs.

This is a review, not a pentest. No external attacker traffic was used.

## TL;DR

The system is unusually well-built for a game backend: verification is
**fail-closed** everywhere (an entitlement mints only when the store API says
`valid: true`), all data is device-scoped on **private** Pocketbase
collections, writes are budgeted, and the client bundle carries **no** store
credentials. Two findings were **fixed this iteration** (S1 — CSPRNG for
session tokens/salts/ids; S3 — a KDF for password hashing). The remaining
findings are low-severity hardening (S2) and compliance (S4 privacy policy,
S6 kid-safety) items.

| # | Severity | Finding | Status |
| --- | ---------- | --------- | -------- |
| S1 | Medium | Session tokens / password salts / account ids minted from `Math.random` (a PRNG, not a CSPRNG) | **Fixed** (this iteration) |
| S2 | Low | Stripe webhook is unauthenticated and not per-request rate-limited | **Fixed** (this iteration) |
| S3 | Low | Email/password hashed with single-iteration SHA-256 (no KDF) | **Fixed** (this iteration) |
| S4 | Compliance | No discoverable privacy policy (GDPR / store listing) | **Fixed** (this iteration — listing links are the external step) |
| S5 | Info | Device-scope GDPR delete intentionally keeps entitlements | Accepted trade-off |
| S6 | Compliance | Kid-safety / age-rating check for the rewarded-ads model | **DECIDED 2026-09-08: teen+ (13+) positioning, not child-directed** — `tagForChildDirectedTreatment` stays `false` (consistent, storeConfig.test.ts pins it). Remaining: the manual Play/App Store questionnaire steps at pre-production (listing minimum-age 13+, no "designed for families" opt-in, marketing kept off under-13s) |

---

## What was checked and is sound

- **No secrets in the client bundle.** `sk_`/`sk_test_`/private-key/service-account
  JSON do not appear in `src/` or `app.config.ts`. The only Stripe key shipped is
  the **publishable** (`pk_`) key, which is public by design (it only opens
  Checkout; it can not refund/charge). `GOOGLE_CLIENT_ID` appears only in comments
  and tests (the audience pin the sidecar enforces) — it is not a secret.
- **Fail-closed IAP verification.** Each platform mints only on a store-API
  verdict: Play (`purchaseState === 0` **and** `productIds` includes the SKU,
  which is also pinned in the lookup URL), Apple (full JWS verify — ES256
  signature, x5c chain link-by-link, leaf signature, and the root must match one
  of Apple's `/oauth/certificates`; plus `environment`, `transactionReason === 1`,
  not revoked, not future-dated), Stripe (session `paid` via the API with the
  secret key, product matches the catalog, device binding). An unconfigured
  sidecar or a failed lookup refuses — there is no "verify skipped" path.
- **No XSS sinks.** `dangerouslySetInnerHTML`, `innerHTML`, `eval`, and
  `new Function` are absent from `src/`. User-controlled strings (e.g. the
  leaderboard display name) render through React Native `<Text>`, which does not
  parse HTML.
- **Session token never in plaintext storage.** Native → OS Keychain/Keystore
  (`react-native-keychain`), web → `localStorage` (the standard web-session
  model, per-profile scoped), and it degrades to an in-memory store if either
  throws. It is deliberately never routed through AsyncStorage.
- **Device id is a key, not a secret** (`iapDeviceId.ts`): a timestamp prefix +
  random tail, stored in AsyncStorage. Forging one only scopes an attacker to
  their *own* data; store tokens (not the device id) are what prove ownership of
  an entitlement.
- **Private, device-scoped collections** + **write budgets** (a per-device
  counter in the `events` collection) cap write amplification. Account-merge /
  link logic is written to "never steal/merge" a wrong account (union of
  entitlements, never overwrite a live provider row).
- **GDPR delete** exists at both device scope and account (session) scope.

---

## Findings

### S1 — CSPRNG for session tokens / salts / account ids  ·  **FIXED**

`logic.randomHex()` defaulted to `Math.random`, and the Pocketbase handlers used
it for the three security-critical randoms: the **session token** (the account's
only secret — a stolen/known token *is* the account), the **password salt**, and
the **account id**. `Math.random` is a PRNG, not a CSPRNG, and in the pooled goja
runtime its seed is not guaranteed unique per request, so these were not
derived from vetted, per-call randomness.

**Fix (this iteration).** `handlerLib.js` now mints these via
`$security.randomStringWithAlphabet(n, "0123456789abcdef")` — Pocketbase's
`tools/security` helper, which is **`crypto/rand`-backed** — through a new
`secureRandomHex(byteCount)` helper. Output shape is unchanged (2·n lowercase
hex chars), so it is a drop-in for the existing call sites (session token
32→64, salt 16→32, account id 16→32). If a runtime ever lacks
`randomStringWithAlphabet`, it falls back to the previous `logic.randomHex`
behavior — strictly an improvement, never a regression.

Verified: `pb_hooks/__test__/secureRandom.test.js` (CSPRNG path + fallback path
- shape/length + non-constant across calls), and the handler test mock now
mirrors the real `$security`. Full suite: 801 tests green.

**Residual.** None in practice — current Pocketbase ships
`randomStringWithAlphabet`. The fallback is defense-in-depth only.

### S2 — Stripe webhook: unauthenticated, not per-request rate-limited  ·  **FIXED**

`POST /api/app/stripe/webhook` did **not** verify Stripe's `Stripe-Signature`
HMAC (goja cannot re-read the raw request body to compute the HMAC — a real
runtime constraint, documented inline), and it applied **no per-request rate
limit** (it dedupes on the *event id*, which only stops exact replays, not a
flood of unique ids). Consequence: an attacker could POST arbitrary
`{ id, data.object:{ id, metadata:{...} } }` bodies, and each **unique** id
triggered one server→Stripe API lookup (an outbound HTTPS call using the secret
key).

Why it was Low, not higher: a forged event **cannot mint** — `verifyPurchase`
calls the Stripe API with the secret key, and a fake session id is not `paid`,
so it returns 400. There is no monetary loss, no data write on a bad verdict,
and Stripe-side rate limits bound abuse. The cost was a DoS-ish burst of
outbound API calls (and noise) under a targeted attack.

**Fix (this iteration) — recommendation 1 (move receipt to the sidecar).**
Stripe now delivers `checkout.session.completed` to the sidecar's
`POST /stripe/webhook` (Caddy fronts the public Pocketbase URL at that path),
and the sidecar is the one place in the system that still holds the **raw
body**, so it verifies `Stripe-Signature` there: HMAC-SHA256 over
`<t>.<raw payload>`, every `v1` entry tried with a constant-time compare, the
timestamp within ±5 minutes (replay protection) —
`verifyStripeWebhookSignature` in `sidecar/verify.js`. Only then does it
forward the untouched bytes to Pocketbase's `/api/app/stripe/webhook`, and
that route now requires the `MDOOM_SIDECAR_SECRET` shared key in
`x-mdoom-key` (403 without it, when the secret is configured — so an unsigned
flood dies at the Caddy/sidecar boundary, and even a direct hit on
Pocketbase 403s before the dedup row). Both gates fail closed: the sidecar
route refuses everything while `STRIPE_WEBHOOK_SECRET` or `MDOOM_PB_URL` is
unconfigured. A bad signature is a 400 and is never forwarded and never
recorded, so Stripe's own retries re-deliver a legitimately signed event if
the cause is transient.

Verified: `__test__/stripeWebhookSignature.test.js` (HMAC accept/tamper/wrong-
secret, missing header/timestamp, tolerance window, multi-`v1` headers) and
`__test__/sidecarWebhookRoute.test.js` (the live HTTP route against a scripted
fake Pocketbase: unconfigured refuses, bad signature refuses + never
forwards, valid signature forwards the exact bytes with the shared key,
upstream 2xx/4xx/5xx pass-through). The Pocketbase-side
`handlerStripeWebhook.test.js` covers the `x-mdoom-key` gate (configured
secret: missing/wrong key → 403 before anything else).

### S3 — Password hashing was single-iteration SHA-256 (no KDF)  ·  **FIXED**

Email/password was stored as `sha256:<salt>:sha256(salt + ":" + password)` —
salted, but **one** SHA-256 round, not a KDF. If the `accounts` collection
leaked, hashes would be GPU-crackable. This is now Low-severity context (the
protected data is game progress, not high-sensitivity PII, and login is
optional — Google/Apple OAuth don't touch this hash), but it is fixed.

**Fix (this iteration).** `logic.js` now uses an **iterated-SHA-256 KDF**:
`kdfSha256` runs 100,000 rounds (`h = sha256(salt:pw)`, then
`h = sha256(h:pw)` ×99,999), stored as
`pbkdf2-sha256:<iterations>:<salt>:<hash>`. A single-iteration SHA-256 is now a
100,000×-slower digest to brute-force while staying entirely in the goja
runtime — which is why a simple stretch (not memory-hard Argon2/scrypt, which
goja's `$security` does not expose) is the right in-runtime choice. `hashPassword`
produces the new format for all new passwords (register / set-password). For
existing rows, `verifyPassword` still accepts the legacy `sha256:` form, and
`handleAuthLogin` **transparently re-hashes to the KDF on the next successful
login** (same salt, no user action, no lockout) — so no migration is required.

Verified: `logic.test.js` (KDF round-trip, wrong-password, determinism /
iteration- and salt-sensitivity, 1-iteration == plain sha256, legacy still
verifies + `passwordNeedsUpgrade` flag, malformed never verifies). Full suite:
803 tests green.

**Residual.** Argon2/scrypt (memory-hard) is strictly better than an iterated
hash, but is not available in the goja runtime; if a stronger KDF is ever
required, move email/password to the sidecar (`node:crypto` `scrypt`). The
stored iteration count allows raising the work factor later without migration.

### S4 — No discoverable privacy policy  ·  **FIXED** (Compliance)

The app now collects real personal data: an account (email, optional password,
Google/Apple id), cloud saves, and leaderboard entries, plus a GDPR **delete**
endpoint. There was **no privacy policy** anywhere (searched `*.md`,
`app.config.ts`, the web template, and the native manifest). A GDPR delete
endpoint that has no policy describing what is collected and why is a compliance
gap, and the Play Console / App Store listings require a privacy policy link.

**Fix (this iteration).** `src/mines_of_doom/legal.ts` is the single source of
truth for both documents — a v2.0 Privacy Policy (local data, accounts + cloud
sync, what is NOT collected, IAP, the rewarded-only/AdSense ad model, children,
deletion, changes, contact) and a matching v2.0 Terms of Use — rendered in-app
(Settings, with the Spanish i18n table in `src/utils/i18n/content-es.ts` kept
key-pinned to the English by `content.test.ts`). The published store-listing
copies are generated, not hand-maintained: `legalDocs.test.ts` renders the same
modules into `public/privacy-policy.html` + `public/terms-of-use.html` on every
`npm test`, so the URLs
(`…/minesofdoom/privacy-policy.html` and `…/terms-of-use.html`, served by the
static web export) can never drift from the in-app text. **Remaining external
step:** paste those two URLs into the Play Console / App Store privacy fields
(check `docs/store-integration.md` §2.6 / §3). This is a content task, not a code task, but it gates ship.

### S5 — Device-scope delete keeps entitlements  ·  Accepted trade-off

The **device-scope** GDPR delete removes cloud saves + leaderboard + events but
intentionally **keeps** `entitlements` (so a purchase is not lost and can still
be restored); the **account-scope** (signed-in) delete removes entitlements too.
This is a reasonable and documented choice (a "delete my data" from an
unsigned-in device should not destroy a real purchase). No action needed; noted
for the record so it isn't later "fixed" into deleting purchases.

### S6 — Kid-safety / age rating for the rewarded-ads model  ·  Verify before ship

Ads are **rewarded-only** (guardrail 2) — no banners or interstitials — and the
Android AdMob App ID is set while the iOS one is still empty. The web AdSense
banner is shop-sheet-only, labeled, and gated behind explicit config. Because a
math idle game skews young, confirm for the chosen age rating:

- The Play App Content rating and App Store age rating.
- Whether the AdMob SDK's `TAG_FOR_CHILD_DIRECTED_TREATMENT` flag should be set
  for that rating (guarded by the platform's policy on child-directed ads).
- That no ads request IDFA/ads-id in a way that conflicts with the rating.
This is a configuration/verification step against the live store setup, not a
code change.

**2026-09-08 store check (iteration 8):** the app has no production
release (internal track 1.0.8 only — the public Play Store page 404s),
so there is no published age rating to verify yet. Play Developer API v3
no longer exposes content ratings (the top-level app endpoint returns
404 and `edits.details` carries no rating field), so setting the rating
remains a Play Console UI step — the "App content rating" questionnaire,
done before the first production release. The rating choice itself is now
a COPPA question: the FTC's 2025 final rule (compliance deadline
2026-04-22) is in full effect — kid-directed rating ⇒ verifiable
parental consent before data collection + a separate consent for
third-party ads + a scheduled retention policy in the privacy notice.
See `docs/features.md` §7 "Compliance (pass 6)" for the two viable
paths (kid-directed + consent gate vs teen rating + the device-scoped
anonymous model).

**DECISION (2026-09-08, iteration 9): option (b) — teen+ (13+) positioning.**
The app is positioned as **not child-directed**: `tagForChildDirectedTreatment`
**stays `false`** (already the shipped value; `storeConfig.test.ts` pins it,
and the `storeConfig.ts` comment now records the decision). Rationale:

- **Cost asymmetry.** Under COPPA 2025 (in full effect), option (a)
  (kid-directed) makes a **launch** requirement of a verifiable-parental-
  consent gate *before data collection*, a **separate** third-party-ad
  consent, and a **scheduled-retention** clause in the privacy notice
  (v2.0 is GDPR-shaped: deletion on request, no retention schedule).
  None of that exists; building it before a first release is a large, no
  production-player feedback loop.
- **Architecture fit.** Option (b) is the device-scoped anonymous model —
  local save by default, opt-in account, local-only analytics, rewarded-
  only ads with player-initiated "watch" taps — which is exactly what the
  app already does. The compliance posture costs zero new surfaces.
- **Content fit.** The math idle loop is age-neutral; the "Doom"
  branding is cartoonish. 13+ is a defensible floor without claiming a
  child audience we do not market to.

**Remaining (manual, pre-production — the rating decision above does NOT
remove these steps):**

1. Play Console, before the first production release: complete the
   "App content rating" questionnaire **honestly** (it is a content
   descriptor → IARC rating mapping; a clean-content app lands low, and
   that is the *content* rating — it is not the target-audience stance).
   The teen+ stance is carried by the listing's **minimum-age setting
   (13+)**, by **not** opting into any "designed for families" program,
   and by keeping all marketing away from under-13 audiences (COPPA
   2025's "directed to children" test explicitly weighs marketing and
   representations).
2. App Store (when iOS ships): the age-rating questionnaire likewise,
   minimum age 12+/13+ per App Store's scale, same no-families opt-in
   rule.
3. AdMob console: the **Ad Settings / child-directed** toggle per app —
   leave "Not child-directed" (consistent with the in-app flag; the two
   must agree, and Google reconciles the SDK flag against the console
   setting).
4. **Revisit trigger:** math idle skews young. COPPA 2025's "directed to
   children" test includes the age composition of users on similar sites.
   If first post-launch data (guardrail 5 event logging) shows heavy
   under-13 usage or a marketing channel skews under-13, option (a)
   becomes the honest posture and the parental-consent gate + retention
   schedule become required — the "Kids mode / parent screen" item in
   `docs/features.md` is where that work would land.

---

## Follow-up checklist

- [x] S1 — CSPRNG for session tokens / salts / account ids (done, tested).
- [x] S4 — Privacy policy v2.0 + terms v2.0 in-app (legal.ts, ES i18n synced) + generated published HTML. **Remaining: link the two URLs from the Play/App Store listings (external).**
- [x] S2 — Stripe delivery moves to the sidecar's `/stripe/webhook` (Stripe-Signature over the raw body) + the Pocketbase route is gated on the shared key.
- [x] S3 — Password hashing upgraded to a 100k-round iterated-SHA-256 KDF (transparent on-login upgrade of legacy rows). Done + tested.
- [o] S6 — **Decided 2026-09-08: teen+ (13+) positioning, not child-directed**; `TAG_FOR_CHILD_DIRECTED_TREATMENT` = `false` (shipped value, test-pinned, decision recorded in `storeConfig.ts`). Remaining manual pre-production steps (Play Console questionnaire + listing minimum-age 13+ + no families opt-in, App Store equivalent, AdMob console "Not child-directed") are listed in the S6 section above; revisit trigger if under-13 usage skews high post-launch.
- [ ] S5 — None (accepted).
