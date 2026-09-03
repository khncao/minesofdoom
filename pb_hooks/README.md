# pb_hooks — Mines of Idle Doomath Pocketbase backend

The Pocketbase JS hooks for the app's single Pocketbase deployment
(`docs/pocketbase-plan.md` + `docs/store-integration.md`). Deploy = push
this folder; nothing is clicked in a console.

Target runtime: **Pocketbase v0.40.x** (the v0.40 hooks API is a major
rewrite from v0.2x — everything in this folder is written for it).

## What it serves

All endpoints are `POST` + JSON on **private** collections (all rules
null — only these hooks touch the rows). **Anonymous device is the
default**: every data route is keyed by `deviceId`, and login is never a
prerequisite for anything. The optional login (below) adds an account
layer: the data routes ALSO accept an optional `sessionToken`, and with a
live session the row's account is tagged and the account's other devices
become reachable (cross-device restore). The REST shapes are pinned by the
clients in `src/mines_of_doom/` (`iapProvider.ts`, `cloudSave.ts`,
`leaderboard.ts`); the pure logic is unit-tested in `__test__/logic.test.js`
(runs in the app's jest suite, with sync-pins against `iaps.ts` / `game.ts`
so the server caps can't drift).

| Endpoint | Body | Reply |
|---|---|---|
| `/api/app/verify` | `{ deviceId, platform, productId, token }` (`productId` = internal id) | `{ entitlements: [storeId…] }` |
| `/api/app/restore` | `{ deviceId }` | `{ entitlements: [storeId…] }` |
| `/api/app/cloud/push` | `{ deviceId, blob, saveVersion, updatedAt }` | `{ updatedAt }` (the STORED value — last-write-wins) |
| `/api/app/cloud/pull` | `{ deviceId }` | `{ snapshot: { blob, saveVersion, updatedAt } \| null }` |
| `/api/app/leaderboard/submit` | `{ deviceId, displayName, bestDepth, maxCombo, lifetimeMinerals, achievementIds }` | `{ ok: true }` (monotonic per-field max) |
| `/api/app/leaderboard/top` | `{ limit }` | `{ rows: [{ rank, displayName, bestDepth, maxCombo, achievementCount }] }` |
| `/api/app/leaderboard/rank` | `{ deviceId }` | `{ entry: { rank, bestDepth } \| null }` |
| `/api/app/delete` | `{ deviceId }` | `{ ok: true, deletedAccount }` (GDPR — device scope: cloud save + leaderboard + events rows; **entitlements intentionally survive** so a refund/restore stays possible. WITH a `sessionToken`: the account target — the account, every linked device's rows, all sessions; here entitlements go too) |

Optional login (all `POST` + JSON; replies carry a 30-day `token`):

| Endpoint | Body | Reply |
|---|---|---|
| `/api/app/auth/register` | `{ email, password, deviceId }` | `{ ok, token, account }` (`409` email taken) |
| `/api/app/auth/login` | `{ email, password, deviceId }` | `{ ok, token, account }` (`401` — one error for both halves, no user enumeration) |
| `/api/app/auth/google` | `{ idToken, deviceId }` | `{ ok, token, account }` (`401` unverified) |
| `/api/app/auth/apple` | `{ idToken, deviceId }` | `{ ok, token, account }` (`401` unverified) |
| `/api/app/auth/me` | `{ token }` | `{ account }` (`401` dead/expired) |
| `/api/app/auth/logout` | `{ token }` | `{ ok: true }` (idempotent) |
| `/api/app/auth/link` | `{ token, deviceId }` | `{ ok, account }` (attach a device's pre-existing rows) |

The account model is provider-agnostic: email (where one exists) is the
shared identity, `googleId`/`appleId` are secondary lookups, and the merge
rule on sign-in is (1) this provider's sub → that account, (2) else a
verified email → that account, (3) else create. Sign-in/backfill only ever
SETS `accountId` on rows the device already owns — nothing is copied, so
nothing can be lost or duplicated. Account shape in replies: `{ email,
providers: [{name, linked}] }` — no hashes, no raw provider ids.
`account` in the table above is that shape.

Collections (created lazily on first use, see `collections.js`):
`entitlements`, `cloudSaves`, `leaderboard`, `events` (write-budget counter;
pruned per device after the 1h window), `accounts` (email/password or
provider-linked), `authSessions` (opaque tokens; pruned in place when found
expired — no cron). `cloudSaves`/`leaderboard`/`entitlements` carry an
optional `accountId` (the login backfill target).

## Files

- `app.pb.js` — the hooks entry (Pocketbase v0.40 executes only `*.pb.js`
  files; this one requires the rest).
- `endpoints.js` — the 8 `routerAdd` registrations.
- `handlerLib.js` — stateless record I/O + per-endpoint handlers (runs inside
  the handler runtime).
- `logic.js` — pure validation/merge/cap/budget logic (no Pocketbase API).
- `collections.js` — programmatic private-collection setup.
- `storeVerify.js` — store-side receipt verification (see below).
- `identityVerify.js` — Pocketbase-side sign-in verification, same modes
  (fake-token sandbox / sidecar / fail closed).
- `sidecar/` — the verification sidecar (plain Node, zero deps, `node
  sidecar/server.js`): `verify.js` (pure, fetch-injectables — signs the RS256/ES256
  JWTs the goja runtime can't and calls Play/Apple) and `server.js` (the tiny
  HTTP front: `GET /healthz`, `POST /verify`, `POST /identity`).
- `__test__/identityVerify.test.js` — Pocketbase-side identity (sandbox /
  fail-closed / sidecar) against the pinned `$http` contract.
- `__test__/logic.test.js` — pure-logic jest unit tests (app suite).
- `__test__/storeVerify.test.js` — Pocketbase-side verify (sandbox / fail-closed /
  sidecar modes) against the pinned `$http` contract.
- `__test__/verifySidecar.test.js` — sidecar Play/Apple flows with scripted
  fetches; the Apple cert chain is generated with openssl at test time (chain
  cases skip when openssl is unavailable).

## v0.40 hook model (read before touching these files)

v0.40 executes hook handlers in a **pool of pre-warmed goja VMs**. Only the
handler's *source* is serialized into each executor — module-level state from
the hook file (closures, top-level consts, in-memory maps) is **invisible
inside a handler**, and not shared between pooled VMs. Rules this code follows:

1. **Only `*.pb.js` files execute at boot.** `app.pb.js` is the single entry;
   everything else is plain CommonJS loaded with `require()`. goja resolves
   `require` paths against the process CWD, so every require uses the
   absolute `__hooks` prefix (`require(__hooks + "/logic.js")`).
2. **Handlers must be synchronous.** An async handler is not awaited — the
   runtime only inspects a returned Promise for rejections. `$http.send` and
   all `$app` datastore methods are synchronous in v0.40, so everything is.
3. **Handlers must be self-contained.** Each `routerAdd` handler in
   `endpoints.js` is generated with `new Function` so the route name is baked
   into the source, and the first statement requires `handlerLib.js` inside
   the handler body. Never reference a file-level variable from inside a
   handler.
4. **No datastore access at boot.** `onBootstrap` fires before a DB
   transaction exists — any `$app` query there nil-derefs (a *panic*, not a
   catchable error). The collections are therefore created lazily on the
   first request (`ensureCollections` at the top of `handlerLib.run`); the
   check is four index lookups, negligible at this scale.
5. **No in-memory rate limiting.** Because pooled VMs don't share state, the
   per-device write budget (30 writes/hour) is *durable*: one `kind:"write"`
   row per accepted write in the `events` collection, checked before and
   written after each write, pruned after the window. (`ts` is an explicit
   ms-stamp column because v0.40 records expose no filterable
   `created`/`updated` fields.)

## Security posture (both plans)

- Allow-list: `productId` must map to a canonical store id (the full catalog
  lives in `logic.PRODUCTS`, mirrored by `iaps.ts` and pinned by
  `__test__/logic.test.js`) — a valid receipt for any other SKU mints nothing.
- Per-device write budget: 30 writes/hour across the write endpoints
  (durable — `events` collection; reads are unlimited).
- Server-side-only secrets: the Play service-account JSON and the Apple env
  selection live in container env vars, **never in the app bundle**.
- Raw receipt tokens are never stored (sha256 hash only).
- Caps: cloud blob ≤16KB, `saveVersion` ≤ the app's current version
  (newer = rejected), leaderboard stats below sanity caps (above = dropped,
  not clamped), display name ≤16 chars.

## Store verification

`storeVerify.js` has three modes, first match wins:

- **Sandbox** (`MDOOM_DEV_FAKE_TOKEN=1`): mints entitlements for any
  non-empty token without calling a store. The entire contract above was
  verified end-to-end with this flag. Use it ONLY in the sandbox phase.
- **Sidecar** (`MDOOM_SIDECAR_URL` set): the hook POSTs
  `{ platform, productId, token }` to `<MDOOM_SIDECAR_URL>/verify` via `$http`
  and mints on `2xx` + `{ valid: true }` only. The sidecar
  (`sidecar/`, zero-dependency Node ≥18) does the two store round-trips the
  goja runtime can't: Play's service-account JWT (RS256) and Apple's App
  Store Server JWT (ES256) — both signed with `node:crypto`, both stores
  answered over the internal network hop. This is the RSA/ECDSA-signing
  decision from `docs/blockers.md` (option 1, in-repo).
- **Default (fail closed)**: no sidecar URL → refuse and log. Minting on an
  unverified token in production is a money leak; refusing every purchase
  beats that. A sidecar that's down, slow, or non-2xx also refuses — the
  side call degrades to "not purchased", never to "granted".

## Identity verification (optional login)

`identityVerify.js` has the same three modes, first match wins:

- **Sandbox** (`MDOOM_DEV_FAKE_TOKEN=1`): the token must be a compact JWT
  whose PAYLOAD is trusted WITHOUT a signature (`sub` required, email
  optional). Dev builds mint such a token locally — no Google/Apple account
  needed. NEVER on a real deployment.
- **Sidecar** (`MDOOM_SIDECAR_URL` set): the hook POSTs `{ provider,
  idToken }` to `<MDOOM_SIDECAR_URL>/identity`; the sidecar verifies the
  provider JWT against the provider's PUBLISHED keys (Google RS256 via the
  well-known JWKS, `kid` + `alg` pinned; Apple ES256 via
  `appleid.apple.com/auth/keys`) and checks `iss`/`aud` (`aud` =
  `GOOGLE_CLIENT_ID` or `APPLE_BUNDLE_ID`) + `exp`. Only `valid: true` with a
  `sub` is accepted.
- **Default (fail closed)**: no sidecar URL → refuse and log. An unverified
  sign-in is an account takeover (the token links the caller's device rows
  to the victim's account), so the stakes are higher than a fake purchase:
  refuse, never grant.

`$http` contract and the defensive reply parsing are identical to the
store path. The fake-token sandbox decodes the payload with a pure-JS
base64url/UTF-8 decoder (the goja runtime has no `Buffer`) — exercised in
`__test__/identityVerify.test.js`.

## Production env vars (container env — never in the repo)

Pocketbase container:

| Var | Meaning |
|---|---|
| `MDOOM_DEV_FAKE_TOKEN` | `1`/`true` = sandbox mode (fake IAP receipts AND fake identity JWTs). **Must be unset in production.** |
| `MDOOM_SIDECAR_URL` | Sidecar base URL (no trailing slash needed). Set → real store + identity verification via the sidecar. Unset → fail closed. |
| `MDOOM_SIDECAR_SECRET` | Optional shared key; sent as `x-mdoom-key` on verify/identity POSTs. |

Sidecar container (the Play/Apple/Google credentials live here, never in
Pocketbase):

| Var | Meaning |
|---|---|
| `MDOOM_SIDECAR_PORT` / `MDOOM_SIDECAR_HOST` | Listen address (default `127.0.0.1:8180`). |
| `MDOOM_SIDECAR_SECRET` | If set, `/verify` + `/identity` require the same value in `x-mdoom-key` (constant-time compare). |
| `PLAY_SERVICE_ACCOUNT_JSON` | Play service-account JSON (Play Console → API access), inline or a path / `@path` to the file. Absent → Android verifies nothing (fail closed), iOS unaffected. |
| `PLAY_PACKAGE` | Play package name (default `com.minus4kelvin.minesofdoom`). |
| `APPLE_BUNDLE_ID` / `APPLE_APP_ID` / `APPLE_KEY_ID` | App Store Connect API key identity (App Store Connect → Users and Access → Integrations → App Store Server API). All three required for iOS purchase verification. |
| `APPLE_PRIVATE_KEY` | The P-256 `.p8` key, inline or a path / `@path`. |
| `APPLE_IAP_ENV` | `sandbox` (default) or `production` for the App Store Server API. Anything else disables iOS verification (never an implicit sandbox). |
| `GOOGLE_CLIENT_ID` | The Web/OAuth client id for Google sign-in (the `aud` for Google ID tokens). Absent → Google sign-in refuses (fail closed). |

```
$http.send({ url, method, headers, body: <JSON string> })
  → { statusCode: number, json: parsed body, raw: string }
```

Gotchas from the probe: `body` must be a JSON **string** (an object arrives
as `{}`), and the reply's `json` is the already-parsed body. `storeVerify.js`
still reads the reply defensively (json → string-json → raw), so a future
`$http` reshuffle degrades to a refusal, not a mint (pinned by
`__test__/storeVerify.test.js`).

Apple verdicts are only trusted after the JWS check in `sidecar/verify.js`
(`verifySignedTransactionInfo`): the `signedTransactionInfo` JWS must verify
against its x5c chain, the chain links must hold, and the root must be one
of the certs fetched from `/oauth/certificates` in the same request cycle.
Play verdicts require `purchaseState === 0` on the pinned SKU.

## Sandbox runbook (verified)

Download the official v0.40.2 binary (GitHub releases, checksum-verified) —
Docker Hub was unreachable in the environment this was built in. Windows
note: **`/tmp` in Git Bash is `C:\Users\…\Temp`, not `C:\tmp`** — pass the
binary real Windows paths and wipe those exact paths between fresh runs.

```sh
# fresh data dir + fake-token sandbox (this is how the matrix below was run)
pocketbase.exe serve --http=127.0.0.1:8090 ^
  --dir=C:/tmp/pbdata --hooksDir=C:/path/to/repo/pb_hooks
set MDOOM_DEV_FAKE_TOKEN=1   (or prefix the serve command)
```

Smoke-test the whole contract (the matrix this folder was verified with on
v0.40.2 — every reply shape below was observed live):

```sh
B=http://127.0.0.1:8090
# IAP (fake-token mode)
curl -s $B/api/app/verify   -d '{"deviceId":"dev-1","platform":"android","productId":"removeAds","token":"fake-token-1"}'
curl -s $B/api/app/restore  -d '{"deviceId":"dev-1"}'          # → both storeIds once more products verified
# cloud saves (last-write-wins)
curl -s $B/api/app/cloud/push -d '{"deviceId":"dev-1","blob":"{\"saveVersion\":10}","saveVersion":10,"updatedAt":1700000000000}'
curl -s $B/api/app/cloud/push -d '{"deviceId":"dev-1","blob":"{\"saveVersion\":10}","saveVersion":10,"updatedAt":1600000000000}'  # stale → keeps 1700000000000
curl -s $B/api/app/cloud/pull -d '{"deviceId":"dev-1"}'
# leaderboard (monotonic merge; old resubmit can't push values backwards)
curl -s $B/api/app/leaderboard/submit -d '{"deviceId":"dev-1","displayName":"Digger","bestDepth":1200,"maxCombo":25,"lifetimeMinerals":900000,"achievementIds":["diamond-hands"]}'
curl -s $B/api/app/leaderboard/top    -d '{"limit":10}'
curl -s $B/api/app/leaderboard/rank   -d '{"deviceId":"dev-1"}'
# write budget: the 31st write within an hour 429s
# rejections: saveVersion > app version, stats above sanity caps, bad deviceId
# optional login (fake-token sandbox: mint a compact JWT with the payload
# you want, e.g. {"sub":"g-1","email":"d@example.com"} — no signature needed)
curl -s $B/api/app/auth/register -d '{"email":"d@example.com","password":"hunter22","deviceId":"dev-1"}'
curl -s $B/api/app/auth/login -d '{"email":"d@example.com","password":"hunter22","deviceId":"dev-1"}'
curl -s $B/api/app/auth/google -d '{"idToken":"<fake-jwt>","deviceId":"dev-1"}'
# GDPR
curl -s $B/api/app/delete -d '{"deviceId":"dev-1"}'
curl -s $B/api/app/restore -d '{"deviceId":"dev-1"}'  # entitlements survive
```

Sidecar (separate process, zero deps — runs next to Pocketbase):

```sh
node pb_hooks/sidecar/server.js   # env vars: the table below; none needed for a healthz check
curl -s http://127.0.0.1:8180/healthz   # → { ok, configured: { android, ios }, … }

# point Pocketbase at it (unset the fake flag, set the URL), restart:
#   set MDOOM_DEV_FAKE_TOKEN=
#   set MDOOM_SIDECAR_URL=http://127.0.0.1:8180
# without store credentials /verify now answers { valid: false, reason: "<platform> not configured" }
# — the honest fail-closed verdict; with credentials it is a real store call.
```

A sidecar with nothing configured still serves `/healthz` and refuses
`/verify` per-platform and `/identity` per-provider (`"<provider> not
configured"`) — so the Pocketbase deployment can go up with the sidecar
running before the credentials exist. `APPLE_BUNDLE_ID` does double duty:
with the IAP env vars it configures purchase verification, and it is
ALSO the `aud` for Apple identity — one value, two verifiers.

Ops: one volume (`/pb_data`) is the whole state — nightly copy is the
backup; the dataset is rows-per-device, i.e. tiny. The superuser credentials
printed on first boot are for the admin UI only; the app never uses them.
