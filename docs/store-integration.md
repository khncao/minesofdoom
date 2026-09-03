# Store SDK Integration Runbook (ads + IAP)

Status: **ads + IAP providers shipped; store accounts + backend pending.**
The AdMob provider (`adProvider.ts`) is selected by `selectAdProvider`
whenever `storeConfig.adMob` is filled in; the IAP provider
(`iapProvider.ts`: expo-iap → Pocketbase verify → entitlement record) is
selected by `selectIapProvider` whenever
`storeConfig.iap.pocketbaseUrl` is filled in. What's left is external work
— store accounts, product creation, the deployed Pocketbase, the ids/URL in
`storeConfig.ts`, and the verification below.

Companion plan: `docs/pocketbase-plan.md` — self-hosted Pocketbase for
receipt validation + entitlement persistence (replaces a RevenueCat-style
managed service; the IAP validation path in §2 is that plan's §"Client").

## What's already in place (don't re-do)

- **IAP** (`src/mines_of_doom/iaps.ts`, `useIap.ts`, `IapPanel.tsx`):
  tiny catalog, entitlement rules, device-local entitlement persistence
  (never in the save), restore merge, cosmetic-pack grants, analytics hook.
  Production runs the real `storeIapProvider` (`iapProvider.ts`,
  expo-iap → Pocketbase verify) once `storeConfig.iap.pocketbaseUrl` is
  filled in and `noopIapProvider` (panel hidden) until then; dev builds run
  the labeled `devSimIapProvider`; web resolves `iapProvider.web.ts`
  (no-op — the Stripe web path is not built yet).
- **Rewarded ads** (`ads.ts`, `useAdRewards.ts`, `AdRewardsPanel.tsx`):
  reward economy + daily fraud caps (pure rules) — gem rolls, offline
  double/top-up, and combo saves (restore a just-lost combo, 60s window,
  1/day) — provider abstraction, same noop/dev-sim pattern. The **AdMob
  provider is implemented** (`adProvider.ts`, v16 API; `adProvider.web.ts`
  is the web no-op so the SDK never enters the web bundle) and selected by
  `selectAdProvider` when `storeConfig.adMob` holds the app id and a
  rewarded unit id for EVERY placement (AdKind) on the current platform.
- **The one-line swap points** — provider selection is a function, and
  swapping the real SDK in is editing ONE function body, not the UI:
  - `selectIapProvider(dev)` in `iaps.ts`
  - `selectAdProvider(dev)` in `ads.ts`
  `MinesOfDoom.tsx` only calls those. Tests pin today's selection
  (`iaps.test.ts` / `ads.test.ts`, "provider selection") — update them in the
  same commit as the swap.

## 1. SDK setup + configuration (the "fill in the blanks" path)

All store/SDK values live in ONE module — `src/mines_of_doom/storeConfig.ts`
(create it with the first real provider). Prescribed shape:

```ts
/** One place every store/SDK id is configured. Empty string = unset. */
export const storeConfig = {
  adMob: {
    androidAppId: "",          // AdMob console → Apps → Android
    iosAppId: "",              // AdMob console → Apps → iOS
    rewardedUnitAndroid: {     // one unit per placement (AdKind), console →
      gemRolls: "",            //   Ad units → Rewarded
      offlineDouble: "",
      offlineTopUp: "",
      comboSave: "",
    },
    rewardedUnitIos: { /* same shape */ },
  },
  iap: {
    pocketbaseUrl: "",         // self-hosted server — docs/pocketbase-plan.md
  },
};
```

Rules that keep setup mechanical:

1. **Empty = unset → the app just runs without the feature.** The real
   providers read this module and fall back to `noopIapProvider` /
   `noopAdProvider` (entry points hidden) when their block is empty, so the
   repo stays buildable and shippable in every environment until store ids
   exist. Dev builds keep running the labeled `devSim*` providers under
   `__DEV__` regardless.
2. **No ids scattered.** AdMob app ids live in `storeConfig.adMob` and are
   repeated in ONE block (`adMobAppIds`) in `app.config.ts` only because the
   Expo config loader can't import TS modules — the
   `react-native-google-mobile-ads` config plugin bakes them into the native
   manifests at `expo prebuild` (never hand-edit android/ or ios/);
   `storeConfig.test.ts` pins the two together. The v16 JS API needs no
   app id at runtime (`MobileAds().initialize()` takes no arguments). The
   rewarded unit ids live in `storeConfig.adMob` and are read by the provider
   in JS. The Pocketbase URL is read by the IAP provider at call time.
   `expo-iap` needs no new product strings: the catalog's
   `IAP_STORE_IDS` *are* the product ids (already canonical + test-pinned).
3. **Web bundles no native SDKs.** The real SDKs are imported only in
   provider files that native builds select; web resolves the `.web`
   no-op files (web ad/payment integrations aren't built yet). After
   wiring, re-run the web bundle grep in §3 — if SDK strings leak into the
   web bundle, switch the provider import to a platform file swap
   (`provider.web.ts` → no-ops) instead of a runtime branch.
4. **`npx expo prebuild` after adding any native module** (the `android/`
   directory is prebuild-generated — never hand-edit it).

Per-SDK setup:

- **Ads** — `react-native-google-mobile-ads` — **done** (shipped in
  `src/mines_of_doom/adProvider.ts`): `showRewarded(kind)` =
  `RewardedAd.createForAdRequest(unit)` + `load()`/`show()` + event listeners,
  mapping EARNED_REWARD → `"rewarded"`, dismiss-without-reward → `"closed"`,
  no-fill/load/show failure → `"error"` (20s load timeout, cancelled once
  the ad opens). **Remaining:** paste the production ids into
  `storeConfig.adMob` + `app.config.ts` (§1 rules), `npx expo prebuild`,
  device-test. **AdMob's public test unit ids work without an AdMob
  account**, so the full watch → reward → caps flow is device-testable
  before production ids exist (the dev-sim provider still covers it in
  `__DEV__` meanwhile).
- **IAP** — `expo-iap` + Pocketbase — **client done** (shipped in
  `src/mines_of_doom/iapProvider.ts` + `iapProvider.web.ts`): purchase =
  `requestPurchase` → store event → `finishTransaction` → POST
  `/api/app/verify` (unified `purchaseToken`; the server re-verifies with
  the store's API and upserts the device entitlement record); restore =
  POST `/api/app/restore`; a failed verify is queued locally and
  re-attempted on the next purchase/restore (a player never loses a
  completed purchase to a flaky network). **Remaining:** deploy the server
  per `docs/pocketbase-plan.md` and paste its URL into
  `storeConfig.iap.pocketbaseUrl`.
- **The swaps** (one function body each, together with the pin-test updates;
  every reward rule / catalog / entitlement rule above stays untouched):
  - `selectAdProvider` — **done**: pure rule `pickAdProvider` in `ads.ts`
    (dev → dev-sim; web or unconfigured → noop; configured native →
    AdMob), pinned by `ads.test.ts`.
  - `selectIapProvider` — **done**: pure rule `pickIapProvider` in
    `iaps.ts` (dev → dev-sim; web → noop; unconfigured native → noop;
    configured native → store), pinned by `iaps.test.ts`.

## 2. Create the products (do this first — it's the long pole)

IAP products. The `storeId` column is the **exact** id to create in each
store (one canonical slug per product works for Play Billing SKUs and App
Store product ids — pinned by `iaps.test.ts`); the app id is
`com.minus4kelvin.minesofdoom` (Play) / the App Store bundle id.

| Product | storeId | Price (USD) | What it grants |
|---|---|---|---|
| Remove Ads | `remove_ads` | $2.99 | Hides the rewarded-ads panel permanently |
| Shadow Pickaxe | `pack_shadow_pickaxe` | $1.99 | `shadow` pickaxe (gem-earnable: see catalog) |
| Crimson Oni Outfit | `pack_crimson_oni` | $0.99 | `oni` outfit (gem-earnable) |
| Cherry & Indigo Theme | `pack_cherry_indigo` | $2.99 | `cherry` cave theme (gem-earnable) |

Steps:

1. **Google Play Console** → create the listing → *Monetization → In-app
   products* → add all four SKUs with the exact `storeId`s above. Also create
   the service-account credentials the Pocketbase server uses for receipt
   validation (server-side only — `docs/pocketbase-plan.md`).
2. **App Store Connect** → *Apps → In-App Purchases* → add all four products
   with the same ids.
3. **Pocketbase server** per `docs/pocketbase-plan.md` (phase 2 sandbox first,
   then real store credentials in phases 3–4).
4. **AdMob** console → create the app entries (Android + iOS) → create one
   rewarded ad unit per placement (gem rolls, offline double, offline
   top-up, combo save) → paste the ids into `storeConfig.adMob` (§1).
   Until a placement's production unit exists, use AdMob's public test unit
   id for that slot (the non-combo-save slots do this today).

## 3. Verify on device (checklist)

- [ ] Dev build: dev-sim panels still work (regression net for the old path).
- [ ] Test purchase (Play: license test account / Play test purchases;
      App Store: App Store Connect test buyer) → entitlement granted,
      Remove Ads hides **both** panels, packs appear in Cosmetics.
- [ ] Kill + reopen → entitlement persists (device-local `iap` key).
- [ ] *Restore purchases* → re-grants from Pocketbase on a wiped local key.
- [ ] Refund: the local entitlement record is NOT revoked by design
      (documented in `iaps.ts` — additive-only merge). Accept and note it.
- [ ] Web export (`npm run deploy` dry run) → **no store/ad SDK in the web
      bundle, no purchase UI** (the `.web` platform files are
      what enforce this). Grep `dist/` for
      `react-native-google-mobile-ads` / `expo-iap` / the Pocketbase URL —
      zero hits. *(Ads half verified: with `adProvider.ts` + the SDK in
      `package.json`, a fresh `npx expo export -p web` + grep returns zero
      hits. Re-run after the IAP swap too.)*
- [ ] Ads: test ad units only, test devices/numbers registered with AdMob;
      rewarded-only placements confirmed; caps still hit
      (3 gem-roll watches/day, 1 combo save/day, 10 rewards/day).
- [ ] Compliance (guardrail 6): set the SDK's kid-safety flag
      (`TAG_FOR_CHILD_DIRECTED_TREATMENT` for AdMob) per the final age
      rating — math idle skews young.
- [ ] Analytics: `recordIapPurchase` / first-ad-view fire (check
      Settings → "Local stats (debug)").

## 4. iOS build verification + TestFlight (todo §4.4 remainder)

1. `npm run ios` on a real device (or Simulator): confirm `expo-av` audio
   plays (mute toggle both ways) and AsyncStorage persists across a
   kill/reopen (manual save + reload).
2. Bump `version` + `android.versionCode` in `app.config.ts` if the
   version changed since the last prebuild.
3. App Store Connect → *Test Flight → Internal Testing* → upload an IPA
   (Xcode from the prebuilt project, or EAS Build). Internal testers don't
   need review; the first external release does.

## Guardrail reminders (AGENTS.md, non-negotiable)

- Rewarded ads **only**, strictly opt-in — no interstitials/banners, ever.
- No dark patterns; Remove Ads page stays plain-English about what it is.
- F2P path untouched: everything sold is also gem-earnable; the
  `freePath.test.ts` gate keeps proving it.
