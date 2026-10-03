# AGENTS.md

Guidance for AI agents working in this repository.

## Project Overview

**Mines of Doom** (package name `minesofdoom`) is an idle/clicker mining game built with **Expo SDK 57 (React Native 0.86, new architecture)** and **expo-router**. It runs on web (deployed as a static site via Cloudflare Pages), Android, and iOS.

Core loop: solve math equations to earn minerals × click power × combo multiplier; spend minerals on upgrades/miners; gem currency feeds gem upgrade lines; prestige ("sink a new shaft") resets a run for a permanent multiplier.

## Commands

All commands run from the repo root, using **pnpm** (no npm — the lockfile is
`pnpm-lock.yaml`):

| Command | Purpose |
| --- | --- |
| `pnpm start` | Start the Expo dev server |
| `pnpm run web` | Start dev server in web mode |
| `pnpm run android` / `pnpm run ios` | Run native app |
| `pnpm test` | Jest unit tests (`jest-expo` preset) |
| `pnpm run test:e2e` | Maestro e2e flows (`maestro/flows/`) — needs a connected Android device/emulator (Maestro CLI on PATH) |
| `pnpm run test:e2e:web` | Web e2e (Playwright): exports the static web build, then drives it headless — boot/free-path, rewarded-ads pipeline (stubbed loader + Google's documented `data-adbreak-test` test mode), and the full web IAP round-trip against stubbed Stripe/Pocketbase (`e2e/web/`, docs/store-integration.md §2.7). Hermetic: no live ad impressions, no live sidecar/Stripe traffic. |
| `pnpm run typecheck` | `tsc --noEmit` |
| `pnpm run lint` | ESLint (flat config, `eslint.config.mjs`) |
| `pnpm run deploy` | Manual deploy: export static web build to `dist/` and deploy to Cloudflare Pages via `wrangler pages deploy` (`predeploy` runs `expo export -p web`). **Changes pushed to `main` automatically trigger continuous deployment to Cloudflare Pages** (the Cloudflare Pages CI on the repo, not this script) — this command is the manual fallback. |
| `pnpm run play -- <cmd>` | Play Console CLI (`scripts/play/play.mjs`, Play Developer API v3): listings, images, tracks, AAB upload/release, one-time-product CRUD, and `sync-products` (push the listing TITLE/DESCRIPTION from `scripts/stripe/catalog.json` after a cosmetic is renamed or re-blurbbed; `--dry-run` prints the diff, `--titles-only` keeps the hand-written Play copy). Needs a service-account key (`./play-service-account.json`, gitignored, or `PLAY_SERVICE_ACCOUNT_JSON`) |
| `pnpm exec playstoress` | Play Store listing screenshots (`scripts/playstoress.mjs`): serves the web build (exports `dist/` if missing) through the e2e static server, drives headless Chromium at phone (824×1830), 7" tablet (1280×800) and 10" tablet (1920×1200), and captures main/upgrades/menu shots into `playstore-screenshots/` (gitignored). Re-links its own `.bin` shim on every `pnpm install` (postinstall) |
| `node scripts/screenshot.mjs` | Feature screenshots (`scripts/screenshot.mjs`): serves `dist/` (needs a web build first — run `pnpm run test:e2e:web` or `pnpm exec expo export -p web` once), seeds a RICH save (crew + gems + owned outfits with per-crew assignments) via localStorage, and captures `screenshots/main.png` (the vertical crew column + translucent UI) and `screenshots/shop.png` (the grid shop + wearer selector). Output in `screenshots/` (gitignored). Useful for visually checking visual changes without an emulator. |

**CI is currently disabled** — the workflow lives at `.github/workflows/ci.yml.disabled` (rename to `ci.yml` to re-enable). When enabled it gates on: typecheck, lint, and tests. Until CI runs, run `pnpm run typecheck`, `pnpm run lint`, and `pnpm test` locally before committing changes to code. The e2e workflow is **disabled** (too slow vs. manual testing, 2026-09-04): the definition lives at `.github/workflows/e2e-android.yml.disabled` — rename it back to `e2e-android.yml` to re-enable. It built the debug APK and ran the Maestro flows (`maestro/`) on fresh emulators (phone + 7"/10" tablet); while it's disabled, "the app still boots" is verified manually.

## Architecture

```
src/                       # All source
  app/                     # expo-router ROOT (set via expo-router plugin in app.config.ts).
    index.tsx              # Root screen: renders <MinesOfDoom/> in a Stack.Screen.
    +html.tsx              # Web document template (title/description) — one of the
                           # expo-router special files (+html/+api) that are filtered
                           # out of the route table, so it emits no HTML route.
                           # ONLY route files belong under src/app — every OTHER file
                           # (any extension, incl. tests/.d.ts) becomes a route, and
                           # the static web export emits an HTML page per route.
  components/              # Shared UI components (Button, Tooltip, BottomModal,
                           # IntegerInput, NumericKeypad, etc.)
  hooks/                   # Shared hooks (useLocalStorage)
  utils/                   # Pure utilities (format, math/equations, graphics)
  mines_of_doom/           # The game itself
    MinesOfDoom.tsx        # Main screen component
    Context.tsx            # Game React context (onTick)
    game.ts                # Core pure game logic / save data model (the "engine")
    cosmetics.ts           # Pickaxes, outfits, cave themes + the crew-column layout
                           # (rosterDisplay) and per-crew outfit overrides
    achievements.ts        # Achievement definitions/logic
    goals.ts               # Goal/quest definitions
    styles.ts              # Style constants
    components/            # Game-specific UI (MiningCanvas, Miner, EquationDisplay,
                           # AnswerInput, PurchaseButtons, SettingsPanel, ...)
    hooks/                 # useGameEngine, useEquations, useCombo, useSettings,
                           # useSounds, useMineTaps, useShakeInput, ...
    __test__/              # Unit tests for the pure logic modules
  __test__/                # Cross-cutting test suites (e.g. nativeStackWiring)
modules/unity-ads/         # Local Expo native module: the Unity Ads rewarded
                           # bridge (Kotlin, expo-modules-core). Android only;
                           # JS face is requireOptionalNativeModule, provider in
                           # src/mines_of_doom/unityAdProvider.ts. Rewarded ads
                           # run here after the 2026-10-01 AdMob→Unity switch
                           # (Play Families 5-second-close rule).
public/assets/             # Static assets (audio, icons, images) with index.ts barrel
android/                   # Prebuilt native project (Expo prebuild)
dist/                      # Web build output (generated, gitignored)
pb_hooks/                  # PocketBase sidecar (backend for cloud save / leaderboard /
                           # IAP verify-restore; logic.js, app.pb.js, storeVerify.js).
                           # Has its own tests (pb_hooks/__test__) — incl. the
                           # MAX_SAVE_VERSION pin against game.ts's saveVersion.
docs/                      # Planning docs (features.md, gap-ranking.md, todo.md)
```

**Key pattern:** game rules, costs, formulas, save data, and progression math live in pure,
framework-free TypeScript modules (`game.ts`, `cosmetics.ts`, `achievements.ts`, `goals.ts`,
`utils/*`). React hooks in `mines_of_doom/hooks/` bridge that logic into components.
Persistence goes through `hooks/useLocalStorage.ts` (AsyncStorage) with manual save +
autosave and offline-progress computation on load. When adding gameplay logic, prefer
extending the pure modules over embedding logic in components, and add/extend tests in
`mines_of_doom/__test__/` or alongside `utils/*`. Never add non-route files under
`src/app/` (see the architecture note above).

### Art (the art-pack seam)

All in-game sprites are generated — there are no character image files. Everything
that draws one (miner body, pickaxe, gem, ore chunk, debris shard) imports
`minerSpriteUri` / `pickaxeSpriteUri` / `debrisSpriteUri` / `gemSpriteUri` /
`mineralChunkSpriteUri` from **`src/utils/graphics/artPack.ts`**, never from
`pixelArt.ts` or `characterArt.ts` directly. An **art pack** supplies those five
builders; `ART_PACKS` registers the classic 16×16 `pixel` pack and the shipped 32×32
`papercut` pack (docs/art-directions.md), and `DEFAULT_ART_PACK_ID` /
`setActiveArtPack()` are the whole swap mechanism — one line changes the game's art,
and the old art is still there. Under the seam:

- `pixelArt.ts` — classic 16×16 grids (`buildMinerGrid` …) + the PNG encoder. The
  `pixel` pack is these builders unchanged; it also stays the debris shards.
- `characterArt.ts` — 32×32 label-map geometry (`minerLabels(shape)`) + the five
  art-direction renderers. The PICKAXE line has a shape axis too:
  `PickaxeCosmetic.tool` picks one of eight geometries (`characterArt.TOOLS`
  / `pickaxeLabels(tool)`) and the sprite cache is keyed on theme AND tool —
  don't collapse the tools back into one crescent. The SKIN line (the player's
  own slot) is the `SKINS` catalog in `mines_of_doom/cosmetics.ts` — a
  character is `MinerLook` (colorway) + `SkinShape` (silhouette: form /
  hatStyle / hair / build / outfit / gown / pretty / cute / beard / prop) —
  sold as shop cards and gated on `SaveData.selectedSkin` (saveVersion 14). It
  is GEM-ONLY until the store SKUs exist; see `docs/skin-line.md` and the note
  in `iaps.ts`. **A paid character is a CHARACTER**: the line's own test pins
  that no two skins share a drawn outline and none is drawn as the default
  miner, so a new skin needs a new SILHOUETTE, not a new palette. Two
  geometry rules worth knowing: `pretty: true` is the one-word "heroine"
  preset (slim build + long flicked lashes + brows + heavier blush), and
  authored hair is drawn even under a hat (a beanie no longer eats it) while
  an unauthored shape gets the default field (so the plain miner never grows
  a mane).
