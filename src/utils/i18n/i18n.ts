/**
 * i18n core (todo: "Add localizations") — locale registry, detection, the
 * live locale store, and pure translation/format helpers.
 *
 * Design (mirrors the ads/iap provider pattern in spirit):
 *  - Pure and framework-free: no React here (the hook lives in
 *    src/hooks/useI18n.ts), so the rules are trivially unit-testable.
 *  - English (en.ts) is the source of truth; every other locale table is
 *    type-checked against its key set, with `{placeholder}` parity pinned
 *    in i18n.test.ts.
 *  - The player's language choice is a PREFERENCE ("auto" | locale),
 *    persisted separately from the save (a shared save must never import
 *    the sender's language; losing it only costs the auto-detection).
 *  - The live locale is a tiny module-level store so any number of
 *    components can render translated text (useT) and a single
 *    setLocale flips the whole app — no context plumbing through the
 *    component tree.
 */
import { getLocales } from "expo-localization";
import { en, type TranslationKey, type Vars } from "./en";
import { es } from "./es";

export type { TranslationKey, Vars };

export type Locale = "en" | "es";
/** "auto" = follow the device language; otherwise an explicit locale. */
export type LanguagePref = "auto" | Locale;

export const DEFAULT_LOCALE: Locale = "en";

/**
 * Locales the game ships, with the name each one shows for ITSELF in the
 * language picker (the player can recognize their own language even while
 * browsing in another).
 */
export const SUPPORTED_LOCALES: Record<
  Locale,
  { label: string; nativeLabel: string }
> = {
  en: { label: "English", nativeLabel: "English" },
  es: { label: "Spanish", nativeLabel: "Español" },
};

type Table = Record<TranslationKey, string>;
const TABLES: Record<Locale, Table> = { en, es };

/** Narrow an arbitrary string to a shipped locale (guard for stored prefs). */
export function isLocale(value: string): value is Locale {
  return value === "en" || value === "es";
}

/**
 * Device-language detection: the first installed/available locale that
 * matches a shipped one, else English. Wrapped in a defensive try/catch —
 * detection failing can never take the game down (web `navigator`,
 * jest's expo mock, or a stripped build).
 */
export function detectLocale(): Locale {
  try {
    const locales = getLocales();
    for (const loc of locales ?? []) {
      const code = loc?.languageCode?.toLowerCase();
      if (code != null && isLocale(code)) return code;
    }
  } catch {
    // fall through to the web fallback
  }
  try {
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.language === "string"
    ) {
      const primary = navigator.language.toLowerCase().split(/[-_]/)[0];
      if (isLocale(primary)) return primary;
    }
  } catch {
    // fall through to the default
  }
  return DEFAULT_LOCALE;
}

/** Resolve a stored preference to a concrete locale ("auto" → detect). */
export function resolveLanguagePreference(pref: LanguagePref): Locale {
  return pref === "auto" ? detectLocale() : pref;
}

// ---------------------------------------------------------------------------
// Live locale store
// ---------------------------------------------------------------------------

let currentLocale: Locale = detectLocale();
const listeners = new Set<() => void>();

export function getLocale(): Locale {
  return currentLocale;
}

export function setLocale(locale: Locale): void {
  if (!isLocale(locale) || locale === currentLocale) return;
  currentLocale = locale;
  for (const listener of [...listeners]) listener();
}

/** useSyncExternalStore-compatible subscribe (returns the unsubscribe). */
export function subscribeI18n(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Apply a stored preference to the live store (idempotent). */
export function applyLanguagePreference(pref: LanguagePref): void {
  setLocale(resolveLanguagePreference(pref));
}

// ---------------------------------------------------------------------------
// Formatting / translation (pure)
// ---------------------------------------------------------------------------

/**
 * Substitute `{name}` placeholders in a template. A missing variable
 * renders as the empty string (the parity tests guarantee placeholders
 * match across locales, so this is belt-and-suspenders, not recovery).
 */
export function format(template: string, vars?: Vars): string {
  if (vars == null) return template;
  return template.replace(
    /\{(\w+)\}/g,
    (match, name: string) => (name in vars ? String(vars[name]) : ""),
  );
}

/**
 * Translate `key` for a specific locale, interpolating `vars`. The English
 * table is the fallback for a missing template, so a translation that ever
 * loses a key degrades to English instead of showing the key name.
 */
export function translate(
  key: TranslationKey,
  locale: Locale,
  vars?: Vars,
): string {
  const template = TABLES[locale][key] ?? en[key];
  return vars != null ? format(template, vars) : template;
}
