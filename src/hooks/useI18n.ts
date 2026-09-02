/**
 * i18n hooks (todo: "Add localizations").
 *
 * - `useT()` — a stable translator bound to the live locale. Any component
 *   can call it; components re-render once when the locale flips
 *   (useSyncExternalStore on the tiny store in utils/i18n/i18n.ts).
 * - `useI18n()` — the full control surface, used by the language picker
 *   (Settings) and by the root screen: it ALSO owns the persisted
 *   language preference (AsyncStorage key "language", default "auto") and
 *   applies it to the live store on load/change. Multiple mounted
 *   instances are safe: applyLanguagePreference is idempotent.
 *
 * The preference is deliberately NOT part of the game save (a shared
 * save must never import the sender's language) and NOT part of
 * SettingsData (the language should flip instantly, not wait for a
 * "Save" tap).
 */
import {
  useCallback,
  useEffect,
  useSyncExternalStore,
} from "react";
import { useLocalStorage } from "./useLocalStorage";
import {
  applyLanguagePreference,
  getLocale,
  subscribeI18n,
  translate,
  type LanguagePref,
  type Locale,
  type TranslationKey,
  type Vars,
} from "src/utils/i18n/i18n";
import {
  translateContent,
  type ContentNamespace,
  type ContentStrings,
} from "src/utils/i18n/content";

/** AsyncStorage key for the persisted language preference. */
export const languageKey = "language";

/** A translator bound to the locale at render time. */
export type Translator = (key: TranslationKey, vars?: Vars) => string;

/** The stable translator bound to the live locale (see module docs). */
export function useT(): Translator {
  const locale = useSyncExternalStore(subscribeI18n, getLocale);
  return useCallback(
    (key: TranslationKey, vars?: Vars) => translate(key, locale, vars),
    [locale],
  );
}

/** A content-name translator bound to the live locale. */
export type ContentTranslator = (
  ns: ContentNamespace,
  id: string,
  fallback: ContentStrings,
) => ContentStrings;

/**
 * Translator for DATA-driven content names (cosmetics, goal tiers,
 * achievements, records, IAP labels, legal titles, biomes — see
 * utils/i18n/content.ts). Call sites pass the data-module value as the
 * fallback, so English stays in the data modules and a missing translation
 * degrades to English instead of crashing.
 */
export function useContent(): ContentTranslator {
  const locale = useSyncExternalStore(subscribeI18n, getLocale);
  return useCallback(
    (ns, id, fallback) => translateContent(ns, id, locale, fallback),
    [locale],
  );
}

export function useI18n(): {
  /** The live locale the UI currently renders in. */
  locale: Locale;
  /** The persisted preference ("auto" | locale). */
  language: LanguagePref;
  setLanguage: (pref: LanguagePref) => void;
  t: Translator;
} {
  const [language, setStoredLanguage] = useLocalStorage<LanguagePref>(
    languageKey,
    "auto",
  );
  const locale = useSyncExternalStore(subscribeI18n, getLocale);
  const t = useT();
  // Flip the whole app (re-detects for "auto") whenever the preference
  // changes — including the first time it loads from storage.
  useEffect(() => {
    applyLanguagePreference(language);
  }, [language]);
  const setLanguage = useCallback(
    (pref: LanguagePref) => setStoredLanguage(pref),
    [setStoredLanguage],
  );
  return { locale, language, setLanguage, t };
}
