/**
 * Network stubs for the web e2e suite. Every external service the build
 * talks to is intercepted at the browser level (context.route), so a run
 * NEVER touches the live Pocketbase instance or the ad/Stripe domains,
 * except ONE deliberate case: the AdSense TEST-MODE test lets the real
 * loader script load from Google (the documented `data-adbreak-test` mode:
 * mock ads, no ad requests to Google servers — see server.mjs header).
 *
 * Two stub surfaces, mirroring the app's two external integrations
 * (docs/store-integration.md §2.7 / §2.10):
 *
 *  installAdStubs     — Ad Placement API (adsbygoogle). The loader RESPONSE
 *  is stubbed locally with a script implementing the exact push contract
 *  the app relies on (src/mines_of_doom/adSenseProvider.web.ts:
 *  `type:"reward"`, `beforeReward(showFn)` → `beforeAd` → `adViewed` →
 *  `afterAd`). Zero Google network.
 *
 *  installIapStubs    — Pocketbase sidecar + Stripe (the web IAP provider,
 *  src/mines_of_doom/iapProvider.web.ts): POST /stripe/checkout returns a
 *  stub session id; js.stripe.com returns a script whose
 *  redirectToCheckout navigates to the app's
 *  `?iap=success&iap_product=…&iap_sid=…` return URL; /api/app/verify mints
 *  the entitlement (like the real sidecar); /api/app/restore returns it.
 *  Everything else on the sidecar/Stripe domains aborts — the app must
 *  survive without its backends (resilience).
 */
import { expect } from "playwright/test";
import type { BrowserContext, Request } from "playwright";

/** The committed Pocketbase sidecar origin (storeConfig.ts). */
export const PB_BASE = "https://minesofdoom.minus4kelvin.com";

/**
 * Any domain that would mean a LIVE ad request — always blocked in e2e.
 * (The loader script itself, pagead2.googlesyndication.com/pagead/js/*,
 * is NOT an ad request and is handled separately.)
 */
const LIVE_AD_RE =
  /doubleclick\.net|googleadservices\.com|adservice\.google|adsystem\.google|googlesyndication\.com\/pagead\/lds/;

/** The ad-loader script URL emitted in +html.tsx. */
const AD_LOADER_RE =
  /pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js/;

// ---------------------------------------------------------------------------
// Ads
// ---------------------------------------------------------------------------

/**
 * The stub loader body. Implements the Ad Placement API contract the app
 * pushes (adSenseProvider.web.ts) with deterministic short timings:
 *   beforeReward(showFn) after 150ms → on showFn: beforeAd → (600ms "view")
 *   → adViewed → (50ms) → afterAd.
 * Records every callback into window.__e2eAdEvents so tests can wait on the
 * grant (adViewed) without UI-only heuristics.
 */
const AD_LOADER_STUB = `
(function () {
  var q = (window.adsbygoogle = window.adsbygoogle || []);
  window.__e2eAdEvents = window.__e2eAdEvents || [];
  var primeDelay = 150;
  var viewMs = 600;
  q.push = function (placement) {
    if (placement && placement.type === "reward") {
      setTimeout(function () {
        var log = function (name) {
          window.__e2eAdEvents.push(name);
        };
        if (typeof placement.beforeReward === "function") {
          placement.beforeReward(function () {
            log("beforeAd");
            if (typeof placement.beforeAd === "function") placement.beforeAd();
            setTimeout(function () {
              log("adViewed");
              if (typeof placement.adViewed === "function") placement.adViewed();
              setTimeout(function () {
                log("afterAd");
                if (typeof placement.afterAd === "function") placement.afterAd();
              }, 50);
            }, viewMs);
          });
        }
      }, primeDelay);
    }
    return q;
  };
})();
`;

export interface AdStubState {
  /** Ad loader script fetches served by the stub (one per page load). */
  loaderServed: number;
  /** Live ad-domain requests aborted by the guard (expected: none). */
  abortedLive: string[];
}

/**
 * Install the stubbed AdSense loader + the live-ad guard.
 * Returns state { loaderServed, abortedLive } for assertions.
 */
export async function installAdStubs(
  context: BrowserContext,
): Promise<AdStubState> {
  const state: AdStubState = { loaderServed: 0, abortedLive: [] };
  // Playwright matches routes in REVERSE registration order: register the
  // domain guard first, the loader stub after (so the stub wins).
  await context.route("https://**", (route) => {
    const url = route.request().url();
    if (AD_LOADER_RE.test(url)) return route.fallback();
    if (LIVE_AD_RE.test(url)) {
      state.abortedLive.push(url);
      return route.abort();
    }
    return route.fallback();
  });
  await context.route(AD_LOADER_RE, (route) => {
    state.loaderServed += 1;
    return route.fulfill({
      contentType: "text/javascript",
      body: AD_LOADER_STUB,
    });
  });
  return state;
}

/**
 * Guard only — for the TEST-MODE test, where the REAL loader must load from
 * Google (that's the point), but anything that would become a live ad
 * impression is aborted AND recorded so the test can fail on it.
 */
