# Pocketbase Self-Host Plan (RevenueCat replacement)

Status: **deployed** (2026-09-03) — Pocketbase v0.40.2 + `pb_hooks/` + sidecar
run on the servarica VPS at `https://minesofdoom.minus4kelvin.com` (Caddy TLS;
`~/docker/pocketbase` compose on the box). The client points at it
(`storeConfig.pocketbaseUrl`, pinned by tests). Store verification fails closed
per platform until the sidecar's env carries the real credentials (`PLAY_*` /
`APPLE_*` — env table in `pb_hooks/README.md`); the fake-token sandbox mode was
used only against local instances, never on the public endpoint.

## Why this, not RevenueCat

The todo asks for "a simple replacement of a service like RevenueCat with
Pocketbase self-host". Of what RevenueCat would do in this game, the only part
we need is **server-side receipt validation + entitlement persistence/restore**.
We have no subscriptions, no billing profiles, no paywall UI SDK — so the SaaS
part (per-MAU billing, dashboard) buys us nothing. A self-hosted Pocketbase
instance (one small binary: SQLite + API + JS hooks) does exactly the needed
half, at ~$0–5/mo, with no third party touching purchase data.

**Accepted tradeoffs** (be explicit about these before implementation):

- **Entitlements are per-device, not per-account.** We have no login system and
  adding one is out of scope. Entitlements key on a persisted device UUID
  (AsyncStorage), never in the game save. After a full app *uninstall* the
  storage (and the entitlement record) is gone and the purchase must be
  re-granted. Mitigation: the three packs are gem-earnable by design (guardrail
  1) and Remove Ads is $2.99; log this in support docs. If it becomes a real
  support burden, revisit with per-user redeem codes from the server (open
  question below).
- **We own the ops**: backups, key rotation, and Apple/Google API changes are
  on us. Pocketbase mitigates most of it (one binary, `pb_data` volume,
  `pb_migrate`).

## Architecture

```
App (native; the web/Stripe path is not built yet)
  expo-iap ──purchase──▶ store sheet ──▶ purchase { storeId, token }
      │
      ├─▶ POST {pb}/api/app/verify  { deviceId, platform, productId, token }
      │       server-side:
      │         Android → Play Developer API (service account)
      │                   purchases.products.get(productId, token)
      │         iOS     → App Store Server API
      │                   verify signed transaction
      │       then: upsert entitlement(deviceId, productId)
      │       reply: full entitlement list for this device
      │
      └─▶ merge reply into the device-local "iap" key
          (additive-only merge already implemented + tested: iaps.ts)

Restore purchases:
  POST {pb}/api/app/restore { deviceId } → entitlement list → same merge path.
```

The client state model is **unchanged**: the device-local `iap` key remains the
runtime source of truth (that's why refunds don't revoke locally — already
documented in `iaps.ts`). Pocketbase is purely the validation + restore
backend, which is exactly the shape of the existing `IapProvider.restore()`
contract, so the swap stays one line in `selectIapProvider`.

## Server (all deployable as code — no console clicking)

- **Runtime**: official Pocketbase Docker image with custom JS hooks
  enabled; `pb_data` on a mounted volume. Hosting: any cheap container host
  (Railway / Fly.io / a $5 VPS). Backups: nightly copy of the volume —
  the dataset is rows-per-device-per-product, i.e. tiny.
- **Collections** (defined in JS hook code so setup is programmatic —
  mirroring the `storeConfig` "no console clicking" rule in
  `docs/store-integration.md` §1):
  - `entitlements` — **private** (no direct REST read/write; only the hook
    endpoints below touch it): `{ deviceId, productId, platform, tokenHash,
    verifiedAt }`.
  - `events` — **private**, phase 2: the lightweight analytics from
    AGENTS.md guardrail 5 ("measure before scaling"): `{ deviceId, name,
    data, at }` for first-ad-view, IAP purchase, D1/D7 pings.
