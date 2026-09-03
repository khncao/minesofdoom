# Store integration — IAP, ads, and the Pocketbase cloud backend

The single runbook for everything store-side: AdMob setup, the IAP
catalog and the exact store products to create, the Pocketbase cloud
backend (IAP verification + cloud saves + leaderboard), the on-device
verification checklist, and the iOS/TestFlight half.

**Status (2026-07):**

- ✅ **IAP + ads integration is complete on the code side** —
  AdMob provider (real `expo-admob` native + web no-op), IAP provider
  (expo-iap → Pocketbase verify → entitlement), provider selection,
  panel wiring. The IAP purchase UI is **hidden in production** until
  the Pocketbase verify backend is configured (it is — live, see §2.3);
  on dev builds the purchase UI runs the labeled simulation so the full
  flow is testable.
- ✅ **Cloud backend is live** — Pocketbase v0.40.2 + the zero-dependency
  store-verification sidecar on servarica at
  `https://minesofdoom.minus4kelvin.com` (`pb_hooks/` in the repo,
  deployed per `docs/pocketbase-plan.md`; deployment ops live there).
- ⬜ **Store accounts + credentials remain** — the 26 products in the
  §2 table must be created in the Play Console / App Store Connect UIs
  (no API for one-time products), and the sidecar's Play/Apple service
  credentials must be configured. Nothing in this doc can be skipped;
  the §4 checklist is the release gate.

Guardrails (AGENTS.md) in force throughout: rewarded ads only
(§2.1.3), no dark patterns (transparency lines in every purchase row),
and **F2P is viable** — every pack also unlocks a cosmetic that is
gem-earnable in-game (guardrail 1).

---

## 1. AdMob setup

The AdMob app ids and rewarded unit ids are configured (2026-07) — see
the committed `storeConfig.ts` / `app.config.ts`. The steps below are
the runbook that created them (and the recipe for any new unit).

1. **Create the AdMob app** (AdMob console → Apps) for each platform
   and note the **App ID** (`ca-app-pub-...`):
   - Android: `com.minus4kelvin.minesofdoom`
   - iOS: `com.minus4kelvin.minesofdoom` (after prebuild; see §5)
   - Web: the web app id (ad networks treat the web app separately)
2. **Create rewarded ad units** (one per placement — AdMob units are
   not platform-scoped, so one set serves both platforms):
   - `ads.reward` — the general "watch for a reward" button
   - `ads.daily` — the daily bonus
   - (planned, in `docs/todo.md`: gem rolls, offline double, offline
     top-up — one unit per placement)
3. **Put the ids where the code reads them:**
   - App ids: `storeConfig.ts` (`adMobAppIds`, web/android/ios) **and**
     the `adMob` block in `app.config.ts` (the native SDK reads the app
     id from the native config, the JS config covers web/dev).
   - Unit ids: `storeConfig.ts` (`adMob.rewardedUnitAndroid` /
     `rewardedUnitIos`).
   - A test pins that every non-empty slot is a valid
     `ca-app-pub-3012345678901234/1234567890`-shaped id, and that a
     configured app id is mirrored in `app.config.ts` (web-only ids are
     exempt — they never reach the native SDK).
