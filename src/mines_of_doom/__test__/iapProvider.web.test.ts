/**
 * The web IAP provider (iapProvider.web.ts) — Stripe Checkout redirect +
 * Pocketbase verify/restore. The provider's stripe.js loader caches a
 * module-level Promise, so each test re-requires the modules fresh
 * (jest.resetModules) and controls the `window` stub itself. storeConfig
 * is a plain const object: the tests flip its stripe block and restore it.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { IAP_STORE_IDS } from "../iaps";

const BASE = "https://pb.example.test";
const PK = "pk_test_abc123";
const STORE_ID = IAP_STORE_IDS.packGold;

type RedirectClient = { redirectToCheckout: jest.Mock };

/** Fresh module registry for the web provider + its config siblings.
 *  The AsyncStorage mock holds its state in module scope, so the provider
 *  (required after resetModules) and this test must share the SAME fresh
 *  instance — the top-level import is a different (stale) one. */
function loadWeb() {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { storeConfig } = require("../storeConfig");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const web = require("../iapProvider.web");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { IAP_PRODUCT_IDS: freshIds } = require("../iaps");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const freshAsync = require("@react-native-async-storage/async-storage");
  return { storeConfig, web, freshIds, freshAsync: freshAsync.default ?? freshAsync };
}

/** The mutable slice of storeConfig the provider reads. */
type ConfigShape = {
  pocketbaseUrl: string;
  stripe: { publishableKey: string; prices: Record<string, string> };
};

/** Fill the stripe block all-or-nothing (like the real config will be). */
function configureStripe(storeConfig: ConfigShape, ids: readonly string[]) {
  storeConfig.pocketbaseUrl = BASE;
  storeConfig.stripe.publishableKey = PK;
  storeConfig.stripe.prices = Object.fromEntries(
    ids.map((id) => [id, "price_" + id]),
  );
}

/** Empty the price map — the "unconfigured" state the gating tests need
 *  (the shipped config is now fully priced, so unconfigure explicitly). */
function unconfigureStripe(storeConfig: ConfigShape) {
  storeConfig.stripe.prices = {};
}

/** Yield to the microtask queue a few times (storage + provider). */
async function settle() {
  for (let i = 0; i < 12; i++) {
    await new Promise<void>((r) => setImmediate(() => r()));
  }
}

type FakeScript = {
  src?: string;
  async?: boolean;
  setAttribute: (k: string, v: string) => void;
  remove: () => void;
  /** True once remove() fired (the F58.2 dead-tag net). */
  removed: boolean;
  listeners: Record<string, (() => void)[]>;
  addEventListener: (ev: string, cb: () => void) => void;
  fire: (ev: string) => void;
};

type FakeWindow = {
  location: { origin: string };
  document: {
    querySelector: () => null;
    createElement: (tag: string) => FakeScript;
    head: { appendChild: (s: FakeScript) => void };
  };
  Stripe?: () => RedirectClient;
};

function makeWindow(
  overrides: { Stripe?: () => RedirectClient; pathname?: string } = {},
) {
  const created: FakeScript[] = [];
  const win: FakeWindow = {
    location: {
      origin: "https://mine.test",
      ...(overrides.pathname !== undefined
        ? { pathname: overrides.pathname }
        : {}),
    },
    ...overrides,
    document: {
      querySelector: () => null,
      createElement: () => {
        const s: FakeScript = {
          setAttribute: () => {},
          remove: () => {
            s.removed = true;
          },
          removed: false,
          listeners: {},
          addEventListener(ev: string, cb: () => void) {
            (s.listeners[ev] = s.listeners[ev] ?? []).push(cb);
          },
          fire(ev: string) {
            for (const cb of s.listeners[ev] ?? []) cb();
          },
        };
        created.push(s);
        return s;
      },
      head: { appendChild: (s: FakeScript) => void s },
    },
  };
  return { win, created };
}

/** The provider reads `window` off globalThis, so the stub is installed
 *  there (typed hops only — no naked any). */
function setWindow(win: FakeWindow) {
  (globalThis as unknown as { window: FakeWindow }).window = win;
}

function clearWindow() {
  delete (globalThis as unknown as { window?: unknown }).window;
}

const fetchMock = jest.fn();

beforeEach(async () => {
  fetchMock.mockReset();
  (global.fetch as jest.Mock) = fetchMock;
  clearWindow();
  await AsyncStorage.clear();
});

