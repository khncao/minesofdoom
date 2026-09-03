# Blockers

Work that cannot proceed in this repo without a decision or an external
action. Items here map 1:1 to the remaining `docs/todo.md` items; when one
unblocks, delete its section and re-scope the todo.

## Rewarded ads (AdMob) — `todo.md` "Rewarded ads (AdMob) — production ids + on-device verification"

**Blocked on (external):** the Google **AdMob account** — creating the app
entries (Android + iOS) to obtain production App IDs, one rewarded ad unit
id per platform, and registering test devices. Nothing in-repo can produce
those ids.

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
