# Mines of Idle Doomath — Backlog

Deferred work that is intentionally out of the active `docs/todo.md` scope.
The active plan targets **Android + web first**; everything iOS-specific
lives here so the todo doesn't get polluted by platform-parallel work.
Each item stays external (store consoles / App Store Connect) — no
in-repo work is pending for any of it (the providers already exist and
fall back cleanly until the ids land).

## iOS — AdMob app entry + App ID

**Blocked on (external):** the AdMob console (iOS app entry).

- [ ] Create the iOS app entry in AdMob (same app as the Android entry) →
  iOS App ID.
- [ ] Paste it into `storeConfig.adMob.iosAppId` (see the shape in
  `docs/store-integration.md` §1) **and** the `adMobAppIds` block in
  `app.config.ts` — the two are pinned together by `storeConfig.test.ts`.
- [ ] Fill the iOS rewarded unit slots `storeConfig.adMob.rewardedUnitIos`
  once the production rewarded units for the three remaining placements
  (gem rolls, offline double, offline top-up) exist — AdMob units aren't
  platform-scoped, so the same unit ids go in the Android and iOS tables.
- [ ] `npx expo prebuild` → verify on an iOS device per
  `docs/store-integration.md` §1/§4.

Note: until `iosAppId` lands, `isAdMobIdsConfigured` is false on iOS, so
`selectAdProvider` keeps the no-op there (entry points hidden) — Android is
unaffected.

## iOS — App Store IAP (products + sidecar credentials)

**Blocked on (external):** App Store Connect. The shared halves (Pocketbase
deploy, `storeConfig.pocketbaseUrl`, the sidecar itself) are the active IAP
items in `docs/todo.md`; this section is the Apple-specific half of them.

- [ ] Create the 26 App Store Connect products per the table in
  `docs/store-integration.md` §2.1 (exact `storeId`s — the canonical ids the
  client already sends as `productId`).
- [ ] App Store Connect API key: Users and Access → Integrations →
  **App Store Server API** → create a key with the App Store Server API
  capability → capture `APPLE_BUNDLE_ID`, `APPLE_APP_ID`, `APPLE_KEY_ID`
  and the `.p8` file (`APPLE_PRIVATE_KEY`); start with
  `APPLE_IAP_ENV=sandbox`. The sidecar env-var table + runbook are in
  `pb_hooks/README.md`.
- [ ] iOS on-device verification per `docs/store-integration.md` §4: test
  purchase end-to-end (expo-iap → Pocketbase `/api/app/verify` → sidecar
  Apple lookup), restore on a wiped local entitlement key.

Note: the sidecar is per-platform — with `APPLE_*` unset it serves
`/healthz` and refuses iOS verifies (`"ios not configured"`), Android
verifies are unaffected. So iOS can ship a tick later than Android
without blocking it.

## iOS — store integrations (cloud save / leaderboard / GDPR) on-device check

- [ ] iOS on-device verification per
  `docs/store-integration.md` §Phases 6. The client is
  platform-agnostic (same `useCloudSave` / `useLeaderboard` / provider
  picks as Android) — this is a device pass over the same checklist, not
  new code.

## Web — Sign in with Apple

Web sign-in is Google-only (GSI, `signinSdks.ts`). Sign in with Apple on
the web needs a domain-verified **service id** in the Apple Developer
console (verification keyfile + the `minesofdoom.minus4kelvin.com` domain
associated to the team) that does not exist yet, plus an Apple
OAuth web client id — the GSI-style JS flow (`appleid/auth.js`) is then
the same shape as the web Google one (the sidecar already verifies Apple
ES256 idTokens). Not urgent: the account is shared across mechanisms, so
a web user has email + Google today.

- [ ] Create the service id + domain verification (Apple Developer
  console — external).
- [ ] Wire `appleid/auth.js` into `signinSdks.ts` (a `web` apple branch
  in `providerKindsForPlatform` + a `mintAppleIdTokenWeb` alongside
  `mintGoogleIdTokenWeb`); the settings UI already renders one button
  per kind, so no UI change beyond the kinds list.

## Web — Stripe one-time products (todo: "Add stripe payment provider")

External prerequisites (none exist yet): a Stripe account in the
production org, a publishable key for the web client, a webhook
signing secret, and the one-time Product/Price rows (the cosmetic packs
mirror the native IAP catalogue, `iapCatalog`).

Client shape (mirrors the existing provider pattern, hidden until
ready): a `stripe` branch in the `IapProvider` interface used on web
when `stripePublishableKey` is configured — the checkout is Stripe's
hosted flow (Checkout Session created server-side so the secret never
ships to the client). Server shape: a `/api/app/iap/stripe-webhook`
(Stripe → Pocketbase, signature-checked with the webhook secret) that
calls the existing entitlement-grant path, plus a session-create
endpoint taking `deviceId` + product id. The dev-sim parity tests land
alongside `__test__/iaps.test.ts` the same way the Play/App Store
providers' do. Blocked on the account above — no code until the key
exists so nothing half-wired ships.

## Web — AdSense (todo: "Add adsense for web ads")

External prerequisite: an approved AdSense account for the
`minesofdoom.minus4kelvin.com` domain + the ad client id. Web-only
surface (the native rewarded-only rule is untouched — display ads on
the static web export, e.g. a single banner slot in the settings/menu
sheet, never over the canvas). Implementation is a small `+html.tsx`
snippet + one React component gated on the client id being set;
blocked on the approved account.
