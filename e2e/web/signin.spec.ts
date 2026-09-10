/**
 * Web Google sign-in (todo: verify the ID-client fix end to end).
 *
 * Hermetic: accounts.google.com/gsi/client is served the stub ID client
 * (installSignInStubs) whose prompt() hands the app a GENUINELY RS256-
 * SIGNED idToken, and POST /api/app/auth/google verifies that signature +
 * iss/aud/exp exactly like the real sidecar's JWKS leg — so the full
 * popup → credential → 200 → signed-in-UI leg runs with a real JWT on the
 * wire, zero Google/sidecar network.
 *
 * A fourth test (E2E_LIVE_GSI=1) loads the REAL GSI script and drives the
 * app's click path against it: the ID-client surface is live, the click
 * is crash-free, and no COOP window.closed warning appears. (A real
 * consent POPUP cannot be automated here: the current GSI prompt() is
 * FedCM-based and needs a Google account in the browser profile — the
 * residual "real account + live sidecar 200" leg is the manual ad-hoc
 * step recorded in docs/todo.md.)
 */
import { expect, test, type Page } from "playwright/test";
import { bootApp } from "./helpers";
import { GOOGLE_WEB_CLIENT_ID, installSignInStubs, PB_BASE } from "./stubs";

/** The e2e Google account the stub mints the idToken for. */
const E2E_EMAIL = "e2e-google@example.com";

interface GsiPageState {
  initializedWith: string | null;
  prompts: number;
  delivered: string | null;
}

const readGsiPageState = (
  page: Page,
): Promise<GsiPageState> =>
  page.evaluate(() => {
    const w = window as unknown as { __e2eGsi?: GsiPageState };
    return w.__e2eGsi ?? { initializedWith: null, prompts: 0, delivered: null };
  });

/** Menu (☰) → Account tab. */
async function openAccountTab(page: Page) {
  await page.getByTestId("menu-button").click();
  await page.getByTestId("menu-tab-account").click();
  await page.getByTestId("account-section").waitFor({ state: "visible" });
}

test.describe("web Google sign-in (stubbed GSI + sidecar, real RS256 JWT)", () => {
  test("grant: consent → signed idToken → sidecar 200 → signed-in UI", async ({
    page,
    context,
  }) => {
    const gsi = await installSignInStubs(context, {
      mode: "grant",
      email: E2E_EMAIL,
    });
    await bootApp(page);
    await openAccountTab(page);

    // Web renders the Google button (providerKindsForPlatform("web")).
    const googleBtn = page.getByTestId("account-google");
    await expect(googleBtn).toBeVisible();

    await googleBtn.click();

    // The app lazily injected the GSI script and initialized the ID client
    // with the pinned web client id — the same constant the JWT's aud and
    // the sidecar's GOOGLE_CLIENT_ID must equal.
    await expect
      .poll(async () => (await readGsiPageState(page)).initializedWith)
      .toBe(GOOGLE_WEB_CLIENT_ID);

    // The stub sidecar accepted the token only after a full RS256 verify
    // (signature + iss + aud + exp). Poll the recorded accept.
    await expect
      .poll(() => gsi.acceptedTokens.length, { timeout: 20_000 })
      .toBe(1);
    expect(gsi.lastClaims).toMatchObject({
      email: E2E_EMAIL,
      aud: GOOGLE_WEB_CLIENT_ID,
      iss: "https://accounts.google.com",
    });
    // The request body is the app's auth contract: idToken + deviceId.
    expect(gsi.authCalls[0].deviceId).toEqual(expect.any(String));

    // The credential crossed the wire and was accepted verbatim.
    const pageState = await readGsiPageState(page);
    expect(pageState.delivered).toBe(gsi.acceptedTokens[0]);
    expect(gsi.refusals).toEqual([]);

    // Signed-in branch: the account email shows, the Google button is
    // gone, sign-out is there.
    await expect(page.getByText(E2E_EMAIL)).toBeVisible();
    await expect(page.getByTestId("account-signout")).toBeVisible();
    await expect(page.getByTestId("account-google")).toBeHidden();
  });

  test("dismissed consent is SILENT: no inline error, button stays", async ({
    page,
    context,
  }) => {
    const gsi = await installSignInStubs(context, { mode: "cancel" });
    await bootApp(page);
    await openAccountTab(page);
    const googleBtn = page.getByTestId("account-google");
    await expect(googleBtn).toBeVisible();
    await googleBtn.click();

    // prompt() fired and delivered the documented popup_closed error…
    await expect.poll(async () => (await readGsiPageState(page)).prompts).toBe(
      1,
    );
    // …the sidecar never saw an auth request, and the UI stayed quiet:
    // no inline error, still on the sign-in branch.
    expect(gsi.authCalls).toEqual([]);
    await expect(googleBtn).toBeVisible();
    await expect(
      page.getByText("Sign-in failed — try again."),
    ).toBeHidden();
  });

  test("sidecar 401 (refused token) → the single inline error", async ({
    page,
    context,
  }) => {
    await installSignInStubs(context, { mode: "grant", email: E2E_EMAIL });
    // The GSI script stub stands, but the sidecar REFUSES everything —
    // the production shape that broke web sign-in ("malformed google
    // token", the exact 401 the token-client era produced). LIFO: a
    // route registered after installSignInStubs wins over its sidecar.
    await context.route(`${PB_BASE}/api/app/auth/google`, (route) => {
      return route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "malformed google token" }),
      });
    });
    await bootApp(page);
    await openAccountTab(page);
    const googleBtn = page.getByTestId("account-google");
    await expect(googleBtn).toBeVisible();
    await googleBtn.click();
    // The single inline error, and the app stays on the sign-in branch.
    await expect(
      page.getByText("Sign-in failed — try again."),
    ).toBeVisible({ timeout: 20_000 });
    await expect(googleBtn).toBeVisible();
  });
});

