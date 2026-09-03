# Blockers

Work that cannot proceed in this repo without a decision or an external
action. Items here map 1:1 to the remaining `docs/todo.md` items; when one
unblocks, delete its section and re-scope the todo.

## Rewarded ads (AdMob) — `todo.md` "Rewarded ads (AdMob) — production ids + on-device verification"

**Blocked on (external):** the Google **AdMob account** — the Android App ID
and the production combo-save rewarded unit have landed; still outstanding:
the iOS app entry, the rewarded units for the other three placements
(gem rolls, offline double, offline top-up — the other slots currently run
AdMob's public test unit ids) and registering test devices. Nothing
in-repo can produce those ids.

**Note:** Android is now fully configured (app id + all placement units,
three of them test ids) and runs the real `AdMobAdProvider` in production
builds. iOS stays on the no-op until `iosAppId` lands — `isAdMobIdsConfigured`
requires the app id plus a unit id for every placement.

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
docs/store-integration.md §1/§3.

## IAP (Pocketbase + store products + on-device verification) — `todo.md` "IAP — Pocketbase deploy + store products + on-device verification"

**Blocked on (external):** a deployed **Pocketbase** server (hook
endpoints + collections per `docs/pocketbase-plan.md`) and the four store
products (Play Console SKUs / App Store Connect ids per
`docs/store-integration.md` §2). Neither can be produced in-repo.

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
429-ing on the 31st write, GDPR delete with entitlements surviving). Only
the deploy + URL remain external. Note the v0.40 hooks API is a major
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

**Unblocks when:** the Pocketbase sandbox is up (fake-token dev flag) with
its URL in `storeConfig.pocketbaseUrl`, then the real store
credentials per the plan's phases 2–4 and the verification checklist in
docs/store-integration.md §3.

(Decision log: the earlier "signing gap" item is resolved in-repo by the
sidecar above — option 1 of the three options that were on the table;
nothing left to decide there.)

## Store integrations (cloud saves, leaderboard, achievements) — `todo.md` "Store integrations"

**Blocked on (decision):** the identity model. The plan
(`docs/store-integration-plan.md`) defaults to **device-scoped, no account**
(same tradeoff as the IAP entitlements: uninstall = identity gone; save
codes are the escape hatch). The alternative — email/Google/Apple login —
was rejected in the plan because it adds auth + GDPR account data to a
kid-skewing casual game. **Default assumption in force: proceed with
device-scoped** unless the decision comes back otherwise; nothing in the
server/client design needs to change to swap it later, but the `delete my
data` endpoint and the reinstall caveats in the settings copy do, so that
copy is drafted for the device model.

**Blocked on (external, shared):** the Pocketbase deployment itself — the
cloud/leaderboard endpoints land in the same container and `pb_hooks/`
folder as the IAP ones, so their server phase starts exactly when the IAP
sandbox does. Client work (providers, UI, tests against scripted fetch) is
**not** blocked and can start in the sandbox.
