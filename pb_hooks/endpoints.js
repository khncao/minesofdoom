"use strict";
/*
 * The /api/app/* route registration (Pocketbase v0.4x JS hooks API).
 *
 * v0.4x runtime model (the two rules this file is built around — see the
 * README "v0.4x hook model" section):
 *   1. Only *.pb.js files are executed by the app; everything else in this
 *      folder is plain CommonJS loaded with require() (paths must be
 *      absolute — goja resolves them against the CWD, so prefix __hooks).
 *   2. Every handler (router, on*, cron) runs in a POOLED, per-invocation
 *      JS runtime that only receives the handler's SOURCE. Module-level
 *      variables from this file are invisible inside a handler, so each
 *      handler arrow below is SELF-CONTAINED: it requires handlerLib.js
 *      (stateless) inside its body and delegates.
 *
 * All endpoint behavior (validation, merge rules, budget, record I/O)
 * lives in handlerLib.js / logic.js / storeVerify.js. Contract (every
 * route is POST + JSON, device-scoped; the data routes ALSO accept an
 * optional `sessionToken` — with a live session the row's account is
 * tagged and account-linked rows of other devices become reachable):
 *   /api/app/verify              → { entitlements: [storeId…] }
 *   /api/app/restore             → { entitlements: [storeId…] }
 *   /api/app/stripe/webhook      → { processed: bool }   // Stripe
 *                                // checkout.session.completed delivery.
 *                                // Fronted by the sidecar, which verifies
 *                                // the Stripe-Signature HMAC over the raw
 *                                // body and forwards with x-mdoom-key
 *                                // (= MDOOM_SIDECAR_SECRET); the route
 *                                // 403s anything else while the secret is
 *                                // configured. The body is still only an
 *                                // untrusted HINT — the mint gate is the
 *                                // sidecar's Stripe-API lookup (see
 *                                // handleStripeWebhook). Idempotent on the
 *                                // Stripe event id.
 *   /api/app/cloud/push          → { updatedAt }   // the STORED value
 *   /api/app/cloud/pull          → { snapshot: {…} | null }
 *   /api/app/leaderboard/submit  → { ok: true }
 *   /api/app/leaderboard/top     → { rows: [{ rank, displayName, bestDepth,
 *                                           maxCombo, achievementCount }] }
 *   /api/app/leaderboard/rank    → { entry: { rank, bestDepth } | null }
 *   /api/app/delete              → { ok: true, deletedAccount: bool }
 *
 * Optional login (anonymous device default — sign-in is never
 * prerequisite for anything; all three mechanisms share one provider-
 * agnostic account, email where it exists being the shared identity):
 *   /api/app/auth/register       { email, password, deviceId }
 *                                → { ok, token, account }  (409 taken)
 *   /api/app/auth/login          { email, password, deviceId }
 *                                → { ok, token, account }  (401 bad creds)
 *   /api/app/auth/google         { idToken, deviceId }
 *   /api/app/auth/apple          { idToken, deviceId }
 *                                → { ok, token, account }  (401 unverified)
 *   /api/app/auth/me             { token } → { account }
 *   /api/app/auth/logout         { token } → { ok: true }
 *   /api/app/auth/link           { token, deviceId } → { ok, account }
 *   /api/app/auth/set-password   { token, password, deviceId }
 *                                → { ok, account }  (attach/change the email
 *                                password on a signed-in account)
 *   /api/app/auth/link/google    { token, idToken, deviceId } → { ok, account }
 *   /api/app/auth/link/apple     { token, idToken, deviceId } → { ok, account }
 *                                (attach a provider identity to the signed-in
 *                                account — the deliberate direction of the
 *                                email/oauth2 merge; 409 provider-taken)
 * The sign-in routes backfill `accountId` on the device's existing rows
 * (claim, never copy — nothing is lost or duplicated). `/delete` with a
 * session token erases the account + every linked device (GDPR account
 * target: entitlements go too).
 *
 * /api/app/delete deliberately does NOT touch `entitlements` — a refund
 * or restore must remain possible after "delete my data" (the in-app
 * settings copy documents this).
 */

// The returned function's SOURCE is what executes inside the pooled
// handler runtime — it may only reference globals (require, __hooks), so
// the route name is baked straight into the source (a plain closure over a
// file-level variable would be invisible to the executor).
function makeHandler(name) {
  return new Function(
    "e",
    'const lib = require(__hooks + "/handlerLib.js"); lib.run(e, "/api/app/' +
      name +
      '", "' +
      name +
      '");',
  );
}

function route(name) {
  routerAdd("POST", "/api/app/" + name, makeHandler(name));
}

route("verify");
route("restore");
route("stripe/webhook");
route("cloud/push");
route("cloud/pull");
route("leaderboard/submit");
route("leaderboard/top");
route("leaderboard/rank");
route("delete");
route("auth/register");
route("auth/login");
route("auth/google");
route("auth/apple");
route("auth/me");
route("auth/logout");
route("auth/link");
route("auth/set-password");
route("auth/link/google");
route("auth/link/apple");


