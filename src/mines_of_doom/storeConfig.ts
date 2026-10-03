/**
 * The ONE place every store/SDK value is configured (runbook §1,
 * docs/store-integration.md).
 *
 * Rules:
 *  - **Empty string = unset.** The real providers read this module and fall
 *    back to the no-ops (entry points hidden) while their block is empty, so
 *    the repo stays buildable and shippable in every environment until the
 *    store ids exist.
 *  - **Native ad config lives here and nothing else** (the Unity Ads SDK is
 *    initialized from JS, so unlike AdMob there is NO app id to bake into a
 *    native manifest — the Game ID and placement ids travel as function
 *    arguments to modules/unity-ads). The one build-time mirror is the
 *    `stripAdvertisingId` flag read by plugins/withUnityAds.js.
 *  - **Server-side-only secrets live nowhere in this file** (the Play
 *    service-account JSON and Apple shared secret belong on the Pocketbase
 *    server — docs/pocketbase-plan.md).
 *  - The web build resolves the `.web` provider files and never bundles a
 *    native ad/purchase SDK. Web payments (Stripe Checkout) and the web
 *    AdSense banner follow the same empty-config = hidden rule (the
 *    `stripe` and `adsense` blocks below).
 */

/** The platforms a store/SDK value is keyed for (web is never keyed — Unity
 *  Ads has no web SDK at all, so web runs the AdSense no-op pair by
 *  construction: see `unityAdProvider.web.ts` + docs/store-integration.md
 *  §1.6). */
export type StorePlatform = "android" | "ios";

import type { AdKind } from "./ads";
import { isProdEnvNow } from "./environment";

export type UnityAdsIds = {
 /** The Unity Ads Game ID for this platform (Unity dashboard → the project's
  *  Game ID — a per-platform project, so android and ios differ). */
 gameId: string;
 /** The rewarded placement id per AdKind (Unity dashboard → Monetization →
  *  Ad units → Rewarded). Only rewarded placements exist in this app
  *  (guardrail 2); each `AdKind` (ads.ts) is its own placement so Unity can
  *  report them separately. */
 rewardedPlacementIds: Record<AdKind, string>;
};

