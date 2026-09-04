# Blockers

Work that cannot proceed in this repo without a decision or an external
action. Items here map 1:1 to the remaining `docs/todo.md` items; when one
unblocks, delete its section and re-scope the todo.

## Depth banner not painting on phone layouts (e2e investigation finding)

**Found:** 2026-09-04, while bringing the Maestro e2e suite to actually run.

**Symptom (repro on Pixel 3a API 34 emulator, debug APK built clean from
HEAD):** the main game screen renders with the equation display as the
FIRST element under the status bar — the depth banner ("⛏ Nm · tier") is
absent from both the screen pixels and the accessibility tree, and every
sibling is shifted up by the banner's height. The `testID="depth-banner"`
node that older builds exposed (verified in Sept 2 a11y dumps) is gone.

**Narrowed down:** `DEPTH_BANNER_RENDER` log probe inside the component
fires on cold boot with correct props (`0`, `0`, `Surface Caverns`), so
React renders the view; the native layer simply never paints it and the
a11y tree omits it. Clean `gradlew clean :app:assembleDebug` reproduces;
the APK's `index.android.bundle` is current (no src file newer than the
bundle). `MinesOfDoom.tsx` has a single render path — `DepthBanner` is
rendered unconditionally as the first child of `styles.contentColumn`
(the tablet/wide fix, commit `498c2c8`), with no conditional, no
`display: none`, no duplicate style key. The component itself is a plain
`<View testID><Text>…</Text></View>` (always renders, `memo`-wrapped).

**Fix landed (2026-09-05, unverified on device):** the window runs
edge-to-edge on RN 0.86, so `MinesOfDoom.tsx` now reserves the
safe-area insets (`useSafeAreaInsets()` — provided by expo-router's root
`SafeAreaProvider`, zero on web) as top/bottom padding on the container,
and `styles.contentColumn` gained `flex: 1` so the column (and its first
child, the banner) get a definite measured height instead of being sized
purely by content inside a centered flex row. The `depth-banner`
asserts are restored in the three flows (`boot_up`, `mining`,
`menu_settings`).

**Still blocked on:** an on-device/CI e2e run to confirm the banner
paints (iteration 7's e2e run was cancelled by the user — the fix is
in, the asserts are back, it just hasn't been exercised on an emulator
yet). If the next e2e run still fails on `depth-banner`, this section
reopens with the bounds from that run.

## Rewarded ads (AdMob) — `todo.md` "Rewarded ads (AdMob) — on-device verification"

**Blocked on (external):** the Google **AdMob account** — the Android App ID
and the production rewarded units for **all four placements** have landed
in `storeConfig.adMob` (one set serves both platforms — ad units aren't
platform-scoped). What remains: registering test devices in AdMob (a
production unit serves only test devices + personalization-targeted real
traffic) and the on-device verification below. (The iOS app entry + App ID
is deferred to `docs/backlog.md` — it is not on the active path.)

**Note:** Android is now fully configured (app id + all four production
placement units) and runs the real `AdMobAdProvider` in production builds.
`storeConfig.test.ts` pins every unit id and fails on AdMob's public test
unit ids (a leaked test id would silently replace a production unit). iOS
stays on the no-op until `iosAppId` lands (`docs/backlog.md`) —
`isAdMobIdsConfigured` requires the app id plus a unit id for every
placement.

**Done in-repo:** the `AdMobAdProvider` behind `selectAdProvider` (v16
`react-native-google-mobile-ads`): `src/mines_of_doom/adProvider.ts` (+
`adProvider.web.ts` no-op for the web target), `storeConfig.ts` as the single
config point, and the config plugin in `app.config.ts` that bakes the app
ids into the native manifests at prebuild. Entry points stay hidden on
platforms where the pair is unconfigured (no-op provider — currently iOS,
which lacks its App ID) — pinned by `ads.test.ts` /
`storeConfig.test.ts`. The full watch → reward → caps flow is now
device-testable against the production units on a test device registered
in AdMob, and the dev-sim provider covers `__DEV__` builds.

**Unblocks when:** the on-device verification in
`docs/store-integration.md` §1/§4 passes on a device registered in AdMob —
watch → reward for every placement against the production units (fill,
reward exactly once, panel hides while backgrounded).

## IAP (Pocketbase + store products + on-device verification) — `todo.md` "IAP — Pocketbase deploy + store products + on-device verification"

**Blocked on (external):** the iOS store credentials only — the `APPLE_*`
App Store Connect API key for the sidecar (`docs/backlog.md`, iOS
section). The 26 Play products are live and ACTIVE (`products-check`
clean), the Android Play credentials are on the sidecar (`/healthz` →
`configured.android: true`), and a release AAB (1.0.8) sits on the
internal track. The Pocketbase deployment itself is DONE (below).

**Done in-repo:** the full client half, mirroring the ads pattern —
`iapProvider.ts` (expo-iap → `finishTransaction` → POST `/api/app/verify`,
restore via `/api/app/restore`, local re-verify queue so a flaky network
never loses a completed purchase), `iapProvider.web.ts` (web no-op — the
Stripe web path is not built yet), `iapDeviceId.ts` (device-scoped key,
never in the save), the pure `pickIapProvider` swap in `iaps.ts`, jest
mocks for `expo-iap` + AsyncStorage, and tests (provider matrix, device-id
factory, selection matrix). Until the Pocketbase URL lands,
`selectIapProvider` returns the no-op on production native (panel hidden)
— pinned by `iaps.test.ts` / `iapProvider.test.ts`.

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

**Unblocks when:** the on-device verification in
docs/store-integration.md §4 passes (test purchase → entitlement →
restore after wiping the local key; web bundle grep).

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
`build.gradle` patches re-applied. The only remaining external step:
the OS sheets need app-side credentials to mint a REAL idToken — a
Google Cloud OAuth client (android package + SHA-1, ios bundle id) and
the Sign in with Apple capability (picked up by the iOS prebuild on
macOS, `docs/backlog.md`). Until then the buttons fail closed to the
single inline error — an honest refusal, never a faked sign-in — and
the device verification joins the store-integration §4 list. Nothing
blocks release: anonymous play is the shipped default.
