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

**Suspect:** the `contentColumn` wrapper from the tablet/wide fix
(`width: 100%, maxWidth: 640, alignItems: center, gap: 3` with no
`flex`) — the same commit that changed the top-of-screen layout. Needs an
on-device layout pass (devtools / `onLayout` bounds) to pin the native
measurement that zeroes the first child.

**Interim e2e state:** the three flows that asserted
`id: depth-banner` (`boot_up`, `mining`, `menu_settings`) now assert
`id: mineral-count` instead — the banner node is unusable as a selector
until this is fixed.

**Unblocks when:** someone with a working dev-tools setup reproduces the
bounds, fixes the layout (or the RN flex quirk it hits), and restores the
`depth-banner` asserts in the three flows.

## Rewarded ads (AdMob) — `todo.md` "Rewarded ads (AdMob) — production ids + on-device verification"

**Blocked on (external):** the Google **AdMob account** — the Android App ID
and the production combo-save rewarded unit have landed; still outstanding:
the rewarded units for the other three placements
(gem rolls, offline double, offline top-up — the other slots currently run
AdMob's public test unit ids) and registering test devices. Nothing
in-repo can produce those ids. (The iOS app entry + App ID is deferred to
`docs/backlog.md` — it is not on the active path.)

**Note:** Android is now fully configured (app id + all placement units,
three of them test ids) and runs the real `AdMobAdProvider` in production
builds. iOS stays on the no-op until `iosAppId` lands (`docs/backlog.md`) —
`isAdMobIdsConfigured` requires the app id plus a unit id for every
placement.

**Done in-repo:** the `AdMobAdProvider` behind `selectAdProvider` (v16
`react-native-google-mobile-ads`): `src/mines_of_doom/adProvider.ts` (+
`adProvider.web.ts` no-op for the web target), `storeConfig.ts` as the single
config point, and the config plugin in `app.config.ts` that bakes the app
ids into the native manifests at prebuild. Until the ids land, entry points
stay hidden (no-op provider) — pinned by `ads.test.ts` / `storeConfig.test.ts`.
The full watch → reward → caps flow is device-testable with AdMob's *public
test unit ids*, and the dev-sim provider covers `__DEV__` builds.

**Unblocks when:** production AdMob ids from the AdMob console land in
`storeConfig.adMob` + the `adMobAppIds` block in `app.config.ts`, followed
by `npx expo prebuild` and the on-device verification in
docs/store-integration.md §1/§4.

## IAP (Pocketbase + store products + on-device verification) — `todo.md` "IAP — Pocketbase deploy + store products + on-device verification"

**Blocked on (external):** the store products (`docs/store-integration.md` §2.1 — 26 products; the App Store Connect half is deferred to
`docs/backlog.md`) and the store credentials that go on the sidecar once
they exist. Neither can be produced in-repo. (The Pocketbase deployment
itself is DONE — see below.)

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
deploy + URL are DONE (see "Deployment status" below); only the store
credentials remain external. Note the v0.40 hooks API is a major
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
token is refused (fail closed). `storeConfig.pocketbaseUrl` is set and
pinned by `storeConfig.test.ts`; the `iaps.test.ts` live pin now expects
the store provider.

**Unblocks when:** the Play Console products + service account exist, the
sidecar's env carries the `PLAY_*` credentials, and the on-device
verification in docs/store-integration.md §4 passes (test purchase →
entitlement → restore after wiping the local key; web bundle grep).

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