export const storeConfig = {
 unityAds: {
  // Unity Ads (2026-10-01, replacing AdMob). WHY: Google Play rejected the
  // v1.0.10 update under the Families policies — "rewarded or opt-in ads
  // that are not closeable after 5 seconds" — and the AdMob rewarded unit
  // cannot be made closeable in 5 s from the app side (docs/store-integration
  // .md §0). Unity Ads IS a Families Self-Certified Ads SDK (unity-ads 4.0.1+)
  // and its rewarded AD UNIT carries a documented "Allow skip after 5
  // seconds" setting + a child-directed designation, so the SAME
  // player-tapped rewarded flow is compliant for every age — no neutral
  // age screen needed, no per-age branches.
  //
  // DASHBOARD SIDE (owner, docs/store-integration.md §1.1): the rewarded AD
  // UNIT that owns the placement below must have "Allow skip after 5 seconds"
  // (Monetization → Placements → expand the ad unit row → ⋮ on the AD UNIT
  // row; there is no separate "Ad Units" page, and the nested placement's own
  // menu does not carry the setting — placements only carry eCPM targets and
  // inherit the ad unit's format settings), and the project must be
  // designated "directed to children" on the project's Settings page →
  // Privacy controls (plus App store compliance → Google Designed for
  // Families, which auto-sets the age-limits filter to "13+ or stricter").
  // The app
  // cannot enforce the skip: unity-ads 4.20.1 exposes no skip-delay API, so
  // that ONE step gates the release. A single creative that ignores the skip
  // setting is one rejection, so verify on a real build before submitting.
  //
  // EMPTY = OFF (unchanged rule): with any of these empty,
  // isUnityAdsConfigured() is false → the no-op provider → every "watch"
  // entry point stays hidden.
  //
  // ANDROID IS LIVE (pasted 2026-09-14, owner's Unity project):
  //   Game ID 800386304, one rewarded placement (BP_Rewarded_Android) used
  //   by all four ad kinds — a rewarded video is a rewarded video, and one
  //   placement means one thing to configure, moderate and check on the
  //   dashboard. iOS stays EMPTY on purpose: the native bridge is Android
  //   only (modules/unity-ads), so an iOS set could never fill.
  //
  // __test__/storeConfig.test.ts pins the Android pair, pins iOS as still
  // empty, and keeps the no-test-id net honest (a Unity PUBLIC TEST
  // placement fills instantly on any device, so one must never ship).
  androidGameId: "800386304",
  iosGameId: "",
  rewardedPlacementAndroid: {
   gemRolls: "BP_Rewarded_Android",
   offlineDouble: "BP_Rewarded_Android",
   offlineTopUp: "BP_Rewarded_Android",
   comboSave: "BP_Rewarded_Android",
  },
  rewardedPlacementIos: {
   gemRolls: "",
   offlineDouble: "",
   offlineTopUp: "",
   comboSave: "",
  },
  // Guardrail 6 (kid safety) + the Play Families rule that ads shown to
  // children (or users of unknown age) must be non-personalized: contextual
  // demand only, no remarketing. Applied natively as
  // UnityAds.setNonBehavioral(true) BEFORE initialize (unityAdProvider.ts →
  // modules/unity-ads), so the very first request is already child-treated.
  // Every user is treated as a child on purpose — that is what makes ONE ad
  // surface valid for all ages (docs/store-integration.md §0 "Re-opened").
  // Flip to false ONLY together with a non-children target audience, a
  // personalization-capable stance (docs/blockers.md) and
  // `stripAdvertisingId` below — they are one decision, not three.
  childDirectedTreatment: true,
  // Mirrored into plugins/withUnityAds.js: remove the ad-id permissions the
  // Unity AAR merges in, so no ad code can read the advertising ID at all
  // (Play: children must not be sent the AAID). Keep true unless the stance
  // flips to a personalized teen+/adult posture; app.config.ts holds the
  // mirror and storeConfig.test.ts pins the two together.
  stripAdvertisingId: true,
 },
 // Self-hosted Pocketbase base URL — ONE deployment serves receipt
 // validation + entitlements (docs/pocketbase-plan.md) AND the store
 // integrations: cloud saves + leaderboard (docs/store-integration.md).
 // API-ONLY origin — the web app lives on its own host
 // (minesofdoom.minus4kelvin.com, the Cloudflare Pages custom domain), so
 // this is the dedicated `api.` subdomain Caddy fronts on the VPS. Splitting
 // the hosts is what lets the static build stay on Pages: nothing but `/api/*`
 // and the sidecar's browser-facing `/stripe/checkout` is reachable here.
 // Read by the IAP / cloud-save providers at call time. Empty = unset
 // (same rule as the ad ids): the real providers stay no-ops until it
 // lands. Server-side verification is fail closed (the sidecar carries no
 // store credentials yet — real purchases are refused, never faked);
 // cloud saves / leaderboard work as-is.
 // Deployed: ~/docker/pocketbase on the servarica VPS (Caddy TLS on the
 // api subdomain; hooks in pb_hooks/; sidecar on the internal network).
 // https://api.minesofdoom.minus4kelvin.com
 pocketbaseUrl: "https://api.minesofdoom.minus4kelvin.com",
 /**
  * Stripe (web IAP, docs/todo.md #1) — `publishableKey` is the account's
  * PUBLIC key (pk_…; safe in the bundle; the sk_ secret lives only in the
  * VPS sidecar env) and `prices` maps every catalog product id to its
  * Stripe Price id (price_…, Stripe dashboard → Products). The web IAP
  * provider is available only when isStripeConfigured() passes
  * (all-or-nothing, like Unity Ads) — a half-filled price map keeps the whole
  * shop hidden on web so no button can lead to a purchase that cannot
  * complete. Keyed by the catalog's internal product ids ("packGold",
  * "pickaxeGoldPack", … — iaps.ts IAP_PRODUCT_LIST).
  */
 stripe: {
  publishableKey:
   "pk_test_51UDFSrDPxWoXhXF89ljfKfug4SEnW89VOEfHZd49ymBwMZ5CkBrpbDplb9hBdTvFAoqb5tf5QWzMKWSR946fV2mn00MUoKKYIH",
  // Test-mode prices (sk_test/sk_ account, synced by
  // `node scripts/stripe/syncStripe.mjs products`). The sk_live flip at
  // launch re-syncs the live ids over these (§2.6 step 6).
  prices: {
   packGold: "price_1UDH4LDPxWoXhXF862vfpf9W",
   packFrost: "price_1UDH5rDPxWoXhXF8KJSAjz0T",
   packEmberbrand: "price_1ULsIDDPxWoXhXF8qO60s4by",
   packSledge: "price_1ULsIDDPxWoXhXF8rxlbjMol",
   packLanternhook: "price_1ULsIEDPxWoXhXF8fuv6gSTt",
   packShadow: "price_1UDH5rDPxWoXhXF8ZuJ1wQ8m",
   packPrism: "price_1ULsIFDPxWoXhXF87bUa8lCr",
   packNight: "price_1UDH5sDPxWoXhXF87A385cST",
   packGoldrush: "price_1UDH5sDPxWoXhXF85ddJqYJH",
   packCrystal: "price_1UDH5sDPxWoXhXF84KSohM56",
   packMagma: "price_1UDH5tDPxWoXhXF8QWD3Qtjj",
   packBlocky: "price_1UDH5tDPxWoXhXF8W28ok0BR",
   packSurface: "price_1UDH5tDPxWoXhXF8kYLGVloe",
   packKnight: "price_1UDH5uDPxWoXhXF8SalbCGuz",
   packHunter: "price_1UDH5uDPxWoXhXF8poynRols",
   packOni: "price_1UDH5uDPxWoXhXF8KeFubu8x",
   packMarmot: "price_1UDH5vDPxWoXhXF8XyKxdXhX",
   packFox: "price_1UDH5vDPxWoXhXF8wHG4Rhy8",
   packOtter: "price_1UDH5vDPxWoXhXF8x50CwKAc",
   packDamsel: "price_1UDH5wDPxWoXhXF8faIhyQxB",
   packAmethyst: "price_1UDH5wDPxWoXhXF8AIJZWawT",
   packVerdant: "price_1UDH5wDPxWoXhXF8zbLMB18l",
   packSolar: "price_1UDH5xDPxWoXhXF85E1hyVZL",
   packVoid: "price_1UDH5xDPxWoXhXF8SP1RkTGC",
   packVoxel: "price_1UDH5xDPxWoXhXF8M00cO66B",
   packWilds: "price_1UDH5yDPxWoXhXF8OxW6QCxA",
   packAshen: "price_1UDH5yDPxWoXhXF8k89wYQou",
   packGothic: "price_1UDH5yDPxWoXhXF8vT8zd0Jk",
   packCherry: "price_1UDH5zDPxWoXhXF873VrwPjR",
   packLanternCrew: "price_1ULsIIDPxWoXhXF8xBCRMlLo",
   packFrostBit: "price_1ULsIJDPxWoXhXF8Dgdewnku",
   packDeepSurvey: "price_1ULsIJDPxWoXhXF85iboBCM1",
   packShiftForeman: "price_1ULsIKDPxWoXhXF8iDJ4JPeh",
   packFoxCrew: "price_1ULsILDPxWoXhXF85eNi4lvP",
   packMarmotCrew: "price_1ULsILDPxWoXhXF8YmSzJsop",
   packRoseLantern: "price_1ULsIMDPxWoXhXF8yxLIqFd4",
   packMintComet: "price_1ULsIMDPxWoXhXF8SWliSo15",
   packSkyBob: "price_1ULsINDPxWoXhXF8dTAO7T5M",
   packTwinBells: "price_1ULsINDPxWoXhXF8DcuQfaoN",
   packBlossomBun: "price_1ULsIODPxWoXhXF8tBROvgPJ",
   packEmberSunrise: "price_1ULsIODPxWoXhXF8zPWcnOcA",
   packSkin: "price_1UEDJqDPxWoXhXF8WYfaEDSe",
  },
 },
 /**
  * Stripe PRODUCTION (live) variables — the launch-flip target
  * (docs/store-integration.md §2.6 step 6). The `stripe` block above
  * stays the non-prod (test-mode) variables; these are the live ones.
  * AUTO-ENABLED: `getActiveStripe()` serves this block instead of the
  * test one whenever the app detects the prod environment (environment.ts
  * — the prod web domain / a non-`__DEV__` native build) AND this block
  * is fully live-mode (`pk_live_` key, non-empty price map). The flip is
  * therefore "paste the `--live` snippet here" — no code switch, no
  * re-wiring; until it is pasted, prod falls back to the test block
  * (the pre-launch state) exactly as before.
  */
 stripeProd: {
  // Launch: `node scripts/stripe/syncStripe.mjs products --live` prints
  // this exact block (pk_live_ key + live price map, the §2.6 step-6
  // snippet). Flipped 2026-09-11 (key pasted at launch — the pk key is
  // public by design, safe in the bundle; the sk_ stays on the VPS).
  publishableKey:
   "pk_live_51UDFRhDBoBUcNBmBQG9yibrPv4tjH2fJXHuc1wDXMkxz7wwwjqxy3KJ7kUt3ydz0naVGxZf1a8QyZVAIxc0vyXbC00UnzaIcRs",
  prices: {
   packGold: "price_1UEaWODBoBUcNBmBW7km01os",
   packFrost: "price_1UEaWODBoBUcNBmBKcKPo0mC",
   packEmberbrand: "price_1ULsIVDBoBUcNBmBEqo6r6s4",
   packSledge: "price_1ULsIVDBoBUcNBmBNxt2mJap",
   packLanternhook: "price_1ULsIWDBoBUcNBmBRA8XfubQ",
   packShadow: "price_1UEaWPDBoBUcNBmBuZWshBIH",
   packPrism: "price_1ULsIWDBoBUcNBmB3PBU7qgS",
   packNight: "price_1UEaWQDBoBUcNBmB9qEKfbUl",
   packGoldrush: "price_1UEaWQDBoBUcNBmBCFb2oNlf",
   packCrystal: "price_1UEaWRDBoBUcNBmBerVyOlin",
   packMagma: "price_1UEaWRDBoBUcNBmBKHUmzMOP",
   packBlocky: "price_1UEaWSDBoBUcNBmBuw9VL2Uy",
   packSurface: "price_1UEaWSDBoBUcNBmBahuOtRXQ",
   packKnight: "price_1UEaWTDBoBUcNBmBJ0Crcnwr",
   packHunter: "price_1UEaWTDBoBUcNBmBNDdzscOs",
   packOni: "price_1UEaWUDBoBUcNBmB44drrXGT",
   packMarmot: "price_1UEaWUDBoBUcNBmBkvqIokC4",
   packFox: "price_1UEaWVDBoBUcNBmBqcUniAvD",
   packOtter: "price_1UEaWVDBoBUcNBmBscQN2g5k",
   packDamsel: "price_1UEaWWDBoBUcNBmBDQCOCeZA",
   packAmethyst: "price_1UEaWXDBoBUcNBmB8BREAVEn",
   packVerdant: "price_1UEaWXDBoBUcNBmBe3sV2dP4",
   packSolar: "price_1UEaWYDBoBUcNBmBFokxGaJ9",
   packVoid: "price_1UEaWYDBoBUcNBmB1iEeW8s7",
   packVoxel: "price_1UEaWZDBoBUcNBmBWXgDfwfE",
   packWilds: "price_1UEaWZDBoBUcNBmBrhyCBbGW",
   packAshen: "price_1UEaWaDBoBUcNBmBTcuYPTVD",
   packGothic: "price_1UEaWaDBoBUcNBmBNsARRHlP",
   packCherry: "price_1UEaWbDBoBUcNBmBXXib2IPX",
   packLanternCrew: "price_1ULsIaDBoBUcNBmBFYoaeFJF",
   packFrostBit: "price_1ULsIbDBoBUcNBmBRLoXtj3L",
   packDeepSurvey: "price_1ULsIbDBoBUcNBmBEmEyoj6E",
   packShiftForeman: "price_1ULsIcDBoBUcNBmBKZ8vsVHM",
   packFoxCrew: "price_1ULsIcDBoBUcNBmBCy22az3H",
   packMarmotCrew: "price_1ULsIdDBoBUcNBmBrMJFMHBo",
   packRoseLantern: "price_1ULsIdDBoBUcNBmBni01M9Q0",
   packMintComet: "price_1ULsIeDBoBUcNBmBg24UXuCf",
   packSkyBob: "price_1ULsIfDBoBUcNBmBPFLoASUU",
   packTwinBells: "price_1ULsIfDBoBUcNBmBeGwHbEgN",
   packBlossomBun: "price_1ULsIgDBoBUcNBmBMy5CcgXL",
   packEmberSunrise: "price_1ULsIgDBoBUcNBmBb6otZJSv",
   packSkin: "price_1UEaWbDBoBUcNBmBrrWiZzHq",
  } as Record<string, string>,
 },
 /**
  * AdSense (web rewarded ads, docs/todo.md #2) — the web parity path for
  * the Unity Ads rewarded placements, via the AdSense "Ad Placement API"
  * (H5 Games Ads): `client` is the publisher id (ca-pub-…) from the
  * AdSense dashboard. The Ad Placement API needs no per-unit slot id —
  * each rewarded placement (one per AdKind, see adSenseProvider.web.ts)
  * is a fresh `type: "reward"` adBreak on this client. While the client
  * is empty the feature is off end to end (the loader script in +html.tsx
  * simply isn't emitted and the provider reports unavailable). Rewarded
  * ads only, player-tapped (guardrail 2) — the old shop-sheet banner was
  * removed when web moved to rewarded-only (2026-09-07).
  */
 adsense: {
  client: "ca-pub-2101316086878618",
 },
};

