# Mines of Doom

An idle/clicker mining game built with **Expo SDK 57 (React Native 0.86, new architecture)** and **expo-router**. Runs on web (static export, Cloudflare Pages), Android, and iOS.

**Core loop:** solve math equations to earn minerals × click power × combo multiplier; spend minerals on upgrades and miners; the gem currency feeds gem upgrade lines; prestige ("sink a new shaft") resets a run for a permanent multiplier.

## Getting started

```bash
pnpm install
pnpm start          # start the Expo dev server
pnpm run web        # dev server in web mode
pnpm run android    # run the Android app
pnpm run ios        # run the iOS app
```

## Useful commands

| Command | Purpose |
| --- | --- |
| `pnpm test` | Jest unit tests |
| `pnpm run test:e2e` | Maestro e2e flows (needs a booted Android device/emulator) |
| `pnpm run test:e2e:web` | Playwright web e2e (hermetic, stubbed ads/IAP) |
| `pnpm run typecheck` | `tsc --noEmit` |
| `pnpm run lint` | ESLint |
| `pnpm run deploy` | Static web export → Cloudflare Pages |

Use **pnpm** (not npm) — see `pnpm-lock.yaml` and `.npmrc`.

## Documentation

- [AGENTS.md](AGENTS.md) — agent guidance: commands, architecture, conventions, gotchas, guardrails
- [docs/features.md](docs/features.md) — feature overview
- [docs/todo.md](docs/todo.md) — planned / in-progress features
- [docs/backlog.md](docs/backlog.md) — deferred work
- [docs/blockers.md](docs/blockers.md) — items needing a decision
- [docs/gap-ranking.md](docs/gap-ranking.md) — gap analysis / prioritization
- [docs/art-styles.md](docs/art-styles.md) — generated art style drafts (contact sheets)
- [docs/art-detail.md](docs/art-detail.md) — detail pass drafts (more detailed generated pixel art)
- [docs/store-integration.md](docs/store-integration.md) — Play Store, ads, and IAP setup
- [docs/pocketbase-plan.md](docs/pocketbase-plan.md) — PocketBase backend plan
- [docs/security-audit.md](docs/security-audit.md) — security notes

## Testing

- **Unit:** Jest (`jest-expo`), pure-logic tests in `src/mines_of_doom/__test__/` and `src/utils/`.
- **E2E (Android):** Maestro flows in `maestro/flows/`, driven off `testID`s — see `docs/blockers.md` for parallel-mode caveats.
- **E2E (web):** Playwright in `e2e/web/`; ads and IAP are stubbed at the network layer, never live.
