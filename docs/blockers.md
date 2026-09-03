# Blockers

Work that cannot proceed in this repo without a decision or an external
action. Items here map 1:1 to the remaining `docs/todo.md` items; when one
unblocks, delete its section and re-scope the todo.

## Rewarded ads (react-native-google-mobile-ads) — `todo.md` "Implement react-native-google-mobile-ads for ads"

**Blocked on (external):** the Google **AdMob account** — creating the app
entries (Android + iOS) to obtain production App IDs and a rewarded ad unit
id, plus registering test devices. Nothing in-repo can produce those ids.

**Not blocked:** implementing the `AdMobAdProvider` behind
`selectAdProvider` and device-testing the full watch → reward → caps flow —
AdMob's *public test unit ids* work without any account (see
docs/store-integration.md §1). The dev-sim provider also still covers the
flow in `__DEV__` builds.

**Unblocks when:** production AdMob ids from the AdMob console land in
`storeConfig.adMob` (docs/store-integration.md §1).
