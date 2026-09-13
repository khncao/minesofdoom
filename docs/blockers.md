# Blockers

Work that cannot proceed in this repo without a decision or an external
action. The `docs/todo.md` in-repo queue is now empty (2026-09-08), so the
sections below are standalone — when one unblocks, delete its section.

## Web sign-in 400 `origin_mismatch` + orphaned API base (2026-09-13)

**Symptom:** web Google sign-in fails with `Error 400: origin_mismatch` (GSI,
`GeneralOAuthFlow`), and — once GSI can mint a token at all — the
round-trip POST to `/api/app/auth/google` dies on a failed CORS preflight.

**Root cause (verified live 2026-09-13):** `minesofdoom.minus4kelvin.com`
is now a **Cloudflare Pages custom domain** (DNS → CF anycast, the game
SPA at `/`) — attached for the Play-listing account-deletion page
(`public/account-deletion.html`). That **shadows the servarica VPS Caddy
host that used to front Pocketbase at the same hostname**: `OPTIONS
/api/app/auth/*` → 405 (SPA fallback, no preflight), `GET` → 200 **HTML**.
So the game works on both origins
(`minesofdoom.pages.dev` + `minesofdoom.minus4kelvin.com`) but the
backend is unreachable from every client that points at
`storeConfig.pocketbaseUrl` — which is still the old hostname (web **and
native** cloud login / leaderboard / IAP verify are all dead until this is
resolved). `pb_hooks` + sidecar are presumed still running on the VPS,
just no longer addressed by the hostname.

**Two external fixes needed (decision: which hostname does the API get):**
1. **Google Cloud Console** (fixes the 400, independent of #2):
   Credentials → the **Web application** client
   `94426274846-7vsqc2habc84b0upion6clsdnl5cqj1f…` →
   **Authorized JavaScript origins**: add `https://minesofdoom.pages.dev`,
   `https://minesofdoom.minus4kelvin.com`, `http://localhost:8081`
   (no redirect URIs needed — the GSI ID client uses no redirect).
   Verify with `node scripts/gsiOriginProbe.mjs <origin>` (default:
   the minus4kelvin.com origin; pre-fix verdict on it: NOT AUTHORIZED,
   FedCM `NetworkError`, no popup). Note the old probe target was
   pages.dev-only; the script now takes the origin as argv[1].
2. **API hostname** (fixes the CORS/preflight death, the deeper break):
   - Option A (recommended, least churn): give Pocketbase its own
     hostname — CF DNS `pb.minesofdoom.minus4kelvin.com` → VPS IP (or
     proxied) + Caddy host on the VPS fronting Pocketbase — then flip
     `storeConfig.pocketbaseUrl` to it. PB already answers
     `access-control-allow-origin: *`, so CORS from both game origins is
     fine as-is. Update `pb_hooks/README.md` deployment notes + the
     pinned-URL tests when it lands.
   - Option B: drop the Pages custom domain and have the VPS Caddy serve
     BOTH the exported `dist/` (static + SPA fallback) and PB at `/api`
     — single origin again, `storeConfig` unchanged, but the Pages
     custom-domain setup (the clean account-deletion URL) is lost.

**In-repo state:** `scripts/gsiOriginProbe.mjs` retargeted to the
production origin (argv-overridable) + the NOT-AUTHORIZED verdict now
prints the console fix. No client code changes needed for either option —
the 400 and the preflight are pure origin/config issues.

**Verify when done:** probe exits 0 (popup reaches
accounts.google.com) on the origin(s) the game runs from, and
`curl -X OPTIONS <pb>/api/app/auth/me` with `Origin:
https://minesofdoom.pages.dev` → 2xx + `access-control-allow-*` (and
`/api/health` returns Pocketbase JSON, not the game HTML). Then a manual
web sign-in round-trip (or `E2E_LIVE_GSI=1 npx playwright test
signin`), since the hermetic stub can't see either of these failures.

**RESOLVED (API/origin half) 2026-09-17** — the user removed the Cloudflare
Pages custom-domain CNAME on `minesofdoom` and added an A record pointing
at the servarica VPS, restoring the Caddy→Pocketbase front. The whole
exported web build now ships from Pocketbase's `pb_public/` static dir
(sibling of `pb_data`, mounted `./pb_public:/pb/pb_public` in the VPS
compose) — single origin: `/` serves the game SPA, `/api/*` the API,
`/privacy-policy.html` etc. the legal pages (verified live: SPA 200,
`/api/health` JSON, `OPTIONS` preflight 204, legal pages 200). In-repo:
`PROD_WEB_DOMAIN` → `minesofdoom.minus4kelvin.com` (environment.ts),
`+html.tsx` canonical/OG → the new origin, robots/sitemap retargeted,
pb_hooks README "Static pages" section documents the deploy. **Deploy
implication:** `pnpm run deploy` (CF Pages) no longer controls the
production origin — after `expo export -p web`, push `dist/` into the
VPS `pb_public/`. **STILL OPEN:** item #1 (Google Cloud Console — add
the origins to the GSI client's Authorized JavaScript origins; the
`origin_mismatch` 400 persists until that console change lands).

