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
| `pnpm run deploy` | Export static web build to `dist/` and deploy to Cloudflare Pages via `wrangler pages deploy` (`predeploy` runs `expo export -p web`) |
| `pnpm run play -- <cmd>` | Play Console CLI (`scripts/play/play.mjs`, Play Developer API v3): listings, images, tracks, AAB upload/release, one-time-product CRUD. Needs a service-account key (`./play-service-account.json`, gitignored, or `PLAY_SERVICE_ACCOUNT_JSON`) |

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
    cosmetics.ts           # Pickaxes, outfits, cave themes definitions
    achievements.ts        # Achievement definitions/logic
    goals.ts               # Goal/quest definitions
    styles.ts              # Style constants
    components/            # Game-specific UI (MiningCanvas, Miner, EquationDisplay,
                           # AnswerInput, PurchaseButtons, SettingsPanel, ...)
    hooks/                 # useGameEngine, useEquations, useCombo, useSettings,
                           # useSounds, useMineTaps, useShakeInput, ...
    __test__/              # Unit tests for the pure logic modules
  __test__/                # Cross-cutting test suites (e.g. nativeStackWiring)
public/assets/             # Static assets (audio, icons, images) with index.ts barrel
android/                   # Prebuilt native project (Expo prebuild)
dist/                      # Web build output (generated, gitignored)
docs/                      # Planning docs (ux-and-feature-plan.md, todo.md)
```

**Key pattern:** game rules, costs, formulas, save data, and progression math live in pure,
framework-free TypeScript modules (`game.ts`, `cosmetics.ts`, `achievements.ts`, `goals.ts`,
`utils/*`). React hooks in `mines_of_doom/hooks/` bridge that logic into components.
Persistence goes through `hooks/useLocalStorage.ts` (AsyncStorage) with manual save +
autosave and offline-progress computation on load. When adding gameplay logic, prefer
extending the pure modules over embedding logic in components, and add/extend tests in
`mines_of_doom/__test__/` or alongside `utils/*`. Never add non-route files under
`src/app/` (see the architecture note above).

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
`from "assets/index"`. Metro also blocks `android/.gradle`, `android/build`, and
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
  unreliable — see `docs/blockers.md`).
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
- **Android:** prefer mines-play-35 avd emulator as it has play store and is an admobs registered test device

## Gotchas

- **Package manager is pnpm.** `.npmrc` sets `node-linker=hoisted` — Metro and
  the "jest in dependencies" setup below need a flat npm-like `node_modules`;
  don't switch back to pnpm's default isolated layout. `@types/node` is a
  direct devDependency on purpose: `tsconfig.json` `types: ["jest", "node"]`
  needs it resolvable from the root (it used to be transitive-only under npm).
- `public/` is also the web deploy source (`public/.nojekyll` — a leftover from the GitHub Pages era, harmless on Cloudflare Pages,
  `wrangler pages deploy dist` copies from dist); don't treat `public/` as deletable.
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
