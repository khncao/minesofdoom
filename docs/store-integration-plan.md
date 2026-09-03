# Store Integrations Plan — Cloud Saves, Leaderboard, Achievements

Status: **plan** (todo item). Server work starts when the Pocketbase instance
from `docs/pocketbase-plan.md` is deployed (same container, same hooks folder —
no new infrastructure). Client work can start immediately against a local
sandbox instance with the fake-token dev flag.

## Scope

The todo says "cloud saves, leaderboard, achievements". Concretely:

1. **Cloud saves** — automatic encrypted-at-rest (server-side, private
   collection) backup of the ~1.5KB save blob, keyed per device; restore on
   corrupt/missing local save + a manual "restore from cloud" in settings.
2. **Leaderboard** — top-10 **max depth** board, one row per device,
   monotonic-improvement-only upserts; a "your rank" row; a player-chosen
   display name (no account, no email).
3. **Achievements** — no new local mechanics (the local list in
   `achievements.ts` stays the source of truth); the integration adds (a)
   completed-achievement ids on the leaderboard row so the top-10 shows a
   badge count, and (b) a share-sheet string per achievement (client-only,
   no backend).

Out of scope (deliberately): accounts/login, per-user redeem codes,
cross-device *merge*, offline leaderboards, real-time updates (polling is
enough), and any leaderboard *rewards* (would create a paywin/cheat incentive
— see guardrails below).

## Identity: device-scoped, no account

Same accepted tradeoff as the Pocketbase/IAP plan (see "Accepted tradeoffs"
there, and the blockers entry): **no login system**. Everything keys on the
existing device UUID (`iapDeviceId.ts` — generalized into a shared
`deviceId.ts` helper; the AsyncStorage key stays `iapDeviceId` for
compatibility, so IAP entitlements are unaffected).

Consequences (documented, accepted):

- **Uninstall = new identity.** Like IAP entitlements, the cloud save and
  leaderboard row are gone after a full wipe; re-enabling the app on the
  same install restores them. (The save-code path already exists as the
  manual escape hatch.)
- **No merge.** Playing on a second device creates a second row.
- If support demand appears, the escape hatch is server-issued one-time
  transfer codes (not planned now).

`[decision — see blockers.md]` The only alternative (email/Google/Apple
login) is rejected unless someone pushes back: it pulls in auth,
verification emails, and GDPR account data for a kid-skewing casual game,
and it is the one thing in this plan that could touch guardrail 6.

## Backend: extend the existing Pocketbase deployment

Same container, same `pb_hooks/` folder, same security posture
(private collections, hook-endpoint-only access, per-device rate limits,
server-side-only secrets). New private collections:

- `cloudSaves` — `{ deviceId (unique), blob, saveVersion, updatedAt }`.
  `blob` is the `serializeSaveData()` JSON string, size-capped at 16KB
  server-side (a real save is ~1.5KB; the cap is the DoS boundary).
- `leaderboard` — `{ deviceId (unique), displayName, bestDepth,
  maxCombo, lifetimeMinerals, achievementIds, updatedAt }`.

Hook endpoints (all in `pb_hooks/`, versioned in the repo, deploy = push):

| Endpoint | Body | Semantics |
|---|---|---|
| `POST /api/app/cloud/push` | `{ deviceId, blob, saveVersion, updatedAt }` | Reject if `blob` doesn't parse as JSON, has a `saveVersion` outside `[0, saveVersion]`, or is >16KB. Upsert if `updatedAt >=` stored. Reply with the **stored** `updatedAt` (so a stale client learns it lost). |
| `POST /api/app/cloud/pull` | `{ deviceId }` | Reply `{ blob, updatedAt, saveVersion } \| null`. |
| `POST /api/app/leaderboard/submit` | `{ deviceId, displayName, bestDepth, maxCombo, lifetimeMinerals, achievementIds }` | **Monotonic-only**: `bestDepth` must be `>=` the stored value (same for the other stats) — resubmitting an old save can't push a row backwards, and a device can't farm a new row by resetting stats. `displayName` ≤ 16 chars, sanitized (strip control chars/emoji is a server nicety, client pre-truncates). Sanity cap: `bestDepth < 1e9` (number formatting stops at Qi = 1e30 by design; anything above the cap is a corrupt save and gets dropped, not clamped). Upsert. |
| `POST /api/app/leaderboard/top` | `{ limit = 10 }` | Top N by `bestDepth` desc, with the player's rank included in the page if they fall inside it. |
| `POST /api/app/leaderboard/rank` | `{ deviceId }` | `{ rank, bestDepth } \| null` (rank = count of rows strictly above + 1). |
| `POST /api/app/delete` | `{ deviceId }` | GDPR "delete my data": removes the device's `cloudSaves` + `leaderboard` rows (and `events` in phase 2 of the IAP plan). IAP entitlements intentionally survive deletion (a refund/restore would otherwise be unrecoverable) — documented in the settings copy. |