afterEach(() => {
  clearWindow();
  fetchMock.mockRestore();
});

describe("web provider: gating", () => {
  it("is available in the shipped state (key + full price map configured)", () => {
    const { web } = loadWeb();
    expect(web.storeIapProvider.isAvailable()).toBe(true);
  });

  it("is unavailable when the price map is emptied", () => {
    const { storeConfig, web } = loadWeb();
    unconfigureStripe(storeConfig);
    expect(web.storeIapProvider.isAvailable()).toBe(false);
  });

  it("stays unavailable when ONE catalog price is missing", () => {
    const { storeConfig, web, freshIds } = loadWeb();
    configureStripe(storeConfig, freshIds);
    delete storeConfig.stripe.prices[freshIds[freshIds.length - 1]];
    expect(web.storeIapProvider.isAvailable()).toBe(false);
  });

  it("purchase resolves 'error' (never rejects) while unconfigured", async () => {
    const { storeConfig, web } = loadWeb();
    unconfigureStripe(storeConfig);
    await expect(web.storeIapProvider.purchase("packGold")).resolves.toBe(
      "error",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("restore resolves {} while unconfigured", async () => {
    const { storeConfig, web } = loadWeb();
    unconfigureStripe(storeConfig);
    await expect(web.storeIapProvider.restore()).resolves.toEqual({});
  });

  it("grantsLocally is ALWAYS false (the web provider never self-grants)", () => {
    const { web } = loadWeb();
    expect(web.storeIapProvider.grantsLocally).toBe(false);
  });
});

describe("web provider: purchase redirect", () => {
  it("requests the session from the sidecar, then redirects with ONLY the session id", async () => {
    const { storeConfig, web, freshIds } = loadWeb();
    configureStripe(storeConfig, freshIds);
    const client: RedirectClient = { redirectToCheckout: jest.fn().mockResolvedValue({ id: "cs_1" }) };
    const { win } = makeWindow({ Stripe: () => client });
    setWindow(win);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ sessionId: "cs_test_abc" }),
    });

    await expect(web.storeIapProvider.purchase("packGold")).resolves.toBe(
      "purchased", // redirect started — NOT a payment confirmation
    );

    // Leg 1: the session-creation POST (device binding + product only —
    // the Price id and return URLs live on the server).
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, object];
    expect(url).toBe(`${BASE}/stripe/checkout`);
    const body = JSON.parse((init as { body: string }).body);
    expect(body.productId).toBe("packGold");
    expect(body.deviceId).toMatch(/^dev-/);
    // Leg 2: the redirect carries ONLY the session id (Stripe's current
    // validator rejects any other param alongside sessionId).
    expect(client.redirectToCheckout).toHaveBeenCalledTimes(1);
    expect(client.redirectToCheckout.mock.calls[0][0]).toEqual({
      sessionId: "cs_test_abc",
    });
  });

  it("resolves 'error' and never redirects when the sidecar refuses the session", async () => {
    const { storeConfig, web, freshIds } = loadWeb();
    configureStripe(storeConfig, freshIds);
    const client: RedirectClient = { redirectToCheckout: jest.fn() };
    const { win } = makeWindow({ Stripe: () => client });
    setWindow(win);
    // Non-2xx (e.g. the price map is not configured on the server).
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });

    await expect(web.storeIapProvider.purchase("packGold")).resolves.toBe(
      "error",
    );
    expect(client.redirectToCheckout).not.toHaveBeenCalled();
  });

  it("resolves 'error' when the sidecar reply has no valid session id", async () => {
    const { storeConfig, web, freshIds } = loadWeb();
    configureStripe(storeConfig, freshIds);
    const client: RedirectClient = { redirectToCheckout: jest.fn() };
    const { win } = makeWindow({ Stripe: () => client });
    setWindow(win);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ sessionId: "not-a-session" }),
    });

    await expect(web.storeIapProvider.purchase("packGold")).resolves.toBe(
      "error",
    );
    expect(client.redirectToCheckout).not.toHaveBeenCalled();
  });

  it("resolves 'error' when the redirect rejects (hosted page never opened)", async () => {
    const { storeConfig, web, freshIds } = loadWeb();
    configureStripe(storeConfig, freshIds);
    const client: RedirectClient = {
      redirectToCheckout: jest.fn().mockRejectedValue(new Error("nope")),
    };
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const { win } = makeWindow({ Stripe: () => client });
    setWindow(win);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ sessionId: "cs_test_abc" }),
    });

    await expect(web.storeIapProvider.purchase("packGold")).resolves.toBe(
      "error",
    );
    warn.mockRestore();
  });

  it("resolves 'error' when there is no window (never throws)", async () => {
    const { storeConfig, web, freshIds } = loadWeb();
    configureStripe(storeConfig, freshIds);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ sessionId: "cs_test_abc" }),
    });
    await expect(web.storeIapProvider.purchase("packGold")).resolves.toBe(
      "error",
    );
  });

  it("injects the stripe.js script once and resolves on its load event", async () => {
    const { storeConfig, web, freshIds } = loadWeb();
    configureStripe(storeConfig, freshIds);
    const client: RedirectClient = { redirectToCheckout: jest.fn().mockResolvedValue({ id: "cs_1" }) };
    const { win, created } = makeWindow(); // no window.Stripe yet
    setWindow(win);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ sessionId: "cs_test_abc" }),
    });

    const pending = web.storeIapProvider.purchase("packGold");
    await settle();
    // The script was created and attached.
    expect(created).toHaveLength(1);
    expect(created[0].src).toBe("https://js.stripe.com/v3/");
    // The script "loads": the Stripe global appears, then the load fires.
    win.Stripe = () => client;
    created[0].fire("load");
    await expect(pending).resolves.toBe("purchased");
    expect(client.redirectToCheckout).toHaveBeenCalledTimes(1);
  });

  it("detaches a failed script tag so a later attempt starts fresh (F58.2)", async () => {
    const { storeConfig, web, freshIds } = loadWeb();
    configureStripe(storeConfig, freshIds);
    const { win, created } = makeWindow();
    setWindow(win);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ sessionId: "cs_test_abc" }),
    });
    const pending = web.storeIapProvider.purchase("packGold");
    await settle();
    expect(created).toHaveLength(1);
    // The script fails (a blocked CDN / a DNS blip): the purchase errors
    // cleanly AND the dead tag is removed — reusing an errored element
    // would attach listeners that can never fire and stall the next
    // purchase's loadStripe (and its in-flight guard) until a refresh.
    created[0].fire("error");
    await expect(pending).resolves.toBe("error");
    expect(created[0].removed).toBe(true);
  });
});

