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
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (flat config, `eslint.config.mjs`) |
| `npm run deploy` | Export static web build to `dist/` and push via `gh-pages` (`predeploy` runs `expo export -p web`) |

**CI (`.github/workflows/ci.yml`) gates on: typecheck, lint, and tests.** All three must pass before committing changes to code.

## Architecture

```
apps/                      # expo-router ROOT (set via expo-router plugin in app.config.ts)
  index.tsx                # Root screen: renders <MinesOfDoom/> in a Stack.Screen
  AppContext.ts            # App-level React context (tick callbacks)
  components/              # Shared UI components (Button, Tooltip, DropdownMenu,
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
`mines_of_doom/__test__/` or alongside `utils/*`.

## Module Resolution (important — easy to get wrong)

This project uses **bare path-specifier imports** that resolve via three parallel
configurations. If you add new import aliases, you must keep all three in sync:

- `tsconfig.json` `paths`: `components/*` → `apps/components/*`, `hooks/*` → `apps/hooks/*`,
  `assets/*` → `./public/assets/*` (plus standard relative imports and `apps/*` from root)
- `metro.config.js`: maps bare `assets` → `public/assets` (Metro has no tsconfig-paths
  support here); `experiments.tsconfigPaths: true` in `app.config.ts` lets Metro honor
  the tsconfig paths
- `jest.config.js` `moduleNameMapper`: `^apps/(.*)$` → `<rootDir>/apps/$1`

So test/source files import like `import ... from "apps/mines_of_doom/game"` or
`from "assets/index"`. Metro also blocks `android/.gradle`, `android/build`, and
`android/app/build` from watching (Windows file-watcher limit).

## Conventions

- **TypeScript strict mode** (`expo/tsconfig.base` + `strict: true`). No `any` unless
  unavoidable; typecheck is a CI gate.
- **Tests:** Jest via `jest-expo`, `testMatch: **/*.test.[jt]s?(x)`. Pure-logic tests
  live in `__test__/` dirs or next to their source (`utils/format.test.ts`). Only test
  pure logic; no component tests currently exist.
- **Lint:** flat ESLint config with typescript-eslint + react-hooks rules.
  Unused vars are *warn*, not error. Don't add new lint rules without discussion.
- **No state library** — plain React Context + hooks. Don't introduce Redux/Zustand
  etc. without discussion.
- **App config lives in `app.config.ts`** (not app.json): version/`versionCode`
  bumping, icons, router root, web static output. Bump `version` + `android.versionCode`
  together for new releases.
- **Docs:** `docs/ux-and-feature-plan.md` is the feature roadmap;
  `docs/todo.md` tracks progress against it. Update `docs/todo.md` when implementing
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
- Number formatting is capped at Qi (1e30) by design (see `docs/todo.md` — BigInt
  for minerals is deliberately deferred). Don't "fix" large-number handling without
  revisiting that decision.
