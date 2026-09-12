/**
 * Shared production-faithful fake datastore for pb_hooks handler tests.
 *
 * The defining property (learned the hard way — F39.1 / Tier 1 #23): a
 * record handed back by a lookup is BOUND to its stored row. `set()` +
 * `save()` on a bound record mutates THAT stored row in place — exactly
 * what Pocketbase does. The earlier webhook-only fake modeled save() as
 * the INTENDED upsert ("one row per device+product"), so a deviceId-keyed
 * in-place rewrite could never clobber there: the fake pushed a second
 * row where Pocketbase mutates the found record. This fake is faithful in
 * the places that bit:
 *   - findFirstRecordByData(c, field, value) matches on the GIVEN field
 *     alone (whatever the handler passes) and returns a bound record;
 *   - set() + save() on a bound record mutates the stored row IN PLACE;
 *     save never de-duplicates, splits, or re-keys rows;
 *   - new Record(...) + save() appends a fresh row;
 *   - findRecordsByFilter evaluates the filter clauses, the sort spec,
 *     and the pageSize (so a "pageSize 1" probe really returns one row);
 *   - delete removes the bound row from the collection.
 *
 * The filter grammar modeled is exactly the clause set the handlers use:
 *   field = {:param} | field >= {:param} | field > {:param} | field < {:param}
 * joined by &&. Sort spec: "field,-field,..." (missing = insertion order).
 */
const crypto = require("crypto");
const path = require("path");

const HOOKS_DIR = path.join(__dirname, "..");

/** A record BOUND to a stored row: set() mutates the stored row in place. */
class StoredRecord {
  constructor(collName, row) {
    this.collection = { name: collName };
    this._row = row;
  }
  set(key, value) {
    this._row[key] = value;
  }
  get(key) {
    return this._row[key];
  }
}

/** A fresh, not-yet-persisted record (what the handler's `new Record` is). */
class NewRecord {
  constructor(collection, data) {
    this.collection = collection;
    this._data = { ...data };
    this._row = null;
  }
  set(key, value) {
    this._data[key] = value;
  }
  get(key) {
    return this._data[key];
  }
}

/** Evaluator for the Pocketbase filter clauses the handlers use. */
function matchFilter(row, filter, params) {
  const parts = String(filter)
    .split("&&")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const p of parts) {
    let m = p.match(/^(\w+) = \{:(\w+)\}$/);
    if (m) {
      if (row[m[1]] !== params[m[2]]) return false;
      continue;
    }
    m = p.match(/^(\w+) >= \{:(\w+)\}$/);
    if (m) {
      if (!(row[m[1]] >= params[m[2]])) return false;
      continue;
    }
    m = p.match(/^(\w+) > \{:(\w+)\}$/);
    if (m) {
      if (!(row[m[1]] > params[m[2]])) return false;
      continue;
    }
    m = p.match(/^(\w+) < \{:(\w+)\}$/);
    if (m) {
      if (!(row[m[1]] < params[m[2]])) return false;
      continue;
    }
    throw new Error("filter clause not modeled by the fake: " + p);
  }
  return true;
}

/** Compare rows per a Pocketbase sort spec ("-field,field,..." = desc,asc). */
function sortRows(rows, sort) {
  const specs = String(sort)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => ({ desc: s.startsWith("-"), field: s.replace(/^-/, "") }));
  if (specs.length === 0) return rows;
  return [...rows].sort((a, b) => {
    for (const { desc, field } of specs) {
      const av = a[field];
      const bv = b[field];
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv));
      if (cmp !== 0) return desc ? -cmp : cmp;
    }
    return 0;
  });
}

function makeApp() {
  const rows = {
    accounts: [],
    authSessions: [],
    entitlements: [],
    events: [],
    cloudSaves: [],
    leaderboard: [],
    passwords: [],
  };
  const app = {
    rows,
    /** Call log: every findRecordsByFilter's (coll, sort, pageSize, params). */
    calls: [],
    save(record) {
      if (record._row) {
        // Bound record: set() already mutated the stored row IN PLACE —
        // save is an in-place update (the Pocketbase behavior that made
        // the pre-fix clobber real).
        return record;
      }
      const coll = record.collection.name;
      rows[coll] = rows[coll] || [];
      const row = { ...record._data };
      rows[coll].push(row);
      record._row = row;
      return record;
    },
    findFirstRecordByData(coll, field, value) {
      const row = (rows[coll] || []).find((r) => r[field] === value) || null;
      return row ? new StoredRecord(coll, row) : null;
    },
    findRecordsByFilter(coll, filter, sort, pageSize, _page, params) {
      app.calls.push({
        coll: coll,
        filter: filter,
        sort: sort,
        pageSize: pageSize,
        params: params,
      });
      const matched = (rows[coll] || []).filter((r) =>
        matchFilter(r, filter, params),
      );
      const sorted = sortRows(matched, sort);
      const limited =
        Number.isInteger(pageSize) && pageSize > 0
          ? sorted.slice(0, pageSize)
          : sorted;
      return limited.map((r) => new StoredRecord(coll, r));
    },
    findCollectionByNameOrId(name) {
      return { name };
    },
    /** Test helper: seed a row directly (id lives in the data). */
    createRecord(name, data) {
      const coll = app.findCollectionByNameOrId(name);
      const rec = new Record(coll, data);
      return app.save(rec);
    },
    delete(record) {
      const arr = rows[record.collection.name] || [];
      const idx = arr.indexOf(record._row);
      if (idx >= 0) arr.splice(idx, 1);
    },
  };
  return app;
}

/**
 * Load the real handler library with the Pocketbase globals stubbed, the
 * same way the other pb_hooks suites do. `env` overrides the sidecar env
 * (pass { MDOOM_DEV_FAKE_TOKEN: "1" } for the offline verify stub).
 * Returns { lib, restore } — ALWAYS call restore() in afterEach.
 */
function loadHandlers(env = {}) {
  jest.resetModules();
  const saved = {};
  for (const key of ["MDOOM_DEV_FAKE_TOKEN", "MDOOM_SIDECAR_URL", "MDOOM_SIDECAR_SECRET"]) {
    saved[key] = process.env[key];
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }
  globalThis.__hooks = HOOKS_DIR;
  globalThis.Record = NewRecord;
  globalThis.$security = {
    sha256: (s) => crypto.createHash("sha256").update(s).digest("hex"),
    randomStringWithAlphabet: (length, alphabet) => {
      const buf = crypto.randomBytes(length);
      let out = "";
      for (let i = 0; i < length; i++) out += alphabet[buf[i] % alphabet.length];
      return out;
    },
  };
  const lib = require("../handlerLib");
  const restore = () => {
    for (const key of Object.keys(saved)) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  };
  return { lib, restore };
}

module.exports = {
  makeApp,
  loadHandlers,
  matchFilter,
  sortRows,
  StoredRecord,
  NewRecord,
};
