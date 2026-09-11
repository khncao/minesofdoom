import {
  EquationSettings,
  defaultEquationSettings,
} from "src/utils/math/equations";
import {
  SaveData,
  SettingsData,
  defaultSettingsData,
  buildSaveData,
  migrateSaveData,
  serializeSaveData,
} from "./game";

/**
 * Additive, OPTIONAL settings fields on a save payload (plan: settings
 * portability). They travel alongside a SaveData record in save codes and
 * cloud snapshot blobs — they are NEVER part of the SaveData type or the
 * `save` AsyncStorage key (equation settings keep their own per-key store;
 * see the note next to SettingsData in game.ts). Absent on every legacy
 * code/blob, dropped by buildSaveData on the way in, so old and new
 * payloads interoperate both ways.
 */
export type SaveCodeSettings = {
  settings?: Partial<SettingsData>;
  equationSettings?: Partial<EquationSettings>;
  /** Additive (F52.1): the tutorial-dismissed flag, so a restored veteran
   *  doesn't re-see the 4-step tutorial. Absent on every legacy code;
   *  only a real `true` is applied on import (absent/false → keep local). */
  onboardingDone?: boolean;
};

/** A save record (SaveData) plus the optional settings ride-along fields. */
export type SaveCodePayload = SaveData & SaveCodeSettings;

/**
 * Shareable save codes (plan §4.3): encode the whole save as a base64
 * string so players can back up or transfer a save without a cloud account.
 *
 * Design notes:
 * - The encoder is a small pure base64 implementation instead of
 *   `btoa`/`atob` (not available on Hermes) or `Buffer` (Node only), so
 *   the same code path runs on web, Android, and iOS and is trivially
 *   unit-testable without a JS engine's globals.
 * - No compression: a save serializes to ~1.5KB of JSON (~2KB base64),
 *   which is fine for clipboard sharing and keeps decoding dependency-free.
 * - Decoding goes through migrateSaveData + buildSaveData, the same
 *   pipeline the storage loader uses, so a code is only ever as trusted as
 *   a stored save (clamped levels, filtered cosmetic ids, no NaN).
 */
export const SAVE_CODE_PREFIX = "MOD1";
export const SAVE_CODE_PREFIX_LEN = SAVE_CODE_PREFIX.length + 1; // + dot

const B64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Encode a UTF-8 string as a base64 string (standard alphabet, padded). */
export function base64Encode(input: string): string {
  const bytes = utf8Encode(input);
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : NaN;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : NaN;
    out += B64_ALPHABET[b0 >> 2];
    out += B64_ALPHABET[((b0 & 3) << 4) | (Number.isNaN(b1) ? 0 : b1 >> 4)];
    out += Number.isNaN(b1)
      ? "="
      : B64_ALPHABET[((b1 & 15) << 2) | (Number.isNaN(b2) ? 0 : b2 >> 6)];
    out += Number.isNaN(b2) ? "=" : B64_ALPHABET[b2 & 63];
  }
  return out;
}

const B64_LOOKUP = new Map<string, number>();
for (let i = 0; i < B64_ALPHABET.length; i++) {
  B64_LOOKUP.set(B64_ALPHABET[i], i);
}

/**
 * Decode a base64 string to UTF-8. Tolerates whitespace (paste artifacts).
 * Returns null if the input isn't valid base64.
 */
export function base64Decode(input: string): string | null {
  const chars = input.replace(/\s+/g, "");
  if (chars.length % 4 === 1) return null; // can't be valid base64
  const stripped = chars.replace(/=+$/, "");
  if (stripped.length % 4 === 1) return null;
  const bytes: number[] = [];
  let acc = 0;
  let accBits = 0;
  for (const ch of stripped) {
    const v = B64_LOOKUP.get(ch);
    if (v == null) return null;
    acc = (acc << 6) | v;
    accBits += 6;
    if (accBits >= 8) {
      accBits -= 8;
      bytes.push((acc >> accBits) & 0xff);
      acc &= (1 << accBits) - 1;
    }
  }
  return utf8Decode(bytes);
}

const decodeLead = (b: number): { cp: number; width: number } | null => {
  if (b < 0xc0) return null; // not a lead byte (ASCII or stray continuation)
  if (b < 0xe0) return { cp: b & 31, width: 1 };
  if (b < 0xf0) return { cp: b & 15, width: 2 };
  if (b < 0xf8) return { cp: b & 7, width: 3 };
  return null; // overlong 5/6-byte sequences are invalid in UTF-8
};

function utf8Decode(bytes: number[]): string | null {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    const head = bytes[i];
    if (head < 0x80) {
      out += String.fromCharCode(head);
      continue;
    }
    const lead = decodeLead(head);
    if (lead == null || i + lead.width >= bytes.length) return null;
    let cp = lead.cp;
    for (let k = 1; k <= lead.width; k++) {
      const c = bytes[i + k];
      if ((c & 0xc0) >> 6 !== 2) return null; // must be a continuation byte
      cp = (cp << 6) | (c & 63);
    }
    i += lead.width;
    out += String.fromCodePoint(cp);
  }
  return out;
}