describe("web provider: stripe.js loader retries (F41.1/F41.4)", () => {
  it("an errored tag is dropped and the next attempt loads a FRESH script", async () => {
    const { web } = loadWeb();
    const client: RedirectClient = { redirectToCheckout: jest.fn() };
    const { win, created } = makeWindow();
    setWindow(win);
    const first = web.loadStripe();
    created[0].fire("error");
    await expect(first).resolves.toBeNull();
    expect(created[0].removed).toBe(true);
    // The cache was reset: a second attempt injects a NEW element (the
    // dead one was detached, so this can no longer hang the shop).
    const second = web.loadStripe();
    expect(created).toHaveLength(2);
    win.Stripe = () => client;
    created[1].fire("load");
    await expect(second).resolves.toBe(client);
  });

  it("a script that never settles times out, and the retry starts fresh", async () => {
    jest.useFakeTimers();
    try {
      const { web } = loadWeb();
      const client: RedirectClient = { redirectToCheckout: jest.fn() };
      const { win, created } = makeWindow();
      setWindow(win);
      const first = web.loadStripe();
      jest.advanceTimersByTime(web.STRIPE_LOAD_TIMEOUT_MS);
      await expect(first).resolves.toBeNull();
      expect(created[0].removed).toBe(true);
      const second = web.loadStripe();
      expect(created).toHaveLength(2);
      win.Stripe = () => client;
      created[1].fire("load");
      await expect(second).resolves.toBe(client);
    } finally {
      jest.useRealTimers();
    }
  });

  it("a load that exposes no usable Stripe clears the cache for a retry (F41.4)", async () => {
    const { web } = loadWeb();
    const client: RedirectClient = { redirectToCheckout: jest.fn() };
    const { win, created } = makeWindow();
    setWindow(win);
    const first = web.loadStripe();
    // The tag settles but window.Stripe is still undefined (a partial
    // block that lets the script "load" without executing).
    created[0].fire("load");
    await expect(first).resolves.toBeNull();
    expect(created[0].removed).toBe(true);
    const second = web.loadStripe();
    expect(created).toHaveLength(2);
    win.Stripe = () => client;
    created[1].fire("load");
    await expect(second).resolves.toBe(client);
  });
});

