/*
 * Pass 70 — direct handler tests for the DATA PLANE (the non-auth
 * handlers: cloud/push, cloud/pull, the leaderboard trio, and the GDPR
 * delete). Same approach as handlerVerify.test.js (the pass-69
 * entitlement-clobber regression): the handlers run against a
 * production-faithful in-memory datastore (./fakeDatastore.js — records
 * BOUND to their stored rows, so app.save mutates the row in place the
 * way PocketBase does on a live server).
 *
 * What these tests pin down:
 *  - cloud/push last-write-wins: an OLDER push never clobbers a newer
 *    stored blob; a newer one does.
 *  - cloud/pull session merge: a signed-in pull returns the NEWEST
 *    snapshot across every device linked to the account, not just the
 *    calling device's row.
 *  - leaderboard: submit is a merge (bests only ever go up, achievement
 *    sets union), top-N ordering + limit, rank = rows-above + 1.
 *  - GDPR delete: device scope wipes cloudSaves/leaderboard/events and
 *    PRESERVES entitlements (a refund/restore must survive); account
 *    scope additionally erases the account's entitlements, sessions,
 *    and the account row itself.
 */

const { makeApp, loadHandlers } = require("./fakeDatastore");

const DEVICE = "dev-alpha1";
const DAY_MS = 24 * 60 * 60 * 1000;

function pushBody(over = {}) {
  return {
    deviceId: DEVICE,
    blob: JSON.stringify({ depth: 100 }),
    saveVersion: 3,
    updatedAt: Date.now(),
    ...over,
  };
}

/** Seed a live account + valid session and return both records. */
function seedAccount(app, over = {}) {
  const account = app.createRecord("accounts", {
    id: over.accountId || "acc-1",
    email: "player@example.com",
    provider: "password",
    passwordHash: "x",
    googleId: "",
    appleId: "",
    createdAt: Date.now(),
  });
  const session = app.createRecord("authSessions", {
    id: over.sessionId || "sess-1",
    token: "tok-alpha-0123456789",
    accountId: account.get("id"),
    createdAt: Date.now(),
    expiresAt: Date.now() + 30 * DAY_MS,
  });
  return { account, session };
}

describe("cloud/push — last-write-wins", () => {
  let lib;
  let app;
  let restore;

  beforeEach(() => {
    ({ lib, restore } = loadHandlers());
    app = makeApp();
  });
  afterEach(() => restore());

  test("first push creates the device's cloudSaves row", () => {
    const now = Date.now();
    const r = lib.handlers["cloud/push"](app, pushBody({ updatedAt: now }));
    expect(r.status).toBe(200);
    expect(r.json.updatedAt).toBe(now);

    const row = app.findFirstRecordByData("cloudSaves", "deviceId", DEVICE);
    expect(row.get("blob")).toBe(JSON.stringify({ depth: 100 }));
    expect(row.get("saveVersion")).toBe(3);
    expect(row.get("updatedAt")).toBe(now);
  });

  test("an OLDER push is rejected in place: the newer stored blob survives", () => {
    const tNewer = Date.now();
    lib.handlers["cloud/push"](
      app,
      pushBody({ blob: JSON.stringify({ depth: 999 }), updatedAt: tNewer }),
    );
    const tOlder = tNewer - 60_000;
    const r = lib.handlers["cloud/push"](
      app,
      pushBody({ blob: JSON.stringify({ depth: 1 }), updatedAt: tOlder }),
    );
    expect(r.status).toBe(200);
    // The reply carries the STORED (newer) timestamp — the client
    // resyncs from the server, and the row keeps the newer blob.
    expect(r.json.updatedAt).toBe(tNewer);
    const row = app.findFirstRecordByData("cloudSaves", "deviceId", DEVICE);
    expect(row.get("blob")).toBe(JSON.stringify({ depth: 999 }));
  });

  test("a NEWER push replaces the stored blob", () => {
    lib.handlers["cloud/push"](
      app,
      pushBody({ updatedAt: Date.now() - 60_000 }),
    );
    const t = Date.now();
    lib.handlers["cloud/push"](
      app,
      pushBody({ blob: JSON.stringify({ depth: 42 }), updatedAt: t }),
    );
    const row = app.findFirstRecordByData("cloudSaves", "deviceId", DEVICE);
    expect(row.get("blob")).toBe(JSON.stringify({ depth: 42 }));
  });

  test("a device at the 30-writes/hour limit gets 429 and writes nothing", () => {
    // The budget counts the device's recent "write" event rows (the
    // limit is a logic constant — 30/hour — so seed the window full).
    for (let i = 0; i < 30; i++) {
      app.createRecord("events", {
        id: "ev-" + i,
        deviceId: DEVICE,
        kind: "write",
        payload: "",
        ts: Date.now(),
      });
    }
    const r = lib.handlers["cloud/push"](app, pushBody());
    expect(r.status).toBe(429);
    expect(
      app.findFirstRecordByData("cloudSaves", "deviceId", DEVICE),
    ).toBeNull();
  });

  test("invalid bodies are rejected without touching the datastore", () => {
    expect(
      lib.handlers["cloud/push"](
        app,
        pushBody({ deviceId: "bad id!" }),
      ).status,
    ).toBe(400);
    expect(
      lib.handlers["cloud/push"](app, pushBody({ blob: "{nope" })).status,
    ).toBe(400);
    expect(
      lib.handlers["cloud/push"](
        app,
        pushBody({ blob: JSON.stringify([1, 2]) }),
      ).status,
    ).toBe(400);
    expect(app.rows.cloudSaves).toHaveLength(0);
  });
});

