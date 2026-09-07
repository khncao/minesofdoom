# Mines of Idle Doomath — UX, Improvements & New Features Plan

Legend: [ ] not started, [o] in progress
Completed items are removed from this file (see git history); only remaining work is tracked here.

- [ ] continuous task: document features then explore and document missing
  features — pass 1 DONE 2026-09: `docs/features.md` v1 (full implemented-
  feature catalog, file-anchored) + researched gap list (§7, genre /
  math-game checklists, verified absent from src/). Pass 2 DONE 2026-09:
  gap candidates promoted into the active todos below (weekly challenges,
  share images), and the in-app idle reminder implemented (see below).
  Pass 3 DONE 2026-09: the gem pocket implemented (todo "random
  in-game events" below). Next passes: keep §6-style catalog entries
  current on feature commits, and keep promoting §7 gap items into
  active todos. (Earlier gap items: haptics
  DONE 2026-09 — `haptics.ts` / `useHaptics.ts` + settings toggle, see
  features.md §3; daily equation DONE 2026-09-07 — seeded
  `getSeededEquation` + `dailyEquation.ts`, see features.md §2.)

- [x] idle reminder (features.md §7 gap candidate, in-app half) — DONE:
  `idleReminder.ts` (pure show/hidden decision: 60s idle threshold, once
  per session, settings-gated) + `hooks/useIdleReminder.ts` (5s poll, toast
  via the message overlay) wired to cave taps + answer submits in
  MinesOfDoom; settings toggle `idleReminder` (default on, en/es copy in
  SettingsPanel) and unit tests (`__test__/idleReminder.test.ts`). Deliberately
  reward-free and timer-free (no dark patterns). The OS home-screen widget
  half stays open in features.md §7.
- [x] weekly challenges — DONE: the "weekly contract" (features.md §2
  "Weekly contract" / §7 candidate): `weeklyChallenge.ts` (pure
  derived-state: week-start baseline snapshot on the save's monotonic
  lifetime metrics, progress = current − baseline clamped at 0, one claim
  per real local week) + `hooks/useWeeklyChallenge.ts` (60s week-rollover
  tick, rollover persist, double-claim-gated via stateRef — mirrors
  `useDailyBonus`) + `components/WeeklyContractButton.tsx` (📜 in the top
  menu row next to the daily bonus) + en/es copy + unit tests
  (`__test__/weeklyChallenge.test.ts`). 3 goals (75 answers / 500k minerals
  / 2 more miners) → flat 150k bonus. Guardrails held: real weekly window
  only (no fake scarcity), reward earnable free.

- [x] share images — DONE: the achievement share now renders a 320x180
  PNG badge instead of plain text (features.md §2 "Share badges" / §7
  candidate). Pure-TS render: 5x7 pixel font + RGBA layout + pako-based
  PNG encoder (`shareBadge.ts`, `utils/png.ts`, `pako` dep) — no canvas
  dependency, identical pixels on every platform. Platform hand-off
  follows the provider pattern: native writes the PNG to the cache and
  shares it via `expo-sharing` (`shareImage.ts`), web draws the pixel
  buffer onto an offscreen canvas and shares a File via the Web Share
  API (`shareImage.web.ts`). Every failure degrades to the pre-baseline
  plain-text share (`share.ts`), so a share tap always does something
  honest; a dismissed sheet is a no-op, not a re-opened one. Wired into
  `components/GoalsPanel.tsx`; unit tests (`__test__/shareBadge.test.ts`,
  `__test__/shareImage.test.ts`, `__test__/shareImage.web.test.ts`,
  `utils/png.test.ts`).
- [x] random in-game events — DONE: the "gem pocket" (features.md §2
  "Gem pocket" / §7 candidate): `gemPocket.ts` (pure: per-1s-check
  1/120 spawn roll behind a real 30 s lifetime + 5 min cooldown, bonus =
  8× effective click power floored at 20 and Number-capped, deterministic
  HUD-safe position from the seed — injectable rng for tests) +
  `hooks/useGemPocket.ts` (1 s check loop, collect-once ref guard
  mirroring `useDailyBonus`, expiry honest across backgrounded time,
  gated while the onboarding overlay is up) + the node rendered in
  `components/MiningCanvas.tsx` with its own responder (a pocket tap
  never falls through to hold-to-mine), a quick-tap collect, a
  reduce-motion-respecting pulse, gem sprite / emoji fallback, en/es
  copy + unit tests (`__test__/gemPocket.test.ts`). Guardrails held:
  the window is real (no fake urgency), missing it costs nothing, the
  bonus flows through `addTapGain` (lifetime stats stay exact), odds
  are identical for every player, not persisted.

- [o] Add stripe payment provider for web one time products — **code done**
  (hosted Checkout provider + sidecar Stripe-API confirm + the
  `/api/app/stripe/webhook` backup mint; docs/store-integration.md §2.6).
  Remaining is the external console side only: Stripe products/prices,
  the `pk_`/`sk_` keys, the webhook endpoint + sidecar env, then flip
  `storeConfig.stripe` (all-or-nothing, shop stays hidden until then).
  The public `/stripe/webhook` URL is already routed to the sidecar
  (Caddy, 2026-09-06, fail-closed until `STRIPE_WEBHOOK_SECRET` lands),
  so the Stripe console's webhook endpoint can point at it as-is.

- [o] Add adsense for web ads — **code done** (the shop-sheet banner,
  `AdSenseBanner.web.tsx` + the `+html.tsx` loader; §1.1). Remaining is
  external: AdSense approval + the `ca-pub-` client + a banner slot, then
  fill `storeConfig.adsense`.

- [o] audit project security and compliance — **reviewed + `docs/security-audit.md`**
    (fail-closed verify, device-scoped private collections, no secrets in
    bundle, no XSS sinks — all sound). S1 (session tokens/salts/account ids
    were `Math.random`, not a CSPRNG) and S3 (password hashing was
    single-iteration SHA-256) both **fixed this iteration** (CSPRNG helper +
    100k-round iterated-SHA-256 KDF with transparent on-login upgrade) and
    tested; S2 (webhook `Stripe-Signature` — delivery now lands on the
    sidecar, which verifies the HMAC over the raw body and forwards with
    the shared key; the Pocketbase route 403s anything else) and S4
    (privacy policy v2.0 + terms v2.0 in-app via `legal.ts` — the Spanish
    i18n table stays key-pinned — + the published `privacy-policy.html` /
    `terms-of-use.html` **generated from the same modules** by
    `legalDocs.test.ts`) both **fixed this iteration** and tested.
    Only open follow-up: S6 (kid-safety/age rating — external store check).

- [ ] harden pocketbase and the server it's running on following industry
    standards — container/service level DONE 2026-09-06 (see
    docs/blockers.md for the remaining OS-level items): the deployed
    `pb_hooks/` was swapped to the security-fixed repo copy (S1 CSPRNG,
    S2 webhook gate, S3 iterated-SHA-256 KDF — the live copy predates
    those commits), PocketBase bumped 0.40.2 → 0.40.3 (bug fixes + Go
    dependency security bumps), the sidecar image rebuilt from the repo
    sources, and the shared sidecar↔PocketBase key generated into
    `.env` (chmod 600) on the server — the `/api/app/stripe/webhook`
    gate is enforced live (403 without the `x-mdoom-key` header, which
    the sidecar sends on its own round-trips). Caddy: security headers
    (HSTS/nosniff/X-Frame/referrer/-Server), 1 MB request-body cap, and
    its default per-client throttle stays on (sustained rate limiting is
    the pb_hooks layer's job per-device — the Caddyfile `rate_limit`
    directive is an experimental v2 module, not in the stock image). Compose:
    `cap_drop [ALL]` + `no-new-privileges` + `read_only` + tmpfs + mem caps
    + healthchecks on pocketbase and sidecar (caddy gets mem cap only — its
    gosu entrypoint conflicts with no-new-privileges). IP spoofing probed:
    Caddy trusts the Cloudflare edge (auto-detected) and ignores forwarded
    headers from any direct peer, and Cloudflare itself rejects client
    requests carrying forged `CF-Connecting-IP`. **Open:** the three
    OS-level items need an interactive sudo password (docs/blockers.md).

- [x] IAP — entitlements re-derive from the store's own record after a local
    data loss ("iap not persisting on android" fix): the store provider now
    implements `reconcileStore()` (expo-iap `getAvailablePurchases`), called
    once on launch (silent, after the entitlement storage load lands) and by
    the manual Restore button alongside the server restore. It re-grants
    owned products, re-acks leftover un-acked records, and re-verifies each
    token so the server row re-mints under the device's CURRENT id — the
    only restore path that works for anonymous players after a wipe (their
    server rows are keyed by the old device id). Unit-tested in
    iapProvider.test.ts + useIap.test.ts (863 tests green).
- [ ] IAP — on-device verification of the above: purchase (DONE 2026-09-06 —
    purchase leg confirmed working on the dev build, mines-play-35, license
    tester) → wipe local key (pm clear) → relaunch → entitlement re-derived
    from the store record. **Build leg DONE 2026-09-06 PM:** a debug APK
    from HEAD (c04e03b, supersedes a50aea0 — the embedded-bundle variant,
    boots standalone with the real store provider) is installed on
    mines-play-35 (versionName 1.0.8, boot-smoke clean); the wipe flow
    (`maestro/adhoc/iap-wipe-verify.yaml`) now asserts the FULL leg: pm
    clear → relaunch → panel settles back to **Owned** once reconcileStore
    re-derives it from the store record (90 s window). What remains is the
    billing network (see below) → `maestro test maestro/adhoc/iap-wipe-verify.yaml`. 2026-09-06 PM: the purchase-leg re-run is blocked by the
    emulator billing network (billing gRPC ERR_CONNECTION_REFUSED — worked
    earlier the same day; `docs/blockers.md`), and "works via
    expo run:android" is the labeled dev-sim provider (dev bundle,
    `__DEV__=true`), not real Play Billing
