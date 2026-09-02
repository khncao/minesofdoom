# AGENTS.md

Guidance for AI agents working in this repository.

## Project Overview

**Mines of Doom** (package name `minesofdoom`) is an idle/clicker mining game built with **Expo (React Native 0.76)** and **expo-router**. It runs on web (deployed as a static site via GitHub Pages), Android, and iOS.

Core loop: solve math equations to earn minerals × click power × combo multiplier; spend minerals on upgrades/miners; gem currency feeds gem upgrade lines; prestige ("sink a new shaft") resets a run for a permanent multiplier.

## Commands

All commands run from the repo root:

| Command | Purpose |
|---|---|
| `npm start` | Start the Expo dev server |
| `npm run web` | Start dev server in web mode |
| `npm run android` / `npm run ios` | Run native app |
| `npm test` | Jest unit tests (`jest-expo` preset) |
| `npm run test:e2e` | Maestro e2e flows (`maestro/flows/`) — needs a connected Android device/emulator (Maestro CLI on PATH) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (flat config, `eslint.config.mjs`) |
| `npm run deploy` | Export static web build to `dist/` and push via `gh-pages` (`predeploy` runs `expo export -p web`) |

**CI (`.github/workflows/ci.yml`) gates on: typecheck, lint, and tests.** All three must pass before committing changes to code. A second workflow, `e2e-android.yml`, builds the debug APK and runs the Maestro e2e flows (`maestro/`) on a fresh Android emulator — the boot-up check (`maestro/flows/boot_up.yaml`) is the minimum bar for "the Android app still boots".

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
  AppContext.ts            # App-level React context (tick callbacks)
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
- **E2E:** Maestro flows in `maestro/flows/` (config: `maestro/maestro.config.yaml`,
  appId must match `android.package` in `app.config.ts`). Selectors use `testID`s
  added to the components (e.g. `equation-display`, `depth-banner`, `onboarding-skip`)
  — don't match on emoji/text, which is data-driven. CI runs them in
  `.github/workflows/e2e-android.yml`; locally: `npm run test:e2e` with a device
  booted.
- **Lint:** flat ESLint config with typescript-eslint + react-hooks rules.
  Unused vars are *warn*, not error. Don't add new lint rules without discussion.
- **No state library** — plain React Context + hooks. Don't introduce Redux/Zustand
  etc. without discussion.
- **App config lives in `app.config.ts`** (not app.json): version/`versionCode`
  bumping, icons, router root, web static output. Bump `version` + `android.versionCode`
  together for new releases.
- **Docs:** Update `docs/todo.md` when implementing
  or deferring planned features.
- **Platform:** portrait-only, light UI style. Web uses static export
  (`output: "static"` in `app.config.ts`), so routing/navigation must stay
  static-export-safe.

## Gotchas

- `jest` and `jest-expo` are listed under `dependencies` (not devDependencies) —
  leave them there; moving them breaks tooling assumptions in this repo.
- `public/` is also the GitHub Pages deploy source (`public/.nojekyll`,
  `gh-pages -t -d dist` copies from dist); don't treat `public/` as deletable.
- The `android/` directory is generated by `expo prebuild`; gradle build artifacts
  under it are committed in this repo's working tree but are lint/watch-blocked —
  don't edit generated files there manually.
- `android/app/build.gradle` sets `debuggableVariants = []` in the `react {}` block
  (RN 0.76 gradle plugin). This makes **debug** APKs embed the JS bundle
  (`assets/index.android.bundle`) so they boot standalone on an emulator without a
  Metro dev server. Without it, a debug APK with no Metro reachable shows the
  red box "Unable to load script" — which is exactly what breaks the e2e
  emulator flow. Dev mode (`npm run android`) is unaffected: a running Metro
  server is still preferred and hot-reload still works; the embedded bundle is
  only the fallback. Don't "clean up" this line.
- Number formatting is capped at Qi (1e30) by design (see `docs/todo.md` — BigInt
  for minerals is deliberately deferred). Don't "fix" large-number handling without
  revisiting that decision.

## Guardrails (non-negotiable)

1. **F2P is viable, not just unpaywalled** — a free player reaches the same end-state as a spender, only possibly slower. Enforce via the free-path benchmark above; cosmetics are earnable, nothing is gated.
2. **Rewarded ads only**, and only where the player taps "watch". Interstitials and banners are off the table permanently, not just "for now".
3. **No dark patterns** — no fake scarcity ("offer ends in…"), no fake batteries, no accidental-purchase flows, no default-checked purchase options.
4. **Transparency** — the Remove Ads purchase page and ad opt-in buttons show plainly what they are; no misleading icons.
5. **Platform gating** — Google Play requires IAP for digital goods; web build stays 100% free with no ad SDKs bundled at all.
6. **Measure before scaling** — lightweight event logging (first-time-ad-view, IAP purchase, D1/D7 retention, free-path progress) before any UA spend.
7. **Compliance** — math idle games skew young: plan for a kid-safe age rating, and since ads reward minerals (a game item, not a real product), verify the ad SDK's kid-safety/`TAG_FOR_CHILD_DIRECTED_TREATMENT` setting for the chosen rating.