export async function installLiveAdGuard(
  context: BrowserContext,
): Promise<{ abortedLive: string[] }> {
  const state = { abortedLive: [] as string[] };
  await context.route("https://**", (route) => {
    const url = route.request().url();
    if (LIVE_AD_RE.test(url)) {
      state.abortedLive.push(url);
      return route.abort();
    }
    return route.fallback();
  });
  return state;
}

// ---------------------------------------------------------------------------
// IAP (Pocketbase sidecar + Stripe)
// ---------------------------------------------------------------------------

export interface IapStubState {
  /** Bodies of POST /stripe/checkout. */
  checkoutCalls: Record<string, unknown>[];
  /** Bodies of POST /api/app/verify. */
  verifyCalls: Record<string, unknown>[];
  /** Bodies of POST /api/app/restore. */
  restoreCalls: Record<string, unknown>[];
  /** Last minted checkout session (productId + session id). */
  lastSession: { productId: string; sessionId: string } | null;
  /** Entitlement store ids the verify stub has minted. */
  minted: Set<string>;
  /** Aborted sidecar/Stripe requests (the resilience assertion). */
  aborted: string[];
}

export function createIapStubState(): IapStubState {
  return {
    checkoutCalls: [],
    verifyCalls: [],
    restoreCalls: [],
    lastSession: null,
    minted: new Set<string>(),
    aborted: [],
  };
}

function bodyOf(request: Request): Record<string, unknown> {
  try {
    return JSON.parse(request.postData() ?? "{}");
  } catch {
    return {};
  }
}

/**
 * Catalog product id → store id (the server's entitlement key). Mirrors
 * iaps.ts (`storeId = "pack_" + cosmeticId`); keep in sync with PACK_SPECS.
 */
const PRODUCT_STORE_ID: Record<string, string> = {
  packGold: "pack_gold",
  packFrost: "pack_frost",
  packShadow: "pack_shadow",
  packNight: "pack_night",
  packGoldrush: "pack_goldrush",
  packCrystal: "pack_crystal",
  packMagma: "pack_magma",
  packBlocky: "pack_blocky",
  packSurface: "pack_surface",
  packKnight: "pack_knight",
  packHunter: "pack_hunter",
  packOni: "pack_oni",
  packMarmot: "pack_marmot",
  packFox: "pack_fox",
  packOtter: "pack_otter",
  packDamsel: "pack_damsel",
  packAmethyst: "pack_amethyst",
  packVerdant: "pack_verdant",
  packSolar: "pack_solar",
  packVoid: "pack_void",
  packVoxel: "pack_voxel",
  packWilds: "pack_wilds",
  packAshen: "pack_ashen",
  packGothic: "pack_gothic",
  packCherry: "pack_cherry",
  packSkin: "pack_skin",
};

export async function installIapStubs(
  context: BrowserContext,
  state: IapStubState,
): Promise<void> {
  // LIFO matching → register the catch-all aborts FIRST, specifics after.
  await context.route(`${PB_BASE}/**`, (route) => {
    state.aborted.push(route.request().url());
    return route.abort();
  });
  await context.route(/stripe\.(com|dev|io)/, (route) => {
    state.aborted.push(route.request().url());
    return route.abort();
  });

  await context.route(`${PB_BASE}/stripe/checkout`, (route) => {
    const body = bodyOf(route.request());
    state.checkoutCalls.push(body);
    if (
      typeof body.deviceId !== "string" ||
      !body.deviceId ||
      typeof body.productId !== "string" ||
      !(body.productId in PRODUCT_STORE_ID)
    ) {
      return route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "missing deviceId/productId" }),
      });
    }
    const sessionId = `cs_e2e_${body.productId}_${state.checkoutCalls.length}`;
    state.lastSession = {
      productId: body.productId,
      sessionId,
    };
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ sessionId }),
    });
  });

  await context.route(`${PB_BASE}/api/app/verify`, (route) => {
    const body = bodyOf(route.request());
    state.verifyCalls.push(body);
    // The real sidecar mints the entitlement on a confirmed session; mirror
    // it (web verify: token = the checkout session id).
    const storeId =
      typeof body.productId === "string"
        ? PRODUCT_STORE_ID[body.productId]
        : undefined;
    if (storeId && typeof body.token === "string") {
      state.minted.add(storeId);
    }
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });

  await context.route(`${PB_BASE}/api/app/restore`, (route) => {
    state.restoreCalls.push(bodyOf(route.request()));
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ entitlements: [...state.minted] }),
    });
  });

  // js.stripe.com — loaded by the provider AFTER the checkout POST, so the
  // stub can embed the just-created session and play the role of a
  // COMPLETED hosted checkout: navigate back to the app's success URL.
  await context.route(/js\.stripe\.com/, (route) => {
    const body = `
      window.Stripe = function () {
        return {
          redirectToCheckout: function () {
            var s = ${JSON.stringify(state.lastSession)};
            window.location.assign(
              window.location.origin +
                "/?iap=success&iap_product=" + encodeURIComponent(s.productId) +
                "&iap_sid=" + encodeURIComponent(s.sessionId),
            );
            return Promise.resolve();
          },
        };
      };
    `;
    return route.fulfill({ contentType: "text/javascript", body });
  });
}

export { expect };