describe("cloud/pull — device row + account merge", () => {
  let lib;
  let app;
  let restore;

  beforeEach(() => {
    ({ lib, restore } = loadHandlers());
    app = makeApp();
  });
  afterEach(() => restore());

  test("no data anywhere → snapshot null", () => {
    const r = lib.handlers["cloud/pull"](app, { deviceId: DEVICE });
    expect(r.status).toBe(200);
    expect(r.json.snapshot).toBeNull();
  });

  test("a signed-in pull takes the NEWEST row across the whole account", () => {
    const { account, session } = seedAccount(app);
    const t1 = Date.now() - 60_000;
    const t2 = Date.now();
    // The calling device's own row is the OLDER one — a stale sibling
    // device's push must win the merge.
    app.createRecord("cloudSaves", {
      id: "cs-self",
      deviceId: DEVICE,
      blob: JSON.stringify({ depth: 10 }),
      saveVersion: 3,
      updatedAt: t1,
      accountId: account.get("id"),
    });
    app.createRecord("cloudSaves", {
      id: "cs-sibling",
      deviceId: "dev-sibling2",
      blob: JSON.stringify({ depth: 777 }),
      saveVersion: 3,
      updatedAt: t2,
      accountId: account.get("id"),
    });

    const r = lib.handlers["cloud/pull"](
      app,
      { deviceId: DEVICE, sessionToken: session.get("token") },
      { authorization: "Bearer " + session.get("token") },
    );
    expect(r.status).toBe(200);
    expect(r.json.snapshot).toEqual({
      blob: JSON.stringify({ depth: 777 }),
      saveVersion: 3,
      updatedAt: t2,
    });
  });

  test("the caller's own row wins on a timestamp TIE (no sibling shadowing)", () => {
    const { account, session } = seedAccount(app);
    const t = Date.now();
    app.createRecord("cloudSaves", {
      id: "cs-self",
      deviceId: DEVICE,
      blob: JSON.stringify({ depth: 5 }),
      saveVersion: 3,
      updatedAt: t,
    });
    app.createRecord("cloudSaves", {
      id: "cs-sibling",
      deviceId: "dev-sibling2",
      blob: JSON.stringify({ depth: 777 }),
      saveVersion: 3,
      updatedAt: t,
      accountId: account.get("id"),
    });
    const r = lib.handlers["cloud/pull"](
      app,
      { deviceId: DEVICE, sessionToken: session.get("token") },
      { authorization: "Bearer " + session.get("token") },
    );
    expect(r.json.snapshot.blob).toBe(JSON.stringify({ depth: 5 }));
  });

  test("invalid deviceId → 400", () => {
    expect(
      lib.handlers["cloud/pull"](app, { deviceId: "" }).status,
    ).toBe(400);
  });
});

describe("leaderboard trio — submit merge, top-N, rank", () => {
  let lib;
  let app;
  let restore;

  beforeEach(() => {
    ({ lib, restore } = loadHandlers());
    app = makeApp();
  });
  afterEach(() => restore());

  function submit(over = {}) {
    return lib.handlers["leaderboard/submit"](
      app,
      {
        deviceId: DEVICE,
        displayName: "x",
        bestDepth: 10,
        maxCombo: 2,
        lifetimeMinerals: 3,
        achievementIds: [],
        ...over,
      },
    );
  }

  test("submit creates a row with a sanitized display name", () => {
    const r = submit({ displayName: "B\u0000O\u001bB!!" });
    expect(r.status).toBe(200);
    const row = app.findFirstRecordByData("leaderboard", "deviceId", DEVICE);
    expect(row.get("displayName")).toBe("BOB!!");
    expect(row.get("bestDepth")).toBe(10);
  });

  test("a second submit MERGES: bests only go up, achievement sets union", () => {
    submit({ bestDepth: 100, achievementIds: ["a1", "a2"] });
    // A lower depth must NOT downgrade the stored best; a new
    // achievement joins the set.
    submit({ bestDepth: 5, achievementIds: ["a3"] });
    const row = app.findFirstRecordByData("leaderboard", "deviceId", DEVICE);
    expect(row.get("bestDepth")).toBe(100);
    expect(JSON.parse(row.get("achievementIds")).sort()).toEqual([
      "a1",
      "a2",
      "a3",
    ]);
  });

  test("an out-of-range bestDepth is rejected", () => {
    expect(submit({ bestDepth: -1 }).status).toBe(400);
  });

  test("top returns best-first with 1-based ranks, capped by limit", () => {
    for (const [id, depth] of [
      ["dev-t1", 100],
      ["dev-t2", 300],
      ["dev-t3", 200],
    ]) {
      submit({ deviceId: id, bestDepth: depth });
    }
    const r = lib.handlers["leaderboard/top"](app, { limit: 2 });
    expect(r.status).toBe(200);
    expect(r.json.rows.map((row) => row.bestDepth)).toEqual([300, 200]);
    expect(r.json.rows.map((row) => row.rank)).toEqual([1, 2]);
  });

  test("rank counts strictly-above rows + 1 (ties share a rank)", () => {
    for (const [id, depth] of [
      [DEVICE, 200],
      ["dev-r2", 300],
      ["dev-r3", 200],
      ["dev-r4", 50],
    ]) {
      submit({ deviceId: id, bestDepth: depth });
    }
    const r = lib.handlers["leaderboard/rank"](app, { deviceId: DEVICE });
    expect(r.status).toBe(200);
    expect(r.json.entry).toEqual({ rank: 2, bestDepth: 200 });
  });
});

