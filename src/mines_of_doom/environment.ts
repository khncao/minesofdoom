/**
 * Runtime "prod environment" detection — the one place the app decides
 * whether it is running in the production environment, so prod
 * variables (the live store values in storeConfig) auto-enable without
 * any per-build flag or manual paste.
 *
 * The signals, in order of authority:
 *  1. **Web: the deployed hostname.** The prod web app is the static
 *     export served from the production domain (`PROD_WEB_DOMAIN` —
 *     the Cloudflare Pages site now custom-domain-hosted at
 *     minesofdoom.minus4kelvin.com). Anything else — the dev server,
 *     the bare pages.dev URL, preview subdomains (`<hash>--…`),
 *     `localhost`, a file preview — is NOT prod. This is the authoritative web signal
 *     because a given export can be deployed anywhere (the same HTML
 *     is test-mode or prod by WHERE it is served, not how it was
 *     built).
 *  2. **Native: the build flag.** There is no web hostname on native;
 *     a release build (`!__DEV__`) is prod, a dev build is not.
 *
 * Keep the decision pure (`isProdEnv`) so it is unit-testable without
 * a DOM; `isProdEnvNow()` is the live accessor the store config reads.
 */

/** The production web deployment's exact hostname (Cloudflare Pages
 *  custom domain; the site is served from here and Pocketbase's
 *  /api/* routes to the VPS). Exact match only — preview subdomains,
 *  the bare pages.dev URL, and any other host are never prod. */
export const PROD_WEB_DOMAIN = "minesofdoom.minus4kelvin.com";

export interface EnvSignals {
 /** `__DEV__` — true in `expo start` / debug builds. */
 isDev: boolean;
 /** `window.location.hostname` on web. `undefined` = not a web
  *  context (native builds) — the dev flag decides there. */
 hostname?: string;
}

/** Pure prod-env decision (see module docs for the signal order). */
export function isProdEnv(signals: EnvSignals): boolean {
 if (signals.hostname !== undefined) {
  return signals.hostname === PROD_WEB_DOMAIN;
 }
 return !signals.isDev;
}

/** The live accessor: reads the real runtime signals. Safe to call
 *  from any module — a missing `window` (native) just falls through
 *  to the dev-flag rule. */
export function isProdEnvNow(): boolean {
 let hostname: string | undefined;
 if (typeof window !== "undefined" && window.location) {
  try {
   hostname = window.location.hostname;
  } catch {
   hostname = undefined;
  }
 }
 return isProdEnv({ isDev: __DEV__, hostname });
}
