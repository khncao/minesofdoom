/**
 * TEMPORARY legacy route: `/stripe/*` on the WEB origin → the API host.
 *
 * The browser-facing hosted-Checkout POST (`/stripe/checkout`) is issued by
 * whichever build is running, so a legacy web build pointed at the old host
 * needs this prefix too. Stripe's own webhook delivery does NOT come through
 * here — the endpoint was repointed straight at `api.…/stripe/webhook`
 * (`scripts/stripe/syncStripe.mjs`).
 *
 * See `functions-lib/api-proxy.ts`; delete this file with it once no legacy
 * build remains.
 */
import { proxyToApi } from "../../functions-lib/api-proxy";

interface EventContext {
  request: Request;
  params: Record<string, string | string[]>;
}

export function onRequest(context: EventContext): Promise<Response> {
  return proxyToApi(context.request, "/stripe");
}