Server-side **anti-cheat stance (explicit, honest-casual)**: the server
trusts the client's stats (monotonic upserts + sanity caps only). There is
no server-side gameplay validation and **nothing is gated on the
leaderboard** — it is a scoreboard, not a paywall, so the effort of a
cheater buys them a number in a top-10 they can screenshot. Full
validation (server-simulated equations) is out of scope forever; revisit
only if rank ever gates content (it won't — guardrail 1).

## Client

Follows the existing provider-swap pattern (ads/IAP): a pure selection
function with pin tests, a no-op until configured, and tests against a
scripted fetch — not in the app bundle logic.

### Config — **done**

`storeConfig.pocketbaseUrl` (top-level) is the only URL needed — it **is**
the Pocketbase deployment this plan extends. The key was promoted out of
`storeConfig.iap` so the IAP and the cloud-save/leaderboard providers share
one value; `isPocketbaseConfigured()` derives from it. No second URL field.

### Cloud save (`cloudSave.ts` — no `.web` twin needed)

- **Web**: no-op by construction — the module imports no native SDK (just
  fetch + storeConfig), and `selectCloudSaveProvider` returns the no-op on
  web (the web bundle stays clean, and save codes already cover web
  backup).
- **Native provider**:
  - **Push**: after each autosave tick and immediately after prestige,
    if (a) the user toggle is on, (b) 5+ minutes since the last push, or
    (c) the push was triggered by prestige (always push on prestige —
    it's the run boundary). Fire-and-forget; failures are silent except
    for the settings status line ("last sync: 3m ago" / "last sync failed").
  - **Pull**: on app launch, *after* the local load resolves:
    - local load failed (corrupt save) and cloud has a blob → import the
      cloud save through the normal `migrateSaveData` + `buildSaveData`
      pipeline, toast "save recovered from cloud backup".
    - both exist → **local wins silently** (the cloud is a backup, never an
      auto-override — guardrail: no surprising save swaps).
  - **Manual restore**: settings button → confirm modal (plain wording:
    "Replace your current save with the cloud backup from <time>? This
    can't be undone.") → same import pipeline.
- **Persistence of the toggle**: the cloud-save on/off flag lives in the
  settings/localStorage area, **not** in the save blob (never leaks via
  save codes; never lost to a save restore).

### Leaderboard

- **Submit**: on the same cadence as the cloud push, piggybacked on the
  provider's network turn (one settings-ish request burst, 5-minute
  cadence; depth changes are rare — the prestige event is the main one).
  Client-side, only the *derived* lifetime stats from the save are sent —
  `maxDepth` here means "deepest depth reached this run ever recorded", i.e.
  the save's lifetime max, so it is monotonic by construction.
- **Display**: a modal from the settings (and a small trophy button on the
  mining screen once the provider is available): top-10 rows (rank,
  display name, depth, achievement-badge count) + a pinned "you" row.
  60s in-memory cache; a 5s tap throttle on refresh; offline/error → an
  "unavailable right now" line, never a spinner trap.
- **Display name**: plain `TextInput`, ≤16 chars, stored next to the
  cloud-save toggle (not in the save blob), default "Digger". Sent with
  every submit; rename takes effect at the next submit.
- **Availability gate**: the trophy button / leaderboard tab renders only
  when the provider is available (`selectLeaderboardProvider()` — same
  "hidden until configured" pattern as the ad entry points), pinned by a
  selection-matrix test.

### Achievements

- Leaderboard rows carry `achievementIds` (from the save's
  `completedAchievements`); the top-10 shows a badge count, the full list
  is already local.
- Share: each achievement row gets a share action — a plain-text string
  ("I earned 'Diamond Hands' in Mines of Idle Doomath") via
  `react-native-share`/`navigator.share` as appropriate. No backend.

## Guardrail mapping

1. **F2P viable** — nothing here gates content; the leaderboard has no
   rewards; the cloud save is free and on by default.
2. **Rewarded ads only** — no new ad placements; no "watch to sync"
   nonsense (the save is free; nobody pays minerals to back it up).
3. **No dark patterns** — restore/overwrite actions use confirm modals with
   plain wording; "delete my data" is a real, reachable button; the sync
   status is always visible in settings.
4. **Transparency** — settings show what's on, when it last synced, and what
   "delete my data" does and doesn't remove (IAP entitlements included in
   the copy).
5. **Measure** — optional phase-2: point first-sync / leaderboard-view
   events at the IAP plan's `events` collection when it lands.
6. **Compliance** — no PII anywhere (device UUID + a display name the
   player chose, capped at 16 chars); private collections; a reachable
   deletion path; no account means no email/verification surface for a
   kid-skewing audience.

## Phases

1. **This plan + decision** (done in this iteration; decision item is in
   `docs/blockers.md`).
2. **Server**: collections + six endpoints in the Pocketbase hooks,
   against the sandbox instance (fake-token dev flag) — deployable only
   once the Pocketbase instance itself exists (shared blocker with the IAP
   todo).
3. **Client: cloud save** — **provider core done**: config refactor
   (top-level `pocketbaseUrl`), `cloudSave.ts` (interface +
   `storeCloudSaveProvider` push/pull/delete + `noopCloudSaveProvider` +
   `selectCloudSaveProvider` selection, no `.web` twin — no native SDK
   import) and the pin tests against scripted fetch
   (`__test__/cloudSave.test.ts`). Remaining: the engine wiring (push
   cadence after autosave/prestige, launch-recovery path, manual-restore
   + toggle + "last sync" settings UI).
4. **Client: leaderboard** — submit piggyback, top/rank endpoints, modal +
   trophy button, display name, tests (monotonic pin, gate-when-unavailable
   pin).
5. **Achievements**: badge count on rows + share strings; **delete my
   data** button + endpoint.
6. **On-device verification** per the checklist style of
   `docs/store-integration.md` §3 (push → wipe local → launch → recovered;
   rename → submit → top-10 shows it; delete → rows gone, entitlement
   survives).

## Open questions

- **Leaderboard metric**: max depth (chosen — run-based, prestige-style,
  resists "my idle was on for a month" domination) vs. lifetime minerals
  (passive). If feedback says depth feels too prestige-coupled, the
  submission is already multi-stat; switching the sort key is one line
  server-side.
- **Cloud save retention**: keep only the latest row per device (chosen)
  vs. N versions. Latest-only until there's evidence of a need.
- **Rate limits**: 30 writes/hour per device on all endpoints (chosen
  starting point, tunable per-device in the hook).