- `caveTiles.ts` — the cave background: a strip pipeline (336×24 row strips
  plus addressable foreground wall bands), with the rock/gap silhouette and
  rock body sampled at GLOBAL pixels through domain-warped value noise — per
  pixel, not per 24px tile — and the foreground walls addressed by absolute
  band like the rows. Both are load-bearing for "no visible patterns": don't
  reintroduce a per-tile or per-row decision, and don't give the wall a single
  repeating strip. The ROCK is the one part a direction changes, and it goes
  through the seam as a style name: `CAVE_ROCK_STYLES[art]` (classic = the
  10-step dithered ramp; papercut = `caveArt.paintPaperRock`, whose plane
  field is `rockPlaneValue` / `rockPlaneIndex` here). `buildCaveRow` /
  `buildCaveWall` default to `activeCaveArt()`, and the direction is in both
  cache keys. See docs/cave-art.md.
- `crewChars.ts` — EVERY purchasable miner is a named character, in three
  lines: `normal` (4 names, faces only, no aura — and `crewLookFor` lets an
  assigned outfit replace their clothes while they keep their own face),
  `fast` (4 names, working marks + motion motes + a rim light), `legendary`
  (6 names, grand marks + static motes + rim + ground glow). `MiningCanvas`
  hands every row `crewCharForIndex(kind, index).id`; the papercut pack
  renders the cast and the pixel pack ignores the id. Roster rows are the only
  consumers — a character is a hire, not a collectible, and the hire ORDER is
  the cast order. The aura language (mark + motes + light) is deliberately
  reserved for the gem tiers: don't put it on the ordinary hires.
