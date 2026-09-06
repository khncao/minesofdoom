/**
 * Tests for secureRandomHex (pb_hooks/handlerLib.js) — the CSPRNG-backed
 * random-hex helper used for security-critical material (session tokens,
 * password salts, account ids). Two paths are exercised:
 *   - CSPRNG path: $security.randomStringWithAlphabet is present (the real
 *     Pocketbase goja runtime). A node:crypto-backed stand-in is injected.
 *   - Fallback path: $security lacks randomStringWithAlphabet (an older
 *     runtime). secureRandomHex must degrade to logic.randomHex (Math.random)
 *     and still return well-formed hex of the right length.
 *
 * handlerLib requires its siblings via the Pocketbase-only `__hooks` global,
 * so (like the other handler tests) we set it to this dir's parent before a
 * fresh require. secureRandomHex reads globalThis.$security at CALL time, so
 * each test loads a fresh module with its own $security.
 */
const crypto = require("crypto");
const path = require("path");

const HOOKS_DIR = path.join(__dirname, "..");
const logic = require(path.join(HOOKS_DIR, "logic.js"));

/** A minimal Record stand-in (handlerLib constructs records on save). */
class FakeRecord {
  constructor(collection, data) {
    this.collection = collection;
    this._data = { ...data };
  }
  set(key, value) {
    this._data[key] = value;
  }
  get(key) {
    return this._data[key];
  }
}

/** Fresh handlerLib with a specific $security global. */
function loadWithSecurity(security) {
  jest.resetModules();
  globalThis.__hooks = HOOKS_DIR;
  globalThis.Record = FakeRecord;
  globalThis.$security = security;
  const lib = require("../handlerLib");
  return lib;
}

/** node:crypto-backed CSPRNG, mirroring $security.randomStringWithAlphabet. */
function makeCsprngSecurity() {
  return {
    sha256: (s) => crypto.createHash("sha256").update(s).digest("hex"),
    randomStringWithAlphabet: (length, alphabet) => {
      const buf = crypto.randomBytes(length);
      let out = "";
      for (let i = 0; i < length; i++) out += alphabet[buf[i] % alphabet.length];
      return out;
    },
  };
}

/** An older runtime: only sha256, no CSPRNG helper. */
function makePrngOnlySecurity() {
  return {
    sha256: (s) => crypto.createHash("sha256").update(s).digest("hex"),
  };
}

describe("secureRandomHex (pb_hooks/handlerLib.js)", () => {
  test("CSPRNG path: 2*byteCount lowercase hex chars for each security-critical size", () => {
    const lib = loadWithSecurity(makeCsprngSecurity());
    // Mirror the three call sites in handlerLib.js (session token / salt /
    // account id) using the real constants so a constant drift fails loudly.
    expect(lib.secureRandomHex(logic.SESSION_TOKEN_BYTES)).toMatch(
      new RegExp("^[0-9a-f]{" + logic.SESSION_TOKEN_BYTES * 2 + "}$"),
    );
    expect(lib.secureRandomHex(logic.PASSWORD_SALT_BYTES)).toMatch(
      new RegExp("^[0-9a-f]{" + logic.PASSWORD_SALT_BYTES * 2 + "}$"),
    );
    expect(lib.secureRandomHex(logic.ACCOUNT_ID_BYTES)).toMatch(
      new RegExp("^[0-9a-f]{" + logic.ACCOUNT_ID_BYTES * 2 + "}$"),
    );
  });

  test("CSPRNG path: back-to-back calls differ (no constant/shared seed)", () => {
    const lib = loadWithSecurity(makeCsprngSecurity());
    expect(lib.secureRandomHex(logic.SESSION_TOKEN_BYTES)).not.toEqual(
      lib.secureRandomHex(logic.SESSION_TOKEN_BYTES),
    );
  });

  test("fallback path: degrades to logic.randomHex (Math.random) when the CSPRNG is absent", () => {
    const lib = loadWithSecurity(makePrngOnlySecurity());
    expect(lib.secureRandomHex(logic.SESSION_TOKEN_BYTES)).toMatch(
      new RegExp("^[0-9a-f]{" + logic.SESSION_TOKEN_BYTES * 2 + "}$"),
    );
    expect(lib.secureRandomHex(logic.PASSWORD_SALT_BYTES)).toMatch(
      new RegExp("^[0-9a-f]{" + logic.PASSWORD_SALT_BYTES * 2 + "}$"),
    );
  });

  test("produces the same shape logic.randomHex does (drop-in for the call sites)", () => {
    const lib = loadWithSecurity(makeCsprngSecurity());
    for (const bytes of [logic.SESSION_TOKEN_BYTES, logic.PASSWORD_SALT_BYTES, logic.ACCOUNT_ID_BYTES]) {
      expect(lib.secureRandomHex(bytes)).toHaveLength(logic.randomHex(bytes).length);
    }
  });
});
