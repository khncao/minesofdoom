/**
 * Unit tests for the TEMPORARY legacy Pages-Function shim
 * (`functions-lib/api-proxy.ts`). The shim is security-adjacent plumbing on
 * the production origin, so the parts that matter are pinned here: what URL
 * the request lands on, which headers do NOT survive the hop, that bodies
 * and methods pass through untouched, that upstream error statuses are NOT
 * laundered into 200s, and that a dead API host fails loudly (502) instead
 * of hanging or pretending to succeed.
 */
import { API_ORIGIN, proxyToApi } from "./api-proxy";

interface Captured {
  url: string;
  init: RequestInit;
}

/** Stub global fetch, hand back `reply`, and record what was called. */
function stubFetch(reply: (captured: Captured) => Response | Promise<Response>) {
  const calls: Captured[] = [];
  const real = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const captured = { url: String(input), init: init ?? {} };
    calls.push(captured);
    return reply(captured);
  }) as typeof globalThis.fetch;
  return {
    calls,
    restore: () => {
      globalThis.fetch = real;
    },
  };
}

const jsonReply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "x-served-by": "pocketbase" },
  });

describe("legacy API shim", () => {
  it("forwards the full path, query and method to the API host", async () => {
    const stub = stubFetch(() => jsonReply({ entitlements: [] }));
    try {
      const res = await proxyToApi(
        new Request("https://minesofdoom.minus4kelvin.com/api/app/restore?x=1"),
        "/api",
      );
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({ entitlements: [] });

      expect(stub.calls).toHaveLength(1);
      // The family is re-attached, and the query survives verbatim.
      expect(stub.calls[0].url).toBe(`${API_ORIGIN}/api/app/restore?x=1`);
      expect(stub.calls[0].init.method).toBe("GET");
    } finally {
      stub.restore();
    }
  });

  it("keeps the POST body and its content-type, and strips hop-by-hop headers", async () => {
    const stub = stubFetch(() => jsonReply({ ok: true }));
    try {
      const request = new Request("https://minesofdoom.minus4kelvin.com/api/app/cloud/push", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          host: "minesofdoom.minus4kelvin.com",
          "cf-connecting-ip": "203.0.113.9",
          "x-mdoom-key": "abc",
        },
        body: JSON.stringify({ deviceId: "dev-1", blob: "{}" }),
      });
      const res = await proxyToApi(request, "/api");

      expect(res.status).toBe(200);
      const sent = stub.calls[0].init;
      expect(sent.method).toBe("POST");
      const headers = sent.headers as Headers;
      expect(headers.get("content-type")).toBe("application/json");
      // Real app-level headers MUST survive (the webhook route's shared key).
      expect(headers.get("x-mdoom-key")).toBe("abc");
      // Hop-by-hop bookkeeping must not.
      expect(headers.get("host")).toBeNull();
      expect(headers.get("cf-connecting-ip")).toBeNull();
      expect(headers.get("content-length")).toBeNull();
      // Body forwarded byte-for-byte.
      const body = sent.body as ArrayBuffer;
      expect(JSON.parse(new TextDecoder().decode(body))).toEqual({
        deviceId: "dev-1",
        blob: "{}",
      });
    } finally {
      stub.restore();
    }
  });

  it("serves the /stripe family too (browser Checkout POST from a legacy build)", async () => {
    const stub = stubFetch(() => jsonReply({ url: "https://checkout.stripe.com/x" }));
    try {
      await proxyToApi(
        new Request("https://minesofdoom.minus4kelvin.com/stripe/checkout", { method: "POST" }),
        "/stripe",
      );
      expect(stub.calls[0].url).toBe(`${API_ORIGIN}/stripe/checkout`);
    } finally {
      stub.restore();
    }
  });

  it("passes upstream error statuses through unchanged (fail-closed is preserved)", async () => {
    for (const status of [400, 401, 403, 409, 429, 500]) {
      const stub = stubFetch(() => new Response("nope", { status }));
      try {
        const res = await proxyToApi(
          new Request("https://minesofdoom.minus4kelvin.com/api/app/verify", { method: "POST" }),
          "/api",
        );
        // NOT 200 — a refusal must stay a refusal across the hop, or a
        // fail-closed backend would look like a success to the client.
        expect(res.status).toBe(status);
      } finally {
        stub.restore();
      }
    }
  });

  it("answers 502 (never a hang, never a fake success) when the API host is unreachable", async () => {
    const stub = stubFetch(() => {
      throw new TypeError("fetch failed");
    });
    try {
      const res = await proxyToApi(
        new Request("https://minesofdoom.minus4kelvin.com/api/health"),
        "/api",
      );
      expect(res.status).toBe(502);
      await expect(res.json()).resolves.toMatchObject({ error: "api_unreachable" });
    } finally {
      stub.restore();
    }
  });
});