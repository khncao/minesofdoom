/**
 * i18n hooks (todo: "Add localizations").
 *
 * - `useT()` — a stable translator bound to the live locale. Any component
 *   can call it; components re-render once when the locale flips
 *   (useSyncExternalStore on the tiny store in utils/i18n/i18n.ts).
 * - `useI18n()` — the control surface used by panels that need the live
 *   locale alongside the translator. Localization is disabled for now
 *   (todo: "Disable localization for now. English only"): the live store
 *   is pinned to English, there is no persisted preference, and the
 *   settings language picker is gone. Re-enabling is a settings-UI +
 *   useI18n change; the i18n core (tables, detection, format/translate)
 *   stays intact in utils/i18n.
 */
import {
  useCallback,
  useSyncExternalStore,
} from "react";
import {
  getLocale,
  subscribeI18n,
  translate,
  type Locale,
  type TranslationKey,
  type Vars,
} from "src/utils/i18n/i18n";
import {
  translateContent,
  type ContentNamespace,
  type ContentStrings,
} from "src/utils/i18n/content";

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
  /** The live locale the UI currently renders in (pinned to English
   *  while localization is disabled). */
  locale: Locale;
  t: Translator;
} {
  const locale = useSyncExternalStore(subscribeI18n, getLocale);
  const t = useT();
  return { locale, t };
}