## IAP (on-device purchase leg) — `todo.md` "IAP — on-device purchase leg (license tester)"

**Remaining external items:** (1) the iOS `APPLE_*` App Store Connect
API key for the sidecar (`docs/backlog.md`, iOS section), and (2) the Stripe **`sk_live` flip at launch — IN FLIGHT
(2026-09-11)**: done = the live price map in `stripeProd.prices`
(commit `4ff4f45`), the live webhook endpoint rotated to `we_1UEbw0…`
(the first endpoint's one-time `whsec_` was unrecoverable) and the VPS
sidecar env flipped live (`STRIPE_SECRET_KEY=sk_live_…` + live whsec +
the live `MDOOM_STRIPE_PRICE_MAP`; backup
`~/docker/pocketbase/.env.bak-preliveflip-20260911`; sidecar /healthz
all green, unsigned webhook POSTs → 400). `verify --live` agrees on the
price map; its only finding is the unfilled publishable key. Left =
paste the `pk_live_…` key (dashboard-only — NOT API-readable: the API
dropped the account `keys` field, so it can't be fetched; Stripe
dashboard → Developers → API keys → live mode) into
`stripeProd.publishableKey` + `pnpm run deploy` (needs `npx wrangler
login` first), then `verify --live` exit 0. (The step-6 test purchase
is **done 2026-09-08**: `scripts/stripe/checkoutTest.mjs` confirmed the
redirect grant + the webhook's idempotent backup mint for the same
(device, product) row via a no-cost hosted-Checkout order.) The
`packSkin` leg is **LANDED 2026-09-10** — both external halves: the
Stripe test price (`syncStripe.mjs products` created
`prod_VEghKLcgCPNKkB` / `price_1UEDJqDPxWoXhXF8WYfaEDSe`, pasted into
storeConfig.ts, `verify` 26/26 clean) and the pack_skin **Play Billing
SKU** (`create-product --sku=pack_skin --price=3.99 --auto-convert-prices`,
`products-check` 27/27 clean — the §2.1 table row added the same day).
What remains on the in-repo queue (`docs/todo.md`) is the native image/
audio picker + prebuild and the ad-hoc/e2e re-runs — neither blocks a
purchase: pack_skin checkouts work on web now, and the native path needs
the on-device picker before a tester can complete it on an emulator. The web
Stripe + AdSense console side that used to sit here has LANDED: Stripe
test mode is fully configured (`syncStripe.mjs products` + `webhook`,
sidecar `/healthz` → `configured.web: true` +
`stripeWebhook: {signature: true, pocketbase: true}`, 2026-09-08) and the
AdSense client is in `storeConfig.ts` (`ca-pub-…`) — the banner slot
shipped as the rewarded "Ad Placement API" instead of a banner (the
`checkout.session.completed` webhook at
`https://minesofdoom.minus4kelvin.com/stripe/webhook` is routed live to
the sidecar since 2026-09-06, Caddy `@stripe_webhook` matcher). The §4
purchase leg is **no longer blocked** (license tester registered
2026-09-06, purchase confirmed on the dev build). The 26 Play products are live and
ACTIVE (`products-check` clean), the Android Play credentials are on the
sidecar (`/healthz` → `configured.android: true`), and a release AAB
(1.0.8) sits on the internal track. The Pocketbase deployment itself is
DONE (below).

**Done in-repo:** the full client half, mirroring the ads pattern —
`iapProvider.ts` (expo-iap → `finishTransaction` → POST `/api/app/verify`,
restore via `/api/app/restore`, local re-verify queue so a flaky network
never loses a completed purchase), `iapProvider.web.ts` (**real** Stripe
Checkout provider for web — hosted redirect, `grantsLocally: false`, the
pending-verify queue, the `?iap=success` reconcile; the web no-op is what
it falls back to until the Stripe block is configured), `iapDeviceId.ts`
(device-scoped key, never in the save), the pure `pickIapProvider` swap in
`iaps.ts`, jest
mocks for `expo-iap` + AsyncStorage, and tests (provider matrix, device-id
factory, selection matrix, the web Stripe provider matrix). Until the
Pocketbase URL lands, `selectIapProvider` returns the no-op on production
native (panel hidden) — pinned by `iaps.test.ts` / `iapProvider.test.ts`.

**Server half (this iteration):** `pb_hooks/` is complete and
**verified end-to-end against a real Pocketbase v0.40.2 binary** in a
local sandbox (fake-token mode — the full curl matrix in
`pb_hooks/README.md` passes: IAP verify/restore, cloud LWW push/pull,
monotonic leaderboard merge + top/rank, the 30-write/hour durable budget
429-ing on the 31st write, GDPR delete with entitlements surviving). The
deploy + URL are DONE (see "Deployment status" below); the Android store
credentials are on the sidecar, the iOS `APPLE_*` are the only remaining
credential gap. Note the v0.40 hooks API is a major
rewrite from v0.2x (pooled handler VMs, sync-only, self-contained
handlers) — see the "v0.40 hook model" section in `pb_hooks/README.md`
before editing that folder.

- **Store-verification sidecar (the signing-gap decision, in-repo):**
  `pb_hooks/sidecar/` — zero-dependency Node ≥18 process that signs the
  RS256/ES256 JWTs the goja runtime can't and makes the two store
  round-trips (Play publisher API: `purchaseState===0` on the pinned SKU;
  Apple App Store Server: transaction lookup with the
  `signedTransactionInfo` JWS verified against `/oauth/certificates`
  fetched in the same call). `storeVerify.js` gains a middle mode:
  `MDOOM_SIDECAR_URL` set → POST via `$http` (the v0.40 `$http` contract
  is pinned by probing + `storeVerify.test.js`), mint only on `2xx` +
  `valid:true`; unset → fail closed as before. Per-platform credentials
  live in the sidecar's env (`PLAY_SERVICE_ACCOUNT_JSON`, `APPLE_*`);
  an unconfigured platform refuses per-verify, never mints. Runs next to
  Pocketbase (env-var table in `pb_hooks/README.md`); the credentials
  themselves remain the External item above.

**Deployment status (done):** live Pocketbase v0.40.2 on the servarica
VPS (`~/docker/pocketbase`), Caddy TLS on
`https://minesofdoom.minus4kelvin.com`; `pb_hooks/` mounted read-only,
the sidecar container on the internal compose network, `MDOOM_SIDECAR_URL`
set, no fake-token flag (a public endpoint must never mint on fake
tokens). Smoke-tested live: restore/leaderboard/cloud serve; a fake
token is refused (fail closed). The sidecar carries the Android store
credentials (read-only `secrets/` mount → `PLAY_SERVICE_ACCOUNT_JSON`,
`/healthz` → `configured.android: true`); iOS/Google identity stay
fail-closed until those credentials exist. `storeConfig.pocketbaseUrl` is
set and pinned by `storeConfig.test.ts`; the `iaps.test.ts` live pin now
expects the store provider.

**Unblocks when:** the iOS key lands (sidecar `/healthz` →
`configured.ios: true`) and the Stripe step-6 test-card purchase passes.
The Android purchase leg itself is DONE (below) — INCLUDING the wipe leg
(resolved 2026-09-08, first progress note below).

**RESOLVED 2026-09-08 — the wipe leg PASSES.** The transient billing-
egress condition cleared on its own (no host-egress change was needed —
consistent with the "transient Google-edge anomaly" diagnosis below). On
`mines-play-35` with the 1.0.8 (c04e03b) debug APK: `pm clear` →
`maestro test maestro/adhoc/iap-wipe-verify.yaml` → the FULL leg is green:
cold start after the wipe, the production bundle (the two optional
"Real store billing" toggle steps WARN by design — the element is absent
in `__DEV__=false` builds), the store provider's launch `reconcileStore`
re-derives the entitlement **from the store record alone** (no local
rows survived the wipe), and the catalog scan finds the owned Gold
Pickaxe row ("Equip" button) within the 120 s window. The `todo.md`
on-device-verification item is now removed (done) — see git history.

**Progress (2026-09-06, PM, emulator billing network):** the purchase-leg
re-run for the wipe leg was then blocked by the emulator's network
state, not the app (resolved 2026-09-08 — see above): from ~15:30 on, `queryProductDetailsAsync` →
`Response code: 6` (SERVICE_UNAVAILABLE) and Finsky's monetization gRPC
logs `net::ERR_CONNECTION_REFUSED` — survived device reboot, wifi
toggle, and a full emulator restart (`-no-snapshot`), while plain
egress is fine (pings OK, the Play Store app page loads). The license
tester purchase worked on this AVD earlier the same day, so it's a
transient egress condition. Research (2026-09-06, DuckDuckGo sources):
code 6 is a documented TRANSIENT error (Google's own guidance: retry
with backoff; SO #78834570 + Adapty + RevenueCat all report bursts of
it in production, resolved by waiting); other documented causes are
Finsky service unavailability (issuetracker #309541595 — force-stop/
clear-cache `com.android.vending`) and stale emulator/host network
state. The signature here (ping + Play Store UI fine, ONLY the
monetization gRPC refused) matches a selective host-side egress filter
(VPN / AV network shield / corporate firewall) or a transient Google-
edge anomaly on the billing endpoint. Also checked 2026-09-06:
status.play.google.com shows **"No incidents"** (as of Sep 6 09:06 UTC),
so there is no declared Google-wide billing outage — pointing at an
IP-level edge anomaly or host egress. Tried `pm clear com.android.vending`
(full Finsky reset) — same failure immediately after, so Finsky cached
state is ruled out too. Remaining solutions, in order: (1) change host
egress IP — mobile hotspot or VPN (WSABuilds fix guide: Play-
connectivity failure on emulators resolved by routing through a VPN;
inverse applies if a VPN is currently ON — disable it), (2) wait hours
and retry — **this is what actually happened: the condition cleared by
itself and the full flow passed on 2026-09-08 without any host-egress
change**, (3) Windows stack reset (`ipconfig /flushdns`,
`netsh winsock reset` + reboot) if hotspot/VPN don't help, (4) physical
phone with the license tester (no extra setup). Also confirmed while investigating: launching via
`npx expo run:android` (Metro up) serves the **dev bundle**
(`__DEV__=true`), which selects the **labeled dev-sim provider** — the
panel shows "⚠️ Development build: purchases are simulated" and the
"purchase" resolves in ~1.5 s with **zero** ExpoIap/BillingClient
logcat lines (no Play Billing call at all). That's why IAP "works" in
dev-client launches; it does NOT exercise the wipe leg (dev-sim has no
store record, so `pm clear` genuinely loses the grant). Standalone
launch (no Metro) loads the embedded production bundle (`__DEV__=false`)
→ real store provider → the billing-network failure above. (2026-09-06 PM:
the build leg is done — a debug APK from c04e03b, which includes
reconcileStore, is installed on mines-play-35 and boot-smoke clean; the
wipe flow `maestro/adhoc/iap-wipe-verify.yaml` now asserts the full leg,
Owned re-derived after `pm clear`. Only the billing network is left.)

**Progress (2026-09-06, license tester):** the §4 external blocker is
gone — a Gmail is registered as a Play Console license tester on
`internal` (the UI-only action the v3 API can't do), and the purchase
leg works on the **dev build** on `mines-play-35`: sheet opens for the
real SKU, purchase completes, `/api/app/verify` mints the server
entitlement, the panel flips to Owned. The wipe → re-derive-from-store
verification of the 2026-09-06 persistence fix is an in-repo todo
(`docs/todo.md`), not blocked externally.

**Progress (2026-09-05, emulator API 35, historical):** on the
`google_apis_playstore` AVD (`mines-play-35`) with a Play Store account
signed in, the Buy → Play sheet fetches the sheet but failed with "The
item you were attempting to purchase could not be found" — diagnosed
as zero license testers on any track (SKUs/ACTIVE status ruled out via
`products-check` + SKU lookup). Resolved by the 2026-09-06 tester
registration above.

**Progress (2026-09-04, emulator):** the release-APK (upload-key) pass on
the Pixel 3a emulator confirmed the §4 pass does NOT need a phone — the
store sheet on the emulator fetches and lists all live Play products with
real prices (no Google account required for product retrieval), and the
web-bundle grep half of §4 is done (clean).

**Research note (2026-09-04):** the §4 pass does NOT require a
physical Android phone. Google's billing-test doc
(<https://developer.android.com/google/play/billing/test>) has no
emulator exclusion: a **license tester** account (Play Console →
Users and permissions → Testers) gets test cards that never charge
real money, test accounts may run on emulators, and license testers
may even sideload debug builds (package name must match). So the pass
runs on the Pixel 3a emulator (or any Play-Store-image AVD) once one
Gmail is added as a Play Console tester and signed into the
emulator's Play Store — or on a real phone, which needs no extra
setup. The iOS half is unchanged: StoreKit is real-phone-only.

(Decision log: the earlier "signing gap" item is resolved in-repo by the
sidecar above — option 1 of the three options that were on the table;
nothing left to decide there.)

## Store integrations (cloud saves, leaderboard, achievements) — `todo.md` "Store integrations"

**Decision recorded (was: the identity model):** **optional login,
anonymous device-based default.** The shipped device-scoped model
(`docs/store-integration.md`) stays exactly as-is for players who
don't sign in — it was never the wrong default, just incomplete scope;
login is additive, tracked as the "Optional login" item in `todo.md`.
Nothing in the deployed server/client design changes for non-signed-in
players; the `delete my data` endpoint and the reinstall caveats in the
settings copy are still drafted for the device model and are part of the
login scope (they gain an account target).

**Decision recorded (was: which login mechanism):** **all three —
email/password, Google sign-in, and Apple sign-in**, side by side in the
sign-in UI. Carried into the scope item in `todo.md`: email/password is
the GDPR-heaviest surface (password reset + verification flows; the
guardrail-6 age-rating planning applies to it specifically, and
`TAG_FOR_CHILD_DIRECTED_TREATMENT` if that's the resulting rating), and
with a third-party (Google) login present the iOS "Sign in with Apple"
requirement fires — it's offered anyway, so the rule holds by
construction. Accounts are provider-agnostic: any of the three
mechanisms creates or signs into the same account (email where it exists
is the shared identity). No further decision gates the scope — it is
in-repo work on top of the sandbox Pocketbase, startable now.

**Blocked on (external, shared):** the Pocketbase deployment itself — the
cloud/leaderboard endpoints land in the same container and `pb_hooks`
folder as the IAP ones, so their server phase starts exactly when the IAP
sandbox does. Client work (providers, UI, tests against scripted fetch) is
**not** blocked and can start in the sandbox.

**Progress (optional login):** the SERVER half is done and unit-tested —
the seven `auth/*` endpoints in `pb_hooks/` (provider-agnostic accounts:
the three mechanisms share one account, email where it exists the shared
identity; sign-in backfills `accountId` onto the device's existing rows so
nothing is lost or duplicated; GDPR delete gains the account target) plus
the sidecar's `POST /identity` route (Google RS256 / Apple ES256 against
the providers' published keys, with the same fake-token sandbox /
fail-closed modes as the store path). The CLIENT half now landed too:
`auth.ts` (the provider core: dev-sim in dev, no-op on web and until the
backend is configured, store provider against `pb_hooks` — the same
"hidden until configured" rule as the cloud entries), `secureToken.ts`
(react-native-keychain on native, in-memory on web — the token never
touches AsyncStorage), `useAccount` (session restore on launch, the claim
running best-effort after every sign-in), the settings account section
(sign in / create account with the single inline error, sign out, delete
switching to account scope when signed in), and the session threaded into
the cloud / leaderboard / IAP round-trips (device-scoped until a session
exists). The two native SDKs landed too (`signinSdks.ts`): Google via
`@react-native-google-signin/google-signin` (android + ios) and Apple
via `expo-apple-authentication` (ios) — one settings button per kind,
hidden-until-ready by platform, the SDK modules lazily required so web
never evaluates them; android prebuild done with the two
`build.gradle` patches re-applied.

**Device verification done (2026-09-05, release APK, emulator API 35):**
the Google half's last step was a **Web-application-type** OAuth client
id (the installed-type id made Play Services complete the sheet with no
idToken — the sidecar never saw a request). With the web id pinned in
`signinSdks.ts` (`GOOGLE_WEB_CLIENT_ID`) AND the sidecar's
`GOOGLE_CLIENT_ID` env set to the same value, rebuild + install + the
full optional-login pass is green on the emulator: **email/password**
(`maestro/adhoc/v10_login.yaml` — register first-run `v4_register.yaml`,
sign-out `v4b_signout.yaml`): signed-in branch, token in the OS keychain,
device linked, cloud backup "last sync" live; **Google**
(`maestro/adhoc/v9_google_signin.yaml`): OS account sheet → pick account
→ idToken → sidecar verify → signed-in branch (the idToken-missing
failure mode is gone — the session lands server-side). The Android OS
sheet needs a device Google account, which the verification AVD has;
a phone/AVD without one gets the honest single inline error, never a
faked sign-in. What remains is Apple only (the Sign in with Apple
capability, picked up by the iOS prebuild on macOS) — `docs/backlog.md`.
Nothing blocks release: anonymous play is the shipped default.

**Web sign-in is real now (todo "Add oauth2 login for web"):** web is no
longer exempt from the store provider — `pickAuthProvider` has no platform
in the rule anymore (fetch-only provider + the deployed Pocketbase answers
CORS with `access-control-allow-origin: *`, probed live 2026-09-06). The
session token lives in `window.localStorage` (`localTokenStore`, key
`com.minus4kelvin.minesofdoom.sessionToken`) with a per-call memory-store
degradation for the SSR/prerender pass and private-browsing throws; it
deliberately does NOT go through AsyncStorage. Web Google goes through
Google Identity Services (`mintGoogleIdTokenWeb`: lazy gsi/client script

- the openid-scope token client — the JWT in `resp.access_token` IS the
idToken; `popup_closed_by_user` → `SignInCancelledError`), web Apple does
not exist yet (needs a domain-verified service id — `docs/backlog.md`).
The OTHER store integrations (cloud save, leaderboard) remain web no-ops
by construction: a web session is real (sign in / sign out / account
delete all work against the same server) but tags nothing cloud-side until
those land. (Web IAP is now the REAL Stripe path, not a no-op — see the
IAP section and docs/store-integration.md §2.6; it reuses this same web
session token when present.) Server path live-verified against the
deployed Pocketbase (2026-09-08 probe, the exact fetch shape the web
client uses — `auth.ts` store provider): register → 200 + token +
account{email,providers}, login → 200, `/me` → 200, GDPR delete with
the session token → `{ok:true, deletedAccount:true}`, and a re-login
after the delete is refused 401 (probe account created AND deleted —
nothing lingers). The emulator pass above is native-only, and the
IN-BROWSER legs (the GIS Google button in a real browser; web Apple
doesn't exist yet — needs a domain-verified service id, `docs/backlog.md`)
still need a manual look, but the deployed server half that was in doubt
now answers the full round-trip.

**Sign-in e2e verification landed (2026-09-31):** the hermetic web e2e
covers the full web sign-in round-trip with a REAL RS256 signature
(`e2e/web/signin.spec.ts`): a GSI ID-client script stub delivers a
JWT signed with a per-run key pair, and the stub sidecar verifies
signature + iss + aud + exp exactly like production does — so the
production failure shape (sidecar 401 "malformed google token") is
regression-tested end to end, along with silent consent dismissal
(`popup_closed` → no inline error). An opt-in LIVE mode
(`E2E_LIVE_GSI=1 npx playwright test …`, never in CI) drives the REAL
`accounts.google.com` GSI script: it asserts the ID-client surface
stands up, the click round-trip is crash-free (pageerrors baseline-
diffed, so pre-existing boot noise doesn't mask sign-in-caused ones),
and no COOP `window.closed` warning reappears. Found + fixed in the
process: the ambient music bed called `play()` before any user gesture
and the rejection escaped as an unhandled pageerror (web expo-audio
leaks the native `media.play()` promise, so the fix is a gesture gate —
the bed starts on first tap; native delays by the same tap). OPEN
(item, needs a debugging session, not a decision): the static export
throws **Minified React error #419** (a hydration mismatch between the
prerendered HTML and the client render) on EVERY web boot in
production builds — pre-existing, reproducible from a plain
`expo export` + serve, absent from the dev build; root-causing which
prerendered node mismatches is open (the e2e baseline-diffs around it
for now).