/** The Unity Ads ids for one platform, straight out of the config. */
export function getUnityAdsIds(platform: StorePlatform): UnityAdsIds {
 if (platform === "ios") {
  return {
   gameId: storeConfig.unityAds.iosGameId,
   rewardedPlacementIds: storeConfig.unityAds.rewardedPlacementIos,
  };
 }
 return {
  gameId: storeConfig.unityAds.androidGameId,
  rewardedPlacementIds: storeConfig.unityAds.rewardedPlacementAndroid,
 };
}

/** Pure: ads are usable only when the Game ID is set AND every placement has
 *  an id — any entry point that could not fill must stay hidden. */
export function isUnityAdsConfigured(ids: UnityAdsIds): boolean {
 return (
  ids.gameId.length > 0 &&
  Object.values(ids.rewardedPlacementIds).every((id) => id.length > 0)
 );
}

/** The Pocketbase backend is configured — the IAP provider's
 *  `isAvailable()` gate AND the cloud-save/leaderboard providers' (empty
 *  = unset, same rule as the ad ids). Until the URL lands the purchase UI
 *  and the store integrations stay hidden. */
export function isPocketbaseConfigured(): boolean {
 return storeConfig.pocketbaseUrl.length > 0;
}

/**
 * AdSense is usable only when the publisher client is filled
 * (docs/todo.md #2). The client id is validated against the ca-pub-
 * prefix so a typo can't silently load someone else's account script.
 * Empty → the web ad feature is off end to end (no script tag, no
 * placements, no network) — the Ad Placement API needs nothing but the
 * client id, so no second value to half-fill.
 */
