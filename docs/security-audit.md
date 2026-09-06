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
|---|----------|---------|--------|
| S1 | Medium | Session tokens / password salts / account ids minted from `Math.random` (a PRNG, not a CSPRNG) | **Fixed** (this iteration) |
| S2 | Low | Stripe webhook is unauthenticated and not per-request rate-limited | Open — hardening |
| S3 | Low | Email/password hashed with single-iteration SHA-256 (no KDF) | **Fixed** (this iteration) |
| S4 | Compliance | No discoverable privacy policy (GDPR / store listing) | Open — must add before/for ship |
| S5 | Info | Device-scope GDPR delete intentionally keeps entitlements | Accepted trade-off |
| S6 | Compliance | Kid-safety / age-rating check for the rewarded-ads model | Open — verify rating + ad settings |

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
+ shape/length + non-constant across calls), and the handler test mock now
mirrors the real `$security`. Full suite: 801 tests green.

**Residual.** None in practice — current Pocketbase ships
`randomStringWithAlphabet`. The fallback is defense-in-depth only.

### S2 — Stripe webhook: unauthenticated, not per-request rate-limited  ·  Low

`POST /api/app/stripe/webhook` does **not** verify Stripe's `Stripe-Signature`
HMAC (goja cannot re-read the raw request body to compute the HMAC — a real
runtime constraint, documented inline), and it applies **no per-request rate
limit** (it dedupes on the *event id*, which only stops exact replays, not a
flood of unique ids). Consequence: an attacker can POST arbitrary
`{ id, data.object:{ id, metadata:{...} } }` bodies, and each **unique** id
triggers one server→Stripe API lookup (an outbound HTTPS call using the secret
key).

Why it is Low, not higher: a forged event **cannot mint** — `verifyPurchase`
calls the Stripe API with the secret key, and a fake session id is not `paid`,
so it returns 400. There is no monetary loss, no data write on a bad verdict,
and Stripe-side rate limits bound abuse. The cost is a DoS-ish burst of
outbound API calls (and noise) under a targeted attack.

Recommendation (pick one, in order of preference):
1. **Move receipt to the sidecar.** The sidecar already holds the secret key and
   can read the raw body, so it can verify `Stripe-Signature` properly and then
   call Pocketbase to mint. This is the clean fix and matches how the other
   platforms are verified.
2. **Coarse rate limit** the webhook route (e.g. a small per-minute counter, or
   rate-limit at the reverse proxy in front of Pocketbase) so a flood can't
   translate into unbounded sidecar calls.

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

### S4 — No discoverable privacy policy  ·  Compliance (must do before/for ship)

The app now collects real personal data: an account (email, optional password,
Google/Apple id), cloud saves, and leaderboard entries, plus a GDPR **delete**
endpoint. There is **no privacy policy** anywhere (searched `*.md`,
`app.config.ts`, the web template, and the native manifest). A GDPR delete
endpoint that has no policy describing what is collected and why is a compliance
gap, and the Play Console / App Store listings require a privacy policy link.

Action: publish a privacy policy (what is collected: email, optional password,
provider id, deviceId, save blobs, leaderboard; why: account/progress/leaderboard;
retention + the delete endpoint; ads: rewarded-only AdMob + web AdSense and the
kid-safety setting). Link it from the in-app settings/about sheet and from both
store listings. This is a content task, not a code task, but it gates ship.

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

---

## Follow-up checklist

- [x] S1 — CSPRNG for session tokens / salts / account ids (done, tested).
- [ ] S4 — Write + link a privacy policy (in-app + Play + App Store). **Blocks ship.**
- [ ] S2 — Verify `Stripe-Signature` in the sidecar (preferred) or add a rate limit.
- [x] S3 — Password hashing upgraded to a 100k-round iterated-SHA-256 KDF (transparent on-login upgrade of legacy rows). Done + tested.
- [ ] S6 — Confirm age rating + `TAG_FOR_CHILD_DIRECTED_TREATMENT` for the rewarded-ads model.
- [ ] S5 — None (accepted).
