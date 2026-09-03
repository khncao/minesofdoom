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
 * route is POST + JSON, device-scoped):
 *   /api/app/verify              → { entitlements: [storeId…] }
 *   /api/app/restore             → { entitlements: [storeId…] }
 *   /api/app/cloud/push          → { updatedAt }   // the STORED value
 *   /api/app/cloud/pull          → { snapshot: {…} | null }
 *   /api/app/leaderboard/submit  → { ok: true }
 *   /api/app/leaderboard/top     → { rows: [{ rank, displayName, bestDepth,
 *                                           maxCombo, achievementCount }] }
 *   /api/app/leaderboard/rank    → { entry: { rank, bestDepth } | null }
 *   /api/app/delete              → { ok: true }
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
route("cloud/push");
route("cloud/pull");
route("leaderboard/submit");
route("leaderboard/top");
route("leaderboard/rank");
route("delete");


