"use strict";
/*
 * Pocketbase custom-JS-hooks entry point for the Mines of Idle Doomath
 * backend. One deployment serves (docs/pocketbase-plan.md,
 * docs/store-integration.md):
 *
 *   - IAP receipt verification + entitlement records
 *       POST /api/app/verify, POST /api/app/restore
 *   - cloud saves
 *       POST /api/app/cloud/push, POST /api/app/cloud/pull
 *   - leaderboard
 *       POST /api/app/leaderboard/submit|top|rank
 *   - GDPR
 *       POST /api/app/delete
 *
 * All endpoints are device-scoped (no account) and live on private
 * collections (no list/view rules — only these hooks touch the rows).
 * The REST shapes are pinned by the clients in src/mines_of_doom/
 * (iapProvider.ts, cloudSave.ts, leaderboard.ts).
 *
 * Sandbox + production env vars: pb_hooks/README.md.
 */
require(__hooks + "/endpoints.js");