test.describe("web Google sign-in — LIVE GSI (E2E_LIVE_GSI=1 only)", () => {
  test("real GSI script: ID-client surface live, click crash-free, no COOP warning", async ({
    page,
    context,
  }) => {
    test.skip(
      process.env.E2E_LIVE_GSI !== "1",
      "live Google test — set E2E_LIVE_GSI=1 (loads accounts.google.com; never in CI)",
    );
    // The point of THIS test is the consent leg, not the credential:
    // abort every sidecar call so the run can never touch production auth.
    await context.route("https://minesofdoom.minus4kelvin.com/**", (route) =>
      route.abort(),
    );
    // Let ONLY the GSI script through on accounts.google.com, abort the
    // rest (no analytics/consent side-channels).
    await context.route(/accounts\.google\.com/, (route) => {
      if (/\/gsi\/client/.test(route.request().url())) return route.fallback();
      return route.abort();
    });

    const coop: string[] = [];
    // The static-export build has a PRE-EXISTING hydration mismatch at
    // boot (Minified React error #419 — the prerendered HTML vs client
    // render disagree; present without any sign-in interaction, see
    // docs/blockers.md). Assert on NEW errors only: baseline at boot,
    // diff after the GSI round-trip.
    const baseline: string[] = [];
    const after: string[] = [];
    let inAfterPhase = false;
    page.on("console", (msg) => {
      const text = msg.text();
      if (/window\.closed|cross-origin/i.test(text)) coop.push(text);
    });
    page.on("pageerror", (err) =>
      (inAfterPhase ? after : baseline).push(err.message),
    );

    await bootApp(page);
    await openAccountTab(page);
    const googleBtn = page.getByTestId("account-google");
    await expect(googleBtn).toBeVisible({ timeout: 30_000 });
    // Baseline = every pageerror the boot itself produces, GSI or not.
    await page.waitForTimeout(3000);
    inAfterPhase = true;

    // The app lazily injects the REAL script and runs the documented
    // ID-client flow (initialize + prompt) on click. A profile without a
    // Google account can't open the consent popup (FedCM: empty account
    // list) — that's the residual manual leg, not a failure here; the
    // contract is that the app drives the real surface without crashing.
    await googleBtn.click();
    // The real script must have stood up the ID-client surface (initialize
    // + prompt). A profile without a Google account can't open the consent
    // popup (FedCM: empty account list) — that leg stays manual — but the
    // app's contract here is: it drives the REAL surface, doesn't crash.
    await expect
      .poll(async () => {
        const w = await page.evaluate(() => {
          const w2 = window as unknown as {
            google?: { accounts?: { id?: { initialize?: unknown; prompt?: unknown } } };
          };
          const id = w2.google?.accounts?.id;
          return {
            hasId: id !== undefined,
            hasInit: typeof id?.initialize === "function",
            hasPrompt: typeof id?.prompt === "function",
          };
        });
        return w.hasId && w.hasInit && w.hasPrompt;
      }, { timeout: 30_000 }).toBe(true);

    // Give GSI time to settle (it either errors out or waits for a
    // consent that can't happen in this profile), then assert the app
    // is alive: the account tab still renders, the button is still there,
    // no React crash, and no COOP window.closed warning (the token-client
    // era's regression).
    await page.waitForTimeout(8000);
    await expect(page.getByTestId("account-section")).toBeVisible();
    await expect(googleBtn).toBeVisible();
    // No NEW uncaught errors from the GSI round-trip (baseline diffs
    // out the boot-time noise), and no COOP warning.
    const newErrors = after.filter((m) => !baseline.includes(m));
    expect(newErrors, `new uncaught errors: ${newErrors.join(" | ")}`).toEqual(
      [],
    );
    expect(coop, "COOP window.closed warning reappeared").toEqual([]);
  });
});