4. **Verify on device** (§4): the button shows the "Watch" flow, a
   completed rewarded video fires `onRewarded` exactly once, and the
   panel hides itself while the app is backgrounded / the ad isn't
   filled (the fill check is the guardrail-4 honesty requirement —
   the UI must not show a "Watch" button that can't play).

**Testing without a real account:** `expo-admob` ships test
application ids for exactly this; the `storeConfig.ts` header documents
the official test ids to paste in for a dev build. **Never ship a test
id in a production config** — the config test fails on a known test id
in a non-dev export... (it doesn't have to; the human gate is: release
config is reviewed).

---

## 2. IAP products

The catalog lives in `src/mines_of_doom/iaps.ts`: **Remove Ads** plus
**exactly one pack per paid cosmetic** in `cosmetics.ts` (every pickaxe
/ outfit / cave theme with `costGems > 0`). Tests pin the catalog
against `cosmetics.ts`, so a new paid cosmetic without a pack fails CI.
The `storeId` column of the table below is the exact product id to
create in each store console — one canonical slug for Play Billing,
App Store, and (if we ever adopt it) RevenueCat.

### 2.1 The product table (create these)

Prices are a tier of the gem price (`packPriceLabel` in `iaps.ts`):
≤30 💎 → $0.99, ≤60 → $1.99, ≤100 → $2.99, more → $3.99 — so buying a
pack stays comparable to saving gems for it (guardrail 1: convenience,
never access). Adjust the tiers in `iaps.ts` and update this table —
the console follows the code, not the other way around.

| Store id | Product | Price | Grants (also earnable in-game) |
| --- | --- | --- | --- |
| `remove_ads` | Remove Ads | $2.99 | Hides the rewarded-ads panel permanently |
| `pack_gold` | Golden Pickaxe | $0.99 | `gold` pickaxe (25 💎) |
| `pack_frost` | Frost Pickaxe | $1.99 | `frost` pickaxe (45 💎) |
| `pack_shadow` | Shadow Pickaxe | $2.99 | `shadow` pickaxe (90 💎) |
| `pack_night` | Night Shift Outfit | $0.99 | `night` outfit (15 💎) |
| `pack_goldrush` | Gold Rush Outfit | $0.99 | `goldrush` outfit (25 💎) |
| `pack_crystal` | Crystal Miner Outfit | $1.99 | `crystal` outfit (40 💎) |
| `pack_magma` | Magma Worker Outfit | $1.99 | `magma` outfit (50 💎) |
| `pack_blocky` | Blocky Adventurer Outfit | $0.99 | `blocky` outfit (30 💎) |
| `pack_surface` | Frontier Explorer Outfit | $1.99 | `surface` outfit (40 💎) |
| `pack_knight` | Ashen Knight Outfit | $1.99 | `knight` outfit (50 💎) |
| `pack_hunter` | Wandering Hunter Outfit | $1.99 | `hunter` outfit (60 💎) |
| `pack_oni` | Crimson Oni Outfit | $1.99 | `oni` outfit (75 💎) |
| `pack_marmot` | Burrow Marmot Outfit | $1.99 | `marmot` outfit (60 💎) |
| `pack_fox` | Vein Fox Outfit | $1.99 | `fox` outfit (70 💎) |
| `pack_otter` | River Otter Outfit | $2.99 | `otter` outfit (85 💎) |
| `pack_damsel` | Damsel of the Depths Outfit | $1.99 | `damsel` outfit (75 💎) |
| `pack_amethyst` | Amethyst Cave Theme | $0.99 | `amethyst` theme (25 💎) |
| `pack_verdant` | Verdant Hollow Theme | $1.99 | `verdant` theme (35 💎) |
| `pack_solar` | Solar Vein Theme | $1.99 | `solar` theme (55 💎) |
| `pack_void` | Void Depths Theme | $1.99 | `void` theme (75 💎) |
| `pack_voxel` | Blockfall Mines Theme | $2.99 | `voxel` theme (90 💎) |
| `pack_wilds` | Undergrowth Jungle Theme | $3.99 | `wilds` theme (110 💎) |
| `pack_ashen` | Ashen Depths Theme | $3.99 | `ashen` theme (130 💎) |
| `pack_gothic` | Mist & Lantern Theme | $3.99 | `gothic` theme (150 💎) |
| `pack_cherry` | Cherry & Indigo Theme | $3.99 | `cherry` theme (170 💎) |

Every row's blurb in the purchase panel says plainly what it does and
that the game stays fully free without it (guardrail 4), and shows the
gem price of the granted cosmetic ("also earnable in-game for N 💎" —
guardrail 1).

### 2.2 Create the products

The **Play Developer API has no create/update for one-time in-app
products** (it is read-only: `products.products.get` / `.list`); the
products themselves are a one-time UI job in the console (subscription
products *are* API-manageable, but we ship one-time products). The
**verification side is fully API-driven** (the sidecar calls
`purchases.products.get` — already built).

1. **Play Console** (play.google.com/console → your app → Monetize →
   In-app products → *one-time* products): create **all 26** products
   above by the exact `storeId`. Prices: use the table as the base and
   let Play's price tiers localize it.
2. **App Store Connect** (if/when iOS ships — §5): create the same
   products by the same `storeId` (App Store product ids accept the
   same slug).
3. **Service accounts / credentials** (server-side only — never in
   the repo, never in the app bundle):
   - **Play**: a service account with "View app details (read-only)"
     + "Manage orders and subscriptions" on the app; the JSON key goes
     to the sidecar's `PLAY_SERVICE_ACCOUNT_JSON` env
     (`docs/pocketbase-plan.md` §Credentials).
   - **Apple**: an App Store Connect API key (`.p8`) with the
     "In-App Purchase" capability, bundle id + app id + key id → the
     sidecar's `APPLE_*` envs (same doc).
   - **`GOOGLE_CLIENT_ID`**: optional Google-ID login (see
     `pb_hooks/README.md` "Optional accounts") — creates the login
     collection, a JWT-verified email login, and the cross-device
     restore layer. Not needed for purchases to work.
4. **Activate a test track** (Play → Internal testing): the §4 device
   pass uses it. Real store purchases only work on a device with the
   internal-test build + the service account configured; on web the
   purchase flow is a no-op by design (Stripe path not built yet).

### 2.3 How a purchase flows (what the above unlocks)

`IapPanel` (🛍️ in the footer, next to the daily bonus / rewarded ads)
→ `useIap.purchase` → `IapProvider.purchase(productId)`:

- **dev build**: `devSimIapProvider` — a labeled 1.5 s simulation
  ("⚠️ Development build" banner) so the whole buy → unlock → Cosmetics
  flow is testable pre-store. A dev build can opt into the REAL store
  provider instead ("Real store billing" toggle in the IAP panel —
  §2.4) for on-device Play Billing tests.
- **native prod**: `storeIapProvider` — `expo-iap` requests the
  purchase, then **POSTs the receipt to Pocketbase**
  (`/api/app/verify` → `pb_hooks/verify-purchase.js` → the
  zero-dependency **store-verification sidecar** calls the Play Billing
  API (`purchases.products.get`) or Apple V2 with the service
  credentials; Pocketbase itself has no store credentials and no
  outbound network needs). The reply is only `verified: true` when the
  store confirmed the purchase for the claimed internal product id.
  Then the entitlement is granted **device-locally** (AsyncStorage
  `iap` key — never in the game save, so shared/imported saves can't
  import someone else's receipts), and the Cosmetics section re-resolves
  ownership from it.
- **web**: no-op (the purchase UI is hidden; web purchases would go
  through Stripe, not built yet).

Entitlements are keyed by the **internal** product id; the Pocketbase
allow-list (`pb_hooks/logic.js` `PRODUCTS`) maps internal → store id
and is pinned against `IAP_STORE_IDS` by `pb_hooks/__test__/logic.test.js`.
A valid receipt for a product NOT in the allow-list never mints an
entitlement.

`Restore purchases` re-runs the store round-trip
(`IapProvider.restore()` → `/api/app/restore`) and merges
additively into the local entitlement record (a restore can only ADD,
never revoke).

Remove Ads is special: owning it hides **both** the IAP panel and the
rewarded-ads panel permanently (plan §5.1: "permanently disables even
the opt-in buttons").

### 2.4 Testing real billing on a debug APK

The normal dev build runs the labeled simulation, which never touches
Play Billing. To exercise the REAL store round-trip (product sheet,
payment, `finishTransaction`, verify, entitlement) on a debug APK:

1. **Play Console**: the app + the products exist (§2.2) and the
   internal test track has the build's package
   `com.minesofdoom.minus4kelvin.minesofdoom`.
2. **License key**: Play Console → app → Monetize → License testing →
   **API key**. Install it on the device (the Play Store app must be
   signed in):
   ```sh
   adb shell am start -a com.android.vending.BILLING -e key <LICENSE_KEY>
   ```
   This is what lets a **debug-signed** APK talk to Play Billing; a
   release build signed with the upload key does not need it.
3. **Build the APK** (`npm run android` against Metro, or the prebuilt
   debug APK — the JS bundle is embedded, see AGENTS.md) and install it.
4. **In-app toggle**: open the IAP panel (🛍️) and flip **"Real store
   billing"** (visible only in dev builds, native only, persisted per
   device under the `iapRealStore` localStorage key). The banner above
   it switches to "REAL store billing active" so it is never
   ambiguous which mode the panel is in (transparency guardrail).
5. **Buy** any product with a test card
   (Play Console → Monetize → Test payments → test card). Expected:
   the store sheet opens for the real SKU, the purchase completes,
   `finishTransaction` acks, and the entitlement is **granted
   device-locally immediately** — even while the sidecar still has no
   Play credentials, in which case `/api/app/verify` fails closed
   ("token verification failed") and the purchase is **queued for
   re-verify** (AsyncStorage `iapPendingVerifies`). Once
   `PLAY_SERVICE_ACCOUNT_JSON` lands on the sidecar (§2.2 step 3), the
   next purchase/restore replays the queue, the server mints its
   entitlement record, and restore returns it. A completed store
   purchase is never lost to the flaky-verify state by design.

This is NOT the release gate: the §4 device pass still has to run
against a release (upload-key-signed) build before shipping.

### 2.5 Building the release AAB (Play Console upload)

Play Console needs an **app build uploaded before one-time in-app
products can be created** — this section produces it. The AAB must be
signed with the **Play upload key**; the keystore never enters the
repo (`android/keystore.properties` + `android/keystore/` are
gitignored, and `android/app/build.gradle` falls back to the debug
signature without them, so a keyless build can never be uploaded by
mistake — Play rejects debug-signed AABs).

1. **Play Console → App integrity → App signing.** Generate (or
   select) the app-signing key and **download the `.jks`** (the page
   gives the keystore password; note the key alias too).
   - If Play App Signing is already set up with a key you don't hold
     (e.g. Google generated one earlier), you cannot sign locally —
     that AAB would need EAS/CI remote signing instead; in that case
     use *"Use an existing key"* with a key you control.
2. **Place the key** (local machine only):
   - `android/keystore/upload-keystore.jks`
   - `android/keystore.properties`:
     ```properties
     storeFile=keystore/upload-keystore.jks
     storePassword=<from the App signing page>
     keyAlias=<key alias>
     keyPassword=<key password, usually the keystore password>
     ```
3. **Build** (repo root; the Android SDK must be on the machine):
   ```sh
   cd android && gradlew.bat bundleRelease
   ```
   Output: `android/app/build/outputs/bundle/release/app-release.aab`
   (the JS bundle is embedded by the RN gradle plugin — no Metro
   needed). On non-Windows: `./gradlew bundleRelease`.
4. **Upload**: Play Console → Release → Internal testing → create
   release → upload the AAB. The console verifies the signature
   matches the App signing page. Once a build is on a track, the
   **Monetize → In-app products** section unlocks and the §2.2 table
   can be created.
5. **Every future upload**: bump `version` + `android.versionCode`
   in `app.config.ts` **and** `versionCode`/`versionName` in
   `android/app/build.gradle` (the committed prebuild file — keep them
   in sync; Play requires a strictly increasing `versionCode`), then
   re-run step 3.

---

## 3. Cloud saves, leaderboards & achievements (Pocketbase)

Scope: **cloud save w/ recovery**, **leaderboard**, **achievements
sync**, **per-player achievement unlocks**, **GDPR delete**, and the
store-account half of §2.2. **No social features, no accounts required
by default** — the anonymous device is the identity, exactly as
`docs/pocketbase-plan.md` decided. (Deployment/ops details for the
server itself live in `docs/pocketbase-plan.md`; this section is the
design + status.)

### 3.1 Design decisions (the non-obvious ones)

1. **The anonymous device IS the user.** No signup, no email, no
   password. Every route is keyed by a client-generated `deviceId`
   (AsyncStorage `deviceId` key, same key family as the IAP
   entitlements). This matches the game's existing identity model:
   saves are already device-scoped, and the IAP entitlements already
   live device-locally. A Pocketbase *login* is NOT the identity — it
   is an **optional upgrade** (see §3.4) that lets the same player bind
   multiple devices.
2. **No game-logic server-side.** Pocketbase is a *store + verifier*,
   not a game server. The only non-trivial server logic is
   (a) store-purchase verification via the sidecar and (b) the
   **anti-cheat caps** on leaderboard submissions (below). Everything
   else is dumb CRUD the client already does locally. This keeps the
   server boring, keeps the app F2P-viable offline, and means the
   cloud is a *convenience layer* the game fully works without (same
   posture as IAP today: hidden until the backend is configured).
3. **Saves are opaque blobs with a version gate.** The client
   compresses the existing save payload to a JSON string and ships it
   as an opaque `data` field (the server does not parse game state —
   it only checks length + `saveVersion`). On restore the client
   validates + migrates exactly as it does for a save-code import
   (`importSaveCode`), so a corrupted/partial restore falls back to
   the local save instead of corrupting it. This is what makes the
   save-code feature and the cloud feature share one validation path.
4. **Leaderboard is a *claim*, not an authoritative score.** The
   client submits `{ bestDepth, maxCombo, lifetimeMinerals, ts }` with
   a display name; the server applies **hard caps** (depth/combo/
   lifetime bounds derived from the known end-game) and a **rate limit**
   (one write per device per hour) — it does NOT re-simulate the
   game. This is the right amount of trust for a leaderboard: the caps
   make a garbage/fabricated submission visibly absurd or silently
   clamped, and the rate limit stops a script from flooding it. We
   accept that a determined cheater can submit a plausible-but-fake
   high score; the leaderboard is cosmetic, not competitive-prize.
   (If it ever becomes prize-bearing, that's when server-authoritative
   scoring earns its cost.)
5. **Achievements are *unlock events*, not state.** The achievement
   *definitions* and the *unlocked-set* live client-side (they already
   do — `achievements.ts` + the save). The cloud just gets an
   **append-only log of unlock events** (`deviceId, achievementId,
   ts`) so (a) the same device on a fresh install can re-derive its
   unlocked set, and (b) a future "show my badges" / share feature has
   a durable record. We do NOT store the achievement *progress*
   counters in the cloud — that's re-simulating the game, which
   decision #2 rules out.
6. **One Pocketbase instance, one collection per concern.** `cloud_save`
   (1 row/device), `leaderboard` (1 row/device), `achievement_log`
   (N rows/device), plus the IAP `purchases`/`entitlements` the verify
   endpoint already needs. All collections **private** (rules null);
   the only writers are the JS hooks in `pb_hooks/`. No public API
   surface, no API keys in the client.

### 3.2 Identity & the optional account layer

- `deviceId` (required, every route): a UUIDv4 generated on first
  launch, persisted AsyncStorage `deviceId`. This is the **primary key
  of every cloud row**. The client already generates one for IAP
  entitlements; reuse it, don't mint a second.
- **Optional login (Phase 4)**: a Pocketbase email+password (or
  later, a Google sign-in) that *binds* a `deviceId` to an account.
  The account is **never** the identity for data routing — it's a
  **restore bridge**: on a new device, the player logs in and the
  server returns *that account's other devices'* cloud rows (save +
  achievements), letting the player pull their old save. This is the
  only feature login buys; everything works without it. Keep it
  optional + one-tap-skippable (it's a recovery feature, not a gate).
- **Conflict rule (stated, not inferred):** cloud and local can diverge
  (player keeps playing offline). On restore, the client compares
  `updatedAt`/`minerals`/`depth` and offers the player a **choice**
  (keep local / take cloud) — it never silently overwrites a newer
  local save. Same spirit as the save-code import (which already
  refuses to clobber a newer local save).

### 3.3 REST shape (what the client will call)

Base: `https://minesofdoom.minus4kelvin.com` (Pocketbase, live).
Private collections — the client authenticates by `deviceId` (the hook
verifies the device owns the row it's touching); optional
`Authorization: <pbSession>` for the account/restore routes. All six
routes are **already built** in `pb_hooks/` (see `pb_hooks/README.md`
for the exact REST shapes) — POST + JSON, keyed by `deviceId`.

| Route | Body / query | Reply | Notes |
| --- | --- | --- | --- |
| `POST /api/app/cloud/push` | `{ deviceId, save: { version, data } }` | `{ ok, storedAt }` | 64 KB cap, version ≤ server max (a newer version is **rejected**, not stored — the client would import its own save back through a migration path the server doesn't know) |
| `POST /api/app/cloud/pull` | `{ deviceId, sessionToken? }` | `{ save, name }` / null | account bridge: with a session, the device is linked and any linked device's save is reachable |
| `POST /api/app/leaderboard/submit` | `{ deviceId, name, bestDepth, maxCombo, lifetimeMinerals }` | `{ ok, rank }` | hard caps + 1 write/device/hour |
| `POST /api/app/leaderboard/top` | `{ limit? }` | `{ rows }` | best-depth ranking |
| `POST /api/app/leaderboard/rank` | `{ deviceId }` | `{ rank }` | the device's own standing |
| `POST /api/app/verify` / `/api/app/restore` | IAP receipt / `{ deviceId }` | entitlements | §2.3 — via the sidecar |

Plus `POST /api/app/achievements/unlock` (append-only event log) and
`POST /api/app/gdpr/delete` (wipes the device's rows) — the GDPR
route is the one the LegalSection links.

### 3.4 Status

- **Phases 1–2 (store accounts, sidecar credentials)**: ⬜ — see §2.2;
  this is the same blocker as the IAP half.
- **Phase 3 (server: collections, verify endpoint)**: ✅ —
  `pb_hooks/` is deployed on servarica (deployment + credentials in
  `docs/pocketbase-plan.md`).
- **Phases 4–5 (client cloud save w/ recovery + settings;
  leaderboard panel; achievement share; GDPR delete)**: ✅ — wired and
  tested (client is pointed at the live URL; the design above is what
  was built).
- **Phase 6 (iOS: App Store products + the sidecar's `APPLE_*`
  credentials; TestFlight)**: ⬜ — `docs/backlog.md` (iOS section).
- **Phase 7 (metrics: first-time-ad-view, IAP purchase, D1/D7
  retention, free-path progress — lightweight event logging before any
  UA spend, AGENTS.md guardrail 5)**: ⬜ — not built yet.

---

## 4. On-device verification (the release gate)

Run on a **real device** (Play Billing / StoreKit don't work in the
emulator or on web) with a **test purchase**, after §1 + §2 are done:

- [ ] **Ads** (§1): a configured rewarded slot loads a real test ad,
      watching to the end fires `onRewarded` exactly once, the
      daily-bonus double is granted, and the "Remove Ads" panel state
      is reflected (owned → panel hidden).
- [ ] **IAP purchase** (§2.3): buy one cheap pack on-device → the
      entitlement is granted, the cosmetic appears in Cosmetics, and a
      **wipe of the local AsyncStorage key + restore** re-applies it
      from the store (this is the whole point of Pocketbase verify —
      the receipt round-trips).
- [ ] **Remove Ads** (on-device, test price): owning it hides the
      rewarded-ads panel AND the IAP panel permanently.
- [ ] **Cloud save** (§3): play a bit → the save is pushed; change
      something, force-quit, launch → the save is pulled and
      reconciled; the settings (name etc.) round-trip.
- [ ] **Leaderboard**: submit a score, it appears in `/top` within the
      rate-limit window; a fabricated out-of-cap submission is
      clamped/rejected.
- [ ] **GDPR delete**: the LegalSection "delete my data" wipes the
      device's cloud rows and the next launch starts clean.
- [ ] **Web bundle grep**: `npx expo export -p web` → grep `dist/` for
      `expo-admob` / `expo-iap` — the native SDKs must not leak into
      the web bundle (the `.web` swaps resolve no-ops; a hit here means
      a swap is missing). The Pocketbase URL *should* be present (it's
      a plain fetch endpoint).

---

## 5. iOS / TestFlight half (deferred — `docs/backlog.md`)

- **App Store Connect**: create the §2.1 products by the same
  `storeId`, the `APPLE_*` sidecar credentials (API key `.p8`), the
  Apple app id.
- **`app.config.ts`**: fill `ios.bundleIdentifier` (or confirm the
  prebuilt one), run `npx expo prebuild -p ios` (the `android/` dir is
  prebuilt; iOS is not yet), build + upload to TestFlight.
- The client side is platform-neutral: `selectIapProvider` already
  keys off `Platform.OS === "web"` only, so iOS picks up
  `storeIapProvider` automatically once the Pocketbase URL is
  configured (it is) — no code change, just the store half above.

---

## 6. Guardrail reminders (AGENTS.md — non-negotiable)

- **Rewarded ads only**, always behind an explicit "Watch" tap.
  Interstitials / banners: off the table. (The `adMob` provider is
  literally only `showRewarded` — there is no API surface for the
  others.)
- **No dark patterns**: the purchase panel shows plain prices, plain
  blurbs, and the "also earnable in-game for N 💎" line on every pack;
  no fake scarcity, no default-checked anything.
- **F2P is viable**: every pack grants a gem-earnable cosmetic; the
  free-path benchmark in `docs/todo.md` is the gate.
- **Measure before scaling** (guardrail 5): the §3.4 Phase 7 event
  logging lands **before** any UA spend.
- **Compliance**: the game is a math idle game (young-skewing);
  confirm the ad SDK's kid-safety flag
  (`TAG_FOR_CHILD_DIRECTED_TREATMENT`) matches the chosen age rating
  before the ad units go live beyond test.
