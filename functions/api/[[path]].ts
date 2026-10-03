/**
 * TEMPORARY legacy route: `/api/*` on the WEB origin → the API host.
 *
 * Exists so shipped builds that still point `storeConfig.pocketbaseUrl` at
 * `minesofdoom.minus4kelvin.com` (Android 1.0.9 on the Play production
 * track) keep working after the origin split. See `functions-lib/api-proxy.ts`
 * for the full rationale and the removal condition — DELETE BOTH FILES once
 * the 1.0.12 rollout has covered the last legacy install.
 */
import { proxyToApi } from "../../functions-lib/api-proxy";

interface EventContext {
  request: Request;
  // Pages fills this for the [[path]] catch-all; unused here because the
  // proxy rebuilds the URL from the request pathname.
  params: Record<string, string | string[]>;
}

export function onRequest(context: EventContext): Promise<Response> {
  return proxyToApi(context.request, "/api");
}