export function isAdSenseConfigured(
 client: string = storeConfig.adsense.client,
): boolean {
 return /^ca-pub-\d+$/.test(client);
}

/**
 * Stripe web IAP (docs/todo.md #1): enabled ALL-OR-NOTHING, like AdMob —
 * the publishable key must be set AND every id in `requiredIds` must have
 * a non-empty price. A half-configured account (some prices missing)
 * keeps the whole shop hidden on web, so no button can ever lead to a
 * purchase that cannot complete. Passing no arguments checks the live
 * storeConfig values (the default `requiredIds` is the key set of the
 * price map itself, so a caller with a full map gets the simple check).
 */
export function isStripeConfigured(
 publishableKey: string = storeConfig.stripe.publishableKey,
 prices: Record<string, string> = storeConfig.stripe.prices,
 requiredIds: readonly string[] = Object.keys(prices),
): boolean {
 return (
  /^pk_(test|live)_[A-Za-z0-9]+$/.test(publishableKey) &&
  requiredIds.every((id) => (prices[id] ?? "").length > 0)
 );
}

/**
 * The PRODUCTION Stripe variables are usable: a live-mode key AND a
 * non-empty price map whose values are all well-formed `price_…` ids.
 * Deliberately stricter than `isStripeConfigured` (which accepts
 * `pk_test_`): the prod block must carry REAL live values — a test key
 * pasted there is a config error, never an activation. The full-catalog
 * coverage check (`isStripeConfigured(…, IAP_PRODUCT_IDS)`) still runs
 * at the provider gates, so a half-pasted map keeps the shop hidden.
 */
