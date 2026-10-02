# modules/unity-ads

Local Expo native module wrapping the **Unity Ads** Android SDK
(`com.unity3d.ads:unity-ads`) behind three functions: `isSupported`,
`initialize`, `showRewarded`.

Why it exists (and why it is hand-written): Google Play's Families policy bans
"rewarded or opt-in ads that are **not closeable after 5 seconds**", and the
AdMob rewarded unit cannot be made closeable in 5 s from the app side — that is
what got v1.0.10 rejected (2026-09-30, `docs/store-integration.md` §0). Unity
Ads *is* a Families Self-Certified Ads SDK and its rewarded **ad units** have
a documented **"Allow skip after 5 seconds"** setting (set on the ad unit, not
on the placement — placements inherit it) plus a per-app
**child-directed designation** that restricts demand to contextual ads, so the
same player-tapped rewarded flow is compliant for every age. See
`docs/store-integration.md` §1.1 for the dashboard runbook.

No maintained React Native Unity Ads SDK exists, and mediating through AdMob
would leave AdMob's own non-skippable demand in the waterfall — the same
rejection risk. Owning the AAR keeps 100% of demand on Unity's skip setting.

## Contract

```ts
showRewarded(placementId): Promise<"rewarded" | "closed" | "error">
```

- `rewarded` — the ad completed (the only path that grants the reward)
- `closed` — the player skipped via the 5-second close (no reward)
- `error` — no fill, load/show failure, or no Activity

Platform: **Android only**. Web never imports this file (Metro resolves
`unityAdProvider.web.ts` first) and iOS has no implementation yet
(`docs/backlog.md`).

Note on testing: a `__DEV__` build runs the **labeled dev-sim** provider
(`pickAdProvider` gives dev builds first refusal), so exercising this
module means running a **release** build. The provider passes
`testMode = !isProdEnvNow()`, so a release build served from a non-prod
domain talks to Unity's test inventory instead of live demand.