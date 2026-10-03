/**
 * TEMPORARY compatibility shim — Cloudflare Pages Functions.
 *
 * WHY THIS EXISTS (2026-10-03): the production origin split in two. The web
 * app is Cloudflare Pages at `minesofdoom.minus4kelvin.com`; the backend
 * (Pocketbase + the sidecar) is the VPS at `api.minesofdoom.minus4kelvin.com`.
 * A build that predates the split hardcodes the OLD host as
 * `storeConfig.pocketbaseUrl` — and Android **1.0.9 is live on the Play
 * production track** with exactly that string baked in. With the old host now
 * serving static Pages files, every API call from those installs would hit
 * Pages and die (`POST /api/app/restore` → 405), taking cloud save,
 * leaderboard, Google sign-in and receipt verification with it.
 *
 * So these Functions re-expose the two backend prefixes on the web origin and
 * forward them to the API host. Old clients keep working, unchanged, while
 * new builds talk to `api.` directly (see `src/mines_of_doom/storeConfig.ts`).
 *
 * REMOVE THIS FILE once the 1.0.12 rollout has reached the last 1.0.9 user —
 * nothing should be calling the web origin's `/api` any more. Tracking:
 * `docs/blockers.md` ("FINAL TOPOLOGY"), `docs/todo.md`.
 *
 * This is a dumb byte-for-byte pipe, not a gateway: it adds no auth, no rate
 * limiting and no logging, and the API host's own protections (CORS, the
 * `x-mdoom-key` gate on the webhook route, per-device write budgets) are the
 * only ones in force — the same posture as the single-origin setup this
 * replaces. Nothing here is reachable that wasn't already public.
 */

/** The API host this shim forwards to (must match `storeConfig.pocketbaseUrl`). */
export const API_ORIGIN = "https://api.minesofdoom.minus4kelvin.com";

/**
 * Headers that describe the hop, not the message. `content-length` in
 * particular must go: the Workers runtime computes it from the body it is
 * about to send, and a stale value would truncate the forward.
 */
const STRIPPED_REQUEST_HEADERS = [
  "host",
  "content-length",
  "cf-connecting-ip",
  "cf-ipcountry",
  "cf-ray",
  "cf-visitor",
  "x-forwarded-for",
  "x-forwarded-proto",
];

/** How long to wait on the VPS before answering 502. PB is a single small
 *  binary; 20s is far above its real p99 and below the Workers CPU-free
 *  wall, so a hung box fails fast instead of holding a player request open. */
const UPSTREAM_TIMEOUT_MS = 20_000;

/**
 * Forward one request to the API host, keeping path, query, method, headers,
 * body and the upstream status/body byte-for-byte.
 *
 * `prefix` is the route family this Function owns (`/api` or `/stripe`) and
 * is re-attached to the upstream URL — Pages hands us only the matched
 * remainder in `context.params`, and rebuilding from the full pathname keeps
 * this helper independent of the routing syntax.
 */
export async function proxyToApi(request: Request, prefix: string): Promise<Response> {
  const incoming = new URL(request.url);
  // Re-attach the family: /api/app/restore → API_ORIGIN/api/app/restore.
  const path = `${prefix}${incoming.pathname.slice(prefix.length)}`;
  const target = `${API_ORIGIN}${path}${incoming.search}`;

  const headers = new Headers(request.headers);
  for (const name of STRIPPED_REQUEST_HEADERS) headers.delete(name);

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const body = hasBody ? await request.arrayBuffer() : undefined;

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body,
      // Stripe's webhook replies matter verbatim; never let the runtime
      // rewrite a 3xx or re-fetch a body behind our back.
      redirect: "manual",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: "api_unreachable", detail: reason }),
      {
        status: 502,
        headers: { "content-type": "application/json", "cache-control": "no-store" },
      },
    );
  }

  // Drop the upstream's own `content-encoding`/`content-length` bookkeeping:
  // the runtime re-encodes and re-measures whatever we hand back.
  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete("content-length");

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}