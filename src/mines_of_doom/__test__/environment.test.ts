/**
 * Pure tests for the prod-env decision (environment.ts). The live
 * accessor (isProdEnvNow) reads window/__DEV__ and is covered
 * indirectly: under jest/jsdom the hostname is never the prod domain,
 * so every provider gate in the suite runs the non-prod path.
 */
import { PROD_WEB_DOMAIN, isProdEnv } from "../environment";

describe("isProdEnv (the prod-variables auto-enable switch)", () => {
  it("web: the exact prod domain is prod, whatever the dev flag says", () => {
    expect(isProdEnv({ isDev: false, hostname: PROD_WEB_DOMAIN })).toBe(true);
    // A dev-flagged bundle deployed to the prod domain is still the prod
    // environment — the hostname is the authoritative web signal.
    expect(isProdEnv({ isDev: true, hostname: PROD_WEB_DOMAIN })).toBe(true);
  });

  it("web: every other hostname is NOT prod", () => {
    const nonProd = [
      "localhost",
      "127.0.0.1",
      "192.168.1.20",
      // Cloudflare Pages preview subdomains (deploy previews are NOT prod)
      "4f2a9c--minesofdoom.pages.dev",
      "dev--minesofdoom.pages.dev",
      // Subdomain look-alikes are NOT the prod domain (exact match only).
      `www.${PROD_WEB_DOMAIN}`,
      `evil.${PROD_WEB_DOMAIN}`,
      `not${PROD_WEB_DOMAIN}`,
      "minesofdoom.pages.dev.evil.example",
    ];
    for (const hostname of nonProd) {
      expect(isProdEnv({ isDev: false, hostname })).toBe(false);
    }
  });

  it("native (no hostname): prod only for non-dev builds", () => {
    expect(isProdEnv({ isDev: true })).toBe(false);
    expect(isProdEnv({ isDev: false })).toBe(true);
  });
});
