# Plan Progress — Mines of Doom

Tracks implementation of [`ux-and-feature-plan.md`](./ux-and-feature-plan.md).
Legend: [x] done (with notes) · [-] deferred (decision noted) · [ ] not started · [o] in progress

## Stability (§6.2)

- [-] **BigInt for minerals** — deferred. `formatNumber` covers up to Qi (1e30); switching needs a save-format migration + full audit. Revisit when `MAX_SAFE_INTEGER` is realistically in reach.
- [-] **App store cloud save** — deferred (needs store account).

## Monetization (§6.4)

- [ ] Rewarded-ads
- [ ] Add Google/Apple store SDK integrations for in app purchases, RevenueCat/ad SDKs
- [ ] Cosmetics such as unique player and pickaxe skins with unique sounds, animations, and other audio-visual

## Art / sprites (§6.6)

- [ ] Implement graphical homages to games such as Minecraft, Terraria, Dark Souls, Bloodborne, Sekiro as long as no copyright violation

## Accessibility (2.2)

- [-] Reduce-motion (`useAccessibilityReduceMotion`) for debris/combo flash — small follow-up.
- [-] 44×44 tap targets — gear/mute are ~30px text; bump padding in a follow-up.