describe("delete — GDPR device scope + account scope", () => {
  let lib;
  let app;
  let restore;

  beforeEach(() => {
    ({ lib, restore } = loadHandlers());
    app = makeApp();
  });
  afterEach(() => restore());

  function seedDeviceData() {
    app.createRecord("cloudSaves", {
      id: "cs-1",
      deviceId: DEVICE,
      blob: "{}",
      saveVersion: 1,
      updatedAt: Date.now(),
    });
    app.createRecord("leaderboard", {
      id: "lb-1",
      deviceId: DEVICE,
      displayName: "d",
      bestDepth: 1,
      maxCombo: 1,
      lifetimeMinerals: 1,
      achievementIds: "[]",
      updatedAt: Date.now(),
    });
    app.createRecord("events", {
      id: "ev-1",
      deviceId: DEVICE,
      kind: "write",
      payload: "",
      ts: Date.now(),
    });
  }

  test("device scope wipes cloudSaves/leaderboard/events but PRESERVES entitlements", () => {
    seedDeviceData();
    app.createRecord("entitlements", {
      id: "ent-1",
      deviceId: DEVICE,
      productId: "pack_gold",
      platform: "android",
      tokenHash: "h",
      verifiedAt: new Date().toISOString(),
    });

    const r = lib.handlers.delete(app, { deviceId: DEVICE });
    expect(r.status).toBe(200);
    expect(r.json.deletedAccount).toBe(false);

    expect(
      app.findFirstRecordByData("cloudSaves", "deviceId", DEVICE),
    ).toBeNull();
    expect(
      app.findFirstRecordByData("leaderboard", "deviceId", DEVICE),
    ).toBeNull();
    expect(app.rows.events.filter((row) => row.get("deviceId") === DEVICE))
      .toHaveLength(0);
    // The refund/restore guarantee: entitlements survive a device-scope
    // erase.
    expect(
      app.findFirstRecordByData("entitlements", "deviceId", DEVICE),
    ).not.toBeNull();
  });

  test("account scope also erases the account's entitlements, sessions, and account row", () => {
    const { account, session } = seedAccount(app);
    seedDeviceData();
    app.createRecord("entitlements", {
      id: "ent-1",
      deviceId: DEVICE,
      productId: "pack_gold",
      platform: "android",
      tokenHash: "h",
      verifiedAt: new Date().toISOString(),
      accountId: account.get("id"),
    });

    const r = lib.handlers.delete(
      app,
      { deviceId: DEVICE, sessionToken: session.get("token") },
      { authorization: "Bearer " + session.get("token") },
    );
    expect(r.status).toBe(200);
    expect(r.json.deletedAccount).toBe(true);

    expect(app.rows.entitlements).toHaveLength(0);
    expect(app.rows.authSessions).toHaveLength(0);
    expect(app.rows.accounts).toHaveLength(0);
    expect(
      app.findFirstRecordByData("cloudSaves", "deviceId", DEVICE),
    ).toBeNull();
  });

  test("an anonymous device's data is untouched by another account's erase", () => {
    const { session } = seedAccount(app);
    seedDeviceData();
    const other = "dev-other9";
    app.createRecord("cloudSaves", {
      id: "cs-2",
      deviceId: other,
      blob: "{}",
      saveVersion: 1,
      updatedAt: Date.now(),
    });

    lib.handlers.delete(
      app,
      { deviceId: DEVICE, sessionToken: session.get("token") },
      { authorization: "Bearer " + session.get("token") },
    );

    expect(
      app.findFirstRecordByData("cloudSaves", "deviceId", other),
    ).not.toBeNull();
  });

  test("invalid deviceId → 400 and nothing is deleted", () => {
    seedDeviceData();
    expect(
      lib.handlers.delete(app, { deviceId: "nope nope" }).status,
    ).toBe(400);
    expect(
      app.findFirstRecordByData("cloudSaves", "deviceId", DEVICE),
    ).not.toBeNull();
  });
});