- **Hook endpoints** (`pb_hooks/`, versioned in the repo so a deploy = push):
  - `POST /api/app/verify` — validate `token` against the store for
    `productId`, upsert, return the device's full entitlement list.
  - `POST /api/app/restore` — return the device's entitlement list.
  - `POST /api/app/event` — phase 2 only.
  - **Security**: `productId` must be one of the four canonical
    `IAP_STORE_IDS` (an allow-list — a valid token for some other SKU must not
    mint an entitlement we don't sell); per-device-id rate limit; the Google
    service-account JSON and Apple shared secret live **server-side only**
    (env on the container — never in the app bundle).

## Client (repo changes) — **done**

All shipped in `src/mines_of_doom/`: `storeConfig.ts` (`pocketbaseUrl`),
`iapProvider.ts` (the provider below), `iapProvider.web.ts` (web no-op),
`iapDeviceId.ts` (device id), the `selectIapProvider`/`pickIapProvider` swap
(`iaps.ts`), jest mocks for `expo-iap` + AsyncStorage, and tests
(`iapProvider.test.ts` — full purchase/restore/verify-failure matrix against
a fake fetch — `iapDeviceId.test.ts`, `iaps.test.ts` selection matrix).
The provider itself:

- `storeIapProvider` implementing the existing `IapProvider`:
  - `purchase(productId)`: expo-iap purchase for
    `IAP_STORE_IDS[productId]` → on store success, POST the token to
    `/api/app/verify` → merge the reply into the local `iap` key.
  - `restore()`: `/api/app/restore` → same additive-only merge
    (`mergeIapRestore` in `iaps.ts` already exists and is tested).
  - **Offline / verify-failure**: keep whatever was already granted locally
    (additive-only — the player never loses a completed purchase to a flaky
    network); re-verify on next launch. The store-side sheet + SDK error
    still map to the existing `PurchaseResult` union.
- **Device id**: a device-scoped id persisted in AsyncStorage under its own
  key (`IAP_DEVICE_ID_KEY`) — never in the save, so save codes never leak it.
- **Swap**: `selectIapProvider` body + the "provider selection" pin tests in
  `iaps.test.ts`. Web stays on `noopIapProvider` until the Stripe web path
  is built.

## Phases

1. **Store accounts** (external — `docs/store-integration.md` §2): products
   created in Play Console / App Store Connect, test buyer accounts ready.
2. **Pocketbase sandbox** — **done** (twice): against a local v0.40.2
   instance with `MDOOM_DEV_FAKE_TOKEN=1` (the full curl matrix in
   `pb_hooks/README.md`), and the public deployment went straight to the
   honest state instead: sidecar up, no credentials, fail closed.
3. **Android**: Play service account, real test purchase through expo-iap →
   verify → entitlement granted → restore after wiping the local `iap` key.
4. **iOS**: App Store sandbox + the same matrix.
5. **Swap** the provider selection, update pin tests, re-run the web bundle
   grep. — **done**: the URL is in `storeConfig.pocketbaseUrl`, the pin
   tests (`storeConfig.test.ts`, the live pin in `iaps.test.ts`) expect the
   store provider now; the provider is selected purely on
   `isPocketbaseConfigured()` so it was just the `storeConfig` value (+
   prebuild), no code change. Re-run the web bundle grep in the
   on-device pass (`expo-iap` + the Pocketbase URL).
6. **Phase 2 (optional)**: `events` collection — point the existing
   `recordIapPurchase` / first-ad-view / retention hooks at it (guardrail 5).

## Effort estimate

- Pocketbase container + hook endpoints + collections: **1–2 days**
- Client provider + device id + merge reuse: **1 day**
- Test matrix (2 stores × purchase / restore / offline / refund-accepted):
  **1–2 days**
- Ops (backup job, healthcheck, alerting): **0.5 day**

## Open questions

- **Refunds**: when the store reports a refund (Play / App Store webhooks),
  the server should stop re-granting on restore. The local record stays
  (additive-only, by design — documented in `iaps.ts`). Accept and note.
- **Reinstall persistence** (tradeoff above): if support demand appears, add
  server-issued per-user redeem codes (one-time, single-use — unlike save
  codes, these are bound to the purchase) as a phase 2.
- **Webhooks vs. pull**: do we need App Store *Server Notifications* / Play
  subscription-equivalent events for anything? For one-time purchases,
  pull-on-verify is sufficient; webhooks only become relevant if the refund
  row above ever needs push semantics.
