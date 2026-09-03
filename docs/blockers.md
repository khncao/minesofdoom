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

**Unblocks when:** the Pocketbase sandbox is up (fake-token dev flag) with
its URL in `storeConfig.iap.pocketbaseUrl`, then the real store
credentials per the plan's phases 2–4 and the verification checklist in
docs/store-integration.md §3.
