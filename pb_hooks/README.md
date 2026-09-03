# pb_hooks — Mines of Idle Doomath Pocketbase backend

The Pocketbase JS hooks for the app's single Pocketbase deployment
(`docs/pocketbase-plan.md` + `docs/store-integration-plan.md`). Deploy = push
this folder; nothing is clicked in a console.

Target runtime: **Pocketbase v0.40.x** (the v0.40 hooks API is a major
rewrite from v0.2x — everything in this folder is written for it).

## What it serves

All endpoints are `POST` + JSON, device-scoped (no account), on **private**
collections (all five rules null — only these hooks touch the rows). The REST
shapes are pinned by the clients in `src/mines_of_doom/`
(`iapProvider.ts`, `cloudSave.ts`, `leaderboard.ts`); the pure logic is
unit-tested in `__test__/logic.test.js` (runs in the app's jest suite, with
sync-pins against `iaps.ts` / `game.ts` so the server caps can't drift).

| Endpoint | Body | Reply |
|---|---|---|
| `/api/app/verify` | `{ deviceId, platform, productId, token }` (`productId` = internal id) | `{ entitlements: [storeId…] }` |
| `/api/app/restore` | `{ deviceId }` | `{ entitlements: [storeId…] }` |
| `/api/app/cloud/push` | `{ deviceId, blob, saveVersion, updatedAt }` | `{ updatedAt }` (the STORED value — last-write-wins) |
| `/api/app/cloud/pull` | `{ deviceId }` | `{ snapshot: { blob, saveVersion, updatedAt } \| null }` |
| `/api/app/leaderboard/submit` | `{ deviceId, displayName, bestDepth, maxCombo, lifetimeMinerals, achievementIds }` | `{ ok: true }` (monotonic per-field max) |
| `/api/app/leaderboard/top` | `{ limit }` | `{ rows: [{ rank, displayName, bestDepth, maxCombo, achievementCount }] }` |
| `/api/app/leaderboard/rank` | `{ deviceId }` | `{ entry: { rank, bestDepth } \| null }` |
| `/api/app/delete` | `{ deviceId }` | `{ ok: true }` (GDPR — cloud save + leaderboard + events rows; **entitlements intentionally survive** so a refund/restore stays possible) |

Collections (created lazily on first use, see `collections.js`):
`entitlements`, `cloudSaves`, `leaderboard`, `events` (write-budget counter;
pruned per device after the 1h window).

## Files

- `app.pb.js` — the hooks entry (Pocketbase v0.40 executes only `*.pb.js`
  files; this one requires the rest).
- `endpoints.js` — the 8 `routerAdd` registrations.
- `handlerLib.js` — stateless record I/O + per-endpoint handlers (runs inside
  the handler runtime).
- `logic.js` — pure validation/merge/cap/budget logic (no Pocketbase API).
- `collections.js` — programmatic private-collection setup.
- `storeVerify.js` — store-side receipt verification (see below).
- `__test__/logic.test.js` — jest unit tests (app suite).

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

- Allow-list: `productId` must map to one of the four canonical store ids
  (`logic.PRODUCTS`) — a valid receipt for any other SKU mints nothing.
- Per-device write budget: 30 writes/hour across the write endpoints
  (durable — `events` collection; reads are unlimited).
- Server-side-only secrets: the Play service-account JSON and the Apple env
  selection live in container env vars, **never in the app bundle**.
- Raw receipt tokens are never stored (sha256 hash only).
- Caps: cloud blob ≤16KB, `saveVersion` ≤ the app's current version
  (newer = rejected), leaderboard stats below sanity caps (above = dropped,
  not clamped), display name ≤16 chars.

## Store verification — current state (read `docs/blockers.md`)

`storeVerify.js` has two modes:

- **Sandbox** (`MDOOM_DEV_FAKE_TOKEN=1`): mints entitlements for any
  non-empty token without calling a store. The entire contract above was
  verified end-to-end with this flag.
- **Production (fail closed)**: Pocketbase's goja runtime exposes only HMAC
  (`$security.*`). Play's service-account JWT (RS256) and Apple's App Store
  Server JWT (ES256) need RSA/ECDSA, which the runtime cannot sign — so real
  tokens are *refused* until a decision lands (native sidecar, or another
  runtime for the two store round-trips). Failing closed is deliberate:
  denying every purchase beats minting on an unverified token.

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
# GDPR
curl -s $B/api/app/delete -d '{"deviceId":"dev-1"}'
curl -s $B/api/app/restore -d '{"deviceId":"dev-1"}'  # entitlements survive
```

## Production env vars (container env — never in the repo)

| Var | Meaning |
|---|---|
| `MDOOM_DEV_FAKE_TOKEN` | `1`/`true` = sandbox fake-token mode. **Must be unset in production.** |
| `PLAY_SERVICE_ACCOUNT_JSON` | Play service-account JSON (Play Console → API access). Enables real Android receipt verification once the RSA-signing gap is solved. |
| `PLAY_PACKAGE` | Play package name (default `com.minus4kelvin.minesofdoom`). |
| `APPLE_IAP_ENV` | `sandbox` (default) or `production` for the App Store Server API. |

Ops: one volume (`/pb_data`) is the whole state — nightly copy is the
backup; the dataset is rows-per-device, i.e. tiny. The superuser credentials
printed on first boot are for the admin UI only; the app never uses them.