// --- UTF-8 helpers (saves are ASCII in practice, but round-trips should
// --- not depend on that)

function utf8Encode(str: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const cp = str.codePointAt(i)!;
    if (cp > 0xffff) i++; // consume the surrogate pair
    if (cp < 0x80) {
      bytes.push(cp);
    } else if (cp < 0x800) {
      bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 63));
    } else if (cp < 0x10000) {
      bytes.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    } else {
      bytes.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 63),
        0x80 | ((cp >> 6) & 63),
        0x80 | (cp & 63),
      );
    }
  }
  return bytes;
}

/**
 * Serialize a save record plus its optional settings ride-along fields
 * (settings portability) into one JSON string. `undefined` fields are
 * omitted, so a legacy-shaped code stays byte-identical to before.
 */
export function serializeSavePayload(
  data: SaveData,
  settings?: Partial<SettingsData>,
  equationSettings?: Partial<EquationSettings>,
  onboardingDone?: boolean,
): string {
  const payload: SaveCodePayload = { ...data };
  if (settings != null) payload.settings = settings;
  if (equationSettings != null) payload.equationSettings = equationSettings;
  // F52.1: only emit the flag when true — legacy-shaped codes stay
  // byte-identical when the caller doesn't thread it.
  if (onboardingDone === true) payload.onboardingDone = true;
  return serializeSaveData(payload);
}

/** Serialize the save into a prefixed base64 code. */
export function encodeSaveCode(
  data: SaveData,
  settings?: Partial<SettingsData>,
  equationSettings?: Partial<EquationSettings>,
  onboardingDone?: boolean,
): string {
  return `${SAVE_CODE_PREFIX}.${base64Encode(
    serializeSavePayload(data, settings, equationSettings, onboardingDone),
  )}`;
}

/**
 * Pick the known, type-correct fields out of an untrusted record, keyed
 * off the defaults object (the same merge-over-defaults shape the
 * settings stores load with). Returns undefined when nothing valid came
 * through, so callers can keep a payload legacy-shaped instead of
 * emitting empty objects.
 */
function pickPartial<T extends Record<string, unknown>>(
  defaults: T,
  candidate: unknown,
): Partial<T> | undefined {
  if (
    candidate == null ||
    typeof candidate !== "object" ||
    Array.isArray(candidate)
  ) {
    return undefined;
  }
  const out: Partial<T> = {};
  let any = false;
  for (const key of Object.keys(defaults) as (keyof T)[]) {
    const fallback = defaults[key];
    const value = (candidate as Record<string, unknown>)[String(key)];
    if (value == null || typeof value !== typeof fallback) continue;
    if (typeof fallback === "number" && !Number.isFinite(value)) continue;
    // SAFETY: `value` passed the same-typeof check against `defaults`' own
    // key, so only `defaults`' keys ever reach `out` and every stored value
    // matches that key's declared type (both records are flat primitives).
    out[key] = value as T[keyof T];
    any = true;
  }
  return any ? out : undefined;
}

/**
 * Validate the optional settings ride-along fields of a parsed save
 * payload (absent/unknown/corrupt → dropped, never thrown). Keyed off the
 * defaults objects, so a future new field is picked up automatically.
 */
export function parseSaveCodeSettings(
  parsed: Record<string, unknown>,
): SaveCodeSettings {
  return {
    settings: pickPartial(defaultSettingsData, parsed.settings),
    equationSettings: pickPartial(
      defaultEquationSettings,
      parsed.equationSettings,
    ),
    // F52.1: pass through only a real boolean (a corrupted field is dropped,
    // like the pickPartial above).
    onboardingDone:
      typeof parsed.onboardingDone === "boolean"
        ? parsed.onboardingDone
        : undefined,
  };
}

/**
 * Parse a save code back into a current-version save. Returns null if the
 * code is unparseable at any step (bad base64, bad JSON, non-object JSON).
 * The same permissive, clamping field handling as the storage loader
 * applies, so a valid-but-partial or older save still imports.
 */
export function decodeSaveCode(
  code: string,
  now: number,
): SaveCodePayload | null {
  const trimmed = code.trim();
  const body = trimmed.startsWith(`${SAVE_CODE_PREFIX}.`)
    ? trimmed.slice(SAVE_CODE_PREFIX_LEN)
    : trimmed;
  const json = base64Decode(body);
  if (json == null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }
  const asRecord = parsed as Record<string, unknown>;
  // Extract + validate the settings ride-along BEFORE the build (which
  // drops unknown fields); legacy payloads simply come back with none.
  const rideAlong = parseSaveCodeSettings(asRecord);
  const migrated = migrateSaveData(asRecord);
  const save = buildSaveData(migrated, now);
  const payload: SaveCodePayload = save;
  if (rideAlong.settings != null) payload.settings = rideAlong.settings;
  if (rideAlong.equationSettings != null) {
    payload.equationSettings = rideAlong.equationSettings;
  }
  if (rideAlong.onboardingDone != null) {
    payload.onboardingDone = rideAlong.onboardingDone;
  }
  return payload;
}