describe("web provider: pending-verify queue (restore replay)", () => {
  it("noteCheckoutSuccess enqueues the (product, session) pair", async () => {
    const { web, freshAsync } = loadWeb();
    await web.storeIapProvider.noteCheckoutSuccess("packGold", "cs_42");
    const raw = await freshAsync.getItem(web.PENDING_VERIFY_KEY);
    expect(JSON.parse(raw as string)).toEqual([
      { productId: "packGold", token: "cs_42" },
    ]);
  });

  it("noteCheckoutSuccess dedupes repeats and ignores an empty session id", async () => {
    const { web, freshAsync } = loadWeb();
    await web.storeIapProvider.noteCheckoutSuccess("packGold", "cs_42");
    await web.storeIapProvider.noteCheckoutSuccess("packGold", "cs_42");
    await web.storeIapProvider.noteCheckoutSuccess("packGold", "");
    const raw = await freshAsync.getItem(web.PENDING_VERIFY_KEY);
    expect(JSON.parse(raw as string)).toEqual([
      { productId: "packGold", token: "cs_42" },
    ]);
  });

  it("restore replays the queue (verify) then returns the server entitlements", async () => {
    const { storeConfig, web, freshIds, freshAsync } = loadWeb();
    configureStripe(storeConfig, freshIds);
    await freshAsync.setItem(
      web.PENDING_VERIFY_KEY,
      JSON.stringify([{ productId: "packGold", token: "cs_42" }]),
    );
    const calls: string[] = [];
    fetchMock.mockImplementation(async (url: string) => {
      calls.push(url);
      return {
        ok: true,
        json: async () =>
          url.includes("/verify")
            ? { entitlements: [STORE_ID] }
            : { entitlements: [STORE_ID] },
      };
    });

    await expect(web.storeIapProvider.restore()).resolves.toEqual({
      packGold: true,
    });
    expect(calls).toEqual([`${BASE}/api/app/verify`, `${BASE}/api/app/restore`]);
    const raw = await freshAsync.getItem(web.PENDING_VERIFY_KEY);
    expect(JSON.parse(raw as string)).toEqual([]);
  });

  it("the verify POST carries the session id as token + the device id", async () => {
    const { storeConfig, web, freshIds, freshAsync } = loadWeb();
    configureStripe(storeConfig, freshIds);
    await freshAsync.setItem(
      web.PENDING_VERIFY_KEY,
      JSON.stringify([{ productId: "packGold", token: "cs_42" }]),
    );
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ entitlements: [STORE_ID] }),
    });

    await web.storeIapProvider.restore();
    const [url, init] = fetchMock.mock.calls[0] as [string, object];
    expect(url).toBe(`${BASE}/api/app/verify`);
    const body = JSON.parse((init as { body: string }).body);
    expect(body.productId).toBe("packGold");
    expect(body.token).toBe("cs_42");
    expect(body.deviceId).toMatch(/^dev-/);
    expect(body.platform).toMatch(/^(web|ios|android)$/);
  });

  it("keeps the queue entry when the verify POST fails", async () => {
    const { storeConfig, web, freshIds, freshAsync } = loadWeb();
    configureStripe(storeConfig, freshIds);
    await freshAsync.setItem(
      web.PENDING_VERIFY_KEY,
      JSON.stringify([{ productId: "packGold", token: "cs_42" }]),
    );
    fetchMock.mockImplementation(async (url: string) => ({
      ok: url.includes("/verify") ? false : true,
      json: async () =>
        url.includes("/verify") ? {} : { entitlements: [STORE_ID] },
    }));

    await web.storeIapProvider.restore();
    const raw = await freshAsync.getItem(web.PENDING_VERIFY_KEY);
    expect(JSON.parse(raw as string)).toEqual([
      { productId: "packGold", token: "cs_42" },
    ]);
  });

  it("restore maps only store ids we own (unknown ids are dropped)", async () => {
    const { storeConfig, web, freshIds } = loadWeb();
    configureStripe(storeConfig, freshIds);
    fetchMock.mockImplementation(async (url: string) => ({
      ok: true,
      json: async () =>
        url.includes("/verify")
          ? {}
          : { entitlements: [STORE_ID, "someone.elses.product", 42] },
    }));

    await expect(web.storeIapProvider.restore()).resolves.toEqual({
      packGold: true,
    });
  });
});