export function isStripeProdConfigured(): boolean {
 const prod = storeConfig.stripeProd;
 return (
  /^pk_live_[A-Za-z0-9]+$/.test(prod.publishableKey) &&
  Object.keys(prod.prices).length > 0 &&
  Object.values(prod.prices).every((p) => /^price_[A-Za-z0-9]+$/.test(p))
 );
}

/**
 * The Stripe variables actually in effect RIGHT NOW (the auto-enable,
 * docs/todo.md "prod variables"): the `stripeProd` block when the app
 * is in the prod environment (environment.ts) AND it is fully live-mode
 * (`isStripeProdConfigured`); the test-mode `stripe` block otherwise
 * (dev server, previews, non-prod builds — and prod before the launch
 * flip, when the live block is still empty). Consumers read the
 * publishable key + price map ONLY through here, so the flip is a
 * data paste, not a code change.
 *
 * `isProd` is injectable for tests (defaults to `isProdEnvNow()`).
 */
export function getActiveStripe(isProd = isProdEnvNow()) {
 return isProd && isStripeProdConfigured()
  ? storeConfig.stripeProd
  : storeConfig.stripe;
}

/**
 * The Stripe Price id for a product, or "" when unconfigured (callers
 * must treat "" as "not buyable" and keep the button disabled/hidden).
 */
export function getStripePrice(
 productId: string,
 prices: Record<string, string> = storeConfig.stripe.prices,
): string {
 return prices[productId] ?? "";
}
