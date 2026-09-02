# Store SDK Integration Runbook (ads + IAP)

Status: **prep shipped, store accounts pending.** Everything in-app is already
in place behind provider abstractions; what's left is the external half —
store accounts, product creation, SDK packages, and the one-line swaps below.
No code in this repo ships a store SDK until the steps here are done.

This runbook also covers the remaining §4.4 platform item (iOS verification /
TestFlight), since both need the same prebuilt native project.

## What's already in place (don't re-do)

- **IAP** (`src/mines_of_doom/iaps.ts`, `useIap.ts`, `IapPanel.tsx`):
  tiny catalog, entitlement rules, device-local entitlement persistence
  (never in the save), restore merge, cosmetic-pack grants, analytics hook.
  Production runs `noopIapProvider` (panel hidden); dev builds run the
  labeled `devSimIapProvider`.
- **Rewarded ads** (`ads.ts`, `useAdRewards.ts`, `AdRewardsPanel.tsx`):
  reward economy + daily fraud caps (pure rules), provider abstraction,
  same noop/dev-sim pattern.
- **The one-line swap points** — provider selection is a function, and
  swapping the real SDK in is editing ONE function body, not the UI:
  - `selectIapProvider(dev)` in `iaps.ts`
  - `selectAdProvider(dev)` in `ads.ts`
  `MinesOfDoom.tsx` only calls those. Tests pin today's selection
  (`iaps.test.ts` / `ads.test.ts`, "provider selection").

## 1. Create the products (do this first — it's the long pole)

IAP products. The `storeId` column is the **exact** id to create in each
store (one canonical slug per product works for Play Billing SKUs, App
Store product ids, and RevenueCat — pinned by `iaps.test.ts`); the app id is
`com.minus4kelvin.minesofdoom` (Play) / the App Store bundle id.

| Product | storeId | Price (USD) | What it grants |
|---|---|---|---|
| Remove Ads | `remove_ads` | $2.99 | Hides the rewarded-ads panel permanently |
| Shadow Pickaxe | `pack_shadow_pickaxe` | $1.99 | `shadow` pickaxe (gem-earnable: see catalog) |
| Crimson Oni Outfit | `pack_crimson_oni` | $0.99 | `oni` outfit (gem-earnable) |
| Cherry & Indigo Theme | `pack_cherry_indigo` | $2.99 | `cherry` cave theme (gem-earnable) |

Steps:

1. **Google Play Console** → create the listing → *Monetization → In-app
   products* → add all four SKUs with the exact `storeId`s above.
2. **App Store Connect** → *Apps → In-App Purchases* → add all four products
   with the same ids.
3. **Pick the validation path (recommended: RevenueCat)**:
   - RevenueCat gives receipt validation on both stores from one SDK and one
     dashboard, and its product ids ARE the store `storeId`s above (create
     them in the RevenueCat dashboard with the same names + prices).
   - Direct `react-native-iap` (Play Billing / StoreKit) is the alternative;
     it means writing receipt validation per store yourself. The in-app side
     is identical either way — the provider interface doesn't care.
4. Add the SDK + implement the provider (code change, ~1 provider file each):
   - IAP: `RevenueCatIapProvider` in e.g. `src/mines_of_doom/revenuecat.ts`
     implementing `IapProvider` — `purchase` maps
     `IAP_STORE_IDS[productId]` into the SDK call and translates
     success/cancel/error; `restore` maps `getEntitlements()`/purchases into
     `Partial<Record<IapProductId, boolean>>`. Then edit
     `selectIapProvider`'s body (the one line) — keep web on the no-op:
     `Platform.OS === "web" ? noopIapProvider : revenueCatIapProvider`.
   - Ads: `SdkAdProvider` implementing `AdProvider` (AdMob rewarded via
     `react-native-ads-mediation`, or `expo-ad-adsense`) → same pattern in
     `selectAdProvider`.
5. `npx expo prebuild` after adding any native module (the `android/`
   directory is prebuild-generated — never hand-edit it).

## 2. Verify on device (checklist)

- [ ] Dev build: dev-sim panel still works (regression net for the old path).
- [ ] Test purchase (Play: license test account / RevenueCat test mode;
      App Store: App Store Connect test buyer) → entitlement granted,
      Remove Ads hides **both** panels, packs appear in Cosmetics.
- [ ] Kill + reopen → entitlement persists (device-local `iap` key).
- [ ] *Restore purchases* → re-grants on a fresh install.
- [ ] Refund: the local entitlement record is NOT revoked by design
      (documented in `iaps.ts` — additive-only merge). Accept and note it.
- [x] Web export (`npm run deploy` dry run) → **no store/ad SDK in the web
      bundle, no purchase UI** (guardrail 5; the platform-gated provider
      selection is what enforces this). *(Verified 2026-09-02 on a fresh
      `npm run predeploy`: zero `react-native-purchases` /
      `react-native-ads-mediation` / `expo-ad-adsense` / AdMob strings in the
      bundle; both purchase panels are gated on the provider reporting
      available, which the production no-op never does. The dev-sim code is
      present in the minified bundle as strings only, runtime-dead when
      `__DEV__` is false. Re-verify when the real SDKs land.)*
- [ ] Ads: test ad units only, test devices/numbers registered with AdMob;
      rewarded-only placements confirmed; caps still hit
      (3 gem-roll watches/day, 10 rewards/day).
- [ ] Compliance (guardrail 7): set the SDK's kid-safety flag
      (`TAG_FOR_CHILD_DIRECTED_TREATMENT` for AdMob) per the final age
      rating — math idle skews young.
- [ ] Analytics: `recordIapPurchase` / first-ad-view fire (check
      Settings → "Local stats (debug)").

## 3. iOS build verification + TestFlight (todo §4.4 remainder)

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
- Web stays 100% free with no ad SDKs bundled at all.
- No dark patterns; Remove Ads page stays plain-English about what it is.
- F2P path untouched: everything sold is also gem-earnable; the
  `freePath.test.ts` gate keeps proving it.