- `shapeForLook(look)` is the game↔art mapping: `MinerLook`'s optional shape hints
  (`hair`/`outfit`/`beard`/`cute`, appended by `rollMinerLook` AFTER the color picks
  so existing saves' colors never move) drive the papercut silhouette, and it passes
  `tool: false` because `Miner` draws the swinging pickaxe as its own sprite.

### Cosmetics & the crew (mental model)

- **Player look** is a seeded sprite: `playerSeed` + selected outfit/pickaxe →
  `rollMinerLook` (`cosmetics.ts`). The custom-skin slot (device-local, not in the
  save) can additionally override the player's body/pickaxe sprites.
- **The crew column** (`rosterDisplay` in `cosmetics.ts`): a PURE layout — given
  normal/fast/legendary counts it picks which hires are visible (per-type caps;
  `ROSTER_ASSIGNABLE_SLOTS` = the normal-crew cap) and each row's depth-
  perspective scale. `MiningCanvas` stacks the items far-first in ONE centered
  column above the player. If you change the caps there, the shop's assignable
  slots follow automatically (the same constant).
- **Per-crew customization**: `SaveData.minerOutfits` maps a roster slot index
  (decimal string) → OWNED outfit id, sanitized on every load path
  (`sanitizeMinerOutfits`). The engine's `assignMinerOutfit`/`clearMinerOutfit`
  are owned-only and idempotent; MinesOfDoom filters the map to owned ids
  (`ownedMinerOutfits`) before it reaches the canvas and the shop. The shop's
  Outfits group has a "worn by" wearer selector (👤 You + hired slots) whose
  Wear/Revert buttons call those actions. Assignments survive a sunk shaft.
- **The shop** (`components/IapPanel.tsx`): grid cards for the pickaxe/outfit/
  cave-theme lines (2–3× previews; gem buy always; the cash pack is gated on
  the provider), rows for the custom-skin line (uploads/samples). The menu
  sheet deliberately has NO shop tab — this panel is the single purchase
  surface.
- **A paid cosmetic is a CHARACTER, not a palette** — the rule every paid line
  is measured against, and the one both catalogs' tests pin. Skins carry a
  `SkinShape`; outfits carry `OutfitCosmetic.shape` (the same axes minus
  tool/motes), AUTHORED rather than rolled, so the player's miner keeps one
  body per outfit while the colors still reroll per seed. `crown` (the mark
  over the headwear) rides on both a crew hire's cast and an outfit — a hire
  wears one because its line is premium, an outfit because the NAMESAKE needs
  it (horns for the oni, a plume for the knight), so a themed item that does
  not look like its name is a bug, and `cosmetics.test.ts` pins both the mark
  and the on-theme palette. `motes` (the aura) stays crew-only.
  `shapeForLook` carries the axes from the look, `minerSpriteUri`'s cache key
  includes them, and `rollMinerLook` copies them AFTER the color picks (never an
  extra `pick` — that would reshuffle every existing save's miner). See
  docs/outfit-line.md and docs/skin-line.md.

## Module Resolution (important — easy to get wrong)

This project uses **bare path-specifier imports** that resolve via three parallel
configurations. If you add new import aliases, you must keep all three in sync:

- `tsconfig.json` `paths`: `src/*` → `src/*`, `components/*` → `src/components/*`,
  `hooks/*` → `src/hooks/*`, `assets/*` → `./public/assets/*`
- `metro.config.js`: maps bare `assets` → `public/assets` (Metro has no tsconfig-paths
  support here); `experiments.tsconfigPaths: true` in `app.config.ts` lets Metro honor
  the tsconfig paths
- `jest.config.js` `moduleNameMapper`: `^src/(.*)$` → `<rootDir>/src/$1`

So test/source files import like `import ... from "src/mines_of_doom/game"` or
`from "assets/index"`. `modules/*` (the local Expo native modules, e.g.
`modules/unity-ads`) is a third alias: `tsconfig.json` paths + `jest.config.js`
moduleNameMapper, and Metro resolves it through `app.config.ts`'s
`experiments.tsconfigPaths` (no metro.config.js entry needed). Metro also blocks `android/.gradle`, `android/build`, and
`android/app/build` from watching (Windows file-watcher limit).

## Conventions

- **TypeScript strict mode** (`expo/tsconfig.base` + `strict: true`). No `any` unless
  unavoidable; typecheck is a CI gate.
- **Tests:** Jest via `jest-expo`, `testMatch: **/*.test.[jt]s?(x)`. Pure-logic tests
  live in `__test__/` dirs or next to their source (`utils/format.test.ts`). Only test
  pure logic; no component tests currently exist.
- **Player-facing strings are i18n:** English lives in
  `src/utils/i18n/en.ts` (the `content()` keys used via `useI18n`/`useContent`),
  Spanish in `src/utils/i18n/es.ts`. Add any new player-visible string to
  **both** files (keys are type-checked against `en.ts`, so a missing `es.ts`
  entry fails typecheck). `docs/` is intentionally not i18n.
- **E2E:** Maestro flows in `maestro/flows/` (config: `maestro/maestro.config.yaml`,
  appId must match `android.package` in `app.config.ts`). Selectors use `testID`s
  added to the components (e.g. `equation-display`, `depth-banner`, `onboarding-skip`)
  — don't match on emoji/text, which is data-driven. CI runs them only when
  the disabled workflow is re-enabled (`.github/workflows/e2e-android.yml.disabled`
  — rename to `e2e-android.yml`); locally: `pnpm run test:e2e` with a device
  booted, flows one at a time (parallel mode on a single emulator is
  unreliable — see `docs/blockers.md`). Machine setup for the flows (each of
  these was missing once already, so they are written down): Maestro from
  `curl -Ls "https://get.maestro.mobile.dev" | bash` (installs to
  `~/.maestro/bin`, already on PATH) and a JDK that HAS `javac` for it —
  the system JDK is a headless JRE, so point `JAVA_HOME` at the Temurin in
  `~/.jdks/`. A headless box needs
  `xvfb-run -a emulator -avd <name> -no-window -no-audio`, and the
  `save_reload` premise (no miners → no offline income across the relaunch)
  wants `adb shell pm clear <pkg>` first when the flows run in sequence.
  **Web e2e** (Playwright, `e2e/web/`, config `playwright.config.ts`):
  `pnpm run test:e2e:web` exports the web build first, then serves `dist/`
  from `e2e/web/server.mjs` (which injects Google's `data-adbreak-test="on"`
  test-mode flag into the AdSense loader tag — mock ads, no live ad
  requests) and runs `boot`/`ads`/`iap` specs. Ads and IAP are stubbed at
  the network layer (`e2e/web/stubs.ts`) — never add a test that makes a
  real ad impression or hits the live Stripe/Pocketbase; the live Stripe
  round-trip stays in `scripts/stripe/checkoutTest.mjs` (manual).
- **Lint:** flat ESLint config with typescript-eslint + react-hooks rules.
  Unused vars are *warn*, not error. Don't add new lint rules without discussion.
- **No state library** — plain React Context + hooks. Don't introduce Redux/Zustand
  etc. without discussion.
- **App config lives in `app.config.ts`** (not app.json): version/`versionCode`
  bumping, icons, router root, web static output. Bump `version` + `android.versionCode`
  together for new releases.
- **Docs:** `README.md` is the docs entry point — it links to the files under
  `docs/`; keep that link list in sync when adding/removing doc files.
  Update `docs/todo.md` when implementing
  or deferring planned features (deferred / platform-parallel work —
  currently the iOS release items — goes to `docs/backlog.md` instead). Write to `docs/blockers.md` when anything needing a decision is blocking implementation
- **Platform:** Web uses static export
  (`output: "static"` in `app.config.ts`), so routing/navigation must stay
  static-export-safe.
- **Android:** prefer mines-play-35 avd emulator (it has the Play Store).
  Ad testing needs no console-registered test device: the provider passes
  `testMode = !isProdEnvNow()`, and a `__DEV__` build runs the labeled
  dev-sim rather than the real SDK, so real ad checks are a release build

## Gotchas

- **Unity Ads ids are live on Android (2026-09-14):** `storeConfig.unityAds`
  holds Game ID `800386304` + one rewarded placement
  (`BP_Rewarded_Android`) shared by all four `AdKind`s, so
  `hasUnityAdsConfig()` is true and a PRODUCTION Android build shows the
  "watch" entry points. iOS stays empty (no native bridge). Two dashboard
  steps are now blocking rather than pre-launch: "Allow skip after 5
  seconds" on the placement, and the project's Designed for Families flag
  (`docs/store-integration.md` §1.1 steps 3–4) — the app can gate on ids but
  cannot enforce either.
- **Cash prices follow DEPTH, not gem cost.** Every cosmetic carries a
  `cashTier` (1–4 → `CASH_PRICE_USD`, $0.99–$3.99) meaning how much new art
  the item is; the store price is that tier, NOT the gem price. Already-sold
  items keep their launch price (a Stripe price object is immutable, so a
  re-tier would make the shop display one amount and charge another).
  Re-pricing a live item = new Stripe price + Play price change + tier move +
  re-paste of the `syncStripe.mjs` snippet; `syncStripe.mjs verify` (both
  modes) is the drift check. There is no gem-only line: every paid cosmetic
  has a pack.- **Save version discipline:** bumping `saveVersion` in `game.ts` requires a
  new entry in the `migrations` map AND a bump of `MAX_SAVE_VERSION` in
  `pb_hooks/logic.js` — `pb_hooks/__test__/logic.test.js` pins the two equal
  and fails the full suite otherwise (a cloud push with a newer version is
  REJECTED by the sidecar, by design).
- **Package manager is pnpm.** `.npmrc` sets `node-linker=hoisted` — Metro and
  the "jest in dependencies" setup below need a flat npm-like `node_modules`;
  don't switch back to pnpm's default isolated layout. `@types/node` is a
  direct devDependency on purpose: `tsconfig.json` `types: ["jest", "node"]`
  needs it resolvable from the root (it used to be transitive-only under npm).
- `public/` is also the web deploy source (`public/.nojekyll` is a now-useless leftover from the abandoned GitHub Pages era —
  GitHub Pages is no longer used; web is served by Cloudflare Pages, and `wrangler pages deploy dist` copies from dist).
  Don't treat `public/` as deletable.
- The `android/` directory is generated by `expo prebuild`; gradle build artifacts
  under it are committed in this repo's working tree but are lint/watch-blocked —
  don't edit generated files there manually.
- `android/app/build.gradle` sets `debuggableVariants = []` in the `react {}` block.
  This makes **debug** APKs embed the JS bundle
  (`assets/index.android.bundle`) so they boot standalone on an emulator without a
  Metro dev server. Without it, a debug APK with no Metro reachable shows the
  red box "Unable to load script" — which is exactly what breaks the e2e
  emulator flow. Dev mode (`pnpm run android`) is unaffected: a running Metro
  server is still preferred and hot-reload still works; the embedded bundle is
  only the fallback. Don't "clean up" this line. The same generated file also
  carries the Play upload-key release-signing block (loads the root
  `keystore.properties`); both patches are marked with comments in the file.
  `expo prebuild` wipes them, so they are re-applied **automatically** by the
  `./plugins/withDebugSigning` config plugin (enabled in `app.config.ts` →
  `plugins`), which runs on every prebuild and is idempotent — `expo prebuild
  --clean` reproduces the committed `build.gradle` byte-for-byte. Don't edit the
  patched regions by hand or remove the plugin; unit test:
  `plugins/__test__/withDebugSigning.test.js`.
- The Play upload keystore and its properties live at the **project root**
  (`my-upload-key.keystore` + `keystore.properties`, both gitignored) — never
  under `android/`, because `expo prebuild` clears that directory (it once
  wiped the old `android/keystore/` during the SDK 57 upgrade). If the keystore
  is ever lost, re-download it from Play Console → App integrity → App signing
  (see `docs/store-integration.md` §2.5).

## Guardrails (non-negotiable)

1. **F2P is viable, not just unpaywalled** — a free player reaches the same end-state as a spender, only possibly slower. Enforce via the free-path benchmark above; cosmetics are earnable, nothing is gated.
2. **Rewarded ads only**, and only where the player taps "watch". Interstitials and banners are off the table permanently, not just "for now".
3. **No dark patterns** — no fake scarcity ("offer ends in…"), no fake batteries, no accidental-purchase flows, no default-checked purchase options.
4. **Transparency** — the purchase page and ad opt-in buttons show plainly what they are; no misleading icons.
5. **Measure before scaling** — lightweight event logging (first-time-ad-view, IAP purchase, D1/D7 retention, free-path progress) before any UA spend.
6. **Compliance** — math idle games skew young: plan for a kid-safe age rating, and since ads reward minerals (a game item, not a real product), verify the ad SDK's kid-safety/`TAG_FOR_CHILD_DIRECTED_TREATMENT` setting for the chosen rating.
