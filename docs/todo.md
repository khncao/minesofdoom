# Plan Progress — Mines of Doom

Tracks implementation of [`ux-and-feature-plan.md`](./ux-and-feature-plan.md).
Legend: [x] done (with notes) · [-] deferred (decision noted) · [ ] not started · [o] in progress

## Adjust

- [ ] Add scrollview to progress tracker
- [ ] Redesign purchaseable buttons so they don't take up the whole screen. Make them hideable/toggleable. Only show purchaseable when lifetime ever reached condition to purchase by default (allow certain options to always be visible)
- [ ] Fix lag and queued taps when tapping quickly

## Stability (§6.2)

- [-] **BigInt for minerals** — deferred. `formatNumber` covers up to Qi (1e30); switching needs a save-format migration + full audit. Revisit when `MAX_SAFE_INTEGER` is realistically in reach.
- [-] **App store cloud save** — deferred (needs store account).

## Monetization (§6.4)

- [ ] Rewarded-ads
- [ ] Add Google/Apple store SDK integrations for in app purchases, RevenueCat/ad SDKs
- [ ] Cosmetics such as unique player and pickaxe skins with unique sounds, animations, and other audio-visual

## Art / sprites (§6.6)

- [ ] Implement graphical homages to games such as Minecraft, Terraria, Dark Souls, Bloodborne, Sekiro as long as no copyright violation

## Completed

- [x] Reduce-motion (`useAccessibilityReduceMotion`) for debris/combo flash — done: web `matchMedia(prefers-reduced-motion)` hook; `useCombo` skips the flash spring and `DebrisParticles` skips bursts when set (no RN API on native; defaults to false there).
- [x] 44×44 tap targets — gear (BottomModal) and mute toggle now have 8px padding around the 30px glyph (≈46px hit area).
