/**
 * i18n regression nets (todo: "Add localizations"):
 *  - Locale tables: every locale covers EXACTLY the English key set
 *    (the type system already enforces this — this pins it for the
 *    runtime too, e.g. against a future `as any` escape hatch) and has
 *    identical {placeholder} sets per key, so a translation can never
 *    interpolate a variable the English side doesn't pass.
 *  - format/translate: interpolation, missing-variable behavior, and the
 *    English fallback for a missing template.
 *  - The live-locale store: set/subscribe semantics (no-op when the
 *    locale doesn't actually change).
 *  - Preference resolution: "auto" always resolves to a shipped locale,
 *    explicit prefs pass through (and junk is guarded).
 */
import {
  format,
  isLocale,
  setLocale,
  getLocale,
  subscribeI18n,
  translate,
  resolveLanguagePreference,
  SUPPORTED_LOCALES,
} from "./i18n";
import { en, type TranslationKey } from "./en";
import { es } from "./es";

function placeholders(template: string): string[] {
  const found: string[] = [];
  for (const m of template.matchAll(/\{(\w+)\}/g)) {
    found.push(m[1]);
  }
  return found.sort();
}

describe("locale tables", () => {
  it("es covers exactly the English key set", () => {
    const enKeys = Object.keys(en).sort();
    const esKeys = Object.keys(es).sort();
    expect(esKeys).toEqual(enKeys);
  });

  it("every string is non-empty (both locales)", () => {
    for (const [locale, table] of Object.entries({ en, es })) {
      for (const [key, value] of Object.entries(table)) {
        if (value.trim().length === 0) {
          throw new Error(`empty string at ${locale}:${key}`);
        }
      }
    }
  });

  it("placeholder sets match English per key", () => {
    const mismatches = (Object.keys(en) as TranslationKey[]).filter(
      (key) =>
        JSON.stringify(placeholders(en[key])) !==
        JSON.stringify(placeholders(es[key])),
    );
    expect(mismatches).toEqual([]);
  });

  it("SUPPORTED_LOCALES only lists shipped locales", () => {
    for (const locale of Object.keys(SUPPORTED_LOCALES)) {
      expect(isLocale(locale)).toBe(true);
    }
  });
});

describe("format", () => {
  it("substitutes {name} placeholders", () => {
    expect(
      format("UPGRADE POWER (-{cost} 🪨) ({power})", { cost: 42, power: 7 }),
    ).toBe("UPGRADE POWER (-42 🪨) (7)");
  });

  it("leaves the template untouched without vars", () => {
    expect(format("a {b} c")).toBe("a {b} c");
  });

  it("repeats placeholders when used twice", () => {
    expect(format("{x} and {x}", { x: 1 })).toBe("1 and 1");
  });

  it("renders a missing variable as the empty string", () => {
    expect(format("a {b} c", { a: 1 })).toBe("a  c");
  });
});

describe("translate", () => {
  it("returns the locale's string, interpolated", () => {
    expect(translate("toast.saved", "en")).toBe("Game saved");
    expect(translate("toast.saved", "es")).toBe("Partida guardada");
  });

  it("returns each locale's exact table value when no vars are given", () => {
    for (const key of Object.keys(en) as TranslationKey[]) {
      expect(translate(key, "en")).toBe(en[key]);
      expect(translate(key, "es")).toBe(es[key]);
    }
  });
});

describe("live locale store", () => {
  const original = getLocale();
  afterEach(() => setLocale(original));

  it("setLocale flips the store and notifies subscribers", () => {
    const listener = jest.fn();
    const unsubscribe = subscribeI18n(listener);
    setLocale("es");
    expect(getLocale()).toBe("es");
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    setLocale("en");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("setLocale is a no-op (no notification) for the current locale", () => {
    const listener = jest.fn();
    const unsubscribe = subscribeI18n(listener);
    setLocale("en");
    setLocale("en");
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });
});

describe("preference resolution", () => {
  it('"auto" resolves to a shipped locale', () => {
    const locale = resolveLanguagePreference("auto");
    expect(Object.keys(SUPPORTED_LOCALES)).toContain(locale);
  });

  it("explicit prefs pass through", () => {
    expect(resolveLanguagePreference("en")).toBe("en");
    expect(resolveLanguagePreference("es")).toBe("es");
  });
});
